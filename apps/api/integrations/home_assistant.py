"""Home Assistant REST 客户端骨架。

- HA_BASE_URL 环境变量未设置时一律返回 not_connected, 不连任何地址。
- 设置后才真实发请求 (标准库 urllib, 跑在线程里, 不阻塞事件循环)。
- Token 取自 HA_TOKEN 环境变量, 只放进 Authorization 请求头, 绝不记日志、
  不进返回值、不进数据库。
- 本阶段调用方 (device_service) 只在 HA 已配置时才走到真实请求分支;
  未配置时命令直接记 UNKNOWN, 绝不谎报执行结果。
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request

HA_NOT_CONNECTED = {"status": "not_connected", "detail": "未接入"}


class HomeAssistantClient:
    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("HA_BASE_URL") or "").rstrip("/")
        self.token = token if token is not None else os.environ.get("HA_TOKEN")
        try:
            self.timeout = float(
                timeout if timeout is not None else os.environ.get("HA_TIMEOUT", "5")
            )
        except ValueError:
            self.timeout = 5.0

    @property
    def is_configured(self) -> bool:
        """是否配置了 HA 地址。未配置 = 未接入, 不连任何地址。"""
        return bool(self.base_url)

    def _request_sync(self, method: str, path: str, payload: dict | None = None) -> dict:
        url = self.base_url + path
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", "Bearer " + self.token)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            # HTTPError 带状态码: 如实返回, 不抛错, 不把响应体外的信息编造成状态。
            try:
                raw = exc.read().decode("utf-8", "replace")
            except Exception:  # noqa: BLE001
                raw = ""
            return {
                "status": "error",
                "http_status": exc.code,
                "detail": "Home Assistant 返回 HTTP {}".format(exc.code),
                "body": raw[:500],
            }
        except Exception as exc:  # noqa: BLE001 - 连通性失败如实上报
            return {"status": "error", "detail": "连接 Home Assistant 失败: {}".format(exc)[:200]}
        try:
            parsed = json.loads(raw) if raw else {}
        except ValueError:
            parsed = {"raw": raw[:500]}
        return {"status": "ok", "data": parsed}

    async def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        return await asyncio.to_thread(self._request_sync, method, path, payload)

    async def get_state(self, entity_id: str) -> dict:
        """读 HA 实体状态。未接入时返回 not_connected, 不连任何地址。"""
        if not self.is_configured:
            return dict(HA_NOT_CONNECTED)
        return await self._request("GET", "/api/states/" + entity_id)

    async def call_service(self, domain: str, service: str, data: dict) -> dict:
        """调 HA 服务 (如 light.turn_on)。未接入时返回 not_connected。"""
        if not self.is_configured:
            return dict(HA_NOT_CONNECTED)
        return await self._request(
            "POST", "/api/services/{}/{}".format(domain, service), data
        )

    async def check_connection(self) -> dict:
        """连通性检查: 未配置返回 not_connected; 已配置则请求 HA 根状态接口。"""
        if not self.is_configured:
            return dict(HA_NOT_CONNECTED)
        result = await self._request("GET", "/api/")
        if result.get("status") == "ok":
            return {"status": "ok", "detail": "Home Assistant 连接成功"}
        return {"status": "error", "detail": result.get("detail", "连接失败")}
