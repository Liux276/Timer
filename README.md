# 个人任务日程管理系统

个人任务/迭代管理 Web 应用。前端采用 Vue 3 + Naive UI + TailwindCSS + ECharts，后端采用 Node.js + Express + better-sqlite3。支持多用户登录、JWT 认证、角色权限（管理员/普通用户）、任务树管理、迭代跟踪、燃尽图看板，以及 WebDAV 定时备份。项目采用 pnpm monorepo 结构。

---

## 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0（推荐 9.x）

### 安装运行依赖（Ubuntu/Debian）

```bash
# 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm --activate
else
  npm install -g pnpm
fi

# 安装 native 模块编译工具（better-sqlite3 需要）
sudo apt-get install -y build-essential python3 make g++
```

### 安装依赖

```bash
# 克隆项目
git clone <repo-url> Time
cd Time

# 安装所有依赖（前后端一次完成）
pnpm install
```

### 环境变量（可选）

后端支持以下环境变量，均有合理默认值，开发环境可不设置：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 后端监听端口 |
| `HOST` | `127.0.0.1` | 后端监听地址（默认仅本机访问） |
| `JWT_SECRET` | 内置开发密钥 | JWT 签名密钥，**生产环境务必修改** |
| `CORS_ORIGIN` | `true`（允许所有来源） | 允许的 CORS 来源，可设为前端地址如 `http://localhost:5173` |

可通过创建 `packages/server/.env` 或命令行前缀方式设置：

```bash
# 示例：通过环境变量启动
HOST=127.0.0.1 PORT=3001 JWT_SECRET=my-secure-secret pnpm dev:server
```

### 启动开发环境

```bash
# 同时启动前后端（推荐）
pnpm dev

# 或分别启动
pnpm dev:server   # 后端: http://localhost:3000
pnpm dev:client   # 前端: http://localhost:5173
```

首次启动后端时，SQLite 数据库文件 `packages/server/data/Time.db` 会自动创建并初始化表结构。

**首次使用时**，访问前端页面会自动跳转到系统初始化页面（`/setup`），需创建第一个管理员账户。此后该页面将不可再访问。普通用户由管理员在「管理 → 用户管理」页面创建，注册功能已关闭。

### 构建生产版本

```bash
# 构建前后端
pnpm build

# 单独构建
pnpm build:client   # 输出到 packages/client/dist/
pnpm build:server   # 编译 TypeScript 到 packages/server/dist/
```

### 生产环境运行

```bash
# 构建后启动后端
cd packages/server
JWT_SECRET=your-production-secret node dist/index.js
```

前端构建产物为静态文件（`packages/client/dist/`），可部署到任意静态文件服务器（Nginx、Caddy 等）。

### 旧库离线清理无效迭代（备份库）

当历史数据库中存在异常迭代数据时，可对备份库离线清理（不影响在线库）：

```bash
# 仅检测，不落库
pnpm --filter @Time/server clean:iterations:dry-run -- --db /path/to/Time.db.bak

# 执行清理
pnpm --filter @Time/server clean:iterations:apply -- --db /path/to/Time.db.bak
```

清理规则：
- `name` 为空
- `planned_end < planned_start`
- `user_id` 对应用户不存在

---

## 功能概览

### 用户认证与权限

- 两种角色：**管理员**（admin）和 **普通用户**（user）
- 首次使用需通过初始化页面创建第一个管理员
- 注册功能已关闭，用户由管理员创建
- JWT Bearer Token 认证（含角色信息）
- 多用户数据隔离
- 管理员专属功能：用户管理（CRUD）、WebDAV 备份配置
- 普通用户可在设置页修改自己的显示名称和密码

### 任务管理

- 树形任务结构（父子任务、递归汇总工时和进度）
- 四种状态：未开始 / 进行中 / 已完成 / 已取消（支持任意状态间切换）
- 三级优先级：低 / 中 / 高
- 列表支持行内编辑（状态、优先级、迭代、工时、标题双击编辑）
- 多条件筛选（状态、优先级、迭代、关键词搜索）
- 批量操作（批量改状态、批量删除）
- 导出 Excel / CSV
- 四个任务列表支持“列设置”，并按页面自动保存用户选择

### 迭代管理

