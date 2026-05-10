/**
 * Control-M Automation API Service
 *
 * Auth: x-api-key header (base64-encoded API key)
 * CORS: Vite dev proxy at /ctm-api → se-preprod-aapi.us1.controlm.com
 *
 * DR Phases (subApplication field values, case-insensitive):
 *   switchover, switchback, readiness, failover, failback
 *
 * SLA:
 *   - SLA deadline = startTime + user-configured minutes (estimatedEndTime is unreliable in SaaS)
 *   - Readiness has NO SLA
 *   - slaConfig passed in from useSettings hook
 *
 * Step tracking:
 *   - ALL jobs sharing the same app + subApplication are collected as "steps"
 *   - Ordered by start time ascending (chronological workflow order)
 *   - Step count displayed as completedSteps/totalSteps (e.g. 3/12)
 */

import {
  mockDROperations,
  mockJobs,
  mockEnvComparison,
  mockAgents,
} from '../data/mockData'

import { getConfig } from '../config'

// Resolved lazily so config.json is always read after loadConfig() in main.jsx
function cfg() { return getConfig() }

const BASE_URL       = () => cfg().ctmApiBase    || '/ctm-api'
const USE_MOCK       = () => cfg().useMock        === true
const DEFAULT_SERVER = () => cfg().ctmServer      || ''

let _apiKey = ''

/** Call this once after the user authenticates to wire up the key for all API calls. */
export function setApiKey(key) {
  _apiKey = (key || '').trim()
}

// ---------- Core fetch ----------

