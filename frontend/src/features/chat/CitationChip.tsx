import { useState } from 'react'
import { FileText } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Citation } from '@/types'

export function CitationChip({ c }: { c: Citation }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-1.5 py-0.5 text-[11px] font-medium text-neon-cyan">
        <FileText size={11} />[{c.marker}] {c.document_title}
        {c.page ? ` · p.${c.page}` : ''}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 z-30 mb-2 block w-72 rounded-lg border border-white/10 bg-ink-700/95 p-3 text-xs leading-relaxed text-slate-300 shadow-glow backdrop-blur"
          >
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-slate-500">
              relevance {(c.score * 100).toFixed(0)}%
            </span>
            “{c.snippet}”
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
