import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Boxes, FileText, GitBranch, Layers, Sparkles } from 'lucide-react'
import { PageMotion } from '@/components/layout/PageMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatCard } from '@/components/ui/StatCard'
import { useDocuments } from '@/hooks/useDocuments'
import { useGraph } from '@/hooks/useGraph'

const BAR_COLORS = ['#a855f7', '#7c5cff', '#22d3ee', '#3b82f6', '#f472b6', '#34d399']

export default function Dashboard() {
  const { data: docs } = useDocuments()
  const { data: graph } = useGraph()

  const chunkTotal = docs?.reduce((s, d) => s + d.chunk_count, 0) ?? 0
  const topConcepts =
    graph?.nodes
      .slice()
      .sort((a, b) => b.salience - a.salience)
      .slice(0, 8)
      .map((n) => ({ name: n.label, value: Math.round(n.salience) })) ?? []

  return (
    <PageMotion>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Documents" value={docs?.length ?? 0} icon={FileText} accent="purple" delay={0} />
        <StatCard label="Concepts" value={graph?.stats.concepts ?? 0} icon={Boxes} accent="cyan" delay={0.05} hint="nodes in your palace" />
        <StatCard label="Connections" value={graph?.stats.edges ?? 0} icon={GitBranch} accent="blue" delay={0.1} hint="concept links" />
        <StatCard label="Indexed chunks" value={chunkTotal} icon={Layers} accent="pink" delay={0.15} hint="searchable passages" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2" delay={0.2}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Most salient concepts</h2>
              <p className="text-xs text-slate-400">What your knowledge base talks about most</p>
            </div>
            <Link to="/palace" className="btn-ghost text-xs">
              <Boxes size={14} /> Open Mind Palace
            </Link>
          </div>
          {topConcepts.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topConcepts} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: 'rgba(15,17,36,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {topConcepts.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyHint />
          )}
        </GlassCard>

        <GlassCard delay={0.25}>
          <h2 className="mb-3 font-semibold text-white">Recent documents</h2>
          <div className="space-y-2">
            {docs?.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <FileText size={15} className="shrink-0 text-neon-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">{d.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {d.chunk_count} chunks · {d.source_type}
                  </p>
                </div>
              </div>
            ))}
            {!docs?.length && <EmptyHint />}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center" delay={0.3}>
        <div>
          <h2 className="font-semibold text-white">Ask your knowledge anything</h2>
          <p className="text-sm text-slate-400">
            The tutor answers only from your documents — and the matching nodes light up in 3D.
          </p>
        </div>
        <Link to="/chat" className="btn-primary">
          <Sparkles size={15} /> Open AI Tutor
        </Link>
      </GlassCard>
    </PageMotion>
  )
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      Nothing here yet —{' '}
      <Link to="/library" className="text-neon-cyan hover:underline">
        add a document
      </Link>{' '}
      or run <code className="font-mono text-slate-400">python seed.py</code>.
    </div>
  )
}
