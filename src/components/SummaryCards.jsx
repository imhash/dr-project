import { Layers, ArrowRightLeft, ArrowLeftRight, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'
import { useT } from '../context/ThemeContext'

function StatCard({ icon: Icon, label, value, sub, color, border, tooltip, tooltipVariant = 'red' }) {
  const t = useT()
  const accent = tooltipVariant === 'amber'
    ? { border: 'border-amber-500/30', bg: 'bg-amber-500/10', bbot: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400', caret: 'border-amber-500/30' }
    : { border: 'border-red-500/30',   bg: 'bg-red-500/10',   bbot: 'border-red-500/20',   text: 'text-red-400',   dot: 'bg-red-400',   caret: 'border-red-500/30' }

  return (
    <div className={`${t.card} border ${border} rounded-xl p-4 flex items-center gap-4 relative group`}>
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none ${t.text}`}>{value}</p>
        <p className={`text-xs mt-1 truncate ${t.textMuted}`}>{label}</p>
        {sub && <p className={`text-xs mt-0.5 truncate ${t.textFaint}`}>{sub}</p>}
      </div>
      {tooltip?.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:flex flex-col pointer-events-none min-w-[220px]">
          <div className={`bg-gray-950 border ${accent.border} rounded-xl shadow-2xl overflow-hidden`}>
            <div className={`flex items-center gap-2 px-3 py-2 ${accent.bg} border-b ${accent.bbot}`}>
              <Icon className={`w-3.5 h-3.5 ${accent.text} flex-shrink-0`} />
              <span className={`text-[11px] font-semibold ${accent.text} uppercase tracking-wide`}>{label}</span>
            </div>
            <ul className="px-3 py-2 space-y-2">
              {tooltip.map((item) => (
                <li key={typeof item === 'string' ? item : item.app} className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} flex-shrink-0 mt-1`} />
                  {typeof item === 'string' ? (
                    <span className="text-xs text-gray-200">{item}</span>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-100">{item.app}</p>
                      <p className={`text-[11px] ${accent.text}`}>{item.phase} · {item.rtoStatus}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className={`w-2.5 h-2.5 bg-gray-950 border-r border-b ${accent.caret} rotate-45 mx-auto -mt-1.5`} />
        </div>
      )}
    </div>
  )
}

export default function SummaryCards({ operations }) {
  if (!operations?.length) return null

  const allPhases = operations.flatMap(({ phases }) =>
    ['switchover', 'switchback', 'readiness'].map((ph) => phases[ph]).filter(Boolean)
  )

  const drillOps    = operations.filter((o) => o.phases.switchover || o.phases.switchback)
  const apps        = drillOps.length
  const switchovers = drillOps.filter((o) => o.phases.switchover).length
  const switchbacks = drillOps.filter((o) => o.phases.switchback).length
  const readiness   = operations.filter((o) => o.phases.readiness).length
  const readinessImpairedOps = operations.filter(
    (o) => o.phases.readiness && o.phases.readiness.status === 'Ended Not OK'
  )
  const rtoAlertOps = operations.flatMap((o) =>
    ['switchover', 'switchback'].flatMap((ph) => {
      const p = o.phases[ph]
      if (!p || !['At Risk', 'Breached', 'Missed'].includes(p.rtoStatus)) return []
      return [{ app: o.app, phase: ph.charAt(0).toUpperCase() + ph.slice(1), rtoStatus: p.rtoStatus }]
    })
  )
  const breached    = rtoAlertOps.filter((r) => ['Breached', 'Missed'].includes(r.rtoStatus)).length
  const atRisk      = rtoAlertOps.filter((r) => r.rtoStatus === 'At Risk').length
  const completed   = drillOps.filter((o) => o.overallStatus === 'Completed').length

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-6 py-4">
      {/* 1 — Apps in Drill (overview anchor) */}
      <StatCard icon={Layers}        label="Applications in Drill"   value={apps}        sub={`${completed} completed`}  color="bg-blue-500/15 text-blue-400"     border="border-blue-500/20" />
      {/* 2 — Readiness Checks */}
      <StatCard icon={ShieldCheck}   label="Readiness Checks"        value={readiness}   sub="active phases"             color="bg-emerald-500/15 text-emerald-400" border="border-emerald-500/20" />
      {/* 3 — Not DR Ready */}
      <StatCard
        icon={XCircle}
        label="Not DR Ready"
        value={readinessImpairedOps.length}
        sub={readinessImpairedOps.length > 0 ? `${readinessImpairedOps.length} app${readinessImpairedOps.length > 1 ? 's' : ''} failed` : '✓ all ready'}
        color={readinessImpairedOps.length > 0 ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}
        border={readinessImpairedOps.length > 0 ? 'border-red-500/20' : 'border-green-500/20'}
        tooltip={readinessImpairedOps.map((o) => o.app)}
      />
      {/* 4 — Switchovers */}
      <StatCard icon={ArrowRightLeft} label="Switchovers"            value={switchovers} sub="active phases"             color="bg-sky-500/15 text-sky-400"       border="border-sky-500/20" />
      {/* 5 — Switchbacks */}
      <StatCard icon={ArrowLeftRight} label="Switchbacks"            value={switchbacks} sub="active phases"             color="bg-violet-500/15 text-violet-400" border="border-violet-500/20" />
      {/* 6 — RTO Risk with hover */}
      <StatCard
        icon={AlertTriangle}
        label="RTO At Risk / Breached"
        value={breached + atRisk}
        sub={`${breached} breached · ${atRisk} at risk`}
        color={(breached + atRisk) > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}
        border={(breached + atRisk) > 0 ? 'border-amber-500/20' : 'border-green-500/20'}
        tooltip={rtoAlertOps}
        tooltipVariant="amber"
      />
    </div>
  )
}
