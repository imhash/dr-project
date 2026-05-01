import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Tv2, CheckCircle2, XCircle, AlertTriangle, Clock,
  Zap, ArrowRightLeft, ArrowLeftRight, ShieldCheck,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'

// ── Colour helpers ────────────────────────────────────────────────────────────

function overallColor(op) {
  if (op.overallStatus === 'Failed'    || op.drillHealth === 'Failed')  return 'red'
  if (op.drillHealth  === 'Breached')                                   return 'red'
  if (op.drillHealth  === 'At Risk')                                    return 'amber'
  if (op.overallStatus === 'Completed' && op.drillHealth === 'On Track') return 'green'
  if (op.overallStatus === 'In Progress')                               return 'cyan'
  return 'slate'
}

const PAL = {
  red:   { border: 'border-red-500/50',   glow: 'bg-red-500/8',    dot: 'bg-red-400',    accent: 'text-red-400',    bar: 'bg-red-500',    badge: 'bg-red-500/15 border-red-500/30 text-red-300' },
  amber: { border: 'border-amber-500/50', glow: 'bg-amber-500/8',  dot: 'bg-amber-400',  accent: 'text-amber-400',  bar: 'bg-amber-500',  badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
  green: { border: 'border-green-500/50', glow: 'bg-green-500/8',  dot: 'bg-green-400',  accent: 'text-green-400',  bar: 'bg-green-500',  badge: 'bg-green-500/15 border-green-500/30 text-green-300' },
  cyan:  { border: 'border-cyan-500/50',  glow: 'bg-cyan-500/8',   dot: 'bg-cyan-400',   accent: 'text-cyan-400',   bar: 'bg-cyan-500',   badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' },
  slate: { border: 'border-slate-500/30', glow: 'bg-slate-500/5',  dot: 'bg-slate-500',  accent: 'text-slate-400',  bar: 'bg-slate-500',  badge: 'bg-slate-500/10 border-slate-500/20 text-slate-400' },
}

function phaseStatusCls(s) {
  if (s === 'Ended OK')     return 'text-green-400'
  if (s === 'Ended Not OK') return 'text-red-400'
  if (s === 'Executing')    return 'text-cyan-400'
  return 'text-slate-500'
}

function phaseStatusLabel(s) {
  if (s === 'Ended OK')     return 'OK'
  if (s === 'Ended Not OK') return 'FAIL'
  if (s === 'Executing')    return 'RUN'
  return '–'
}

function rtoLabel(s) {
  if (s === 'On Track')  return { label: 'On Track', cls: 'text-green-400' }
  if (s === 'At Risk')   return { label: 'At Risk',  cls: 'text-amber-400' }
  if (s === 'Breached')  return { label: 'Breached', cls: 'text-red-400' }
  if (s === 'Missed')    return { label: 'Missed',   cls: 'text-red-400' }
  if (s === 'Met')       return { label: 'Met',      cls: 'text-green-400' }
  return null
}

function HealthIcon({ color }) {
  const sz = 'w-[1.1em] h-[1.1em] flex-shrink-0'
  if (color === 'green') return <CheckCircle2 className={`${sz} text-green-400`} />
  if (color === 'red')   return <XCircle      className={`${sz} text-red-400`} />
  if (color === 'amber') return <AlertTriangle className={`${sz} text-amber-400`} />
  if (color === 'cyan')  return <Zap           className={`${sz} text-cyan-400`} />
  return <Clock className={`${sz} text-slate-400`} />
}

// ── Phase row ─────────────────────────────────────────────────────────────────

function PhaseRow({ Icon, label, data, rdyFailed }) {
  if (!data) return null
  const sCls  = rdyFailed ? 'text-red-400' : phaseStatusCls(data.status)
  const sLbl  = rdyFailed ? 'FAIL' : phaseStatusLabel(data.status)
  const rto   = rtoLabel(data.rtoStatus)
  const steps = data.totalSteps > 0
    ? `${data.steps?.filter(s => s.status === 'Ended OK').length ?? 0}/${data.totalSteps}`
    : null

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${rdyFailed ? 'bg-red-500/10 rounded px-1 -mx-1' : ''}`}>
      <Icon className={`w-[1em] h-[1em] flex-shrink-0 ${rdyFailed ? 'text-red-500' : 'text-slate-500'}`} />
      <span className={`w-[3.2em] flex-shrink-0 ${rdyFailed ? 'text-red-400' : 'text-slate-400'}`}>{label}</span>
      <span className={`font-bold w-[2.5em] flex-shrink-0 ${sCls}`}>{sLbl}</span>
      {rto && <span className={`truncate ${rto.cls}`}>{rto.label}</span>}
      {steps && <span className="ml-auto text-slate-500 flex-shrink-0 tabular-nums">{steps}</span>}
    </div>
  )
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function AppTile({ op, onDismiss }) {
  const color    = overallColor(op)
  const pal      = PAL[color]
  const p        = op.phases
  const impaired = p.readiness?.status === 'Ended Not OK'

  // Only S/O and S/B count as drill phases
  const drillPhases    = ['switchover', 'switchback'].map((ph) => p[ph]).filter(Boolean)
  const totalDrillPh   = drillPhases.length
  const completedDrillPh = drillPhases.filter((ph) => ph.status === 'Ended OK').length
  const pct = totalDrillPh > 0 ? Math.round((completedDrillPh / totalDrillPh) * 100) : 0

  const healthLabel =
    op.overallStatus === 'Completed' ? 'Done' :
    op.overallStatus === 'Failed'    ? 'Failed' :
    op.drillHealth   ?? op.overallStatus ?? '–'

  return (
    <div className={`border rounded-xl flex flex-col overflow-hidden relative ${pal.border} ${pal.glow}`}>

      {/* ── Impaired banner ── */}
      {impaired && (
        <div className="flex items-center justify-between gap-1 px-2 py-0.5 bg-red-500/20 border-b border-red-500/30">
          <span className="text-red-300 font-semibold" style={{ fontSize: '0.8em' }}>
            ⚠ Readiness Failed
          </span>
          <button
            onClick={() => onDismiss(op.app)}
            className="text-red-400 hover:text-red-200 transition-colors flex-shrink-0 leading-none"
            title="Dismiss this alert"
            style={{ fontSize: '0.9em' }}
          >
            <X className="w-[1em] h-[1em]" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 min-w-0">
        <HealthIcon color={color} />
        <span className="font-bold truncate text-white leading-tight flex-1 min-w-0">
          {op.app}
        </span>
        <span className={`flex-shrink-0 border rounded px-1 py-0.5 font-semibold leading-none ${pal.badge}`}
              style={{ fontSize: '0.85em' }}>
          {healthLabel}
        </span>
      </div>

      {/* ── Divider ── */}
      <div className="mx-2 border-t border-white/5" />

      {/* ── Phase rows ── */}
      <div className="flex-1 flex flex-col justify-around px-2 py-1 gap-0.5 min-h-0" style={{ fontSize: 'inherit' }}>
        <PhaseRow Icon={ArrowRightLeft} label="S/O"  data={p.switchover} />
        <PhaseRow Icon={ArrowLeftRight} label="S/B"  data={p.switchback} />
        <PhaseRow Icon={ShieldCheck}    label="RDY"  data={p.readiness}  rdyFailed={impaired} />
      </div>

      {/* ── Progress bar ── */}
      <div className="mx-2 mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-slate-500" style={{ fontSize: '0.8em' }}>
            {completedDrillPh}/{totalDrillPh} phases
          </span>
          <span className={`font-semibold tabular-nums ${pal.accent}`} style={{ fontSize: '0.8em' }}>
            {pct}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pal.bar}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main TV View ──────────────────────────────────────────────────────────────

export default function TVView({ operations, onClose }) {
  const containerRef  = useRef(null)
  const [cols, setCols]         = useState(4)
  const [dismissed, setDismissed] = useState(new Set())

  const handleDismiss = useCallback((app) => {
    setDismissed((prev) => new Set([...prev, app]))
  }, [])

  const visible = operations.filter((o) => !dismissed.has(o.app))

  useEffect(() => {
    function compute() {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      const n   = visible.length || 1
      const GAP = 8
      const MIN_TILE_H = 110   // each tile needs at least this height to show content

      let best = { cols: 1, score: Infinity }
      for (let c = 1; c <= n; c++) {
        const rows  = Math.ceil(n / c)
        const tileW = (width  - GAP * (c - 1)) / c
        const tileH = (height - GAP * (rows - 1)) / rows
        if (tileH < MIN_TILE_H) continue          // too short — skip
        const ratio = tileW / tileH
        const score = Math.abs(ratio - 2.5)       // target ~2.5:1
        if (score < best.score) best = { cols: c, score }
      }
      // fallback: fit as many cols as possible with MIN_TILE_H
      if (best.cols === 1 && n > 1) {
        for (let c = n; c >= 1; c--) {
          const rows  = Math.ceil(n / c)
          const tileH = (height - GAP * (rows - 1)) / rows
          if (tileH >= MIN_TILE_H) { best = { cols: c }; break }
        }
      }
      setCols(best.cols || Math.ceil(Math.sqrt(n)))
    }

    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [visible.length])

  const tTheme = useT()

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${tTheme.pageBg}`}>

      {/* Top bar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${tTheme.header} flex-shrink-0`}>
        <div className="flex items-center gap-2">
          <Tv2 className="w-4 h-4 text-blue-400" />
          <span className={`text-sm font-semibold ${tTheme.text}`}>TV View</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${tTheme.border} ${tTheme.textMuted}`}>
            {visible.length}/{operations.length} apps
          </span>
          {dismissed.size > 0 && (
            <button
              onClick={() => setDismissed(new Set())}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              restore {dismissed.size} dismissed
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg border transition-colors ${tTheme.card} ${tTheme.border} ${tTheme.textMuted} hover:opacity-80`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden">
        <div
          className="w-full h-full"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 8,
            fontSize: Math.max(10, Math.min(13, (containerRef.current?.offsetWidth ?? 1200) / cols / 14)),
          }}
        >
          {visible.map((op) => <AppTile key={op.app} op={op} onDismiss={handleDismiss} />)}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-5 px-4 py-1.5 border-t ${tTheme.header} flex-shrink-0`}>
        {[
          { color: 'green', label: 'Completed' },
          { color: 'cyan',  label: 'In Progress' },
          { color: 'amber', label: 'At Risk' },
          { color: 'red',   label: 'Failed / Breached' },
          { color: 'slate', label: 'Pending' },
        ].map(({ color, label }) => (
          <span key={color} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-2 h-2 rounded-full ${PAL[color].dot}`} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          S/O Switchover · S/B Switchback · RDY Readiness
        </span>
      </div>
    </div>
  )
}
