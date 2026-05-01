import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronDown, X, Clock } from 'lucide-react'
import { useT } from '../context/ThemeContext'

const PRESETS = [
  { label: '1h',  ms: 1  * 60 * 60 * 1000 },
  { label: '6h',  ms: 6  * 60 * 60 * 1000 },
  { label: '12h', ms: 12 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '3d',  ms: 3  * 24 * 60 * 60 * 1000 },
  { label: '7d',  ms: 7  * 24 * 60 * 60 * 1000 },
  { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
]

// Collect all timestamps (start + end) across all phases of an operation
function opTimestamps(op) {
  const times = []
  for (const ph of ['switchover', 'switchback', 'readiness', 'failover', 'failback']) {
    const p = op.phases?.[ph]
    if (!p) continue
    if (p.startTimeISO) times.push(new Date(p.startTimeISO).getTime())
    if (p.endTimeISO)   times.push(new Date(p.endTimeISO).getTime())
    // fall through to individual steps if phase has no times
    if (!p.startTimeISO && Array.isArray(p.steps)) {
      for (const s of p.steps) {
        if (s.startTimeISO) times.push(new Date(s.startTimeISO).getTime())
        if (s.endTimeISO)   times.push(new Date(s.endTimeISO).getTime())
      }
    }
  }
  return times.filter(Boolean)
}

// Returns true if the operation falls within the active filter window
export function matchesFilter(op, filter) {
  if (!filter || filter.type === 'all') return true

  // Currently executing ops always show — they are live by definition
  if (op.overallStatus === 'In Progress') return true

  const times = opTimestamps(op)

  // No timestamps at all — show rather than hide
  if (times.length === 0) return true

  // Use the LATEST timestamp so recently-completed ops surface in short windows
  const opTime = Math.max(...times)

  if (filter.type === 'preset') {
    return opTime >= Date.now() - filter.ms
  }

  if (filter.type === 'date') {
    // Compare in local date string space to avoid UTC-midnight trap
    const localDate = new Date(opTime)
    const opDate = `${localDate.getFullYear()}-${String(localDate.getMonth()+1).padStart(2,'0')}-${String(localDate.getDate()).padStart(2,'0')}`
    return opDate === filter.date
  }

  if (filter.type === 'range') {
    const from = filter.from ? new Date(filter.from + 'T00:00:00').getTime() : -Infinity
    const to   = filter.to   ? new Date(filter.to   + 'T23:59:59').getTime() :  Infinity
    return opTime >= from && opTime <= to
  }

  return true
}

export default function TimelineFilter({ filter, onChange, totalCount, filteredCount }) {
  const t       = useT()
  const [open, setOpen]       = useState(false)
  const [mode, setMode]       = useState('preset')   // 'preset' | 'date' | 'range'
  const [dateVal, setDateVal] = useState('')
  const [fromVal, setFromVal] = useState('')
  const [toVal,   setToVal]   = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activePreset = filter?.type === 'preset' ? filter.label : null
  const isFiltered   = filter && filter.type !== 'all'

  function applyPreset(p) {
    onChange({ type: 'preset', label: p.label, ms: p.ms })
    setOpen(false)
  }

  function applyDate() {
    if (!dateVal) return
    onChange({ type: 'date', date: dateVal })
    setOpen(false)
  }

  function applyRange() {
    if (!fromVal && !toVal) return
    onChange({ type: 'range', from: fromVal, to: toVal })
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setOpen(false)
  }

  const buttonLabel = (() => {
    if (!filter || filter.type === 'all') return 'All time'
    if (filter.type === 'preset') return `Last ${filter.label}`
    if (filter.type === 'date')   return filter.date
    if (filter.type === 'range') {
      if (filter.from && filter.to) return `${filter.from} → ${filter.to}`
      if (filter.from) return `From ${filter.from}`
      return `Until ${filter.to}`
    }
    return 'Custom'
  })()

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {/* Badge showing filtered count */}
      {isFiltered && (
        <span className="text-xs text-blue-400 tabular-nums">
          {filteredCount}/{totalCount} apps
        </span>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          isFiltered
            ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
            : `${t.card} ${t.border} ${t.textMuted}`
        } hover:opacity-80`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{buttonLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Clear */}
      {isFiltered && (
        <button
          onClick={clear}
          className={`p-1 rounded transition-colors ${t.textFaint} hover:text-red-400`}
          title="Clear filter"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute top-full right-0 mt-2 z-50 w-72 rounded-xl border shadow-2xl overflow-hidden ${t.card} ${t.border}`}>

          {/* Tabs */}
          <div className={`flex border-b ${t.border}`}>
            {[
              { id: 'preset', label: 'Quick' },
              { id: 'date',   label: 'Date' },
              { id: 'range',  label: 'Range' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  mode === id
                    ? `border-b-2 border-blue-500 text-blue-400 -mb-px`
                    : t.textMuted
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-3">
            {/* ── Quick presets ── */}
            {mode === 'preset' && (
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      activePreset === p.label
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : `${t.border} ${t.textMuted} hover:opacity-80`
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={clear}
                  className={`col-span-4 mt-1 py-1.5 rounded-lg text-xs border transition-colors ${t.border} ${t.textFaint} hover:opacity-80`}
                >
                  Show all
                </button>
              </div>
            )}

            {/* ── Specific date ── */}
            {mode === 'date' && (
              <div className="flex flex-col gap-2">
                <label className={`text-xs ${t.textMuted}`}>Pick a date — shows ops active on that day</label>
                <input
                  type="date"
                  value={dateVal}
                  onChange={(e) => { setDateVal(e.target.value); if (e.target.value) { onChange({ type: 'date', date: e.target.value }); setOpen(false) } }}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-blue-500/40 bg-slate-800 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>
            )}

            {/* ── Date range ── */}
            {mode === 'range' && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className={`text-xs ${t.textMuted}`}>From</label>
                  <input
                    type="date"
                    value={fromVal}
                    onChange={(e) => setFromVal(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-blue-500/40 bg-slate-800 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`text-xs ${t.textMuted}`}>To</label>
                  <input
                    type="date"
                    value={toVal}
                    onChange={(e) => setToVal(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-blue-500/40 bg-slate-800 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
                <button
                  onClick={applyRange}
                  disabled={!fromVal && !toVal}
                  className="w-full py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Apply Range
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
