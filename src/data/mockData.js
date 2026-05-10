// Mock data simulating Control-M Automation API responses

const now  = Date.now()
const ago  = (mins) => new Date(now - mins * 60_000).toISOString()
const from = (mins) => new Date(now + mins * 60_000).toISOString()

function phase(overrides) {
  return {
    jobId: null, name: null, folder: null, status: 'Executing', held: false,
    startTimeISO: null, endTimeISO: null, estEndISO: null,
    hasSLA: true,
    rtoTargetMins: 30, elapsedMins: 12, rtoPct: 40,
    rtoStatus: 'On Track', rtoBreached: false, logURI: null,
    totalSteps: 0, completedSteps: 0, failedSteps: 0,
    folderRuns: [],   // Array of { runId, runNo, folder, status, startTimeISO, endTimeISO, steps[], log[] }
    ...overrides,
  }
}

// ─── Folder run builder ───────────────────────────────────────────────────────
function folderRun(overrides) {
  return {
    runId: null, runNo: 1, folder: null,
    status: 'Ended OK',
    startTimeISO: null, endTimeISO: null,
    steps: [],
    log: [],
    ...overrides,
  }
}

function step(overrides) {
  return {
    jobId: null, name: null,
    status: 'Ended OK',
    startTimeISO: null, endTimeISO: null,
    duration: null,
    log: [],
    ...overrides,
  }
}

function logLine(time, level, msg) { return { time, level, msg } }

// ─── Run history entry (past completed run summaries) ────────────────────────
function runHist(overrides) {
  return { runNo: 1, runId: null, runDate: null, status: 'Ended OK', durationMins: 20, totalSteps: 0, completedSteps: 0, failedSteps: 0, ...overrides }
}

const cortexRunHistory = [
  runHist({ runNo:1, runId:'CTX-RH-01', runDate: ago(21*24*60), status:'Ended OK',     durationMins:14, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:2, runId:'CTX-RH-02', runDate: ago(14*24*60), status:'Ended OK',     durationMins:18, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:3, runId:'CTX-RH-03', runDate: ago(7*24*60),  status:'Ended Not OK', durationMins:22, totalSteps:7, completedSteps:6, failedSteps:1 }),
  runHist({ runNo:4, runId:'CTX-RH-04', runDate: ago(1*24*60),  status:'Ended OK',     durationMins:16, totalSteps:7, completedSteps:7, failedSteps:0 }),
]

const murexRunHistory = [
  runHist({ runNo:1, runId:'MRX-RH-01', runDate: ago(21*24*60), status:'Ended OK',     durationMins:12, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:2, runId:'MRX-RH-02', runDate: ago(14*24*60), status:'Ended Not OK', durationMins:18, totalSteps:7, completedSteps:5, failedSteps:2 }),
  runHist({ runNo:3, runId:'MRX-RH-03', runDate: ago(7*24*60),  status:'Ended OK',     durationMins:15, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:4, runId:'MRX-RH-04', runDate: ago(1*24*60),  status:'Ended Not OK', durationMins:20, totalSteps:7, completedSteps:5, failedSteps:2 }),
]

const t24RunHistory = [
  runHist({ runNo:1, runId:'T24-RH-01', runDate: ago(28*24*60), status:'Ended OK', durationMins:22, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:2, runId:'T24-RH-02', runDate: ago(21*24*60), status:'Ended OK', durationMins:20, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:3, runId:'T24-RH-03', runDate: ago(14*24*60), status:'Ended OK', durationMins:19, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:4, runId:'T24-RH-04', runDate: ago(7*24*60),  status:'Ended OK', durationMins:21, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:5, runId:'T24-RH-05', runDate: ago(1*24*60),  status:'Ended OK', durationMins:20, totalSteps:7, completedSteps:7, failedSteps:0 }),
]

const calypsoRunHistory = [
  runHist({ runNo:1, runId:'CAL-RH-01', runDate: ago(28*24*60), status:'Ended OK',     durationMins:32, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:2, runId:'CAL-RH-02', runDate: ago(21*24*60), status:'Ended OK',     durationMins:35, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:3, runId:'CAL-RH-03', runDate: ago(14*24*60), status:'Ended Not OK', durationMins:38, totalSteps:7, completedSteps:6, failedSteps:1 }),
  runHist({ runNo:4, runId:'CAL-RH-04', runDate: ago(7*24*60),  status:'Ended Not OK', durationMins:31, totalSteps:7, completedSteps:6, failedSteps:1 }),
]

