import { useState, useMemo } from 'react'
import {
  Shield, ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, XCircle, Clock, Activity,
  Search, Layers, FileText, AlertTriangle,
  ArrowLeft, Terminal, Users, Info,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import ReadinessReportModal from './ReadinessReportModal'
import { mockAppMeta } from '../data/mockData'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const CRITICALITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Unknown: 4 }

const CRITICALITY_STYLE = {
  Critical: { badge: 'text-red-400 bg-red-500/10 border-red-500/30', dot: '#ef4444' },
  High:     { badge: 'text-orange-400 bg-orange-500/10 border-orange-500/30', dot: '#f97316' },
  Medium:   { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', dot: '#eab308' },
  Low:      { badge: 'text-green-400 bg-green-500/10 border-green-500/30', dot: '#22c55e' },
  Unknown:  { badge: 'text-gray-400 bg-gray-500/10 border-gray-500/30', dot: '#6b7280' },
}

const GROUP_COLORS = {
  Critical: '#ef4444', High: '#f97316', Medium: '#eab308',
  Low: '#22c55e', Unknown: '#6b7280',
}

const STATUS_ROW = {
  'Ended OK':      { icon: <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />, bg: 'border-green-500/20 bg-green-500/5',  text: 'text-green-400' },
  'Ended Not OK':  { icon: <XCircle size={14} className="text-red-400 flex-shrink-0" />,        bg: 'border-red-500/20 bg-red-500/5',      text: 'text-red-400' },
  'Aborted':       { icon: <XCircle size={14} className="text-red-400 flex-shrink-0" />,        bg: 'border-red-500/20 bg-red-500/5',      text: 'text-red-400' },
  'Executing':     { icon: <Activity size={14} className="text-cyan-400 flex-shrink-0" />,      bg: 'border-cyan-500/20 bg-cyan-500/5',    text: 'text-cyan-400' },
  'Waiting':       { icon: <Clock size={14} className="text-gray-400 flex-shrink-0" />,         bg: 'border-white/10 bg-white/3',          text: 'text-gray-400' },
  'Hold':          { icon: <Clock size={14} className="text-gray-400 flex-shrink-0" />,         bg: 'border-white/10 bg-white/3',          text: 'text-gray-400' },
}

// ─── Circular progress gauge ──────────────────────────────────────────────────
function CircularProgress({ pct = 0, size = 72, stroke = 6 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.min(Math.max(pct, 0), 100) / 100 * circ
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ width: size, height: size }} className="relative flex-shrink-0">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.21, color }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  )
}

