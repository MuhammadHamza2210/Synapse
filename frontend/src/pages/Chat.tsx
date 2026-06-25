import { Boxes } from 'lucide-react'
import { PageMotion } from '@/components/layout/PageMotion'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { MindPalace } from '@/features/graph/MindPalace'
import { useGraph } from '@/hooks/useGraph'

export default function Chat() {
  const { data: graph } = useGraph()

  return (
    <PageMotion>
      <div className="grid h-[calc(100vh-9rem)] gap-4 lg:grid-cols-2">
        <div className="glass-strong flex flex-col p-4">
          <ChatPanel />
        </div>

        <div className="relative hidden overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40 lg:block">
          {graph && graph.nodes.length > 0 ? (
            <MindPalace data={graph} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-center text-sm text-slate-500">
              <div>
                <Boxes className="mx-auto mb-2 text-slate-600" size={32} />
                Add documents to see the palace react to your questions.
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 glass px-3 py-1.5 text-[11px] text-slate-300">
            Cited concepts pulse here in real time ✨
          </div>
        </div>
      </div>
    </PageMotion>
  )
}
