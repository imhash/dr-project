import { useState } from 'react'
import { X, FileText, Printer, Download, Clock, Mail, Check, Layers } from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'executive',
    label: 'Executive Summary',
    audience: 'C-Level / Board',
    icon: '📊',
    desc: 'High-level readiness status, risk summary, go/no-go recommendation. No technical detail.',
    sections: ['cover', 'overview', 'metrics', 'risk', 'appSummary', 'recommendation', 'signature'],
  },
  {
    id: 'operational',
    label: 'Operational Report',
    audience: 'BCP / DR Team',
    icon: '🔧',
    desc: 'Full folder-run and step detail, failure logs, remediation actions, owner contacts.',
    sections: ['cover', 'metrics', 'risk', 'appList', 'stepDetail', 'failureLogs', 'remediation', 'contacts'],
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
  { id: 'metrics',        label: 'Readiness Metrics' },
  { id: 'risk',           label: 'Risk Summary' },
  { id: 'appSummary',     label: 'Application Status Table' },
  { id: 'appList',        label: 'Application Detail List' },
  { id: 'stepDetail',     label: 'Step-by-Step Detail' },
  { id: 'failureLogs',    label: 'Failure & Error Logs' },
  { id: 'remediation',    label: 'Remediation Actions' },
  { id: 'contacts',       label: 'Owner Contact List' },
  { id: 'recommendation', label: 'Go / No-Go Recommendation' },
  { id: 'signature',      label: 'Approval / Signature Page' },
]

const SCHEDULES = ['Disabled', 'After every DR Drill (auto)', 'Weekly — Monday 08:00', 'Monthly — 1st, 08:00', 'Quarterly']

