import { Link } from 'react-router-dom'

type ModuleStatus = '开发中' | '未接入'

interface ModuleCard {
  name: string
  path: string
  description: string
  status: ModuleStatus
}

const MODULES: ModuleCard[] = [
  {
    name: '首页总览',
    path: '/',
    description: '全屋状态一览（v0.1 仅展示平台本身的状态）。',
    status: '开发中',
  },
  {
    name: '设备管理中心',
    path: '/devices',
    description: '设备清点完成后，设备会在这里出现。',
    status: '开发中',
  },
  {
    name: '房间管理中心',
    path: '/rooms',
    description: '房间划分与设备归属，设备清点后开始搭建。',
    status: '未接入',
  },
  {
    name: '灯光控制中心',
    path: '/lights',
    description: '智能灯光控制，需灯具接入后可用。',
    status: '未接入',
  },
  {
    name: '空调及热水器控制',
    path: '/climate',
    description: '空调与热水器控制，需设备接入后可用。',
    status: '未接入',
  },
  {
    name: '音响影音中心',
    path: '/media',
    description: '智能音响与影音播放，需设备接入后可用。',
    status: '未接入',
  },
  {
    name: '家庭网络管理中心',
    path: '/network',
    description: '家庭路由器与网络状态，需网络设备接入后可用。',
    status: '未接入',
  },
  {
    name: '自动化场景中心',
    path: '/scenes',
    description: '自动化规则与场景，需设备接入后可用。',
    status: '未接入',
  },
  {
    name: '系统安全与设置中心',
    path: '/status',
    description: '系统状态检查与平台设置。',
    status: '开发中',
  },
]

function statusBadge(status: ModuleStatus) {
  return status === '开发中'
    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
    : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
}

export default function HomePage() {
  return (
    <div>
      <section className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-5 py-6 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Lila Home
        </h1>
        <p className="mt-2 text-lg text-violet-200">紫序智能家居控制中心</p>
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm leading-relaxed text-amber-200">
          v0.1 基础平台：设备尚未接入，状态全部以真实检查为准。
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-200">九大模块</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-violet-400/50 hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{m.name}</h3>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusBadge(m.status)}`}
                >
                  {m.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {m.description}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          本页不展示任何设备、数值或状态——设备尚未接入，接入前不显示假数据。
        </p>
      </section>
    </div>
  )
}
