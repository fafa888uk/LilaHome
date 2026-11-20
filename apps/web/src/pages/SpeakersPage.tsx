import { useEffect, useState } from 'react'
import { commandStatusText, listSpeakers, sendDeviceCommand } from '../lib/api'
import type { Speaker } from '../lib/api'
import {
  btnPrimary,
  btnSecondary,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  Loading,
  PageHeader,
  StatusBadge,
} from '../components/ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; speakers: Speaker[] }

function deviceIdOf(s: Speaker): string {
  return s.device_id ?? s.id
}

export default function SpeakersPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [ttsText, setTtsText] = useState('')
  const [ttsTarget, setTtsTarget] = useState('')
  const [ttsNote, setTtsNote] = useState<{ status: string; detail: string | null } | null>(null)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const load = () => {
    setState({ kind: 'loading' })
    listSpeakers()
      .then((speakers) => {
        setState({ kind: 'ok', speakers })
        if (speakers.length > 0) setTtsTarget(deviceIdOf(speakers[0]))
      })
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const sendTts = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ttsTarget || ttsText.trim().length === 0) return
    setTtsError(null)
    setTtsNote(null)
    setSending(true)
    sendDeviceCommand(ttsTarget, { action: 'tts', params: { text: ttsText.trim() } })
      .then((result) => {
        setTtsNote({ status: result.status, detail: result.detail ?? null })
      })
      .catch((err: unknown) => {
        setTtsError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setSending(false))
  }

  const speakers = state.kind === 'ok' ? state.speakers : []

  return (
    <div>
      <PageHeader
        title="音响影音中心"
        description="音箱列表来自 GET /api/v1/speakers。TTS 经 POST /api/v1/devices/{id}/commands（action “tts”）发送，结果以返回状态为准；HA 未接入时为 UNKNOWN。"
        actions={
          <button type="button" className={btnSecondary} onClick={load}>
            刷新
          </button>
        }
      />

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && speakers.length === 0 && (
        <EmptyState
          title="暂无音响设备"
          description="后端 GET /api/v1/speakers 未返回任何音箱。音箱接入后，这里才会出现播放状态与 TTS 入口。"
        />
      )}

      {state.kind === 'ok' && speakers.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {speakers.map((s) => (
            <li
              key={deviceIdOf(s)}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
            >
              <p className="font-semibold text-white">{s.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                播放状态：
                {typeof s.playing === 'boolean'
                  ? s.playing
                    ? '播放中'
                    : '已暂停'
                  : '未接入'}
                {s.current_track ? ` · 正在播放：${s.current_track}` : ''}
                {typeof s.volume === 'number' ? ` · 音量 ${s.volume}%` : ''}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {s.room_name ?? '未分组'} · 未接入时不显示播放进度与曲目。
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-5">
        <h2 className="text-base font-semibold text-white">TTS 播报</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          {speakers.length === 0
            ? '当前没有可用音箱，TTS 按钮已禁用——音箱接入后可用。'
            : '输入文字后发送到选定的音箱播报。'}
        </p>
        <form onSubmit={sendTts} className="mt-4 space-y-3">
          <div>
            <label className={labelClass} htmlFor="tts-target">目标音箱</label>
            <select
              id="tts-target"
              className={inputClass}
              value={ttsTarget}
              disabled={speakers.length === 0}
              onChange={(e) => setTtsTarget(e.target.value)}
            >
              {speakers.map((s) => (
                <option key={deviceIdOf(s)} value={deviceIdOf(s)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="tts-text">播报文字</label>
            <textarea
              id="tts-text"
              className={inputClass}
              rows={3}
              value={ttsText}
              disabled={speakers.length === 0}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="例如：晚饭做好了，请到餐厅用餐"
            />
          </div>
          <button
            type="submit"
            className={btnPrimary}
            disabled={speakers.length === 0 || ttsText.trim().length === 0 || sending}
          >
            {sending ? '正在发送……' : '发送 TTS'}
          </button>
        </form>
        {ttsError ? (
          <p className="mt-3 break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {ttsError}
          </p>
        ) : null}
        {ttsNote ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm">
            <StatusBadge status={ttsNote.status} />
            <span className="text-zinc-300">{commandStatusText(ttsNote.status)}</span>
            {ttsNote.detail ? (
              <span className="break-words text-xs text-zinc-400">{ttsNote.detail}</span>
            ) : null}
          </p>
        ) : null}
      </section>
    </div>
  )
}
