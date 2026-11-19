# Lila Home（紫序智能家居控制中心）

> Unified Smart Home Platform
> Stage 0：正式工程基础（审计、架构、规划）——已完成，见 `STAGE0_REPORT.md`

## 项目目标

建立一个统一控制不同品牌智能家居设备的平台。

首批设备：家庭路由器、智能音响、智能灯光、空调、热水器。

目标品牌：小米、米家、华为、鸿蒙智联、Apple HomeKit、美的、其他品牌。

控制终端：Web 网页、iPhone、iPad、Windows 电脑、macOS 电脑。

项目定位：第一阶段家庭自用，后续预留开放源码及扩展能力。

## 架构一句话

- **Home Assistant 是设备控制引擎；Lila Home 是统一管理平台。**
- 公网 VPS 只负责平台、用户管理、API 和远程访问；家庭局域网运行 Home Assistant，负责设备接入和本地控制；两者通过安全 VPN 连接。
- 所有设备操作必须经过统一服务层；不得直接将 Home Assistant、MQTT、数据库等管理端口暴露在公网。

## Stage 0 交付文档（13 份）

| # | 文档 | 内容 |
|---|---|---|
| 1 | `docs/audit/SERVER_AUDIT.md` | 服务器环境审计（实测） |
| 2 | `docs/architecture/NETWORK_ARCHITECTURE.md` | 网络架构设计 |
| 3 | `docs/audit/OPEN_SOURCE_AUDIT.md` | 开源项目审计（10 个项目） |
| 4 | `docs/audit/DEVICE_COMPATIBILITY.md` | 设备兼容性审计（品牌×设备矩阵） |
| 5 | `docs/audit/DEVICE_INVENTORY_TEMPLATE.md` | 空白设备清点表模板 |
| 6 | `docs/architecture/SYSTEM_ARCHITECTURE.md` | 系统架构设计 |
| 7 | `docs/architecture/DATABASE_DESIGN.md` | 数据库设计 |
| 8 | `docs/architecture/API_DESIGN.md` | API 设计 |
| 9 | `docs/architecture/SECURITY_DESIGN.md` | 安全设计 |
| 10 | `docs/ROADMAP.md` | 路线图 |
| 11 | `docs/FEATURE_MATRIX.md` | 功能矩阵（九模块，全部 PLANNED） |
| 12 | `THIRD_PARTY_NOTICES.md` | 第三方声明 |
| 13 | `STAGE0_REPORT.md` | Stage 0 最终报告（A–J 汇报格式） |

另有：本 README、`.gitignore` 草案（规划文件，不含真实敏感值）、`hidden_files/server_audit_raw_2026-11-19.txt`（服务器审计原始记录，仅本地保存）。

## 关键事实（Stage 0 已核实）

- 服务器：火花面板 3.12.156.80，Ubuntu 24.04.5 LTS，2 vCPU，**实测内存 7.6 GiB（任务书称 4 GB，与实测不符，以实测为准）**，磁盘剩余 40G，Docker 29.1.3，10 个容器在跑。
- 仓库：GitHub fafa888uk 名下 8 个仓库，无 LilaHome；**仓库不存在，未创建**，须用户批准后才建。
- 设备兼容性：全部型号级结论为“待验证（无型号）”；华为/鸿蒙智联无 HA 官方集成，非 Matter 型号为 D；美的须按型号/协议 V1/V2/V3 核实；路由器只做只读监控；热水器不得绕过原厂安全保护。
- 开源合规：python-matter-server 已归档，Matter 新选型用 matterjs-server；Mosquitto 须 ≥2.1.3（CVE-2026-110486）；ESPHome 与 Zigbee2MQTT 含 GPL-3.0 copyleft。

## 安全红线

- 只读审计阶段不修改服务器、不安装软件、不创建仓库、不上传密钥。
- 家庭设备信息、Token、密码、证书一律不得提交到公开仓库。
- 本阶段结束后停止，等待用户明确批准 Stage 1。
