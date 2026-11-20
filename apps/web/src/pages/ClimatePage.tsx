import { useEffect, useState } from 'react'
import {
  commandStatusText,
  listClimate,
  listWaterHeaters,
  sendDeviceCommand,
} from '../lib/api'
import type { ClimateDevice, WaterHeater } from '../lib/api'
import {
  btnSecondary,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  StatusBadge,
} from '../components/ui'

const CLIMATE_MODES = ['auto', 'cool', 'heat', 'dry', 'fan_only', 'off']
const HEATER_MODES = ['eco', 'comfort', 'high', 'off']

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; climate: ClimateDevice[]; heaters: WaterHeater[] }

function deviceIdOf(item: { id: string; device_id?: string }): string {
  return item.device_id ?? item.id
}

export default function ClimatePage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [notes, setNotes] = useState<Record<string, { status: string; detail: string | null }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [temps, setTemps] = useState<Record<string, number>>({})

  const load = () => {
    setState({ kind: 'loading' })
    Promise.all([listClimate(), listWaterHeaters()])
      .then(([climate, heaters]) => {
        setState({ kind: 'ok', climate, heaters })
        const next: Record<string, number> = {}
        for (const c of climate) {
          next[deviceIdOf(c)] =
            typeof c.target_temperature === 'number' ? c.target_temperature : 26
        }
        for (const h of heaters) {
          next[deviceIdOf(h)] =
            typeof h.target_temperature === 'number' ? h.target_temperature : 45
        }
        setTemps(next)
      })
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const send = (
    item: { id: string; device_id?: string },
    action: string,
    params?: Record<string, string | number | boolean>,
  ) => {
    const id = deviceIdOf(item)
    setBusyId(id)
    sendDeviceCommand(id, { action, params })
      .then((result) => {
        setNotes((prev) => ({
          ...prev,
          [id]: { status: result.status, detail: result.detail ?? null },
        }))
      })
      .catch((err: unknown) => {
        setNotes((prev) => ({
          ...prev,
          [id]: {
            status: 'ERROR',
            detail: err instanceof Error ? err.message : String(err),
          },
        }))
      })
      .finally(() => setBusyId(null))
  }

  const noteBlock = (id: string) => {
    const note = notes[id]
    if (!note) return null
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm">
        <StatusBadge status={note.status} />
        <span className="text-zinc-300">
          {note.status === 'ERROR' ? '发送失败' : commandStatusText(note.status)}
        </span>
        {note.detail ? (
          <span className="break-words text-xs text-zinc-400">{note.detail}</span>
        ) : null}
      </p>
    )
  }

  return (
    <div>
      <PageHeader
        title="空调及热水器控制"
        description="控制命令均经 POST /api/v1/devices/{id}/commands 发送，结果以返回状态为准；HA 未接入时为 UNKNOWN。热水器安全联锁由原厂保护，任何绕过联锁的操作都不提供、也不接受。"
        actions={
          <button type="button" className={btnSecondary} onClick={load}>
            刷新
          </button>
        }
      />

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && (
        <>
          <h2 className="mt-6 text-base font-semibold text-zinc-200">空调</h2>
          {state.climate.length === 0 ? (
            <EmptyState
              title="暂无空调设备"
              description="后端 GET /api/v1/climate 未返回任何空调。空调接入后，这里才会出现可控制的设备。"
            />
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.climate.map((c) => {
                const id = deviceIdOf(c)
                const temp = temps[id] ?? 26
                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{c.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {c.room_name ?? '未分组'}
                          {typeof c.current_temperature === 'number'
                            ? ` · 当前 ${c.current_temperature}°C`
                            : ''}
                          {c.mode ? ` · 模式 ${c.mode}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busyId === id}
                        onClick={() => send(c, c.on ? 'turn_off' : 'turn_on')}
                      >
                        {busyId === id ? '发送中……' : c.on ? '关机' : '开机'}
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400" htmlFor={`mode-${id}`}>
                          模式
                        </label>
                        <select
                          id={`mode-${id}`}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-violet-400 focus:outline-none"
                          value={c.mode ?? 'auto'}
                          onChange={(e) => send(c, 'set_mode', { mode: e.target.value })}
                        >
                          {CLIMATE_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="mb-1 flex justify-between text-sm text-zinc-400"
                          htmlFor={`temp-${id}`}
                        >
                          <span>目标温度</span>
                          <span className="text-zinc-200">{temp}°C</span>
                        </label>
                        <input
                          id={`temp-${id}`}
                          type="range"
                          min={16}
                          max={30}
                          step={0.5}
                          value={temp}
                          className="w-full accent-violet-400"
                          onChange={(e) =>
                            setTemps((prev) => ({ ...prev, [id]: Number(e.target.value) }))
                          }
                          onMouseUp={() =>
                            send(c, 'set_temperature', { temperature: temp })
                          }
                          onTouchEnd={() =>
                            send(c, 'set_temperature', { temperature: temp })
                          }
                        />
                      </div>
                    </div>
                    {noteBlock(id)}
                  </li>
                )
              })}
            </ul>
          )}

          <h2 className="mt-8 text-base font-semibold text-zinc-200">热水器</h2>
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm leading-relaxed text-amber-200">
            安全联锁：原厂保护（超温 / 燃气 / 干烧）不可绕过。本页不提供任何绕过联锁的输入，危险参数由后端
            API 层拒绝。
          </p>
          {state.heaters.length === 0 ? (
            <EmptyState
              title="暂无热水器设备"
              description="后端 GET /api/v1/water-heaters 未返回任何热水器。热水器接入后，这里才会出现可控制的设备。"
            />
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.heaters.map((h) => {
                const id = deviceIdOf(h)
                const temp = temps[id] ?? 45
                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{h.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {h.room_name ?? '未分组'}
                          {typeof h.current_temperature === 'number'
                            ? ` · 当前 ${h.current_temperature}°C`
                            : ''}
                          {h.mode ? ` · 模式 ${h.mode}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busyId === id}
                        onClick={() => send(h, h.on ? 'turn_off' : 'turn_on')}
                      >
                        {busyId === id ? '发送中……' : h.on ? '关闭' : '开启'}
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400" htmlFor={`hmode-${id}`}>
                          模式
                        </label>
                        <select
                          id={`hmode-${id}`}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-violet-400 focus:outline-none"
                          value={h.mode ?? 'eco'}
                          onChange={(e) => send(h, 'set_mode', { mode: e.target.value })}
                        >
                          {HEATER_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="mb-1 flex justify-between text-sm text-zinc-400"
                          htmlFor={`htemp-${id}`}
                        >
                          <span>目标温度</span>
                          <span className="text-zinc-200">{temp}°C</span>
                        </label>
                        <input
                          id={`htemp-${id}`}
                          type="range"
                          min={30}
                          max={60}
                          step={1}
                          value={temp}
                          className="w-full accent-violet-400"
                          onChange={(e) =>
                            setTemps((prev) => ({ ...prev, [id]: Number(e.target.value) }))
                          }
                          onMouseUp={() =>
                            send(h, 'set_temperature', { temperature: temp })
                          }
                          onTouchEnd={() =>
                            send(h, 'set_temperature', { temperature: temp })
                          }
                        />
                      </div>
                    </div>
                    {noteBlock(id)}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
