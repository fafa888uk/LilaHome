# Lila Home — 开源项目审计（Stage 0-03）

> 文档：`docs/audit/OPEN_SOURCE_AUDIT.md`
> 核实基准日：2026-11-19（公开资料核实）
> 方法：`browser.search` + `browser.open` 核实官方 GitHub 与官方文档；LICENSE 以打开 GitHub 上 LICENSE 原文为准，不只看搜索摘要。
> 规则：无法确认写 UNKNOWN；二级来源明确标注为“二级来源”，不得写成已核实；未经审核不得复制其他项目源代码。
> 对应交付：`THIRD_PARTY_NOTICES.md`（原作者、版权、许可证汇总）

## 总览表

| # | 项目 | 官方 GitHub | 最新稳定版（核实日） | LICENSE（原文核实） | Lila Home 归属 | 维护状态 |
|---|---|---|---|---|---|---|
| 1 | Home Assistant Core | https://github.com/home-assistant/core | 2026.11.2（2026-11-16） | Apache-2.0（LICENSE.md 原文） | 设备中枢 | 活跃 |
| 2 | Home Assistant Operating System | https://github.com/home-assistant/operating-system | 18.5（2026-11-06，Raspberry Pi 安全发布） | Apache-2.0（LICENSE 原文，2026-11-19 补核） | 设备中枢（底层运行环境） | 活跃 |
| 3 | ESPHome | https://github.com/esphome/esphome | 2026.11.0（2026-11-18） | MIT + GPL-3.0 双许可（LICENSE 原文） | 设备中枢（DIY 固件） | 活跃 |
| 4 | Zigbee2MQTT | https://github.com/Koenkk/zigbee2mqtt | 2.14.3（2026-11-01） | GPL-3.0（LICENSE 原文） | 设备中枢（Zigbee 接入） | 活跃 |
| 5 | Eclipse Mosquitto | https://github.com/eclipse-mosquitto/mosquitto（主仓库已确认；README 明确列为源码仓库） | 2.1.4 / 2.0.23（2026-11-17） | EPL-2.0 OR EDL-1.0（类型已多方核实；许可文本在根目录 `epl-v20` / `edl-v10` 文件，`LICENSE.txt` 仅为占位内容“-”，2026-11-19 补核） | 消息 | 活跃 |
| 6 | Matter Server（当前实现） | https://github.com/matter-js/matterjs-server | 1.5.5（2026-10-24） | Apache-2.0（LICENSE 原文） | 设备中枢（Matter 接入） | 活跃 |
| 6b | Matter Server（旧实现） | https://github.com/matter-js/python-matter-server | 8.1.2（最终版，发布日期 UNKNOWN） | Apache-2.0（仓库页字段；原文未单独打开） | 历史实现，勿作新选型依据 | **已归档，停止维护** |
| 7 | openHAB | 核心 https://github.com/openhab/openhab-core；发行版 https://github.com/openhab/openhab-distro | 5.2.4（2026-11-08） | EPL-2.0（LICENSE 原文） | 设备中枢（备选平台） | 活跃 |
| 8 | Node-RED | https://github.com/node-red/node-red | 5.0.10（2026-11-17） | Apache-2.0（LICENSE 原文） | 自动化 | 活跃 |
| 9 | Tailscale | https://github.com/tailscale/tailscale | v1.104.7 已确认 Latest（2026-11-12，GitHub 发布页直接核实，commit cbc74fe） | BSD-3-Clause（LICENSE 原文） | VPN | 活跃 |
| 10 | Headscale | https://github.com/juanfont/headscale | v0.29.7（2026-10-30） | BSD-3-Clause（LICENSE 原文） | VPN | 活跃 |

## 1. Home Assistant Core