// ─── PDF HTML builder ─────────────────────────────────────────────────────────
function buildPDFHtml({ operations, title, org, preparedFor, preparedBy, includeDate, includeConfidential, template, sections }) {
  const ready   = operations.filter(o => o.phases?.readiness?.status === 'Ended OK').length
  const failed  = operations.filter(o => o.phases?.readiness?.status === 'Ended Not OK').length
  const total   = operations.length
  const pct     = total > 0 ? Math.round(ready / total * 100) : 0
  const today   = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const tmplLabel = TEMPLATES.find(t => t.id === template)?.label || template
  const goNoGo  = pct >= 80
    ? { label: 'GO',    color: '#15803d', bg: '#dcfce7', border: '#86efac', reason: `${pct}% of applications are DR-ready.` }
    : { label: 'NO-GO', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', reason: `Only ${pct}% of applications are DR-ready. ${failed} application(s) require remediation before activation.` }

  const hasSec = id => sections.includes(id)

  // Build failure items for remediation
  const failedApps = operations.filter(o => o.phases?.readiness?.status === 'Ended Not OK')
  const failedSteps = operations.flatMap(op =>
    (op.phases?.readiness?.folderRuns || []).flatMap(run =>
      run.steps
        .filter(st => st.status === 'Ended Not OK' || st.status === 'Aborted')
        .map(st => ({ app: op.app, folder: run.folder, runNo: run.runNo, step: st.name || st.jobId, error: st.log?.find(l => l.level === 'ERROR')?.msg || '' }))
    )
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title || 'DR Readiness Report'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
  h1 { font-size: 22pt; }
  h2 { font-size: 13pt; color: #1e3a5f; border-bottom: 2px solid #c2cfe0; padding-bottom: 6px; margin: 24px 0 12px; }
  h3 { font-size: 11pt; color: #1e3a5f; margin: 14px 0 6px; }
  p  { margin: 6px 0; line-height: 1.6; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 8px 0; }
  th { background: #dde4f0; color: #1e3a5f; text-align: left; padding: 8px 10px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .cover { background: #1e3a5f; color: white; padding: 60px 50px; min-height: 260px; }
  .cover h1 { color: white; margin-bottom: 8px; }
  .cover .sub { color: #a8c4e0; font-size: 10pt; margin-top: 24px; }
  .cover .meta { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; font-size: 10pt; color: #cbd5e1; }
  .cover .meta span:first-child { color: #7ba3c8; }
  .confidential { color: #fca5a5; font-size: 9pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
  .metric-card { border: 1px solid #c2cfe0; border-radius: 8px; padding: 14px; text-align: center; }
  .metric-val  { font-size: 22pt; font-weight: 700; }
  .metric-lbl  { font-size: 9pt; color: #64748b; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 9pt; font-weight: 600; }
  .ok    { background: #dcfce7; color: #15803d; }
  .fail  { background: #fee2e2; color: #dc2626; }
  .warn  { background: #fef9c3; color: #a16207; }
  .info  { background: #dbeafe; color: #1d4ed8; }
  .gono-box { border: 3px solid ${goNoGo.border}; background: ${goNoGo.bg}; border-radius: 10px; padding: 20px 24px; margin: 14px 0; text-align: center; }
  .gono-label { font-size: 32pt; font-weight: 900; color: ${goNoGo.color}; }
  .gono-reason { font-size: 11pt; color: ${goNoGo.color}; margin-top: 6px; }
  .risk-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 16px; }
  .risk-box ul { padding-left: 18px; margin-top: 6px; }
  .risk-box li { margin: 3px 0; color: #be123c; }
  .folder-block { border: 1px solid #c2cfe0; border-radius: 6px; margin: 8px 0; overflow: hidden; }
  .folder-hdr  { background: #eef2f8; padding: 7px 12px; font-weight: 600; font-size: 10pt; color: #1e3a5f; }
  .step-row { display: flex; gap: 12px; padding: 5px 12px; border-top: 1px solid #e2e8f0; font-size: 9.5pt; }
  .step-name { flex: 1; font-family: monospace; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 16px; }
  .sig-line { border-top: 2px solid #94a3b8; padding-top: 8px; }
  .sig-role { font-size: 9pt; color: #64748b; }
  .sig-date { margin-top: 28px; font-size: 9pt; color: #94a3b8; }
  .page-break { page-break-before: always; }
  .content { padding: 40px 50px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

${hasSec('cover') ? `
<div class="cover">
  <h1>${title || 'DR Readiness Assessment Report'}</h1>
  ${includeConfidential ? '<div class="confidential">Confidential</div>' : ''}
  <div class="sub">Template: ${tmplLabel}</div>
  <div class="meta" style="margin-top:20px">
    ${org          ? `<span>Organization</span><span>${org}</span>` : ''}
    ${preparedFor  ? `<span>Prepared For</span><span>${preparedFor}</span>` : ''}
    ${preparedBy   ? `<span>Prepared By</span><span>${preparedBy}</span>` : ''}
    ${includeDate  ? `<span>Date</span><span>${today}</span>` : ''}
  </div>
</div>` : ''}

<div class="content">

${hasSec('overview') ? `
<h2>Executive Overview</h2>
<p>This report presents the Disaster Recovery (DR) readiness status for <strong>${total}</strong> application(s)
as assessed on ${today}. The overall readiness score is <strong>${pct}%</strong>
(${ready} of ${total} applications fully ready).
${failed > 0 ? `<strong>${failed} application(s) require attention</strong> before DR activation can be approved.` : 'All assessed applications have passed readiness checks.'}
</p>` : ''}

${hasSec('metrics') ? `
<h2>Readiness Metrics</h2>
<div class="metric-grid">
  <div class="metric-card">
    <div class="metric-val" style="color:#1e3a5f">${total}</div>
    <div class="metric-lbl">Total Applications</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#15803d">${ready}</div>
    <div class="metric-lbl">Ready</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:#dc2626">${failed}</div>
    <div class="metric-lbl">Not Ready</div>
  </div>
  <div class="metric-card">
    <div class="metric-val" style="color:${pct>=80?'#15803d':pct>=60?'#d97706':'#dc2626'}">${pct}%</div>
    <div class="metric-lbl">Overall Readiness</div>
  </div>
</div>` : ''}

${hasSec('risk') && failed > 0 ? `
<h2>Risk Summary</h2>
<div class="risk-box">
  <strong style="color:#be123c">${failed} application(s) are NOT DR-ready:</strong>
  <ul>
    ${failedApps.map(o => `<li><strong>${o.app}</strong> — ${o.phases.readiness.failedSteps} step(s) failed across ${(o.phases.readiness.folderRuns||[]).filter(r=>r.status==='Ended Not OK').length} folder run(s)</li>`).join('')}
  </ul>
</div>` : ''}

${(hasSec('appSummary') || hasSec('appList')) ? `
<h2>Application Status</h2>
<table>
  <tr><th>Application</th><th>Server</th><th>Criticality</th><th>Team</th><th>Status</th><th>Steps</th><th>Folder Runs</th></tr>
  ${operations.map(op => {
    const r = op.phases?.readiness
    const m = op.meta || {}
    const isOk = r?.status === 'Ended OK'
    const runs = r?.folderRuns || []
    const okRuns = runs.filter(r => r.status === 'Ended OK').length
    return `<tr>
      <td><strong>${op.app}</strong></td>
      <td>${op.server}</td>
      <td>${m.criticality || '—'}</td>
      <td>${m.team || '—'}</td>
      <td><span class="badge ${isOk ? 'ok' : r?.status==='Executing' ? 'info' : 'fail'}">${isOk ? '✓ Ready' : r?.status==='Executing' ? '⟳ Checking' : '✗ Not Ready'}</span></td>
      <td>${r?.completedSteps||0} / ${r?.totalSteps||0}</td>
      <td>${okRuns} / ${runs.length} OK</td>
    </tr>`
  }).join('')}
</table>` : ''}

${hasSec('stepDetail') ? `
<h2>Step Detail by Application</h2>
${operations.map(op => {
  const r = op.phases?.readiness
  if (!r) return ''
  return `<h3>${op.app} <span style="font-size:9pt;color:#64748b;font-weight:400">(${op.server})</span></h3>
  ${(r.folderRuns || []).map(run => `
    <div class="folder-block">
      <div class="folder-hdr">📁 ${run.folder} &nbsp;·&nbsp; Run #${run.runNo} &nbsp;·&nbsp; ${run.runId} &nbsp;·&nbsp; <span class="${run.status==='Ended OK'?'ok':run.status==='Executing'?'info':'fail'}" style="padding:1px 8px;border-radius:4px;font-size:9pt">${run.status}</span></div>
      ${run.steps.map(st => `<div class="step-row">
        <span class="step-name">${st.name || st.jobId}</span>
        <span class="badge ${st.status==='Ended OK'?'ok':st.status==='Executing'?'info':'fail'}">${st.status}</span>
        ${st.startTimeISO ? `<span style="color:#64748b;font-size:9pt">${new Date(st.startTimeISO).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>` : ''}
        ${st.duration ? `<span style="color:#64748b;font-size:9pt">${st.duration}</span>` : ''}
      </div>`).join('')}
    </div>`).join('')}`
}).join('')}` : ''}

${hasSec('failureLogs') && failedSteps.length > 0 ? `
<h2>Failure & Error Logs</h2>
<table>
  <tr><th>Application</th><th>Folder</th><th>Run #</th><th>Step</th><th>Error</th></tr>
  ${failedSteps.map(f => `<tr>
    <td>${f.app}</td><td style="font-family:monospace;font-size:9pt">${f.folder}</td>
    <td>#${f.runNo}</td><td style="font-family:monospace;font-size:9pt">${f.step}</td>
    <td style="color:#dc2626;font-size:9.5pt">${f.error || '—'}</td>
  </tr>`).join('')}
</table>` : ''}

${hasSec('remediation') && failedApps.length > 0 ? `
<h2>Remediation Actions</h2>
<table>
  <tr><th>Application</th><th>Issue</th><th>Owner</th><th>Priority</th><th>Action Required</th></tr>
  ${failedApps.map((op, i) => {
    const topError = (op.phases?.readiness?.folderRuns || [])
      .flatMap(r => r.steps.filter(s => s.status==='Ended Not OK').flatMap(s => s.log.filter(l => l.level==='ERROR').map(l => l.msg)))
      .filter(Boolean)[0] || 'Review failed steps and resolve before DR activation'
    return `<tr>
      <td><strong>${op.app}</strong></td>
      <td style="color:#dc2626">${op.phases.readiness.failedSteps} step(s) failed</td>
      <td>${(op.meta||{}).owner || '—'}</td>
      <td><span class="badge ${(op.meta||{}).criticality === 'Critical' ? 'fail' : 'warn'}">${(op.meta||{}).criticality || 'Unknown'}</span></td>
      <td style="font-size:9.5pt">${topError}</td>
    </tr>`
  }).join('')}
</table>` : ''}

${hasSec('contacts') ? `
<h2>Owner Contacts</h2>
<table>
  <tr><th>Application</th><th>Criticality</th><th>Team</th><th>Owner Email</th><th>Status</th></tr>
  ${operations.map(op => {
    const m = op.meta || {}
    const r = op.phases?.readiness
    return `<tr>
      <td>${op.app}</td>
      <td>${m.criticality || '—'}</td>
      <td>${m.team || '—'}</td>
      <td>${m.owner || '—'}</td>
      <td><span class="badge ${r?.status==='Ended OK'?'ok':r?.status==='Executing'?'info':'fail'}">${r?.status==='Ended OK'?'Ready':r?.status==='Executing'?'Checking':'Not Ready'}</span></td>
    </tr>`
  }).join('')}
</table>` : ''}

${hasSec('recommendation') ? `
<h2>Go / No-Go Recommendation</h2>
<div class="gono-box">
  <div class="gono-label">${goNoGo.label}</div>
  <div class="gono-reason">${goNoGo.reason}</div>
</div>` : ''}

${hasSec('signature') ? `
<h2 style="margin-top:40px">Approval &amp; Sign-off</h2>
<div class="sig-grid">
  <div class="sig-line">
    <div class="sig-role">Prepared by</div>
    <div style="margin-top:36px; border-top: 1px solid #94a3b8; padding-top: 4px; color: #94a3b8; font-size:9pt">Signature &amp; Date</div>
  </div>
  <div class="sig-line">
    <div class="sig-role">Reviewed &amp; Approved by</div>
    <div style="margin-top:36px; border-top: 1px solid #94a3b8; padding-top: 4px; color: #94a3b8; font-size:9pt">Signature &amp; Date</div>
  </div>
</div>` : ''}

</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`
}

// ─── Helper components ────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={onChange}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function ReadinessReportModal({ operations = [], onClose }) {
  const t = useT()
  const { settings } = useSettings()

  const [template,            setTemplate]            = useState('executive')
  const [sections,            setSections]            = useState(TEMPLATES[0].sections)
  const [reportTitle,         setReportTitle]         = useState('DR Readiness Assessment Report')
  const [org,                 setOrg]                 = useState(settings.customerName || '')
  const [preparedFor,         setPreparedFor]         = useState('')
  const [preparedBy,          setPreparedBy]          = useState('')
  const [includeDate,         setIncludeDate]         = useState(true)
  const [includeConfidential, setIncludeConfidential] = useState(true)
  const [schedule,            setSchedule]            = useState('Disabled')
  const [recipients,          setRecipients]          = useState('')
  const [printing,            setPrinting]            = useState(false)
  const [exported,            setExported]            = useState(false)

  function applyTemplate(id) {
    setTemplate(id)
    const tmpl = TEMPLATES.find(t => t.id === id)
    if (id !== 'custom') setSections(tmpl.sections)
  }

  function toggleSection(id) {
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const activeSections = template === 'custom' ? sections : (TEMPLATES.find(t => t.id === template)?.sections || [])

  function handlePDF() {
    setPrinting(true)
    const html = buildPDFHtml({
      operations, title: reportTitle, org, preparedFor, preparedBy,
      includeDate, includeConfidential, template,
      sections: activeSections,
    })
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { alert('Please allow pop-ups to generate the PDF.'); setPrinting(false); return }
    w.document.open()
    w.document.write(html)
    w.document.close()
    setPrinting(false)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  function handleCSV() {
    const ready  = operations.filter(o => o.phases?.readiness?.status === 'Ended OK').length
    const failed = operations.filter(o => o.phases?.readiness?.status === 'Ended Not OK').length
    const pct    = operations.length > 0 ? Math.round(ready / operations.length * 100) : 0
    const today  = new Date().toLocaleDateString('en-GB')

    const lines = [
      `"${reportTitle || 'DR Readiness Report'}"`,
      `"Generated","${today}"`,
      org         && `"Organization","${org}"`,
      preparedFor && `"Prepared For","${preparedFor}"`,
      preparedBy  && `"Prepared By","${preparedBy}"`,
      '',
      '"READINESS SUMMARY"',
      `"Total Applications","${operations.length}"`,
      `"Ready","${ready}"`,
      `"Not Ready","${failed}"`,
      `"Overall Readiness","${pct}%"`,
      `"Go/No-Go","${pct >= 80 ? 'GO' : 'NO-GO'}"`,
      '',
      '"APPLICATION DETAIL"',
      '"Application","Server","Criticality","Team","Status","Steps OK","Steps Failed","Folder Runs","Owner"',
      ...operations.map(op => {
        const r = op.phases?.readiness
        const m = op.meta || {}
        const runs = r?.folderRuns || []
        const okRuns = runs.filter(r => r.status === 'Ended OK').length
        return [
          `"${op.app}"`, `"${op.server}"`, `"${m.criticality||''}"`, `"${m.team||''}"`,
          `"${r?.status||''}"`, `"${r?.completedSteps||0}"`, `"${r?.failedSteps||0}"`,
          `"${okRuns}/${runs.length}"`, `"${m.owner||''}"`,
        ].join(',')
      }),
    ].filter(v => v !== false).join('\n')

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `DR-Readiness-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`${t.card} border ${t.border} rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <FileText size={18} className="text-blue-500" />
          <div>
            <h2 className={`font-bold ${t.text}`}>Generate Readiness Report</h2>
            <p className={`text-xs ${t.textMuted}`}>{operations.length} applications · {operations.filter(o => o.phases?.readiness?.status === 'Ended OK').length} ready</p>
          </div>
          <button onClick={onClose} className={`ml-auto p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-current`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Template */}
          <div>
            <label className={`text-sm font-semibold ${t.text} block mb-2`}>Report Template</label>
            <div className="space-y-2">
              {TEMPLATES.map(tmpl => (
                <div key={tmpl.id} onClick={() => applyTemplate(tmpl.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    template === tmpl.id ? 'border-blue-500/60 bg-blue-500/8' : `${t.border} ${t.cardHover}`
                  }`}>
                  <span className="text-xl leading-none mt-0.5">{tmpl.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${t.text}`}>{tmpl.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${t.border} ${t.textMuted}`}>{tmpl.audience}</span>
                    </div>
                    <p className={`text-xs ${t.textMuted} mt-0.5`}>{tmpl.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-all ${
                    template === tmpl.id ? 'border-blue-500 bg-blue-500' : t.border
                  }`}>
                    {template === tmpl.id && <Check size={9} className="text-white" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section toggles (custom only) */}
          {template === 'custom' && (
            <div>
              <label className={`text-sm font-semibold ${t.text} block mb-2`}>Sections to Include</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SECTIONS.map(sec => {
                  const on = sections.includes(sec.id)
                  return (
                    <div key={sec.id} onClick={() => toggleSection(sec.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer text-xs transition-all ${
                        on ? 'border-blue-500/40 bg-blue-500/8 text-blue-700' : `${t.border} ${t.textMuted} ${t.cardHover}`
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${on ? 'bg-blue-500 border-blue-500' : t.border}`}>
                        {on && <Check size={9} className="text-white" />}
                      </div>
                      {sec.label}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Report details */}
          <div>
            <label className={`text-sm font-semibold ${t.text} block mb-3`}>Report Details</label>
            <div className="space-y-3">
              {[
                { label: 'Report Title',  value: reportTitle, set: setReportTitle, placeholder: 'DR Readiness Assessment Report' },
                { label: 'Organization',  value: org,         set: setOrg,         placeholder: 'Enter organization name' },
                { label: 'Prepared For',  value: preparedFor, set: setPreparedFor, placeholder: 'e.g. Board of Directors' },
                { label: 'Prepared By',   value: preparedBy,  set: setPreparedBy,  placeholder: 'e.g. BCP / DR Team' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className={`text-xs ${t.textMuted} block mb-1`}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                    className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} placeholder-gray-400 outline-none focus:border-blue-500/60 transition-colors`} />
                </div>
              ))}
              <div className="flex gap-6 pt-1">
                <Toggle value={includeDate}         onChange={() => setIncludeDate(v => !v)}         label="Include date" />
                <Toggle value={includeConfidential} onChange={() => setIncludeConfidential(v => !v)} label="Mark confidential" />
              </div>
            </div>
          </div>

          {/* Auto-generation */}
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
                      placeholder="cto@company.com, bcp@company.com"
                      className={`flex-1 bg-transparent text-sm ${t.text} placeholder-gray-400 outline-none`} />
                  </div>
                  <p className={`text-xs ${t.textFaint} mt-1`}>Comma-separated addresses</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center gap-3 px-6 py-4 border-t ${t.border} flex-shrink-0`}>
          <button onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg ${t.cardHover} ${t.textMuted} border ${t.border}`}>
            Cancel
          </button>
          <div className="flex-1" />
          {exported && (
            <span className="text-sm text-green-600 flex items-center gap-1.5">
              <Check size={14} /> Done
            </span>
          )}
          <button onClick={handleCSV}
            className={`flex items-center gap-2 px-4 py-2 border ${t.border} ${t.cardHover} ${t.textMuted} hover:text-current text-sm rounded-lg transition-colors`}>
            <Download size={14} />
            Export CSV
          </button>
          <button onClick={handlePDF} disabled={printing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {printing
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
              : <><Printer size={15} />Print / Save PDF</>}
          </button>
        </div>
      </div>
    </div>
  )
}
