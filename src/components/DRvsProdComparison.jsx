import { ArrowUpDown, CheckCircle2, XCircle, Wifi, WifiOff } from 'lucide-react'
import { useT } from '../context/ThemeContext'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function SlaBar({ value }) {
  const color = value >= 99 ? 'bg-green-500' : value >= 95 ? 'bg-amber-500' : 'bg-red-500'
  const text  = value >= 99 ? 'text-green-500' : value >= 95 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-mono ${text}`}>{value}%</span>
    </div>
  )
}

function EnvColumn({ data, isActive }) {
  const t = useT()
  const isOnDrill = data.status.includes('Drill')

  return (
    <div className={`flex-1 rounded-xl border p-4 flex flex-col gap-3 ${
      isActive ? `${t.inner} border-blue-500/40` : `${t.card} ${t.border}`
    }`}>
      {/* Env label */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${t.text}`}>{data.label}</p>
          <p className={`text-xs ${t.textFaint} font-mono mt-0.5`}>{data.servers.join(', ')}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
          isOnDrill
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600'
            : data.status === 'Active'
            ? 'bg-green-500/10 border-green-500/30 text-green-600'
            : 'bg-red-500/10 border-red-500/30 text-red-600'
        }`}>
          {isOnDrill
            ? <Wifi className="w-3 h-3" />
            : data.status === 'Active'
            ? <CheckCircle2 className="w-3 h-3" />
            : <WifiOff className="w-3 h-3" />}
          {data.status}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricBox label="Active Jobs"    value={data.activeJobs}    color={data.activeJobs > 0    ? 'text-cyan-600'  : undefined} />
        <MetricBox label="Completed"      value={data.completedJobs} color="text-green-600" />
        <MetricBox label="Failed"         value={data.failedJobs}    color={data.failedJobs > 0    ? 'text-red-600'   : undefined} />
        <MetricBox label="Waiting"        value={data.waitingJobs}   color={data.waitingJobs > 0   ? 'text-amber-600' : undefined} />
      </div>

      {/* Agents */}
      <div className={`border-t ${t.border} pt-3`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={t.textFaint}>Agents Connected</span>
          <span className={data.agentsConnected === data.agentsTotal ? 'text-green-600' : 'text-amber-600'}>
            {data.agentsConnected}/{data.agentsTotal}
          </span>
        </div>
        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${data.agentsConnected === data.agentsTotal ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${(data.agentsConnected / data.agentsTotal) * 100}%` }}
          />
        </div>
      </div>

      {/* SLA */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className={t.textFaint}>SLA Compliance</span>
        </div>
        <SlaBar value={data.slaCompliance} />
      </div>

      {/* Footer meta */}
      <div className={`grid grid-cols-2 gap-1.5 text-xs border-t ${t.border} pt-3`}>
        <FooterStat label="CTM Version"      value={data.version} />
        <FooterStat label="Uptime"           value={data.uptime} />
        <FooterStat label="Avg Job Duration" value={data.avgJobDuration} />
        <FooterStat label="Last Sync"        value={formatDate(data.lastSync)} />
      </div>
    </div>
  )
}

function FooterStat({ label, value }) {
  const t = useT()
  return (
    <div>
      <p className={t.textFaint}>{label}</p>
      <p className={`${t.textSub} font-mono mt-0.5`}>{value}</p>
    </div>
  )
}

function MetricBox({ label, value, color }) {
  const t = useT()
  return (
    <div className={`${t.inner} rounded-lg px-3 py-2`}>
      <p className={`${t.textFaint} text-xs`}>{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color ?? t.textSub}`}>{value}</p>
    </div>
  )
}

export default function DRvsProdComparison({ data }) {
  const t = useT()
  if (!data) return null

  const delta = {
    failed: data.dr.failedJobs - data.prod.failedJobs,
    sla:    (data.dr.slaCompliance - data.prod.slaCompliance).toFixed(1),
    agents: data.dr.agentsConnected - data.prod.agentsConnected,
  }

  return (
    <div className={`${t.card} border ${t.border} rounded-xl p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-semibold ${t.text}`}>Production vs DR Comparison</h2>
          <p className={`text-xs ${t.textFaint} mt-0.5`}>Live environment metrics side by side</p>
        </div>
        <ArrowUpDown className={`w-4 h-4 ${t.textFaint}`} />
      </div>

      {/* Delta strip */}
      <div className="flex gap-2 flex-wrap text-xs">
        <DeltaBadge label="Failed Jobs Δ" value={delta.failed}        invert />
        <DeltaBadge label="SLA Δ"         value={Number(delta.sla)}   suffix="%" />
        <DeltaBadge label="Agents Δ"      value={delta.agents} />
      </div>

      {/* Side-by-side columns */}
      <div className="flex gap-3">
        <EnvColumn data={data.prod} isActive={false} />
        <EnvColumn data={data.dr}   isActive />
      </div>
    </div>
  )
}

function DeltaBadge({ label, value, suffix = '', invert = false }) {
  const isNeutral = value === 0
  const isBad  = invert ? value > 0 : value < 0
  const isGood = invert ? value < 0 : value > 0

  const color = isNeutral
    ? 'bg-slate-500/10 border-slate-400/30 text-slate-500'
    : isBad
    ? 'bg-red-500/10 border-red-500/30 text-red-600'
    : 'bg-green-500/10 border-green-500/30 text-green-600'

  const sign = value > 0 ? '+' : ''

  return (
    <span className={`px-2.5 py-1 rounded-full border text-xs ${color}`}>
      {label}: {sign}{value}{suffix}
    </span>
  )
}
