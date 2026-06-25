import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Lock, Mail, Sparkles, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/authStore'

type Tab = 'login' | 'register'

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, register, loading, error } = useAuthStore()

  async function submit() {
    const ok = tab === 'login' ? await login(email, password) : await register(email, password)
    if (ok) {
      setEmail('')
      setPassword('')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong w-[26rem] max-w-[92vw] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-neon-purple to-neon-cyan">
                  <Sparkles size={16} className="text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {tab === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 inline-flex w-full rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    'flex-1 rounded-lg px-3 py-1.5 capitalize transition-colors',
                    tab === t ? 'bg-white/10 text-white' : 'text-slate-400',
                  )}
                >
                  {t === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Field icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </Field>
              <Field icon={Lock}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Password (min 6 characters)"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </Field>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                onClick={submit}
                disabled={loading || !email.trim() || password.length < 6}
                className="btn-primary w-full"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : tab === 'login' ? (
                  'Sign in'
                ) : (
                  'Create account'
                )}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                Signing in syncs your learning-path progress across devices.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 focus-within:border-neon-cyan/50">
      <Icon size={15} className="shrink-0 text-slate-400" />
      {children}
    </div>
  )
}
