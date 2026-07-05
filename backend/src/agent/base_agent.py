import os
import copy
import traceback
import time
import threading
import asyncio
from typing import Callable, Awaitable
from loguru import logger
from agent.llm.llm import OpenAICompatibleLLM
from tavily import TavilyClient
from agent.post import Post
import json
from agent.search_cache import get_cached, set_cached
from agent.exceptions import (
    TransientError,
    PermanentError,
)


class RateLimiter:
    def __init__(self, max_qps: float = 15.0):
        self.max_qps = max_qps
        self.min_interval = 1.0 / max_qps
        self.last_request_time = 0
        self.lock = threading.Lock()
        self._alock = asyncio.Lock()
        logger.info(f"速率限制器已初始化: 最大QPS={max_qps}, 最小间隔={self.min_interval:.3f}秒")

    def acquire(self):
        with self.lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.min_interval:
                wait_time = self.min_interval - time_since_last
                logger.debug(f"速率限制：需要等待 {wait_time:.3f} 秒")
                time.sleep(wait_time)
                self.last_request_time = time.time()
                return wait_time
            else:
                self.last_request_time = current_time
                return 0.0

    async def aacquire(self):
        async with self._alock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.min_interval:
                wait_time = self.min_interval - time_since_last
                logger.debug(f"速率限制(异步)：需要等待 {wait_time:.3f} 秒")
                await asyncio.sleep(wait_time)
                self.last_request_time = time.time()
                return wait_time
            else:
                self.last_request_time = current_time
                return 0.0


_web_search_rate_limiter = None

def get_web_search_rate_limiter(max_qps: float = None) -> RateLimiter:
    global _web_search_rate_limiter
    if _web_search_rate_limiter is None:
        if max_qps is None:
            max_qps = float(os.getenv("WEB_SEARCH_MAX_QPS", "12"))
        _web_search_rate_limiter = RateLimiter(max_qps=max_qps)
    return _web_search_rate_limiter


def _retry_with_classified_errors(
    callable_fn,
    max_attempts: int = 3,
    base_delay: float = 1.5,
    error_prefix: str = "调用",
):
    for attempt in range(max_attempts):
        try:
            return callable_fn()
        except PermanentError:
            raise
        except TransientError as e:
            if attempt < max_attempts - 1:
                delay = base_delay * (attempt + 1)
                logger.warning(
                    f"{error_prefix}瞬时错误（尝试 {attempt + 1}/{max_attempts}），"
                    f"{delay:.1f}s 后重试：{e}"
                )
                time.sleep(delay)
            else:
                logger.error(f"{error_prefix}重试{max_attempts}次全部失败：{e}")
        except Exception as e:
            if attempt < max_attempts - 1:
                delay = base_delay * (attempt + 1)
                logger.warning(
                    f"{error_prefix}未知错误（尝试 {attempt + 1}/{max_attempts}），"
                    f"{delay:.1f}s 后重试：{e}\n{traceback.format_exc()}"
                )
                time.sleep(delay)
            else:
                logger.error(
                    f"{error_prefix}重试{max_attempts}次全部失败（未知错误）：{e}\n"
                    f"{traceback.format_exc()}"
                )
    return None


