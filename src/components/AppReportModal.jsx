/**
 * AppReportModal — per-application DR drill report
 *
 * Shows every phase and its steps for one application, with start/end times,
 * durations, RTO status, and an export-to-CSV button.
 */

import { useRef, useState } from 'react'
import {
  X, Download, CheckCircle2, XCircle, Clock,
  Loader2, FolderOpen, Eye, EyeOff,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { getAppMeta } from '../config'

// ── constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER  = ['switchover', 'switchback', 'readiness', 'failover', 'failback']
const PHASE_LABELS = {
  switchover: 'Switchover',
  switchback: 'Switchback',
  readiness:  'Readiness',
  failover:   'Failover',
  failback:   'Failback',
}
const PHASE_COLORS = {
  switchover: { accent: 'text-sky-500',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30'     },
  switchback: { accent: 'text-violet-500',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30'  },
  readiness:  { accent: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  failover:   { accent: 'text-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30'  },
  failback:   { accent: 'text-pink-500',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30'    },
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso, { fmtTime }) {
  if (!iso) return '—'
  return fmtTime(iso)
}

function fmtDur(mins) {
  if (mins == null || isNaN(mins)) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function StepStatusIcon({ status }) {
  if (status === 'Ended OK')     return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'Ended Not OK') return <XCircle      className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  if (status === 'Executing')    return <Loader2      className="w-3.5 h-3.5 text-cyan-500 animate-spin flex-shrink-0" />
  return                                <Clock        className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
}

function statusPill(status) {
  if (status === 'Ended OK')     return 'bg-green-500/10 border-green-500/30 text-green-600'
  if (status === 'Ended Not OK') return 'bg-red-500/10 border-red-500/30 text-red-600'
  if (status === 'Executing')    return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600'
  return 'bg-slate-500/10 border-slate-500/30 text-slate-500'
}

function rtoPill(rtoStatus) {
  if (!rtoStatus || rtoStatus === 'N/A') return 'bg-slate-500/10 border-slate-500/30 text-slate-500'
  if (rtoStatus === 'Met' || rtoStatus === 'On Track') return 'bg-green-500/10 border-green-500/30 text-green-600'
  if (rtoStatus === 'At Risk')   return 'bg-amber-500/10 border-amber-500/30 text-amber-600'
  return 'bg-red-500/10 border-red-500/30 text-red-600'
}

// ── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(operation, fmtTime) {
  const rows = []
  rows.push([
    'Phase', 'Phase Status', 'Phase Start', 'Phase End', 'Phase Duration',
    'RTO Target (min)', 'RTO Status',
    'Step #', 'Job Name', 'Description', 'Application', 'Sub-Application', 'Folder',
    'Step Status', 'Step Start', 'Step End', 'Step Duration (min)',
  ])

  for (const ph of PHASE_ORDER) {
    const phase = operation.phases[ph]
    if (!phase) continue
    const label = PHASE_LABELS[ph]
    const steps = phase.steps ?? []

    if (steps.length === 0) {
      rows.push([
        label, phase.status,
        phase.startTimeISO ? fmtTime(phase.startTimeISO) : '',
        phase.endTimeISO   ? fmtTime(phase.endTimeISO)   : '',
        fmtDur(phase.elapsedMins),
        phase.rtoTargetMins ?? '', phase.rtoStatus ?? '',
        '', '', '', '', '', '', '', '', '', '',
      ])
    } else {
      steps.forEach((step, i) => {
        rows.push([
          label, phase.status,
          phase.startTimeISO ? fmtTime(phase.startTimeISO) : '',
          phase.endTimeISO   ? fmtTime(phase.endTimeISO)   : '',
          fmtDur(phase.elapsedMins),
          phase.rtoTargetMins ?? '', phase.rtoStatus ?? '',
          i + 1, step.name, step.description ?? '', step.application ?? '', step.subApplication ?? '', step.folder,
          step.status,
          step.startTimeISO ? fmtTime(step.startTimeISO) : '',
          step.endTimeISO   ? fmtTime(step.endTimeISO)   : '',
          step.elapsedMins ?? '',
        ])
      })
    }
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `DR-Report_${operation.app}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Phase section ─────────────────────────────────────────────────────────────

function PhaseSection({ phaseKey, phase, app, showFolders }) {
  const t              = useT()
  const { fmtTime }    = useSettings()
  const c              = PHASE_COLORS[phaseKey]
  const label          = PHASE_LABELS[phaseKey]
  const steps          = phase.steps ?? []
  const folderEntries  = phase.folderEntries ?? []
  const meta           = getAppMeta(app, phaseKey)

  const completedSteps = steps.filter((s) => s.status === 'Ended OK').length
  const failedSteps    = steps.filter((s) => s.status === 'Ended Not OK').length

  return (
    <div className={`rounded-xl border ${t.border} overflow-hidden`}>
      {/* Phase header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${t.tableHead}`}>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.border} ${c.accent}`}>
          {label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border ${statusPill(phase.status)}`}>
          {phase.status}
        </span>
        {phase.rtoStatus && phase.rtoStatus !== 'N/A' && (
          <span className={`text-xs px-2 py-0.5 rounded border ${rtoPill(phase.rtoStatus)}`}>
            SLA: {phase.rtoStatus}
          </span>
        )}
        <div className="flex items-center gap-4 ml-auto text-xs">
          <span className={t.textMuted}>Start: <span className={`font-mono ${t.textSub}`}>{fmt(phase.startTimeISO, { fmtTime })}</span></span>
          <span className={t.textMuted}>End: <span className={`font-mono ${t.textSub}`}>{fmt(phase.endTimeISO, { fmtTime })}</span></span>
          <span className={t.textMuted}>Duration: <span className={`font-mono ${t.textSub}`}>{fmtDur(phase.elapsedMins)}</span></span>
          {phase.rtoTargetMins && (
            <span className={t.textMuted}>RTO: <span className={`font-mono ${t.textSub}`}>{phase.rtoTargetMins}m</span></span>
          )}
          <span className={t.textMuted}>
            Steps: <span className={`font-mono ${failedSteps > 0 ? 'text-red-500' : completedSteps === steps.length && steps.length > 0 ? 'text-green-500' : t.textSub}`}>
              {completedSteps}/{steps.length}
            </span>
          </span>
        </div>
      </div>

      {/* Metadata strip */}
      <div className={`flex gap-4 px-4 py-2 text-xs border-t ${t.border} ${t.inner}`}>
        <span className={t.textFaint}>Type: <span className={t.textMuted}>{meta.applicationType}</span></span>
        {meta.criticality && meta.criticality !== 'inferred' && (
          <span className={t.textFaint}>Criticality: <span className={t.textMuted}>{meta.criticality}</span></span>
        )}
        <span className={t.textFaint}>Impact: <span className={t.textMuted}>{meta.serviceImpact}</span></span>
      </div>

      {/* Steps — chronological; folders interleaved when showFolders is on */}
      {(() => {
        // Merge steps + folder entries into one chronological list when folders visible
        const allRows = showFolders
          ? [...steps.map((s) => ({ ...s, _isFolder: false })),
             ...folderEntries.map((f) => ({ ...f, _isFolder: true }))]
              .sort((a, b) => {
                const ta = a.startTimeISO ? new Date(a.startTimeISO).getTime() : 0
                const tb = b.startTimeISO ? new Date(b.startTimeISO).getTime() : 0
                return ta - tb
              })
          : steps.map((s) => ({ ...s, _isFolder: false }))

        if (allRows.length === 0) {
          return <p className={`px-4 py-3 text-xs ${t.textFaint} italic`}>No steps recorded for this phase.</p>
        }

        let stepSeq = 0
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[820px]">
              <thead className={`${t.tableHead} ${t.textMuted} sticky top-0 z-10`}>
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-8">#</th>
                  <th className="text-left px-3 py-2 font-medium">Job Name</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Application</th>
                  <th className="text-left px-3 py-2 font-medium">Sub-Application</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Start Time</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">End Time</th>
                  <th className="text-left px-3 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => {
                  const prev = allRows[i - 1]
                  const groupChanged = !prev
                    || (row.application || '—') !== (prev.application || '—')
                    || (row.subApplication || '—') !== (prev.subApplication || '—')

                  if (!row._isFolder) stepSeq++

                  return (
                    <>
                      {groupChanged && (
                        <tr key={`grp-${i}`} className={`${t.inner} border-y ${t.border}`}>
                          <td colSpan={9} className="px-3 py-1.5">
                            <span className={`font-semibold text-xs ${t.textSub}`}>{row.application || '—'}</span>
                            <span className={`mx-1.5 ${t.textFaint}`}>/</span>
                            <span className={`text-xs ${t.textMuted}`}>{row.subApplication || '—'}</span>
                          </td>
                        </tr>
                      )}

                      {row._isFolder ? (
                        /* Folder entry row — muted, no step number */
                        <tr key={`f-${row.jobId || i}`} className={`border-b border-[var(--border)] ${t.inner} opacity-75`}>
                          <td className={`px-3 py-2 ${t.textFaint}`}>—</td>
                          <td className={`px-3 py-2 ${t.textMuted} whitespace-nowrap`}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className={`w-3.5 h-3.5 ${t.textFaint} flex-shrink-0`} />
                              <span className="font-mono">{row.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.border} ${t.textFaint}`}>folder</span>
                            </div>
                          </td>
                          <td className={`px-3 py-2 ${t.textFaint}`}>{row.description || '—'}</td>
                          <td className={`px-3 py-2 ${t.textFaint}`}>{row.application || '—'}</td>
                          <td className={`px-3 py-2 ${t.textFaint}`}>{row.subApplication || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded border text-xs ${statusPill(row.status)}`}>{row.status}</span>
                          </td>
                          <td className={`px-3 py-2 font-mono ${t.textFaint} whitespace-nowrap`}>{fmt(row.startTimeISO, { fmtTime })}</td>
                          <td className={`px-3 py-2 font-mono ${t.textFaint} whitespace-nowrap`}>{fmt(row.endTimeISO, { fmtTime })}</td>
                          <td className={`px-3 py-2 font-mono ${t.textFaint}`}>{fmtDur(row.elapsedMins)}</td>
                        </tr>
                      ) : (
                        /* Regular step row */
                        <tr
                          key={row.jobId || i}
                          className={`hover:bg-[var(--cardHover)] transition-colors border-b border-[var(--border)] ${row.status === 'Ended Not OK' ? 'bg-red-500/5' : ''}`}
                        >
                          <td className={`px-3 py-2.5 ${t.textFaint} font-mono`}>{stepSeq}</td>
                          <td className={`px-3 py-2.5 font-mono ${t.textSub} whitespace-nowrap`}>
                            <div className="flex items-center gap-2">
                              <StepStatusIcon status={row.status} />
                              {row.name}
                            </div>
                          </td>
                          <td className={`px-3 py-2.5 ${t.textMuted} max-w-[160px] truncate`} title={row.description || ''}>{row.description || '—'}</td>
                          <td className={`px-3 py-2.5 ${t.textMuted}`}>{row.application || '—'}</td>
                          <td className={`px-3 py-2.5 ${t.textMuted}`}>{row.subApplication || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded border text-xs ${statusPill(row.status)}`}>{row.status}</span>
                          </td>
                          <td className={`px-3 py-2.5 font-mono ${t.textMuted} whitespace-nowrap`}>{fmt(row.startTimeISO, { fmtTime })}</td>
                          <td className={`px-3 py-2.5 font-mono ${t.textMuted} whitespace-nowrap`}>{fmt(row.endTimeISO, { fmtTime })}</td>
                          <td className={`px-3 py-2.5 font-mono ${t.textMuted}`}>{fmtDur(row.elapsedMins)}</td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ operation }) {
  const t = useT()
  const phases = PHASE_ORDER.map((k) => operation.phases[k]).filter(Boolean)
  const allSteps = phases.flatMap((p) => p.steps ?? [])
  const totalSteps     = allSteps.length
  const completedSteps = allSteps.filter((s) => s.status === 'Ended OK').length
  const failedSteps    = allSteps.filter((s) => s.status === 'Ended Not OK').length

  return (
    <div className={`flex flex-wrap gap-4 text-xs ${t.textMuted}`}>
      <span>Phases: <span className={`font-semibold ${t.textSub}`}>{phases.length}</span></span>
      <span>Total Steps: <span className={`font-semibold ${t.textSub}`}>{totalSteps}</span></span>
      <span className="text-green-600">Completed: <span className="font-semibold">{completedSteps}</span></span>
      {failedSteps > 0 && (
        <span className="text-red-600">Failed: <span className="font-semibold">{failedSteps}</span></span>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AppReportModal({ operation, onClose }) {
  const t              = useT()
  const { fmtTime }    = useSettings()
  const overlayRef     = useRef(null)
  const [showFolders, setShowFolders] = useState(false)

  const presentPhases = PHASE_ORDER.filter((k) => operation.phases[k])

  function handleOverlay(e) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8"
      onClick={handleOverlay}
    >
      <div className={`relative w-full max-w-5xl mx-4 rounded-2xl border ${t.border} ${t.card} shadow-2xl flex flex-col`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${t.text}`}>{operation.app}</span>
              <span className={`text-xs px-2 py-0.5 rounded border font-mono ${t.border} ${t.textMuted}`}>{operation.server}</span>
            </div>
            <p className={`text-xs mt-0.5 ${t.textFaint}`}>DR Drill — Application Report</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFolders((p) => !p)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showFolders
                  ? `bg-blue-600/10 border-blue-500/30 text-blue-500`
                  : `border-[var(--border)] ${t.textMuted} hover:opacity-80`
              }`}
            >
              {showFolders ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showFolders ? 'Hide Folders' : 'Show Folders'}
            </button>
            <button
              onClick={() => exportCsv(operation, fmtTime)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button onClick={onClose} className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-70 transition-opacity`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className={`px-6 py-3 border-b ${t.border} ${t.inner}`}>
          <SummaryStrip operation={operation} />
        </div>

        {/* Phases */}
        <div className="flex flex-col gap-4 p-6">
          {presentPhases.length === 0 ? (
            <p className={`text-sm ${t.textFaint} text-center py-8`}>No phase data available for this application.</p>
          ) : (
            presentPhases.map((phaseKey) => (
              <PhaseSection
                key={phaseKey}
                phaseKey={phaseKey}
                phase={operation.phases[phaseKey]}
                app={operation.app}
                showFolders={showFolders}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
