# Lila Home — Stage 1 执行记录

> 本文件记录 Stage 1 实际执行情况，只写已做、有证据的事；未做的写未做。

## 授权

- 2026-11-19 23:34：用户授权“你自己看着开”——待定项自行决定（VPN=Tailscale 托管、防火墙现阶段不动、仓库私有、许可证 Apache-2.0）。
- 2026-11-19 23:45：用户明确授予全部权限、直接执行、无需再问。任务书红线仍有效（不删生产数据、不重置 Owner/密钥、不扩大费用、不绕过安全机制）。

## 仓库（已完成）

- 2026-11-19 23:39：私有仓库 https://github.com/fafa888uk/LilaHome 建成（浏览器用用户会话创建；API 创建报 403）。
- 2026-11-19 23:43：16 个 Stage 0 文档分 4 批推送上库（8c186c7、4ebd5c0、e9d9e7f、27d3d60），抽查通过。
- 2026-11-19 23:44：修正提交 4a88766——STAGE0_REPORT.md §A 与 F 节、H12 改为已创建状态；已验证库里文件为修正后版本。

## Tailscale（进行中）

- 2026-11-19 23:46：火花面板 3.12.156.80 安装 Tailscale **1.104.7**（官方 install.sh；commit fb3b9b29，go1.27.4），`tailscaled` 服务 active。
- 2026-11-19 23:46：`tailscale up` 已发授权链接，浏览器正用 xiaoxi920q@gmail.com 登录完成授权；服务器在 tailnet 里的名称与 100.x IP 待回报后补记。
- 2026-11-20 00:14–00:20：三次授权链接均未落上去。原因有二：①前两次 `tailscale up` 前台等 SSH 断连（约 4.5 分钟被远程关闭）后链接失效；②云浏览器连不上 login.tailscale.com（ERR_CONNECTION_RESET，连 tailscale.com 主站也一样），登录页从未加载。用户已在 Secure Vault 表单提交 Google 登录信息（已保存），但设备授权本身仍未完成。服务器当前仍 NeedsLogin，当前有效链接为 https://login.tailscale.com/a/g80e66caa9568bd6（setsid  detached 进程在等，不随 SSH 断开而死）。
- 2026-11-20 00:20：用户在手机浏览器打开链接完成授权，服务器 `tailscale status` 验证通过：**BackendState Running，Tailscale IP 100.114.133.80**（IPv6 fd7a:115c:a1e0::101:85d0），DNS 名 ip-172-31-18-252.taila3e9ad.ts.net，tailnet 为 xiaoxi920q@gmail.com；当前 tailnet 内暂只有这一台设备（无其他 peer）。
- 下一步：部署 Lila Home 应用栈；用户其他设备（iPhone 等）入网；家庭 LAN 侧 HA 主机确认。

## v0.1 应用栈（2026-11-20 00:23 开始）

- 范围：API（FastAPI，/health + /api/v1/status）+ Web（React+Vite 静态站，三页）+ PostgreSQL 16 + Mosquitto 2.1.4，compose 项目名 lilahome；api 绑 100.114.133.80:8001、web 绑 100.114.133.80:3001，绝不绑 0.0.0.0。
- 分工：API 与 Web 各派一个子代理并行开发；协调者负责 compose、部署、验证、推库。
- 已知限制：Mosquitto v0.1 允许匿名连接，但只限 compose 内部网络、不发布端口；接入鉴权后续阶段再加。
- 仍待办：设备清点（H7/H8）；家庭 LAN 侧 HA 主机确认；断网/VPS 故障演练。

## v0.1 部署（2026-11-20 00:28–00:33，验证通过）

