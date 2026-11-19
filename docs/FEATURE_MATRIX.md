# Lila Home — 功能矩阵（Stage 0-06）

> 文档：`docs/FEATURE_MATRIX.md`
> 状态：规划。功能状态：PLANNED / IMPLEMENTED / TESTED / VERIFIED。**本文件九个模块全部为 PLANNED，不允许把 PLANNED 写成 IMPLEMENTED。**
> 每个模块说明：具体功能、依赖的设备接口、后端 API、前端页面、权限要求、异常处理、测试方法、开发优先级。

## 总览

| # | 模块 | 优先级 | 状态 | 依赖 |
|---|---|---|---|---|
| 1 | 首页总览 | P0 | PLANNED | 设备状态聚合、房间分组 |
| 2 | 设备管理中心 | P0 | PLANNED | HA 集成、设备清点 |
| 3 | 房间管理中心 | P0 | PLANNED | 房间 CRUD |
| 4 | 灯光控制中心 | P1 | PLANNED | 灯光集成（Matter/Zigbee/MIoT/HomeKit/Hue/Yeelight） |
| 5 | 空调及热水器控制 | P1 | PLANNED | 空调/热水器集成（Midea/MIoT/Matter/HomeKit/红外兜底） |
| 6 | 音响影音中心 | P2 | PLANNED | 音响集成（DLNA/AirPlay/厂商云/Sonos 对照） |
| 7 | 家庭网络管理中心 | P2 | PLANNED | 路由器只读监控 |
| 8 | 自动化场景中心 | P2 | PLANNED | HA 自动化 / Node-RED（可选） |
| 9 | 系统安全与设置中心 | P0 | PLANNED | RBAC、审计日志、集成管理 |

## 1. 首页总览

- **具体功能**：全屋状态一览（在线设备数、异常设备、当前温度/湿度摘要——以 HA 回执为准）、房间快捷入口、常用设备快捷控制、最近操作记录。
- **依赖的设备接口**：HA 实体状态聚合；不直连设备。
- **后端 API**：`GET /devices`、`GET /devices/{id}/state`、`GET /rooms`。
- **前端页面**：首页总览（响应式，手机优先）。
- **权限要求**：登录用户可见；Viewer 只读。
- **异常处理**：HA/VPN 不可达时显示“网关不可达”，不显示过期状态为实时状态；状态须注明来源与时间。
- **测试方法**：模拟 HA 状态推送测试 + 真机验收（Stage 1 后）。
- **开发优先级**：P0。

## 2. 设备管理中心

- **具体功能**：设备登记、改名、换房间、启用/停用集成、查看兼容等级与接入路径、查看指令历史。
- **依赖的设备接口**：HA 集成（`midea`、`xiaomi_miot`、`matter`、`homekit_controller`、ZHA/Zigbee2MQTT 等，按型号核实）。
- **后端 API**：`GET/POST/PATCH/DELETE /devices`、`GET /integrations`。
- **前端页面**：设备列表、设备详情、集成管理。
- **权限要求**：Admin+ 可登记/修改；Member 只读。
- **异常处理**：接入失败显示失败原因（HA 回执原文），不谎报成功；D 级设备明确标注“暂无可靠接入方式”。
- **测试方法**：模拟设备登记测试 + 真机接入验收。
- **开发优先级**：P0。

## 3. 房间管理中心

- **具体功能**：房间创建/改名/排序/删除、设备分组、房间状态汇总。
- **依赖的设备接口**：无直接设备接口（纯业务数据）。
- **后端 API**：`GET/POST/PATCH/DELETE /rooms`。
- **前端页面**：房间管理、房间详情。
- **权限要求**：Admin+ 可管理；Member 可查看。
- **异常处理**：删除房间时设备移出分组，不删除设备。
- **测试方法**：单元测试 + API 测试。
- **开发优先级**：P0。

## 4. 灯光控制中心

- **具体功能**：开关、亮度、色温、颜色、分组控制、夜灯模式（依 MIoT-Spec/厂商能力而定，不承诺未核实的能力）。
- **依赖的设备接口**：小米/米家（MIoT/MIoT-Spec）、华为/鸿蒙智联（仅 Matter 认证型号）、HomeKit 灯、美的灯（UNKNOWN，待核实）、Hue/Yeelight/Aqara（对照）。
- **后端 API**：`GET /lights`、`POST /devices/{id}/commands`。
- **前端页面**：灯光列表、灯光详情（亮度/色温滑杆）。
- **权限要求**：Member+（须有该设备控制权）。
- **异常处理**：指令状态机（ACCEPTED→EXECUTING→CONFIRMED/FAILED/TIMEOUT/UNKNOWN）；超时显示“未确认”。
- **测试方法**：模拟设备测试 + 真机验收。
- **开发优先级**：P1。

