import { useState, useMemo } from 'react'
import {
  Shield, ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, XCircle, Clock, Activity,
  Search, Layers, FileText, ArrowLeft,
  Terminal, Users, Folder, Hash, History,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import ReadinessReportModal from './ReadinessReportModal'
import { mockAppMeta } from '../data/mockData'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const CRIT_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Other: 4 }
const GROUP_COLORS = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e', Other: '#6b7280' }

const CRIT_STYLE = {
  Critical: 'text-red-600 bg-red-50 border-red-200',
  High:     'text-orange-600 bg-orange-50 border-orange-200',
  Medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  Low:      'text-green-700 bg-green-50 border-green-200',
}

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

// ─── Run history dot sparkline ────────────────────────────────────────────────
function RunSparkline({ history, currentStatus, t }) {
  if (!history?.length) return null
  const successCount = history.filter(r => r.status === 'Ended OK').length
  const total = history.length
  const scorePct = Math.round(successCount / total * 100)
  const scoreColor = scorePct >= 80 ? 'text-green-600' : scorePct >= 50 ? 'text-amber-600' : 'text-red-600'
  const dots = history.slice(-8)

  return (
    <div className={`text-xs ${t.textMuted} border-t ${t.border} pt-2.5`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1"><History size={10} /> Run history</span>
        <span className={`font-semibold tabular-nums ${scoreColor}`}>{successCount}/{total} passed</span>
      </div>
      <div className="flex gap-1 items-center">
        {dots.map((r, i) => (
          <span
            key={r.runId || i}
            title={`Run #${r.runNo}: ${r.status} · ${fmtDate(r.runDate)}`}
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: r.status === 'Ended OK' ? '#16a34a' : r.status === 'Ended Not OK' ? '#dc2626' : '#3b82f6' }}
          />
        ))}
        {currentStatus === 'Executing' && (
          <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse flex-shrink-0" title="Current: Executing" />
        )}
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
  const [tab,  setTab]  = useState('steps')
  const [open, setOpen] = useState(runIndex === 0)
  const s = STATUS_STYLE[run.status] || fallbackStyle

  const okCount  = run.steps.filter(st => st.status === 'Ended OK').length
  const errCount = run.steps.filter(st => st.status === 'Ended Not OK' || st.status === 'Aborted').length
  const runCount = run.steps.filter(st => st.status === 'Executing').length

  return (
    <div className={`border rounded-xl overflow-hidden ${t.border}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${t.cardHover}`}
        onClick={() => setOpen(v => !v)}
      >
        <Folder size={15} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Order ID is the primary identifier — unique per CTM execution */}
            <span className={`text-sm font-bold font-mono ${t.text}`}>{run.runId}</span>
            <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
              <Hash size={10} />Run {run.runNo}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.pill}`}>{run.status}</span>
          </div>
          <div className={`flex items-center gap-3 mt-0.5 text-xs ${t.textMuted}`}>
            <span className="truncate">{run.folder}</span>
            <span>·</span>
            <span>{run.steps.length} steps</span>
            {okCount  > 0 && <span className="text-green-600">· {okCount} ok</span>}
            {errCount > 0 && <span className="text-red-600">· {errCount} failed</span>}
            {runCount > 0 && <span className="text-blue-600">· {runCount} running</span>}
            {run.startTimeISO && <span>· {fmtTime(run.startTimeISO)}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className={`border-t ${t.border}`}>
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

// ─── Minimal bird's-eye tile ──────────────────────────────────────────────────
function AppTile({ op, t }) {
  const [expanded, setExpanded] = useState(false)
  const rdx = op.phases?.readiness
  if (!rdx) return null

  const folderRuns = rdx.folderRuns || []
  const okRuns     = folderRuns.filter(r => r.status === 'Ended OK').length
  const failRuns   = folderRuns.filter(r => r.status === 'Ended Not OK').length
  const liveRuns   = folderRuns.filter(r => r.status === 'Executing').length
  const latestRun  = folderRuns.at(-1)
  const lastOk     = latestRun?.status === 'Ended OK'
  const hasLive    = liveRuns > 0

  const meta = op.meta || {}
  const crit = meta.criticality || null
  const cs   = CRIT_STYLE[crit] || 'text-gray-500 bg-gray-50 border-gray-200'

  const cardCls   = lastOk    ? 'bg-green-500/5  border-green-400/50'
                  : hasLive   ? `${t.card} border-blue-400/40`
                  : failRuns  ? `${t.card} border-red-400/30`
                  : `${t.card} ${t.border}`
  const dotColor  = lastOk    ? '#16a34a'
                  : hasLive   ? '#3b82f6'
                  : failRuns  ? '#dc2626' : '#9ca3af'

  return (
    <div className={`border rounded-xl overflow-hidden ${cardCls}`}>

      {/* ── Minimal summary row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-3">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${t.text}`}>{op.app}</div>
          <div className={`text-[10px] ${t.textMuted} tabular-nums`}>
            {folderRuns.length} runs · {okRuns} passed
            {failRuns > 0 && <span className="text-red-500"> · {failRuns} failed</span>}
            {hasLive && <span className="text-blue-500"> · live</span>}
          </div>
        </div>
        {crit && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${cs}`}>{crit}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className={`p-1 rounded ${t.cardHover} ${t.textMuted} flex-shrink-0`}
          title="View runs"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ── Expanded: run table with Application / Sub-Application / Folder ─ */}
      {expanded && (
        <div className={`border-t ${lastOk ? 'border-green-300/40' : t.border}`}>
          {/* Header */}
          <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide ${t.textFaint} ${t.inner} border-b ${lastOk ? 'border-green-300/30' : t.border}`}>
            <span></span>
            <span>Application · Sub-Application · Folder</span>
            <span className="text-right">Run ID</span>
            <span className="text-right">Start</span>
            <span className="text-right">Status</span>
          </div>
          {folderRuns.map((run, i) => {
            const s = STATUS_STYLE[run.status] || fallbackStyle
            return (
              <div
                key={run.runId}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center px-3 py-1.5 text-[11px] ${i < folderRuns.length - 1 ? `border-b ${lastOk ? 'border-green-300/20' : 'border-black/5'}` : ''}`}
              >
                {s.icon}
                <div className={`min-w-0 ${t.textMuted}`}>
                  <span className={`font-medium ${t.text}`}>{op.app}</span>
                  <span className="mx-1">·</span>
                  <span className="text-blue-600 font-medium">Readiness</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono text-[10px] truncate">{run.folder}</span>
                </div>
                <span className={`font-mono font-bold text-[11px] tabular-nums ${t.text}`}>{run.runId}</span>
                <span className={`tabular-nums text-[10px] ${t.textMuted}`}>{run.startTimeISO ? fmtTime(run.startTimeISO) : '—'}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${s.pill}`}>{run.status}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Run history summary card ─────────────────────────────────────────────────
function HistRunCard({ run, t }) {
  const isOk   = run.status === 'Ended OK'
  const isFail = run.status === 'Ended Not OK'
  const passPct = run.totalSteps > 0 ? Math.round(run.completedSteps / run.totalSteps * 100) : 0
  const dotColor = isOk ? '#16a34a' : isFail ? '#dc2626' : '#3b82f6'
  const pillCls  = isOk ? 'text-green-700 bg-green-50 border-green-200' : isFail ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-500 bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-xl border ${t.border} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <span className={`text-sm font-semibold ${t.text}`}>Run #{run.runNo}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pillCls}`}>{run.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Date',      value: fmtDate(run.runDate) },
          { label: 'Duration',  value: `${run.durationMins} min` },
          { label: 'Pass Rate', value: `${passPct}%` },
          { label: 'Total',     value: run.totalSteps },
          { label: 'Passed',    value: run.completedSteps },
          { label: 'Failed',    value: run.failedSteps },
        ].map(({ label, value }) => (
          <div key={label} className={`rounded-lg p-2.5 border ${t.border} ${t.inner}`}>
            <div className={`text-[10px] uppercase tracking-wide ${t.textFaint} mb-0.5`}>{label}</div>
            <div className={`text-sm font-medium ${t.text}`}>{value}</div>
          </div>
        ))}
      </div>
      {/* Mini step bar */}
      <div className={`h-1.5 rounded-full overflow-hidden bg-black/8`}>
        <div className="h-full rounded-full" style={{ width: `${passPct}%`, backgroundColor: dotColor }} />
      </div>
    </div>
  )
}

