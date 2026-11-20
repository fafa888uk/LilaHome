import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Flame,
  Inbox,
  Lightbulb,
  Monitor,
  Package,
  Router,
  Speaker,
  Thermometer,
  TriangleAlert,
} from 'lucide-react'
import type { Device } from '../lib/api'
import { deviceTypeLabel } from '../lib/deviceTypes'

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
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
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
    <div className="lila-card mt-6 flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="lila-icon-tile h-14 w-14 bg-violet-500/15 text-violet-300">
        <Inbox className="h-7 w-7" />
      </span>
      <p className="mt-4 text-xl font-bold text-white">{title}</p>
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
    <div className="mt-6 rounded-[22px] border border-red-400/40 bg-red-400/10 px-5 py-4">
      <p className="flex items-center gap-2 font-semibold text-red-300">
        <TriangleAlert className="h-4 w-4" />
        加载失败
      </p>
      <p className="mt-1 break-words text-sm leading-relaxed text-red-200/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl border border-red-400/40 bg-red-400/15 px-3 py-1.5 text-sm text-red-200 transition-colors hover:bg-red-400/25 active:scale-[0.98]"
        >
          重试
        </button>
      ) : null}
    </div>
  )
}

/** 骨架屏：加载时占位，不展示假数据。 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`lila-skeleton ${className}`} />
}

export function Loading({ text = '正在加载……' }: { text?: string }) {
  return (
    <div className="mt-6 space-y-3" role="status" aria-live="polite">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-2/3" />
      <p className="pt-1 text-sm text-zinc-500">{text}</p>
    </div>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="lila-card px-5 py-4">{children}</div>
}

export const btnPrimary =
  'rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgb(139_92_246/0.35)] transition hover:from-violet-400 hover:to-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
export const btnSecondary =
  'rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-zinc-200 backdrop-blur transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
export const btnDanger =
  'rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-400/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
export const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30'
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

/** 分组标题（房间分组用）：图标 + 名称 + 台数。 */
export function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: ReactNode
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-violet-300">{icon}</span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {typeof count === 'number' ? (
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
          {count} 台
        </span>
      ) : null}
    </div>
  )
}

/* ---------- 设备图标与卡片（Mushroom 风格） ---------- */

const TYPE_ICON: Record<string, { icon: typeof Lightbulb; tile: string }> = {
  light: { icon: Lightbulb, tile: 'bg-amber-400/12 text-amber-300' },
  climate: { icon: Thermometer, tile: 'bg-sky-400/12 text-sky-300' },
  water_heater: { icon: Flame, tile: 'bg-orange-400/12 text-orange-300' },
  speaker: { icon: Speaker, tile: 'bg-violet-400/15 text-violet-300' },
  router: { icon: Router, tile: 'bg-emerald-400/12 text-emerald-300' },
  other: { icon: Package, tile: 'bg-zinc-400/12 text-zinc-300' },
}

/** 设备类型 → 图标；电脑用显示器图标。 */
export function DeviceIcon({
  device,
  className = 'h-6 w-6',
}: {
  device: Device
  className?: string
}) {
  if (isComputer(device)) return <Monitor className={className} />
  const entry = TYPE_ICON[device.type ?? 'other'] ?? TYPE_ICON.other
  const Icon = entry.icon
  return <Icon className={className} />
}

/** 设备类型 → 图标底色（HomeKit 风格淡色方块）。 */
export function deviceIconTileClass(device: Device): string {
  if (isComputer(device)) return 'bg-violet-400/15 text-violet-300'
  return (TYPE_ICON[device.type ?? 'other'] ?? TYPE_ICON.other).tile
}

/** 是否为那台 Windows 台式电脑（按登记数据判断，不写死 ID）。 */
export function isComputer(device: Device): boolean {
  if (device.name === '电脑') return true
  return (device.model ?? '').includes('Windows')
}

/**
 * 设备卡片（Mushroom 风格）：大图标 + 名称 + 状态 + 元数据。
 * 接入状态来自后端；HA 未接入前全部设备显示“未接入”。
 * control 插槽只在设备真实支持就地控制时才传——当前全部未接入，
 * 所以不传，不展示任何假开关。
 */
export function DeviceTile({
  device,
  roomName,
  to,
  control,
}: {
  device: Device
  roomName: string
  to: string
  control?: ReactNode
}) {
  return (
    <Link to={to} className="block">
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="lila-card lila-card-interactive px-4 py-4"
      >
      <span className="flex items-start justify-between gap-2">
        <span className={`lila-icon-tile h-13 w-13 p-3 ${deviceIconTileClass(device)}`}>
          <DeviceIcon device={device} />
        </span>
        <span className="shrink-0 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs text-zinc-400">
          未接入
        </span>
      </span>
      <span className="mt-3 block truncate text-base font-semibold text-white">
        {device.name}
      </span>
      <span className="mt-1 block truncate text-sm leading-relaxed text-zinc-400">
        {[device.brand, device.model].filter(Boolean).join(' ') || '品牌 / 型号未填写'}
        {' · '}
        {deviceTypeLabel(device.type)}
        {' · '}
        {roomName}
      </span>
      {device.integration ? (
        <span className="mt-1 block text-xs text-zinc-500">集成：{device.integration}</span>
      ) : null}
      {control ? <span className="mt-3 block">{control}</span> : null}
      </motion.div>
    </Link>
  )
}

/**
 * 电脑状态卡（全宽）：只显示状态，不做开关控制，绝不冒充可控制设备。
 * 电脑是已登记的设备，不是智能家居受控设备；状态来自后端登记数据。
 */
export function ComputerCard({ device }: { device: Device }) {
  return (
    <div className="lila-card col-span-full flex items-center gap-4 px-5 py-4">
      <span className="lila-icon-tile h-13 w-13 bg-violet-400/15 p-3 text-violet-300">
        <Monitor className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-white">
          {device.name}
        </span>
        <span className="mt-0.5 block truncate text-sm text-zinc-400">
          {[device.brand, device.model].filter(Boolean).join(' ') || 'Windows 台式（自配组装）'}
          {' · '}
          {deviceTypeLabel(device.type)}
        </span>
        <span className="mt-1 block text-xs text-zinc-500">
          仅查看状态 · 不可控制
        </span>
      </span>
      <span className="shrink-0 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs text-zinc-400">
        未接入
      </span>
    </div>
  )
}