- 官方 GitHub：https://github.com/home-assistant/core
- 官方文档：https://www.home-assistant.io/docs（项目站 https://www.home-assistant.io）
- 维护状态：活跃。最后提交 2026-11-19；过去 12 个月 23,291 次提交；92,371 stars。
- 最新稳定版本：2026.11.2，发布于 2026-11-16（2026.11.0 发布于 2026-11-04；2026.11.1 发布于 2026-11-09）。
- LICENSE：文件名 `LICENSE.md`，已打开原文核实，第一行 "Apache License / Version 2.0, January 2004" → **Apache-2.0**。另见官方许可页 https://www.home-assistant.io/developers/license/
- 用途：用 Python 编写的开源家庭自动化平台，通过上千个集成在本地控制多品牌设备并做自动化。
- 是否适合本项目：适合。Lila Home 的设备控制引擎，不重写其设备接入能力（见 `docs/architecture/SYSTEM_ARCHITECTURE.md`）。
- 商业分发限制 / 再分发义务：Apache-2.0 宽松许可，允许商业使用、修改、闭源分发；再分发须附许可证副本、修改过的文件须带显著修改声明、保留版权/专利/商标/署名声明、随附 NOTICE 文件中的署名（如有）；不授予商标使用权；含专利授权，提起专利诉讼则专利授权终止。
- 依赖关系：Python（2026.11.0 要求 `requires-python >=3.14.2`），基于 asyncio；Web 前端为独立仓库；各集成依赖各自的设备库。注意：Core 与 Supervised 安装方式已于 2025 年 5 月弃用，支持随 2025.12 版结束。
- 来源：https://github.com/home-assistant/core/releases ；https://github.com/home-assistant/core/blob/2026.11.0/LICENSE.md

## 2. Home Assistant Operating System

- 官方 GitHub：https://github.com/home-assistant/operating-system
- 官方文档：https://www.home-assistant.io/installation/（2026-11-19 已打开核实：HAOS 为推荐安装类型，含 Green/Yellow/树莓派/x86-64/容器/虚拟机路径）
- 维护状态：活跃。2026-10 至 11 月连续发布 18.3、18.4、18.5。
- 最新稳定版本：18.5，发布于 2026-11-06（仅 Raspberry Pi 的安全发布，内核升至 6.18.59，修 CVE-2026-98432）。通用最新版 18.4 发布于 2026-10-27（内核 6.18.58，修 VLAN/蓝牙回归）。
- LICENSE：文件名 `LICENSE`，2026-11-19 补核已打开原文：第一行 "Apache License / Version 2.0, January 2004" → **Apache-2.0**。
- 用途：基于 Buildroot 的最小化嵌入式 Linux 系统，内置 Supervisor、Docker 与一键更新，专为在家庭硬件上运行 Home Assistant 而设。
- 是否适合本项目：适合作为家庭 LAN 侧 Home Assistant 主机的底层系统（树莓派、x86-64、虚拟机、Home Assistant Green/Yellow）；公网 VPS 不跑 HAOS。
- 商业分发限制 / 再分发义务：同 Apache-2.0（附许可副本、标注修改、保留声明、不授商标权）。
- 依赖关系：Buildroot 2025.02.19、Linux 内核 6.18.58/6.18.59、Docker/containerd、Go、OS Agent v1.13.0/v1.14.0、Supervisor。
- 来源：https://github.com/home-assistant/operating-system/releases ；https://github.com/home-assistant/operating-system/pull/5016

## 3. ESPHome

