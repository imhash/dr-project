import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useT } from '../context/ThemeContext'

const STATUS_CONFIG = {
  'Executing':       { color: 'text-cyan-500',   dot: 'bg-cyan-500',   pill: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600',     chart: '#06b6d4' },
  'Ended OK':        { color: 'text-green-500',  dot: 'bg-green-500',  pill: 'bg-green-500/10 border-green-500/30 text-green-600',   chart: '#22c55e' },
  'Ended Not OK':    { color: 'text-red-500',    dot: 'bg-red-500',    pill: 'bg-red-500/10 border-red-500/30 text-red-600',         chart: '#ef4444' },
  'Wait Condition':  { color: 'text-amber-500',  dot: 'bg-amber-500',  pill: 'bg-amber-500/10 border-amber-500/30 text-amber-600',   chart: '#f59e0b' },
  'Wait User':       { color: 'text-amber-500',  dot: 'bg-amber-500',  pill: 'bg-amber-500/10 border-amber-500/30 text-amber-600',   chart: '#d97706' },
  'Wait Host':       { color: 'text-orange-500', dot: 'bg-orange-500', pill: 'bg-orange-500/10 border-orange-500/30 text-orange-600', chart: '#f97316' },
  'Wait Resource':   { color: 'text-orange-500', dot: 'bg-orange-500', pill: 'bg-orange-500/10 border-orange-500/30 text-orange-600', chart: '#ea580c' },
  'Waiting':         { color: 'text-amber-500',  dot: 'bg-amber-500',  pill: 'bg-amber-500/10 border-amber-500/30 text-amber-600',   chart: '#b45309' },
  'Hold':            { color: 'text-slate-500',  dot: 'bg-slate-400',  pill: 'bg-slate-500/10 border-slate-500/30 text-slate-500',   chart: '#94a3b8' },
  'Aborted':         { color: 'text-purple-500', dot: 'bg-purple-500', pill: 'bg-purple-500/10 border-purple-500/30 text-purple-600', chart: '#a855f7' },
}

const FILTERS = ['All', 'Executing', 'Ended Not OK', 'Wait Condition', 'Wait User', 'Wait Host', 'Wait Resource', 'Ended OK', 'Hold', 'Aborted']

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function CustomTooltip({ active, payload }) {
  const t = useT()
  if (!active || !payload?.length) return null
  return (
    <div className={`${t.card} border ${t.border} rounded-lg px-3 py-2 text-xs shadow-xl`}>
      <p className={`${t.text} font-medium`}>{payload[0].name}</p>
      <p className={t.textSub}>{payload[0].value} jobs</p>
    </div>
  )
}

export default function JobExecutionStatus({ jobs }) {
  const t = useT()
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.status === filter)

  const statusCounts = Object.keys(STATUS_CONFIG).map((s) => ({
    name: s,
    value: jobs.filter((j) => j.status === s).length,
    color: STATUS_CONFIG[s].chart,
  })).filter((d) => d.value > 0)

  return (
    <div className={`${t.card} border ${t.border} rounded-xl p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div>
        <h2 className={`text-sm font-semibold ${t.text}`}>Job Execution Status</h2>
        <p className={`text-xs ${t.textFaint} mt-0.5`}>DR environment — {jobs.length} jobs</p>
      </div>

      {/* Donut chart + legend */}
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusCounts}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={52}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {statusCounts.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          {statusCounts.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className={t.textMuted}>{s.name}</span>
              <span className={`${t.text} font-medium ml-auto pl-3`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              filter === f
                ? 'bg-blue-600 border-blue-500 text-white'
                : `bg-transparent border-[var(--border)] ${t.textMuted} hover:border-[var(--borderDash)] hover:${t.textSub}`
            }`}
          >
            {f}
            {f !== 'All' && (
              <span className="ml-1 opacity-60">
                {jobs.filter((j) => j.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Job table */}
      <div className={`overflow-auto max-h-64 rounded-lg border ${t.border}`}>
        <table className="w-full text-xs min-w-[480px]">
          <thead className={`sticky top-0 ${t.tableHead} ${t.textMuted}`}>
            <tr>
              <th className="text-left px-3 py-2 font-medium">Job Name</th>
              <th className="text-left px-3 py-2 font-medium">Folder</th>
              <th className="text-left px-3 py-2 font-medium">Server</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Start</th>
              <th className="text-left px-3 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((job) => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG['Hold']
              return (
                <tr key={job.id} className="hover:bg-[var(--cardHover)] transition-colors">
                  <td className={`px-3 py-2 font-mono ${t.textSub} whitespace-nowrap`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${job.status === 'Executing' ? 'animate-pulse' : ''}`} />
                      {job.name}
                    </div>
                  </td>
                  <td className={`px-3 py-2 ${t.textMuted}`}>{job.folder}</td>
                  <td className={`px-3 py-2 ${t.textMuted} font-mono`}>{job.server}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${cfg.pill}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${t.textMuted} font-mono`}>{formatTime(job.startTime)}</td>
                  <td className={`px-3 py-2 ${t.textMuted} font-mono`}>{job.duration ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