async function ctmFetch(path, opts = {}) {
  const res = await fetch(`${BASE_URL()}${path}`, {
    ...opts,
    headers: {
      'x-api-key': _apiKey,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CTM API ${res.status} — ${path}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ---------- Query builder ----------

/**
 * Build the query string for /run/jobs/status requests.
 * Always includes a limit; optionally filters by CTM server name.
 *
 * Examples:
 *   buildJobsQuery(1000)         → '?limit=1000'
 *   buildJobsQuery(1000, 'PROD') → '?limit=1000&server=PROD'
 */
function buildJobsQuery(limit = 1000, server = '') {
  const params = new URLSearchParams({ limit: String(limit) })
  if (server && server.trim()) params.append('server', server.trim())
  return `?${params.toString()}`
}

// ---------- Time helpers ----------

/** Control-M timestamps: "yyyyMMddHHmmss" → Date (treated as local browser time) */
export function parseCtmTime(ts) {
  if (!ts || ts.length < 8) return null
  const y  = parseInt(ts.slice(0, 4),  10)
  const mo = parseInt(ts.slice(4, 6),  10) - 1
  const d  = parseInt(ts.slice(6, 8),  10)
  const h  = ts.length >= 10 ? parseInt(ts.slice(8,  10), 10) : 0
  const mi = ts.length >= 12 ? parseInt(ts.slice(10, 12), 10) : 0
  const s  = ts.length >= 14 ? parseInt(ts.slice(12, 14), 10) : 0
  const dt = new Date(y, mo, d, h, mi, s)
  return isNaN(dt.getTime()) ? null : dt
}

function diffMins(a, b) {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

// ---------- Job type helpers ----------

// CTM container/folder types — these are workflow wrappers, NOT executable steps.
// Individual job types (Job, Command, Script, OS, SAP, etc.) are the actual steps.
const FOLDER_TYPES = new Set([
  'folder', 'simplefolder', 'subfolder', 'smartfolder',
])

/**
 * Extract the CTM order ID from a job's jobId field.
 * Formats seen in the wild:
 *   "IN01:0ie7m"         → "0ie7m"   (folder entry)
 *   "IN01:0ie7m-00001"   → "0ie7m"   (step with 5-digit job number)
 *   "IN01:14ff5-R1"      → "14ff5"   (legacy mock format)
 * Returns empty string when jobId is absent/unparseable.
 */
function extractOrderId(jobId) {
  if (!jobId) return ''
  const afterColon = jobId.includes(':') ? jobId.slice(jobId.indexOf(':') + 1) : jobId
  // Strip trailing -NNNNN (5-digit job number) or -RN (legacy) suffix
  return afterColon.replace(/-(\d{5}|R\d+)$/, '').trim()
}

/**
 * Extract the folder-run order ID from a job's folderId field.
 *
 * CTM folderId encoding (from jobs/status response):
 *   "PROD:"       → empty string — this entry IS the folder container itself
 *   "PROD:0ifb1"  → "0ifb1"     — this entry is a step inside folder run 0ifb1
 *
 * Returns empty string for folder-type entries, the run order ID for steps.
 */
function folderRunIdFromFolderId(folderId) {
  if (!folderId) return ''
  const i = folderId.indexOf(':')
  if (i < 0) return ''
  return folderId.slice(i + 1).trim()
}

/**
 * Returns true when a raw CTM entry is a folder/container (not an executable step).
 * Uses folderId when present (authoritative); falls back to type-based detection.
 */
function isExecutableJob(raw) {
  // folderId-based check is authoritative: "SERVER:" (nothing after colon) = folder entry
  if (raw.folderId !== undefined) {
    return folderRunIdFromFolderId(raw.folderId) !== ''
  }
  const type = (raw.type || '').toLowerCase()
  if (!type) return raw.name !== raw.folder
  return !FOLDER_TYPES.has(type)
}

// ---------- Step builder ----------
// Converts a raw CTM job object into a step record (one row in PhaseStepReport)

function buildStep(raw) {
  const start = parseCtmTime(raw.startTime)
  const end   = raw.endTime ? parseCtmTime(raw.endTime) : null
  const now   = new Date()
  const elapsed = start ? Math.max(0, diffMins(start, end || now)) : 0

  // Extract error detail from available fields
  let errorDetail = null
  if (raw.status === 'Ended Not OK') {
    errorDetail = raw.held
      || raw.statusReason
      || raw.description
      || 'Job ended with errors — check CTM output log for details'
  }

  return {
    jobId:          raw.jobId,
    name:           raw.name,
    description:    raw.description   || null,
    application:    raw.application   || null,
    subApplication: raw.subApplication || null,
    folder:         raw.folder,
    status:         raw.status,
    held:           raw.held  || null,
    startTimeISO:   start ? start.toISOString() : null,
    endTimeISO:     end   ? end.toISOString()   : null,
    elapsedMins:    elapsed,
    logURI:         raw.logURI || null,
    errorDetail,
  }
}

// ---------- Phase builder ----------
//
// Accepts an ARRAY of raw CTM jobs belonging to the same app + phase.
// Returns a single phase object with step-level detail included.
//
// slaTargetMins:
//   null   → Readiness / no SLA phase — skip RTO calculations
//   number → SLA deadline = earliest startTime + slaTargetMins

function buildPhaseFromJobs(jobs, phase, slaTargetMins) {
  if (!jobs || jobs.length === 0) return null

  // Separate folder/container entries from actual executable jobs
  const folderEntries = jobs.filter((j) => !isExecutableJob(j))
  const execJobs      = jobs.filter(isExecutableJob)

  // Steps = only executable jobs; fall back to all if type info is absent
  const stepJobs = execJobs.length > 0 ? execJobs : jobs

  // Build step records ordered chronologically
  const steps = stepJobs
    .map(buildStep)
    .sort((a, b) => {
      const ta = a.startTimeISO ? new Date(a.startTimeISO).getTime() : 0
      const tb = b.startTimeISO ? new Date(b.startTimeISO).getTime() : 0
      return ta - tb
    })

  // Aggregate step counts (based on executable steps only)
  const totalSteps     = steps.length
  const completedSteps = steps.filter((s) => s.status === 'Ended OK').length
  const failedSteps    = steps.filter((s) => s.status === 'Ended Not OK').length
  const runningSteps   = steps.filter((s) => s.status === 'Executing').length

  // Overall phase status: worst-case across all jobs (folder entry may reflect overall)
  const allFailed  = jobs.some((j) => j.status === 'Ended Not OK')
  const anyRunning = jobs.some((j) => j.status === 'Executing')
  const allOk      = jobs.every((j) => j.status === 'Ended OK')
  const overallStatus =
    allFailed   ? 'Ended Not OK'
    : anyRunning ? 'Executing'
    : allOk      ? 'Ended OK'
    : jobs[0]?.status || 'Unknown'

  // Phase timing: use folder entry if available (it carries the full workflow window),
  // otherwise derive from individual step timings
  const folderJob = folderEntries[0]
  let phaseStart, phaseEnd

  if (folderJob?.startTime) {
    phaseStart = parseCtmTime(folderJob.startTime)
    phaseEnd   = folderJob.endTime ? parseCtmTime(folderJob.endTime) : null
  } else {
    const starts = steps.map((s) => s.startTimeISO).filter(Boolean).sort()
    const ends   = steps.map((s) => s.endTimeISO).filter(Boolean).sort()
    phaseStart = starts[0] ? new Date(starts[0]) : null
    phaseEnd   = ends[ends.length - 1] ? new Date(ends[ends.length - 1]) : null
  }

  // Folder name: prefer the folder entry's own name (= workflow folder name in CTM)
  const folder = folderJob?.name || folderJob?.folder || steps[0]?.folder || ''
  const jobId  = folderJob?.jobId || steps[0]?.jobId || ''

  const hasSLA      = slaTargetMins != null && phase !== 'readiness'
  const now         = new Date()
  const refEnd      = phaseEnd || now
  const elapsedMins = phaseStart ? Math.max(0, diffMins(phaseStart, refEnd)) : 0

  if (!hasSLA) {
    return {
      jobId, folder, status: overallStatus,
      startTimeISO: phaseStart ? phaseStart.toISOString() : null,
      endTimeISO:   phaseEnd   ? phaseEnd.toISOString()   : null,
      estEndISO:    null,
      hasSLA:       false,
      rtoTargetMins:  null,
      elapsedMins,
      rtoPct:       null,
      rtoStatus:    'N/A',
      rtoBreached:  false,
      steps,
      totalSteps,
      completedSteps,
      failedSteps,
      runningSteps,
    }
  }

  // SLA phase
  const rtoTargetMins = Number(slaTargetMins)
  const deadline      = phaseStart ? new Date(phaseStart.getTime() + rtoTargetMins * 60_000) : null
  const rtoPct        = rtoTargetMins > 0 ? Math.round((elapsedMins / rtoTargetMins) * 100) : 0
  const rtoBreached   = !phaseEnd && elapsedMins > rtoTargetMins
  const rtoStatus     =
    phaseEnd
      ? (elapsedMins <= rtoTargetMins ? 'Met' : 'Missed')
      : rtoBreached
      ? 'Breached'
      : rtoPct >= 80
      ? 'At Risk'
      : 'On Track'

  return {
    jobId, folder, status: overallStatus,
    startTimeISO: phaseStart ? phaseStart.toISOString() : null,
    endTimeISO:   phaseEnd   ? phaseEnd.toISOString()   : null,
    estEndISO:    deadline   ? deadline.toISOString()   : null,
    hasSLA:       true,
    rtoTargetMins,
    elapsedMins,
    rtoPct:       Math.min(200, rtoPct),
    rtoStatus,
    rtoBreached,
    steps,
    totalSteps,
    completedSteps,
    failedSteps,
    runningSteps,
  }
}

// ---------- DR Operations ----------

const DR_PHASES = new Set(['switchover', 'switchback', 'readiness', 'failover', 'failback'])

const EMPTY_BY_PHASE = () => ({
  switchover: { folder: null, steps: [], folderEntries: [] },
  switchback: { folder: null, steps: [], folderEntries: [] },
  readiness:  { folder: null, steps: [], folderEntries: [], allJobs: [] },
  failover:   { folder: null, steps: [], folderEntries: [] },
  failback:   { folder: null, steps: [], folderEntries: [] },
})

/**
 * Build readiness phase with per-execution folderRuns.
 *
 * Uses the CTM folderId field to identify entry types and group steps into runs:
 *   folderId = "SERVER:"        → folder/container entry for one execution
 *   folderId = "SERVER:ORDERID" → step/job belonging to that execution run
 *
 * The folder entry's own order ID comes from its jobId field: "SERVER:ORDERID".
 * Steps carry their parent run's order ID in folderId: "SERVER:ORDERID".
 *
 * Phase-level counts are taken from the MOST RECENT run only.
 */
function buildReadinessPhase(allJobs) {
  if (!allJobs || allJobs.length === 0) return null

  // Separate folder entries (folderId = "SERVER:") from steps (folderId = "SERVER:ORDERID")
  const folderEntryJobs = allJobs.filter(j => folderRunIdFromFolderId(j.folderId ?? '') === '')
  const stepJobs        = allJobs.filter(j => folderRunIdFromFolderId(j.folderId ?? '') !== '')

  // Index folder entries by their own run order ID (from jobId: "SERVER:ORDERID")
  const folderByRunId = new Map()
  for (const f of folderEntryJobs) {
    const runId = extractOrderId(f.jobId)
    if (runId) folderByRunId.set(runId, f)
  }

  // Group steps by the run order ID they belong to (from folderId: "SERVER:ORDERID")
  const stepsByRunId = new Map()
  for (const j of stepJobs) {
    const runId = folderRunIdFromFolderId(j.folderId)
    if (!stepsByRunId.has(runId)) stepsByRunId.set(runId, [])
    stepsByRunId.get(runId).push(j)
  }

  // Collect all run IDs from both folder entries and step groups
  const allRunIds = new Set([...folderByRunId.keys(), ...stepsByRunId.keys()])

  const folderRuns = []
  for (const runId of allRunIds) {
    const folderEntry = folderByRunId.get(runId)
    const steps = (stepsByRunId.get(runId) || [])
      .map(buildStep)
      .sort((a, b) => (a.startTimeISO || '').localeCompare(b.startTimeISO || ''))

    const okCount   = steps.filter(s => s.status === 'Ended OK').length
    const failCount = steps.filter(s => s.status === 'Ended Not OK').length
    const running   = steps.some(s => s.status === 'Executing')

    // Prefer the folder entry's own status (it reflects overall run outcome in CTM)
    const runStatus = folderEntry?.status
      || (failCount > 0       ? 'Ended Not OK'
         : running            ? 'Executing'
         : okCount === steps.length && steps.length > 0 ? 'Ended OK'
         : 'Waiting')

    // Timing: prefer folder entry (it spans the whole run); fall back to step min/max
    const feStart = folderEntry?.startTime ? parseCtmTime(folderEntry.startTime)?.toISOString() : null
    const feEnd   = folderEntry?.endTime   ? parseCtmTime(folderEntry.endTime)?.toISOString()   : null
    const stepStarts = steps.map(s => s.startTimeISO).filter(Boolean).sort()
    const stepEnds   = steps.map(s => s.endTimeISO).filter(Boolean).sort()

    const startTimeISO = feStart || stepStarts[0]  || null
    const endTimeISO   = feEnd   || stepEnds.at(-1) || null

    // Folder name: prefer the folder entry's own name field
    const folderName = folderEntry?.name || folderEntry?.folder || steps[0]?.folder || runId

    folderRuns.push({
      runId,
      runNo:  0,      // assigned after sort
      folder: folderName,
      status: runStatus,
      startTimeISO,
      endTimeISO,
      steps,
      log: [],
    })
  }

  // Sort chronologically; oldest run = runNo 1
  folderRuns.sort((a, b) => (a.startTimeISO || '').localeCompare(b.startTimeISO || ''))
  folderRuns.forEach((r, i) => { r.runNo = i + 1 })

  // Phase-level stats from the LAST run only (not aggregate)
  const lastRun        = folderRuns.at(-1)
  const totalSteps     = lastRun?.steps.length                                              || 0
  const completedSteps = lastRun?.steps.filter(s => s.status === 'Ended OK').length        || 0
  const failedSteps    = lastRun?.steps.filter(s => s.status === 'Ended Not OK').length    || 0
  const runningSteps   = lastRun?.steps.filter(s => s.status === 'Executing').length       || 0
  const overallStatus  = lastRun?.status || 'Waiting'

  // Phase timing: from the latest folder entry (most recent execution)
  const latestFolderEntry = [...folderByRunId.values()]
    .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))[0]
  const phaseStart  = latestFolderEntry?.startTime ? parseCtmTime(latestFolderEntry.startTime) : null
  const phaseEnd    = latestFolderEntry?.endTime   ? parseCtmTime(latestFolderEntry.endTime)   : null
  const now         = new Date()
  const elapsedMins = phaseStart
    ? Math.max(0, Math.round(((phaseEnd || now).getTime() - phaseStart.getTime()) / 60_000))
    : 0

  return {
    jobId:         latestFolderEntry?.jobId  || '',
    folder:        latestFolderEntry?.name   || latestFolderEntry?.folder || '',
    status:        overallStatus,
    startTimeISO:  phaseStart ? phaseStart.toISOString() : null,
    endTimeISO:    phaseEnd   ? phaseEnd.toISOString()   : null,
    estEndISO:     null,
    hasSLA:        false,
    rtoTargetMins: null,
    elapsedMins,
    rtoPct:        null,
    rtoStatus:     'N/A',
    rtoBreached:   false,
    totalSteps,
    completedSteps,
    failedSteps,
    runningSteps,
    folderRuns,
    steps: lastRun?.steps || [],
  }
}

/**
 * BFS traversal: collect all executable leaf jobs + folder entries inside a CTM folder.
 *
 * CTM folder hierarchy can be many levels deep:
 *   DR Folder (subApplication=Switchover)
 *     └─ Sub-folder (e.g. mha-prod-webapp-sb)   ← folderEntry
 *          └─ Actual job                          ← leafJob
 *
 * Folder detection uses TWO criteria (either is sufficient):
 *   1. isExecutableJob() returns false (type-based)
 *   2. The entry has children in childrenByFolder (structural — catches entries
 *      with missing/unknown type that still parent other jobs)
 *
 * @param {Map<string, Array>} childrenByFolder
 * @param {string}             rootFolderName
 * @returns {{ leafJobs: Array, folderEntries: Array }}
 */
function collectLeafJobs(childrenByFolder, rootFolderName) {
  const leafJobs      = []
  const folderEntries = []
  const queue         = [rootFolderName]
  const visited       = new Set()

  while (queue.length > 0) {
    const name = queue.shift()
    if (visited.has(name)) continue
    visited.add(name)

    const children = childrenByFolder.get(name) || []
    for (const child of children) {
      const hasChildren = (childrenByFolder.get(child.name) || []).length > 0
      const isFolder    = !isExecutableJob(child) || hasChildren

      if (isFolder) {
        folderEntries.push(child)
        queue.push(child.name)
      } else {
        leafJobs.push(child)
      }
    }
  }

  return { leafJobs, folderEntries }
}

/**
 * @param {Array}  statuses   — raw CTM job status array
 * @param {object} slaConfig  — { switchover, switchback, failover, failback, perApp: {...} }
 */
function rawJobsToDROperations(statuses, slaConfig = {}) {
  // ── Step 1: Build a parent→children map for the entire status list ──
  // childrenByFolder: folderName → [raw job objects whose .folder === folderName]
  const childrenByFolder = new Map()
  for (const j of statuses) {
    const parent = j.folder || ''
    if (!childrenByFolder.has(parent)) childrenByFolder.set(parent, [])
    childrenByFolder.get(parent).push(j)
  }

  // ── Step 2: Find all TOP-LEVEL DR folder entries (have a DR subApplication) ──
  // These are the workflow containers for each phase.
  // A folder entry is identified by: type in FOLDER_TYPES OR name === folder (self-referencing)
  // OR it's a direct entry with subApplication set at the folder level.
  const drFolderEntries = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase()) && !isExecutableJob(j)
  )

  // Also include executable jobs that directly have a DR subApplication
  // (in case the DR job is a single job without a folder wrapper)
  const drDirectJobs = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase()) && isExecutableJob(j)
  )

  const byApp = {}

  // Process folder-based phases
  for (const folderEntry of drFolderEntries) {
    const app   = folderEntry.application || 'Unknown'
    const phase = (folderEntry.subApplication || '').toLowerCase()
    if (!byApp[app]) byApp[app] = { app, server: folderEntry.ctm, ...EMPTY_BY_PHASE() }

    const { leafJobs, folderEntries } = collectLeafJobs(childrenByFolder, folderEntry.name)

    if (phase === 'readiness') {
      // Readiness runs repeatedly — buildReadinessPhase groups by folderId.
      // Push the folder entry itself + ALL collected jobs (folder entries + leaf steps).
      // Do NOT filter here; folderId-based separation happens inside buildReadinessPhase.
      byApp[app].readiness.allJobs.push(folderEntry, ...folderEntries, ...leafJobs)
    } else {
      // Non-readiness phases: keep ONLY the most recent run's steps.
      const existing = byApp[app][phase].folder
      const isNewer  = !existing || (folderEntry.startTime || '') > (existing.startTime || '')
      if (isNewer) {
        byApp[app][phase].folder       = folderEntry
        byApp[app][phase].steps        = []   // discard older run's steps
        byApp[app][phase].folderEntries = []
      }
      // Only accumulate steps when this IS the currently-tracked (latest) entry
      if (byApp[app][phase].folder?.jobId === folderEntry.jobId) {
        byApp[app][phase].steps.push(...leafJobs)
        byApp[app][phase].folderEntries.push(...folderEntries)
      }
    }
  }

  // Process direct (non-folder) DR jobs — add as steps if not already collected
  for (const job of drDirectJobs) {
    const app   = job.application || 'Unknown'
    const phase = (job.subApplication || '').toLowerCase()
    if (!byApp[app]) byApp[app] = { app, server: job.ctm, ...EMPTY_BY_PHASE() }

    // Avoid duplicates (may already be captured as a leaf from a folder BFS)
    const alreadyHave = byApp[app][phase].steps.some((s) => s.jobId === job.jobId)
    if (!alreadyHave) byApp[app][phase].steps.push(job)
  }

  return Object.values(byApp).map((entry) => {
    // Resolve SLA per app + phase
    function getSLA(ph) {
      if (ph === 'readiness') return null
      const perApp = slaConfig.perApp?.[entry.app]
      if (perApp?.[ph] != null) return Number(perApp[ph])
      if (slaConfig[ph]  != null) return Number(slaConfig[ph])
      if (ph === 'switchover' || ph === 'failover')  return 30
      if (ph === 'switchback' || ph === 'failback')  return 60
      return 30
    }

    // Build a jobs array for each phase: [folderEntry?, ...leafSteps]
    // buildPhaseFromJobs expects the full list so it can separate folder vs steps
    function jobsForPhase(ph) {
      const { folder, steps } = entry[ph]
      if (!folder && steps.length === 0) return []
      return folder ? [folder, ...steps] : steps
    }

    function buildPhase(ph, sla) {
      const phase = buildPhaseFromJobs(jobsForPhase(ph), ph, sla)
      if (phase) phase.folderEntries = (entry[ph].folderEntries || []).map(buildStep)
      return phase
    }

    const phases = {
      switchover: buildPhase('switchover', getSLA('switchover')),
      switchback: buildPhase('switchback', getSLA('switchback')),
      // Readiness uses its own builder: groups by CTM order ID → one folderRun per execution
      readiness:  buildReadinessPhase(entry.readiness.allJobs),
      failover:   buildPhase('failover',   getSLA('failover')),
      failback:   buildPhase('failback',   getSLA('failback')),
    }

    const allPhases   = Object.values(phases).filter(Boolean)
    const totalPhases = allPhases.length
    const completedPh = allPhases.filter((p) => p.status === 'Ended OK').length
    const failedPh    = allPhases.filter((p) => p.status === 'Ended Not OK').length
    const executingPh = allPhases.filter((p) => p.status === 'Executing').length

    // Health only from SLA phases
    const slaPhases   = allPhases.filter((p) => p.hasSLA)
    const breachedPh  = slaPhases.filter((p) => p.rtoBreached).length
    const atRiskPh    = slaPhases.filter((p) => p.rtoStatus === 'At Risk').length

    const overallStatus =
      failedPh > 0                   ? 'Failed'
      : completedPh === totalPhases  ? 'Completed'
      : executingPh > 0              ? 'In Progress'
      : 'Pending'

    const drillHealth =
      failedPh > 0   ? 'Failed'
      : breachedPh > 0 ? 'Breached'
      : atRiskPh > 0   ? 'At Risk'
      : 'On Track'

    const completionPct =
      totalPhases > 0 ? Math.round((completedPh / totalPhases) * 100) : 0

    return {
      app:             entry.app,
      server:          entry.server,
      phases,
      totalPhases,
      completedPhases: completedPh,
      failedPhases:    failedPh,
      executingPhases: executingPh,
      breachedPhases:  breachedPh,
      overallStatus,
      drillHealth,
      completionPct,
    }
  })
}

