# DeepResearch 企业级智能研究助手

基于 LangGraph 多智能体架构的企业级深度研究应用，支持文件上传、联网搜索、知识库管理。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 多智能体研究 | Plan → Research → Writer 三阶段子图架构 |
| 联网搜索 | Tavily API，支持并行多路搜索 |
| 文件上传 | 支持 PDF/Word/Excel/PPT/MD/TXT，异步解析 |
| 企业知识库 | 上传文件自动入库，研究时自动检索复用 |
| 用户认证 | PostgreSQL + Redis Session |
| 实时进度 | SSE 推送研究进度到前端 |
| 历史记录 | 对话历史保存，支持查看和继续 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ / FastAPI / LangGraph |
| 前端 | React 19 / TypeScript / Vite / Tailwind CSS |
| 数据库 | PostgreSQL 16 / Redis Stack |
| 向量库 | Milvus（可选） |
| LLM | 阿里云百炼（通义千问系列） |
| 搜索 | Tavily API |

---

## 项目结构

```
D:/all_ds/
├── backend/                    # 后端服务
│   ├── src/agent/
│   │   ├── app.py             # FastAPI 入口 + API 路由
│   │   ├── graph.py           # LangGraph 主图编排
│   │   ├── base_agent.py      # Agent 类 + Tavily 搜索
│   │   ├── sub_agents/        # ResearchAgent + WriterAgent 子图
│   │   ├── kb/                # 知识库（文档解析 + Milvus）
│   │   ├── auth/              # 用户认证
│   │   ├── db/                # 数据库模型
│   │   └── task_queue.py      # Redis Streams 任务队列
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── ParticleBackground.tsx  # 粒子动效
│   │   │   ├── HistorySidebar.tsx      # 历史侧边栏
│   │   │   ├── KnowledgeBase.tsx       # 知识库管理
│   │   │   ├── InputForm.tsx           # 输入框（含文件上传）
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── useResearchStream.ts   # SSE 研究流 Hook
│   │   └── App.tsx
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml          # Docker 编排文件
├── requirements.txt            # Python 依赖
└── README.md
```

---

## 快速开始

### 方式一：Docker 部署（推荐）

**前置条件：**
- Docker 和 Docker Compose 已安装

**启动步骤：**

```bash
# 1. 进入项目目录
cd D:/all_ds

# 2. 一键启动所有服务
docker-compose up -d

# 3. 查看启动状态
docker-compose ps
```

**访问地址：**

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | React 应用 |
| 后端 API | http://localhost:2024 | LangGraph 服务 |
| API 文档 | http://localhost:2024/docs | Swagger UI |

**登录账号：**

| 用户名 | 密码 |
|--------|------|
| zhangsan | zhangsan |
| lisi | lisi |

**停止服务：**

```bash
docker-compose down
```

**查看日志：**

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend
```

### 方式二：本地开发

**前置条件：**
- Python 3.11+
- Node.js 18+
- PostgreSQL 运行中
- Redis 运行中（需支持 RediSearch）

**启动后端：**

```bash
cd backend
pip install -e .
langgraph dev --no-browser --allow-blocking
```

**启动前端：**

```bash
cd frontend
npm install
npm run dev -- --host --force
```

---

## 环境变量配置

在 `backend/.env` 中配置：

```env
# LLM API
APP_TOKEN=你的百炼API Key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Tavily 搜索
TAVILY_API_KEY=你的Tavily API Key

# 模型配置
AVAILABLE_MODELS=[{"model_id":"qwen3.7-plus","display_name":"Qwen-Plus","icon":"Zap","icon_color":"orange-400"},{"model_id":"qwen3-max-2026-01-23","display_name":"Qwen-Max","icon":"Cpu","icon_color":"purple-400"}]

# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/deepresearch
REDIS_URL=redis://localhost:6379/0
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/login` | POST | 用户登录 |
| `/api/whoami` | GET | 获取当前用户 |
| `/api/models` | GET | 获取模型列表 |
| `/api/upload` | POST | 上传文件 |
| `/api/upload/{id}/status` | GET | 查询文件处理状态 |
| `/api/upload/list` | GET | 获取文件列表 |
| `/api/upload/{id}` | DELETE | 删除文件 |
| `/api/research` | POST | 提交研究任务 |
| `/api/research/{id}/stream` | GET | SSE 研究进度流 |
| `/api/history` | GET | 获取历史对话列表 |
| `/api/history/{id}/messages` | GET | 获取对话消息 |
| `/api/history/{id}` | DELETE | 删除历史记录 |

---

## Docker 端口规划

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|------------|------|
| Redis | 6379 | 6380 | 避免与现有 Redis 冲突 |
| PostgreSQL | 5432 | 5433 | 避免与现有 PostgreSQL 冲突 |
| Backend | 2024 | 2024 | LangGraph 服务 |
| Frontend | 80 | 3000 | React 应用 |

---

## 常见问题

**1. Docker 启动后前端无法连接后端**
- 检查后端是否正常启动：`docker-compose logs backend`
- 确认端口 2024 没有被占用

**2. 文件上传失败**
- 检查后端 uploads 目录权限
- 确认文件大小不超过 50MB

**3. 联网搜索不工作**
- 检查 `.env` 中 `TAVILY_API_KEY` 是否有效
- 确认网络可以访问 Tavily API

**4. 数据库连接失败**
- 检查 PostgreSQL 容器是否正常运行
- 确认 `.env` 中 `DATABASE_URL` 配置正确

---

## 开发说明

**添加新功能：**
1. 后端：在 `backend/src/agent/` 中添加新模块
2. 前端：在 `frontend/src/components/` 中添加新组件
3. API：在 `backend/src/agent/app.py` 中添加新路由

**代码规范：**
- 后端：Python 3.11+，使用 type hints
- 前端：TypeScript strict mode
- 提交前运行 `npx tsc --noEmit` 检查类型