- 迭代创建（名称、起止日期必填）
- 三种状态（规划中 / 执行中 / 已结束）支持切换，仍保证同一时刻仅一个 active
- 首页展示最新迭代详情（紧凑信息卡）
- 全部迭代列表支持直接行内编辑迭代信息
- 迭代详情任务按树状展示并支持行内编辑

### 统计看板

- 迭代燃尽图（理想线 + 实际线，基于每日快照）
- 阶段性工时统计（按周/月/季/年粒度聚合）

### WebDAV 备份

- 全局唯一配置，由管理员统一管理
- 可配置 WebDAV 服务器地址、凭据、备份间隔
- 使用 `VACUUM INTO` 无锁备份，不影响正常读写
- 支持手动触发备份和从远端恢复
- 备份文件命名规则：`Time_backup_YYYYMMDD_HHmmss.db`

### 安全

- Helmet 安全响应头
- 全局速率限制（200 请求/分钟）+ 认证端点独立限制（10 请求/分钟）
- XSS 输入过滤（`xss` 库）
- 参数化 SQL 查询（防注入）
- 请求体大小限制（1MB）
- SQLite 作为嵌入式文件数据库，不对外提供独立数据库端口
- 后端默认监听 `127.0.0.1`，避免开发环境直接暴露外网

---

## 项目结构

```
Time/
├── packages/
│   ├── client/                    # Vue 3 前端
│   │   ├── src/
│   │   │   ├── api/               # Axios 请求封装 + 认证拦截器
│   │   │   ├── assets/            # 静态资源 + CSS
│   │   │   ├── layouts/           # MainLayout（Naive UI 布局 + 导航）
│   │   │   ├── router/            # 路由定义 + 认证守卫
│   │   │   ├── stores/            # Pinia 状态管理
│   │   │   │   ├── authStore.ts   # 用户认证
│   │   │   │   ├── taskStore.ts   # 任务 CRUD + 树
│   │   │   │   ├── iterationStore.ts  # 迭代管理
│   │   │   │   └── statsStore.ts  # 统计数据
│   │   │   ├── types/             # TypeScript 类型 + 常量配置
│   │   │   ├── views/             # 页面视图
│   │   │   │   ├── LoginView.vue          # 登录
│   │   │   │   ├── SetupView.vue          # 系统初始化（首位管理员注册）
│   │   │   │   ├── AdminUsersView.vue     # 用户管理（管理员）
│   │   │   │   ├── IterationsView.vue     # 迭代主页（左侧卡片列表 + 右侧详情）
│   │   │   │   ├── RequirementsView.vue   # 需求列表（行内编辑）
│   │   │   │   ├── TaskDetailView.vue     # 任务详情
│   │   │   │   ├── DashboardView.vue      # 看板统计
│   │   │   │   └── SettingsView.vue       # 个人信息 + WebDAV 配置（管理员）
│   │   │   ├── App.vue            # Naive UI Provider 层
│   │   │   └── main.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── server/                    # Node.js 后端
│       ├── src/
│       │   ├── db/
│       │   │   ├── index.ts       # SQLite 连接初始化
│       │   │   └── schema.sql     # 建表 SQL（6 张表）
│       │   ├── middleware/
│       │   │   └── auth.ts        # JWT 认证 + 管理员授权中间件
│       │   ├── routes/
│       │   │   ├── auth.ts        # 登录/初始化/用户管理
│       │   │   ├── tasks.ts       # 任务 CRUD + 批量 + 导出
│       │   │   ├── iterations.ts  # 迭代 CRUD + 最新迭代
│       │   │   ├── stats.ts       # 燃尽图 + 工时统计
│       │   │   └── backup.ts      # WebDAV 备份管理
│       │   ├── services/          # 业务逻辑层
│       │   │   ├── authService.ts
│       │   │   ├── taskService.ts
│       │   │   ├── iterationService.ts
│       │   │   ├── statsService.ts
│       │   │   └── backupService.ts
│       │   ├── utils/
│       │   │   └── sanitize.ts    # XSS 过滤
│       │   ├── app.ts             # Express 应用配置
│       │   └── index.ts           # 入口
│       ├── data/                  # SQLite 数据库文件（自动生成）
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 路由

| 路径 | 页面 | 说明 | 认证 |
|---|---|---|---|
| `/setup` | SetupView | 系统初始化（创建首位管理员） | 公开（仅无管理员时可用） |
| `/login` | LoginView | 登录 | 公开 |
| `/` | — | 重定向到 `/iterations` | — |
| `/iterations` | IterationsView | 迭代主页（左侧卡片列表 + 右侧详情，小屏仅展示卡片列表） | 需要 |
| `/iterations/:id` | IterationsView | 迭代详情（小屏独立详情页） | 需要 |
| `/requirements` | RequirementsView | 需求列表（树形 + 行内编辑） | 需要 |
| `/requirements/:id` | TaskDetailView | 任务详情 | 需要 |
| `/dashboard` | DashboardView | 看板（燃尽图 + 工时统计） | 需要 |
| `/settings` | SettingsView | 个人信息 + WebDAV 备份配置（管理员可见） | 需要 |
| `/admin/users` | AdminUsersView | 用户管理 | 需要 + 管理员 |

---

## API

所有受保护接口需在请求头中携带 `Authorization: Bearer <token>`。

### 认证与用户管理

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/auth/setup-status` | 检查是否需要初始化 | 公开 |
| POST | `/api/auth/setup` | 创建首位管理员 | 公开（仅无管理员时） |
| POST | `/api/auth/login` | 登录，返回 JWT token | 公开 |
| GET | `/api/auth/me` | 获取当前用户信息 | 登录 |
| PUT | `/api/auth/profile` | 修改自己的显示名称/密码 | 登录 |
| GET | `/api/auth/users` | 用户列表 | 管理员 |
| POST | `/api/auth/users` | 创建用户 | 管理员 |
| PUT | `/api/auth/users/:id` | 编辑用户 | 管理员 |
| DELETE | `/api/auth/users/:id` | 删除用户（不能删自己） | 管理员 |