- 官方 GitHub：https://github.com/esphome/esphome
- 官方文档：https://esphome.io（如 https://esphome.io/guides/getting_started_hassio.html）
- 维护状态：活跃。月度发布；2026.11.0 于 2026-11-18 发布；12,120 stars。
- 最新稳定版本：2026.11.0，发布于 2026-11-18（PyPI 同日发布；此前稳定版 2026.10.2）。
- LICENSE：文件名 `LICENSE`，已打开原文核实。开头："The ESPHome License is made up of two base licenses: MIT and the GNU GENERAL PUBLIC LICENSE." → **双许可：MIT（Python 代码及除 C++ 运行时外的全部代码）+ GPL-3.0/GPLv3（C++ 运行时代码，扩展名 .c/.cpp/.h/.hpp/.tcc/.ino）**。文件内随后附 MIT 全文与 "GNU GENERAL PUBLIC LICENSE / Version 3, 29 June 2007" 全文。
- 用途：把 YAML 配置编译成固件，刷入 ESP32/ESP8266/RP2040 等微控制器，使其成为可接入 Home Assistant 的本地智能家居设备。
- 是否适合本项目：适合（可选，DIY 设备扩展路径；首批五类设备不依赖 ESPHome）。
- 商业分发限制 / 再分发义务：须按部分区分：GPLv3 部分为强 copyleft——分发修改后的固件/二进制须提供对应源码（Corresponding Source）、保留许可与声明、标注修改；MIT 部分宽松，仅须保留版权与许可声明。另注意 Device Builder 是独立仓库 esphome/device-builder，Apache-2.0。
- 依赖关系：Python 工具链；ESP-IDF 或 Arduino 框架；PlatformIO；与 Home Assistant 通过原生 API/MQTT 对接。
- 来源：https://github.com/esphome/esphome/blob/dev/LICENSE ；https://pypi.org/project/esphome/

## 4. Zigbee2MQTT

- 官方 GitHub：https://github.com/Koenkk/zigbee2mqtt
- 官方文档：https://www.zigbee2mqtt.io（入门 https://www.zigbee2mqtt.io/guide/getting-started）
- 维护状态：活跃。约 16k stars；2.x 线每月左右发布。
- 最新稳定版本：2.14.3，发布于 2026-11-01（2.14.2 为 2026-10-01；2.14.1 为 2026-09-03）。
- LICENSE：文件名 `LICENSE`，已打开原文核实，第一行 "GNU GENERAL PUBLIC LICENSE / Version 3, 29 June 2007" → **GPL-3.0**。package.json 中 `"license": "GPL-3.0"` 一致。
- 用途：Zigbee 转 MQTT 桥接器，用 USB/以太网 Zigbee 协调器替代厂商专有网关，把 Zigbee 设备以 MQTT 主题形式暴露给任意家庭自动化平台。
- 是否适合本项目：适合。Zigbee 设备的接入路径之一（与 HA 内置 ZHA 二选一或并存，Stage 1 定）。
- 商业分发限制 / 再分发义务：GPL-3.0 强 copyleft——分发（含修改后分发）须整体以 GPL-3.0 授权、提供源码、保留声明、标注修改；仅内部运行不分发不触发源码提供义务。注意其依赖 zigbee-herdsman 与 zigbee-herdsman-converters 各自为 MIT。
- 依赖关系：Node.js（当前要求 v22；32 位平台已弃用，Node.js 22 于 2027 年 4 月 EOL 后最低要求升为 v24）；zigbee-herdsman 11.0.0；MQTT Broker；须另配 Zigbee 协调器硬件（USB/以太网）。
- 来源：https://github.com/Koenkk/zigbee2mqtt/blob/master/LICENSE ；https://www.zigbee2mqtt.io/guide/usage/integrations/home_assistant.html

## 5. Eclipse Mosquitto