// ─── Step row with expandable log ────────────────────────────────────────────
function StepRow({ step, t }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_ROW[step.status] || STATUS_ROW['Waiting']
  const hasLogs = step.logs?.length > 0

  return (
    <div className={`border rounded-lg overflow-hidden ${s.bg}`}>
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${hasLogs ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={() => hasLogs && setOpen(v => !v)}
      >
        {s.icon}
        <span className={`flex-1 text-xs font-mono truncate ${t.text}`}>{step.jobId || step.name}</span>
        <span className={`text-xs ${t.textMuted} hidden sm:block`}>{step.folder}</span>
        <span className={`text-xs font-medium flex-shrink-0 ${s.text}`}>{step.status}</span>
        {step.startTimeISO && (
          <span className={`text-xs ${t.textMuted} font-mono flex-shrink-0`}>{fmtTime(step.startTimeISO)}</span>
        )}
        {hasLogs && (
          open
            ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0" />
            : <Terminal size={12} className="text-gray-500 flex-shrink-0" />
        )}
      </div>
      {open && hasLogs && (
        <div className="px-3 pb-3">
          <div className="bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1 max-h-44 overflow-y-auto border border-white/10">
            {step.logs.map((log, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className={`flex-shrink-0 ${t.textMuted} text-[10px] tabular-nums`}>
                  {typeof log.time === 'string' && log.time.includes('T') ? fmtTime(log.time) : log.time}
                </span>
                <span className={`flex-shrink-0 font-semibold text-[10px] ${
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN'  ? 'text-yellow-400' :
                  log.level === 'SUCCESS' ? 'text-green-400' : 'text-cyan-400'
                }`}>[{log.level}]</span>
                <span className="text-gray-300 break-words">{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Per-app readiness card ───────────────────────────────────────────────────
function AppReadinessCard({ op, t }) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState('steps')

  const rdx = op.phases?.readiness
  if (!rdx) return null

  const pct = rdx.totalSteps > 0 ? (rdx.completedSteps / rdx.totalSteps) * 100 : 0
  const meta = op.meta || {}
  const crit = meta.criticality || 'Unknown'
  const critStyle = CRITICALITY_STYLE[crit] || CRITICALITY_STYLE.Unknown

  const statusLabel =
    rdx.status === 'Ended OK'     ? 'Ready' :
    rdx.status === 'Ended Not OK' ? 'Not Ready' :
    rdx.status === 'Executing'    ? 'Checking…' : rdx.status || 'Pending'

  const statusBadge =
    rdx.status === 'Ended OK'     ? 'bg-green-500/15 text-green-300 border-green-500/30' :
    rdx.status === 'Ended Not OK' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
    rdx.status === 'Executing'    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' :
    'bg-gray-500/15 text-gray-300 border-gray-500/30'

  const failedCount   = rdx.steps?.filter(s => s.status === 'Ended Not OK' || s.status === 'Aborted').length ?? 0
  const runningCount  = rdx.steps?.filter(s => s.status === 'Executing').length ?? 0

  return (
    <div className={`${t.card} border ${t.border} rounded-xl overflow-hidden`}>
      <div
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer ${t.cardHover}`}
        onClick={() => setExpanded(v => !v)}
      >
        <CircularProgress pct={pct} size={54} stroke={5} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${t.text}`}>{op.app}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${critStyle.badge}`}>{crit}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge}`}>{statusLabel}</span>
          </div>
          <div className={`flex items-center gap-2 mt-1 text-xs ${t.textMuted} flex-wrap`}>
            <span>{op.server}</span>
            <span>·</span>
            <span>{rdx.completedSteps}/{rdx.totalSteps} steps</span>
            {failedCount > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                · <XCircle size={10} /> {failedCount} failed
              </span>
            )}
            {runningCount > 0 && (
              <span className="text-cyan-400 flex items-center gap-1">
                · <Activity size={10} className="animate-pulse" /> {runningCount} running
              </span>
            )}
            {meta.team && (
              <span className="flex items-center gap-1">
                · <Users size={10} /> {meta.team}
              </span>
            )}
          </div>
        </div>

        {expanded
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className={`border-t ${t.border} px-4 pt-3 pb-4`}>
          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            {[
              { id: 'steps', label: `Steps (${rdx.totalSteps})` },
              { id: 'log',   label: 'Activity Log' },
              { id: 'info',  label: 'Info' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  tab === id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : `${t.textMuted} hover:text-white border border-transparent`
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'steps' && (
            <div className="space-y-1.5">
              {(!rdx.steps || rdx.steps.length === 0) && (
                <p className={`text-sm ${t.textMuted} italic text-center py-6`}>No step detail available</p>
              )}
              {(rdx.steps || []).map((s, i) => (
                <StepRow key={s.jobId || i} step={s} t={t} />
              ))}
            </div>
          )}

          {tab === 'log' && (
            <div className="bg-black/40 rounded-lg p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto border border-white/10">
              {(!rdx.activityLog || rdx.activityLog.length === 0)
                ? <p className="text-gray-500 italic">No activity log</p>
                : rdx.activityLog.map((e, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={`flex-shrink-0 ${t.textMuted} text-[10px] tabular-nums`}>
                      {typeof e.time === 'string' && e.time.includes('T') ? fmtTime(e.time) : e.time}
                    </span>
                    <span className={`flex-shrink-0 font-semibold text-[10px] ${
                      e.level === 'ERROR' ? 'text-red-400' :
                      e.level === 'WARN'  ? 'text-yellow-400' :
                      e.level === 'SUCCESS' ? 'text-green-400' : 'text-cyan-400'
                    }`}>[{e.level}]</span>
                    <span className="text-gray-300 break-words">{e.msg}</span>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'info' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { label: 'App Type',       value: meta.applicationType || '—' },
                { label: 'Service Impact', value: meta.serviceImpact || '—' },
                { label: 'Owner',          value: meta.owner || '—' },
                { label: 'Last Checked',   value: rdx.endTimeISO ? fmtDate(rdx.endTimeISO) : 'In Progress' },
                { label: 'Folder',         value: rdx.folder || '—' },
                { label: 'Server',         value: op.server || '—' },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-lg p-3 border ${t.border} bg-white/3`}>
                  <div className={`text-[10px] uppercase tracking-wider ${t.textMuted} mb-1`}>{label}</div>
                  <div className={`text-sm font-medium ${t.text} truncate`} title={value}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Collapsible group section ────────────────────────────────────────────────
function GroupSection({ title, ops, color, t }) {
  const [collapsed, setCollapsed] = useState(false)
  const ready = ops.filter(o => o.phases?.readiness?.status === 'Ended OK').length
  const pct   = ops.length > 0 ? (ready / ops.length) * 100 : 0
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer ${t.cardHover} mb-2`}
        onClick={() => setCollapsed(v => !v)}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className={`text-sm font-semibold ${t.text}`}>{title}</span>
        <span className={`text-xs ${t.textMuted}`}>({ops.length})</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/10 mx-2 max-w-36">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color: barColor }}>
          {Math.round(pct)}% ready
        </span>
        <span className={`text-xs ${t.textMuted}`}>{ready}/{ops.length}</span>
        {collapsed
          ? <ChevronRight size={14} className="text-gray-400" />
          : <ChevronDown  size={14} className="text-gray-400" />}
      </div>
      {!collapsed && (
        <div className="space-y-2 pl-4">
          {ops.map(op => (
            <AppReadinessCard key={`${op.app}|${op.server}`} op={op} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const GROUP_OPTIONS = ['Criticality', 'Team', 'None']
const STATUS_FILTERS = ['All', 'Ready', 'Not Ready', 'Checking']

export default function DRReadinessPage({ operations = [], onBack }) {
  const t = useT()
  const [groupBy,       setGroupBy]       = useState('Criticality')
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('All')
  const [showReport,    setShowReport]    = useState(false)

  // Attach metadata to each op
  const enriched = useMemo(() =>
    operations
      .filter(op => op.phases?.readiness)
      .map(op => ({ ...op, meta: mockAppMeta[op.app] || {} })),
    [operations]
  )

  // Filter
  const filtered = useMemo(() => enriched.filter(op => {
    const rdx = op.phases.readiness
    const q = search.toLowerCase()
    if (q && !op.app.toLowerCase().includes(q) && !op.server?.toLowerCase().includes(q)) return false
    if (statusFilter === 'Ready'     && rdx.status !== 'Ended OK')     return false
    if (statusFilter === 'Not Ready' && rdx.status !== 'Ended Not OK') return false
    if (statusFilter === 'Checking'  && rdx.status !== 'Executing')    return false
    return true
  }), [enriched, search, statusFilter])

  // Metrics
  const metrics = useMemo(() => {
    const total    = filtered.length
    const ready    = filtered.filter(o => o.phases.readiness.status === 'Ended OK').length
    const failed   = filtered.filter(o => o.phases.readiness.status === 'Ended Not OK').length
    const checking = filtered.filter(o => o.phases.readiness.status === 'Executing').length
    const pct      = total > 0 ? (ready / total) * 100 : 0
    const totSteps = filtered.reduce((s, o) => s + (o.phases.readiness.totalSteps || 0), 0)
    const okSteps  = filtered.reduce((s, o) => s + (o.phases.readiness.completedSteps || 0), 0)
    const errSteps = filtered.reduce((s, o) => s + (o.phases.readiness.failedSteps || 0), 0)
    return { total, ready, failed, checking, pct, totSteps, okSteps, errSteps }
  }, [filtered])

  // Group
  const groups = useMemo(() => {
    if (groupBy === 'None') {
      return [{ key: 'All Applications', ops: filtered, color: '#6366f1' }]
    }
    const map = {}
    filtered.forEach(op => {
      const key =
        groupBy === 'Criticality' ? (op.meta?.criticality || 'Unknown') :
        groupBy === 'Team'        ? (op.meta?.team || 'Unassigned') : 'All'
      if (!map[key]) map[key] = []
      map[key].push(op)
    })
    return Object.entries(map)
      .sort(([a], [b]) => (CRITICALITY_ORDER[a] ?? 99) - (CRITICALITY_ORDER[b] ?? 99))
      .map(([key, ops]) => ({ key, ops, color: GROUP_COLORS[key] || '#6366f1' }))
  }, [filtered, groupBy])

  const overallBarOk  = metrics.totSteps > 0 ? (metrics.okSteps  / metrics.totSteps) * 100 : 0
  const overallBarErr = metrics.totSteps > 0 ? (metrics.errSteps / metrics.totSteps) * 100 : 0

  return (
    <div className={`min-h-screen flex flex-col ${t.pageBg}`}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className={`${t.header} border-b ${t.border} px-6 py-4 flex items-center gap-3 sticky top-0 z-20`}>
        <button
          onClick={onBack}
          className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-white transition-colors`}
          title="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex-shrink-0">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className={`text-lg font-semibold leading-tight ${t.text}`}>DR Readiness</h1>
          <p className={`text-xs ${t.textMuted}`}>Application readiness validation · Steps · Logs · Reports</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FileText size={15} />
          Generate Report
        </button>
      </div>

      <main className="flex-1 px-6 py-5 space-y-5">
        {/* ── Summary strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Overall gauge */}
          <div className={`${t.card} border ${t.border} rounded-xl p-4 flex items-center gap-4 col-span-2 md:col-span-1`}>
            <CircularProgress pct={metrics.pct} size={68} stroke={6} />
            <div>
              <div className={`text-sm font-semibold ${t.text}`}>Overall Readiness</div>
              <div className={`text-xs ${t.textMuted} mt-0.5`}>{metrics.ready} of {metrics.total} apps ready</div>
            </div>
          </div>

          {/* Ready */}
          <div className={`${t.card} border ${t.border} rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 size={18} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400 tabular-nums">{metrics.ready}</div>
              <div className={`text-xs ${t.textMuted}`}>Ready</div>
            </div>
          </div>

          {/* Not Ready */}
          <div className={`${t.card} border ${t.border} rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <XCircle size={18} className="text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400 tabular-nums">{metrics.failed}</div>
              <div className={`text-xs ${t.textMuted}`}>Not Ready</div>
            </div>
          </div>

          {/* Checking */}
          <div className={`${t.card} border ${t.border} rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Activity size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400 tabular-nums">{metrics.checking}</div>
              <div className={`text-xs ${t.textMuted}`}>Checking</div>
            </div>
          </div>
        </div>

        {/* ── Step progress bar ────────────────────────────────────────────── */}
        {metrics.totSteps > 0 && (
          <div className={`${t.card} border ${t.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${t.text}`}>Step Completion</span>
              <span className={`text-xs ${t.textMuted} tabular-nums`}>
                {metrics.okSteps}/{metrics.totSteps} completed
                {metrics.errSteps > 0 && <span className="text-red-400 ml-2">· {metrics.errSteps} failed</span>}
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5">
              <div className="bg-green-500 transition-all duration-700 rounded-l-full"
                style={{ width: `${overallBarOk}%` }} />
              <div className="bg-red-500 transition-all duration-700"
                style={{ width: `${overallBarErr}%` }} />
            </div>
            <div className={`flex gap-4 mt-2 text-xs ${t.textMuted}`}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Failed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/10" /> Pending</span>
            </div>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} ${t.card} flex-1 min-w-44 max-w-72`}>
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search applications…"
              className={`flex-1 bg-transparent text-sm ${t.text} placeholder-gray-500 outline-none`}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : `${t.textMuted} ${t.cardHover} border ${t.border}`
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Group by */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${t.border} ${t.card} text-xs ${t.textMuted}`}>
            <Layers size={13} />
            <span>Group:</span>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className={`bg-transparent text-xs ${t.text} outline-none cursor-pointer`}
            >
              {GROUP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="flex-1" />
          <span className={`text-xs ${t.textMuted}`}>
            {filtered.length} app{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Application groups ────────────────────────────────────────────── */}
        <div className="space-y-5">
          {groups.length === 0 && (
            <div className={`text-center py-16 ${t.textMuted}`}>
              <Shield size={36} className="mx-auto mb-3 opacity-20" />
              <p>No applications match your filters.</p>
            </div>
          )}
          {groups.map(({ key, ops, color }) => (
            <GroupSection key={key} title={key} ops={ops} color={color} t={t} />
          ))}
        </div>
      </main>

      {showReport && (
        <ReadinessReportModal
          operations={filtered}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
