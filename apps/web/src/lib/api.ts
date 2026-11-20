/**
 * Lila Home 后端 API 客户端（typed）。
 *
 * 约定依据：任务书给出的后端接口约定 + docs/architecture/API_DESIGN.md。
 * 后端正在并行扩展，若个别字段名与后端最终实现有出入，以后端回报为准。
 * 本文件按以下约定编写：
 * - 列表接口返回 JSON 数组，或 { items: [...] }（分页时另含 total/page/page_size）。
 * - 单体接口返回 JSON 对象；字段名按 API_DESIGN 的示例命名：
 *   房间 { id, name, sort_order }；设备 { id, name, brand, model, type,
 *   room_id, integration, compatibility_level, created_at }；
 *   指令 POST 返回 { command_id, status, device_id, detail? }，状态取自
 *   控制状态机 ACCEPTED / EXECUTING / CONFIRMED / FAILED / TIMEOUT / UNKNOWN；
 *   场景执行 POST 返回 { run_id, ... }，执行结果含逐设备结果数组
 *   （results 或 devices/steps，字段 device_id/device_name/action/status/detail）。
 * - 错误体统一 { code, message, detail }（API_DESIGN §1）；非 2xx 时抛出
 *   带 message 的 Error，调用方如实展示，不展示假数据。
 * - 认证未落地：当前不带任何 Token，全部请求按 Owner 放行（见设置页说明）。
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

/* ---------- 通用 ---------- */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CommandStatus =
  | 'ACCEPTED'
  | 'EXECUTING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 把列表响应归一化为数组：接受裸数组或 { items: [...] }。 */
export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.results)) return obj.results as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
  }
  return []
}

