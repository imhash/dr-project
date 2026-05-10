import { useState, useMemo } from 'react'
import { X, FileText, Printer, Download, Check, Eye, EyeOff, Clock, Mail } from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { buildReportRows } from '../utils/reportBuilder'

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'executive',
    label: 'Executive Summary',
    audience: 'C-Level / Board',
    icon: '📊',
    desc: 'High-level drill outcome, RTO compliance, application results. No technical detail.',
    sections: ['cover', 'overview', 'metrics', 'appTable', 'rtoCompliance', 'rpoCompliance'],
  },
  {
    id: 'operational',
    label: 'Operational Evidence',
    audience: 'DR / BCP Team',
    icon: '🔧',
    desc: 'Full phase detail per application, RTO actuals vs targets, failure log, remediation.',
    sections: ['cover', 'metrics', 'appTable', 'rtoCompliance', 'rpoCompliance', 'phaseDetail', 'stepOutputs', 'failureLog', 'remediation', 'contacts'],
  },
  {
    id: 'custom',
    label: 'Custom',
    audience: 'Configurable',
    icon: '⚙️',
    desc: 'Choose exactly which sections to include.',
    sections: [],
  },
]

const ALL_SECTIONS = [
  { id: 'cover',          label: 'Cover Page' },
  { id: 'overview',       label: 'Executive Overview' },
  { id: 'metrics',        label: 'Drill Metrics' },
  { id: 'appTable',       label: 'Application Results Table' },
  { id: 'rtoCompliance',  label: 'RTO Compliance Summary' },
  { id: 'rpoCompliance',  label: 'RPO Compliance Summary' },
  { id: 'phaseDetail',    label: 'Phase-by-Phase Detail' },
  { id: 'failureLog',     label: 'Failure Log' },
  { id: 'remediation',    label: 'Remediation Actions' },
  { id: 'stepOutputs',    label: 'Step Outputs (per Phase)' },
  { id: 'contacts',       label: 'Owner Contact List' },
]

const SCHEDULES = ['Disabled', 'After every DR Drill (auto)', 'Weekly — Monday 08:00', 'Monthly — 1st, 08:00', 'Quarterly']

