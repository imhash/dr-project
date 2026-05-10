/**
 * reportBuilder.js
 * Converts DR operations (from Control-M API) into structured report rows
 * matching the DR Drill Summary Excel template columns.
 *
 * NOTE: Readiness phase is included in the report but SLA/RTO columns are left
 * blank for it — Readiness has no SLA target by design.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase()   // e.g. "01:22 PM"
}

function fmtDuration(mins) {
  if (mins == null || isNaN(mins)) return ''
  if (mins < 60)  return `${mins} Min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} Hr` : `${h} Hr ${m} Min`
}

import { getAppMeta } from '../config'

// Infer criticality from RTO target:
//   ≤15 min → Critical, ≤30 → High, ≤60 → Medium, else → Low
function inferCriticality(rtoMins) {
  if (!rtoMins) return ''
  if (rtoMins <= 15) return 'Critical'
  if (rtoMins <= 30) return 'High'
  if (rtoMins <= 60) return 'Medium'
  return 'Low'
}

function resolveCriticality(appMeta, hasSLA, rtoMins) {
  if (!hasSLA) return ''
  const c = appMeta.criticality
  if (!c || c === 'inferred') return inferCriticality(rtoMins)
  return c
}

// Derive downtime = how long the phase was actually running (elapsed)
function downtimeRange(phase) {
  if (!phase) return { start: '', end: '', overall: '' }
  const start = phase.startTimeISO
  const end   = phase.endTimeISO || (phase.status === 'Executing' ? new Date().toISOString() : null)
  const mins  = phase.elapsedMins ?? 0
  return {
    start:   fmtTime(start),
    end:     fmtTime(end),
    overall: fmtDuration(mins),
  }
}

// ── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds a flat array of report rows — one row per application per drill phase.
 * Readiness is excluded — it is a pre-drill check, not a drill phase.
 *
 * @param {Array}  operations  — DR operations array
 * @param {object} settingsMeta — settings.appMeta from SettingsContext (overrides config.json)
 */
export function buildReportRows(operations, settingsMeta = {}) {
  const rows = []
  let seq = 1

  for (const op of operations) {
    const phaseEntries = [
      { key: 'switchover', label: 'Switchover' },
      { key: 'switchback', label: 'Switchback' },
      { key: 'failover',   label: 'Failover'   },
      { key: 'failback',   label: 'Failback'   },
    ]

    for (const { key, label } of phaseEntries) {
      const ph = op.phases[key]
      if (!ph) continue   // skip unconfigured phases

      const downtime = downtimeRange(ph)
      const hasSLA   = ph.hasSLA === true   // false for Readiness
      // Merge: config.json base → op.meta → settings.appMeta (settings always wins)
      const cfgMeta  = getAppMeta(op.app, key)
      const opMeta   = op.meta || {}
      const stgMeta  = settingsMeta[op.app] || {}
      const appMeta  = { ...cfgMeta, ...opMeta, ...stgMeta }

      // RTO columns — only populated for SLA phases
      const rtoH   = hasSLA && ph.rtoTargetMins ? Math.floor(ph.rtoTargetMins / 60) : null
      const rtoM   = hasSLA && ph.rtoTargetMins ? ph.rtoTargetMins % 60 : null
      const rtoHours = rtoH != null && rtoH > 0 ? `${rtoH} Hours` : ''
      const rtoMins  = rtoM != null && rtoM > 0 ? `${rtoM} Min`   : ''

      // Test window = phase execution window
      const testStartDate = fmtDate(ph.startTimeISO)
      const testStartTime = fmtTime(ph.startTimeISO)
      const testEndDate   = fmtDate(ph.endTimeISO || ph.estEndISO)
      const testEndTime   = fmtTime(ph.endTimeISO || ph.estEndISO)
      const testDuration  = hasSLA ? fmtDuration(ph.rtoTargetMins) : fmtDuration(ph.elapsedMins)

      // SLA columns — blank for Readiness
      const slaStatus     = hasSLA ? (ph.rtoStatus ?? '') : '—'
      const overallResult =
        ph.status === 'Ended OK'     ? 'PASS'
        : ph.status === 'Ended Not OK' ? 'FAIL'
        : ph.status === 'Executing'    ? 'IN PROGRESS'
        : 'PENDING'

      rows.push({
        '#':                                    seq++,
        'Application Name':                     op.app,
        'Criticality':                          resolveCriticality(appMeta, hasSLA, ph.rtoTargetMins),
        'Application Type':                     appMeta.applicationType || '',
        'Service Impact':                       appMeta.serviceImpact   || '',
        'RPO':                                  appMeta.rpo             || '',
        'Team':                                 appMeta.team            || '',
        'Owner':                                appMeta.owner           || '',
        'If "Others" — Please Specify':         '',
        'Dependency on Another System':         '',
        'Interdependent Systems':               '',
        'RTO Agreed (Hours)':                   rtoHours,
        'RTO Agreed (Min)':                     rtoMins,
        'Test Start Date':                      testStartDate,
        'Test Start Time':                      testStartTime,
        'Test End Date':                        testEndDate,
        'Test End Time':                        testEndTime,
        'Test Duration':                        testDuration,
        'Failover / Failback':                  label,
        'Downtime Start Time':                  downtime.start,
        'Downtime End Time':                    downtime.end,
        'Overall Downtime':                     downtime.overall,
        'SLA Status':                           slaStatus,
        'Overall Result':                       overallResult,
        'CTM Job ID':                           ph.jobId ?? '',
        'CTM Folder':                           ph.folder ?? '',
        'CTM Server':                           op.server,
        'Team Participation':                   '',
        'Remarks':                              key === 'readiness' ? 'No SLA target for Readiness phase'
                                                : (ph.failedSteps > 0 ? `${ph.failedSteps} step(s) failed — check CTM output log` : ''),
      })
    }
  }

  return rows
}