- 官方 GitHub：https://github.com/eclipse/mosquitto 与 https://github.com/eclipse-mosquitto/mosquitto（两个组织名均在公开资料中出现：前者为 Eclipse 基金会项目页链接的仓库，后者为源码/Docker 构建所用仓库；须以官方项目页为准再确认主仓库）
- 官方文档：https://mosquitto.org/documentation/（官网 https://mosquitto.org/）
- 维护状态：活跃。2026-11 月有提交与发布；Eclipse 基金会项目 iot.mosquitto。
- 最新稳定版本：2.1.4（bugfix）与 2.0.23（安全发布），均发布于 2026-11-17（Eclipse mosquitto-dev 邮件列表 2026-11-17 11:34 通告；官网博客同日）。2.1.3 为关键安全发布。
- LICENSE：主仓库已确认是 `eclipse-mosquitto/mosquitto`（README 明确列为源码仓库；默认分支 master；2026-11-19 补核）。许可文件：根目录有 `LICENSE.txt`（仅 4 行占位内容“-”，无许可正文）与 `epl-v20`、`edl-v10` 两个许可文本文件（根目录文件列表已确认存在）。**许可证类型已多方核实：EPL-2.0 OR EDL-1.0**（双许可）：源码文件头写明 "made available under the terms of the Eclipse Public License 2.0 and Eclipse Distribution License v1.0"；MSYS2 与 Docker Hub 均标注 `EPL-2.0 OR EDL-1.0`。
- 用途：实现 MQTT 5.0/3.1.1/3.1 协议的开源消息代理（Broker），供物联网设备与应用做发布/订阅消息传输。
- 是否适合本项目：适合。Lila Home 的 MQTT Broker 首选。
- 商业分发限制 / 再分发义务：EPL-2.0 为弱 copyleft——分发须提供源码获取方式、附许可副本、保留声明；可按 EPL §3.1(b) 以其他许可分发（须满足免责与责任排除等条件）；商业分发者须按 §4 为其他贡献者承担辩护与赔偿义务。EDL-1.0 为 BSD 风格宽松许可，可作为替代选择。
- 依赖关系：C 语言；可选 libwebsockets（内置 WebSocket 监听）、OpenSSL（TLS）、cJSON。
- **安全事实：2.1.0–2.1.2 的内置 WebSocket 监听存在未授权远程代码执行漏洞 CVE-2026-110486，须用 2.1.3 或更新版（最新 2.1.4）；Home Assistant Mosquitto 插件 ≤7.1.1 同受影响，7.1.2（2026-10-19）已修。Lila Home 选型下限为 Mosquitto ≥2.1.3。**
- 来源：https://mosquitto.org/blog/ ；https://github.com/eclipse-mosquitto/mosquitto/blob/master/lib/net_mosq.h

## 6. Matter Server

须区分两个仓库，旧实现已归档，新选型只能用当前实现。

### 6a. 当前实现：matter-js/matterjs-server

- 官方 GitHub：https://github.com/matter-js/matterjs-server
- 官方文档：UNKNOWN（未在本轮单独打开核实；仓库内含 docs/ 目录，CHANGELOG 见 https://github.com/matter-js/matterjs-server/blob/HEAD/CHANGELOG.md）
- 维护状态：活跃。GitHub 组织页显示 2026-10-21/22 有更新；CHANGELOG 持续至 2026-10-24。
- 最新稳定版本：1.5.5，日期 2026-10-24（CHANGELOG 顶部条目；1.5.0 发布于 2026-10-20，引入 WebSocket Schema v14、matter.js 0.18.0、Matter 1.6.1 支持）。注：Home Assistant Matter Server 插件 9.1.0 内含的为较旧的 1.2.6，存在版本滞后。
- LICENSE：文件名 `LICENSE`，已打开原文核实，第一行 "Apache License / Version 2.0, January 2004" → **Apache-2.0**。
- 用途：基于 matter.js（TypeScript）的 Matter 控制器服务器，通过 WebSocket 向 Home Assistant 等平台提供 Matter 设备接入。
- 是否适合本项目：适合。Matter 接入的当前实现。
- 商业分发限制 / 再分发义务：同 Apache-2.0（见第 1 项）：附许可副本、标注修改、保留声明、NOTICE 署名；不授商标权。
- 依赖关系：Node.js；matter.js 库（TypeScript，Apache-2.0）；以 npm 包 `matter-server` 分发；Home Assistant 插件 home-assistant/addons 的 matter_server 自 9.0.0（2026-06）起改用此实现。
- 来源：https://github.com/matter-js/matterjs-server/blob/HEAD/CHANGELOG.md ；https://github.com/matter-js/matterjs-server/blob/main/LICENSE

### 6b. 旧实现：python-matter-server（已归档，勿作新选型依据）

