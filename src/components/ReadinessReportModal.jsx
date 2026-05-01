import { useState } from 'react'
import {
  X, FileText, Download, Clock, Mail, Check,
  ChevronDown, Shield, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'executive',
    label: 'Executive Summary',
    audience: 'C-Level / Board',
    icon: '📊',
    desc: 'High-level readiness status, risk summary, and go/no-go recommendation. No technical detail.',
    sections: ['cover', 'overview', 'metrics', 'risk', 'appSummary', 'recommendation', 'signature'],
  },
  {
    id: 'operational',
    label: 'Operational Report',
    audience: 'BCP / DR Team',
    icon: '🔧',
    desc: 'Full step detail, failure logs, remediation actions, and owner contacts for each application.',
    sections: ['cover', 'metrics', 'risk', 'appList', 'stepDetail', 'failureLogs', 'remediation', 'contacts'],
  },
  {
    id: 'custom',
    label: 'Custom',
    audience: 'Configurable',
    icon: '⚙️',
    desc: 'Choose exactly which sections and fields to include.',
    sections: [],
  },
]

const ALL_SECTIONS = [
  { id: 'cover',          label: 'Cover Page',               exec: true,  ops: false },
  { id: 'overview',       label: 'Executive Overview',        exec: true,  ops: false },
  { id: 'metrics',        label: 'Readiness Metrics',         exec: true,  ops: true  },
  { id: 'risk',           label: 'Risk Summary',              exec: true,  ops: true  },
  { id: 'appSummary',     label: 'Application Status Table',  exec: true,  ops: false },
  { id: 'appList',        label: 'Application Detail List',   exec: false, ops: true  },
  { id: 'stepDetail',     label: 'Step-by-Step Detail',       exec: false, ops: true  },
  { id: 'failureLogs',    label: 'Failure & Error Logs',      exec: false, ops: true  },
  { id: 'remediation',    label: 'Remediation Actions',       exec: false, ops: true  },
  { id: 'contacts',       label: 'Owner Contact List',        exec: false, ops: true  },
  { id: 'recommendation', label: 'Go / No-Go Recommendation', exec: true,  ops: false },
  { id: 'signature',      label: 'Approval / Signature Page', exec: true,  ops: false },
]

