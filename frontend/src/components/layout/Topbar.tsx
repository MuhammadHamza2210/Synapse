import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, LogOut, Sparkles, User } from 'lucide-react'
import { useHealth } from '@/hooks/useGraph'
import { useAuthStore } from '@/store/authStore'
import { AuthModal } from '@/components/auth/AuthModal'

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Command Dashboard', subtitle: 'Your knowledge at a glance' },
  '/palace': { title: 'Mind Palace', subtitle: 'Fly through your concept graph' },
  '/path': { title: 'Learning Path', subtitle: 'A guided, foundations-first roadmap' },
  '/study': { title: 'Study Studio', subtitle: 'Flashcards & quizzes per topic' },
  '/library': { title: 'Library', subtitle: 'Ingest and manage documents' },
  '/chat': { title: 'AI Tutor', subtitle: 'Grounded answers with citations' },
}

export function Topbar() {
  const { pathname } = useLocation()
  const meta = TITLES[pathname] ?? TITLES['/']
  const { data: health } = useHealth()
  const online = health?.status === 'ok'
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-ink-900/60 px-6 py-4 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-semibold text-white">{meta.title}</h1>
        <p className="text-sm text-slate-400">{meta.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:flex">
          <Activity size={13} className={online ? 'text-emerald-400' : 'text-rose-400'} />
          {online ? 'API online' : 'API offline'}
        </span>

        {user ? (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-cyan text-xs font-semibold text-white">
              {user.email[0].toUpperCase()}
            </span>
            <span className="hidden max-w-[10rem] truncate text-slate-300 md:inline">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="ml-1 text-slate-400 hover:text-rose-400"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="btn-ghost">
            <User size={15} /> Sign in
          </button>
        )}

        <Link to="/chat" className="btn-primary">
          <Sparkles size={15} />
          Ask Synapse
        </Link>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  )
}