- 官方 GitHub：https://github.com/matter-js/python-matter-server（原属 home-assistant-libs/python-matter-server，现已迁移至 matter-js 组织并归档）
- 官方文档：仓库内 DEVELOPMENT.md / docs/（未单独核实文档地址）
- 维护状态：**已归档（Archived），停止维护**。仓库页明确显示 "Public archive"、"Archived: Yes"；README 写明 8.1.2 为最终版本，"will no longer receive updates or support"，请迁移至新服务器。
- 最新稳定版本：8.1.2（最终版；发布日期 UNKNOWN，未在本轮核实）。
- LICENSE：文件名 `LICENSE`（仓库根文件列表中有该文件），类型 **Apache-2.0**（仓库页 License 字段）；LICENSE 原文未单独打开。
- 用途：旧版 Python 实现的 Matter 控制器服务器（基于官方 Matter/CHIP SDK），通过 WebSocket 提供 Matter 接入。
- 是否适合本项目：不适合新选型，仅作历史记录。
- 商业分发限制 / 再分发义务：Apache-2.0（同上）。
- 依赖关系：Python；官方 Matter（CHIP）SDK（C++）；由 Open Home Foundation 持有、Nabu Casa 资助。
- 来源：https://github.com/matter-js/python-matter-server/（已打开仓库页核实归档状态与最终版本声明）

## 7. openHAB

- 官方 GitHub：核心 https://github.com/openhab/openhab-core ；发行版/发布 https://github.com/openhab/openhab-distro
- 官方文档：https://www.openhab.org/docs/（2026-11-19 已打开核实：Introduction 页，含安装、概念、配置指引）
- 维护状态：活跃。openhab-core 最后提交 2026-11-18；过去 12 个月 606 次提交；43 名活跃维护者（5.2 发布时）。
- 最新稳定版本：5.2.4，发布于 2026-11-08T21:03:10Z（openhab-distro 发布页；社区公告同日）。5.2.0 发布于 2026-07-05；另有里程碑版 5.3.0 M5（2026-11-19，非稳定版）。注：英文维基百科仍写稳定版 5.1.4（2026-04-13），该信息已过时，以发行版仓库为准。
- LICENSE：文件名 `LICENSE`（openhab-core），已打开原文核实，第一行 "Eclipse Public License - v 2.0" → **EPL-2.0**。
- 用途：与厂商和技术无关的 Java 家庭自动化运行时，通过 500 多个 add-on（绑定）接入各类设备并做规则自动化。
- 是否适合本项目：可作备选。Lila Home 首选 Home Assistant 作为设备中枢；openHAB 与 Home Assistant 二选一，不并行部署两个中枢。
- 商业分发限制 / 再分发义务：EPL-2.0 弱 copyleft——分发须以源码形式提供程序、附许可副本、保留声明；可按 §3.1(b) 以其他许可分发；商业分发者按 §4 承担辩护与赔偿义务；可选择以次级许可 GPL-2.0 提供（Secondary License 条款）。
- 依赖关系：Java 21（5.x 强制要求）；OSGi/Karaf 运行时；add-on 生态；5.2 新增 19 个 add-on，累计超 500 个。
- 来源：https://github.com/openhab/openhab-core/blob/main/LICENSE ；https://www.openhab.org/blog/2026-07-05-openhab-5-2-release.html

## 8. Node-RED

- 官方 GitHub：https://github.com/node-red/node-red
- 官方文档：https://nodered.org/docs/（API 文档 https://nodered.org/docs/api/admin/；官网 https://nodered.org）
- 维护状态：活跃。最后提交 2026-11-17；过去 12 个月 1,011 次提交；23,862 stars；OpenJS 基金会项目。
- 最新稳定版本：5.0.10，发布于 2026-11-17（维护发布：body-parser DoS 修复与安全加固；5.0.0 发布于 2026-06-09；4.x 维护至 2026-12-31）。
- LICENSE：文件名 `LICENSE`，已打开原文核实，第一行 "Apache License / Version 2.0, January 2004" → **Apache-2.0**。版权归 OpenJS 基金会。
- 用途：基于浏览器的低代码流式编辑器，把硬件设备、API 与在线服务连线成物联网自动化流程。
- 是否适合本项目：适合（可选）。自动化场景中心的可选实现方式之一，与 Home Assistant 内置自动化二选一或互补；首批不强制引入。
- 商业分发限制 / 再分发义务：同 Apache-2.0（见第 1 项）。
- 依赖关系：Node.js ≥22.9（推荐 Node 24）；npm；可通过 Docker 镜像 nodered/node-red 运行；常作为 Home Assistant 插件使用，但插件捆绑版本可能滞后于上游（如插件 v22.2.1 仍为 5.0.10 之前）。
- 来源：https://github.com/node-red/node-red/blob/master/LICENSE