const SCHEDULES = [
  'Disabled',
  'After every DR Drill (auto)',
  'Weekly — Monday 08:00',
  'Monthly — 1st, 08:00',
  'Quarterly',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, className = '' }) {
  const t = useT()
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} placeholder-gray-500 outline-none focus:border-blue-500/60 transition-colors ${className}`}
    />
  )
}

// ─── Report preview (lightweight HTML preview) ────────────────────────────────
function ReportPreview({ ops, title, org, preparedFor, preparedBy, template, includeDate, includeConfidential, sections }) {
  const ready   = ops.filter(o => o.phases?.readiness?.status === 'Ended OK').length
  const failed  = ops.filter(o => o.phases?.readiness?.status === 'Ended Not OK').length
  const total   = ops.length
  const pct     = total > 0 ? Math.round(ready / total * 100) : 0
  const today   = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const goNoGo = pct >= 80 ? { label: 'GO', color: '#22c55e', reason: `${pct}% of applications are DR-ready.` }
                           : { label: 'NO-GO', color: '#ef4444', reason: `Only ${pct}% of applications are DR-ready. ${failed} application(s) require remediation.` }

  return (
    <div className="bg-white text-gray-900 rounded-xl overflow-hidden text-[11px] leading-relaxed shadow-inner">
      {/* Cover */}
      <div className="bg-slate-800 text-white px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-blue-400" />
          <span className="text-blue-300 font-semibold text-xs tracking-wide uppercase">EnsureDR</span>
        </div>
        <h1 className="text-lg font-bold mb-1">{title || 'DR Readiness Assessment Report'}</h1>
        {includeConfidential && <p className="text-red-400 text-[10px] font-semibold tracking-widest uppercase mb-3">Confidential</p>}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-300 mt-3">
          {org          && <><span className="text-slate-500">Organization</span><span>{org}</span></>}
          {preparedFor  && <><span className="text-slate-500">Prepared for</span><span>{preparedFor}</span></>}
          {preparedBy   && <><span className="text-slate-500">Prepared by</span><span>{preparedBy}</span></>}
          {includeDate  && <><span className="text-slate-500">Date</span><span>{today}</span></>}
          <span className="text-slate-500">Template</span><span>{TEMPLATES.find(t => t.id === template)?.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Metrics */}
        {sections.includes('metrics') && (
          <div>
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide border-b pb-1">Readiness Metrics</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Total',     value: total,  color: '#3b82f6' },
                { label: 'Ready',     value: ready,  color: '#22c55e' },
                { label: 'Not Ready', value: failed, color: '#ef4444' },
                { label: 'Readiness',value: `${pct}%`, color: pct >= 80 ? '#22c55e' : '#ef4444' },
              ].map(m => (
                <div key={m.label} className="rounded border border-gray-200 p-2">
                  <div className="text-base font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-gray-500 text-[10px]">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk */}
        {sections.includes('risk') && failed > 0 && (
          <div>
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide border-b pb-1">Risk Summary</h2>
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="text-red-700 font-semibold">{failed} application(s) are NOT DR-ready:</p>
              <ul className="mt-1 space-y-0.5 text-red-600">
                {ops.filter(o => o.phases?.readiness?.status === 'Ended Not OK').map(o => (
                  <li key={o.app}>• {o.app} — {o.phases.readiness.failedSteps} step(s) failed</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* App table */}
        {(sections.includes('appSummary') || sections.includes('appList')) && (
          <div>
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide border-b pb-1">Application Status</h2>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-1.5 border border-slate-200">Application</th>
                  <th className="text-center p-1.5 border border-slate-200">Criticality</th>
                  <th className="text-center p-1.5 border border-slate-200">Status</th>
                  <th className="text-center p-1.5 border border-slate-200">Steps</th>
                </tr>
              </thead>
              <tbody>
                {ops.map(o => {
                  const rdx = o.phases?.readiness
                  const isOk = rdx?.status === 'Ended OK'
                  return (
                    <tr key={o.app} className="even:bg-slate-50">
                      <td className="p-1.5 border border-slate-200 font-medium">{o.app}</td>
                      <td className="p-1.5 border border-slate-200 text-center">{o.meta?.criticality || '—'}</td>
                      <td className={`p-1.5 border border-slate-200 text-center font-semibold ${isOk ? 'text-green-600' : 'text-red-600'}`}>
                        {isOk ? '✓ Ready' : '✗ Not Ready'}
                      </td>
                      <td className="p-1.5 border border-slate-200 text-center">{rdx?.completedSteps}/{rdx?.totalSteps}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Recommendation */}
        {sections.includes('recommendation') && (
          <div>
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide border-b pb-1">Recommendation</h2>
            <div className="rounded border-2 p-3 text-center" style={{ borderColor: goNoGo.color }}>
              <div className="text-xl font-black" style={{ color: goNoGo.color }}>{goNoGo.label}</div>
              <p className="text-gray-600 mt-1">{goNoGo.reason}</p>
            </div>
          </div>
        )}

        {/* Signature */}
        {sections.includes('signature') && (
          <div>
            <h2 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide border-b pb-1">Approval</h2>
            <div className="grid grid-cols-2 gap-3">
              {['Prepared by', 'Reviewed by'].map(role => (
                <div key={role} className="border-t-2 border-slate-400 pt-1">
                  <div className="text-gray-500">{role}</div>
                  <div className="mt-3 text-gray-400 italic">Signature ____________________</div>
                  <div className="mt-1 text-gray-400">Date ________________________</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function ReadinessReportModal({ operations = [], onClose }) {
  const t = useT()

  const [template,     setTemplate]     = useState('executive')
  const [sections,     setSections]     = useState(TEMPLATES[0].sections)
  const [reportTitle,  setReportTitle]  = useState('DR Readiness Assessment Report')
  const [org,          setOrg]          = useState('')
  const [preparedFor,  setPreparedFor]  = useState('')
  const [preparedBy,   setPreparedBy]   = useState('')
  const [includeDate,          setIncludeDate]          = useState(true)
  const [includeConfidential,  setIncludeConfidential]  = useState(true)
  const [schedule,     setSchedule]     = useState('Disabled')
  const [recipients,   setRecipients]   = useState('')
  const [showPreview,  setShowPreview]  = useState(false)
  const [exporting,    setExporting]    = useState(false)
  const [exported,     setExported]     = useState(false)

  function applyTemplate(id) {
    setTemplate(id)
    const tmpl = TEMPLATES.find(t => t.id === id)
    if (id !== 'custom') setSections(tmpl.sections)
  }

  function toggleSection(id) {
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  async function handleExport(fmt) {
    setExporting(true)
    await new Promise(r => setTimeout(r, 1400))
    setExporting(false)
    setExported(true)
    setTimeout(() => setExported(false), 3000)

    // Build CSV content (PDF would require a library like jsPDF in production)
    const ready  = operations.filter(o => o.phases?.readiness?.status === 'Ended OK').length
    const failed = operations.filter(o => o.phases?.readiness?.status === 'Ended Not OK').length
    const pct    = operations.length > 0 ? Math.round(ready / operations.length * 100) : 0
    const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const tmplLabel = TEMPLATES.find(t => t.id === template)?.label

    const lines = [
      `"${reportTitle}"`,
      `"Generated","${today}"`,
      `"Template","${tmplLabel}"`,
      org         && `"Organization","${org}"`,
      preparedFor && `"Prepared For","${preparedFor}"`,
      preparedBy  && `"Prepared By","${preparedBy}"`,
      ``,
      `"READINESS SUMMARY"`,
      `"Total Applications","${operations.length}"`,
      `"Ready","${ready}"`,
      `"Not Ready","${failed}"`,
      `"Overall Readiness","${pct}%"`,
      `"Go/No-Go","${pct >= 80 ? 'GO' : 'NO-GO'}"`,
      ``,
      `"APPLICATION DETAIL"`,
      `"Application","Server","Criticality","Team","Status","Steps Completed","Steps Failed","Owner"`,
      ...operations.map(op => {
        const r = op.phases?.readiness
        const m = op.meta || {}
        return [
          `"${op.app}"`, `"${op.server}"`, `"${m.criticality || ''}"`, `"${m.team || ''}"`,
          `"${r?.status || ''}"`, `"${r?.completedSteps || 0}"`, `"${r?.failedSteps || 0}"`, `"${m.owner || ''}"`,
        ].join(',')
      }),
      sections.includes('failureLogs') ? [
        ``,
        `"FAILURE DETAILS"`,
        `"Application","Step","Status","Error"`,
        ...operations.flatMap(op =>
          (op.phases?.readiness?.steps || [])
            .filter(s => s.status === 'Ended Not OK' || s.status === 'Aborted')
            .map(s => `"${op.app}","${s.jobId || s.name}","${s.status}","${s.logs?.find(l => l.level === 'ERROR')?.msg || ''}"`)
        ),
      ].join('\n') : '',
    ].filter(Boolean).join('\n')

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `DR-Readiness-Report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeSections = template === 'custom' ? sections : TEMPLATES.find(t => t.id === template)?.sections || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${t.card} border ${t.border} rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <FileText size={18} className="text-blue-400" />
          <div>
            <h2 className={`font-bold ${t.text}`}>Generate Readiness Report</h2>
            <p className={`text-xs ${t.textMuted}`}>{operations.length} applications · {operations.filter(o => o.phases?.readiness?.status === 'Ended OK').length} ready</p>
          </div>
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border ${t.border} ${t.cardHover} ${t.textMuted} hover:text-white`}
          >
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.cardHover} ${t.textMuted} hover:text-white`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className={`grid ${showPreview ? 'md:grid-cols-2' : 'grid-cols-1'} divide-x divide-white/10`}>

            {/* Left: config */}
            <div className="px-6 py-5 space-y-6">

              {/* Template selector */}
              <div>
                <label className={`text-sm font-semibold ${t.text} block mb-2`}>Report Template</label>
                <div className="space-y-2">
                  {TEMPLATES.map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => applyTemplate(tmpl.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        template === tmpl.id
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : `${t.border} ${t.cardHover}`
                      }`}
                    >
                      <span className="text-xl leading-none mt-0.5">{tmpl.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${t.text}`}>{tmpl.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${t.border} ${t.textMuted}`}>{tmpl.audience}</span>
                        </div>
                        <p className={`text-xs ${t.textMuted} mt-0.5`}>{tmpl.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                        template === tmpl.id ? 'border-blue-400 bg-blue-500' : t.border
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
                        <div
                          key={sec.id}
                          onClick={() => toggleSection(sec.id)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer text-xs transition-all ${
                            on ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : `${t.border} ${t.textMuted} ${t.cardHover}`
                          }`}
                        >
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
                <div className="space-y-2.5">
                  <Field label="Report Title">
                    <TextInput value={reportTitle} onChange={setReportTitle} placeholder="DR Readiness Assessment Report" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Organization">
                      <TextInput value={org} onChange={setOrg} placeholder="Acme Corp" />
                    </Field>
                    <Field label="Prepared For">
                      <TextInput value={preparedFor} onChange={setPreparedFor} placeholder="Board / C-Level" />
                    </Field>
                    <Field label="Prepared By">
                      <TextInput value={preparedBy} onChange={setPreparedBy} placeholder="BCP Team" />
                    </Field>
                  </div>
                  <div className="flex gap-5 pt-1">
                    <Toggle value={includeDate}         onChange={() => setIncludeDate(v => !v)}         label="Include date" />
                    <Toggle value={includeConfidential} onChange={() => setIncludeConfidential(v => !v)} label="Mark confidential" />
                  </div>
                </div>
              </div>

              {/* Auto-generation */}
              <div className={`rounded-xl border ${t.border} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} className="text-purple-400" />
                  <span className={`text-sm font-semibold ${t.text}`}>Automatic Generation</span>
                </div>
                <div className="space-y-3">
                  <Field label="Schedule">
                    <select
                      value={schedule}
                      onChange={e => setSchedule(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.card} text-sm ${t.text} outline-none`}
                    >
                      {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  {schedule !== 'Disabled' && (
                    <Field label="Email Recipients">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} ${t.card}`}>
                        <Mail size={13} className="text-gray-400 flex-shrink-0" />
                        <input
                          value={recipients}
                          onChange={e => setRecipients(e.target.value)}
                          placeholder="cto@company.com, bcp@company.com"
                          className={`flex-1 bg-transparent text-sm ${t.text} placeholder-gray-500 outline-none`}
                        />
                      </div>
                      <p className={`text-xs ${t.textMuted} mt-1`}>Comma-separated addresses</p>
                    </Field>
                  )}
                </div>
              </div>
            </div>

            {/* Right: preview */}
            {showPreview && (
              <div className="px-4 py-5 overflow-y-auto max-h-[60vh]">
                <p className={`text-xs ${t.textMuted} mb-3 flex items-center gap-1`}>
                  <Shield size={11} /> Live preview
                </p>
                <ReportPreview
                  ops={operations}
                  title={reportTitle}
                  org={org}
                  preparedFor={preparedFor}
                  preparedBy={preparedBy}
                  template={template}
                  includeDate={includeDate}
                  includeConfidential={includeConfidential}
                  sections={activeSections}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center gap-3 px-6 py-4 border-t ${t.border} flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg ${t.cardHover} ${t.textMuted} border ${t.border}`}
          >
            Cancel
          </button>

          <div className="flex-1" />

          {exported && (
            <span className="text-sm text-green-400 flex items-center gap-1.5 animate-in fade-in">
              <Check size={14} /> Exported successfully
            </span>
          )}

          {/* CSV export */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2 border ${t.border} ${t.cardHover} ${t.textMuted} hover:text-white text-sm rounded-lg transition-colors disabled:opacity-40`}
          >
            <Download size={14} />
            Export CSV
          </button>

          {/* PDF export (generates CSV for now; swap for jsPDF in production) */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download size={14} />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
