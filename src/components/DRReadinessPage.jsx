import { useState, useMemo } from 'react'
import {
  Shield, ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, XCircle, Clock, Activity,
  Search, Layers, FileText, ArrowLeft,
  Terminal, Users, Folder, Hash,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import ReadinessReportModal from './ReadinessReportModal'
import { mockAppMeta } from '../data/mockData'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const fmtDur  = iso => iso || '—'

const CRIT_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Unknown: 4 }
const GROUP_COLORS = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e', Unknown: '#6b7280' }

const CRIT_STYLE = {
  Critical: 'text-red-600 bg-red-50 border-red-200',
  High:     'text-orange-600 bg-orange-50 border-orange-200',
  Medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  Low:      'text-green-700 bg-green-50 border-green-200',
  Unknown:  'text-gray-500 bg-gray-50 border-gray-200',
}

// dark-mode-safe — these colour names are semantic; t.card/border handle the bg
const STATUS_STYLE = {
  'Ended OK':     { icon: <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />, pill: 'text-green-700 bg-green-50 border-green-200',   bar: '#22c55e' },
  'Ended Not OK': { icon: <XCircle      size={13} className="text-red-500   flex-shrink-0" />, pill: 'text-red-700   bg-red-50   border-red-200',     bar: '#ef4444' },
  'Aborted':      { icon: <XCircle      size={13} className="text-red-500   flex-shrink-0" />, pill: 'text-red-700   bg-red-50   border-red-200',     bar: '#ef4444' },
  'Executing':    { icon: <Activity     size={13} className="text-blue-500  flex-shrink-0" />, pill: 'text-blue-700  bg-blue-50  border-blue-200',    bar: '#3b82f6' },
  'Waiting':      { icon: <Clock        size={13} className="text-gray-400  flex-shrink-0" />, pill: 'text-gray-500  bg-gray-50  border-gray-200',    bar: '#9ca3af' },
  'Hold':         { icon: <Clock        size={13} className="text-gray-400  flex-shrink-0" />, pill: 'text-gray-500  bg-gray-50  border-gray-200',    bar: '#9ca3af' },
}
const fallbackStyle = STATUS_STYLE['Waiting']