const kondorRunHistory = [
  runHist({ runNo:1, runId:'KND-RH-01', runDate: ago(21*24*60), status:'Ended OK', durationMins:10, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:2, runId:'KND-RH-02', runDate: ago(14*24*60), status:'Ended OK', durationMins:9,  totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:3, runId:'KND-RH-03', runDate: ago(7*24*60),  status:'Ended OK', durationMins:8,  totalSteps:7, completedSteps:7, failedSteps:0 }),
]

const datahubRunHistory = [
  runHist({ runNo:1, runId:'DHB-RH-01', runDate: ago(21*24*60), status:'Ended Not OK', durationMins:12, totalSteps:7, completedSteps:6, failedSteps:1 }),
  runHist({ runNo:2, runId:'DHB-RH-02', runDate: ago(14*24*60), status:'Ended OK',     durationMins:10, totalSteps:7, completedSteps:7, failedSteps:0 }),
  runHist({ runNo:3, runId:'DHB-RH-03', runDate: ago(7*24*60),  status:'Ended Not OK', durationMins:14, totalSteps:7, completedSteps:6, failedSteps:1 }),
]

// Real CTM readiness step names (same set for every application)
const READINESS_STEPS = [
  'mha-drm-approval',
  'mha-tssa-certificate-validity',
  'mha-tssa-os-version',
  'mha-tssa-port-config-file-check',
  'mha-tssa-port-java-runtime',
  'mha-tssa-port-reachability',
  'mha-tssa-service-status',
]

// Build steps for a run, spacing start times evenly within a window
function mkSteps(runId, baseAgo, windowMins) {
  const names    = READINESS_STEPS
  const interval = windowMins / names.length
  return names.map((name, i) => {
    const s = baseAgo + i * interval
    const e = s + interval * 0.85
    const mins = Math.floor(interval * 0.85 / 60)
    const secs = String(Math.round((interval * 0.85) % 60)).padStart(2, '0')
    return step({
      jobId: `${runId}-${String(i + 1).padStart(5, '0')}`,
      name,
      status: 'Ended OK',
      startTimeISO: ago(s), endTimeISO: ago(e),
      duration: `00:0${mins}:${secs}`,
      log: [logLine(ago(s), 'INFO', `${name} started`), logLine(ago(e), 'SUCCESS', `${name} completed OK`)],
    })
  })
}

// ─── Cortex — 3 runs × 7 steps ───────────────────────────────────────────────
const cortexFolderRuns = [
  folderRun({ runId:'0ie7m', runNo:1, folder:'mha-cortex-readiness', status:'Ended OK', startTimeISO:ago(90), endTimeISO:ago(78),
    steps: mkSteps('0ie7m', 90, 12),
    log:[logLine(ago(90),'INFO','Run 0ie7m started'), logLine(ago(78),'SUCCESS','Run 0ie7m completed OK')] }),
  folderRun({ runId:'0ie95', runNo:2, folder:'mha-cortex-readiness', status:'Ended OK', startTimeISO:ago(55), endTimeISO:ago(43),
    steps: mkSteps('0ie95', 55, 12),
    log:[logLine(ago(55),'INFO','Run 0ie95 started'), logLine(ago(43),'SUCCESS','Run 0ie95 completed OK')] }),
  folderRun({ runId:'0ie9g', runNo:3, folder:'mha-cortex-readiness', status:'Ended OK', startTimeISO:ago(20), endTimeISO:ago(8),
    steps: mkSteps('0ie9g', 20, 12),
    log:[logLine(ago(20),'INFO','Run 0ie9g started'), logLine(ago(8),'SUCCESS','Run 0ie9g completed OK')] }),
]

