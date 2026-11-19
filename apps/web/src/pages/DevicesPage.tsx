import { Link } from 'react-router-dom'

export default function DevicesPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-16 text-center">
      <p className="text-2xl font-bold text-white sm:text-3xl">
        暂无设备，请先完成设备清点
      </p>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
        设备清点完成后才会在这里出现设备。在此之前，本页不展示任何设备、状态或数值。
      </p>
      <Link
        to="/status"
        className="mt-8 rounded-lg border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/25"
      >
        查看系统状态
      </Link>
    </div>
  )
}