// ─── Detail drawer (slide-over) ───────────────────────────────────────────────
function AppDetailDrawer({ op, t, onClose }) {
  const [drawerTab,       setDrawerTab]       = useState('current')  // 'current' | 'history'
  const [selectedHistRun, setSelectedHistRun] = useState(null)       // null = show list

  const rdx  = op?.phases?.readiness
  const meta = op?.meta || {}

  if (!op || !rdx) return null

  const runHistory = rdx.runHistory || []
  const pct    = rdx.totalSteps > 0 ? (rdx.completedSteps / rdx.totalSteps) * 100 : 0
  const isOk   = rdx.status === 'Ended OK'
  const isFail = rdx.status === 'Ended Not OK'
  const isRun  = rdx.status === 'Executing'
  const statusLabel = isOk ? 'Ready' : isFail ? 'Not Ready' : isRun ? 'Checking…' : rdx.status || 'Pending'
  const statusPill  = isOk ? 'bg-green-50 text-green-700 border-green-200' : isFail ? 'bg-red-50 text-red-700 border-red-200' : isRun ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'

  const successCount  = runHistory.filter(r => r.status === 'Ended OK').length
  const scorePct      = runHistory.length > 0 ? Math.round(successCount / runHistory.length * 100) : null

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
              <span className={`text-xs ${t.textMuted}`}>{op.server} · {rdx.folderRuns?.length || 0} execution runs</span>
              {scorePct !== null && (
                <span className={`text-xs font-semibold ${scorePct >= 80 ? 'text-green-600' : scorePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  · {successCount}/{runHistory.length} runs passed
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-current`}>
            <XCircle size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className={`flex gap-1 px-5 py-3 border-b ${t.border} flex-shrink-0`}>
          {[
            { id: 'current', label: `Current Run`, extra: isRun ? '●' : null },
            { id: 'history', label: `Run History (${runHistory.length})` },
          ].map(({ id, label, extra }) => (
            <button
              key={id}
              onClick={() => { setDrawerTab(id); setSelectedHistRun(null) }}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                drawerTab === id
                  ? 'bg-blue-600 text-white'
                  : `${t.textMuted} ${t.cardHover} border ${t.border}`
              }`}
            >
              {label}
              {extra && <span className="ml-1.5 text-blue-400 animate-pulse">{extra}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {drawerTab === 'current' && (
            <>
              {/* Last run steps prominently */}
              {rdx.folderRuns?.length > 0 && (
                <div className={`rounded-xl border ${t.border} p-4 ${t.inner}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${t.textFaint} mb-3`}>
                    CTM Execution Runs — {rdx.folderRuns.length} separate runs
                  </div>
                  <div className="space-y-3">
                    {rdx.folderRuns.map((run, i) => (
                      <FolderRunBlock key={run.runId || i} run={run} runIndex={i} t={t} />
                    ))}
                  </div>
                </div>
              )}
              {(!rdx.folderRuns || rdx.folderRuns.length === 0) && (
                <p className={`text-sm ${t.textMuted} italic py-8 text-center`}>No folder run detail available</p>
              )}

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
            </>
          )}

          {drawerTab === 'history' && (
            <>
              {runHistory.length === 0 && (
                <p className={`text-sm ${t.textMuted} italic py-8 text-center`}>No run history available</p>
              )}

              {/* Summary stats */}
              {runHistory.length > 0 && (
                <div className={`rounded-xl border ${t.border} p-4 ${t.inner}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${t.textFaint} mb-3`}>Overall Statistics</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total Runs',   value: runHistory.length },
                      { label: 'Passed',        value: successCount, color: 'text-green-600' },
                      { label: 'Failed',        value: runHistory.length - successCount, color: 'text-red-600' },
                      { label: 'Pass Rate',     value: `${scorePct}%`, color: scorePct >= 80 ? 'text-green-600' : scorePct >= 50 ? 'text-amber-600' : 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-lg p-2.5 border ${t.border} text-center`}>
                        <div className={`text-xl font-bold tabular-nums ${color || t.text}`}>{value}</div>
                        <div className={`text-[10px] ${t.textFaint} mt-0.5`}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* sparkline */}
                  <div className="flex gap-1.5 mt-3 items-center">
                    {runHistory.map((r, i) => (
                      <span
                        key={r.runId || i}
                        title={`Run #${r.runNo}: ${r.status} · ${fmtDate(r.runDate)}`}
                        className="w-4 h-4 rounded-full cursor-default flex-shrink-0"
                        style={{ backgroundColor: r.status === 'Ended OK' ? '#16a34a' : '#dc2626' }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Individual run cards */}
              {[...runHistory].reverse().map((r, i) => (
                <HistRunCard key={r.runId || i} run={r} t={t} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────
function GroupSection({ title, ops, color, t }) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-1">
          {ops.map(op => (
            <AppTile key={`${op.app}|${op.server}`} op={op} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const STATUS_FILTERS = ['All', 'Ready', 'Not Ready']

export default function DRReadinessPage({ operations = [], onBack }) {
  const t = useT()
  const { settings } = useSettings()
  const defaultGroupBy = settings.readiness?.groupBy || 'Criticality'

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showReport,   setShowReport]   = useState(false)

  // Attach metadata — settings.appMeta overrides mockAppMeta defaults
  const enriched = useMemo(() =>
    operations
      .filter(op => op.phases?.readiness)
      .map(op => ({
        ...op,
        meta: { ...(mockAppMeta[op.app] || {}), ...(settings.appMeta?.[op.app] || {}) },
      })),
    [operations, settings.appMeta]
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
    const total   = filtered.length
    const ready   = filtered.filter(o => o.phases.readiness.status === 'Ended OK').length
    const failed  = filtered.filter(o => o.phases.readiness.status === 'Ended Not OK').length
    const pct     = total > 0 ? (ready / total) * 100 : 0
    // Run-level aggregates across all apps
    const allRuns  = filtered.flatMap(o => o.phases.readiness.folderRuns || [])
    const totRuns  = allRuns.length
    const okRuns   = allRuns.filter(r => r.status === 'Ended OK').length
    const errRuns  = allRuns.filter(r => r.status === 'Ended Not OK').length
    const inpRuns  = allRuns.filter(r => r.status === 'Executing').length
    const runPct   = totRuns > 0 ? Math.round((okRuns / totRuns) * 100) : 0
    return { total, ready, failed, pct, totRuns, okRuns, errRuns, inpRuns, runPct }
  }, [filtered])

  // Groups
  const groups = useMemo(() => {
    if (defaultGroupBy === 'None') return [{ key: 'All Applications', ops: filtered, color: '#6366f1' }]
    const map = {}
    filtered.forEach(op => {
      const key =
        defaultGroupBy === 'Criticality' ? (op.meta?.criticality || 'Other') :
        defaultGroupBy === 'Team'        ? (op.meta?.team || 'Unassigned') :
        defaultGroupBy === 'Datacenter'  ? ((op.server || '').split('.')[0] || 'Other') :
        defaultGroupBy === 'Type'        ? (op.meta?.applicationType || 'Other') : 'All'
      if (!map[key]) map[key] = []
      map[key].push(op)
    })
    return Object.entries(map)
      .sort(([a], [b]) => (CRIT_ORDER[a] ?? 99) - (CRIT_ORDER[b] ?? 99))
      .map(([key, ops]) => ({ key, ops, color: GROUP_COLORS[key] || '#6366f1' }))
  }, [filtered, defaultGroupBy])

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className={`${t.card} border ${t.border} rounded-2xl p-4 flex items-center gap-4 col-span-2 md:col-span-1`}>
            <CircularProgress pct={metrics.pct} size={68} stroke={6} />
            <div>
              <div className={`text-sm font-semibold ${t.text}`}>Overall Readiness</div>
              <div className={`text-xs ${t.textMuted} mt-0.5`}>{metrics.ready} of {metrics.total} apps ready</div>
            </div>
          </div>
          {[
            { label: 'Ready',    value: metrics.ready,  icon: <CheckCircle2 size={18} className="text-green-600" />, bg: 'bg-green-500/10 border-green-500/20', val: 'text-green-700' },
            { label: 'Not Ready',value: metrics.failed, icon: <XCircle      size={18} className="text-red-600"   />, bg: 'bg-red-500/10   border-red-500/20',   val: 'text-red-700'   },
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

        {/* ── Run stats bar ────────────────────────────────────────────────── */}
        {metrics.totRuns > 0 && (
          <div className={`${t.card} border ${t.border} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${t.text}`}>Execution Runs — All Apps</span>
              <span className={`text-xs ${t.textMuted} tabular-nums`}>
                {metrics.okRuns} passed · {metrics.errRuns} failed · {metrics.totRuns} total
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-black/8">
              <div
                className="bg-green-500 transition-all duration-700 rounded-l-full"
                style={{ width: `${metrics.totRuns > 0 ? (metrics.okRuns / metrics.totRuns) * 100 : 0}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-700"
                style={{ width: `${metrics.totRuns > 0 ? (metrics.errRuns / metrics.totRuns) * 100 : 0}%` }}
              />
            </div>
            <div className={`flex items-center justify-between mt-2 text-xs ${t.textMuted}`}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Passed ({metrics.runPct}%)</span>
              {metrics.errRuns > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Failed</span>}
              {metrics.inpRuns > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />In progress</span>}
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
            <GroupSection key={key} title={key} ops={ops} color={color} t={t} />
          ))}
        </div>
      </main>

      {/* Report modal */}
      {showReport && (
        <ReadinessReportModal operations={filtered} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