// ─── Circular progress ────────────────────────────────────────────────────────
function CircularProgress({ pct = 0, size = 80, stroke = 7 }) {
  const r     = (size - stroke) / 2
  const circ  = 2 * Math.PI * r
  const filled = Math.min(Math.max(pct, 0), 100) / 100 * circ
  const color  = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
  return (
    <div style={{ width: size, height: size }} className="relative flex-shrink-0">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-black/10" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.2, color }}>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

// ─── Individual step row ──────────────────────────────────────────────────────
function StepRow({ step, t }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_STYLE[step.status] || fallbackStyle
  const hasLog = step.log?.length > 0

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${t.border}`}>
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${hasLog ? 'cursor-pointer ' + t.cardHover : ''}`}
        onClick={() => hasLog && setOpen(v => !v)}
      >
        {s.icon}
        <span className={`flex-1 font-mono truncate ${t.text}`}>{step.name || step.jobId}</span>
        <span className={`px-1.5 py-0.5 rounded border font-medium ${s.pill}`}>{step.status}</span>
        {step.startTimeISO && <span className={`font-mono ${t.textMuted} flex-shrink-0`}>{fmtTime(step.startTimeISO)}</span>}
        {step.duration     && <span className={`${t.textMuted} flex-shrink-0`}>{step.duration}</span>}
        {hasLog && (open ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0" /> : <Terminal size={12} className="text-gray-400 flex-shrink-0" />)}
      </div>

      {open && hasLog && (
        <div className={`border-t ${t.border} px-3 pb-3 pt-2 ${t.inner}`}>
          <div className="font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
            {step.log.map((l, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className={`flex-shrink-0 tabular-nums ${t.textFaint}`}>
                  {typeof l.time === 'string' && l.time.includes('T') ? fmtTime(l.time) : l.time}
                </span>
                <span className={`flex-shrink-0 font-semibold ${l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-amber-600' : l.level === 'SUCCESS' ? 'text-green-600' : 'text-blue-500'}`}>
                  [{l.level}]
                </span>
                <span className={t.textSub}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Folder run block ─────────────────────────────────────────────────────────
function FolderRunBlock({ run, runIndex, t }) {
  const [tab,  setTab]  = useState('steps')  // steps | log
  const [open, setOpen] = useState(runIndex === 0)
  const s = STATUS_STYLE[run.status] || fallbackStyle

  const okCount  = run.steps.filter(st => st.status === 'Ended OK').length
  const errCount = run.steps.filter(st => st.status === 'Ended Not OK' || st.status === 'Aborted').length
  const runCount  = run.steps.filter(st => st.status === 'Executing').length

  return (
    <div className={`border rounded-xl overflow-hidden ${t.border}`}>
      {/* Folder run header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${t.cardHover}`}
        onClick={() => setOpen(v => !v)}
      >
        <Folder size={15} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold font-mono ${t.text} truncate`}>{run.folder}</span>
            <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
              <Hash size={10} />Run {run.runNo}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.pill}`}>{run.status}</span>
          </div>
          <div className={`flex items-center gap-3 mt-0.5 text-xs ${t.textMuted}`}>
            <span>{run.steps.length} steps</span>
            {okCount  > 0 && <span className="text-green-600">· {okCount} ok</span>}
            {errCount > 0 && <span className="text-red-600">· {errCount} failed</span>}
            {runCount > 0 && <span className="text-blue-600">· {runCount} running</span>}
            {run.startTimeISO && <span>· Started {fmtTime(run.startTimeISO)}</span>}
            {run.endTimeISO   && <span>· Ended {fmtTime(run.endTimeISO)}</span>}
          </div>
        </div>
        <span className={`font-mono text-xs ${t.textMuted} hidden sm:block`}>{run.runId}</span>
        {open ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className={`border-t ${t.border}`}>
          {/* Tab bar */}
          <div className={`flex gap-1 px-4 pt-3 pb-2 border-b ${t.border}`}>
            {[{ id: 'steps', label: `Steps (${run.steps.length})` }, { id: 'log', label: 'Run Log' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  tab === id
                    ? 'bg-blue-600 text-white'
                    : `${t.textMuted} ${t.cardHover} border ${t.border}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'steps' && (
            <div className="px-4 py-3 space-y-1.5">
              {run.steps.length === 0
                ? <p className={`text-xs ${t.textMuted} italic py-2`}>No step detail available</p>
                : run.steps.map((st, i) => <StepRow key={st.jobId || i} step={st} t={t} />)}
            </div>
          )}

          {tab === 'log' && (
            <div className={`mx-4 my-3 rounded-lg border ${t.border} ${t.inner} p-3 font-mono text-[11px] space-y-1 max-h-52 overflow-y-auto`}>
              {(!run.log || run.log.length === 0)
                ? <span className={t.textFaint}>No log entries</span>
                : run.log.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={`flex-shrink-0 tabular-nums ${t.textFaint}`}>
                      {typeof l.time === 'string' && l.time.includes('T') ? fmtTime(l.time) : l.time}
                    </span>
                    <span className={`flex-shrink-0 font-semibold ${l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-amber-600' : l.level === 'SUCCESS' ? 'text-green-600' : 'text-blue-500'}`}>
                      [{l.level}]
                    </span>
                    <span className={t.textSub}>{l.msg}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tile card (TV / column view) ─────────────────────────────────────────────
function AppTile({ op, t, onClick }) {
  const rdx  = op.phases?.readiness
  if (!rdx) return null
  const pct  = rdx.totalSteps > 0 ? (rdx.completedSteps / rdx.totalSteps) * 100 : 0
  const meta = op.meta || {}
  const crit = meta.criticality || 'Unknown'
  const cs   = CRIT_STYLE[crit] || CRIT_STYLE.Unknown

  const isOk   = rdx.status === 'Ended OK'
  const isFail = rdx.status === 'Ended Not OK'
  const isRun  = rdx.status === 'Executing'

  const borderAccent = isOk ? 'border-t-green-500' : isFail ? 'border-t-red-500' : isRun ? 'border-t-blue-500' : 'border-t-gray-300'
  const statusLabel  = isOk ? 'Ready' : isFail ? 'Not Ready' : isRun ? 'Checking…' : rdx.status || 'Pending'
  const statusPill   = isOk ? 'bg-green-50 text-green-700 border-green-200' : isFail ? 'bg-red-50 text-red-700 border-red-200' : isRun ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'

  const failedFolders  = (rdx.folderRuns || []).filter(r => r.status === 'Ended Not OK').length
  const runningFolders = (rdx.folderRuns || []).filter(r => r.status === 'Executing').length

  return (
    <div
      onClick={onClick}
      className={`${t.card} border-2 ${borderAccent} border-x border-b ${t.border} rounded-2xl p-5 cursor-pointer flex flex-col gap-4 hover:shadow-lg transition-all duration-200 ${t.cardHover}`}
    >
      {/* Top: gauge + name */}
      <div className="flex items-start gap-4">
        <CircularProgress pct={pct} size={72} stroke={6} />
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-base leading-tight ${t.text}`}>{op.app}</div>
          <div className={`text-xs ${t.textMuted} mt-0.5`}>{op.server}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cs}`}>{crit}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusPill}`}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Step bar */}
      <div>
        <div className={`flex justify-between text-xs ${t.textMuted} mb-1`}>
          <span>Steps</span>
          <span className="tabular-nums">{rdx.completedSteps}/{rdx.totalSteps}</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden bg-black/8`}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: isOk ? '#16a34a' : isFail ? '#dc2626' : '#3b82f6' }}
          />
        </div>
        {rdx.failedSteps > 0 && (
          <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <XCircle size={10} />{rdx.failedSteps} step{rdx.failedSteps > 1 ? 's' : ''} failed
          </div>
        )}
      </div>

      {/* Folder run summary */}
      <div className={`text-xs ${t.textMuted} border-t ${t.border} pt-3`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1"><Folder size={11} />{(rdx.folderRuns || []).length} folder run{(rdx.folderRuns || []).length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            {failedFolders  > 0 && <span className="text-red-600">{failedFolders} failed</span>}
            {runningFolders > 0 && <span className="text-blue-600">{runningFolders} running</span>}
          </div>
        </div>
        {meta.team && (
          <div className="flex items-center gap-1 mt-1">
            <Users size={10} />{meta.team}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail drawer (slide-over) ───────────────────────────────────────────────
function AppDetailDrawer({ op, t, onClose }) {
  const rdx  = op?.phases?.readiness
  const meta = op?.meta || {}

  if (!op || !rdx) return null

  const pct    = rdx.totalSteps > 0 ? (rdx.completedSteps / rdx.totalSteps) * 100 : 0
  const isOk   = rdx.status === 'Ended OK'
  const isFail = rdx.status === 'Ended Not OK'
  const isRun  = rdx.status === 'Executing'
  const statusLabel = isOk ? 'Ready' : isFail ? 'Not Ready' : isRun ? 'Checking…' : rdx.status || 'Pending'
  const statusPill  = isOk ? 'bg-green-50 text-green-700 border-green-200' : isFail ? 'bg-red-50 text-red-700 border-red-200' : isRun ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full z-40 w-full max-w-2xl flex flex-col shadow-2xl ${t.card} border-l ${t.border} overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} flex-shrink-0`}>
          <CircularProgress pct={pct} size={52} stroke={5} />
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-lg ${t.text}`}>{op.app}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusPill}`}>{statusLabel}</span>
              <span className={`text-xs ${t.textMuted}`}>{op.server} · {rdx.completedSteps}/{rdx.totalSteps} steps · {(rdx.folderRuns || []).length} folder runs</span>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-current`}>
            <XCircle size={18} />
          </button>
        </div>

        {/* Body — folder runs */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {(!rdx.folderRuns || rdx.folderRuns.length === 0) && (
            <p className={`text-sm ${t.textMuted} italic py-8 text-center`}>No folder run detail available</p>
          )}
          {(rdx.folderRuns || []).map((run, i) => (
            <FolderRunBlock key={run.runId || i} run={run} runIndex={i} t={t} />
          ))}

          {/* App info */}
          <div className={`border-t ${t.border} pt-4 grid grid-cols-2 gap-2`}>
            {[
              { label: 'App Type',       value: meta.applicationType || '—' },
              { label: 'Service Impact', value: meta.serviceImpact   || '—' },
              { label: 'Owner',          value: meta.owner           || '—' },
              { label: 'Team',           value: meta.team            || '—' },
            ].map(({ label, value }) => (
              <div key={label} className={`rounded-lg p-3 border ${t.border} ${t.inner}`}>
                <div className={`text-[10px] uppercase tracking-wide ${t.textFaint} mb-0.5`}>{label}</div>
                <div className={`text-sm font-medium ${t.text} truncate`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────
function GroupSection({ title, ops, color, t, onSelect }) {
  const [collapsed, setCollapsed] = useState(false)
  const ready = ops.filter(o => o.phases?.readiness?.status === 'Ended OK').length
  const pct   = ops.length > 0 ? (ready / ops.length) * 100 : 0
  const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer ${t.cardHover} mb-3`}
        onClick={() => setCollapsed(v => !v)}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className={`text-sm font-semibold ${t.text}`}>{title}</span>
        <span className={`text-xs ${t.textMuted}`}>({ops.length})</span>
        <div className="flex-1 h-1.5 rounded-full bg-black/10 mx-2 max-w-32">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color: barColor }}>
          {Math.round(pct)}% ready · {ready}/{ops.length}
        </span>
        {collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </div>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-1">
          {ops.map(op => (
            <AppTile key={`${op.app}|${op.server}`} op={op} t={t} onClick={() => onSelect(op)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const STATUS_FILTERS = ['All', 'Ready', 'Not Ready', 'Checking']

export default function DRReadinessPage({ operations = [], onBack }) {
  const t = useT()
  const { settings } = useSettings()
  const defaultGroupBy = settings.readiness?.groupBy || 'Criticality'

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedOp,   setSelectedOp]   = useState(null)
  const [showReport,   setShowReport]   = useState(false)

  // Attach metadata
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
    if (q && !op.app.toLowerCase().includes(q) && !(op.server || '').toLowerCase().includes(q)) return false
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

  // Groups
  const groups = useMemo(() => {
    if (defaultGroupBy === 'None') return [{ key: 'All Applications', ops: filtered, color: '#6366f1' }]
    const map = {}
    filtered.forEach(op => {
      const key =
        defaultGroupBy === 'Criticality' ? (op.meta?.criticality || 'Unknown') :
        defaultGroupBy === 'Team'        ? (op.meta?.team || 'Unassigned') :
        defaultGroupBy === 'Datacenter'  ? ((op.server || '').split('.')[0] || 'Unknown') : 'All'
      if (!map[key]) map[key] = []
      map[key].push(op)
    })
    return Object.entries(map)
      .sort(([a], [b]) => (CRIT_ORDER[a] ?? 99) - (CRIT_ORDER[b] ?? 99))
      .map(([key, ops]) => ({ key, ops, color: GROUP_COLORS[key] || '#6366f1' }))
  }, [filtered, defaultGroupBy])

  const overallBarOk  = metrics.totSteps > 0 ? (metrics.okSteps  / metrics.totSteps) * 100 : 0
  const overallBarErr = metrics.totSteps > 0 ? (metrics.errSteps / metrics.totSteps) * 100 : 0

  return (
    <div className={`min-h-screen flex flex-col ${t.pageBg}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`${t.header} border-b ${t.border} px-6 py-4 flex items-center gap-3 sticky top-0 z-20`}>
        <button onClick={onBack} className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-current transition-colors`} title="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0">
          <Shield className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className={`text-lg font-semibold leading-tight ${t.text}`}>DR Readiness</h1>
          <p className={`text-xs ${t.textMuted}`}>
            Application readiness · Folder runs · Steps · Logs
            {defaultGroupBy !== 'None' && <span> · Grouped by {defaultGroupBy}</span>}
          </p>
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
        {/* ── Summary strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${t.card} border ${t.border} rounded-2xl p-4 flex items-center gap-4 col-span-2 md:col-span-1`}>
            <CircularProgress pct={metrics.pct} size={68} stroke={6} />
            <div>
              <div className={`text-sm font-semibold ${t.text}`}>Overall Readiness</div>
              <div className={`text-xs ${t.textMuted} mt-0.5`}>{metrics.ready} of {metrics.total} apps ready</div>
            </div>
          </div>
          {[
            { label: 'Ready',    value: metrics.ready,    icon: <CheckCircle2 size={18} className="text-green-600" />, bg: 'bg-green-500/10 border-green-500/20', val: 'text-green-700' },
            { label: 'Not Ready',value: metrics.failed,   icon: <XCircle      size={18} className="text-red-600"   />, bg: 'bg-red-500/10   border-red-500/20',   val: 'text-red-700'   },
            { label: 'Checking', value: metrics.checking, icon: <Activity     size={18} className="text-blue-600"  />, bg: 'bg-blue-500/10  border-blue-500/20',  val: 'text-blue-700'  },
          ].map(m => (
            <div key={m.label} className={`${t.card} border ${t.border} rounded-2xl p-4 flex items-center gap-3`}>
              <div className={`p-2.5 rounded-xl border ${m.bg}`}>{m.icon}</div>
              <div>
                <div className={`text-2xl font-bold ${m.val} tabular-nums`}>{m.value}</div>
                <div className={`text-xs ${t.textMuted}`}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Step bar ─────────────────────────────────────────────────────── */}
        {metrics.totSteps > 0 && (
          <div className={`${t.card} border ${t.border} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${t.text}`}>Step Completion</span>
              <span className={`text-xs ${t.textMuted} tabular-nums`}>
                {metrics.okSteps}/{metrics.totSteps} completed
                {metrics.errSteps > 0 && <span className="text-red-600 ml-2">· {metrics.errSteps} failed</span>}
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-black/8">
              <div className="bg-green-500 transition-all duration-700 rounded-l-full" style={{ width: `${overallBarOk}%` }} />
              <div className="bg-red-500 transition-all duration-700" style={{ width: `${overallBarErr}%` }} />
            </div>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${t.border} ${t.card} flex-1 min-w-44 max-w-72`}>
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search applications…"
              className={`flex-1 bg-transparent text-sm ${t.text} placeholder-gray-400 outline-none`}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  statusFilter === s ? 'bg-blue-600 text-white' : `${t.textMuted} ${t.cardHover} border ${t.border}`
                }`}>{s}</button>
            ))}
          </div>
          <div className="flex-1" />
          <div className={`flex items-center gap-1.5 text-xs ${t.textMuted}`}>
            <Layers size={13} />
            <span>Grouped by <strong className={t.textSub}>{defaultGroupBy}</strong></span>
            <span className={t.textFaint}>(change in Settings)</span>
          </div>
          <span className={`text-xs ${t.textMuted}`}>{filtered.length} app{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Tile groups ───────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {groups.length === 0 && (
            <div className={`text-center py-16 ${t.textMuted}`}>
              <Shield size={36} className="mx-auto mb-3 opacity-20" />
              <p>No applications match your filters.</p>
            </div>
          )}
          {groups.map(({ key, ops, color }) => (
            <GroupSection key={key} title={key} ops={ops} color={color} t={t} onSelect={setSelectedOp} />
          ))}
        </div>
      </main>

      {/* Detail drawer */}
      {selectedOp && <AppDetailDrawer op={selectedOp} t={t} onClose={() => setSelectedOp(null)} />}

      {/* Report modal */}
      {showReport && (
        <ReadinessReportModal operations={filtered} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
