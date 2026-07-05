# mypy: disable - error - code = "no-untyped-def,misc"
import pathlib
import json
import asyncio
import traceback
import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Request, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
from agent.logger import setup_logger, log_request_details
from agent.configuration import Configuration, load_available_models_from_env
from agent.task_queue import enqueue_task, start_worker, read_task_events
from agent.auth.middleware import AuthMiddleware
from agent.auth.routes import router as auth_router

# 文件上传配置
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".md", ".txt", ".csv"}

# ── 应用 lifespan（管理后台任务启动/关闭）───────────────────────────


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    """应用级 lifespan：管理后台任务的启动和关闭."""
    try:
        asyncio.create_task(start_worker())
    except Exception as exc:
        logger.warning(f"[TaskQueue] worker 启动失败 ({type(exc).__name__}): {exc}")
    yield
    # 关闭数据库引擎
    try:
        from agent.db.engine import close_engine
        await close_engine()
    except Exception as exc:
        logger.warning(f"[数据库] 关闭引擎时出错 ({type(exc).__name__}): {exc}")


app = FastAPI(docs_url=None, redoc_url=None, lifespan=_app_lifespan)
setup_logger()

# ── 认证中间件（最先添加 = 最外层，拦截非登录请求）─────────────
app.add_middleware(AuthMiddleware)

# ── 注册认证路由 ───────────────────────────────────────────────────
app.include_router(auth_router)

# ── API 路由 ─────────────────────────────────────────────────────────

# 添加获取模型列表的API端点
@app.get("/api/models")
async def get_available_models():
    """获取可用的LLM模型列表"""
    try:
        # 直接从环境变量加载模型列表
        models = load_available_models_from_env()
        models_data = [
            {
                "model_id": model.model_id,
                "display_name": model.display_name,
                "icon": model.icon,
                "icon_color": model.icon_color
            }
            for model in models
        ]
        logger.info(f"返回模型列表: {models_data}")
        return JSONResponse(content={"models": models_data})
    except ValueError as e:
        # 配置解析错误（如 AVAILABLE_MODELS JSON 格式错误）
        logger.error(f"模型配置解析失败 (ValueError): {e}")
        return JSONResponse(
            content={"error": "模型配置格式错误，请检查 AVAILABLE_MODELS 环境变量", "details": str(e)},
            status_code=500
        )
    except Exception as e:
        # 未知异常 — 记录完整 traceback 用于排查
        logger.error(f"获取模型列表失败 ({type(e).__name__}): {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            content={"error": "获取模型列表失败", "details": str(e)},
            status_code=500
        )


# ── 文件上传端点 ───────────────────────────────────────────────────

# 内存存储文件元数据（生产环境应使用数据库）
_uploaded_files: dict[int, dict] = {}