### 任务

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tasks` | 任务列表（支持 status/priority/iteration_id/search 等筛选） |
| GET | `/api/tasks/tree` | 任务树（含计算字段） |
| GET | `/api/tasks/:id` | 任务详情（含子任务 + 状态日志） |
| POST | `/api/tasks` | 创建任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| PATCH | `/api/tasks/:id/status` | 变更状态（服务端校验流转） |
| DELETE | `/api/tasks/:id` | 删除（级联删除子任务） |
| POST | `/api/tasks/batch` | 批量操作 |
| GET | `/api/tasks/export` | 导出（format=xlsx/csv） |

### 迭代

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/iterations` | 迭代列表 |
| GET | `/api/iterations/latest` | 最新迭代 |
| GET | `/api/iterations/:id` | 迭代详情 |
| POST | `/api/iterations` | 创建迭代 |
| PUT | `/api/iterations/:id` | 更新迭代 |
| PATCH | `/api/iterations/:id/status` | 变更迭代状态 |
| DELETE | `/api/iterations/:id` | 删除迭代 |

### 统计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats/burndown/:iterationId` | 燃尽图数据 |
| GET | `/api/stats/workload` | 工时统计（start_date, end_date, granularity） |

### 备份（管理员）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/backup/config` | 获取全局 WebDAV 配置 |
| PUT | `/api/backup/config` | 更新全局配置 |
| POST | `/api/backup/trigger` | 手动触发备份 |
| GET | `/api/backup/status` | 备份状态 |
| POST | `/api/backup/restore` | 从 WebDAV 恢复 |

### 健康检查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 返回 `{ status: "ok" }`（公开，无需认证） |

---

## 数据模型

数据库包含 6 张表，首次启动后端时自动创建：

| 表 | 说明 |
|---|---|
| `users` | 用户（id, username, password_hash, display_name, role） |
| `tasks` | 任务（树形结构，含状态/优先级/工时/计划日期，通过 user_id 隔离） |
| `task_status_logs` | 状态变更记录 |
| `iterations` | 迭代（状态: planning/active/completed，起止日期必填） |
| `daily_snapshots` | 每日工时快照（燃尽图数据源） |
| `webdav_config` | 全局 WebDAV 备份配置（单行） |

### 状态流转规则

```
任务:   not_started / in_progress / completed / cancelled
  支持任意状态切换（同状态不重复提交）

迭代:   planning / active / completed
  支持切换，且服务端保证同一时间仅一个 active
```

