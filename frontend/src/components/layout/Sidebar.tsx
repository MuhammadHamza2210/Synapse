import { NavLink } from 'react-router-dom'
import {
  Boxes,
  GraduationCap,
  LayoutDashboard,
  Library,
  MapPin,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import { useHealth } from '@/hooks/useGraph'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/palace', label: 'Mind Palace', icon: Boxes, end: false },
  { to: '/path', label: 'Learning Path', icon: MapPin, end: false },
  { to: '/study', label: 'Study', icon: GraduationCap, end: false },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/chat', label: 'AI Tutor', icon: MessageSquare, end: false },
]

export function Sidebar() {
  const { data: health } = useHealth()
  const llmMode = health?.capabilities.llm ?? '—'
  const online = llmMode === 'ollama' || llmMode === 'claude'
  const engineLabel = llmMode === 'ollama' ? 'Ollama' : llmMode === 'claude' ? 'Claude' : 'Offline'

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-ink-800/40 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-purple to-neon-cyan shadow-glow">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none gradient-text">Synapse</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Mind, mapped</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/10 text-white shadow-glow'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={clsx('transition-colors', isActive && 'text-neon-cyan')}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">AI engine</span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 font-medium',
              online ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-amber-400/15 text-amber-300',
            )}
          >
            {engineLabel}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-slate-500">
          <span>Embeddings</span>
          <span className="font-mono">{health?.capabilities.embeddings ?? '—'}</span>
        </div>
      </div>
    </aside>
  )
}