class Agent:
    step_prompt = """{prompt}"""
    def __init__(self, model_id="qwen3.7-plus"):
        self.llm = OpenAICompatibleLLM(model_id=model_id)

    def __call__(self, prompt):
        response = self.llm.generate_response(prompt)
        return response

    async def acall(self, prompt):
        return await self.llm.agenerate_response(prompt)

    def set_step_prompt(self, prompt):
        self.step_prompt = prompt

    def step(self, **kwargs):
        step_prompt = self.prompt_format(self.step_prompt, **kwargs)
        def _attempt():
            response = self(step_prompt)
            return self.post_process(response)
        return _retry_with_classified_errors(
            _attempt,
            error_prefix="大模型调用",
        ) or ""

    async def astep(self, **kwargs):
        step_prompt = self.prompt_format(self.step_prompt, **kwargs)
        for attempt in range(3):
            try:
                response = await self.acall(step_prompt)
                response = self.post_process(response)
                return response
            except PermanentError as e:
                logger.error(f"大模型调用永久错误，放弃重试：{e}")
                raise
            except TransientError as e:
                if attempt < 2:
                    delay = 1.5 * (attempt + 1)
                    logger.warning(f"大模型瞬时错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"大模型调用重试3次全部失败：{e}")
            except Exception as e:
                if attempt < 2:
                    delay = 1.5 * (attempt + 1)
                    logger.warning(f"大模型调用未知错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}\n{traceback.format_exc()}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"大模型调用重试3次全部失败（未知错误）：{e}\n{traceback.format_exc()}")
        return ""

    async def astream_step(self, on_token: Callable[[str], Awaitable[None]], **kwargs):
        step_prompt = self.prompt_format(self.step_prompt, **kwargs)
        for attempt in range(3):
            try:
                full_response = ""
                async for token in self.llm.astream_response(step_prompt):
                    full_response += token
                    try:
                        await on_token(token)
                    except Exception:
                        pass
                response = self.post_process(full_response)
                return response
            except PermanentError:
                raise
            except TransientError as e:
                if attempt < 2:
                    delay = 1.5 * (attempt + 1)
                    logger.warning(f"流式大模型调用瞬时错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"流式大模型调用重试3次全部失败：{e}")
            except Exception as e:
                if attempt < 2:
                    delay = 1.5 * (attempt + 1)
                    logger.warning(f"流式大模型调用未知错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}\n{traceback.format_exc()}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"流式大模型调用重试3次全部失败（未知错误）：{e}\n{traceback.format_exc()}")
        logger.warning("流式大模型调用全部失败，回退到非流式调用")
        response = await self.astep(**kwargs)
        try:
            await on_token(response)
        except Exception:
            pass
        return response

    def post_process(self, response):
        return response

    def prompt_format(self, prompt, **kwargs):
        prompt_ = copy.deepcopy(prompt)
        for k in kwargs.keys():
            rep = "{"+k+"}"
            prompt_ = prompt_.replace(rep, str(kwargs[k]))
        return prompt_


class JsonAgent(Agent):
    def __init__(self, model_id="qwen3.7-plus", keys=None):
        super().__init__(model_id)
        self.keys = keys

    def post_process(self, response):
        result = json.loads(Post.extract_pattern(response, pattern="json"))
        if not self.keys:
            return result
        return self.keys(**result)


class WebSearchAgent(Agent):
    def __init__(self):
        self.tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    def step(self, prompt, **kwargs):
        count = kwargs.get("count", 10)

        cached = get_cached(prompt)
        if cached is not None:
            return cached

        rate_limiter = get_web_search_rate_limiter()

        def _attempt():
            wait_time = rate_limiter.acquire()
            if wait_time > 0:
                logger.debug(f"速率限制等待: {wait_time:.3f}秒")

            response = self.tavily_client.search(
                query=prompt,
                max_results=count,
                include_answer=False
            )
            result = self.post_process(response)

            if result:
                set_cached(prompt, result=result)

            return result

        return _retry_with_classified_errors(
            _attempt,
            base_delay=2.0,
            error_prefix="Web搜索",
        )

    async def astep(self, prompt, **kwargs):
        count = kwargs.get("count", 10)

        cached = get_cached(prompt)
        if cached is not None:
            return cached

        rate_limiter = get_web_search_rate_limiter()

        for attempt in range(3):
            try:
                wait_time = await rate_limiter.aacquire()
                if wait_time > 0:
                    logger.debug(f"速率限制等待(异步): {wait_time:.3f}秒")

                response = await asyncio.to_thread(
                    self.tavily_client.search,
                    query=prompt,
                    max_results=count,
                    include_answer=False,
                )
                result = self.post_process(response)

                if result:
                    set_cached(prompt, result=result)

                return result
            except PermanentError as e:
                logger.error(f"Web搜索永久错误，放弃重试：{e}")
                raise
            except TransientError as e:
                if attempt < 2:
                    delay = 5 * (attempt + 1) if "429" in str(e) else 2.0 * (attempt + 1)
                    logger.warning(f"Web搜索瞬时错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Web搜索重试3次全部失败：{e}")
            except Exception as e:
                error_msg = str(e)
                if attempt < 2:
                    delay = 5 * (attempt + 1) if "429" in error_msg else 2.0 * (attempt + 1)
                    logger.warning(f"Web搜索未知错误（尝试 {attempt + 1}/3），{delay:.1f}s 后重试：{e}\n{traceback.format_exc()}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Web搜索重试3次全部失败（未知错误）：{e}\n{traceback.format_exc()}")
        return None

    def post_process(self, response):
        if response is None:
            raise Exception("Web搜索结果为空")

        results = response.get("results", [])
        if not results:
            raise Exception("Web搜索没有返回任何结果")

        processed_pages = []
        for item in results:
            if isinstance(item, dict):
                processed_pages.append({
                    "snippet": item.get("content", ""),
                    "title": item.get("title", ""),
                    "url": item.get("url", "")
                })

        if not processed_pages:
            raise Exception("Web搜索结果格式错误")

        return processed_pages


if __name__ == '__main__':
    agent = WebSearchAgent()
    response = agent.step(prompt="稳定币", count=10)
    logger.info(response)