// ─── Murex — 3 runs × 7 steps ────────────────────────────────────────────────
const murexFolderRuns = [
  folderRun({ runId:'0if2a', runNo:1, folder:'mha-murex-readiness', status:'Ended OK', startTimeISO:ago(120), endTimeISO:ago(108),
    steps: mkSteps('0if2a', 120, 12),
    log:[logLine(ago(120),'INFO','Run 0if2a started'), logLine(ago(108),'SUCCESS','Run 0if2a completed OK')] }),
  folderRun({ runId:'0if3c', runNo:2, folder:'mha-murex-readiness', status:'Ended OK', startTimeISO:ago(70), endTimeISO:ago(58),
    steps: mkSteps('0if3c', 70, 12),
    log:[logLine(ago(70),'INFO','Run 0if3c started'), logLine(ago(58),'SUCCESS','Run 0if3c completed OK')] }),
  folderRun({ runId:'0if4d', runNo:3, folder:'mha-murex-readiness', status:'Ended OK', startTimeISO:ago(25), endTimeISO:ago(13),
    steps: mkSteps('0if4d', 25, 12),
    log:[logLine(ago(25),'INFO','Run 0if4d started'), logLine(ago(13),'SUCCESS','Run 0if4d completed OK')] }),
]

// ─── T24 — 3 runs × 7 steps ──────────────────────────────────────────────────
const t24FolderRuns = [
  folderRun({ runId:'0ig1a', runNo:1, folder:'mha-t24-readiness', status:'Ended OK', startTimeISO:ago(180), endTimeISO:ago(168),
    steps: mkSteps('0ig1a', 180, 12),
    log:[logLine(ago(180),'INFO','Run 0ig1a started'), logLine(ago(168),'SUCCESS','Run 0ig1a completed OK')] }),
  folderRun({ runId:'0ig2b', runNo:2, folder:'mha-t24-readiness', status:'Ended OK', startTimeISO:ago(90), endTimeISO:ago(78),
    steps: mkSteps('0ig2b', 90, 12),
    log:[logLine(ago(90),'INFO','Run 0ig2b started'), logLine(ago(78),'SUCCESS','Run 0ig2b completed OK')] }),
  folderRun({ runId:'0ig3c', runNo:3, folder:'mha-t24-readiness', status:'Ended OK', startTimeISO:ago(25), endTimeISO:ago(13),
    steps: mkSteps('0ig3c', 25, 12),
    log:[logLine(ago(25),'INFO','Run 0ig3c started'), logLine(ago(13),'SUCCESS','Run 0ig3c completed OK')] }),
]

// ─── Calypso — 3 runs × 7 steps ──────────────────────────────────────────────
const calypsoFolderRuns = [
  folderRun({ runId:'0ih1x', runNo:1, folder:'mha-calypso-readiness', status:'Ended OK', startTimeISO:ago(200), endTimeISO:ago(188),
    steps: mkSteps('0ih1x', 200, 12),
    log:[logLine(ago(200),'INFO','Run 0ih1x started'), logLine(ago(188),'SUCCESS','Run 0ih1x completed OK')] }),
  folderRun({ runId:'0ih2y', runNo:2, folder:'mha-calypso-readiness', status:'Ended OK', startTimeISO:ago(90), endTimeISO:ago(78),
    steps: mkSteps('0ih2y', 90, 12),
    log:[logLine(ago(90),'INFO','Run 0ih2y started'), logLine(ago(78),'SUCCESS','Run 0ih2y completed OK')] }),
  folderRun({ runId:'0ih3z', runNo:3, folder:'mha-calypso-readiness', status:'Ended OK', startTimeISO:ago(35), endTimeISO:ago(23),
    steps: mkSteps('0ih3z', 35, 12),
    log:[logLine(ago(35),'INFO','Run 0ih3z started'), logLine(ago(23),'SUCCESS','Run 0ih3z completed OK')] }),
]

// ─── Kondor — 3 runs × 7 steps ───────────────────────────────────────────────
const kondorFolderRuns = [
  folderRun({ runId:'0ij1k', runNo:1, folder:'mha-kondor-readiness', status:'Ended OK', startTimeISO:ago(120), endTimeISO:ago(108),
    steps: mkSteps('0ij1k', 120, 12),
    log:[logLine(ago(120),'INFO','Run 0ij1k started'), logLine(ago(108),'SUCCESS','Run 0ij1k completed OK')] }),
  folderRun({ runId:'0ij2l', runNo:2, folder:'mha-kondor-readiness', status:'Ended OK', startTimeISO:ago(60), endTimeISO:ago(48),
    steps: mkSteps('0ij2l', 60, 12),
    log:[logLine(ago(60),'INFO','Run 0ij2l started'), logLine(ago(48),'SUCCESS','Run 0ij2l completed OK')] }),
  folderRun({ runId:'0ij3m', runNo:3, folder:'mha-kondor-readiness', status:'Ended OK', startTimeISO:ago(12), endTimeISO:ago(4),
    steps: mkSteps('0ij3m', 12, 8),
    log:[logLine(ago(12),'INFO','Run 0ij3m started'), logLine(ago(4),'SUCCESS','Run 0ij3m completed OK')] }),
]

