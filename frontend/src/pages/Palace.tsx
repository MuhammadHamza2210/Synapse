import { Link } from 'react-router-dom'
import { Boxes, Info, MessageSquare } from 'lucide-react'
import { PageMotion } from '@/components/layout/PageMotion'
import { MindPalace } from '@/features/graph/MindPalace'
import { useGraph } from '@/hooks/useGraph'
import { useStore } from '@/store/useStore'
import { Spinner } from '@/components/ui/Spinner'

export default function Palace() {
  const { data: graph, isLoading } = useGraph()
  const activeId = useStore((s) => s.activeConceptId)
  const active = graph?.nodes.find((n) => n.id === activeId)

  return (
    <PageMotion>
      <div className="relative h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40">
        {isLoading && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {graph && graph.nodes.length > 0 ? (
          <MindPalace data={graph} />
        ) : (
          !isLoading && (
            <div className="absolute inset-0 grid place-items-center text-center text-slate-400">
              <div>
                <Boxes className="mx-auto mb-3 text-slate-600" size={40} />
                <p>Your Mind Palace is empty.</p>
                <Link to="/library" className="text-neon-cyan hover:underline">
                  Add a document
                </Link>{' '}
                to populate it.
              </div>
            </div>
          )
        )}

        {/* HUD overlays */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
          <div className="glass px-3 py-2 text-xs text-slate-300">
            <span className="font-semibold text-white">{graph?.stats.concepts ?? 0}</span> concepts ·{' '}
            <span className="font-semibold text-white">{graph?.stats.edges ?? 0}</span> links
          </div>
          {active && (
            <div className="glass max-w-xs px-3 py-2 text-xs">
              <p className="font-semibold text-neon-cyan">{active.label}</p>
              <p className="text-slate-400">
                {active.mentions} mentions across {active.doc_count} doc(s)
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[11px] text-slate-500">
          <Info size={13} /> Drag to orbit · scroll to zoom · hover a node
        </div>

        <Link
          to="/chat"
          className="btn-primary pointer-events-auto absolute bottom-4 right-4"
        >
          <MessageSquare size={15} /> Ask & watch it light up
        </Link>
      </div>
    </PageMotion>
  )
}