/**
 * Fetch job statuses with a resilient retry for CTM SaaS 500s.
 *
 * CTM SaaS can throw a Java StringIndexOutOfBoundsException ("begin -6, end 0…")
 * when limit=5000 is combined with a server filter in certain API versions.
 *
 * Strategy (server filter is always kept — it is required):
 *   1. limit=5000 + server  — full preferred request
 *   2. no limit  + server   — drop limit only; CTM uses its own default page size
 *
 * 4xx errors propagate immediately (auth failure, endpoint not found, etc.).
 */
async function fetchJobStatuses(server, extraParams = {}) {
  const limit = cfg().jobsLimit || 5000
  const mkQuery = (l) => {
    const p = new URLSearchParams({ limit: String(l) })
    if (server?.trim()) p.append('server', server.trim())
    for (const [k, v] of Object.entries(extraParams)) p.append(k, v)
    return `?${p.toString()}`
  }
  const attempts = [
    () => ctmFetch(`/run/jobs/status${mkQuery(limit)}`),
    () => {
      // Retry without limit param on 5xx
      const p = new URLSearchParams()
      if (server?.trim()) p.append('server', server.trim())
      for (const [k, v] of Object.entries(extraParams)) p.append(k, v)
      return ctmFetch(`/run/jobs/status?${p.toString()}`)
    },
  ]

  let lastErr
  for (const attempt of attempts) {
    try {
      const data = await attempt()
      return data.statuses || []
    } catch (err) {
      lastErr = err
      if (!/CTM API 5\d\d/.test(err.message)) throw err
    }
  }
  throw lastErr
}