@app.post("/api/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """上传文件，异步解析并存入知识库。

    请求：multipart/form-data，file 字段
    响应：{ id, title, file_type, process_status, created_at }
    """
    user_id: int = getattr(request.state, "user_id", 0)

    # 检查文件扩展名
    ext = pathlib.Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}，支持: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 检查文件大小
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过限制（最大 50MB）"
        )

    # 保存文件
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = int(uuid.uuid4().int % 100000000)
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    with open(saved_path, "wb") as f:
        f.write(content)

    # 记录文件元数据
    from datetime import datetime
    file_meta = {
        "id": file_id,
        "user_id": user_id,
        "title": file.filename,
        "file_type": ext,
        "file_path": saved_path,
        "process_status": "pending",
        "chunk_count": 0,
        "created_at": datetime.now().isoformat(),
    }
    _uploaded_files[file_id] = file_meta

    logger.info(f"[Upload] 文件已上传: {file.filename} (id={file_id}, user={user_id})")

    # 异步处理文件（解析+分块+向量化）
    asyncio.create_task(_process_uploaded_file(file_id))

    return JSONResponse(content={
        "id": file_id,
        "title": file.filename,
        "file_type": ext,
        "process_status": "parsing",
        "created_at": file_meta["created_at"],
    })


async def _process_uploaded_file(file_id: int):
    """后台处理上传的文件"""
    from agent.kb.document_processor import process_uploaded_file, parse_document, chunk_text

    meta = _uploaded_files.get(file_id)
    if not meta:
        return

    try:
        meta["process_status"] = "parsing"

        # 解析文件
        text = parse_document(meta["file_path"])
        if not text or not text.strip():
            meta["process_status"] = "failed"
            meta["error"] = "文件内容为空"
            return

        # 分块
        chunks = chunk_text(text)
        meta["chunk_count"] = len(chunks)
        meta["process_status"] = "vectorizing"

        # 尝试写入 Milvus
        try:
            from agent.kb.fact_store import FactStore
            from agent.kb import FactExtractor
            store = FactStore()
            if store and store._client:
                # 使用 store 的 embedding 函数
                embeddings = store._embed_texts(chunks)
                ids = [f"kb_{meta['user_id']}_{file_id}_{i}" for i in range(len(chunks))]
                metadatas = [
                    {
                        "user_id": meta["user_id"],
                        "file_id": file_id,
                        "chunk_index": i,
                        "source_type": "upload",
                        "title": meta["title"],
                        "file_ext": meta["file_type"],
                    }
                    for i in range(len(chunks))
                ]
                store._collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=chunks,
                    metadatas=metadatas,
                )
                logger.info(f"[Upload] Milvus 写入完成: {len(chunks)} chunks")
        except Exception as e:
            logger.warning(f"[Upload] Milvus 写入失败（不影响文件使用）: {e}")

        # 保存解析后的文本内容到元数据（供研究时直接读取）
        meta["parsed_text"] = text[:50000]  # 限制最大 50KB
        meta["process_status"] = "done"
        logger.info(f"[Upload] 文件处理完成: {meta['title']} ({len(chunks)} chunks)")

    except Exception as e:
        meta["process_status"] = "failed"
        meta["error"] = str(e)
        logger.error(f"[Upload] 文件处理失败: {e}")


@app.get("/api/upload/{file_id}/status")
async def get_upload_status(file_id: int, request: Request):
    """查询文件处理状态"""
    meta = _uploaded_files.get(file_id)
    if not meta:
        raise HTTPException(status_code=404, detail="文件不存在")

    return JSONResponse(content={
        "id": meta["id"],
        "title": meta["title"],
        "process_status": meta["process_status"],
        "chunk_count": meta["chunk_count"],
        "error": meta.get("error"),
    })


@app.get("/api/upload/list")
async def list_uploads(request: Request):
    """获取当前用户的上传文件列表"""
    user_id: int = getattr(request.state, "user_id", 0)
    user_files = [
        {
            "id": f["id"],
            "title": f["title"],
            "file_type": f["file_type"],
            "process_status": f["process_status"],
            "chunk_count": f["chunk_count"],
            "created_at": f["created_at"],
        }
        for f in _uploaded_files.values()
        if f["user_id"] == user_id
    ]
    return JSONResponse(content={"files": user_files, "total": len(user_files)})


@app.delete("/api/upload/{file_id}")
async def delete_upload(file_id: int, request: Request):
    """删除上传的文件"""
    user_id: int = getattr(request.state, "user_id", 0)
    meta = _uploaded_files.get(file_id)

    if not meta:
        raise HTTPException(status_code=404, detail="文件不存在")
    if meta["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权删除此文件")

    # 删除本地文件
    if os.path.exists(meta["file_path"]):
        os.remove(meta["file_path"])

    del _uploaded_files[file_id]
    logger.info(f"[Upload] 文件已删除: {meta['title']} (id={file_id})")

    return JSONResponse(content={"message": "已删除"})

# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        # 记录请求基本信息
        logger.info(f"收到用户请求：{request.method} {request.url}")

        # 如果是POST请求且有body，记录详细信息
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.body()
            if body:
                try:
                    body_data = json.loads(body.decode())
                    log_request_details(body_data)
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    logger.debug(
                        f"无法解析请求体为JSON ({type(e).__name__}): "
                        f"{body[:200]!r}"
                    )
                    log_request_details(body.decode())
    except Exception as e:
        # 日志记录本身的错误不应影响请求处理
        logger.error(
            f"记录请求日志时出错 ({type(e).__name__}): {e}\n"
            f"{traceback.format_exc()}"
        )

    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(
            f"处理请求时出错 ({type(e).__name__}): {e}\n"
            f"请求: {request.method} {request.url}\n"
            f"{traceback.format_exc()}"
        )
        raise


# ── 异步研究端点（任务队列 + SSE）────────────────────────────────────

@app.post("/api/research")
async def submit_research(request: Request):
    """提交研究任务，立即返回 task_id 和 SSE 流地址.

    请求体示例：
    {
        "messages": [{"type": "human", "content": "分析AI芯片市场趋势"}],
        "initial_search_query_count": 3,
        "max_research_loops": 3,
        "reasoning_model": "qwen-plus-latest",
        "uploaded_files": [{"id": 1, "title": "财报.pdf", "content": "..."}]
    }
    """
    user_id: int = getattr(request.state, "user_id", 0)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            content={"error": "请求体必须是 JSON 格式"},
            status_code=400,
        )

    # 处理上传文件内容：从 _uploaded_files 中获取解析后的文本
    uploaded_files_data = body.get("uploaded_files", [])
    uploaded_files_with_content = []
    for file_ref in uploaded_files_data:
        file_id = file_ref.get("id") if isinstance(file_ref, dict) else file_ref
        meta = _uploaded_files.get(file_id)
        if meta and meta.get("parsed_text"):
            uploaded_files_with_content.append({
                "id": file_id,
                "title": meta["title"],
                "content": meta["parsed_text"],
            })

    try:
        task_id = await enqueue_task(
            messages=body.get("messages", []),
            initial_search_query_count=body.get("initial_search_query_count", 2),
            max_research_loops=body.get("max_research_loops", 2),
            reasoning_model=body.get("reasoning_model", ""),
            plan_status=body.get("plan_status", "unconfirmed"),
            plan=body.get("plan", ""),
            task_id=body.get("task_id", ""),  # 前端回传则复用，否则后端生成新 UUID
            uploaded_files=uploaded_files_with_content,
        )
    except Exception as exc:
        logger.error(f"[TaskQueue] 任务入队失败 ({type(exc).__name__}): {exc}")
        return JSONResponse(
            content={"error": f"任务提交失败: {exc}"},
            status_code=503,
        )

    # 建立用户与 task（thread）的关联
    try:
        from agent.db.engine import get_session_factory
        from agent.db.models import UserThread
        from sqlalchemy import select

        # 从用户输入中提取主题摘要作为 title（取第一条 human 消息 = 用户原始问题）
        messages = body.get("messages", [])
        title_text = ""
        for m in messages:
            if m.get("type") == "human" and m.get("content", "").strip():
                title_text = m["content"].strip()[:256]
                break

        async with get_session_factory()() as session:
            # 检查是否已存在（同一事务内先查后插）
            existing = await session.execute(
                select(UserThread).where(
                    UserThread.user_id == user_id,
                    UserThread.thread_id == task_id,
                )
            )
            if existing.scalar_one_or_none() is None:
                session.add(UserThread(
                    user_id=user_id,
                    thread_id=task_id,
                    title=title_text,
                ))
                await session.commit()
    except Exception as exc:
        logger.warning(f"[用户关联] 写入 user_threads 失败 ({type(exc).__name__}): {exc}")
        # 不影响任务提交的响应，关联可以后续补录

    return JSONResponse(content={
        "task_id": task_id,
        "stream_url": f"/api/research/{task_id}/stream",
    })


@app.get("/api/research/{task_id}/stream")
async def stream_research(task_id: str, request: Request):
    """SSE 端点：推送研究进度事件。

    客户端断开后可用 Last-Event-ID header 重连，不会丢失中间事件。
    """
    last_event_id = request.headers.get("Last-Event-ID", "0")

    async def event_generator():
        try:
            async for event_str in read_task_events(task_id, last_event_id):
                yield f"data: {event_str}\n\n"
        except Exception as exc:
            logger.warning(f"[TaskQueue] SSE 推送异常 ({type(exc).__name__}): {exc}")
            yield f"data: {{\"error\": \"{exc}\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )


# ── 历史聊天记录 API ─────────────────────────────────────────────

@app.get("/api/history")
async def get_history(request: Request):
    """获取当前用户的聊天历史记录列表"""
    user_id: int = getattr(request.state, "user_id", 0)

    try:
        from agent.db.engine import get_session_factory
        from agent.db.models import UserThread
        from sqlalchemy import select, desc

        async with get_session_factory()() as session:
            result = await session.execute(
                select(UserThread)
                .where(UserThread.user_id == user_id)
                .order_by(desc(UserThread.created_at))
                .limit(50)
            )
            threads = result.scalars().all()

            history = [
                {
                    "thread_id": t.thread_id,
                    "title": t.title or "未命名研究",
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in threads
            ]

            return JSONResponse(content={"history": history, "total": len(history)})
    except Exception as exc:
        logger.warning(f"[History] 获取历史记录失败 ({type(exc).__name__}): {exc}")
        return JSONResponse(content={"history": [], "total": 0})


@app.delete("/api/history/{thread_id}")
async def delete_history(thread_id: str, request: Request):
    """删除指定聊天历史记录"""
    user_id: int = getattr(request.state, "user_id", 0)

    try:
        from agent.db.engine import get_session_factory
        from agent.db.models import UserThread
        from sqlalchemy import delete

        async with get_session_factory()() as session:
            await session.execute(
                delete(UserThread).where(
                    UserThread.user_id == user_id,
                    UserThread.thread_id == thread_id,
                )
            )
            await session.commit()

            return JSONResponse(content={"message": "已删除"})
    except Exception as exc:
        logger.warning(f"[History] 删除历史记录失败 ({type(exc).__name__}): {exc}")
        return JSONResponse(content={"error": "删除失败"}, status_code=500)


@app.get("/api/history/{thread_id}/messages")
async def get_thread_messages(thread_id: str, request: Request):
    """获取指定对话的消息历史"""
    user_id: int = getattr(request.state, "user_id", 0)

    try:
        from agent.db.engine import get_session_factory
        from agent.db.models import UserThread
        from sqlalchemy import select

        # 验证用户有权访问此对话
        async with get_session_factory()() as session:
            result = await session.execute(
                select(UserThread).where(
                    UserThread.user_id == user_id,
                    UserThread.thread_id == thread_id,
                )
            )
            thread = result.scalar_one_or_none()
            if not thread:
                return JSONResponse(content={"error": "对话不存在"}, status_code=404)

        # 从 Redis 获取对话消息（存储在 research:thread_messages:{thread_id}）
        import redis.asyncio as redis_lib
        import json as json_lib

        r = redis_lib.from_url(REDIS_URL, decode_responses=True)
        messages_key = f"research:thread_messages:{thread_id}"
        messages_data = await r.get(messages_key)

        if messages_data:
            messages = json_lib.loads(messages_data)
            return JSONResponse(content={
                "thread_id": thread_id,
                "title": thread.title or "未命名研究",
                "messages": messages,
            })

        # 如果没有存储的消息，返回空列表
        return JSONResponse(content={
            "thread_id": thread_id,
            "title": thread.title or "未命名研究",
            "messages": [],
        })
    except Exception as exc:
        logger.warning(f"[History] 获取对话消息失败 ({type(exc).__name__}): {exc}")
        return JSONResponse(content={"error": "获取失败"}, status_code=500)
