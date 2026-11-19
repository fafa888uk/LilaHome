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
- 未做：服务器重启（安装时提示有新内核 7.0.0-1017-aws 可用，当前运行 7.0.0-1014-aws；生产服务器不擅自重启）。

## 待办（Stage 1 剩余）

1. Tailscale 登录完成 → 记录服务器 tailnet IP，验证 `tailscale status`。
2. Lila Home 应用栈脚手架（FastAPI + React 静态前端 + PostgreSQL + Mosquitto ≥2.1.3，Docker Compose，内存限制，管理端口不暴露公网）→ 部署到火花面板 → 健康检查。
3. 家庭 LAN 侧 Home Assistant 主机确认（哪台机器跑 HA 尚未确定）→ 部署 HA → 接入 tailnet。
4. 设备清点（H7/H8）：仍待用户提供五类设备的品牌+型号+联网方式，无法凭空编造。
5. 断网演练与 VPS 故障演练（各记真实恢复时间）。
