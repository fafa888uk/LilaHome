# Lila Home — 系统架构设计（Stage 0-05）

> 文档：`docs/architecture/SYSTEM_ARCHITECTURE.md`
> 状态：设计（PLANNED，未实施、未开发、未部署、未测试）
> 依据：服务器审计、网络架构、开源审计、设备兼容性审计（见各审计文档）

## 1. 架构原则

1. **Lila Home 不得直接重写 Home Assistant 已经成熟的设备接入能力。Home Assistant 是设备控制引擎；Lila Home 是统一管理平台。**
2. **所有设备操作必须经过统一服务层。** 前端不得直连 Home Assistant、MQTT 或数据库。
3. 公网 VPS 只负责平台、用户管理、API 和远程访问；家庭 LAN 运行 Home Assistant，负责设备接入和本地控制；两者通过安全 VPN 连接。
4. 第一阶段家庭自用，后续预留开放源码及扩展能力；开放前须重新做许可证审查（ESPHome 与 Zigbee2MQTT 含 GPL-3.0 copyleft，见 `docs/audit/OPEN_SOURCE_AUDIT.md`）。
5. 状态以设备真实回执为准：发送控制请求成功，不代表设备执行成功（见 `docs/architecture/API_DESIGN.md` 状态机）。

## 2. 总体架构图（ASCII）

```
  控制终端：Web / iPhone / iPad / Windows / macOS
        |  HTTPS (PWA, 响应式)
        v
  +---------------- Nginx（复用现有，80/443）----------------+
  |  Lila Home Web（React + TypeScript + Vite + Tailwind CSS）|
  +----------------------------------------------------------+
        |  HTTPS / WSS
        v
  +---------------- Lila Home API（Python + FastAPI + Pydantic）--+
  |  统一服务层：鉴权 RBAC / 设备服务 / 房间服务 / 场景服务       |
  |  审计日志 / 权限校验 / 状态机（ACCEPTED→EXECUTING→CONFIRMED）|
  +------+------------+-------------+-------------+------------+
         |            |             |             |
    PostgreSQL   Mosquitto MQTT   Home Assistant  家庭 LAN
    (业务数据)    (≥2.1.3，见注)   (设备控制引擎)   (VPN 隧道)
         |            |             |             |
         +------------+-------------+-------------+
                      |
              家庭设备：灯/空调/热水器/音响/路由器
              （经 HA 集成接入，见 DEVICE_COMPATIBILITY.md）
```

注：Mosquitto 选型下限为 ≥2.1.3（CVE-2026-110486，2.1.0–2.1.2 内置 WebSocket 监听存在未授权 RCE）。

## 3. 技术选型表

| 层 | 选型 | 状态 | 依据/备注 |
|---|---|---|---|
| 前端 | React + TypeScript + Vite + Tailwind CSS + PWA + 响应式设计 | PLANNED | 任务书首选架构；Vite 与 Next.js 二选一，本设计选 Vite（静态构建、Nginx 托管，符合轻量化要求）；Next.js 为备选，未定 |
| 后端 | Python + FastAPI + Pydantic + WebSocket | PLANNED | 任务书首选架构；主机已有 Python 3.12.3 |
| 设备中枢 | Home Assistant Core 2026.11.2（Apache-2.0） | PLANNED | 开源审计已核实；家庭 LAN 侧运行，不在公网 VPS 上 |
| 消息通信 | MQTT + Eclipse Mosquitto ≥2.1.4（EPL-2.0 OR EDL-1.0） | PLANNED | 开源审计已核实；2.1.4 发布于 2026-11-17 |
| 数据库 | PostgreSQL（独立实例，与 infra-db-1 隔离） | PLANNED | 现有 infra-db-1 为 postgres:16-alpine，属另一业务，不得复用 |
| 缓存 | Redis（按需，不是强制依赖） | PLANNED（后置） | 初期不部署 |
| Matter 接入 | matter-js/matterjs-server 1.5.5（Apache-2.0） | PLANNED | python-matter-server 已归档，勿用 |
| Zigbee 接入 | ZHA 或 Zigbee2MQTT 2.14.3（GPL-3.0）二选一 | PLANNED（待定） | Stage 1 按硬件定 |
| 自动化 | Home Assistant 内置自动化首选；Node-RED 5.0.10（Apache-2.0）可选 | PLANNED | 不并行两套自动化引擎做同一场景 |
| 部署 | Docker Compose + Linux + HTTPS | PLANNED | 复用现有 Nginx 与 Docker 29.1.3 |
| VPN | Tailscale 托管 或 Headscale 自托管（BSD-3-Clause） | PLANNED（待选型） | 见 `NETWORK_ARCHITECTURE.md`；WireGuard/ZeroTier 未核实 |

## 4. 组件职责

| 组件 | 职责 | 不负责 |
|---|---|---|
| Lila Home Web | 统一界面：总览、设备、房间、灯光、空调/热水器、音响、网络、场景、设置 | 不直连设备、不直连 HA |
| Lila Home API | 鉴权、RBAC、业务逻辑、统一服务层、审计日志、状态机 | 不实现设备协议解析（那是 HA 的工作） |
| Home Assistant | 设备发现、协议接入（Matter/Zigbee/MQTT/HomeKit/LAN API/云 API/红外）、本地自动化、状态回执 | 不做用户管理、不做跨品牌统一界面 |
| Mosquitto | HA 与 Zigbee2MQTT/自定义设备之间的消息总线 | 不存业务数据 |
| PostgreSQL | 用户、设备元数据、房间、场景、审计日志、操作记录 | 不存设备实时状态（实时状态以 HA 为准，DB 只存快照与历史） |
| Redis（后置） | 会话/缓存（按需） | 不作唯一数据源 |

## 5. 部署拓扑

- **公网 VPS（火花面板，实测 7.6 GiB）**：Nginx + Web 静态文件 + API 容器 + PostgreSQL 容器 + Mosquitto 容器（Mosquitto 是否放 VPS 还是放家庭 LAN，Stage 1 定；默认放 VPS 但只绑回环/VPN，不暴露公网）。
- **家庭 LAN**：Home Assistant 主机（HAOS 或容器，未定）+ Zigbee/Thread 协调器 + Matter Server + 各品牌设备。
- **VPN**：VPS ↔ 家庭 LAN 隧道；HA 与 API 之间只走 VPN。
- **资源**：以实测 7.6 GiB 为准；每个容器设内存限额；前端静态化；Redis 与重型监控后置（见 `SERVER_AUDIT.md` 第 2 节）。

## 6. 扩展点

- `integrations/`：home_assistant / matter / mqtt / custom 四类接入适配器，新增品牌只加适配器，不改核心服务层。
- `packages/sdk` 与 `packages/types`：前后端共享类型与 SDK，设备状态结构以 HA 实体模型为准映射。
- 自动化场景：先接 HA 内置自动化；Node-RED 作为可选扩展，不强制。
- 开放源码预留：仓库结构见 `STAGE0_REPORT.md` 第 13 节；公开前须完成许可证审查与敏感信息清理。

## 7. 非目标（Stage 0 明确不做）

- 不开发完整产品、不部署正式环境、不创建 GitHub 仓库。
- 不重写 HA 设备接入、不绕过厂商安全保护、不把管理端口暴露公网。
- 不承诺任何型号级兼容性（全部待验证，见 `DEVICE_COMPATIBILITY.md`）。
