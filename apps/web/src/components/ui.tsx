import type { ReactNode } from 'react'

/** 页面顶栏：标题 + 说明 + 右侧操作区。 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** 空状态：只说明没有数据，不编造内容。 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-14 text-center">
      <p className="text-xl font-bold text-white">{title}</p>
      {description ? (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

/** 错误横幅：如实展示后端/网络错误原文，不展示假数据。 */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-400/10 px-5 py-4">
      <p className="font-semibold text-red-300">加载失败</p>
      <p className="mt-1 break-words text-sm leading-relaxed text-red-200/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-400/40 bg-red-400/15 px-3 py-1.5 text-sm text-red-200 hover:bg-red-400/25"
        >
          重试
        </button>
      ) : null}
    </div>
  )
}

export function Loading({ text = '正在加载……' }: { text?: string }) {
  return (
    <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-6 text-sm text-zinc-400">
      {text}
    </p>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">{children}</div>
  )
}

export const btnPrimary =
  'rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40'
export const btnSecondary =
  'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40'
export const btnDanger =
  'rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40'
export const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none'
export const labelClass = 'mb-1 block text-sm text-zinc-400'

/** 指令状态徽章：UNKNOWN / TIMEOUT 绝不显示成“已执行”。 */
export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const cls =
    s === 'CONFIRMED'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
      : s === 'FAILED'
        ? 'border-red-400/40 bg-red-400/10 text-red-300'
        : s === 'ACCEPTED' || s === 'EXECUTING'
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
          : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>{status}</span>
  )
}
