import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  accent?: 'purple' | 'cyan' | 'blue' | 'pink'
  delay?: number
  hint?: string
}

const ACCENTS: Record<string, string> = {
  purple: 'from-neon-purple/30 text-neon-purple',
  cyan: 'from-neon-cyan/30 text-neon-cyan',
  blue: 'from-neon-blue/30 text-neon-blue',
  pink: 'from-neon-pink/30 text-neon-pink',
}

export function StatCard({ label, value, icon: Icon, accent = 'purple', delay = 0, hint }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass relative overflow-hidden p-5"
    >
      <div className={clsx('absolute inset-0 bg-gradient-to-br to-transparent opacity-40', ACCENTS[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={clsx('rounded-xl bg-white/5 p-2.5', ACCENTS[accent].split(' ')[1])}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  )
}
