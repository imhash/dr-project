import { useState } from 'react'
import { X, FileSpreadsheet, FileText, BarChart3, ClipboardList, ChevronRight } from 'lucide-react'
import { useT } from '../context/ThemeContext'
import DrillReportModal    from './DrillReportModal'
import DrillEvidenceModal  from './DrillEvidenceModal'
import ReadinessReportModal from './ReadinessReportModal'

const REPORTS = [
  {
    id: 'drill-summary',
    icon: FileSpreadsheet,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    accent: 'bg-green-600 hover:bg-green-500',
    label: 'DR Drill Summary',
    desc: 'Excel-style tabular report of all drill phases — switchover, switchback, failover, failback — with RTO, SLA status, and CTM job references.',
    tags: ['Excel', 'CSV', 'All phases', 'RTO'],
  },
  {
    id: 'drill-evidence',
    icon: ClipboardList,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    accent: 'bg-indigo-600 hover:bg-indigo-500',
    label: 'DR Drill Evidence',
    desc: 'Formal PDF evidence document for audit and compliance. Includes RTO / RPO compliance, phase-by-phase detail, failure log, remediation actions, and sign-off page.',
    tags: ['PDF', 'Audit', 'RTO/RPO', 'Sign-off'],
  },
  {
    id: 'readiness',
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    accent: 'bg-blue-600 hover:bg-blue-500',
    label: 'DR Readiness Report',
    desc: 'Assessment report showing per-application readiness status, step-by-step results, folder runs, RPO, and per-app Go / No-Go decisions.',
    tags: ['PDF', 'CSV', 'Go/No-Go', 'Readiness'],
  },
]

export default function ReportsHub({ operations, readinessOperations, onClose }) {
  const t = useT()
  const [active, setActive] = useState(null)

  if (active === 'drill-summary') {
    return <DrillReportModal operations={operations} onClose={() => setActive(null)} onBack={() => setActive(null)} />
  }
  if (active === 'drill-evidence') {
    return <DrillEvidenceModal operations={operations} onClose={() => setActive(null)} />
  }
  if (active === 'readiness') {
    return <ReadinessReportModal operations={readinessOperations || operations} onClose={() => setActive(null)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`${t.card} border ${t.border} rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${t.border}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className={`font-bold ${t.text}`}>Reports</h2>
            <p className={`text-xs ${t.textMuted}`}>Select a report type to generate or export</p>
          </div>
          <button onClick={onClose} className={`ml-auto p-2 rounded-lg ${t.cardHover} ${t.textMuted}`}>
            <X size={16} />
          </button>
        </div>

        {/* Report cards */}
        <div className="p-5 space-y-3">
          {REPORTS.map(r => {
            const Icon = r.icon
            return (
              <div key={r.id}
                onClick={() => setActive(r.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${t.border} ${t.cardHover} group`}
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${r.bg}`}>
                  <Icon size={18} className={r.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${t.text}`}>{r.label}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${t.border} ${t.textFaint}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <p className={`text-xs leading-relaxed ${t.textMuted}`}>{r.desc}</p>
                </div>
                <ChevronRight size={16} className={`flex-shrink-0 mt-1 ${t.textFaint} group-hover:${t.textMuted} transition-colors`} />
              </div>
            )
          })}
        </div>

        <div className={`px-6 py-3 border-t ${t.border}`}>
          <p className={`text-xs ${t.textFaint}`}>
            {operations.length} applications loaded · click a report to configure and generate
          </p>
        </div>
      </div>
    </div>
  )
}
