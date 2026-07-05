FROM python:3.11-slim

WORKDIR /app

# 设置 pip 镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖文件
COPY pyproject.toml .

# 安装 Python 依赖
RUN pip install --no-cache-dir -e . || pip install --no-cache-dir .

# 复制源代码和配置
COPY src/ ./src/
COPY langgraph.json .

# 创建必要目录
RUN mkdir -p uploads logs

# 设置 Python 路径
ENV PYTHONPATH=/app/src

# 暴露端口
EXPOSE 2024

# 启动命令
CMD ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-browser", "--allow-blocking"]
