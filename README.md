# chicken-dinner-scheduler

Scheduler for Chicken Dinner
https://chicken.demonw.uk/

## 开黑预定（Cloudflare Pages + D1）

一个简单的网页：
- 填写昵称 + 选择场次（早/午/晚）+ 备注提交预定
- 查看公开预定看板与各场次统计
- 支持按场次筛选与一键清空

### 本地开发

1) 安装/使用 Wrangler（任选其一）
- `npm i -g wrangler`
- 或 `npx wrangler@latest --version`

2) 创建并绑定 D1（示例）
- `wrangler d1 create chicken-dinner-scheduler`
- 将输出的 `database_id` 填入 `wrangler.toml`

3) 初始化表结构（建议）
- `npm run db:local`
- 或 `wrangler d1 migrations apply chicken-dinner-scheduler --local`
- 迁移文件位于 `migrations/`（例如 `migrations/0001_init.sql`）
- 注：Functions 层做了 `CREATE TABLE IF NOT EXISTS` 的兜底初始化，但线上仍建议跑一次迁移以便可控升级。

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
- 打开站点首页，提交一条预定后用看板确认返回数据

### API

- `GET /api/bookings?filter=all|morning|afternoon|evening`：获取预定列表
- `POST /api/bookings`：`{ name, session, remark? }`
- `DELETE /api/bookings`：清空所有预定
- `GET /api/stats`：获取统计信息

### 排错

如果出现 `no such table: bookings`：
- 先停掉 `wrangler pages dev ...`，执行一次 `npm run db:local`，再重启本地服务。
- 需要“重置本地库”时，可删除 `.wrangler/` 后再执行 `npm run db:local`。
- 确认本地启动命令包含 `--d1=DB`，且 `wrangler.toml` 里存在 `[[d1_databases]] binding = "DB"`。
- 线上环境确认 Pages 项目已添加 D1 绑定且变量名为 `DB`。