// ── Column metadata (for table header rendering + Excel column widths) ───────

export const REPORT_COLUMNS = [
  { key: '#',                                 label: '#',                          width: 4  },
  { key: 'Application Name',                  label: 'Application Name',           width: 22 },
  { key: 'Criticality',                       label: 'Criticality',                width: 12 },
  { key: 'Application Type',                  label: 'Application Type',           width: 14 },
  { key: 'Service Impact',                    label: 'Service Impact',             width: 14 },
  { key: 'RPO',                               label: 'RPO',                        width: 10 },
  { key: 'Team',                              label: 'Team',                       width: 14 },
  { key: 'Owner',                             label: 'Owner',                      width: 18 },
  { key: 'If "Others" — Please Specify',      label: 'If "Others" — Specify',      width: 18 },
  { key: 'Dependency on Another System',      label: 'Dependency?',                width: 12 },
  { key: 'Interdependent Systems',            label: 'Interdependent Systems',     width: 20 },
  { key: 'RTO Agreed (Hours)',                label: 'RTO (Hours)',                width: 10 },
  { key: 'RTO Agreed (Min)',                  label: 'RTO (Min)',                  width: 10 },
  { key: 'Test Start Date',                   label: 'Test Start Date',            width: 14 },
  { key: 'Test Start Time',                   label: 'Test Start Time',            width: 14 },
  { key: 'Test End Date',                     label: 'Test End Date',              width: 14 },
  { key: 'Test End Time',                     label: 'Test End Time',              width: 14 },
  { key: 'Test Duration',                     label: 'Test Duration',              width: 12 },
  { key: 'Failover / Failback',               label: 'Failover / Failback',        width: 14 },
  { key: 'Downtime Start Time',               label: 'Downtime Start',             width: 14 },
  { key: 'Downtime End Time',                 label: 'Downtime End',               width: 14 },
  { key: 'Overall Downtime',                  label: 'Overall Downtime',           width: 14 },
  { key: 'SLA Status',                        label: 'SLA Status',                 width: 12 },
  { key: 'Overall Result',                    label: 'Overall Result',             width: 14 },
  { key: 'CTM Job ID',                        label: 'CTM Job ID',                 width: 14 },
  { key: 'CTM Folder',                        label: 'CTM Folder',                 width: 28 },
  { key: 'CTM Server',                        label: 'CTM Server',                 width: 12 },
  { key: 'Team Participation',                label: 'Team Participation',         width: 20 },
  { key: 'Remarks',                           label: 'Remarks',                    width: 20 },
]