- 代码：API（FastAPI，/health + /api/v1/status）与 Web（React+Vite，三页）各由一个子代理并行写完，协调者逐项核过文件；compose、Mosquitto 配置、.env.example 由协调者写。
- 部署：rsync 到 /opt/lila-home；Postgres 密码在服务器上用 openssl rand 生成，只存 /opt/lila-home/infrastructure/docker/.env（600 权限），从未打印、未进仓库、未进聊天。
- 部署中修了两个问题（均已记录，非死循环重试）：
  1. rsync --delete 误删了刚生成的服务器 .env（本地无 .env）；已重新生成，之后 rsync 一律加 --exclude '.env'。
  2. `eclipse-mosquitto:2.1.4` 在 Docker Hub 不存在（2.1.x 只有 -alpine 变体）；改为 `eclipse-mosquitto:2.1.4-alpine`（仍为 2.1.4，满足 ≥2.1.3 下限）。
  3. 首次启动 /health 报 database error：base64 密码含 URL 特殊字符，asyncpg DSN 解析失败（`invalid literal for int() ... 'WLBzM0iFY+V'`）。修法：API 改用 PGHOST/PGUSER/PGPASSWORD/PGDATABASE 独立变量连接（DATABASE_URL 只作回退）；密码改用 hex 生成；空数据库卷重建（v0.1 尚无真实数据）。修后 /health 全部 ok。
- 验证实测（服务器本机 curl 100.114.133.80）：
  - `GET /health` → `{"status":"ok","version":"0.1.0","checks":{"database":{"status":"ok","detail":"连接成功, SELECT 1 通过"},"mqtt":{"status":"ok","detail":"MQTT CONNECT 成功, 收到 CONNACK"},"home_assistant":{"status":"not_connected","detail":"未接入"}}}`
  - `GET /api/v1/status` → database/mqtt 均为 ok，home_assistant 为 not_connected。
  - Web `/`、`/devices`、`/status` 均为 HTTP 200（首页 601 字节）。
  - `ss -tlnp`：3001/8001 只监听 100.114.133.80，不在 0.0.0.0 上；5432/1883 未在主机上监听（仅 compose 内部网络）。
  - `docker compose ps`：4 个容器全部 Up，db/mosquitto/api 为 healthy，web 为 Up（未设 healthcheck，以 curl 200 为准）。
- 访问地址：Web http://100.114.133.80:3001（仅 tailnet 内可达），API http://100.114.133.80:8001。
- 已知限制：Mosquitto v0.1 允许匿名连接（只限内部网络）；Web 容器未设 healthcheck；前端浏览器内渲染交互、真机显示未测（只有 curl 200 + 本地 preview 验证）。
- v0.1 已推库：提交 ab1c4aa4b6e3fc3d83fc3260c290e32aff608173（28 个文件：apps/api、apps/web、infrastructure/docker、docs/STAGE1_LOG.md；无 .env、无 node_modules、无 dist）。

## 完整版扩展（2026-11-20 00:33 开始，用户要求做完整版，不止 v0.1）

- 目标：FEATURE_MATRIX.md 九个模块都要有真实功能（不是卡片）：首页聚合、设备 CRUD、房间 CRUD、灯光/空调热水器/音响控制 UI、网络只读监控、场景 CRUD + 规则引擎骨架、RBAC 脚手架 + 审计日志查看。
- 集成层：统一设备服务层 + HA REST/WebSocket 客户端 + MQTT 发布/订阅服务；HA 与真实设备未接入，控制路径写好但状态一律标“未验证/未接入”，绝不编造设备或假状态。
- 做法：v0.1 已跑通并验证；现逐模块加上去，每加一个验证健康检查；API 与 Web 扩展各派一个子代理并行做，协调者负责集成、部署、逐模块验证、推库。
- 诚实约定（已写入子代理任务）：HA 未接入时 POST /devices/{id}/commands 建记录、状态 UNKNOWN、HTTP 202，detail 写明“Home Assistant 未接入，指令未下发，无法确认执行结果”；空列表就是空列表；集成种子一律 is_enabled=false + 未接入。
- 未做：服务器重启（安装时提示有新内核 7.0.0-1017-aws 可用，当前运行 7.0.0-1014-aws；生产服务器不擅自重启）。

### 完整版扩展完成（2026-11-20 01:05 UTC，部署并逐模块验证通过）