/**
 * Fetch readiness executions using the dedicated folder wildcard endpoint:
 *   /run/jobs/status?limit=5000&server=PROD&folder=*readiness*
 *
 * Returns raw statuses grouped by application into { [app]: raw[] }.
 * folderId="SERVER:"        → folder/container entry (one per execution)
 * folderId="SERVER:ORDERID" → step belonging to that execution run
 */
async function fetchReadinessStatuses(server) {
  return fetchJobStatuses(server, { folder: '*readiness*' })
}

/**
 * Merge readiness phases (from dedicated endpoint) into the existing operations array.
 * Updates or adds the readiness phase for each application found in readinessStatuses.
 */
function mergeReadinessIntoOps(ops, readinessStatuses) {
  // Group readiness statuses by application
  const byApp = new Map()
  for (const j of readinessStatuses) {
    const app = j.application || 'Unknown'
    if (!byApp.has(app)) byApp.set(app, [])
    byApp.get(app).push(j)
  }

  // Build updated ops — replace readiness phase with folderId-based version
  const updated = ops.map(op => {
    const jobs = byApp.get(op.app)
    if (!jobs) return op
    return {
      ...op,
      phases: {
        ...op.phases,
        readiness: buildReadinessPhase(jobs),
      },
    }
  })

  // Add apps that appear only in readiness (no DR operation in main fetch)
  for (const [app, jobs] of byApp) {
    if (!updated.find(op => op.app === app)) {
      const rdx = buildReadinessPhase(jobs)
      if (rdx) {
        updated.push({
          app,
          server:          jobs[0]?.ctm || '',
          phases:          { switchover: null, switchback: null, readiness: rdx, failover: null, failback: null },
          totalPhases:     1,
          completedPhases: rdx.status === 'Ended OK'     ? 1 : 0,
          failedPhases:    rdx.status === 'Ended Not OK' ? 1 : 0,
          executingPhases: rdx.status === 'Executing'    ? 1 : 0,
          breachedPhases:  0,
          overallStatus:   rdx.status === 'Ended OK' ? 'Completed' : rdx.status === 'Executing' ? 'In Progress' : 'In Progress',
          drillHealth:     'On Track',
          completionPct:   rdx.status === 'Ended OK' ? 100 : 0,
        })
      }
    }
  }

  return updated
}

