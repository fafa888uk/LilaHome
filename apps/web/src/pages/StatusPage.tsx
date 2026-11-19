import { useEffect, useState } from 'react'
import { getHealthUrl } from '../lib/api'

type CheckStatus = 'ok' | 'error' | 'unknown'

interface HealthCheck {
  name: string
  status: string
  detail: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; status: string; checks: HealthCheck[]; raw: unknown }

function toDetail(value: unknown): string {
  if (value === null || value === undefined) return '（无详情）'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function toStatus(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown'
}

/**
 * 如实解析后端 /health 返回。接受两种常见形态：
 * - { status, checks: [{ name, status, detail }] }
 * - { status, checks: { "<name>": { status, detail } | "<status>" } }
 * 其余形态原样展示 JSON，不猜测、不补假数据。
 */
function parseHealth(data: unknown): { status: string; checks: HealthCheck[] } {
  if (typeof data !== 'object' || data === null) {
    return { status: 'unknown', checks: [] }
  }
  const obj = data as Record<string, unknown>
  const status = toStatus(obj.status)
  const checks: HealthCheck[] = []
  const rawChecks = obj.checks
  if (Array.isArray(rawChecks)) {
    for (const item of rawChecks) {
      if (typeof item === 'object' && item !== null) {
        const c = item as Record<string, unknown>
        checks.push({
          name: typeof c.name === 'string' ? c.name : '（未命名检查项）',
          status: toStatus(c.status),
          detail: toDetail(c.detail ?? c.message ?? c.info),
        })
      } else {
        checks.push({ name: '（未命名检查项）', status: 'unknown', detail: toDetail(item) })
      }
    }
  } else if (typeof rawChecks === 'object' && rawChecks !== null) {
    for (const [name, value] of Object.entries(rawChecks as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) {
        const c = value as Record<string, unknown>
        checks.push({
          name,
          status: toStatus(c.status),
          detail: toDetail(c.detail ?? c.message ?? c.info),
        })
      } else {
        checks.push({ name, status: toStatus(value), detail: toDetail(value) })
      }
    }
  }
  return { status, checks }
}

function checkState(status: string): CheckStatus {
  const s = status.toLowerCase()
  if (s === 'ok' || s === 'healthy' || s === 'up' || s === 'pass') return 'ok'
  if (s === 'unknown') return 'unknown'
  return 'error'
}

function badge(status: string) {
  const state = checkState(status)
  if (state === 'ok') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  if (state === 'unknown') return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
  return 'border-red-400/40 bg-red-400/10 text-red-300'
}

export default function StatusPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const healthUrl = getHealthUrl()

  useEffect(() => {
    let cancelled = false
    fetch(healthUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`后端返回 HTTP ${res.status}`)
        }
        const data: unknown = await res.json()
        if (cancelled) return
        const parsed = parseHealth(data)
        setState({ kind: 'ok', status: parsed.status, checks: parsed.checks, raw: data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [healthUrl])

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">系统状态</h1>
      <p className="mt-2 text-sm text-zinc-400">
        实时请求后端 <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">{healthUrl}</code>
        ，以下全部来自后端返回，不做任何推测。
      </p>

      {state.kind === 'loading' && (
        <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-6 text-sm text-zinc-400">
          正在检查后端状态……
        </p>
      )}

      {state.kind === 'error' && (
        <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-400/10 px-5 py-6">
          <p className="text-lg font-semibold text-red-300">无法连接后端 API</p>
          <p className="mt-2 break-words text-sm leading-relaxed text-red-200/90">
            {state.message}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            后端尚未部署或不可达时显示此提示，不展示任何假数据。
          </p>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
            <span className="text-sm text-zinc-400">总体状态</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-sm ${badge(state.status)}`}>
              {state.status}
            </span>
          </div>

          {state.checks.length > 0 ? (
            <ul className="space-y-3">
              {state.checks.map((check) => (
                <li
                  key={check.name}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-white">{check.name}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-zinc-400">
                    {check.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4 text-sm text-zinc-400">
              后端未返回检查项列表，原始返回如下。
            </p>
          )}

          <details className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              原始返回 JSON
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(state.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
