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
- 未做：服务器重启（安装时提示有新内核 7.0.0-1017-aws 可用，当前运行 7.0.0-1014-aws；生产服务器不擅自重启）。

## 待办（Stage 1 剩余）

1. Tailscale 登录完成 → 记录服务器 tailnet IP，验证 `tailscale status`。
2. Lila Home 应用栈脚手架（FastAPI + React 静态前端 + PostgreSQL + Mosquitto ≥2.1.3，Docker Compose，内存限制，管理端口不暴露公网）→ 部署到火花面板 → 健康检查。
3. 家庭 LAN 侧 Home Assistant 主机确认（哪台机器跑 HA 尚未确定）→ 部署 HA → 接入 tailnet。
4. 设备清点（H7/H8）：仍待用户提供五类设备的品牌+型号+联网方式，无法凭空编造。
5. 断网演练与 VPS 故障演练（各记真实恢复时间）。
