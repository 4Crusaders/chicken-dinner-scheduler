# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Cloudflare Pages + D1 的游戏预定系统（开黑预定），用于管理早/午/晚三个场次的预定。

### 开发命令

- `npm run dev` - 启动本地开发服务器（使用 wrangler pages dev，绑定 D1）
- `npm run db:local` - 初始化本地 D1 数据库（运行 migrations）
- `npm run db:remote` - 初始化远程 D1 数据库

### 数据库初始化

首次启动本地开发前，必须先运行 `npm run db:local` 初始化本地 D1 数据库。如果遇到 "no such table: bookings" 错误，停止开发服务器后重新运行该命令，然后重启 `npm run dev`。

数据库迁移文件位于 `migrations/0001_init.sql`。

### 架构说明

**Cloudflare Pages Functions** - 服务端逻辑位于 `functions/api/`：
- `bookings.js` - 预定 CRUD API（GET/POST/DELETE）
- `stats.js` - 统计信息 API
- `d1-client.js` - D1 数据库操作封装（增删改查、自动初始化）

**前端** - 静态文件位于 `public/`：
- `index.html` - 单页面应用入口（内嵌 CSS）
- `app.js` - 前端逻辑（状态管理、API 调用、DOM 渲染）
- `styles.css` - （目前样式内嵌在 HTML 中）

**配置文件**：
- `wrangler.toml` - Cloudflare Workers/Pages 配置，包含 D1 绑定
  - `pages_build_output_dir = "public"` - 静态文件目录
  - `[[d1_databases]]` - D1 数据库绑定，变量名为 `DB`

### API 端点

- `GET /api/bookings?filter=all|morning|afternoon|evening` - 获取预定列表
- `POST /api/bookings` - 提交预定（请求体: `{ name, session, remark? }`）
- `DELETE /api/bookings` - 清空所有预定
- `GET /api/stats` - 获取各场次统计

### 数据库自动初始化

`d1-client.js` 中的 `ensureDatabase()` 函数会在每个 Worker 实例首次请求时自动创建表结构（使用 `CREATE TABLE IF NOT EXISTS`），这是对迁移文件的兜底机制。但生产环境仍建议运行 migrations 以便版本控制。

### 前端状态管理

`app.js` 使用单一全局状态 `appState` 管理预定列表、选中的场次、筛选器等。渲染逻辑集中在 `render` 对象中，API 调用封装在 `api` 对象中。