// ─── PDF builder ──────────────────────────────────────────────────────────────
function buildEvidenceHtml({
  operations, rows, settingsMeta = {}, title, org, preparedFor, preparedBy,
  includeDate, includeConfidential, drillDate, drillRef,
  template, sections, footerText = '', forPreview = false,
}) {
  const hasSec = id => sections.includes(id)
  const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const drillDateFmt = drillDate
    ? new Date(drillDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : today

  // Metrics from rows (drill phases only — readiness excluded)
  const apps      = [...new Set(rows.map(r => r['Application Name']))]
  const totalApps = apps.length
  const totalPhases = rows.length
  const passRows  = rows.filter(r => r['Overall Result'] === 'PASS')
  const failRows  = rows.filter(r => r['Overall Result'] === 'FAIL')
  const inpRows   = rows.filter(r => r['Overall Result'] === 'IN PROGRESS')
  const rtoMetRows   = rows.filter(r => ['Met','On Track'].includes(r['SLA Status']))
  const rtoBrRows    = rows.filter(r => ['Missed','Breached'].includes(r['SLA Status']))
  const passRate  = totalPhases > 0 ? Math.round(passRows.length / totalPhases * 100) : 0
  const rtoRate   = (rtoMetRows.length + rtoBrRows.length) > 0
    ? Math.round(rtoMetRows.length / (rtoMetRows.length + rtoBrRows.length) * 100) : 0
  // RPO — per app: met if drill passed, breached if drill failed (for apps with RPO configured)
  // computed after appSummary is built below; referenced in metrics section via IIFE

  // Per-app summary — meta pulled from rows (already merged with settings) + settingsMeta fallback
  const appSummary = apps.map(app => {
    const appRows = rows.filter(r => r['Application Name'] === app)
    const firstRow = appRows[0] || {}
    // rows already have Criticality/RPO/Team/Owner from buildReportRows (settings merged)
    const m = {
      criticality:     firstRow['Criticality'] || settingsMeta[app]?.criticality || '',
      rpo:             firstRow['RPO']         || settingsMeta[app]?.rpo          || '',
      team:            firstRow['Team']        || settingsMeta[app]?.team         || '',
      owner:           firstRow['Owner']       || settingsMeta[app]?.owner        || '',
      applicationType: firstRow['Application Type'] || settingsMeta[app]?.applicationType || '',
    }
    const pass = appRows.filter(r => r['Overall Result'] === 'PASS').length
    const fail = appRows.filter(r => r['Overall Result'] === 'FAIL').length
    const rtoMet = appRows.filter(r => ['Met','On Track'].includes(r['SLA Status'])).length
    const overall = fail > 0 ? 'FAIL' : appRows.some(r => r['Overall Result'] === 'IN PROGRESS') ? 'IN PROGRESS' : 'PASS'
    return { app, m, appRows, pass, fail, rtoMet, overall }
  })

  const failedPhases = rows.filter(r => r['Overall Result'] === 'FAIL')

  const badgeStyle = (val) => {
    if (val === 'PASS' || val === 'Met' || val === 'On Track') return 'background:#dcfce7;color:#15803d'
    if (val === 'FAIL' || val === 'Missed' || val === 'Breached') return 'background:#fee2e2;color:#dc2626'
    if (val === 'IN PROGRESS') return 'background:#dbeafe;color:#1d4ed8'
    if (val === 'At Risk') return 'background:#fef9c3;color:#a16207'
    return 'background:#f1f5f9;color:#475569'
  }

  const critBadge = (c) => {
    if (c === 'Critical') return 'background:#fee2e2;color:#dc2626'
    if (c === 'High')     return 'background:#ffedd5;color:#ea580c'
    if (c === 'Medium')   return 'background:#fef9c3;color:#a16207'
    return 'background:#f1f5f9;color:#475569'
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title || 'DR Drill Evidence Report'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10.5pt; color:#1a1a2e; background:#fff; }
  h1 { font-size:22pt; }
  h2 { font-size:12.5pt; color:#1e3a5f; border-bottom:2.5px solid #c2cfe0; padding-bottom:6px; margin:28px 0 12px; }
  h3 { font-size:10.5pt; color:#1e3a5f; margin:14px 0 6px; font-weight:600; }
  p  { margin:6px 0; line-height:1.6; color:#334155; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; margin:8px 0; }
  th { background:#dde4f0; color:#1e3a5f; text-align:left; padding:7px 9px; font-weight:600; white-space:nowrap; }
  td { padding:6px 9px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
  tr:nth-child(even) td { background:#f8fafc; }
  .cover { background:linear-gradient(135deg,#1e3a5f 0%,#0f2440 100%); color:white; padding:60px 50px 50px; }
  .cover h1 { color:white; margin-bottom:10px; font-size:24pt; }
  .cover .sub { color:#a8c4e0; font-size:10pt; margin-top:4px; }
  .cover-divider { border-top:1px solid rgba(255,255,255,0.2); margin:28px 0 20px; }
  .cover-meta { display:grid; grid-template-columns:150px 1fr; gap:5px 14px; font-size:10pt; }
  .cover-meta .lbl { color:#7ba3c8; }
  .cover-meta .val { color:#cbd5e1; }
  .cover-ref { display:inline-block; margin-top:20px; padding:6px 16px; border:1px solid rgba(255,255,255,0.25); border-radius:6px; font-size:9pt; color:#a8c4e0; letter-spacing:0.5px; }
  .confidential { color:#fca5a5; font-size:8.5pt; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:16px; }
  .content { padding:36px 50px; }
  .metric-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:12px 0 20px; }
  .metric-card { border:1px solid #c2cfe0; border-radius:8px; padding:14px 10px; text-align:center; }
  .metric-val  { font-size:22pt; font-weight:700; }
  .metric-lbl  { font-size:8.5pt; color:#64748b; margin-top:3px; }
  .badge { display:inline-block; padding:2px 9px; border-radius:20px; font-size:8.5pt; font-weight:600; }
  .phase-block { border:1px solid #c2cfe0; border-radius:6px; margin:10px 0; overflow:hidden; }
  .phase-hdr { background:#eef2f8; padding:7px 12px; font-weight:600; font-size:9.5pt; color:#1e3a5f; display:flex; justify-content:space-between; align-items:center; }
  .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:20px; }
  .sig-box { border-top:2px solid #94a3b8; padding-top:8px; }
  .sig-role { font-size:8.5pt; color:#64748b; }
  .sig-space { height:40px; }
  .report-footer { border-top:1px solid #e2e8f0; margin-top:36px; padding:10px 0 4px; font-size:8pt; color:#94a3b8; text-align:center; }
  .risk-box { background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:12px 16px; margin:8px 0; }
  .step-block { margin:6px 0; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; }
  .step-hdr { display:flex; align-items:center; gap:8px; padding:5px 10px; background:#f8fafc; font-size:8.5pt; font-weight:600; color:#334155; }
  .step-log { padding:6px 10px; background:#0f172a; border-top:1px solid #e2e8f0; font-family:monospace; font-size:7.5pt; }
  .step-log-line { color:#94a3b8; margin:1px 0; }
  .step-log-line.err { color:#f87171; }
  .step-log-line.warn { color:#fbbf24; }
  .step-log-line.ok { color:#4ade80; }
  .run-block { border:1px solid #dde4f0; border-radius:6px; margin:8px 0; overflow:hidden; }
  .run-hdr { background:#eef2f8; padding:5px 12px; font-size:8.5pt; font-weight:600; color:#1e3a5f; display:flex; gap:10px; align-items:center; }
  .risk-box ul { padding-left:18px; margin-top:6px; }
  .risk-box li { margin:4px 0; color:#be123c; font-size:9.5pt; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none; }
    @page { margin:14mm; }
    h2 { page-break-after:avoid; }
    .phase-block { page-break-inside:avoid; }
  }
</style>
</head>
<body>

${hasSec('cover') ? `
<div class="cover">
  ${includeConfidential ? '<div class="confidential">Confidential — Internal Use Only</div>' : ''}
  <h1>${title || 'DR Drill Evidence Report'}</h1>
  <div class="sub">Disaster Recovery Drill — Official Evidence Document</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    ${org         ? `<span class="lbl">Organization</span><span class="val">${org}</span>` : ''}
    ${preparedFor ? `<span class="lbl">Prepared For</span><span class="val">${preparedFor}</span>` : ''}
    ${preparedBy  ? `<span class="lbl">Prepared By</span><span class="val">${preparedBy}</span>` : ''}
    ${includeDate ? `<span class="lbl">Drill Date</span><span class="val">${drillDateFmt}</span>` : ''}
    ${includeDate ? `<span class="lbl">Report Date</span><span class="val">${today}</span>` : ''}
    <span class="lbl">Applications</span><span class="val">${totalApps}</span>
    <span class="lbl">Drill Phases</span><span class="val">${totalPhases}</span>
  </div>
  ${drillRef ? `<div class="cover-ref">Ref: ${drillRef}</div>` : ''}
</div>` : ''}

<div class="content">

${hasSec('overview') ? `
<h2>Executive Overview</h2>
<p>This report documents the Disaster Recovery (DR) drill conducted on <strong>${drillDateFmt}</strong>
covering <strong>${totalApps} application(s)</strong> across <strong>${totalPhases} drill phase(s)</strong>
(Switchover / Switchback / Failover / Failback).</p>
<p>Overall phase pass rate: <strong>${passRate}%</strong> (${passRows.length} of ${totalPhases} phases passed).
RTO compliance: <strong>${rtoRate}%</strong>.
${failRows.length > 0
  ? `<strong>${[...new Set(failRows.map(r=>r['Application Name']))].length} application(s) recorded failures</strong> and require remediation before next DR activation.`
  : 'All applications completed their drill phases successfully.'}
</p>` : ''}

${hasSec('metrics') ? `
<h2>Drill Metrics</h2>
<div class="metric-grid">
  <div class="metric-card">
    <div class="metric-val" style="color:#1e3a5f">${totalApps}</div>
    <div class="metric-lbl">Applications</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#15803d">${passRows.length}</div>
    <div class="metric-lbl">Phases Passed</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#dc2626">${failRows.length}</div>
    <div class="metric-lbl">Phases Failed</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:${passRate>=80?'#15803d':passRate>=60?'#d97706':'#dc2626'}">${passRate}%</div>
    <div class="metric-lbl">Pass Rate</div>
  </div>
</div>
<div class="metric-grid">
  <div class="metric-card">
    <div class="metric-val" style="color:#15803d">${rtoMetRows.length}</div>
    <div class="metric-lbl">RTO Met</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#dc2626">${rtoBrRows.length}</div>
    <div class="metric-lbl">RTO Breached</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#d97706">${rows.filter(r=>r['SLA Status']==='At Risk').length}</div>
    <div class="metric-lbl">At Risk</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:${rtoRate>=80?'#15803d':rtoRate>=60?'#d97706':'#dc2626'}">${rtoRate}%</div>
    <div class="metric-lbl">RTO Compliance</div>
  </div>
</div>
${(() => {
  const rpoAppsAll  = appSummary.filter(a => a.m.rpo)
  const rpoMetCount = rpoAppsAll.filter(a => a.overall === 'PASS').length
  const rpoBrCount  = rpoAppsAll.filter(a => a.overall === 'FAIL').length
  if (rpoAppsAll.length === 0) return ''
  return `<div class="metric-grid">
  <div class="metric-card">
    <div class="metric-val" style="color:#1e3a5f">${rpoAppsAll.length}</div>
    <div class="metric-lbl">Apps with RPO</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#15803d">${rpoMetCount}</div>
    <div class="metric-lbl">RPO Met</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#dc2626">${rpoBrCount}</div>
    <div class="metric-lbl">RPO Breached</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:${rpoMetCount===rpoAppsAll.length?'#15803d':rpoBrCount>0?'#dc2626':'#d97706'}">${rpoAppsAll.length > 0 ? Math.round(rpoMetCount/rpoAppsAll.length*100) : 0}%</div>
    <div class="metric-lbl">RPO Compliance</div>
  </div>
</div>`
})()}` : ''}

${hasSec('appTable') ? `
<h2>Application Results</h2>
<table>
  <tr>
    <th>#</th><th>Application</th><th>Criticality</th><th>RPO</th><th>Team</th>
    <th>Phases</th><th>Pass</th><th>Fail</th><th>RTO Met</th><th>Overall</th>
  </tr>
  ${appSummary.map((a, i) => `<tr>
    <td style="text-align:center;color:#94a3b8">${i+1}</td>
    <td><strong>${a.app}</strong></td>
    <td>${a.m.criticality ? `<span class="badge" style="${critBadge(a.m.criticality)}">${a.m.criticality}</span>` : '—'}</td>
    <td>${a.m.rpo || '—'}</td>
    <td>${a.m.team || '—'}</td>
    <td style="text-align:center">${a.appRows.length}</td>
    <td style="text-align:center;color:#15803d;font-weight:600">${a.pass}</td>
    <td style="text-align:center;color:${a.fail>0?'#dc2626':'#94a3b8'};font-weight:600">${a.fail}</td>
    <td style="text-align:center">${a.rtoMet}/${a.appRows.filter(r=>r['SLA Status']&&r['SLA Status']!=='—').length}</td>
    <td><span class="badge" style="${badgeStyle(a.overall)}">${a.overall}</span></td>
  </tr>`).join('')}
</table>` : ''}

${hasSec('rtoCompliance') ? `
<h2>RTO Compliance</h2>
<p style="font-size:9.5pt;color:#475569;margin-bottom:8px">
  RTO (Recovery Time Objective) defines the maximum tolerable downtime. ${rtoMetRows.length} of ${rtoMetRows.length+rtoBrRows.length} measurable phases met their RTO target (${rtoRate}% compliance).
</p>
<table>
  <tr><th>Application</th><th>Phase</th><th>RTO Target</th><th>Actual Duration</th><th>SLA Status</th><th>RTO Fulfilled</th><th>Start</th><th>End</th></tr>
  ${rows.filter(r => r['SLA Status'] && r['SLA Status'] !== '—').map(r => {
    const fulfilled = ['Met','On Track'].includes(r['SLA Status'])
    return `<tr>
    <td>${r['Application Name']}</td>
    <td><span class="badge" style="${
      r['Failover / Failback']==='Switchover'?'background:#e0f2fe;color:#0369a1':
      r['Failover / Failback']==='Switchback'?'background:#f3e8ff;color:#7e22ce':
      'background:#f0fdf4;color:#166534'
    }">${r['Failover / Failback']}</span></td>
    <td>${r['RTO Agreed (Hours)'] || ''} ${r['RTO Agreed (Min)'] || ''}</td>
    <td><strong>${r['Overall Downtime'] || '—'}</strong></td>
    <td><span class="badge" style="${badgeStyle(r['SLA Status'])}">${r['SLA Status']}</span></td>
    <td><span class="badge" style="${fulfilled ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#dc2626'}">${fulfilled ? '✓ Yes' : '✗ No'}</span></td>
    <td style="font-size:8.5pt;color:#64748b">${r['Test Start Time'] || '—'}</td>
    <td style="font-size:8.5pt;color:#64748b">${r['Test End Time'] || '—'}</td>
  </tr>`}).join('')}
</table>` : ''}

${hasSec('rpoCompliance') ? (() => {
  const rpoApps = appSummary.filter(a => a.m.rpo)
  const rpoMet  = rpoApps.filter(a => a.overall === 'PASS')
  const rpoMiss = rpoApps.filter(a => a.overall === 'FAIL')
  return `
<h2>RPO Compliance</h2>
<p style="font-size:9.5pt;color:#475569;margin-bottom:8px">
  RPO (Recovery Point Objective) defines the maximum tolerable data loss window.
  ${rpoApps.length === 0 ? 'No RPO targets configured — set values in App Metadata settings.' :
    `${rpoMet.length} of ${rpoApps.length} applications with RPO targets passed their drill.`}
</p>
${rpoApps.length > 0 ? `<table>
  <tr><th>Application</th><th>Criticality</th><th>RPO Target</th><th>Team</th><th>Owner</th><th>Drill Result</th><th>RPO Status</th></tr>
  ${rpoApps.map(a => {
    const rpoOk = a.overall === 'PASS'
    return `<tr>
      <td><strong>${a.app}</strong></td>
      <td>${a.m.criticality ? `<span class="badge" style="${critBadge(a.m.criticality)}">${a.m.criticality}</span>` : '—'}</td>
      <td><strong>${a.m.rpo}</strong></td>
      <td>${a.m.team || '—'}</td>
      <td style="font-size:8.5pt">${a.m.owner || '—'}</td>
      <td><span class="badge" style="${badgeStyle(a.overall)}">${a.overall}</span></td>
      <td><span class="badge" style="${rpoOk ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#dc2626'}">${rpoOk ? '✓ Met' : '✗ At Risk'}</span></td>
    </tr>`
  }).join('')}
</table>
${rpoMiss.length > 0 ? `<div class="risk-box" style="margin-top:10px">
  <strong style="color:#be123c">RPO risk identified for ${rpoMiss.length} application(s):</strong>
  <ul>${rpoMiss.map(a => `<li><strong>${a.app}</strong> (RPO: ${a.m.rpo}) — drill phase(s) failed, data recovery point may be at risk</li>`).join('')}</ul>
</div>` : ''}` : ''}
`})() : ''}

${hasSec('phaseDetail') ? `
<h2>Phase-by-Phase Detail</h2>
${appSummary.map(a => `
  <h3>${a.app} <span style="font-size:8.5pt;color:#94a3b8;font-weight:400">${a.m.team ? '· '+a.m.team : ''}</span></h3>
  <div class="phase-block">
    <table style="margin:0">
      <tr><th>Phase</th><th>Start Date</th><th>Start Time</th><th>End Time</th><th>Duration</th><th>Downtime</th><th>RTO</th><th>SLA</th><th>Result</th><th>CTM Job</th><th>Remarks</th></tr>
      ${a.appRows.map(r => `<tr>
        <td><span class="badge" style="${
          r['Failover / Failback']==='Switchover'?'background:#e0f2fe;color:#0369a1':
          r['Failover / Failback']==='Switchback'?'background:#f3e8ff;color:#7e22ce':
          'background:#f0fdf4;color:#166534'
        }">${r['Failover / Failback']}</span></td>
        <td style="font-size:8.5pt">${r['Test Start Date']||'—'}</td>
        <td style="font-size:8.5pt">${r['Test Start Time']||'—'}</td>
        <td style="font-size:8.5pt">${r['Test End Time']||'—'}</td>
        <td>${r['Test Duration']||'—'}</td>
        <td>${r['Overall Downtime']||'—'}</td>
        <td style="font-size:8.5pt">${r['RTO Agreed (Hours)']||''} ${r['RTO Agreed (Min)']||''}</td>
        <td><span class="badge" style="${badgeStyle(r['SLA Status'])}">${r['SLA Status']||'—'}</span></td>
        <td><span class="badge" style="${badgeStyle(r['Overall Result'])}">${r['Overall Result']}</span></td>
        <td style="font-family:monospace;font-size:8pt;color:#64748b">${r['CTM Job ID']||'—'}</td>
        <td style="font-size:8.5pt;color:#64748b">${r['Remarks']||''}</td>
      </tr>`).join('')}
    </table>
  </div>
`).join('')}` : ''}

${hasSec('stepOutputs') ? (() => {
  const drillPhaseKeys = ['switchover', 'switchback', 'failover', 'failback']
  const phaseLabel = { switchover: 'Switchover', switchback: 'Switchback', failover: 'Failover', failback: 'Failback' }
  const phaseColor = {
    switchover: 'background:#e0f2fe;color:#0369a1',
    switchback: 'background:#f3e8ff;color:#7e22ce',
    failover:   'background:#fff7ed;color:#c2410c',
    failback:   'background:#fdf4ff;color:#a21caf',
  }
  const levelClass = (lvl) => {
    if (!lvl) return ''
    const l = lvl.toLowerCase()
    if (l === 'error' || l === 'err') return 'err'
    if (l === 'warn' || l === 'warning') return 'warn'
    if (l === 'ok' || l === 'info') return 'ok'
    return ''
  }
  const blocks = operations.map(op => {
    const phaseBlocks = drillPhaseKeys
      .filter(pk => op.phases?.[pk])
      .map(pk => {
        const ph = op.phases[pk]
        const runs = ph.folderRuns || []
        if (runs.length === 0 && (!ph.steps || ph.steps.length === 0)) return null
        // support both folderRuns[].steps and direct ph.steps
        const runSections = runs.length > 0
          ? runs.map(run => {
              const steps = run.steps || []
              return `<div class="run-block">
                <div class="run-hdr">
                  <span>Run #${run.runNo || 1}</span>
                  <span style="font-family:monospace;font-size:7.5pt;color:#64748b">${run.runId || ''}</span>
                  <span class="badge" style="${badgeStyle(run.status === 'Ended OK' ? 'PASS' : run.status === 'Executing' ? 'IN PROGRESS' : 'FAIL')}">${run.status || ''}</span>
                </div>
                ${steps.length === 0 ? '<p style="font-size:8.5pt;color:#94a3b8;padding:6px 12px">No step data available.</p>' :
                  steps.map(s => `<div class="step-block" style="margin:6px 10px 6px">
                  <div class="step-hdr">
                    <span class="badge" style="${badgeStyle(s.status === 'Ended OK' ? 'PASS' : s.status === 'Executing' ? 'IN PROGRESS' : 'FAIL')}">${s.status === 'Ended OK' ? '✓' : s.status === 'Executing' ? '⏳' : '✗'}</span>
                    <span>${s.name || s.jobId || '—'}</span>
                    ${s.jobId ? `<span style="font-family:monospace;font-size:7.5pt;color:#94a3b8">${s.jobId}</span>` : ''}
                    ${s.duration ? `<span style="margin-left:auto;font-size:7.5pt;color:#64748b">${s.duration}</span>` : ''}
                  </div>
                  ${s.log && s.log.length > 0 ? `<div class="step-log">
                    ${s.log.map(l => `<div class="step-log-line ${levelClass(l.level)}">${l.time ? `<span style="color:#475569;margin-right:6px">${l.time}</span>` : ''}${l.msg || ''}</div>`).join('')}
                  </div>` : ''}
                </div>`).join('')}
              </div>`
            }).join('')
          : (ph.steps || []).map(s => `<div class="step-block">
              <div class="step-hdr">
                <span class="badge" style="${badgeStyle(s.status === 'Ended OK' ? 'PASS' : 'FAIL')}">${s.status === 'Ended OK' ? '✓' : '✗'}</span>
                <span>${s.name || s.jobId || '—'}</span>
                ${s.duration ? `<span style="margin-left:auto;font-size:7.5pt;color:#64748b">${s.duration}</span>` : ''}
              </div>
            </div>`).join('')

        return `<div class="phase-block" style="margin:8px 0">
          <div class="phase-hdr">
            <span class="badge" style="${phaseColor[pk]}">${phaseLabel[pk]}</span>
            <span style="font-size:8pt;color:#64748b">
              ${ph.totalSteps ? `${ph.completedSteps||0}/${ph.totalSteps} steps` : ''}
              ${ph.jobId ? ` · CTM: ${ph.jobId}` : ''}
            </span>
          </div>
          ${runSections}
        </div>`
      }).filter(Boolean)

    if (phaseBlocks.length === 0) return ''
    return `<h3>${op.app}</h3>${phaseBlocks.join('')}`
  }).filter(Boolean)

  if (blocks.length === 0) return ''
  return `<h2>Step Outputs</h2>
<p style="font-size:9pt;color:#475569;margin-bottom:8px">
  Per-phase step execution detail and log output for each drill application.
</p>
${blocks.join('<div style="margin:16px 0;border-top:1px solid #e2e8f0"></div>')}`
})() : ''}

${hasSec('failureLog') && failedPhases.length > 0 ? `
<h2>Failure Log</h2>
<div class="risk-box">
  <strong style="color:#be123c">${failedPhases.length} phase(s) failed:</strong>
  <ul>${failedPhases.map(r => `<li><strong>${r['Application Name']}</strong> — ${r['Failover / Failback']} phase · CTM: ${r['CTM Job ID']||'N/A'} · ${r['Remarks']||'No remarks'}</li>`).join('')}</ul>
</div>` : ''}

${hasSec('remediation') && failedPhases.length > 0 ? `
<h2>Remediation Actions</h2>
<table>
  <tr><th>Application</th><th>Phase</th><th>Criticality</th><th>Owner</th><th>Action Required</th></tr>
  ${[...new Set(failedPhases.map(r=>r['Application Name']))].map(app => {
    const op = operations.find(o => o.app === app)
    const m  = op?.meta || {}
    const appFailed = failedPhases.filter(r => r['Application Name'] === app)
    return `<tr>
      <td><strong>${app}</strong></td>
      <td>${appFailed.map(r=>`<span class="badge" style="background:#fee2e2;color:#dc2626;margin:1px">${r['Failover / Failback']}</span>`).join(' ')}</td>
      <td>${m.criticality ? `<span class="badge" style="${critBadge(m.criticality)}">${m.criticality}</span>` : '—'}</td>
      <td style="font-size:8.5pt">${m.owner||'—'}</td>
      <td style="font-size:8.5pt">Review CTM job output logs, remediate failed steps, re-run drill phase before next DR activation.</td>
    </tr>`
  }).join('')}
</table>` : ''}

${hasSec('contacts') ? `
<h2>Owner Contact List</h2>
<table>
  <tr><th>Application</th><th>Criticality</th><th>RPO</th><th>Team</th><th>Owner</th><th>Overall Result</th></tr>
  ${appSummary.map(a => `<tr>
    <td><strong>${a.app}</strong></td>
    <td>${a.m.criticality ? `<span class="badge" style="${critBadge(a.m.criticality)}">${a.m.criticality}</span>` : '—'}</td>
    <td>${a.m.rpo||'—'}</td>
    <td>${a.m.team||'—'}</td>
    <td>${a.m.owner||'—'}</td>
    <td><span class="badge" style="${badgeStyle(a.overall)}">${a.overall}</span></td>
  </tr>`).join('')}
</table>` : ''}


${footerText ? `<div class="report-footer">${footerText}</div>` : ''}
</div>

${forPreview ? '' : '<script>window.onload=function(){window.print()}</script>'}
</body>
</html>`
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={onChange}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-gray-500">{label}</span>
    </label>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function DrillEvidenceModal({ operations, onClose }) {
  const t = useT()
  const { settings } = useSettings()

  const rows = buildReportRows(operations, settings.appMeta || {})

  const [template,            setTemplate]            = useState('executive')
  const [sections,            setSections]            = useState(TEMPLATES[0].sections)
  const [reportTitle,         setReportTitle]         = useState('DR Drill Evidence Report')
  const [org,                 setOrg]                 = useState(settings.customerName || '')
  const [preparedFor,         setPreparedFor]         = useState('')
  const [preparedBy,          setPreparedBy]          = useState('')
  const [drillDate,           setDrillDate]           = useState(new Date().toISOString().split('T')[0])
  const [drillRef,            setDrillRef]            = useState('')
  const [includeDate,         setIncludeDate]         = useState(true)
  const [includeConfidential, setIncludeConfidential] = useState(true)
  const [footerText,          setFooterText]          = useState('')
  const [showPreview,         setShowPreview]         = useState(false)
  const [printing,            setPrinting]            = useState(false)
  const [exported,            setExported]            = useState(false)
  const [schedule,            setSchedule]            = useState('Disabled')
  const [recipients,          setRecipients]          = useState('')

  const passRows = rows.filter(r => r['Overall Result'] === 'PASS')
  const failRows = rows.filter(r => r['Overall Result'] === 'FAIL')

  function applyTemplate(id) {
    setTemplate(id)
    const tmpl = TEMPLATES.find(t => t.id === id)
    if (id !== 'custom') setSections(tmpl.sections)
  }

  function toggleSection(id) {
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const activeSections = template === 'custom' ? sections : (TEMPLATES.find(t => t.id === template)?.sections || [])

  const buildArgs = {
    operations, rows, settingsMeta: settings.appMeta || {},
    title: reportTitle, org, preparedFor, preparedBy,
    includeDate, includeConfidential, drillDate, drillRef,
    template, sections: activeSections, footerText,
  }

  const previewHtml = useMemo(() => buildEvidenceHtml({ ...buildArgs, forPreview: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.length, reportTitle, org, preparedFor, preparedBy, drillDate, drillRef,
     includeDate, includeConfidential, template, activeSections, footerText])

  function handlePDF() {
    setPrinting(true)
    const w = window.open('', '_blank', 'width=960,height=720')
    if (!w) { alert('Please allow pop-ups to generate the PDF.'); setPrinting(false); return }
    w.document.open()
    w.document.write(buildEvidenceHtml(buildArgs))
    w.document.close()
    setPrinting(false)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  function handleCSV() {
    const today = new Date().toLocaleDateString('en-GB')
    const lines = [
      `"${reportTitle}"`,
      `"Generated","${today}"`,
      org         && `"Organization","${org}"`,
      preparedFor && `"Prepared For","${preparedFor}"`,
      preparedBy  && `"Prepared By","${preparedBy}"`,
      drillDate   && `"Drill Date","${drillDate}"`,
      drillRef    && `"Reference","${drillRef}"`,
      '',
      '"DRILL SUMMARY"',
      `"Total Applications","${[...new Set(rows.map(r=>r['Application Name']))].length}"`,
      `"Total Phases","${rows.length}"`,
      `"Passed","${passRows.length}"`,
      `"Failed","${failRows.length}"`,
      '',
      '"PHASE DETAIL"',
      '"#","Application","Criticality","RPO","Team","Phase","Start Date","Start Time","End Time","Duration","Downtime","RTO (Hours)","RTO (Min)","SLA Status","Overall Result","CTM Job ID","CTM Folder","Remarks"',
      ...rows.map(r => [
        `"${r['#']}"`, `"${r['Application Name']}"`, `"${r['Criticality']||''}"`,
        `"${r['RPO']||''}"`, `"${r['Team']||''}"`, `"${r['Failover / Failback']}"`,
        `"${r['Test Start Date']||''}"`, `"${r['Test Start Time']||''}"`, `"${r['Test End Time']||''}"`,
        `"${r['Test Duration']||''}"`, `"${r['Overall Downtime']||''}"`,
        `"${r['RTO Agreed (Hours)']||''}"`, `"${r['RTO Agreed (Min)']||''}"`,
        `"${r['SLA Status']||''}"`, `"${r['Overall Result']||''}"`,
        `"${r['CTM Job ID']||''}"`, `"${r['CTM Folder']||''}"`, `"${r['Remarks']||''}"`,
      ].join(',')),
    ].filter(v => v !== false).join('\n')

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `DR-Drill-Evidence-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExported(true); setTimeout(() => setExported(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`${t.card} border ${t.border} rounded-2xl w-full ${showPreview ? 'max-w-6xl' : 'max-w-2xl'} max-h-[92vh] flex flex-col shadow-2xl transition-all duration-300`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <FileText size={18} className="text-indigo-500" />
          <div>
            <h2 className={`font-bold ${t.text}`}>DR Drill Evidence Report</h2>
            <p className={`text-xs ${t.textMuted}`}>
              {[...new Set(rows.map(r => r['Application Name']))].length} applications ·{' '}
              {rows.length} drill phases · {passRows.length} passed · {failRows.length} failed
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                showPreview ? 'bg-blue-600 text-white border-blue-600' : `${t.border} ${t.textMuted} ${t.cardHover}`
              }`}
            >
              {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button onClick={onClose} className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 flex overflow-hidden min-h-0 ${showPreview ? 'flex-row' : 'flex-col'}`}>

          {/* Config */}
          <div className={`overflow-y-auto px-6 py-5 space-y-6 ${showPreview ? 'w-80 flex-shrink-0 border-r ' + t.border : 'flex-1'}`}>

            {/* Template */}
            <div>
              <label className={`text-sm font-semibold ${t.text} block mb-2`}>Report Template</label>
              <div className="space-y-2">
                {TEMPLATES.map(tmpl => (
                  <div key={tmpl.id} onClick={() => applyTemplate(tmpl.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      template === tmpl.id ? 'border-indigo-500/60 bg-indigo-500/8' : `${t.border} ${t.cardHover}`
                    }`}>
                    <span className="text-xl leading-none mt-0.5">{tmpl.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${t.text}`}>{tmpl.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${t.border} ${t.textMuted}`}>{tmpl.audience}</span>
                      </div>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>{tmpl.desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                      template === tmpl.id ? 'border-indigo-500 bg-indigo-500' : t.border
                    }`}>
                      {template === tmpl.id && <Check size={9} className="text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section toggles (custom) */}
            {template === 'custom' && (
              <div>
                <label className={`text-sm font-semibold ${t.text} block mb-2`}>Sections to Include</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_SECTIONS.map(sec => {
                    const on = sections.includes(sec.id)
                    return (
                      <div key={sec.id} onClick={() => toggleSection(sec.id)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer text-xs transition-all ${
                          on ? 'border-indigo-500/40 bg-indigo-500/8 text-indigo-700' : `${t.border} ${t.textMuted} ${t.cardHover}`
                        }`}>
                        <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${on ? 'bg-indigo-500 border-indigo-500' : t.border}`}>
                          {on && <Check size={9} className="text-white" />}
                        </div>
                        {sec.label}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Report Details */}
            <div>
              <label className={`text-sm font-semibold ${t.text} block mb-3`}>Report Details</label>
              <div className="space-y-3">
                {[
                  { label: 'Report Title',  value: reportTitle, set: setReportTitle, placeholder: 'DR Drill Evidence Report' },
                  { label: 'Organization',  value: org,         set: setOrg,         placeholder: 'Enter organization name' },
                  { label: 'Prepared For',  value: preparedFor, set: setPreparedFor, placeholder: 'e.g. CISO / Risk Committee' },
                  { label: 'Prepared By',   value: preparedBy,  set: setPreparedBy,  placeholder: 'e.g. DR Team' },
                  { label: 'Drill Reference / ID', value: drillRef, set: setDrillRef, placeholder: 'e.g. DR-DRILL-2026-Q1' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label}>
                    <label className={`text-xs ${t.textMuted} block mb-1`}>{label}</label>
                    <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                      className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} placeholder-gray-400 outline-none focus:border-indigo-500/60 transition-colors`} />
                  </div>
                ))}
                <div>
                  <label className={`text-xs ${t.textMuted} block mb-1`}>Drill Date</label>
                  <input type="date" value={drillDate} onChange={e => setDrillDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} outline-none focus:border-indigo-500/60 transition-colors`} />
                </div>
                <div className="flex gap-6 pt-1">
                  <Toggle value={includeDate}         onChange={() => setIncludeDate(v => !v)}         label="Include dates" />
                  <Toggle value={includeConfidential} onChange={() => setIncludeConfidential(v => !v)} label="Mark confidential" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div>
              <label className={`text-sm font-semibold ${t.text} block mb-1`}>Report Footer</label>
              <input value={footerText} onChange={e => setFooterText(e.target.value)}
                placeholder="e.g. Confidential — DR Team · 2026"
                className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} placeholder-gray-400 outline-none focus:border-indigo-500/60 transition-colors`} />
            </div>

            {/* Auto generation */}
            <div className={`rounded-xl border ${t.border} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={15} className="text-purple-500" />
                <span className={`text-sm font-semibold ${t.text}`}>Automatic Generation</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={`text-xs ${t.textMuted} block mb-1`}>Schedule</label>
                  <select value={schedule} onChange={e => setSchedule(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} outline-none`}>
                    {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {schedule !== 'Disabled' && (
                  <div>
                    <label className={`text-xs ${t.textMuted} block mb-1`}>Email Recipients</label>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} ${t.card}`}>
                      <Mail size={13} className="text-gray-400 flex-shrink-0" />
                      <input value={recipients} onChange={e => setRecipients(e.target.value)}
                        placeholder="ciso@company.com, dr-team@company.com"
                        className={`flex-1 bg-transparent text-sm ${t.text} placeholder-gray-400 outline-none`} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className={`flex items-center gap-2 px-4 py-2 border-b ${t.border} flex-shrink-0`}>
                <Eye size={13} className="text-indigo-500" />
                <span className={`text-xs font-medium ${t.text}`}>Live Preview</span>
                <span className={`text-xs ${t.textFaint} ml-1`}>Updates as you change settings</span>
              </div>
              <iframe srcDoc={previewHtml} className="flex-1 w-full border-0" sandbox="allow-scripts" title="Evidence Preview" />
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className={`flex items-center gap-3 px-6 py-4 border-t ${t.border} flex-shrink-0`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg ${t.cardHover} ${t.textMuted} border ${t.border}`}>
            Cancel
          </button>
          <div className="flex-1" />
          {exported && <span className="text-sm text-green-600 flex items-center gap-1.5"><Check size={14} /> Done</span>}
          <button onClick={handleCSV}
            className={`flex items-center gap-2 px-4 py-2 border ${t.border} ${t.cardHover} ${t.textMuted} hover:text-current text-sm rounded-lg transition-colors`}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={handlePDF} disabled={printing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {printing
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
              : <><Printer size={15} />Print / Save PDF</>}
          </button>
        </div>
      </div>
    </div>
  )
}