// ─── DataHub — 3 runs × 7 steps ──────────────────────────────────────────────
const datahubFolderRuns = [
  folderRun({ runId:'0ik2m', runNo:1, folder:'mha-datahub-readiness', status:'Ended OK', startTimeISO:ago(180), endTimeISO:ago(168),
    steps: mkSteps('0ik2m', 180, 12),
    log:[logLine(ago(180),'INFO','Run 0ik2m started'), logLine(ago(168),'SUCCESS','Run 0ik2m completed OK')] }),
  folderRun({ runId:'0ik3n', runNo:2, folder:'mha-datahub-readiness', status:'Ended OK', startTimeISO:ago(90), endTimeISO:ago(78),
    steps: mkSteps('0ik3n', 90, 12),
    log:[logLine(ago(90),'INFO','Run 0ik3n started'), logLine(ago(78),'SUCCESS','Run 0ik3n completed OK')] }),
  folderRun({ runId:'0ik4o', runNo:3, folder:'mha-datahub-readiness', status:'Ended OK', startTimeISO:ago(20), endTimeISO:ago(8),
    steps: mkSteps('0ik4o', 20, 12),
    log:[logLine(ago(20),'INFO','Run 0ik4o started'), logLine(ago(8),'SUCCESS','Run 0ik4o completed OK')] }),
]

// ─── Helper to compute step counts from folderRuns ───────────────────────────
function rdxCounts(folderRuns) {
  const total    = folderRuns.reduce((s, r) => s + r.steps.length, 0)
  const completed = folderRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'Ended OK').length, 0)
  const failed   = folderRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'Ended Not OK' || st.status === 'Aborted').length, 0)
  const overall  = folderRuns.every(r => r.status === 'Ended OK') ? 'Ended OK'
                 : folderRuns.some(r => r.status === 'Ended Not OK') ? 'Ended Not OK'
                 : folderRuns.some(r => r.status === 'Executing') ? 'Executing' : 'Waiting'
  return { totalSteps: total, completedSteps: completed, failedSteps: failed, status: overall }
}