function errorDetailText(detail: unknown): string {
  if (detail === null || detail === undefined) return ''
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch (err: unknown) {
    throw new Error(`无法连接后端 API：${errorMessage(err)}`)
  }
  if (!res.ok) {
    let message = `后端返回 HTTP ${res.status}`
    try {
      const body: unknown = await res.json()
      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>
        const parts = [
          typeof b.message === 'string' && b.message ? b.message : '',
          errorDetailText(b.detail),
          typeof b.code === 'string' && b.code ? `（${b.code}）` : '',
        ].filter((p) => p.length > 0)
        if (parts.length > 0) message = parts.join(' ')
      }
    } catch {
      // 解析失败时保留 HTTP 状态文案。
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

function send<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/* ---------- 类型 ---------- */

export interface HealthCheckItem {
  name: string
  status: string
  detail: string
}

export interface StatusResponse {
  status: string
  checks: HealthCheckItem[]
  raw: unknown
}

export interface Room {
  id: string
  name: string
  sort_order?: number | null
  device_count?: number | null
}

export interface Device {
  id: string
  name: string
  brand?: string | null
  model?: string | null
  type?: string | null
  room_id?: string | null
  room_name?: string | null
  integration?: string | null
  compatibility_level?: string | null
  enabled?: boolean | null
  created_at?: string | null
}

export interface DeviceState {
  device_id?: string
  state?: Record<string, JsonValue> | null
  source?: string | null
  updated_at?: string | null
  is_realtime?: boolean | null
  raw?: unknown
}

export interface DeviceCommand {
  command_id?: string
  id?: string
  device_id?: string
  action?: string
  params?: Record<string, JsonValue> | null
  status?: string
  detail?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CommandResult {
  command_id?: string
  status: string
  device_id?: string
  detail?: string | null
  raw?: unknown
}

export interface Light {
  id: string
  device_id?: string
  name: string
  room_id?: string | null
  room_name?: string | null
  on?: boolean | null
  brightness?: number | null
  color_temp?: number | null
  color?: string | null
  state?: Record<string, JsonValue> | null
}

export interface ClimateDevice {
  id: string
  device_id?: string
  name: string
  room_id?: string | null
  room_name?: string | null
  on?: boolean | null
  mode?: string | null
  target_temperature?: number | null
  current_temperature?: number | null
  fan_speed?: string | null
  state?: Record<string, JsonValue> | null
}

export interface WaterHeater {
  id: string
  device_id?: string
  name: string
  room_id?: string | null
  room_name?: string | null
  on?: boolean | null
  mode?: string | null
  target_temperature?: number | null
  current_temperature?: number | null
  state?: Record<string, JsonValue> | null
}

export interface Speaker {
  id: string
  device_id?: string
  name: string
  room_id?: string | null
  room_name?: string | null
  playing?: boolean | null
  volume?: number | null
  current_track?: string | null
  state?: Record<string, JsonValue> | null
}

export interface NetworkDevice {
  id?: string
  name?: string
  hostname?: string | null
  ip?: string | null
  mac?: string | null
  online?: boolean | null
  signal?: number | string | null
  last_seen?: string | null
}

export interface SceneAction {
  id?: string
  device_id: string
  device_name?: string | null
  action: string
  params?: Record<string, JsonValue> | null
  order?: number | null
}

export interface Scene {
  id: string
  name: string
  description?: string | null
  rules?: Record<string, JsonValue> | null
  actions?: SceneAction[]
  created_at?: string | null
}

export interface SceneRunResult {
  device_id?: string
  device_name?: string | null
  action?: string | null
  status?: string
  detail?: string | null
}

export interface SceneRun {
  run_id: string
  scene_id?: string
  status?: string
  results: SceneRunResult[]
  created_at?: string | null
  raw?: unknown
}

export interface AppUser {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  roles?: string[] | null
  created_at?: string | null
}

export interface AuditLog {
  id?: string
  actor?: string | null
  action?: string | null
  target?: string | null
  detail?: string | null
  created_at?: string | null
  timestamp?: string | null
}

export interface AuditLogPage {
  items: AuditLog[]
  total?: number | null
  page?: number | null
  page_size?: number | null
}

export interface Integration {
  id?: string
  name: string
  type?: string | null
  enabled?: boolean | null
  status?: string | null
  detail?: string | null
}

export interface SystemHealth {
  status?: string
  checks?: HealthCheckItem[]
  raw?: unknown
}

/* ---------- 状态 / 健康 ---------- */

/**
 * 如实解析后端 /health 与 /api/v1/status 返回。接受两种常见形态：
 * - { status, checks: [{ name, status, detail }] }
 * - { status, checks: { "<name>": { status, detail } | "<status>" } }
 * 其余形态原样保留在 raw 里，不猜测、不补假数据。
 */
export function parseHealthPayload(data: unknown): StatusResponse {
  if (typeof data !== 'object' || data === null) {
    return { status: 'unknown', checks: [], raw: data }
  }
  const obj = data as Record<string, unknown>
  const status =
    typeof obj.status === 'string' && obj.status.length > 0 ? obj.status : 'unknown'
  const checks: HealthCheckItem[] = []
  const rawChecks = obj.checks
  const pushDetail = (value: unknown): string => {
    if (value === null || value === undefined) return '（无详情）'
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (Array.isArray(rawChecks)) {
    for (const item of rawChecks) {
      if (typeof item === 'object' && item !== null) {
        const c = item as Record<string, unknown>
        checks.push({
          name: typeof c.name === 'string' ? c.name : '（未命名检查项）',
          status:
            typeof c.status === 'string' && c.status.length > 0 ? c.status : 'unknown',
          detail: pushDetail(c.detail ?? c.message ?? c.info),
        })
      } else {
        checks.push({ name: '（未命名检查项）', status: 'unknown', detail: pushDetail(item) })
      }
    }
  } else if (typeof rawChecks === 'object' && rawChecks !== null) {
    for (const [name, value] of Object.entries(rawChecks as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) {
        const c = value as Record<string, unknown>
        checks.push({
          name,
          status:
            typeof c.status === 'string' && c.status.length > 0 ? c.status : 'unknown',
          detail: pushDetail(c.detail ?? c.message ?? c.info),
        })
      } else {
        checks.push({
          name,
          status: typeof value === 'string' ? value : 'unknown',
          detail: pushDetail(value),
        })
      }
    }
  }
  return { status, checks, raw: data }
}

export async function fetchHealth(): Promise<StatusResponse> {
  const data: unknown = await request<unknown>('/health')
  return parseHealthPayload(data)
}

export async function fetchStatus(): Promise<StatusResponse> {
  const data: unknown = await request<unknown>('/api/v1/status')
  return parseHealthPayload(data)
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const data: unknown = await request<unknown>('/api/v1/system/health')
  const parsed = parseHealthPayload(data)
  return { status: parsed.status, checks: parsed.checks, raw: data }
}

/* ---------- 房间 ---------- */

export async function listRooms(): Promise<Room[]> {
  return asList<Room>(await get<unknown>('/api/v1/rooms'))
}

export async function createRoom(body: { name: string; sort_order?: number }): Promise<Room> {
  return send<Room>('POST', '/api/v1/rooms', body)
}

export async function updateRoom(
  id: string,
  body: { name?: string; sort_order?: number },
): Promise<Room> {
  return send<Room>('PATCH', `/api/v1/rooms/${encodeURIComponent(id)}`, body)
}

export async function deleteRoom(id: string): Promise<void> {
  await send<void>('DELETE', `/api/v1/rooms/${encodeURIComponent(id)}`)
}

/* ---------- 设备 ---------- */

export async function listDevices(): Promise<Device[]> {
  return asList<Device>(await get<unknown>('/api/v1/devices'))
}

export async function getDevice(id: string): Promise<Device> {
  return get<Device>(`/api/v1/devices/${encodeURIComponent(id)}`)
}

export interface CreateDeviceBody {
  name: string
  brand?: string
  model?: string
  type?: string
  room_id?: string | null
}

export async function createDevice(body: CreateDeviceBody): Promise<Device> {
  return send<Device>('POST', '/api/v1/devices', body)
}

export async function updateDevice(
  id: string,
  body: Partial<CreateDeviceBody>,
): Promise<Device> {
  return send<Device>('PATCH', `/api/v1/devices/${encodeURIComponent(id)}`, body)
}

export async function deleteDevice(id: string): Promise<void> {
  await send<void>('DELETE', `/api/v1/devices/${encodeURIComponent(id)}`)
}

export async function getDeviceState(id: string): Promise<DeviceState> {
  const data: unknown = await get<unknown>(`/api/v1/devices/${encodeURIComponent(id)}/state`)
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    const state =
      typeof obj.state === 'object' && obj.state !== null
        ? (obj.state as Record<string, JsonValue>)
        : null
    return {
      device_id: typeof obj.device_id === 'string' ? obj.device_id : id,
      state,
      source: typeof obj.source === 'string' ? obj.source : null,
      updated_at: typeof obj.updated_at === 'string' ? obj.updated_at : null,
      is_realtime: typeof obj.is_realtime === 'boolean' ? obj.is_realtime : null,
      raw: data,
    }
  }
  return { device_id: id, state: null, raw: data }
}

export async function sendDeviceCommand(
  id: string,
  body: { action: string; params?: Record<string, JsonValue> },
): Promise<CommandResult> {
  const data: unknown = await send<unknown>(
    'POST',
    `/api/v1/devices/${encodeURIComponent(id)}/commands`,
    body,
  )
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    return {
      command_id:
        typeof obj.command_id === 'string'
          ? obj.command_id
          : typeof obj.id === 'string'
            ? obj.id
            : undefined,
      status: typeof obj.status === 'string' ? obj.status : 'UNKNOWN',
      device_id: typeof obj.device_id === 'string' ? obj.device_id : id,
      detail:
        typeof obj.detail === 'string'
          ? obj.detail
          : typeof obj.message === 'string'
            ? obj.message
            : null,
      raw: data,
    }
  }
  return { status: 'UNKNOWN', device_id: id, raw: data }
}

export async function listDeviceCommands(id: string): Promise<DeviceCommand[]> {
  return asList<DeviceCommand>(
    await get<unknown>(`/api/v1/devices/${encodeURIComponent(id)}/commands`),
  )
}

/* ---------- 聚合视图 ---------- */

export async function listLights(): Promise<Light[]> {
  return asList<Light>(await get<unknown>('/api/v1/lights'))
}

export async function listClimate(): Promise<ClimateDevice[]> {
  return asList<ClimateDevice>(await get<unknown>('/api/v1/climate'))
}

export async function listWaterHeaters(): Promise<WaterHeater[]> {
  return asList<WaterHeater>(await get<unknown>('/api/v1/water-heaters'))
}

export async function listSpeakers(): Promise<Speaker[]> {
  return asList<Speaker>(await get<unknown>('/api/v1/speakers'))
}

export async function listNetworkDevices(): Promise<NetworkDevice[]> {
  return asList<NetworkDevice>(await get<unknown>('/api/v1/network/devices'))
}

/* ---------- 场景 ---------- */

export async function listScenes(): Promise<Scene[]> {
  return asList<Scene>(await get<unknown>('/api/v1/scenes'))
}

export async function createScene(body: {
  name: string
  description?: string
  rules?: Record<string, JsonValue> | null
}): Promise<Scene> {
  return send<Scene>('POST', '/api/v1/scenes', body)
}

export async function updateScene(
  id: string,
  body: { name?: string; description?: string; rules?: Record<string, JsonValue> | null },
): Promise<Scene> {
  return send<Scene>('PATCH', `/api/v1/scenes/${encodeURIComponent(id)}`, body)
}

export async function deleteScene(id: string): Promise<void> {
  await send<void>('DELETE', `/api/v1/scenes/${encodeURIComponent(id)}`)
}

export async function listSceneActions(id: string): Promise<SceneAction[]> {
  return asList<SceneAction>(
    await get<unknown>(`/api/v1/scenes/${encodeURIComponent(id)}/actions`),
  )
}

export async function addSceneAction(
  id: string,
  body: { device_id: string; action: string; params?: Record<string, JsonValue> },
): Promise<SceneAction> {
  return send<SceneAction>(
    'POST',
    `/api/v1/scenes/${encodeURIComponent(id)}/actions`,
    body,
  )
}

export async function runScene(id: string): Promise<{ run_id: string; raw: unknown }> {
  const data: unknown = await send<unknown>(
    'POST',
    `/api/v1/scenes/${encodeURIComponent(id)}/run`,
    {},
  )
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (typeof obj.run_id === 'string') return { run_id: obj.run_id, raw: data }
    if (typeof obj.id === 'string') return { run_id: obj.id, raw: data }
  }
  throw new Error('后端未返回 run_id，无法查询执行结果')
}

export async function getSceneRun(id: string, runId: string): Promise<SceneRun> {
  const data: unknown = await get<unknown>(
    `/api/v1/scenes/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`,
  )
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    const results = asList<SceneRunResult>(
      obj.results ?? obj.devices ?? obj.steps ?? obj.actions ?? [],
    )
    return {
      run_id:
        typeof obj.run_id === 'string'
          ? obj.run_id
          : typeof obj.id === 'string'
            ? obj.id
            : runId,
      scene_id: typeof obj.scene_id === 'string' ? obj.scene_id : id,
      status: typeof obj.status === 'string' ? obj.status : undefined,
      results,
      created_at: typeof obj.created_at === 'string' ? obj.created_at : null,
      raw: data,
    }
  }
  return { run_id: runId, scene_id: id, results: [], raw: data }
}

