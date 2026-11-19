# Lila Home — 第三方声明（THIRD_PARTY_NOTICES.md）

> 本文件汇总 Lila Home Stage 0 已审计的第三方开源项目原作者、版权声明与许可证信息。
> 核实基准日：2026-11-19。LICENSE 以打开 GitHub 上 LICENSE 原文为准；未核实处写 UNKNOWN。
> 未经审核，不得复制其他项目源代码。本文件随选型变化更新。

## 1. Home Assistant Core

- 项目：Home Assistant Core
- 官方地址：https://github.com/home-assistant/core
- 许可证：Apache License 2.0（LICENSE.md 原文第一行 "Apache License / Version 2.0, January 2004"）
- 版权：Home Assistant 项目（具体版权声明见仓库 LICENSE.md 与 NOTICE 文件）
- 再分发义务：附许可证副本；修改过的文件须带显著修改声明；保留版权/专利/商标/署名声明；随附 NOTICE 署名（如有）；不授予商标使用权。

## 2. Home Assistant Operating System

- 项目：Home Assistant Operating System
- 官方地址：https://github.com/home-assistant/operating-system
- 许可证：**Apache License Version 2.0（Apache-2.0）**（`LICENSE` 原文第一行，2026-11-19 补核）
- 版权：Home Assistant 项目（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：同 Apache-2.0（附许可副本、标注修改、保留声明、不授商标权）

## 3. ESPHome

- 项目：ESPHome
- 官方地址：https://github.com/esphome/esphome
- 许可证：**双许可：MIT + GNU GENERAL PUBLIC LICENSE Version 3（GPL-3.0）**（LICENSE 原文："The ESPHome License is made up of two base licenses: MIT and the GNU GENERAL PUBLIC LICENSE."；MIT 适用于 Python 代码及除 C++ 运行时外的全部代码；GPL-3.0 适用于 C++ 运行时代码，扩展名 .c/.cpp/.h/.hpp/.tcc/.ino）
- 版权：ESPHome 项目（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：GPLv3 部分为强 copyleft——分发修改后的固件/二进制须提供对应源码、保留许可与声明、标注修改；MIT 部分仅须保留版权与许可声明。Device Builder 为独立仓库 esphome/device-builder，Apache-2.0。

## 4. Zigbee2MQTT

- 项目：Zigbee2MQTT
- 官方地址：https://github.com/Koenkk/zigbee2mqtt
- 许可证：GNU GENERAL PUBLIC LICENSE Version 3（GPL-3.0）（LICENSE 原文第一行；package.json `"license": "GPL-3.0"` 一致）
- 版权：Zigbee2MQTT 项目（Koenkk 等贡献者，具体版权声明见仓库 LICENSE 文件）
- 再分发义务：GPL-3.0 强 copyleft——分发（含修改后分发）须整体以 GPL-3.0 授权、提供源码、保留声明、标注修改；仅内部运行不分发不触发源码提供义务。依赖 zigbee-herdsman 与 zigbee-herdsman-converters 各自为 MIT。

## 5. Eclipse Mosquitto

- 项目：Eclipse Mosquitto
- 官方地址：https://github.com/eclipse-mosquitto/mosquitto（主仓库，2026-11-19 补核；README 明确列为源码仓库）
- 许可证：**EPL-2.0 OR EDL-1.0**（双许可，类型已多方核实；许可文本在根目录 `epl-v20` / `edl-v10` 文件，`LICENSE.txt` 仅为占位内容“-”，2026-11-19 补核）
- 版权：Eclipse 基金会（具体版权声明见源码文件头）
- 再分发义务：EPL-2.0 为弱 copyleft——分发须提供源码获取方式、附许可副本、保留声明；可按 EPL §3.1(b) 以其他许可分发；商业分发者须按 §4 为其他贡献者承担辩护与赔偿义务。EDL-1.0 为 BSD 风格宽松许可，可作为替代选择。

## 6. Matter Server（当前实现 matter-js/matterjs-server）

- 项目：matter-js/matterjs-server
- 官方地址：https://github.com/matter-js/matterjs-server
- 许可证：Apache License 2.0（LICENSE 原文第一行 "Apache License / Version 2.0, January 2004"）
- 版权：matter.js 项目（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：同 Apache-2.0（附许可副本、标注修改、保留声明、NOTICE 署名；不授商标权）。