## 9. Tailscale

- 官方 GitHub：https://github.com/tailscale/tailscale（客户端 tailscaled、CLI 与 DERP 中继）
- 官方文档：官网 https://tailscale.com；知识库 tailscale.com/kb/ 抓取返回 403，未能直接核实，仍标 UNKNOWN（2026-11-19 补核时复现，与网络报告一致）。
- 维护状态：活跃。2026-10 至 11 月连续发布多个补丁版。
- 最新稳定版本：v1.104.7，2026-11-12 发布，GitHub 发布页标为 Latest（commit `cbc74fe`，2026-11-19 补核已直接打开发布页确认）。版本链：v1.104.2（2026-10-21）→ v1.104.4（2026-10-28，修安全公告 TS-2026-014 至 -017 的 SSH/Serve 问题）→ v1.104.5（2026-11-03）→ v1.104.6（2026-11-11）→ v1.104.7（2026-11-12）。
- LICENSE：文件名 `LICENSE`，已打开原文核实，第一行 "BSD 3-Clause License" → **BSD-3-Clause**。
- 用途：基于 WireGuard 的 Mesh VPN：设备组成私有 tailnet，能直连则直连、否则经 DERP 中继。
- 是否适合本项目：适合。公网 VPS 与家庭 LAN 安全连接的首选研究对象（与 Headscale 配对比较，见 `docs/architecture/NETWORK_ARCHITECTURE.md`）。
- 商业分发限制 / 再分发义务：BSD-3-Clause 宽松许可——源码与二进制再分发须保留版权声明、条件列表与免责声明；未经事先书面许可不得用版权持有者或贡献者名义为衍生产品背书。**关键区分：仅客户端/CLI/DERP 代码开源；协调控制面（分发密钥、IP、DNS、策略的服务器）为 Tailscale Inc. 闭源托管服务，不受此许可覆盖；使用托管服务须遵守其服务条款与定价（Personal 免费版限 6 用户、非商业用途）。**
- 依赖关系：WireGuard 数据面；Go 语言；客户端覆盖 Linux、Windows、macOS、iOS、Android、tvOS 等。
- 来源：https://github.com/tailscale/tailscale/blob/main/LICENSE

## 10. Headscale

- 官方 GitHub：https://github.com/juanfont/headscale
- 官方文档：https://headscale.net/stable（官网 https://headscale.net）
- 维护状态：活跃。最后提交 2026-11-19；过去 12 个月 1,599 次提交；约 45,870 stars。
- 最新稳定版本：v0.29.7，发布于 2026-10-30（多方一致：GitHub API 数据、opentechhub、selfhost.directory；此前 v0.29.6 发布于 2026-10-24）。
- LICENSE：文件名 `LICENSE`，已打开原文核实，第一行 "BSD 3-Clause License" → **BSD-3-Clause**。
- 用途：开源自托管的 Tailscale 协调（控制面）服务器实现，配合官方 Tailscale 客户端组建自有 tailnet。
- 是否适合本项目：适合。自托管控制面的选项；与 Tailscale 托管服务二选一。
- 商业分发限制 / 再分发义务：BSD-3-Clause（同第 9 项）。README 声明与 Tailscale Inc. 无关联。注意 Headscale 仅实现控制面，数据面仍用官方 Tailscale 客户端（BSD-3-Clause）。
- 依赖关系：Go 单二进制；官方 Tailscale 客户端（0.29.x 要求客户端 ≥v1.80.0，目标支持最近 10 个客户端版本）；默认 SQLite（支持 PostgreSQL 但上游不推荐）；可选 OIDC。**版本注意：项目仍为 0.x（pre-1.0），小版本之间存在破坏性变更，须按次序逐个小版本升级。**
- 来源：https://github.com/juanfont/headscale/blob/main/LICENSE ；https://headscale.net/stable