/**
 * @param {object} slaConfig  — from useSettings().settings.sla
 * @param {string} [server]   — optional CTM server name filter (e.g. 'PROD', 'DR')
 */
export async function fetchDROperations(slaConfig = {}, server = DEFAULT_SERVER()) {
  if (USE_MOCK()) {
    return new Promise((r) => setTimeout(() => r(mockDROperations), 450))
  }

  // Fetch all jobs (switchover / switchback / failover / failback)
  // and readiness separately using the folder wildcard for precision
  const [allStatuses, readinessStatuses] = await Promise.all([
    fetchJobStatuses(server),
    fetchReadinessStatuses(server),
  ])

  // Build operations from main fetch (readiness may also be present here as fallback)
  const ops = rawJobsToDROperations(allStatuses, slaConfig)

  // Override readiness phases with the dedicated, folderId-precise version
  return mergeReadinessIntoOps(ops, readinessStatuses)
}

// ---------- General jobs ----------

function mapJob(raw) {
  return {
    id:        raw.jobId,
    name:      raw.name,
    folder:    raw.folder,
    server:    raw.ctm,
    status:    raw.status,
    held:      raw.held,
    cyclic:    raw.cyclic,
    type:      raw.type,
    host:      raw.host,
    app:       raw.application || '',
    subApp:    raw.subApplication || '',
    startTime: raw.startTime, //? parseCtmTime(raw.startTime)?.toISOString() : null,
    endTime:   raw.endTime,   // ? parseCtmTime(raw.endTime)?.toISOString()   : null,
    logURI:    raw.logURI,
  }
}

