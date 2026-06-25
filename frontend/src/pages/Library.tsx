import { AlertTriangle, FileText, Loader2, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageMotion } from '@/components/layout/PageMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { UploadPanel } from '@/features/upload/UploadPanel'
import { useDeleteDocument, useDocuments } from '@/hooks/useDocuments'
import type { Document } from '@/types'

function DocMeta({ d }: { d: Document }) {
  if (d.status === 'processing') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-neon-cyan">
        <Loader2 size={11} className="animate-spin" /> Processing — chunking & embedding…
      </span>
    )
  }
  if (d.status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-rose-400">
        <AlertTriangle size={11} /> Couldn’t extract text (is it a scanned/image PDF?)
      </span>
    )
  }
  return (
    <span className="text-[11px] text-slate-500">
      {d.chunk_count} chunks · {d.char_count.toLocaleString()} chars ·{' '}
      <span className="uppercase">{d.source_type}</span>
    </span>
  )
}

export default function Library() {
  const { data: docs } = useDocuments()
  const del = useDeleteDocument()

  return (
    <PageMotion>
      <div className="grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2" hover={false}>
          <h2 className="mb-1 font-semibold text-white">Add to your knowledge base</h2>
          <p className="mb-4 text-xs text-slate-400">
            Everything you ingest is chunked, embedded, and woven into the Mind Palace.
          </p>
          <UploadPanel />
        </GlassCard>

        <GlassCard className="lg:col-span-3" hover={false}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Documents</h2>
            <span className="text-xs text-slate-500">{docs?.length ?? 0} total</span>
          </div>

          {docs?.length ? (
            <div className="space-y-2">
              {docs.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-neon-purple/40 to-neon-cyan/30">
                    {d.status === 'processing' ? (
                      <Loader2 size={16} className="animate-spin text-neon-cyan" />
                    ) : (
                      <FileText size={16} className="text-neon-cyan" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{d.title}</p>
                    <DocMeta d={d} />
                  </div>
                  <button
                    onClick={() => del.mutate(d.id)}
                    className="rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
              No documents yet. Upload one on the left, or run{' '}
              <code className="font-mono text-slate-400">python seed.py</code> in the backend.
            </div>
          )}
        </GlassCard>
      </div>
    </PageMotion>
  )
}
