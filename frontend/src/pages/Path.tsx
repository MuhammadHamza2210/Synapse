import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Cloud, GraduationCap, MapPin, Monitor, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { PageMotion } from '@/components/layout/PageMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { useLearningPath } from '@/hooks/useStudy'
import { useProgress } from '@/hooks/useProgress'
import type { PathStep } from '@/types'

const stepKey = (clusterId: number, s: PathStep) => `${clusterId}:${s.label}`

export default function Path() {
  const { data, isLoading } = useLearningPath()
  const navigate = useNavigate()
  const { done, toggle, reset, isAuthed } = useProgress()

  const allKeys = useMemo(
    () =>
      data?.modules.flatMap((m) => m.steps.map((s) => stepKey(m.cluster_id, s))) ?? [],
    [data],
  )
  const completed = allKeys.filter((k) => done.has(k)).length
  const pct = allKeys.length ? Math.round((completed / allKeys.length) * 100) : 0

  if (isLoading) {
    return (
      <PageMotion>
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      </PageMotion>
    )
  }

  if (!data?.modules.length) {
    return (
      <PageMotion>
        <GlassCard hover={false} className="flex flex-col items-center gap-3 py-20 text-center">
          <MapPin size={40} className="text-slate-600" />
          <p className="text-slate-300">No learning path yet.</p>
          <p className="text-sm text-slate-500">
            Add documents in the{' '}
            <Link to="/library" className="text-neon-cyan hover:underline">
              Library
            </Link>{' '}
            to generate a guided roadmap.
          </p>
        </GlassCard>
      </PageMotion>
    )
  }

  return (
    <PageMotion>
      {/* progress header */}
      <GlassCard hover={false} className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <MapPin size={18} className="text-neon-cyan" /> Your learning path
            </h2>
            <p className="text-sm text-slate-400">
              {data.total_modules} modules · {data.total_steps} concepts · ordered foundations-first
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-semibold text-white">{pct}%</p>
              <p className="text-xs text-slate-500">
                {completed}/{allKeys.length} done
              </p>
            </div>
            <button onClick={reset} className="btn-ghost text-xs" title="Reset progress">
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-cyan"
            animate={{ width: `${pct}%` }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </GlassCard>

      {/* timeline */}
      <div className="relative space-y-4 pl-4">
        <div className="absolute bottom-4 left-[1.05rem] top-2 w-px bg-gradient-to-b from-neon-purple/50 via-white/10 to-transparent" />
        {data.modules.map((m, i) => {
          const moduleDone = m.steps.every((s) => done.has(stepKey(m.cluster_id, s)))
          return (
            <motion.div
              key={m.cluster_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative pl-10"
            >
              <span
                className={clsx(
                  'absolute left-0 top-3 grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold',
                  moduleDone
                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                    : 'border-white/15 bg-ink-700 text-white shadow-glow',
                )}
              >
                {moduleDone ? <Check size={16} /> : m.order}
              </span>

              <GlassCard hover={false}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{m.title}</h3>
                    <p className="text-xs text-slate-400">{m.rationale}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/study?cluster=${m.cluster_id}`)}
                    className="btn-ghost text-xs"
                  >
                    <GraduationCap size={14} /> Study this topic
                  </button>
                </div>

                <div className="space-y-1.5">
                  {m.steps.map((s) => {
                    const key = stepKey(m.cluster_id, s)
                    const isDone = done.has(key)
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(key)}
                        className={clsx(
                          'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-all',
                          isDone
                            ? 'border-emerald-400/30 bg-emerald-400/5'
                            : 'border-white/5 bg-white/5 hover:bg-white/10',
                        )}
                      >
                        <span
                          className={clsx(
                            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                            isDone
                              ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-300'
                              : 'border-white/20',
                          )}
                        >
                          {isDone && <Check size={12} />}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={clsx(
                              'text-sm font-medium',
                              isDone ? 'text-slate-400 line-through' : 'text-slate-100',
                            )}
                          >
                            {s.label}
                          </span>
                          {s.hint && (
                            <span className="block truncate text-[11px] text-slate-500">
                              {s.hint}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>

      <GlassCard className="mt-5 flex items-center justify-between" delay={0.1}>
        <p className="flex items-center gap-1.5 text-sm text-slate-400">
          {isAuthed ? (
            <>
              <Cloud size={14} className="text-neon-cyan" />
              Synced to your account — your progress follows you across devices.
            </>
          ) : (
            <>
              <Monitor size={14} className="text-slate-400" />
              Saved on this device. Sign in to sync progress across devices.
            </>
          )}
        </p>
        <Link to="/palace" className="btn-ghost text-xs">
          View in 3D
        </Link>
      </GlassCard>
    </PageMotion>
  )
}