export const mockDROperations = [
  {
    app: 'Cortex', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 0,
    phases: {
      switchover: phase({ jobId: 'IN01:14fed', name: 'mha-DRM-CORTEX-MASTER-SWITCHOVER', folder: 'mha-DRM-CORTEX-MASTER-SWITCHOVER', status: 'Executing', startTimeISO: ago(7), estEndISO: from(3), rtoTargetMins: 10, elapsedMins: 7, rtoPct: 70, rtoStatus: 'At Risk' }),
      switchback: null,
      readiness: phase({ hasSLA: false, jobId: 'IN01:14ff5', name: 'mha_DRM_CORTEX_READINESS', folder: 'mha-cortex-readiness', startTimeISO: ago(90), endTimeISO: ago(8), rtoTargetMins: 52, elapsedMins: 82, rtoPct: 100, rtoStatus: 'Met', ...rdxCounts(cortexFolderRuns), folderRuns: cortexFolderRuns, runHistory: cortexRunHistory }),
    },
  },
  {
    app: 'Murex', server: 'IN01',
    totalPhases: 3, completedPhases: 0, failedPhases: 0, executingPhases: 3, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 0,
    phases: {
      switchover: phase({ jobId: 'IN01:14fct', name: 'mha-DRM-MUREX-MASTER-SWITCHOVER', folder: 'mha-DRM-MUREX-MASTER-SWITCHOVER', status: 'Executing', startTimeISO: ago(13), estEndISO: from(3), rtoTargetMins: 16, elapsedMins: 13, rtoPct: 81, rtoStatus: 'At Risk' }),
      switchback: phase({ jobId: 'IN01:14fdl', name: 'mha-DRM-MUREX-MASTER-SWITCHBACK', folder: 'mha-DRM-MUREX-MASTER-SWITCHBACK', status: 'Executing', startTimeISO: ago(9), estEndISO: from(47), rtoTargetMins: 56, elapsedMins: 9, rtoPct: 16, rtoStatus: 'On Track' }),
      readiness: phase({ hasSLA: false, jobId: 'IN01:14ffx', name: 'mha_DRM_MUREX_READINESS', folder: 'mha-murex-readiness', startTimeISO: ago(5), endTimeISO: ago(0), rtoTargetMins: 51, elapsedMins: 5, rtoPct: 10, rtoStatus: 'On Track', ...rdxCounts(murexFolderRuns), folderRuns: murexFolderRuns, runHistory: murexRunHistory }),
    },
  },
  {
    app: 'T24', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: phase({ jobId: 'IN01:1500a', name: 'mha-DRM-T24-MASTER-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(40), endTimeISO: ago(22), rtoTargetMins: 30, elapsedMins: 18, rtoPct: 60, rtoStatus: 'On Track' }),
      switchback: null,
      readiness: phase({ hasSLA: false, jobId: 'IN01:1500b', name: 'mha_DRM_T24_READINESS', folder: 'mha-t24-readiness', startTimeISO: ago(25), endTimeISO: ago(5), rtoTargetMins: 60, elapsedMins: 20, rtoPct: 33, rtoStatus: 'On Track', ...rdxCounts(t24FolderRuns), folderRuns: t24FolderRuns, runHistory: t24RunHistory }),
    },
  },
  {
    app: 'Calypso', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 1, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 71,
    phases: {
      switchover: phase({ jobId: 'IN01:1501a', name: 'mha-DRM-CALYPSO-MASTER-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(45), endTimeISO: ago(20), rtoTargetMins: 25, elapsedMins: 25, rtoPct: 100, rtoStatus: 'Met' }),
      switchback: null,
      readiness: phase({ hasSLA: false, jobId: 'IN01:1501b', name: 'mha_DRM_CALYPSO_READINESS', folder: 'mha-calypso-readiness', startTimeISO: ago(35), endTimeISO: ago(4), rtoTargetMins: 45, elapsedMins: 31, rtoPct: 69, rtoStatus: 'On Track', ...rdxCounts(calypsoFolderRuns), folderRuns: calypsoFolderRuns, runHistory: calypsoRunHistory }),
    },
  },
  {
    app: 'Kondor', server: 'IN01',
    totalPhases: 1, completedPhases: 1, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: phase({ jobId: 'IN01:1502a', name: 'mha-DRM-KONDOR-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(20), endTimeISO: ago(10), rtoTargetMins: 15, elapsedMins: 10, rtoPct: 67, rtoStatus: 'On Track' }),
      switchback: null,
      readiness: phase({ hasSLA: false, jobId: 'IN01:1502b', name: 'mha_DRM_KONDOR_READINESS', folder: 'mha-kondor-readiness', startTimeISO: ago(12), endTimeISO: ago(4), rtoTargetMins: 20, elapsedMins: 8, rtoPct: 40, rtoStatus: 'On Track', ...rdxCounts(kondorFolderRuns), folderRuns: kondorFolderRuns, runHistory: kondorRunHistory }),
    },
  },
  {
    app: 'DataHub', server: 'IN01',
    totalPhases: 1, completedPhases: 0, failedPhases: 1, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 67,
    phases: {
      switchover: null,
      switchback: null,
      readiness: phase({ hasSLA: false, jobId: 'IN01:1503b', name: 'mha_DRM_DATAHUB_READINESS', folder: 'mha-datahub-readiness', startTimeISO: ago(10), endTimeISO: ago(2), rtoTargetMins: 30, elapsedMins: 8, rtoPct: 27, rtoStatus: 'On Track', ...rdxCounts(datahubFolderRuns), folderRuns: datahubFolderRuns, runHistory: datahubRunHistory }),
    },
  },
]

export const mockDrills = [
  { id: 'DRILL-2026-001', name: 'Q1 2026 Full DR Drill',              status: 'Completed',  progress: 100, scheduledDate: '2026-01-15T06:00:00Z', startTime: '2026-01-15T06:02:14Z', endTime: '2026-01-15T14:38:52Z', totalJobs: 248, completedJobs: 245, failedJobs: 3,  skippedJobs: 0, datacenter: 'DR-AZ-EAST', severity: 'Full Failover',    rto: '4h 22m',    rpo: '15 min', owner: 'ops-team@company.com' },
  { id: 'DRILL-2026-002', name: 'Q2 2026 DR Drill — Batch & Finance', status: 'In Progress',progress: 67,  scheduledDate: '2026-04-09T05:00:00Z', startTime: '2026-04-09T05:01:44Z', endTime: null,                   totalJobs: 312, completedJobs: 209, failedJobs: 7,  skippedJobs: 2, datacenter: 'DR-AZ-EAST', severity: 'Full Failover',    rto: 'In progress',rpo: '10 min', owner: 'dr-team@company.com'  },
  { id: 'DRILL-2026-003', name: 'Application Failover Test — MFT',    status: 'Scheduled',  progress: 0,   scheduledDate: '2026-04-22T03:00:00Z', startTime: null,                   endTime: null,                   totalJobs: 88,  completedJobs: 0,   failedJobs: 0,  skippedJobs: 0, datacenter: 'DR-AZ-WEST', severity: 'Partial Failover', rto: 'Target: 2h', rpo: '30 min', owner: 'mft-team@company.com' },
  { id: 'DRILL-2026-004', name: 'Database DR Validation — Core Banking',status:'Scheduled',  progress: 0,   scheduledDate: '2026-05-06T02:00:00Z', startTime: null,                   endTime: null,                   totalJobs: 156, completedJobs: 0,   failedJobs: 0,  skippedJobs: 0, datacenter: 'DR-AZ-WEST', severity: 'Data Validation',  rto: 'Target: 3h', rpo: '5 min',  owner: 'dba-team@company.com' },
]

export const mockJobs = [
  { id: 'J001', name: 'BATCH-EOD-FINCLOSE', folder: 'FINANCE_EOD', server: 'CTM-DR-01', status: 'Executing',    startTime: '2026-04-09T12:10:00Z', duration: '00:42:18', cyclic: false, host: 'drapp01.dc.local' },
  { id: 'J002', name: 'BATCH-GL-RECON',     folder: 'FINANCE_EOD', server: 'CTM-DR-01', status: 'Executing',    startTime: '2026-04-09T11:58:00Z', duration: '00:54:22', cyclic: false, host: 'drapp01.dc.local' },
  { id: 'J003', name: 'MFT-SFTP-UPLOAD',    folder: 'MFT_XFER',    server: 'CTM-DR-02', status: 'Ended OK',     startTime: '2026-04-09T11:30:00Z', duration: '00:03:11', cyclic: true,  host: 'drmft01.dc.local' },
  { id: 'J004', name: 'RPT-DAILY-SUMMARY',  folder: 'REPORTS',     server: 'CTM-DR-01', status: 'Ended OK',     startTime: '2026-04-09T10:00:00Z', duration: '00:08:47', cyclic: false, host: 'drapp02.dc.local' },
  { id: 'J005', name: 'DB-BACKUP-CORE',     folder: 'DB_MAINT',    server: 'CTM-DR-02', status: 'Ended Not Ok', startTime: '2026-04-09T09:45:00Z', duration: '00:12:03', cyclic: false, host: 'drdb01.dc.local'  },
  { id: 'J006', name: 'ETL-CUSTOMER-SYNC',  folder: 'ETL_JOBS',    server: 'CTM-DR-02', status: 'Ended Not OK', startTime: '2026-04-09T09:20:00Z', duration: '00:05:39', cyclic: false, host: 'drdb02.dc.local'  },
  { id: 'J007', name: 'BATCH-PAYROLL-CALC', folder: 'HR_BATCH',    server: 'CTM-DR-01', status: 'Waiting',      startTime: null,                   duration: null,       cyclic: false, host: 'drapp03.dc.local' },
  { id: 'J008', name: 'API-HEALTH-CHECK',   folder: 'MONITORING',  server: 'CTM-DR-02', status: 'Executing',    startTime: '2026-04-09T12:48:00Z', duration: '00:05:01', cyclic: true,  host: 'drmon01.dc.local' },
  { id: 'J009', name: 'ARCH-LOG-CLEANUP',   folder: 'MAINTENANCE', server: 'CTM-DR-01', status: 'Ended OK',     startTime: '2026-04-09T08:00:00Z', duration: '00:01:52', cyclic: true,  host: 'drapp01.dc.local' },
  { id: 'J010', name: 'RPT-RISK-INTRADAY',  folder: 'REPORTS',     server: 'CTM-DR-01', status: 'Hold',         startTime: null,                   duration: null,       cyclic: false, host: 'drapp02.dc.local' },
]

export const mockEnvComparison = {
  prod: { label: 'Production', servers: ['CTM-PROD-01','CTM-PROD-02'], status: 'Active', activeJobs: 0, completedJobs: 1847, failedJobs: 4, waitingJobs: 12, agentsConnected: 42, agentsTotal: 44, lastSync: '2026-04-09T12:52:00Z', version: '9.21.300', uptime: '127d 14h 22m', avgJobDuration: '00:08:34', slaCompliance: 99.2 },
  dr:   { label: 'Disaster Recovery', servers: ['CTM-DR-01','CTM-DR-02'], status: 'Active — Drill', activeJobs: 4, completedJobs: 209, failedJobs: 7, waitingJobs: 3, agentsConnected: 9, agentsTotal: 10, lastSync: '2026-04-09T12:51:00Z', version: '9.21.300', uptime: '0d 7h 50m', avgJobDuration: '00:09:12', slaCompliance: 97.8 },
}

export const mockAgents = [
  { id: 'A01', name: 'zzz-linux-agent-02', host: 'zzz-linux-agent-02',                    env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:30Z', platform: 'Linux',   version: '9.21.x', activeJobs: 63 },
  { id: 'A02', name: 'ctm-server',          host: 'ctm-server',                            env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:28Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
  { id: 'A03', name: 'ctmawsdemosaas-sap',  host: 'ctmawsdemosaaspreprod-sap.vse.bmc.com', env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:27Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
  { id: 'A04', name: 'zzz-eks-preprod-0',   host: 'zzz-eks-preprod-0.bmci2t.com',          env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:31Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
  { id: 'A05', name: 'in-npottapu-w4',      host: 'in-npottapu-w4-in-npottapu-w4_1',       env: 'DR', datacenter: 'IN01 / SaaS', status: 'Warning',      lastPing: '2026-04-09T12:49:10Z', platform: 'Windows', version: '9.21.x', activeJobs: 0  },
  { id: 'A06', name: 'in-npottapu-default', host: 'in-npottapu-w4-default',                env: 'DR', datacenter: 'IN01 / SaaS', status: 'Warning',      lastPing: '2026-04-09T12:47:55Z', platform: 'Windows', version: '9.21.x', activeJobs: 0  },
  { id: 'A07', name: 'zzz-linux-agent-01',  host: 'zzz-linux-agent-01',                    env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:29Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
  { id: 'A08', name: 'lhq7-linux-agent-01', host: 'lhq7-linux-agent-01',                   env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:30Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
  { id: 'A09', name: 'em-frnunez-w3',       host: 'em-frnunez-w3-frnunez',                 env: 'DR', datacenter: 'IN01 / SaaS', status: 'Connected',    lastPing: '2026-04-09T12:52:32Z', platform: 'Windows', version: '9.21.x', activeJobs: 0  },
  { id: 'A10', name: 'N/A (unresolved)',     host: '(host not resolved)',                   env: 'DR', datacenter: 'IN01 / SaaS', status: 'Disconnected', lastPing: '2026-04-09T11:10:14Z', platform: 'Linux',   version: '9.21.x', activeJobs: 0  },
]

export const mockAppMeta = {
  'Cortex':  { criticality: 'High',     team: 'Cortex Ops',    applicationType: 'Customer-Facing', serviceImpact: 'Customer Operations', owner: 'cortex-ops@company.com',  rpo: '1 hr'    },
  'Murex':   { criticality: 'Critical', team: 'Trading Ops',   applicationType: 'Trading',         serviceImpact: 'Revenue Critical',    owner: 'trading-dr@company.com',  rpo: '15 min'  },
  'T24':     { criticality: 'Critical', team: 'Core Banking',  applicationType: 'Banking',         serviceImpact: 'Full Outage',         owner: 'cbs-ops@company.com',     rpo: '5 min'   },
  'Calypso': { criticality: 'Critical', team: 'Derivatives IT',applicationType: 'Trading',         serviceImpact: 'Derivatives Trading', owner: 'calypso-dr@company.com',  rpo: '15 min'  },
  'Kondor':  { criticality: 'Medium',   team: 'Treasury IT',   applicationType: 'Treasury',        serviceImpact: 'Treasury Operations', owner: 'kondor-it@company.com',   rpo: '30 min'  },
  'DataHub': { criticality: 'Low',      team: 'BI Team',       applicationType: 'Analytics',       serviceImpact: 'Reporting Degraded',  owner: 'bi-team@company.com',     rpo: '4 hr'    },
}
