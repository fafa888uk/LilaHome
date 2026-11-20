import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import ClimatePage from './pages/ClimatePage'
import DeviceDetailPage from './pages/DeviceDetailPage'
import DevicesPage from './pages/DevicesPage'
import HomePage from './pages/HomePage'
import LightsPage from './pages/LightsPage'
import NetworkPage from './pages/NetworkPage'
import RoomsPage from './pages/RoomsPage'
import SceneDetailPage from './pages/SceneDetailPage'
import ScenesPage from './pages/ScenesPage'
import SettingsPage from './pages/SettingsPage'
import SpeakersPage from './pages/SpeakersPage'
import StatusPage from './pages/StatusPage'

const NAV = [
  { to: '/', label: '首页总览' },
  { to: '/devices', label: '设备' },
  { to: '/rooms', label: '房间' },
  { to: '/lights', label: '灯光' },
  { to: '/climate', label: '空调' },
  { to: '/speakers', label: '音响' },
  { to: '/network', label: '网络' },
  { to: '/scenes', label: '场景' },
  { to: '/settings', label: '设置' },
  { to: '/status', label: '系统状态' },
]

function navClass(active: boolean) {
  return active
    ? 'rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm text-violet-200'
    : 'rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b0a12] text-zinc-200">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0b0a12]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link to="/" className="text-lg font-bold tracking-tight text-white">
              Lila Home
            </Link>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              紫序智能家居控制中心
            </span>
            <nav className="ml-auto flex flex-wrap items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:id" element={<DeviceDetailPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/lights" element={<LightsPage />} />
            <Route path="/climate" element={<ClimatePage />} />
            <Route path="/speakers" element={<SpeakersPage />} />
            {/* 旧路径 /media 保留重定向到 /speakers */}
            <Route path="/media" element={<Navigate to="/speakers" replace />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/scenes" element={<ScenesPage />} />
            <Route path="/scenes/:id" element={<SceneDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2">
          <p className="border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
            Lila Home · 访问控制：Tailscale（登录模块：PLANNED，当前不做应用内登录，全部请求按
            Owner 放行）· 所有状态来自后端实时返回；HA / 集成未接入时如实显示“未接入”，不展示假数据。
          </p>
        </footer>
      </div>
    </BrowserRouter>
  )
}