---

## 技术栈

| 层面 | 技术 |
|---|---|
| 前端框架 | Vue 3 + Composition API + TypeScript |
| UI 组件库 | Naive UI |
| 样式 | TailwindCSS 3 + CSS 设计令牌系统 |
| 图表 | ECharts 5（vue-echarts） |
| 图标 | AppIcon SVG 矢量系统（内建 16 枚图标） |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| HTTP | Axios |
| 构建 | Vite 6 |
| PWA | vite-plugin-pwa |
| 后端 | Express.js + TypeScript（tsx 运行） |
| 数据库 | better-sqlite3（SQLite） |
| 认证 | JWT（jsonwebtoken + bcryptjs） |
| 安全 | helmet + express-rate-limit + xss |
| 备份 | webdav（npm 库）|
| 定时任务 | node-cron |
| 导出 | exceljs + csv-stringify |
| 包管理 | pnpm workspace（monorepo）|

---


## UI 设计系统

项目采用基于 CSS 设计令牌的统一 UI 系统，遵循玻璃拟态 + 低饱和暖色风格。

### 设计风格
- **玻璃拟态**：半透明磨砂玻璃质感卡片（`card-glass`），导航栏（`nav-glass`），`backdrop-blur` 模糊效果
- **低饱和暖色调**：米白背景 `#FAF8F5`，温暖橙色强调 `#E07A4B`，深暖灰文字 `#2D2A26`
- **极简排版**：Poppins（西文）+ Noto Sans SC（中文），模块化比例 H1:36px → xs:12px
- **8px 网格间距**：所有间距为 4 的倍数（4, 8, 12, 16, 24, 32, 40, 48, 56, 64px）
- **微交互动效**：悬浮上浮（`hover-float`）、页面渐入（`page-fade`）、入场错开（`stagger-item`）
- **响应式**：PC 顶部导航 + 移动底部标签栏，`max-w-7xl` 内容区

### 核心色板

| 角色 | 颜色 | CSS 令牌 |
|---|---|---|
| 页面背景 | `#FAF8F5` | `--color-bg-base` |
| 次级背景 | `#F3F0ED` | `--color-surface` |
| 卡片背景 | `#FFFFFF` | `--color-elevated` |
| 品牌强调 | `#E07A4B` | `--color-accent` |
| 主文字 | `#2D2A26` | `--color-text-primary` |
| 次级文字 | `#6B645B` | `--color-text-secondary` |
| 辅助文字 | `#9C958B` | `--color-text-muted` |
| 边框 | `#E8E4DF` | `--color-border` |
| 成功 | `#5B9A73` | `--color-success` |
| 警告 | `#D4883A` | `--color-warning` |
| 危险 | `#C15A4A` | `--color-danger` |
| 信息 | `#5B8BA5` | `--color-info` |

### 通用组件

| 组件 | 路径 | 用途 |
|---|---|---|
| PageHeader | `components/common/PageHeader.vue` | 页面标题栏（标题、返回、操作栏） |
| StatCard | `components/common/StatCard.vue` | 统计数字卡片（值、后缀、标签、图标） |
| AppIcon | `components/common/AppIcon.vue` | SVG 矢量图标（16 枚内建图标） |

### CSS 工具类

| 类名 | 用途 |
|---|---|
| `card-solid` | 实底卡片（列表项、子卡片） |
| `card-glass` | 玻璃拟态卡片（空状态等） |
| `card-no-hover` | 关闭 Naive UI 卡片 hover 阴影 |
| `subsection-title` | 分区标题样式 |
| `btn-primary` / `btn-ghost` | 按钮样式 |
| `stat-card` | 统计卡片样式 |
| `nav-glass` | 导航栏玻璃效果 |
| `hover-float` | 悬浮上浮动效 |

详细设计规范见 `AGENT.md` 第 4 节。

## 开发命令

```bash
pnpm dev              # 同时启动前后端开发服务
pnpm dev:server       # 仅启动后端（tsx watch，自动重载）
pnpm dev:client       # 仅启动前端（Vite HMR）
pnpm build            # 构建前后端
pnpm build:client     # 仅构建前端
pnpm build:server     # 仅构建后端
```