/* ---------- 系统 ---------- */

export async function listUsers(): Promise<AppUser[]> {
  return asList<AppUser>(await get<unknown>('/api/v1/users'))
}

export async function listAuditLogs(
  page = 1,
  pageSize = 20,
): Promise<AuditLogPage> {
  const data: unknown = await get<unknown>(
    `/api/v1/audit-logs?page=${page}&page_size=${pageSize}`,
  )
  const items = asList<AuditLog>(data)
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    return {
      items,
      total: typeof obj.total === 'number' ? obj.total : null,
      page: typeof obj.page === 'number' ? obj.page : page,
      page_size: typeof obj.page_size === 'number' ? obj.page_size : pageSize,
    }
  }
  return { items, total: items.length, page, page_size: pageSize }
}

export async function listIntegrations(): Promise<Integration[]> {
  return asList<Integration>(await get<unknown>('/api/v1/integrations'))
}

/* ---------- 展示辅助 ---------- */

/** 把任意值如实转成可展示文本；对象/数组用 JSON，不猜测字段含义。 */
export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.length > 0 ? value : '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** 指令/执行状态的中文说明（状态机见 API_DESIGN §2）。 */
export function commandStatusText(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACCEPTED':
      return '已接收，未发送'
    case 'EXECUTING':
      return '已发送，等待回执'
    case 'CONFIRMED':
      return '已确认执行'
    case 'FAILED':
      return '执行失败'
    case 'TIMEOUT':
      return '超时，未确认'
    case 'UNKNOWN':
      return '已发送，未确认（HA 未接入）'
    default:
      return status
  }
}
