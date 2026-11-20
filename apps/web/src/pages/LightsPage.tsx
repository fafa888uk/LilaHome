import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { commandStatusText, listLights, sendDeviceCommand } from '../lib/api'
import type { Light } from '../lib/api'
import {
  btnSecondary,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  StatusBadge,
} from '../components/ui'

interface LightNote {
  status: string
  detail: string | null
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; lights: Light[] }

function deviceIdOf(light: Light): string {
  return light.device_id ?? light.id
}

export default function LightsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [notes, setNotes] = useState<Record<string, LightNote>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sliders, setSliders] = useState<Record<string, { brightness: number; colorTemp: number }>>({})

  const load = () => {
    setState({ kind: 'loading' })
    listLights()
      .then((lights) => {
        setState({ kind: 'ok', lights })
        const next: Record<string, { brightness: number; colorTemp: number }> = {}
        for (const l of lights) {
          next[deviceIdOf(l)] = {
            brightness: typeof l.brightness === 'number' ? l.brightness : 100,
            colorTemp: typeof l.color_temp === 'number' ? l.color_temp : 4000,
          }
        }
        setSliders(next)
      })
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const send = (light: Light, action: string, params?: Record<string, number | boolean>) => {
    const id = deviceIdOf(light)
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

  return (
    <div>
      <PageHeader
        title="灯光控制中心"
        description="每盏灯的开关、亮度、色温都经 POST /api/v1/devices/{id}/commands 发送。HA 未接入时，命令只会返回 UNKNOWN，界面如实显示“已发送，未确认”，绝不显示成“已执行”。"
        actions={
          <button type="button" className={btnSecondary} onClick={load}>
            刷新
          </button>
        }
      />

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && state.lights.length === 0 && (
        <EmptyState
          title="暂无灯光设备"
          description="后端 GET /api/v1/lights 未返回任何灯。灯具接入后，这里才会出现可控制的灯。"
        />
      )}

      {state.kind === 'ok' && state.lights.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.lights.map((light, i) => {
            const id = deviceIdOf(light)
            const slider = sliders[id] ?? { brightness: 100, colorTemp: 4000 }
            const note = notes[id]
            return (
              <li
                key={id}
                className="lila-card animate-fade-up px-5 py-4"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span
                      className={`lila-icon-tile h-11 w-11 p-2.5 ${
                        light.on
                          ? 'bg-amber-400/15 text-amber-300'
                          : 'bg-zinc-400/10 text-zinc-400'
                      }`}
                    >
                      <Lightbulb className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{light.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {light.room_name ?? '未分组'}
                        {typeof light.on === 'boolean'
                          ? ` · ${light.on ? '开' : '关'}（最后已知状态）`
                          : ' · 开关状态后端未返回'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busyId === id}
                    onClick={() =>
                      send(light, light.on ? 'turn_off' : 'turn_on')
                    }
                  >
                    {busyId === id ? '发送中……' : light.on ? '关灯' : '开灯'}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      className="mb-1 flex justify-between text-sm text-zinc-400"
                      htmlFor={`brightness-${id}`}
                    >
                      <span>亮度</span>
                      <span className="text-zinc-200">{slider.brightness}%</span>
                    </label>
                    <input
                      id={`brightness-${id}`}
                      type="range"
                      min={1}
                      max={100}
                      value={slider.brightness}
                      className="lila-range"
                      onChange={(e) =>
                        setSliders((prev) => ({
                          ...prev,
                          [id]: { ...slider, brightness: Number(e.target.value) },
                        }))
                      }
                      onMouseUp={() =>
                        send(light, 'set_brightness', { brightness: slider.brightness })
                      }
                      onTouchEnd={() =>
                        send(light, 'set_brightness', { brightness: slider.brightness })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 flex justify-between text-sm text-zinc-400"
                      htmlFor={`colortemp-${id}`}
                    >
                      <span>色温</span>
                      <span className="text-zinc-200">{slider.colorTemp}K</span>
                    </label>
                    <input
                      id={`colortemp-${id}`}
                      type="range"
                      min={2000}
                      max={6500}
                      step={100}
                      value={slider.colorTemp}
                      className="lila-range"
                      onChange={(e) =>
                        setSliders((prev) => ({
                          ...prev,
                          [id]: { ...slider, colorTemp: Number(e.target.value) },
                        }))
                      }
                      onMouseUp={() =>
                        send(light, 'set_color_temp', { color_temp: slider.colorTemp })
                      }
                      onTouchEnd={() =>
                        send(light, 'set_color_temp', { color_temp: slider.colorTemp })
                      }
                    />
                  </div>
                </div>

                {note ? (
                  <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                    <StatusBadge status={note.status} />
                    <span className="text-zinc-300">
                      {note.status === 'ERROR'
                        ? '发送失败'
                        : commandStatusText(note.status)}
                    </span>
                    {note.detail ? (
                      <span className="break-words text-xs text-zinc-400">{note.detail}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-zinc-500">
                    亮度 / 色温滑杆松开后发送命令；结果以返回状态为准。
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
