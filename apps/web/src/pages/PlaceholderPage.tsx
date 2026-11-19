interface Props {
  name: string
}

/** v0.1 尚未开始的模块占位页：只说明未接入，不展示任何假内容。 */
export default function PlaceholderPage({ name }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-16 text-center">
      <p className="text-2xl font-bold text-white sm:text-3xl">{name}</p>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
        该模块尚未接入。设备接入与功能开发完成后，这里才会出现真实内容。
      </p>
      <span className="mt-6 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-3 py-1 text-xs text-zinc-400">
        未接入
      </span>
    </div>
  )
}