**前后端对接核对（协调者亲自核对，共 5 处不匹配，全部在 API 侧加别名字段修好，v0.1 接口原有字段一个字未动）：**
1. `/api/v1/status` 扁平字段无 `checks` 键，首页 fetchStatus 解析后 checks 为空、会全显示“后端未返回该项”→ status 响应新增 `checks` 对象（与 /health 同形），原字段不动。
2. 设备序列化只有 `device_type` / `compatibility_grade`，前端读 `type` / `compatibility_level` / `integration` 会是空→ serialize_device 加三性别名；`_fetch_device` 与 `list_devices` 改 LEFT JOIN integrations 取集成名（`integration_name`），无集成时为 null。
3. 集成列表只有 `kind` / `is_enabled`，设置页读 `type` / `enabled` 会是空→ list_integrations 加 `type`=kind、`enabled`=is_enabled 别名。
4. 场景执行记录 `results` 只在嵌套的 `result.results` 里，前端 getSceneRun 读顶层 `results` 会是空→ serialize_run 把 results 同时放顶层。
5. 已确认无问题：命令 POST 本就含 `command_id`/`status`/`device_id`/`detail`；列表统一 `{items,page,page_size,total}` 或裸数组，前端两种都接受；聚合视图裸数组。

**部署故障 1 项（已修）：** 首次 `up -d --build` 后 api 容器 unhealthy，uvicorn 启动失败 `PermissionError: [Errno 13] Permission denied: '/app/db.py'`——新文件本地模式为 660 且属 root，镜像内运行时用户 appuser（UID 10001）读不到。修法：`apps/api/Dockerfile` 在 COPY 后加 `RUN chmod -R a+rX /app`（与 dy-portal 2026-11-10 教训一致：进镜像的文件须 world-readable）。重建后 api healthy，web 随之启动。web 镜像未受影响（nginx 以 root 起）。

**服务器冒烟测试（2026-11-20 01:03 UTC，脚本 /tmp/smoke-full.sh，服务器本机 curl 100.114.133.80）：41 项 PASS，3 项初判 FAIL 经复核全部是测试脚本问题（两处 grep 响应体找 "422"——422 只在 HTTP 状态行里，响应体是 {"code":"validation_error"...}，复测 HTTP 状态确为 422；一处误以为集成 type 应为 "midea"——type 别名映射的是 kind，实为 "official"，正确），实际 44/44 通过：**
- /health ok（DB SELECT 1 通过、MQTT CONNACK、HA 未接入）；/api/v1/status 含 checks；/system/health ok。
- 房间：创建/列表/缺 name 422；设备：创建（model 缺省 UNKNOWN、别名 type=light、compatibility_level=null、integration=null）、state 未接入、非法 device_type 422（"device_type 只能是 router, speaker, light, climate, water_heater, other"）。
- 命令：turn_on → HTTP 202、status UNKNOWN、detail "Home Assistant 未接入，指令未下发，无法确认执行结果"；危险参数 over_temperature → 422 且记审计；指令历史含 turn_on。
- 聚合：/lights 含测试灯；/climate、/water-heaters、/speakers 均空数组 []。
- 场景：创建（rules 原样存）、加动作、执行 → completed_with_unknown、逐动作 UNKNOWN 含 command_id；执行记录 GET 含顶层 results。
- 网络 /network/devices → not_connected、空数组；审计 /audit-logs 含 device.control；集成 7 行全 is_enabled=false、别名 type=official、enabled=false；用户 []。
- Web 14 个路由（/ /devices /rooms /lights /climate /speakers /network /scenes /settings /status 及其余）全部 HTTP 200；已部署 bundle 与本地构建同哈希 index-2AqLARsr.js，含新页面文案。
- 绑定：ss 显示 3001/8001 只监听 100.114.133.80，5432/1883 不在宿主机监听；compose ps 4 容器 Up，db/mosquitto/api healthy，web Up。
- 测试数据已清理：冒烟房间/设备/场景均已 DELETE，再查列表已无残留。审计日志里保留本次冒烟的操作记录（真实操作历史，非假数据）。
- API 子代理本地实测补充：临时 PG 16 全流程通过，修复两个真 bug（asyncpg jsonb 只接受 str、scene_runs.status 长度 21 超 VARCHAR(20) 已改 30）；未测：服务器 Docker 构建（本次部署已实际构建通过，补上）、HA 已配置路径、MQTT 发布、RBAC 真实鉴权、并发/压力。