## 6b. Matter Server（旧实现 python-matter-server，已归档）

- 项目：python-matter-server
- 官方地址：https://github.com/matter-js/python-matter-server
- 许可证：Apache-2.0（仓库页 License 字段；LICENSE 原文未单独打开）
- 版权：Open Home Foundation（由 Nabu Casa 资助）
- 状态：已归档，停止维护；8.1.2 为最终版。仅作历史记录，不作新选型依据。

## 7. openHAB

- 项目：openHAB Core
- 官方地址：核心 https://github.com/openhab/openhab-core ；发行版 https://github.com/openhab/openhab-distro
- 许可证：Eclipse Public License - v 2.0（EPL-2.0）（LICENSE 原文第一行）
- 版权：openHAB 项目（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：EPL-2.0 弱 copyleft——分发须以源码形式提供程序、附许可副本、保留声明；可按 §3.1(b) 以其他许可分发；商业分发者按 §4 承担辩护与赔偿义务；可选择以次级许可 GPL-2.0 提供。

## 8. Node-RED

- 项目：Node-RED
- 官方地址：https://github.com/node-red/node-red
- 许可证：Apache License 2.0（LICENSE 原文第一行 "Apache License / Version 2.0, January 2004"；版权归 OpenJS 基金会）
- 版权：OpenJS 基金会（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：同 Apache-2.0。

## 9. Tailscale

- 项目：Tailscale（客户端 tailscaled、CLI 与 DERP 中继）
- 官方地址：https://github.com/tailscale/tailscale
- 许可证：BSD 3-Clause License（LICENSE 原文第一行）
- 版权：Tailscale Inc.（具体版权声明见仓库 LICENSE 文件）
- 再分发义务：BSD-3-Clause 宽松许可——源码与二进制再分发须保留版权声明、条件列表与免责声明；未经事先书面许可不得用版权持有者或贡献者名义为衍生产品背书。**关键区分：仅客户端/CLI/DERP 代码开源；协调控制面为 Tailscale Inc. 闭源托管服务，不受此许可覆盖；使用托管服务须遵守其服务条款与定价。**

## 10. Headscale

- 项目：Headscale
- 官方地址：https://github.com/juanfont/headscale
- 许可证：BSD 3-Clause License（LICENSE 原文第一行）
- 版权：Headscale 项目（juanfont 等贡献者；README 声明与 Tailscale Inc. 无关联）
- 再分发义务：BSD-3-Clause（同第 9 项）。

## 社区集成（设备兼容性审计中引用，非 Stage 0 选型承诺）

以下项目在设备兼容性审计中被引用为社区集成，本阶段未将其列为 Lila Home 正式选型；如 Stage 1 采用，须先核实其 LICENSE 原文并补入本文件：

- `XiaoMi/ha_xiaomi_home`（小米官方自定义集成）— https://github.com/XiaoMi/ha_xiaomi_home — LICENSE 未在本轮核实，UNKNOWN。
- `al-one/hass-xiaomi-miot`（Xiaomi Miot Auto）— https://github.com/al-one/hass-xiaomi-miot — Apache-2.0（二级来源，未打开原文核实）。
- `AlexxIT/XiaomiGateway3` — https://github.com/AlexxIT/XiaomiGateway3 — MIT（二级来源，未打开原文核实）。
- `wuwentao/midea_ac_lan` — https://github.com/wuwentao/midea_ac_lan — MIT（二级来源，未打开原文核实）。
- `mill1000/midea-ac-py` — https://raw.githubusercontent.com/mill1000/midea-ac-py/main/README.md — LICENSE 未在本轮核实，UNKNOWN。
- `xiasi0/ha-oneconnect-bridge` — 非官方、实验性反向桥接，不是华为设备导入 HA 的路径；LICENSE 未核实，UNKNOWN。

## Lila Home 自身许可证

- Lila Home 自身许可证：**未定（Stage 0 未选定）**。仓库不存在，LICENSE 文件不存在。第一阶段家庭自用；后续开放源码前须定许可证并重新做全部依赖的许可证审查。
