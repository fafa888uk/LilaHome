/**
 * 后端 API 地址解析。
 *
 * 优先级：环境变量 VITE_API_URL（部署时覆盖）> 与页面同主机、8001 端口。
 * 不写死任何 IP 地址；v0.1 的访问控制由 Tailscale 承担，前端不做应用内登录。
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/+$/, '')
  }
  return `http://${window.location.hostname}:8001`
}

export function getHealthUrl(): string {
  return `${getApiBaseUrl()}/health`
}