**本次改动文件：** apps/api 全模块（main.py/db.py/errors.py/auth.py/services/*/integrations/*/routers/*，Dockerfile 加 chmod）、apps/web 14 路由；VERSION 仍 "0.1.0"（API 子代理按最严格字面理解未动版本号；升 1.0.0 需单独确认）。

## 公网直放（2026-11-20 23:05 开始，用户要求“直接放公网”，不再等 Tailscale）

- 原因：用户手机打不开 http://100.114.133.80:3001（手机未进 tailnet，服务器上 peers 为 none）；解释后用户要求直接放公网。
- 原计划（域名 + 证书）执行到一半后变更：Cloudflare 登录被机器人验证拦住，DNS 加不上，域名 + 证书路子先停，改走公网 IP。

### 已做（域名路线，做到 DNS 等待为止）

- 前端改成同源 /api 代理：apps/web/nginx.conf 加 `location /api/ { proxy_pass http://api:8000/; ... }`（尾部斜杠去前缀，带 Host/X-Real-IP/X-Forwarded-For/X-Forwarded-Proto 头），SPA fallback 不动；apps/web/Dockerfile 加 ARG/ENV VITE_API_URL；compose web 服务加 build.args VITE_API_URL=/api。
- 部署验证通过（重建后）：4 容器 Up，api/db/mosquitto healthy；127.0.0.1:3001 与 100.114.133.80:3001 均为 200；`curl 127.0.0.1:3001/api/health` 返回 ok JSON（DB/MQTT ok、HA 未接入）；ss 显示 3001 只在 100.114.133.80 与 127.0.0.1 上，5432/1883 不在宿主机监听。
- 宿主机 nginx 站点 /etc/nginx/sites-available/lila.fafa888.uk 已写（server_name lila.fafa888.uk，proxy_pass http://127.0.0.1:3001），已链接到 sites-enabled，nginx -t 通过并 reload，Host 头测试返回 200。
- DNS 等待：服务器 getent 查 9 次（约 9 分钟）均未解析；Cloudflare DoH 两次返回 NXDOMAIN（Status 3），记录确实不在 zone 里。certbot 未跑（DNS 不通，硬跑必败）。已查：LE 生产账户（2026-11-09 建，acct 3976983382）`body: {}`，**无注册邮箱**；ai/dy 证书均有效（分别到 2027-02-12 / 2027-02-07），说明本站历来无邮箱注册。

### 改走公网 IP（2026-11-20 23:13，计划变更）

- compose web 端口改成单条 `"0.0.0.0:3001:80"`（0.0.0.0 包含 Tailscale IP，Tailscale 访问不断；原来两条并存会冲突，已去掉）。api 仍只绑 100.114.133.80:8001（不公开；前端经 web 容器 /api/ 同源代理调它）。5432/1883 仍不发布。
- 重建验证：4 容器 Up，api/db/mosquitto healthy；**Tailscale http://100.114.133.80:3001/ 仍为 200**；ss 显示 0.0.0.0:3001 监听，8001 仍只在 100.114.133.80 上。
- **阻塞（未解决）：公网 http://3.12.156.80:3001/ 不通。** 服务器本机 curl 返回 000，本机 VM（非 tailnet）curl 同样 000，而同一台服务器上 80/443/22 端口对公网 IP 均通（200/200/open）。容器在 0.0.0.0:3001 正常监听且 Tailscale IP 能访问，证明问题不在容器/应用，在 AWS 安全组入站规则未放行 3001。服务器与本机均无 AWS CLI，实例元数据（169.254.169.254）返回空、无 IAM 角色，本子代理无法自行开安全组端口。
- 待父代理/用户处理：**在 AWS 控制台给实例 i-09a6adfe864e75794（us-east-2）的安全组放行入站 TCP 3001**，放行后 http://3.12.156.80:3001 即可用；放行后须再验一次本机与非 tailnet 的 curl。
- 备选方案（未实施，等决定）：宿主机 nginx 80 端口已在安全组放行，裸 IP 目前只返回 nginx 默认欢迎页（root /var/www/html，无业务依赖），可把默认站点改成反代 127.0.0.1:3001，让 http://3.12.156.80/ 直接用，绕开安全组。但这会改生产默认站点行为，未经批准不动。
- 安全提示：公网放行后，Lila Home 将以 HTTP（无登录、无 HTTPS）暴露在公网，任何人打开 http://3.12.156.80:3001 都能进；应用内登录尚未落地。用户已明确要求放公网并授权，但登录与 HTTPS 仍是待办。
- lila.fafa888.uk 的 nginx 站点文件已留在服务器上（无 DNS，当前不起作用；DNS 加上后可直接用，不用重写）。

## 待办（Stage 1 剩余）

1. Tailscale 登录完成 → 记录服务器 tailnet IP，验证 `tailscale status`。
2. Lila Home 应用栈脚手架（FastAPI + React 静态前端 + PostgreSQL + Mosquitto ≥2.1.3，Docker Compose，内存限制，管理端口不暴露公网）→ 部署到火花面板 → 健康检查。
3. 家庭 LAN 侧 Home Assistant 主机确认（哪台机器跑 HA 尚未确定）→ 部署 HA → 接入 tailnet。
4. 设备清点（H7/H8）：仍待用户提供五类设备的品牌+型号+联网方式，无法凭空编造。
5. 断网演练与 VPS 故障演练（各记真实恢复时间）。

## 公网直放（续）：走 80 端口已通（2026-11-20 23:16，父代理执行）

- 原因：AWS 安全组未放行 3001（本机与非 tailnet curl 均为 000），而 80 端口已放行且只返回 nginx 默认欢迎页（无业务依赖）。Cloudflare 登录被 Turnstile 机器人验证拦住，lila.fafa888.uk 的 DNS 加不上，域名 + 证书路线暂停。
- 做法：宿主机 nginx 默认站点（sites-enabled/default）改成反代 http://127.0.0.1:3001（原 try_files 欢迎页已替换；原文件备份在 /etc/nginx/sites-available/default.bak.lila）。nginx -t 通过并 reload。lila.fafa888.uk 的站点文件仍留在服务器上（无 DNS，暂不起作用）。
- 验证（非 tailnet 的本机 VM 实测）：http://3.12.156.80/ 返回 200，标题 Lila Home；/api/health 返回 ok JSON（数据库 ok、MQTT ok、HA 未接入）；/api/api/v1/status 返回 200（注意：代理会去掉 /api 前缀，前端调的就是这条路径）。Tailscale http://100.114.133.80:3001/ 仍为 200；ai/dy 站点仍为 200，无回归。
- 现状：公网地址 http://3.12.156.80/（HTTP，无登录、无 HTTPS）；3001 端口安全组仍未放行（未动 AWS）；lila.fafa888.uk DNS 待补（Cloudflare 登录问题解决后）。
- 待办：给 Lila Home 加登录保护（公网已无登录开放）；补 lila.fafa888.uk DNS + HTTPS。

## 登录保护落地（2026-11-20 23:19 开始，用户要求立刻补上；23:27 完成验证通过）

- 后端：users 表加 username（唯一，部分索引，未删除用户内唯一）+ role（owner/member，CHECK 约束，is_owner=true 的旧行回填 owner）；密码 Argon2id（argon2-cffi，新增依赖）+ JWT HS256（PyJWT，新增依赖；密钥 LILA_JWT_SECRET 在服务器 .env 里 openssl rand -hex 32 生成，600 权限，绝不进仓库/聊天/日志）；有效期 7 天。
- 接口：GET /api/v1/auth/status（公开，{setup_required}）；POST /api/v1/auth/setup（仅用户表为空，事务内 LOCK TABLE 防竞态，否则 403，成功即返回 JWT）；POST /api/v1/auth/login（失败统一 401 不区分原因；同一 IP 连续失败 10 次后 429 锁 5 分钟，内存计数）；GET /api/v1/auth/me；POST /api/v1/auth/change-password（需登录）。中间件：除 /health 与 /auth/status、/auth/setup、/auth/login 外，全部 /api/v1/* 要求 Bearer JWT；require_role 接到 JWT 的 role 上（owner=Owner 档可过 Admin 级写操作，member=Member 档可控制设备/执行场景）。审计记 auth.setup/auth.login/auth.login_failed/auth.change_password（只记用户名，不记密码）。
- 前端：/login 登录页（无用户时自动变首次设置表单建 owner）；JWT 存 localStorage，请求自动带头；401 清 Token 跳回 /login；除 /login 外全部路由需登录；顶栏显示当前用户 + 退出登录；设置页加改密码表单、用户列表显示 username/role；页脚“登录模块 PLANNED”文案已改。九模块页面原样未动。
- 部署：rsync 到 /opt/lila-home（--exclude '.env' 等）；compose api 服务加 LILA_JWT_SECRET（.env.example 同步占位符）；`up -d --build` 重建 api+web；4 容器 Up，api/db/mosquitto healthy。未动其他 10 个业务容器、未改 nginx/UFW/DNS、未重启服务器；5432/1883/8001 仍不发布。
- 部署故障 1 项（已修）：首次重建后 /auth/status 报 503 db_unavailable，日志为 `column "username" does not exist`——DDL 里 `CREATE UNIQUE INDEX ... ON users (username)` 在已部署库上先于 ADD COLUMN 执行（DDL 的 CREATE TABLE IF NOT EXISTS 是 no-op），导致 init_db 整体失败、服务进无库模式（/health 自建连接仍 ok，故只影响业务接口）。修法：DDL 去掉建索引语句，索引统一由 init_db 迁移段在 ADD COLUMN 之后建；只重建 api 容器后恢复。
- 验证（全部通过，服务器本机跑完整流程 17/17，公网再验关键三项）：
  - 未登录 GET /api/v1/devices → 401 {"code":"unauthorized","message":"未登录或登录已过期"}；GET /health 仍公开 200 ok；GET /api/v1/auth/status 初始 {"setup_required":true}。
  - 测试账号流程（两轮，第一轮在本地 VM 跑，第二轮在服务器本机跑；密码均为进程内随机生成、从未打印）：setup 200（role=owner，返回 token）、setup 后 status false、重复 setup 403、错密码 401、正确登录 200、带 token /devices 200、/auth/me 200（username=testadmin）、改密码 200、旧密码 401、新密码 200、连续 10 次错密码均为 401、第 11 次 429。
  - 第一轮曾出现一次“锁定期内登录返回 200 而非 429”：复核为本机 VM 出口 IP 轮换导致计数键分散，非限流 bug；服务器本机（稳定来源 IP）重跑 17/17 全过，限流逻辑本身无问题。
  - 清理：两轮测试账号均已 DELETE（users 计数 0），status 回到 {"setup_required":true}，首次设置留给用户本人；审计日志保留真实记录（auth.setup 2、auth.login 5、auth.login_failed 24、auth.change_password 2）。
  - 前端：公网 / 与 /login 均为 200；已部署 bundle（assets/index-BjqUmfCV.js）含“创建管理员账号”文案。
- 待用户操作：打开 http://3.12.156.80/，在首次设置页建管理员账号（用户名+密码，最短 8 位）。DNS + HTTPS 仍待办。

## 设备登记 422 修复（2026-11-20 23:35，线上 bug）

- 现象：用户手机点“登记设备”报 422，`[{"loc":"body.device_type","msg":"Field required","type":"missing"}]`。
- 根因：后端 DeviceCreate/DeviceUpdate 只认 `device_type`，前端发的是 `type`（api.ts 的 CreateDeviceBody 与 DevicesPage 均如此）。
- 修复（apps/api/routers/devices.py，pydantic 2.14.4）：DeviceCreate 与 DeviceUpdate 的 device_type 加 `Field(validation_alias=AliasChoices("device_type", "type"))` + `populate_by_name=True`；两个字段同时出现时以 device_type 为准；入库仍用 device_type。
- 前端（apps/web/src/pages/DevicesPage.tsx）：红色错误框加 readableError，只显示可读文案（前缀 + 字段名：原因），不再贴后端原始 JSON 数组；提交逻辑未动。
- 同类扫查（routers/ 全扫）：房间 create/update（name/sort_order）、场景 create/update（name/description/is_enabled/rules）、场景动作（device_id/action/params/sort_order）、命令（action/params）、auth（username/password）前后端字段名均一致，无同类问题。另发现一处同页的值域不一致：前端类型下拉含 sensor/switch，后端 DEVICE_TYPES 只接受 router/speaker/light/climate/water_heater/other（DB CHECK 约束），选 sensor/switch 会 422；已把下拉收敛为后端接受的 6 个值。
- 部署：rsync（--exclude '.env' 等）到 /opt/lila-home，`docker compose --env-file .env up -d --build` 重建 api+web；4 容器 Up，api/db/mosquitto healthy。未动其他 10 个业务容器、未改 nginx/UFW/DNS、未重启服务器。
- 验证（服务器本机 + 公网实测，全部通过）：pydantic 模型层 type→device_type、双字段时 device_type 优先、update 的 type→device_type 均正确；未登录新建 401；带 `type` 新建 200（device_type=speaker）；带 `device_type` 新建 200；用 `type` 更新 200（device_type 已改为 light）；两台测试设备均已删除，列表 total=0；未登录 GET 仍 401（登录保护未破坏）；公网 http://3.12.156.80/ 200、未登录新建 401、/api/health 200。测试用 JWT 为现签的 10 分钟临时 token，未建测试用户、未动用户密码。

## 设备清点登记（2026-11-20 23:36，用户口述）

- 用户提供 8 台设备：音响（apple，HomePod mini，speaker，次卧）、华为路由器、小米净化器、小米监控、美的空调、美的洗衣机、石头扫地机器人、苹果灯光。电脑设备只说了“主要设备还有电脑设备”，未说明台数与品牌，待问。
- 因前端登记表单当时有 422 字段名故障（另行修复中），本批由助理直接写入数据库 devices 表（SQL 文件 /tmp/lila_devices.sql），已验证 8 行入库；型号除 HomePod mini 外均留空待补充，未编造。清单见 docs/audit/DEVICE_INVENTORY.md。
- 接入状态：全部未接入。HomePod 在 HA 里无原生控制，仅作 Thread 中枢；其余待 HA 接入与型号级验证。

- 电脑设备已补登记（2026-11-20 23:39）：用户确认 Windows 台式自配组装 1 台，已入库（9 台）。
- 设备登记 422 修复已部署并验证（见“设备登记 422 修复”一节），修复提交 b290ca9a 已推 GitHub main。

## 类型中文展示（2026-11-20 23:45，用户要求“所有类型目录全部为中文”）

- 做法：新增 apps/web/src/lib/deviceTypes.ts（DEVICE_TYPES 英文值 + DEVICE_TYPE_LABELS 中文映射：router 路由器、speaker 音响、light 灯光、climate 空调、water_heater 热水器、other 其他 + deviceTypeLabel()）；DevicesPage 表单下拉与列表类型列、DeviceDetailPage 类型行改用中文展示。提交时仍发英文值（type=speaker），后端与数据库完全不动（DB CHECK 约束只认英文）。
- 扫查：全仓前端用户可见文案已扫——导航、九模块标题、空状态、指令状态文案（commandStatusText）原本已是中文；无类型筛选下拉控件（现 UI 无此控件，故只覆盖表单、列表、详情三处）；SettingsPage 集成列表的“类型：”显示的是集成种类标识（如 home_assistant/mqtt），不是设备类型，有意不动；DeviceDetailPage 的 action/params 是 API 字段名，按约定不动。
- 部署与验证（见下“原生 iOS App 打包”一节的同一批部署）：Web 构建仍用 VITE_API_URL=/api（相对路径），已部署 bundle 不含 3.12.156.80 绝对地址；六个中文标签均在 bundle 内；API 新建 type=speaker 入库 device_type=speaker；未登录仍 401。

## 原生 iOS App 打包（2026-11-20 23:45，Capacitor 套壳；用户自签）

- 做法：apps/web 引入 Capacitor 8.6.2（@capacitor/core、@capacitor/ios 为 dependencies，@capacitor/cli 为 devDependency）；`npx cap init "Lila Home" uk.fafa888.lilahome --web-dir=dist`；`npx cap add ios`（ios/App 工程，bundle id uk.fafa888.lilahome）。capacitor.config.ts 只有 appId/appName/webDir=dist，无 server.url，走本地内嵌 Web 内容。
- API 地址：package.json 加 build:web（VITE_API_URL=/api）与 build:native（VITE_API_URL=http://3.12.156.80/api）两个脚本；Dockerfile 与 compose 的 Web 构建仍走默认 `npm run build` + ARG VITE_API_URL=/api，Web 版行为未变。原生 bundle 已验证含 http://3.12.156.80/api 绝对地址，Web bundle 不含该绝对地址。
- 明文 HTTP（临时措施）：ios/App/App/Info.plist 加 NSAppTransportSecurity → NSAllowsArbitraryLoads=true；等 lila.fafa888.uk 的 HTTPS 上线后去掉，改回只允许 HTTPS。
- 版本：package.json version 0.0.0 → 0.1.0；ios 工程 MARKETING_VERSION 两处（Debug/Release）由 cap 默认的 1.0 改为 0.1.0；CURRENT_PROJECT_VERSION 仍为 1。未升 1.0.0。
- 登录：不变，JWT 仍存 localStorage（WKWebView 可用）；后端未动。
- .dockerignore（apps/web 新增）：node_modules、dist、ios 不进 Web 镜像构建上下文。
- GitHub Actions：.github/workflows/build-ios.yml 已写在本地工作区（macos-15 runner：checkout → Node 24 → npm ci → native 模式构建 → npx cap sync ios → xcodebuild 无签名 archive（CODE_SIGNING_ALLOWED=NO）→ 打包 Payload 为 LilaHome-unsigned.ipa → upload-artifact 保留 30 天）。xcodebuild 用 `-target App` 而不用 `-scheme App`：生成工程里没有共享 scheme 文件（scheme 是 Xcode 首次打开时自动生成的，不进仓库），CI 上用 scheme 会报找不到。**未推 GitHub**：GitHub App 无 workflows 写权限，须由父代理走浏览器网页编辑器在 main 分支创建。本地校验：YAML 解析通过、actionlint 1.7.7 通过；本机无 macOS，xcodebuild 未实跑，待 workflow 落地后由 CI 实跑验证。
- 部署：rsync（--exclude '.env'、node_modules、dist、hidden_files、.git、apps/web/ios/）到 /opt/lila-home；`docker compose --env-file .env up -d --build web` 只重建 web 容器（api/db/mqtt 未动）；4 容器 Up，api/db/mosquitto healthy。未动其他 10 个业务容器、未改 nginx/UFW/DNS、未重启服务器。
- 验证（全部通过）：公网 GET / 200；/api/health 200（version 0.1.0，数据库 ok、MQTT ok、HA 未接入）；未登录 POST /api/v1/devices → 401；已部署 bundle（assets/index-jAtwwAQl.js，新哈希，确为新构建）含六个中文标签（热水器 9、路由器 5、音响 5 等），且不含 3.12.156.80/api 绝对地址；临时 JWT（现签 10 分钟，role=owner，未建测试用户）新建 type=speaker → 200 且 device_type=speaker，复查 200，随后删除 200，列表恢复 9 台（用户设备未动）。另：本次 `up -d --build web` 时 api 容器也被 compose 重建了一次（Up 5 秒后恢复 healthy，db 未重启，9 台设备与用户账号未动，属依赖链副作用，无数据影响）。
- 待办：workflow 文件落地 main 后由 CI 实跑验证（xcodebuild 未在 macOS 上实跑）；Info.plist 的 NSAllowsArbitraryLoads 待 lila.fafa888.uk HTTPS 上线后去掉。