## 未确认项汇总（UNKNOWN）

1. ~~HAOS 的 LICENSE 文件名与许可证类型——未打开原文核实，须补核。~~ **已补核（2026-11-19）：文件名 `LICENSE`，Apache-2.0（原文第一行已核实）。**
2. ~~Mosquitto 的 LICENSE 文件名——`LICENSE.txt` 打开为空占位内容；`epl-v20`/`edl-v10` 文件名说法未直接打开核实（但 EPL-2.0 OR EDL-1.0 类型已多方核实）。~~ **已补核（2026-11-19）：主仓库为 `eclipse-mosquitto/mosquitto`；`LICENSE.txt` 确为占位内容“-”；`epl-v20`/`edl-v10` 在根目录文件列表中已确认存在。**
3. ~~HAOS 与 openHAB 的官方文档地址——未单独打开核实（仅确认官网域名）。~~ **已补核（2026-11-19）：HAOS 文档 https://www.home-assistant.io/installation/、openHAB 文档 https://www.openhab.org/docs/ 均已打开核实。**
4. Tailscale 官方文档地址（tailscale.com/kb/）——抓取返回 403，未能直接核实（2026-11-19 补核时复现，与网络报告一致）。
5. matterjs-server 的官方文档地址——未单独打开核实（仅知仓库内含 docs/ 目录）。
6. ~~Tailscale v1.104.7（2026-11-12）——仅单一二手来源，须以 GitHub 发布页复核；已确认的最新版本链止于 v1.104.5（2026-11-03）。~~ **已补核（2026-11-19）：v1.104.7 为 Latest，2026-11-12 发布，发布页直接核实。**
7. ~~Mosquitto 主仓库归属——eclipse/mosquitto 与 eclipse-mosquitto/mosquitto 两个组织名并存，须以 Eclipse 官方项目页确认。~~ **已补核（2026-11-19）：主仓库为 `eclipse-mosquitto/mosquitto`（README 明确列为源码仓库）。**
8. python-matter-server 8.1.2 的发布日期——未核实（Releases 页抓取文本未含版本号与日期字段，两次翻页均未找到；仓库已于 2026-06-23 归档）。
9. 本轮未核实任何项目的完整依赖清单与版本锁定细节（如各集成/插件的传递依赖许可证），仅核实要点级依赖。

## 合规要点（Stage 1 前必须遵守）

- ESPHome 与 Zigbee2MQTT 含 GPL-3.0 copyleft 成分：若 Lila Home 将来分发含其代码/固件的产品，须履行源码提供义务；仅家庭自用、不分发不触发该义务。本项目第一阶段为家庭自用，后续若开放源码须重新做许可证审查。
- python-matter-server 已归档停更，Matter 新选型只能用 matter-js/matterjs-server（当前 1.5.5，2026-10-24），且 HA 插件内含版本（1.2.6）滞后于上游。
- Mosquitto 2.1.0–2.1.2 存在 CVE-2026-110486 未授权 RCE，选型下限为 ≥2.1.3（最新 2.1.4，2026-11-17）。
- Tailscale 1.104.4（2026-10-28）修复安全问题（TS-2026-014 至 -017）；Headscale v0.29.7（2026-10-30）为对应安全发布。
- 其余已核实项目为 Apache-2.0 / EPL-2.0 / BSD-3-Clause / MIT 宽松或弱 copyleft 许可。
- 未经审核，不得复制其他项目源代码；`THIRD_PARTY_NOTICES.md` 须随选型变化更新。
