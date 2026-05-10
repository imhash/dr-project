/**
 * exportXlsx.js — DR Drill Report Excel export using SheetJS CE
 * Uses aoa_to_sheet (array-of-arrays) which is fully supported in CE 0.18.x.
 * Blob-based download works in all modern browsers.
 */
import * as XLSX from 'xlsx'
import { REPORT_COLUMNS } from './reportBuilder'

function download(wb, filename) {
  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Sheet 1: Full DR Drill Summary ───────────────────────────────────────────
function buildSummarySheet(rows) {
  const headers = REPORT_COLUMNS.map(c => c.label)
  const data = [
    headers,
    ...rows.map(row => REPORT_COLUMNS.map(c => row[c.key] ?? '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = REPORT_COLUMNS.map(c => ({ wch: c.width }))
  ws['!autofilter'] = { ref: ws['!ref'] }
  return ws
}

// ── Sheet 2: RTO Analysis ────────────────────────────────────────────────────
const RTO_COLS = [
  { key: 'Application Name',    label: 'Application',       width: 22 },
  { key: 'Criticality',         label: 'Criticality',       width: 12 },
  { key: 'RPO',                 label: 'RPO',               width: 10 },
  { key: 'Failover / Failback', label: 'Phase',             width: 14 },
  { key: 'RTO Agreed (Hours)',  label: 'RTO Target (Hrs)',  width: 14 },
  { key: 'RTO Agreed (Min)',    label: 'RTO Target (Min)',  width: 14 },
  { key: 'Test Start Time',     label: 'Start Time',        width: 14 },
  { key: 'Test End Time',       label: 'End Time',          width: 14 },
  { key: 'Test Duration',       label: 'Duration',          width: 14 },
  { key: 'Overall Downtime',    label: 'Actual Downtime',   width: 14 },
  { key: 'SLA Status',          label: 'SLA Status',        width: 14 },
  { key: 'Overall Result',      label: 'Result',            width: 14 },
  { key: 'Remarks',             label: 'Remarks',           width: 28 },
]

function buildRtoSheet(rows) {
  const slaRows = rows.filter(r => r['SLA Status'] && r['SLA Status'] !== '—')
  const headers = RTO_COLS.map(c => c.label)
  const data = [
    headers,
    ...slaRows.map(row => RTO_COLS.map(c => row[c.key] ?? '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = RTO_COLS.map(c => ({ wch: c.width }))
  ws['!autofilter'] = { ref: ws['!ref'] }
  return ws
}

// ── Sheet 3: Application Summary (one row per app) ───────────────────────────
const APP_COLS = [
  { key: 'Application Name',    label: 'Application',       width: 22 },
  { key: 'Criticality',         label: 'Criticality',       width: 12 },
  { key: 'RPO',                 label: 'RPO',               width: 10 },
  { key: 'Application Type',    label: 'App Type',          width: 16 },
  { key: 'Service Impact',      label: 'Service Impact',    width: 18 },
  { key: 'Team',                label: 'Team',              width: 16 },
  { key: 'Owner',               label: 'Owner',             width: 22 },
]

function buildAppSummarySheet(rows) {
  // De-duplicate to one row per app, preserving first-seen metadata
  const seen = new Set()
  const appRows = []
  for (const row of rows) {
    if (!seen.has(row['Application Name'])) {
      seen.add(row['Application Name'])
      // Count phases for this app
      const appPhases  = rows.filter(r => r['Application Name'] === row['Application Name'])
      const passCount  = appPhases.filter(r => r['Overall Result'] === 'PASS').length
      const failCount  = appPhases.filter(r => r['Overall Result'] === 'FAIL').length
      const rtoMet     = appPhases.filter(r => ['Met','On Track'].includes(r['SLA Status'])).length
      const rtoBreach  = appPhases.filter(r => ['Missed','Breached'].includes(r['SLA Status'])).length
      appRows.push({
        ...row,
        'Phases':     appPhases.length,
        'Passed':     passCount,
        'Failed':     failCount,
        'RTO Met':    rtoMet,
        'RTO Breach': rtoBreach,
      })
    }
  }

  const extraCols = [
    { key: 'Phases',     label: 'Total Phases', width: 12 },
    { key: 'Passed',     label: 'Passed',        width: 10 },
    { key: 'Failed',     label: 'Failed',        width: 10 },
    { key: 'RTO Met',    label: 'RTO Met',       width: 10 },
    { key: 'RTO Breach', label: 'RTO Breached',  width: 12 },
  ]
  const allCols = [...APP_COLS, ...extraCols]
  const headers = allCols.map(c => c.label)
  const data = [
    headers,
    ...appRows.map(row => allCols.map(c => row[c.key] ?? '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = allCols.map(c => ({ wch: c.width }))
  return ws
}

// ── Public exports ────────────────────────────────────────────────────────────
export function exportDrillReportXlsx(rows, filename) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(rows),    'DR Drill Summary')
  XLSX.utils.book_append_sheet(wb, buildRtoSheet(rows),        'RTO Analysis')
  XLSX.utils.book_append_sheet(wb, buildAppSummarySheet(rows), 'App Summary')
  const ts = new Date().toISOString().slice(0, 10)
  download(wb, filename || `DR_Drill_Report_${ts}.xlsx`)
}

export function exportDrillReportCsv(rows, filename) {
  const headers = REPORT_COLUMNS.map(c => `"${c.label}"`)
  const dataRows = rows.map(row =>
    REPORT_COLUMNS.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const csv  = [headers.join(','), ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename || `DR_Drill_Report_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
