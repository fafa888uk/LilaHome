# Lila Home — 路线图（Stage 0-06）

> 文档：`docs/ROADMAP.md`
> 状态：规划（PLANNED，全部功能未实施）
> 功能状态定义：PLANNED（已规划）/ IMPLEMENTED（已实现）/ TESTED（已测试）/ VERIFIED（已验收）。**本文件全部功能为 PLANNED，不允许把 PLANNED 写成 IMPLEMENTED。**

## 阶段总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| Stage 0 | 工程基础：审计、架构、规划（本文档集） | 进行中（本文档为 Stage 0 交付物） |
| Stage 1 | 基础平台：仓库建立、VPS 部署（API+Web+DB+MQTT）、VPN 打通、HA 家庭侧部署、首批 1–2 类设备接入 | PLANNED，须用户明确批准后开始 |
| Stage 2 | 设备扩展：灯光、空调、热水器、音响、路由器只读监控全量接入 | PLANNED |
| Stage 3 | 场景与自动化：场景中心、自动化规则、语音播报 | PLANNED |
| Stage 4 | 体验与开放：PWA 完善、多终端适配、开放源码准备（须重新许可证审查） | PLANNED |

**本阶段结束后停止，等待用户明确批准 Stage 1。**

## Stage 1 目标（待批准）

1. 建立 LilaHome 仓库（须用户批准创建；公开/私有待定）。
2. VPS 部署：Nginx + Web + API + PostgreSQL + Mosquitto（≥2.1.3），全部容器化、设内存限额、管理端口不暴露公网。
3. VPN 打通：Tailscale 托管或 Headscale 自托管二选一（WireGuard/ZeroTier 须先补核）。
4. 家庭 LAN 部署 Home Assistant，完成首批 1–2 类设备接入（优先 A 级本地双向设备）。
5. 完成设备清点（`DEVICE_INVENTORY_TEMPLATE.md`）并做型号级核实。
6. 断网演练与 VPS 故障演练各一次并记录。

## Stage 2 目标（待批准）

- 五类设备全量接入：路由器（只读监控）、音响、灯光、空调、热水器。
- 华为/鸿蒙智联设备按 Matter 认证情况分流（有 Matter 认证走 Matter，无则 D，不硬接）。
- 美的设备按型号/协议 V1/V2/V3 逐台核实。
- 房间管理与设备分组上线。

## Stage 3 目标（待批准）

- 场景中心与自动化规则上线（HA 内置自动化首选）。
- 音响播报/TTS、跨设备联动。
- 状态回执与超时处理全量覆盖。

## Stage 4 目标（待批准）

- PWA、多终端（Web/iPhone/iPad/Windows/macOS）体验完善。
- 开放源码准备：许可证审查、敏感信息清理、文档补齐。
- 性能与安全复核。

## 依赖与前置条件

| 前置条件 | 状态 |
|---|---|
| 用户确认目标服务器身份（4 GB 与实测 7.6 GiB 差异） | 待确认 |
| 用户批准创建 LilaHome 仓库 | 待批准 |
| 用户批准防火墙策略 | 待批准 |
| 用户填写设备清点表（品牌+型号+联网方式） | 待提供 |
| VPN 选型（Tailscale vs Headscale） | 待定 |
| WireGuard / ZeroTier 补核 | 待补核 |
| HAOS LICENSE 补核 | 待补核 |

## 风险与应对

- 型号级兼容性未核实：Stage 1 先接 A 级设备，D 级设备不硬接、不承诺。
- 与现有业务共用服务器：容器与数据卷隔离，部署前做资源评估。
- 厂商云 Token API 变动（如美的云 Token API 有关闭记录）：接入时重新验证，失败则降级为 C/D，不伪造成功。
- HomeKit 独占配对：已配对 Apple Home 的设备须先解除，须用户逐台确认。