## 5. 空调及热水器控制

- **具体功能**：空调开关/模式/目标温度/风速/摆风（依 MIoT-Spec/厂商协议而定）；热水器开关/目标温度/模式（依厂商协议而定）；红外空调兜底（Broadlink，C 级，无状态回读）。
- **依赖的设备接口**：美的（Core `midea` / `midea_ac_lan`，协议 V1/V2/V3 按型号核实）、小米（Miot climate/water-heater）、华为（仅 Matter thermostat 类）、HomeKit thermostat 类、红外（Broadlink RM4）。
- **后端 API**：`GET /climate`、`GET /water-heaters`、`POST /devices/{id}/commands`。
- **前端页面**：空调控制、热水器控制。
- **权限要求**：Member+；热水器高风险操作须二次确认（Stage 1 定）。
- **异常处理**：危险参数 API 层拒绝；热水器安全联锁不可绕过；红外设备状态只到 UNKNOWN，不得写 CONFIRMED。
- **测试方法**：模拟设备测试 + 真机验收（热水器验收须以厂商文档为准）。
- **开发优先级**：P1。

## 6. 音响影音中心

- **具体功能**：播放/暂停/音量/TTS 播报（依设备能力而定）；HomePod 无 HA 原生 media_player 集成，不承诺 HomePod 控制。
- **依赖的设备接口**：小米小爱音箱（B 级，语音与音乐依赖云）、华为 Sound（DLNA C 级 / 语音控制 D 级）、Apple TV（官方集成）、Sonos（对照，A 级）。
- **后端 API**：`GET /speakers`、`POST /devices/{id}/commands`。
- **前端页面**：音响列表、播放控制。
- **权限要求**：Member+。
- **异常处理**：云依赖设备断网时明确显示不可用；AirPlay 非官方路径不作依赖。
- **测试方法**：模拟设备测试 + 真机验收。
- **开发优先级**：P2。

## 7. 家庭网络管理中心

- **具体功能**：路由器只读监控（在线客户端列表/presence、信号/流量——依型号而定）；Ping/Nmap 在线检测兜底。
- **依赖的设备接口**：小米（legacy `xiaomi` device_tracker / `xiaomi_miio`）、华为（`huawei_lte`，限 LTE 机型）、OpenWrt（ubus）、UniFi。
- **后端 API**：`GET /network/devices`。
- **前端页面**：网络总览、在线设备列表。
- **权限要求**：登录用户可见；Viewer 只读。
- **异常处理**：路由器配置/重启/限速等高风险控制不在本阶段范围，不得默认可用。
- **测试方法**：模拟数据测试 + 真机只读验收。
- **开发优先级**：P2。

## 8. 自动化场景中心

- **具体功能**：场景创建/编辑/执行、定时触发、条件触发（依 HA 自动化能力而定）。
- **依赖的设备接口**：HA 内置自动化首选；Node-RED 5.0.10 可选（不并行两套做同一场景）。
- **后端 API**：`GET/POST/PATCH/DELETE /scenes`、`POST /scenes/{id}/run`、`GET /scenes/{id}/runs/{run_id}`。
- **前端页面**：场景列表、场景编辑、执行记录。
- **权限要求**：Admin+ 可创建/修改；Member 可执行。
- **异常处理**：场景执行逐设备留记录，单台失败不谎报整体成功；断网时本地自动化仍可执行（HA 侧）。
- **测试方法**：模拟场景测试 + 真机验收。
- **开发优先级**：P2。

## 9. 系统安全与设置中心

- **具体功能**：用户与角色管理、会话管理、审计日志查看、集成启用/停用、系统健康查看。
- **依赖的设备接口**：无直接设备接口。
- **后端 API**：`GET/POST /users`、`POST /users/{id}/roles`、`GET /audit-logs`、`GET /system/health`。
- **前端页面**：设置中心、用户管理、审计日志。
- **权限要求**：Owner/Admin（用户与角色管理仅 Owner）。
- **异常处理**：敏感操作全部记审计日志；误操作可追溯、可吊销会话。
- **测试方法**：权限测试（越权、Viewer 控制尝试）、审计日志测试。
- **开发优先级**：P0。
