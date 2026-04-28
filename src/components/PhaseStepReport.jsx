/**
 * PhaseStepReport — workflow step detail modal
 *
 * Shows all CTM jobs (steps) within a single DR phase in chronological order.
 * Mimics CTM Workflow Monitor: steps numbered 1/N, progress bar, failure drill-down.
 * Log output is fetched via the authenticated API proxy and displayed inline.
 */

import { useState, useMemo, useRef } from 'react'
import {
  X, CheckCircle2, XCircle, Clock, Loader2,
  FileText, AlertTriangle, Terminal, Copy, Check,
  WrapText, AlignLeft, Search, Download,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { fetchJobOutput } from '../services/controlmApi'

const PHASE_LABELS = {
  switchover: 'Switchover',
  switchback: 'Switchback',
  readiness:  'Readiness',
  failover:   'Failover',
  failback:   'Failback',
}

const PHASE_COLORS = {
  switchover: { accent: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30'    },
  switchback: { accent: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
  readiness:  { accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30'},
  failover:   { accent: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  failback:   { accent: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30'   },
}

function stepStatusIcon(status) {
  if (status === 'Ended OK')     return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
  if (status === 'Ended Not OK') return <XCircle      className="w-4 h-4 text-red-400 flex-shrink-0"   />
  if (status === 'Executing')    return <Loader2      className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
  return                                <Clock        className="w-4 h-4 text-slate-400 flex-shrink-0" />
}

function fmtElapsed(mins) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Log line classifier ───────────────────────────────────────────────────────

function classifyLine(line) {
  const l = line.toLowerCase()
  if (/\b(error|err|failed|fail|exception|fatal|abort|critical|not ok)\b/.test(l))
    return 'error'
  if (/\b(warn(ing)?|caution|deprecated)\b/.test(l))
    return 'warn'
  if (/\b(ok|success|succeed|succeeded|completed|done|finish|passed)\b/.test(l))
    return 'ok'
  if (/\b(info|start(ing|ed)?|running|execute|executing|initiali)\b/.test(l))
    return 'info'
  return 'default'
}

const LINE_STYLES = {
  error:   'text-red-400   bg-red-500/5',
  warn:    'text-amber-300 bg-amber-500/5',
  ok:      'text-green-400 bg-green-500/5',
  info:    'text-blue-300',
  default: 'text-slate-300',
}

const LINE_GUTTER = {
  error:   'text-red-500/60',
  warn:    'text-amber-500/60',
  ok:      'text-green-500/60',
  info:    'text-blue-500/60',
  default: 'text-slate-600',
}

// ── Full-screen log viewer modal ──────────────────────────────────────────────

function LogViewer({ jobId, stepName, onClose }) {
  const t = useT()
  const [state,   setState]   = useState('loading')
  const [lines,   setLines]   = useState([])
  const [errMsg,  setErrMsg]  = useState('')
  const [wrap,    setWrap]    = useState(true)
  const [query,   setQuery]   = useState('')
  const [copied,  setCopied]  = useState(false)
  const rawRef = useRef('')

  // Fetch on mount
  useState(() => {
    fetchJobOutput(jobId)
      .then((text) => {
        rawRef.current = text || ''
        setLines((text || '(empty output)').split('\n'))
        setState('ok')
      })
      .catch((e) => { setErrMsg(e.message); setState('error') })
  })

  const filteredLines = useMemo(() => {
    if (!query.trim()) return lines.map((text, i) => ({ text, i }))
    const q = query.toLowerCase()
    return lines
      .map((text, i) => ({ text, i }))
      .filter(({ text }) => text.toLowerCase().includes(q))
  }, [lines, query])

  function copyAll() {
    navigator.clipboard.writeText(rawRef.current).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadLog() {
    const blob = new Blob([rawRef.current], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${stepName.replace(/[^a-z0-9]/gi, '_')}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-4 flex-1 flex flex-col rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-[#0d1117]"
           style={{ maxHeight: 'calc(100vh - 2rem)' }}>

        {/* ── Title bar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Terminal className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium text-slate-100 truncate">{stepName}</p>
              <p className="text-xs text-slate-500 font-mono">Job ID: {jobId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
            {state === 'ok' && (
              <>
                <span className="text-xs text-slate-500 font-mono mr-1">
                  {filteredLines.length}/{lines.length} lines
                </span>
                {/* Search */}
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter lines…"
                    className="pl-6 pr-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-36"
                  />
                </div>
                {/* Wrap toggle */}
                <button
                  onClick={() => setWrap((p) => !p)}
                  title={wrap ? 'Disable line wrap' : 'Enable line wrap'}
                  className={`p-1.5 rounded border transition-colors ${
                    wrap
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {wrap ? <WrapText className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                </button>
                {/* Copy */}
                <button
                  onClick={copyAll}
                  title="Copy all to clipboard"
                  className="p-1.5 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {/* Download */}
                <button
                  onClick={downloadLog}
                  title="Download .log file"
                  className="p-1.5 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded border border-slate-700 text-slate-500 hover:text-red-400 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Log body ── */}
        <div className="flex-1 overflow-auto">
          {state === 'loading' && (
            <div className="flex items-center justify-center h-full gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-sm font-mono">Fetching log output…</span>
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-start gap-3 px-6 py-4 rounded-lg bg-red-500/10 border border-red-500/30 max-w-md">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-1">Failed to load log</p>
                  <p className="text-xs text-red-300/80 font-mono break-all">{errMsg}</p>
                </div>
              </div>
            </div>
          )}

          {state === 'ok' && (
            <table className="w-full border-collapse font-mono text-xs">
              <tbody>
                {filteredLines.map(({ text, i }) => {
                  const kind  = classifyLine(text)
                  const lineStyle  = LINE_STYLES[kind]
                  const gutterStyle = LINE_GUTTER[kind]
                  // Highlight search matches
                  let display = text || ' '
                  if (query.trim()) {
                    const idx = display.toLowerCase().indexOf(query.toLowerCase())
                    if (idx !== -1) {
                      display = (
                        <>
                          {display.slice(0, idx)}
                          <mark className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">
                            {display.slice(idx, idx + query.length)}
                          </mark>
                          {display.slice(idx + query.length)}
                        </>
                      )
                    }
                  }
                  return (
                    <tr key={i} className={`group hover:bg-white/5 ${lineStyle}`}>
                      {/* Line number gutter */}
                      <td className={`select-none text-right pr-4 pl-3 py-0.5 w-12 align-top border-r border-slate-800 ${gutterStyle} group-hover:text-slate-500`}
                          style={{ minWidth: '3rem' }}>
                        {i + 1}
                      </td>
                      {/* Line content */}
                      <td className={`px-4 py-0.5 align-top leading-5 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                        {display}
                      </td>
                    </tr>
                  )
                })}
                {filteredLines.length === 0 && query && (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                      No lines match "<span className="text-slate-400">{query}</span>"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Status bar ── */}
        {state === 'ok' && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-[#161b22] border-t border-slate-700 text-xs font-mono text-slate-500">
            <span>
              {query
                ? <><span className="text-yellow-400">{filteredLines.length}</span> matches · {lines.length} total lines</>
                : <>{lines.length} lines</>
              }
            </span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400/60" />
                <span className="text-slate-600">errors</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400/60" />
                <span className="text-slate-600">warnings</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400/60" />
                <span className="text-slate-600">success</span>
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Log trigger button ────────────────────────────────────────────────────────

function LogPanel({ jobId, stepName }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="View CTM output log"
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${t.border} ${t.textMuted} hover:opacity-80`}
      >
        <FileText className="w-3.5 h-3.5" />
        View Log
      </button>

      {open && <LogViewer jobId={jobId} stepName={stepName} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function PhaseStepReport({ app, phase, phaseData, onClose }) {
  const t           = useT()
  const { fmtTime } = useSettings()

  const label   = PHASE_LABELS[phase] || phase
  const colors  = PHASE_COLORS[phase] || PHASE_COLORS.switchover
  const steps   = phaseData?.steps || []
  const total   = phaseData?.totalSteps     || steps.length
  const done    = phaseData?.completedSteps ?? steps.filter((s) => s.status === 'Ended OK').length
  const failed  = phaseData?.failedSteps    ?? steps.filter((s) => s.status === 'Ended Not OK').length
  const running = phaseData?.runningSteps   ?? steps.filter((s) => s.status === 'Executing').length

  const overallFail  = phaseData?.status === 'Ended Not OK'
  const overallRun   = phaseData?.status === 'Executing'
  const overallOk    = phaseData?.status === 'Ended OK'

  const progressPct  = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${t.card} ${t.border} overflow-hidden`}>

        {/* ── Header ── */}
        <div className={`flex-shrink-0 px-6 py-4 border-b ${t.border} ${colors.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${colors.border} ${colors.accent} ${colors.bg}`}>
                  {label}
                </span>
                <h2 className={`text-base font-semibold ${t.text}`}>{app}</h2>
                {overallOk   && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400"><CheckCircle2 className="w-3 h-3" />Completed</span>}
                {overallFail && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400"><XCircle className="w-3 h-3" />Failed</span>}
                {overallRun  && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />Running</span>}
              </div>

              <div className={`flex gap-4 mt-1.5 text-xs flex-wrap ${t.textMuted}`}>
                {phaseData?.startTimeISO && (
                  <span>Start: <span className={`font-mono ${t.textSub}`}>{fmtTime(phaseData.startTimeISO)}</span></span>
                )}
                {phaseData?.estEndISO && phaseData.hasSLA && (
                  <span>SLA deadline: <span className={`font-mono ${colors.accent}`}>{fmtTime(phaseData.estEndISO)}</span></span>
                )}
                {phaseData?.endTimeISO && (
                  <span>End: <span className={`font-mono ${t.textSub}`}>{fmtTime(phaseData.endTimeISO)}</span></span>
                )}
                {phaseData?.elapsedMins != null && (
                  <span>Duration: <span className={`font-mono ${t.textSub}`}>{fmtElapsed(phaseData.elapsedMins)}</span></span>
                )}
              </div>
            </div>

            <button onClick={onClose} className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80 flex-shrink-0`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={t.textMuted}>
                Workflow progress:
                <span className={`font-mono ml-1 font-semibold ${colors.accent}`}>{done}/{total} steps</span>
              </span>
              <div className="flex gap-3">
                {failed > 0  && <span className="text-red-400">{failed} failed</span>}
                {running > 0 && <span className="text-cyan-400">{running} running</span>}
                <span className={`font-mono ${colors.accent}`}>{progressPct}%</span>
              </div>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${t.inner} flex`}>
              <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
              {failed > 0 && (
                <div className="h-full bg-red-500" style={{ width: `${Math.round((failed / total) * 100)}%` }} />
              )}
            </div>
          </div>
        </div>

        {/* Failure banner */}
        {failed > 0 && (
          <div className="flex-shrink-0 px-6 py-2.5 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">
              <strong>{failed} step{failed > 1 ? 's' : ''} failed.</strong>
              {' '}Expand the log for each failed step to see the full CTM output.
            </p>
          </div>
        )}

        {/* ── Steps table ── */}
        <div className="flex-1 overflow-y-auto">
          {steps.length === 0 ? (
            <div className={`flex items-center justify-center h-32 text-sm ${t.textMuted}`}>
              No step data available for this phase.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[580px]">
              <thead className={`sticky top-0 ${t.tableHead} ${t.textMuted}`}>
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Job / Step Name</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">Start</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">End</th>
                  <th className="text-left px-4 py-2.5 font-medium w-16">Duration</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Log</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => {
                  const isOk   = step.status === 'Ended OK'
                  const isFail = step.status === 'Ended Not OK'
                  const isRun  = step.status === 'Executing'

                  return (
                    <>
                      <tr
                        key={step.jobId || i}
                        className={`border-t ${
                          isFail ? `border-red-500/30 bg-red-500/5`
                          : isRun ? `border-cyan-500/20 bg-cyan-500/5`
                          : t.border
                        } ${t.cardHover} transition-colors`}
                      >
                        {/* Step number */}
                        <td className={`px-4 py-3 font-mono font-bold text-sm ${
                          isFail ? 'text-red-400' :
                          isOk   ? 'text-green-400' :
                          isRun  ? 'text-cyan-400' :
                          t.textFaint
                        }`}>
                          {i + 1}/{total}
                        </td>

                        {/* Step name + icon */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {stepStatusIcon(step.status)}
                            <div className="min-w-0">
                              <p className={`font-medium leading-snug ${t.text}`}>{step.name}</p>
                              {step.folder && step.folder !== step.name && (
                                <p className={`text-xs font-mono mt-0.5 truncate ${t.textFaint}`}>{step.folder}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status pill */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                            isRun  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : isOk  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : isFail ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>
                            {isRun && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />}
                            {step.status}
                          </span>
                        </td>

                        {/* Start */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {fmtTime(step.startTimeISO, { second: undefined }) || '—'}
                        </td>

                        {/* End */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {step.endTimeISO
                            ? fmtTime(step.endTimeISO, { second: undefined })
                            : isRun ? <span className="text-cyan-400/70 text-xs italic">Running…</span>
                            : '—'}
                        </td>

                        {/* Duration */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {fmtElapsed(step.elapsedMins)}
                        </td>

                        {/* Log button (fetches via API proxy) */}
                        <td className="px-4 py-3">
                          {step.jobId
                            ? <LogPanel jobId={step.jobId} stepName={step.name} />
                            : <span className={`text-xs ${t.textFaint}`}>—</span>
                          }
                        </td>
                      </tr>

                      {/* Inline error detail for failed steps */}
                      {isFail && step.errorDetail && (
                        <tr key={`${step.jobId}-err`} className="bg-red-500/5 border-b border-red-500/20">
                          <td className="px-4 py-1" />
                          <td colSpan={6} className="px-4 pb-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-400 mb-0.5">Error detail (from CTM status)</p>
                                <p className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">
                                  {step.errorDetail}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-3 border-t ${t.border}`}>
          <p className={`text-xs ${t.textFaint}`}>
            {total} step{total !== 1 ? 's' : ''} · {phaseData?.folder || 'CTM Workflow'} · Log fetched via API proxy
          </p>
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
