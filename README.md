# chicken-dinner-scheduler
Scheduler for Chicken Dinner

## 开黑预定（Cloudflare Pages + D1）

一个简单的网页：
- 填写昵称 + 参加开始/结束时间提交预定
- 输入任意时间段，查看该时段重叠参与的人与时间

### 本地开发

1) 安装/使用 Wrangler（任选其一）
- `npm i -g wrangler`
- 或 `npx wrangler@latest --version`

2) 创建并绑定 D1（示例）
- `wrangler d1 create chicken-dinner-scheduler`
- 将输出的 `database_id` 填入 `wrangler.toml`

3) 初始化表结构
- `npm run db:local`
- 或 `wrangler d1 migrations apply chicken-dinner-scheduler --local`

4) 启动 Pages 本地服务（带 Functions）
- `npm run dev`
- 或 `wrangler pages dev public --d1=DB`

打开 `http://localhost:8788/`。

### 部署（简要）

- 推荐：Cloudflare Pages 绑定 Git 仓库后部署。
- 在 Pages 项目中添加 D1 绑定：变量名 `DB`，指向你的 D1 数据库。
- 初始化线上库表：`npm run db:remote` 或 `wrangler d1 migrations apply chicken-dinner-scheduler --remote`

### Cloudflare Pages 部署（详细）

1) 准备 D1 数据库
- 本地登录：`wrangler login`
- 创建 D1：`wrangler d1 create chicken-dinner-scheduler`
- 将输出的 `database_id` 填入 `wrangler.toml`

2) 初始化线上表结构（只需一次）
- `npm run db:remote`

3) 创建 Pages 项目并绑定 D1
- Cloudflare Dashboard → Pages → Create a project → 连接此 GitHub 仓库
- Build settings：如果不需要构建，Build command 留空；Output directory 填 `public`
- Settings → Functions → D1 database bindings：添加绑定
  - Variable name：`DB`
  - Database：选择上面创建的 D1

4) 部署与验证
- 推送到默认分支后，Pages 会自动构建/部署
- 打开站点首页，提交一条预定后用查询表格确认返回数据

### API

- `POST /api/reservations`：`{ name, start, end, note? }`（`start/end` 为 ISO 时间）
- `GET /api/reservations?start=...&end=...`：返回与该时间段有重叠的参与记录

### 排错

如果出现 `no such table: reservations`：
- 先停掉 `wrangler pages dev ...`，执行一次 `npm run db:local`，再重启本地服务。
- 需要“重置本地库”时，可删除 `.wrangler/` 后再执行 `npm run db:local`。