export async function fetchJobs(limit = 500, server = DEFAULT_SERVER()) {
  if (USE_MOCK()) {
    return new Promise((r) => setTimeout(() => r(mockJobs), 400))
  }
  const statuses = await fetchJobStatuses(server)
  return statuses.map(mapJob)
}

export async function fetchEnvComparison(jobs) {
  if (USE_MOCK()) {
    return new Promise((r) => setTimeout(() => r(mockEnvComparison), 450))
  }
  const active  = jobs.filter((j) => j.status === 'Executing').length
  const ok      = jobs.filter((j) => j.status === 'Ended OK').length
  const failed  = jobs.filter((j) => j.status === 'Ended Not OK').length
  const server  = jobs[0]?.server || 'IN01'
  return {
    prod: { ...mockEnvComparison.prod, label: 'Production (reference)' },
    dr: {
      label:           'Live — Control-M SaaS',
      servers:         [server],
      status:          'Active',
      activeJobs:      active,
      completedJobs:   ok,
      failedJobs:      failed,
      waitingJobs:     0,
      agentsConnected: 9,
      agentsTotal:     10,
      lastSync:        new Date().toISOString(),
      version:         '9.21.x (SaaS)',
      uptime:          'Managed SaaS',
      avgJobDuration:  '—',
      slaCompliance:   jobs.length > 0 ? +((ok / jobs.length) * 100).toFixed(1) : 0,
    },
  }
}

export async function fetchAgents() {
  return new Promise((r) => setTimeout(() => r(mockAgents), 420))
}

/**
 * Fetch the output log for a specific job.
 * CTM endpoint: GET /run/job/{jobId}/output  (returns plain text)
 */
export async function fetchJobOutput(jobId) {
  if (!jobId) throw new Error('jobId is required')
  const res = await fetch(`${BASE_URL()}/run/job/${encodeURIComponent(jobId)}/output`, {
    headers: { 'x-api-key': _apiKey },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || 'No output available'}`)
  }
  // CTM returns plain text for this endpoint
  return res.text()
}
