// Mock data — 50 applications across all DR phases

const now  = Date.now()
const ago  = (mins) => new Date(now - mins * 60_000).toISOString()
const from = (mins) => new Date(now + mins * 60_000).toISOString()

// ── Primitive builders ────────────────────────────────────────────────────────

function phase(overrides) {
  return {
    jobId: null, name: null, folder: null, status: 'Executing', held: false,
    startTimeISO: null, endTimeISO: null, estEndISO: null,
    hasSLA: true,
    rtoTargetMins: 30, elapsedMins: 12, rtoPct: 40,
    rtoStatus: 'On Track', rtoBreached: false, logURI: null,
    totalSteps: 0, completedSteps: 0, failedSteps: 0,
    folderRuns: [],
    ...overrides,
  }
}

function folderRun(overrides) {
  return {
    runId: null, runNo: 1, folder: null,
    status: 'Ended OK',
    startTimeISO: null, endTimeISO: null,
    steps: [], log: [],
    ...overrides,
  }
}

function step(overrides) {
  return {
    jobId: null, name: null,
    status: 'Ended OK',
    startTimeISO: null, endTimeISO: null,
    duration: null, log: [],
    ...overrides,
  }
}

function logLine(time, level, msg) { return { time, level, msg } }

function runHist(overrides) {
  return { runNo: 1, runId: null, runDate: null, status: 'Ended OK', durationMins: 20, totalSteps: 7, completedSteps: 7, failedSteps: 0, ...overrides }
}

// ── Step generators ───────────────────────────────────────────────────────────

const READINESS_STEPS = [
  'mha-drm-approval',
  'mha-tssa-certificate-validity',
  'mha-tssa-os-version',
  'mha-tssa-port-config-file-check',
  'mha-tssa-port-java-runtime',
  'mha-tssa-port-reachability',
  'mha-tssa-service-status',
]

function mkSteps(runId, baseAgo, windowMins, failAt = []) {
  const interval = windowMins / READINESS_STEPS.length
  return READINESS_STEPS.map((name, i) => {
    const s       = baseAgo + i * interval
    const e       = s + interval * 0.85
    const failed  = failAt.includes(i)
    const status  = failed ? 'Ended Not OK' : 'Ended OK'
    const mins    = Math.floor(interval * 0.85 / 60)
    const secs    = String(Math.round((interval * 0.85) % 60)).padStart(2, '0')
    return step({
      jobId: `${runId}-${String(i + 1).padStart(5, '0')}`,
      name,
      status,
      startTimeISO: ago(s), endTimeISO: ago(e),
      duration: `00:0${mins}:${secs}`,
      log: [
        logLine(ago(s), 'INFO',    `${name} started`),
        logLine(ago(e), failed ? 'ERROR' : 'SUCCESS',
          failed ? `${name} FAILED — check connectivity` : `${name} completed OK`),
      ],
    })
  })
}

function mkFolderRun(runId, runNo, folder, baseAgo, windowMins, failAt = []) {
  const steps  = mkSteps(runId, baseAgo, windowMins, failAt)
  const hasFail = steps.some(s => s.status !== 'Ended OK')
  const status  = hasFail ? 'Ended Not OK' : 'Ended OK'
  return folderRun({
    runId, runNo, folder, status,
    startTimeISO: ago(baseAgo),
    endTimeISO:   ago(baseAgo - windowMins),
    steps,
    log: [
      logLine(ago(baseAgo),              'INFO',  `Run ${runId} started`),
      logLine(ago(baseAgo - windowMins), hasFail ? 'ERROR' : 'SUCCESS',
        hasFail ? `Run ${runId} completed with errors` : `Run ${runId} completed OK`),
    ],
  })
}

function rdxCounts(folderRuns) {
  const total     = folderRuns.reduce((s, r) => s + r.steps.length, 0)
  const completed = folderRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'Ended OK').length, 0)
  const failed    = folderRuns.reduce((s, r) => s + r.steps.filter(st => st.status !== 'Ended OK').length, 0)
  const hasOK     = folderRuns.some(r => r.status === 'Ended OK')
  const hasFail   = folderRuns.some(r => r.status === 'Ended Not OK')
  const hasExec   = folderRuns.some(r => r.status === 'Executing')
  const overall   = hasExec ? 'Executing' : hasFail ? 'Ended Not OK' : hasOK ? 'Ended OK' : 'Waiting'
  return { totalSteps: total, completedSteps: completed, failedSteps: failed, status: overall }
}

// ── App factories ─────────────────────────────────────────────────────────────

function mkRunHistory(prefix, runs) {
  return runs.map(([no, daysAgo, status, dur, failed]) =>
    runHist({ runNo: no, runId: `${prefix}-RH-${String(no).padStart(2,'0')}`, runDate: ago(daysAgo * 24 * 60), status, durationMins: dur, totalSteps: 7, completedSteps: 7 - failed, failedSteps: failed })
  )
}

function mkReadinessPhase(appKey, folder, runs) {
  // runs: [{ runId, runNo, baseAgo, windowMins, failAt? }]
  const fruns = runs.map(r => mkFolderRun(r.runId, r.runNo, folder, r.baseAgo, r.windowMins, r.failAt || []))
  const counts = rdxCounts(fruns)
  const elapsed = runs[runs.length - 1].windowMins
  const hasBreach = fruns.some(r => r.status === 'Ended Not OK')
  return phase({
    hasSLA: false,
    jobId: `IN01:rdx-${appKey}`,
    name: `mha_DRM_${appKey.toUpperCase()}_READINESS`,
    folder,
    startTimeISO: fruns[0].startTimeISO,
    endTimeISO:   fruns[fruns.length - 1].endTimeISO,
    rtoTargetMins: 60, elapsedMins: elapsed, rtoPct: hasBreach ? 100 : Math.round(elapsed / 0.6),
    rtoStatus: hasBreach ? 'Breached' : 'On Track',
    rtoBreached: hasBreach,
    ...counts,
    folderRuns: fruns,
    runHistory: mkRunHistory(appKey.toUpperCase(), [
      [1, 28, 'Ended OK', 18, 0], [2, 21, 'Ended OK', 20, 0],
      [3, 14, hasBreach ? 'Ended Not OK' : 'Ended OK', 22, hasBreach ? 2 : 0],
      [4, 7,  'Ended OK', 19, 0], [5, 1, hasBreach ? 'Ended Not OK' : 'Ended OK', 21, hasBreach ? 1 : 0],
    ]),
  })
}

function mkSWOPhase(appKey, jobSuffix, { status, startAgo, endAgo, estAgo, rtoTarget, elapsed, rtoPct, rtoStatus, rtoBreached = false } = {}) {
  return phase({
    jobId: `IN01:${jobSuffix}`,
    name: `mha-DRM-${appKey.toUpperCase()}-MASTER-SWITCHOVER`,
    folder: `mha-DRM-${appKey.toUpperCase()}-MASTER-SWITCHOVER`,
    status,
    startTimeISO: startAgo != null ? ago(startAgo) : null,
    endTimeISO:   endAgo   != null ? ago(endAgo)   : null,
    estEndISO:    estAgo   != null ? from(estAgo)  : null,
    rtoTargetMins: rtoTarget, elapsedMins: elapsed, rtoPct,
    rtoStatus, rtoBreached,
  })
}

function mkSWBPhase(appKey, jobSuffix, { status, startAgo, endAgo, estAgo, rtoTarget, elapsed, rtoPct, rtoStatus, rtoBreached = false } = {}) {
  return phase({
    jobId: `IN01:${jobSuffix}`,
    name: `mha-DRM-${appKey.toUpperCase()}-MASTER-SWITCHBACK`,
    folder: `mha-DRM-${appKey.toUpperCase()}-MASTER-SWITCHBACK`,
    status,
    startTimeISO: startAgo != null ? ago(startAgo) : null,
    endTimeISO:   endAgo   != null ? ago(endAgo)   : null,
    estEndISO:    estAgo   != null ? from(estAgo)  : null,
    rtoTargetMins: rtoTarget, elapsedMins: elapsed, rtoPct,
    rtoStatus, rtoBreached,
  })
}

function mkFOPhase(appKey, jobSuffix, opts = {}) {
  const { status, startAgo, endAgo, estAgo, rtoTarget = 30, elapsed = 0, rtoPct = 0, rtoStatus = 'On Track', rtoBreached = false } = opts
  return phase({
    jobId: `IN01:${jobSuffix}`,
    name: `mha-DRM-${appKey.toUpperCase()}-MASTER-FAILOVER`,
    folder: `mha-DRM-${appKey.toUpperCase()}-MASTER-FAILOVER`,
    status,
    startTimeISO: startAgo != null ? ago(startAgo) : null,
    endTimeISO:   endAgo   != null ? ago(endAgo)   : null,
    estEndISO:    estAgo   != null ? from(estAgo)  : null,
    rtoTargetMins: rtoTarget, elapsedMins: elapsed, rtoPct, rtoStatus, rtoBreached,
  })
}

// ── 50 Application DR Operations ─────────────────────────────────────────────

export const mockDROperations = [

  // ── 1. Murex — In Progress / At Risk ────────────────────────────────────────
  {
    app: 'Murex', server: 'IN01',
    totalPhases: 3, completedPhases: 0, failedPhases: 0, executingPhases: 3, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 40,
    phases: {
      switchover: mkSWOPhase('Murex', '14fct', { status:'Executing', startAgo:22, estAgo:2, rtoTarget:20, elapsed:22, rtoPct:110, rtoStatus:'Breached', rtoBreached:true }),
      switchback: mkSWBPhase('Murex', '14fdl', { status:'Waiting',   startAgo:null, rtoTarget:45, elapsed:0, rtoPct:0, rtoStatus:'On Track' }),
      readiness:  mkReadinessPhase('murex', 'mha-murex-readiness', [
        { runId:'MRX-R1', runNo:1, baseAgo:180, windowMins:12 },
        { runId:'MRX-R2', runNo:2, baseAgo:100, windowMins:12 },
        { runId:'MRX-R3', runNo:3, baseAgo:30,  windowMins:12, failAt:[4,5] },
      ]),
    },
  },

  // ── 2. T24 — Completed / On Track ────────────────────────────────────────────
  {
    app: 'T24', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('T24', '1500a', { status:'Ended OK', startAgo:120, endAgo:100, rtoTarget:30, elapsed:20, rtoPct:67, rtoStatus:'Met' }),
      switchback: mkSWBPhase('T24', '1500b', { status:'Ended OK', startAgo:95,  endAgo:70,  rtoTarget:60, elapsed:25, rtoPct:42, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('t24', 'mha-t24-readiness', [
        { runId:'T24-R1', runNo:1, baseAgo:200, windowMins:12 },
        { runId:'T24-R2', runNo:2, baseAgo:130, windowMins:12 },
        { runId:'T24-R3', runNo:3, baseAgo:60,  windowMins:12 },
      ]),
    },
  },

  // ── 3. Calypso — In Progress / Breached ─────────────────────────────────────
  {
    app: 'Calypso', server: 'IN01',
    totalPhases: 3, completedPhases: 1, failedPhases: 1, executingPhases: 1, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 55,
    phases: {
      switchover: mkSWOPhase('Calypso', '1501a', { status:'Ended Not OK', startAgo:80, endAgo:50, rtoTarget:25, elapsed:30, rtoPct:120, rtoStatus:'Breached', rtoBreached:true }),
      switchback: mkSWBPhase('Calypso', '1501b', { status:'Executing', startAgo:45, estAgo:10, rtoTarget:60, elapsed:45, rtoPct:75, rtoStatus:'At Risk' }),
      readiness:  mkReadinessPhase('calypso', 'mha-calypso-readiness', [
        { runId:'CAL-R1', runNo:1, baseAgo:250, windowMins:12, failAt:[2] },
        { runId:'CAL-R2', runNo:2, baseAgo:160, windowMins:12 },
        { runId:'CAL-R3', runNo:3, baseAgo:80,  windowMins:12, failAt:[5,6] },
      ]),
    },
  },

  // ── 4. Cortex — Completed / On Track ─────────────────────────────────────────
  {
    app: 'Cortex', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Cortex', '14fed', { status:'Ended OK', startAgo:90, endAgo:75, rtoTarget:20, elapsed:15, rtoPct:75, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('cortex', 'mha-cortex-readiness', [
        { runId:'CTX-R1', runNo:1, baseAgo:150, windowMins:12 },
        { runId:'CTX-R2', runNo:2, baseAgo:90,  windowMins:12 },
        { runId:'CTX-R3', runNo:3, baseAgo:30,  windowMins:12 },
      ]),
    },
  },

  // ── 5. Kondor — Completed / On Track ─────────────────────────────────────────
  {
    app: 'Kondor', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Kondor', '1502a', { status:'Ended OK', startAgo:60, endAgo:48, rtoTarget:15, elapsed:12, rtoPct:80, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('kondor', 'mha-kondor-readiness', [
        { runId:'KND-R1', runNo:1, baseAgo:120, windowMins:10 },
        { runId:'KND-R2', runNo:2, baseAgo:60,  windowMins:10 },
        { runId:'KND-R3', runNo:3, baseAgo:20,  windowMins:10 },
      ]),
    },
  },

  // ── 6. DataHub — Readiness Breached ──────────────────────────────────────────
  {
    app: 'DataHub', server: 'IN01',
    totalPhases: 1, completedPhases: 0, failedPhases: 0, executingPhases: 0, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 30,
    phases: {
      switchover: null,
      switchback: null,
      readiness:  mkReadinessPhase('datahub', 'mha-datahub-readiness', [
        { runId:'DHB-R1', runNo:1, baseAgo:180, windowMins:12, failAt:[1,3,5] },
        { runId:'DHB-R2', runNo:2, baseAgo:90,  windowMins:12, failAt:[5,6] },
        { runId:'DHB-R3', runNo:3, baseAgo:30,  windowMins:12, failAt:[0,2,4,6] },
      ]),
    },
  },

  // ── 7. SAP ERP — Completed / On Track ────────────────────────────────────────
  {
    app: 'SAP ERP', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('SAP_ERP', 'sap001', { status:'Ended OK', startAgo:200, endAgo:160, rtoTarget:45, elapsed:40, rtoPct:89, rtoStatus:'Met' }),
      switchback: mkSWBPhase('SAP_ERP', 'sap002', { status:'Ended OK', startAgo:155, endAgo:100, rtoTarget:90, elapsed:55, rtoPct:61, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('sap_erp', 'mha-sap-erp-readiness', [
        { runId:'SAP-R1', runNo:1, baseAgo:300, windowMins:15 },
        { runId:'SAP-R2', runNo:2, baseAgo:180, windowMins:15 },
        { runId:'SAP-R3', runNo:3, baseAgo:90,  windowMins:15 },
      ]),
    },
  },

  // ── 8. Oracle Financials — In Progress / On Track ────────────────────────────
  {
    app: 'Oracle Financials', server: 'IN01',
    totalPhases: 3, completedPhases: 1, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 45,
    phases: {
      switchover: mkSWOPhase('Oracle_Fin', 'orc001', { status:'Ended OK', startAgo:90, endAgo:60, rtoTarget:30, elapsed:30, rtoPct:100, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Oracle_Fin', 'orc002', { status:'Executing', startAgo:55, estAgo:20, rtoTarget:60, elapsed:55, rtoPct:92, rtoStatus:'At Risk' }),
      readiness:  mkReadinessPhase('oracle_fin', 'mha-oracle-fin-readiness', [
        { runId:'ORC-R1', runNo:1, baseAgo:200, windowMins:12 },
        { runId:'ORC-R2', runNo:2, baseAgo:120, windowMins:12 },
        { runId:'ORC-R3', runNo:3, baseAgo:45,  windowMins:12 },
      ]),
    },
  },

  // ── 9. Flexcube — Completed / On Track ───────────────────────────────────────
  {
    app: 'Flexcube', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Flexcube', 'flx001', { status:'Ended OK', startAgo:240, endAgo:212, rtoTarget:30, elapsed:28, rtoPct:93, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Flexcube', 'flx002', { status:'Ended OK', startAgo:205, endAgo:160, rtoTarget:60, elapsed:45, rtoPct:75, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('flexcube', 'mha-flexcube-readiness', [
        { runId:'FLX-R1', runNo:1, baseAgo:360, windowMins:14 },
        { runId:'FLX-R2', runNo:2, baseAgo:240, windowMins:14 },
        { runId:'FLX-R3', runNo:3, baseAgo:120, windowMins:14 },
      ]),
    },
  },

  // ── 10. Bloomberg Feed — In Progress / At Risk ────────────────────────────────
  {
    app: 'Bloomberg Feed', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 30,
    phases: {
      switchover: mkSWOPhase('Bloomberg', 'blm001', { status:'Executing', startAgo:25, estAgo:5, rtoTarget:20, elapsed:25, rtoPct:125, rtoStatus:'Breached', rtoBreached:true }),
      switchback: null,
      readiness:  mkReadinessPhase('bloomberg', 'mha-bloomberg-readiness', [
        { runId:'BLM-R1', runNo:1, baseAgo:120, windowMins:10 },
        { runId:'BLM-R2', runNo:2, baseAgo:60,  windowMins:10, failAt:[3] },
        { runId:'BLM-R3', runNo:3, baseAgo:20,  windowMins:10 },
      ]),
    },
  },

  // ── 11. SWIFT Messaging — Completed / On Track ────────────────────────────────
  {
    app: 'SWIFT Messaging', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('SWIFT_MSG', 'swf001', { status:'Ended OK', startAgo:180, endAgo:162, rtoTarget:20, elapsed:18, rtoPct:90, rtoStatus:'Met' }),
      switchback: mkSWBPhase('SWIFT_MSG', 'swf002', { status:'Ended OK', startAgo:158, endAgo:128, rtoTarget:30, elapsed:30, rtoPct:100, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('swift_msg', 'mha-swift-msg-readiness', [
        { runId:'SWF-R1', runNo:1, baseAgo:300, windowMins:10 },
        { runId:'SWF-R2', runNo:2, baseAgo:200, windowMins:10 },
        { runId:'SWF-R3', runNo:3, baseAgo:100, windowMins:10 },
      ]),
    },
  },

  // ── 12. Payment Hub — In Progress / On Track ──────────────────────────────────
  {
    app: 'Payment Hub', server: 'IN01',
    totalPhases: 3, completedPhases: 2, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 70,
    phases: {
      switchover: mkSWOPhase('Payment_Hub', 'pay001', { status:'Ended OK', startAgo:150, endAgo:125, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Payment_Hub', 'pay002', { status:'Ended OK', startAgo:120, endAgo:90,  rtoTarget:60, elapsed:30, rtoPct:50, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('payment_hub', 'mha-payment-hub-readiness', [
        { runId:'PAY-R1', runNo:1, baseAgo:250, windowMins:12 },
        { runId:'PAY-R2', runNo:2, baseAgo:150, windowMins:12 },
        { runId:'PAY-R3', runNo:3, baseAgo:60,  windowMins:12 },
      ]),
    },
  },

  // ── 13. RTGS Gateway — Completed / On Track ──────────────────────────────────
  {
    app: 'RTGS Gateway', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('RTGS_GW', 'rtg001', { status:'Ended OK', startAgo:160, endAgo:145, rtoTarget:20, elapsed:15, rtoPct:75, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('rtgs_gw', 'mha-rtgs-readiness', [
        { runId:'RTG-R1', runNo:1, baseAgo:280, windowMins:10 },
        { runId:'RTG-R2', runNo:2, baseAgo:180, windowMins:10 },
        { runId:'RTG-R3', runNo:3, baseAgo:80,  windowMins:10 },
      ]),
    },
  },

  // ── 14. SimCorp Dimension — Readiness Breached ───────────────────────────────
  {
    app: 'SimCorp Dimension', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 0, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 20,
    phases: {
      switchover: mkSWOPhase('SimCorp', 'smc001', { status:'Waiting', rtoTarget:30, elapsed:0, rtoPct:0, rtoStatus:'On Track' }),
      switchback: null,
      readiness:  mkReadinessPhase('simcorp', 'mha-simcorp-readiness', [
        { runId:'SMC-R1', runNo:1, baseAgo:200, windowMins:12, failAt:[0,1,2] },
        { runId:'SMC-R2', runNo:2, baseAgo:120, windowMins:12, failAt:[3,4] },
        { runId:'SMC-R3', runNo:3, baseAgo:40,  windowMins:12, failAt:[5,6] },
      ]),
    },
  },

  // ── 15. Charles River IMS — Completed / On Track ─────────────────────────────
  {
    app: 'Charles River IMS', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('CRiv_IMS', 'crv001', { status:'Ended OK', startAgo:300, endAgo:275, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: mkSWBPhase('CRiv_IMS', 'crv002', { status:'Ended OK', startAgo:270, endAgo:215, rtoTarget:60, elapsed:55, rtoPct:92, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('criv_ims', 'mha-criv-readiness', [
        { runId:'CRV-R1', runNo:1, baseAgo:420, windowMins:14 },
        { runId:'CRV-R2', runNo:2, baseAgo:300, windowMins:14 },
        { runId:'CRV-R3', runNo:3, baseAgo:180, windowMins:14 },
      ]),
    },
  },

  // ── 16. Broadridge — In Progress / On Track ───────────────────────────────────
  {
    app: 'Broadridge', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 60,
    phases: {
      switchover: mkSWOPhase('Broadridge', 'brd001', { status:'Ended OK', startAgo:100, endAgo:75, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('broadridge', 'mha-broadridge-readiness', [
        { runId:'BRD-R1', runNo:1, baseAgo:200, windowMins:12 },
        { runId:'BRD-R2', runNo:2, baseAgo:110, windowMins:12 },
        { runId:'BRD-R3', runNo:3, baseAgo:40,  windowMins:12 },
      ]),
    },
  },

  // ── 17. FIS Profile — Completed / On Track ───────────────────────────────────
  {
    app: 'FIS Profile', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('FIS_Prof', 'fis001', { status:'Ended OK', startAgo:220, endAgo:195, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('fis_prof', 'mha-fis-readiness', [
        { runId:'FIS-R1', runNo:1, baseAgo:350, windowMins:12 },
        { runId:'FIS-R2', runNo:2, baseAgo:240, windowMins:12 },
        { runId:'FIS-R3', runNo:3, baseAgo:130, windowMins:12 },
      ]),
    },
  },

  // ── 18. Finastra Fusion — In Progress / Breached ─────────────────────────────
  {
    app: 'Finastra Fusion', server: 'IN01',
    totalPhases: 3, completedPhases: 0, failedPhases: 1, executingPhases: 2, breachedPhases: 2,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 25,
    phases: {
      switchover: mkSWOPhase('Finastra', 'fin001', { status:'Ended Not OK', startAgo:70, endAgo:35, rtoTarget:30, elapsed:35, rtoPct:117, rtoStatus:'Breached', rtoBreached:true }),
      switchback: mkSWBPhase('Finastra', 'fin002', { status:'Executing', startAgo:30, estAgo:15, rtoTarget:60, elapsed:30, rtoPct:50, rtoStatus:'On Track' }),
      readiness:  mkReadinessPhase('finastra', 'mha-finastra-readiness', [
        { runId:'FIN-R1', runNo:1, baseAgo:200, windowMins:12, failAt:[2,3] },
        { runId:'FIN-R2', runNo:2, baseAgo:120, windowMins:12 },
        { runId:'FIN-R3', runNo:3, baseAgo:50,  windowMins:12 },
      ]),
    },
  },

  // ── 19. Summit FT — Completed / On Track ─────────────────────────────────────
  {
    app: 'Summit FT', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Summit_FT', 'smt001', { status:'Ended OK', startAgo:280, endAgo:258, rtoTarget:25, elapsed:22, rtoPct:88, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('summit_ft', 'mha-summit-readiness', [
        { runId:'SMT-R1', runNo:1, baseAgo:400, windowMins:12 },
        { runId:'SMT-R2', runNo:2, baseAgo:280, windowMins:12 },
        { runId:'SMT-R3', runNo:3, baseAgo:160, windowMins:12 },
      ]),
    },
  },

  // ── 20. ION Trading — In Progress / At Risk ───────────────────────────────────
  {
    app: 'ION Trading', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 35,
    phases: {
      switchover: mkSWOPhase('ION_Trade', 'ion001', { status:'Executing', startAgo:28, estAgo:3, rtoTarget:30, elapsed:28, rtoPct:93, rtoStatus:'At Risk' }),
      switchback: null,
      readiness:  mkReadinessPhase('ion_trade', 'mha-ion-readiness', [
        { runId:'ION-R1', runNo:1, baseAgo:160, windowMins:11 },
        { runId:'ION-R2', runNo:2, baseAgo:90,  windowMins:11 },
        { runId:'ION-R3', runNo:3, baseAgo:35,  windowMins:11 },
      ]),
    },
  },

  // ── 21. Openlink Endur — Completed / On Track ────────────────────────────────
  {
    app: 'Openlink Endur', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Openlink', 'opn001', { status:'Ended OK', startAgo:320, endAgo:295, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('openlink', 'mha-openlink-readiness', [
        { runId:'OPN-R1', runNo:1, baseAgo:450, windowMins:13 },
        { runId:'OPN-R2', runNo:2, baseAgo:320, windowMins:13 },
        { runId:'OPN-R3', runNo:3, baseAgo:190, windowMins:13 },
      ]),
    },
  },

  // ── 22. Fidessa — In Progress / On Track ─────────────────────────────────────
  {
    app: 'Fidessa', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 55,
    phases: {
      switchover: mkSWOPhase('Fidessa', 'fds001', { status:'Ended OK', startAgo:130, endAgo:108, rtoTarget:25, elapsed:22, rtoPct:88, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('fidessa', 'mha-fidessa-readiness', [
        { runId:'FDS-R1', runNo:1, baseAgo:240, windowMins:12 },
        { runId:'FDS-R2', runNo:2, baseAgo:150, windowMins:12 },
        { runId:'FDS-R3', runNo:3, baseAgo:60,  windowMins:12 },
      ]),
    },
  },

  // ── 23. Reuters Eikon — Completed / On Track ─────────────────────────────────
  {
    app: 'Reuters Eikon', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Reuters', 'rtr001', { status:'Ended OK', startAgo:360, endAgo:342, rtoTarget:20, elapsed:18, rtoPct:90, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('reuters', 'mha-reuters-readiness', [
        { runId:'RTR-R1', runNo:1, baseAgo:500, windowMins:10 },
        { runId:'RTR-R2', runNo:2, baseAgo:380, windowMins:10 },
        { runId:'RTR-R3', runNo:3, baseAgo:260, windowMins:10 },
      ]),
    },
  },

  // ── 24. IBM MQ — In Progress / Breached ──────────────────────────────────────
  {
    app: 'IBM MQ', server: 'IN01',
    totalPhases: 3, completedPhases: 1, failedPhases: 1, executingPhases: 1, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 40,
    phases: {
      switchover: mkSWOPhase('IBM_MQ', 'ibm001', { status:'Ended Not OK', startAgo:90, endAgo:55, rtoTarget:30, elapsed:35, rtoPct:117, rtoStatus:'Breached', rtoBreached:true }),
      switchback: mkSWBPhase('IBM_MQ', 'ibm002', { status:'Executing', startAgo:50, estAgo:25, rtoTarget:60, elapsed:50, rtoPct:83, rtoStatus:'At Risk' }),
      readiness:  mkReadinessPhase('ibm_mq', 'mha-ibm-mq-readiness', [
        { runId:'IBM-R1', runNo:1, baseAgo:200, windowMins:12 },
        { runId:'IBM-R2', runNo:2, baseAgo:110, windowMins:12, failAt:[1] },
        { runId:'IBM-R3', runNo:3, baseAgo:40,  windowMins:12 },
      ]),
    },
  },

  // ── 25. Kafka Messaging — Completed / On Track ───────────────────────────────
  {
    app: 'Kafka Messaging', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Kafka', 'kfk001', { status:'Ended OK', startAgo:400, endAgo:380, rtoTarget:25, elapsed:20, rtoPct:80, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('kafka', 'mha-kafka-readiness', [
        { runId:'KFK-R1', runNo:1, baseAgo:550, windowMins:10 },
        { runId:'KFK-R2', runNo:2, baseAgo:440, windowMins:10 },
        { runId:'KFK-R3', runNo:3, baseAgo:330, windowMins:10 },
      ]),
    },
  },

  // ── 26. SWIFT Alliance — Completed / On Track ────────────────────────────────
  {
    app: 'SWIFT Alliance', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Swift_All', 'swa001', { status:'Ended OK', startAgo:420, endAgo:400, rtoTarget:20, elapsed:20, rtoPct:100, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Swift_All', 'swa002', { status:'Ended OK', startAgo:395, endAgo:355, rtoTarget:45, elapsed:40, rtoPct:89, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('swift_all', 'mha-swift-all-readiness', [
        { runId:'SWA-R1', runNo:1, baseAgo:560, windowMins:10 },
        { runId:'SWA-R2', runNo:2, baseAgo:450, windowMins:10 },
        { runId:'SWA-R3', runNo:3, baseAgo:340, windowMins:10 },
      ]),
    },
  },

  // ── 27. Front Arena — In Progress / On Track ─────────────────────────────────
  {
    app: 'Front Arena', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 60,
    phases: {
      switchover: mkSWOPhase('Front_Arena', 'fra001', { status:'Ended OK', startAgo:110, endAgo:85, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('front_arena', 'mha-front-arena-readiness', [
        { runId:'FRA-R1', runNo:1, baseAgo:220, windowMins:12 },
        { runId:'FRA-R2', runNo:2, baseAgo:130, windowMins:12 },
        { runId:'FRA-R3', runNo:3, baseAgo:50,  windowMins:12 },
      ]),
    },
  },

  // ── 28. Traiana — Completed / On Track ───────────────────────────────────────
  {
    app: 'Traiana', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Traiana', 'tra001', { status:'Ended OK', startAgo:340, endAgo:322, rtoTarget:20, elapsed:18, rtoPct:90, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('traiana', 'mha-traiana-readiness', [
        { runId:'TRA-R1', runNo:1, baseAgo:480, windowMins:10 },
        { runId:'TRA-R2', runNo:2, baseAgo:360, windowMins:10 },
        { runId:'TRA-R3', runNo:3, baseAgo:240, windowMins:10 },
      ]),
    },
  },

  // ── 29. SS&C Geneva — Readiness Breached ─────────────────────────────────────
  {
    app: 'SS&C Geneva', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 0, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 15,
    phases: {
      switchover: mkSWOPhase('SSC_Geneva', 'ssc001', { status:'Waiting', rtoTarget:30, elapsed:0, rtoPct:0, rtoStatus:'On Track' }),
      switchback: null,
      readiness:  mkReadinessPhase('ssc_geneva', 'mha-ssc-readiness', [
        { runId:'SSC-R1', runNo:1, baseAgo:180, windowMins:12, failAt:[2,4,6] },
        { runId:'SSC-R2', runNo:2, baseAgo:100, windowMins:12, failAt:[0,3] },
        { runId:'SSC-R3', runNo:3, baseAgo:40,  windowMins:12, failAt:[1,5,6] },
      ]),
    },
  },

  // ── 30. Temenos — Completed / On Track ───────────────────────────────────────
  {
    app: 'Temenos', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Temenos', 'tem001', { status:'Ended OK', startAgo:500, endAgo:472, rtoTarget:30, elapsed:28, rtoPct:93, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Temenos', 'tem002', { status:'Ended OK', startAgo:465, endAgo:420, rtoTarget:60, elapsed:45, rtoPct:75, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('temenos', 'mha-temenos-readiness', [
        { runId:'TEM-R1', runNo:1, baseAgo:640, windowMins:14 },
        { runId:'TEM-R2', runNo:2, baseAgo:520, windowMins:14 },
        { runId:'TEM-R3', runNo:3, baseAgo:400, windowMins:14 },
      ]),
    },
  },

  // ── 31. BlackRock Aladdin — In Progress / At Risk ────────────────────────────
  {
    app: 'BlackRock Aladdin', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 40,
    phases: {
      switchover: mkSWOPhase('BR_Aladdin', 'bra001', { status:'Executing', startAgo:27, estAgo:4, rtoTarget:30, elapsed:27, rtoPct:90, rtoStatus:'At Risk' }),
      switchback: null,
      readiness:  mkReadinessPhase('br_aladdin', 'mha-aladdin-readiness', [
        { runId:'BRA-R1', runNo:1, baseAgo:150, windowMins:11 },
        { runId:'BRA-R2', runNo:2, baseAgo:80,  windowMins:11 },
        { runId:'BRA-R3', runNo:3, baseAgo:30,  windowMins:11 },
      ]),
    },
  },

  // ── 32. Numerix — Completed / On Track ───────────────────────────────────────
  {
    app: 'Numerix', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Numerix', 'nmx001', { status:'Ended OK', startAgo:550, endAgo:530, rtoTarget:25, elapsed:20, rtoPct:80, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('numerix', 'mha-numerix-readiness', [
        { runId:'NMX-R1', runNo:1, baseAgo:700, windowMins:10 },
        { runId:'NMX-R2', runNo:2, baseAgo:580, windowMins:10 },
        { runId:'NMX-R3', runNo:3, baseAgo:460, windowMins:10 },
      ]),
    },
  },

  // ── 33. Markit EDM — In Progress / On Track ──────────────────────────────────
  {
    app: 'Markit EDM', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 55,
    phases: {
      switchover: mkSWOPhase('Markit_EDM', 'mkt001', { status:'Ended OK', startAgo:190, endAgo:165, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('markit_edm', 'mha-markit-readiness', [
        { runId:'MKT-R1', runNo:1, baseAgo:310, windowMins:12 },
        { runId:'MKT-R2', runNo:2, baseAgo:210, windowMins:12 },
        { runId:'MKT-R3', runNo:3, baseAgo:110, windowMins:12 },
      ]),
    },
  },

  // ── 34. Asset Control — Completed / On Track ─────────────────────────────────
  {
    app: 'Asset Control', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Asset_Ctrl', 'ast001', { status:'Ended OK', startAgo:610, endAgo:588, rtoTarget:25, elapsed:22, rtoPct:88, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('asset_ctrl', 'mha-asset-ctrl-readiness', [
        { runId:'AST-R1', runNo:1, baseAgo:760, windowMins:10 },
        { runId:'AST-R2', runNo:2, baseAgo:640, windowMins:10 },
        { runId:'AST-R3', runNo:3, baseAgo:520, windowMins:10 },
      ]),
    },
  },

  // ── 35. Golden Source — Readiness Breached ───────────────────────────────────
  {
    app: 'Golden Source', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 0, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 10,
    phases: {
      switchover: mkSWOPhase('Golden_Src', 'gld001', { status:'Waiting', rtoTarget:30, elapsed:0, rtoPct:0, rtoStatus:'On Track' }),
      switchback: null,
      readiness:  mkReadinessPhase('golden_src', 'mha-golden-readiness', [
        { runId:'GLD-R1', runNo:1, baseAgo:150, windowMins:12, failAt:[0,1,6] },
        { runId:'GLD-R2', runNo:2, baseAgo:80,  windowMins:12, failAt:[2,3,4] },
        { runId:'GLD-R3', runNo:3, baseAgo:30,  windowMins:12, failAt:[5,6] },
      ]),
    },
  },

  // ── 36. MFT Gateway — Completed / On Track ───────────────────────────────────
  {
    app: 'MFT Gateway', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('MFT_GW', 'mft001', { status:'Ended OK', startAgo:660, endAgo:645, rtoTarget:20, elapsed:15, rtoPct:75, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('mft_gw', 'mha-mft-readiness', [
        { runId:'MFT-R1', runNo:1, baseAgo:820, windowMins:10 },
        { runId:'MFT-R2', runNo:2, baseAgo:700, windowMins:10 },
        { runId:'MFT-R3', runNo:3, baseAgo:580, windowMins:10 },
      ]),
    },
  },

  // ── 37. SFTP Server — In Progress / On Track ─────────────────────────────────
  {
    app: 'SFTP Server', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 60,
    phases: {
      switchover: mkSWOPhase('SFTP_Svr', 'sftp01', { status:'Ended OK', startAgo:170, endAgo:155, rtoTarget:20, elapsed:15, rtoPct:75, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('sftp_svr', 'mha-sftp-readiness', [
        { runId:'SFT-R1', runNo:1, baseAgo:280, windowMins:11 },
        { runId:'SFT-R2', runNo:2, baseAgo:180, windowMins:11 },
        { runId:'SFT-R3', runNo:3, baseAgo:80,  windowMins:11 },
      ]),
    },
  },

  // ── 38. CLS Settlement — Completed / On Track ────────────────────────────────
  {
    app: 'CLS Settlement', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('CLS_Sett', 'cls001', { status:'Ended OK', startAgo:720, endAgo:695, rtoTarget:30, elapsed:25, rtoPct:83, rtoStatus:'Met' }),
      switchback: mkSWBPhase('CLS_Sett', 'cls002', { status:'Ended OK', startAgo:690, endAgo:645, rtoTarget:60, elapsed:45, rtoPct:75, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('cls_sett', 'mha-cls-readiness', [
        { runId:'CLS-R1', runNo:1, baseAgo:880, windowMins:13 },
        { runId:'CLS-R2', runNo:2, baseAgo:760, windowMins:13 },
        { runId:'CLS-R3', runNo:3, baseAgo:640, windowMins:13 },
      ]),
    },
  },

  // ── 39. Sophis — In Progress / Breached ──────────────────────────────────────
  {
    app: 'Sophis', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 1, executingPhases: 1, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 30,
    phases: {
      switchover: mkSWOPhase('Sophis', 'sph001', { status:'Ended Not OK', startAgo:60, endAgo:22, rtoTarget:30, elapsed:38, rtoPct:127, rtoStatus:'Breached', rtoBreached:true }),
      switchback: null,
      readiness:  mkReadinessPhase('sophis', 'mha-sophis-readiness', [
        { runId:'SPH-R1', runNo:1, baseAgo:180, windowMins:12 },
        { runId:'SPH-R2', runNo:2, baseAgo:100, windowMins:12 },
        { runId:'SPH-R3', runNo:3, baseAgo:40,  windowMins:12, failAt:[4,5] },
      ]),
    },
  },

  // ── 40. RiskWatch — Completed / On Track ─────────────────────────────────────
  {
    app: 'RiskWatch', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('RiskWatch', 'rwt001', { status:'Ended OK', startAgo:770, endAgo:752, rtoTarget:20, elapsed:18, rtoPct:90, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('riskwatch', 'mha-riskwatch-readiness', [
        { runId:'RWT-R1', runNo:1, baseAgo:940, windowMins:10 },
        { runId:'RWT-R2', runNo:2, baseAgo:820, windowMins:10 },
        { runId:'RWT-R3', runNo:3, baseAgo:700, windowMins:10 },
      ]),
    },
  },

  // ── 41. Informatica MDM — In Progress / On Track ─────────────────────────────
  {
    app: 'Informatica MDM', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 65,
    phases: {
      switchover: mkSWOPhase('Infa_MDM', 'inf001', { status:'Ended OK', startAgo:210, endAgo:183, rtoTarget:30, elapsed:27, rtoPct:90, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('infa_mdm', 'mha-informatica-readiness', [
        { runId:'INF-R1', runNo:1, baseAgo:340, windowMins:12 },
        { runId:'INF-R2', runNo:2, baseAgo:230, windowMins:12 },
        { runId:'INF-R3', runNo:3, baseAgo:120, windowMins:12 },
      ]),
    },
  },

  // ── 42. Quantifi — Completed / On Track ──────────────────────────────────────
  {
    app: 'Quantifi', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Quantifi', 'qnt001', { status:'Ended OK', startAgo:820, endAgo:800, rtoTarget:25, elapsed:20, rtoPct:80, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('quantifi', 'mha-quantifi-readiness', [
        { runId:'QNT-R1', runNo:1, baseAgo:1000, windowMins:10 },
        { runId:'QNT-R2', runNo:2, baseAgo:880,  windowMins:10 },
        { runId:'QNT-R3', runNo:3, baseAgo:760,  windowMins:10 },
      ]),
    },
  },

  // ── 43. Linedata Longview — In Progress / At Risk ────────────────────────────
  {
    app: 'Linedata Longview', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 30,
    phases: {
      switchover: mkSWOPhase('Linedata', 'lnd001', { status:'Executing', startAgo:26, estAgo:5, rtoTarget:30, elapsed:26, rtoPct:87, rtoStatus:'At Risk' }),
      switchback: null,
      readiness:  mkReadinessPhase('linedata', 'mha-linedata-readiness', [
        { runId:'LND-R1', runNo:1, baseAgo:160, windowMins:11 },
        { runId:'LND-R2', runNo:2, baseAgo:90,  windowMins:11 },
        { runId:'LND-R3', runNo:3, baseAgo:35,  windowMins:11, failAt:[3] },
      ]),
    },
  },

  // ── 44. Imagine Software — Completed / On Track ───────────────────────────────
  {
    app: 'Imagine Software', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Imagine', 'img001', { status:'Ended OK', startAgo:870, endAgo:852, rtoTarget:20, elapsed:18, rtoPct:90, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('imagine', 'mha-imagine-readiness', [
        { runId:'IMG-R1', runNo:1, baseAgo:1040, windowMins:10 },
        { runId:'IMG-R2', runNo:2, baseAgo:920,  windowMins:10 },
        { runId:'IMG-R3', runNo:3, baseAgo:800,  windowMins:10 },
      ]),
    },
  },

  // ── 45. Torstone Inferno — In Progress / On Track ────────────────────────────
  {
    app: 'Torstone Inferno', server: 'IN01',
    totalPhases: 2, completedPhases: 1, failedPhases: 0, executingPhases: 1, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 55,
    phases: {
      switchover: mkSWOPhase('Torstone', 'tor001', { status:'Ended OK', startAgo:230, endAgo:208, rtoTarget:25, elapsed:22, rtoPct:88, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('torstone', 'mha-torstone-readiness', [
        { runId:'TOR-R1', runNo:1, baseAgo:370, windowMins:12 },
        { runId:'TOR-R2', runNo:2, baseAgo:260, windowMins:12 },
        { runId:'TOR-R3', runNo:3, baseAgo:150, windowMins:12 },
      ]),
    },
  },

  // ── 46. Triple Point CTRM — Completed / On Track ─────────────────────────────
  {
    app: 'Triple Point CTRM', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('TriplePoint', 'tp001', { status:'Ended OK', startAgo:920, endAgo:898, rtoTarget:25, elapsed:22, rtoPct:88, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('triplepoint', 'mha-tp-readiness', [
        { runId:'TRP-R1', runNo:1, baseAgo:1080, windowMins:11 },
        { runId:'TRP-R2', runNo:2, baseAgo:960,  windowMins:11 },
        { runId:'TRP-R3', runNo:3, baseAgo:840,  windowMins:11 },
      ]),
    },
  },

  // ── 47. SunGard Adaptiv — In Progress / At Risk ───────────────────────────────
  {
    app: 'SunGard Adaptiv', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 25,
    phases: {
      switchover: mkSWOPhase('SunGard', 'sng001', { status:'Executing', startAgo:29, estAgo:2, rtoTarget:30, elapsed:29, rtoPct:97, rtoStatus:'At Risk' }),
      switchback: null,
      readiness:  mkReadinessPhase('sungard', 'mha-sungard-readiness', [
        { runId:'SNG-R1', runNo:1, baseAgo:170, windowMins:11 },
        { runId:'SNG-R2', runNo:2, baseAgo:100, windowMins:11 },
        { runId:'SNG-R3', runNo:3, baseAgo:40,  windowMins:11, failAt:[2] },
      ]),
    },
  },

  // ── 48. Euroclear — Completed / On Track ─────────────────────────────────────
  {
    app: 'Euroclear', server: 'IN01',
    totalPhases: 3, completedPhases: 3, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('Euroclear', 'eur001', { status:'Ended OK', startAgo:970, endAgo:943, rtoTarget:30, elapsed:27, rtoPct:90, rtoStatus:'Met' }),
      switchback: mkSWBPhase('Euroclear', 'eur002', { status:'Ended OK', startAgo:936, endAgo:891, rtoTarget:60, elapsed:45, rtoPct:75, rtoStatus:'Met' }),
      readiness:  mkReadinessPhase('euroclear', 'mha-euroclear-readiness', [
        { runId:'EUR-R1', runNo:1, baseAgo:1130, windowMins:14 },
        { runId:'EUR-R2', runNo:2, baseAgo:1010, windowMins:14 },
        { runId:'EUR-R3', runNo:3, baseAgo:890,  windowMins:14 },
      ]),
    },
  },

  // ── 49. FinancialCAD — Readiness Breached ────────────────────────────────────
  {
    app: 'FinancialCAD', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 0, breachedPhases: 1,
    overallStatus: 'In Progress', drillHealth: 'Breached', completionPct: 10,
    phases: {
      switchover: mkSWOPhase('FinCAD', 'fcd001', { status:'Waiting', rtoTarget:25, elapsed:0, rtoPct:0, rtoStatus:'On Track' }),
      switchback: null,
      readiness:  mkReadinessPhase('fincad', 'mha-fincad-readiness', [
        { runId:'FCD-R1', runNo:1, baseAgo:140, windowMins:12, failAt:[1,4,6] },
        { runId:'FCD-R2', runNo:2, baseAgo:80,  windowMins:12, failAt:[0,2,5] },
        { runId:'FCD-R3', runNo:3, baseAgo:30,  windowMins:12, failAt:[3,4,6] },
      ]),
    },
  },

  // ── 50. Report Portal — Completed / On Track ─────────────────────────────────
  {
    app: 'Report Portal', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: mkSWOPhase('ReportPortal', 'rpt001', { status:'Ended OK', startAgo:1020, endAgo:1005, rtoTarget:20, elapsed:15, rtoPct:75, rtoStatus:'Met' }),
      switchback: null,
      readiness:  mkReadinessPhase('report_portal', 'mha-report-portal-readiness', [
        { runId:'RPT-R1', runNo:1, baseAgo:1200, windowMins:10 },
        { runId:'RPT-R2', runNo:2, baseAgo:1080, windowMins:10 },
        { runId:'RPT-R3', runNo:3, baseAgo:960,  windowMins:10 },
      ]),
    },
  },
]

// ── Drills ────────────────────────────────────────────────────────────────────

export const mockDrills = [
  { id:'DRILL-2026-001', name:'Q1 2026 Full DR Drill',               status:'Completed',   progress:100, scheduledDate:'2026-01-15T06:00:00Z', startTime:'2026-01-15T06:02:14Z', endTime:'2026-01-15T14:38:52Z', totalJobs:1248, completedJobs:1240, failedJobs:8,  skippedJobs:0, datacenter:'DR-AZ-EAST', severity:'Full Failover',    rto:'4h 22m',       rpo:'15 min', owner:'ops-team@company.com'  },
  { id:'DRILL-2026-002', name:'Q2 2026 DR Drill — Batch & Finance',  status:'In Progress', progress:67,  scheduledDate:'2026-04-09T05:00:00Z', startTime:'2026-04-09T05:01:44Z', endTime:null,                   totalJobs:1512, completedJobs:1013, failedJobs:21, skippedJobs:2, datacenter:'DR-AZ-EAST', severity:'Full Failover',    rto:'In progress',  rpo:'10 min', owner:'dr-team@company.com'   },
  { id:'DRILL-2026-003', name:'Application Failover Test — MFT',     status:'Scheduled',   progress:0,   scheduledDate:'2026-04-22T03:00:00Z', startTime:null,                   endTime:null,                   totalJobs:388,  completedJobs:0,    failedJobs:0,  skippedJobs:0, datacenter:'DR-AZ-WEST', severity:'Partial Failover', rto:'Target: 2h',   rpo:'30 min', owner:'mft-team@company.com'  },
  { id:'DRILL-2026-004', name:'Database DR Validation — Core Banking',status:'Scheduled',   progress:0,   scheduledDate:'2026-05-06T02:00:00Z', startTime:null,                   endTime:null,                   totalJobs:756,  completedJobs:0,    failedJobs:0,  skippedJobs:0, datacenter:'DR-AZ-WEST', severity:'Data Validation',  rto:'Target: 3h',   rpo:'5 min',  owner:'dba-team@company.com'  },
  { id:'DRILL-2026-005', name:'Q3 2026 Trading Apps DR Drill',        status:'Scheduled',   progress:0,   scheduledDate:'2026-07-08T04:00:00Z', startTime:null,                   endTime:null,                   totalJobs:920,  completedJobs:0,    failedJobs:0,  skippedJobs:0, datacenter:'DR-AZ-EAST', severity:'Full Failover',    rto:'Target: 5h',   rpo:'15 min', owner:'trading-dr@company.com'},
]

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const mockJobs = [
  { id:'J001', name:'BATCH-EOD-FINCLOSE',   folder:'FINANCE_EOD',   server:'CTM-DR-01', status:'Executing',    startTime:'2026-04-09T12:10:00Z', duration:'00:42:18', cyclic:false, host:'drapp01.dc.local'  },
  { id:'J002', name:'BATCH-GL-RECON',       folder:'FINANCE_EOD',   server:'CTM-DR-01', status:'Executing',    startTime:'2026-04-09T11:58:00Z', duration:'00:54:22', cyclic:false, host:'drapp01.dc.local'  },
  { id:'J003', name:'MFT-SFTP-UPLOAD',      folder:'MFT_XFER',      server:'CTM-DR-02', status:'Ended OK',     startTime:'2026-04-09T11:30:00Z', duration:'00:03:11', cyclic:true,  host:'drmft01.dc.local'  },
  { id:'J004', name:'RPT-DAILY-SUMMARY',    folder:'REPORTS',       server:'CTM-DR-01', status:'Ended OK',     startTime:'2026-04-09T10:00:00Z', duration:'00:08:47', cyclic:false, host:'drapp02.dc.local'  },
  { id:'J005', name:'DB-BACKUP-CORE',       folder:'DB_MAINT',      server:'CTM-DR-02', status:'Ended Not OK', startTime:'2026-04-09T09:45:00Z', duration:'00:12:03', cyclic:false, host:'drdb01.dc.local'   },
  { id:'J006', name:'ETL-CUSTOMER-SYNC',    folder:'ETL_JOBS',      server:'CTM-DR-02', status:'Ended Not OK', startTime:'2026-04-09T09:20:00Z', duration:'00:05:39', cyclic:false, host:'drdb02.dc.local'   },
  { id:'J007', name:'BATCH-PAYROLL-CALC',   folder:'HR_BATCH',      server:'CTM-DR-01', status:'Waiting',      startTime:null,                   duration:null,       cyclic:false, host:'drapp03.dc.local'  },
  { id:'J008', name:'API-HEALTH-CHECK',     folder:'MONITORING',    server:'CTM-DR-02', status:'Executing',    startTime:'2026-04-09T12:48:00Z', duration:'00:05:01', cyclic:true,  host:'drmon01.dc.local'  },
  { id:'J009', name:'ARCH-LOG-CLEANUP',     folder:'MAINTENANCE',   server:'CTM-DR-01', status:'Ended OK',     startTime:'2026-04-09T08:00:00Z', duration:'00:01:52', cyclic:true,  host:'drapp01.dc.local'  },
  { id:'J010', name:'RPT-RISK-INTRADAY',    folder:'REPORTS',       server:'CTM-DR-01', status:'Hold',         startTime:null,                   duration:null,       cyclic:false, host:'drapp02.dc.local'  },
  { id:'J011', name:'SWIFT-MSG-DISPATCH',   folder:'PAYMENTS',      server:'CTM-DR-01', status:'Ended OK',     startTime:'2026-04-09T07:30:00Z', duration:'00:02:14', cyclic:true,  host:'drpay01.dc.local'  },
  { id:'J012', name:'RTGS-SETTLEMENT-RUN',  folder:'PAYMENTS',      server:'CTM-DR-01', status:'Ended OK',     startTime:'2026-04-09T07:00:00Z', duration:'00:08:55', cyclic:false, host:'drpay01.dc.local'  },
  { id:'J013', name:'MUREX-EOD-VALUATION',  folder:'TRADING_EOD',   server:'CTM-DR-02', status:'Executing',    startTime:'2026-04-09T13:00:00Z', duration:'01:02:00', cyclic:false, host:'drtrd01.dc.local'  },
  { id:'J014', name:'CALYPSO-RISK-CALC',    folder:'TRADING_EOD',   server:'CTM-DR-02', status:'Ended Not OK', startTime:'2026-04-09T11:10:00Z', duration:'00:22:08', cyclic:false, host:'drtrd02.dc.local'  },
  { id:'J015', name:'SAP-FI-CLOSE',         folder:'ERP_CLOSE',     server:'CTM-DR-01', status:'Ended OK',     startTime:'2026-04-09T06:00:00Z', duration:'00:45:00', cyclic:false, host:'drerp01.dc.local'  },
]

// ── Environment Comparison ────────────────────────────────────────────────────

export const mockEnvComparison = {
  prod: { label:'Production',       servers:['CTM-PROD-01','CTM-PROD-02'], status:'Active',         activeJobs:0,  completedJobs:8847, failedJobs:14, waitingJobs:22, agentsConnected:42, agentsTotal:44, lastSync:'2026-04-09T12:52:00Z', version:'9.21.300', uptime:'127d 14h 22m', avgJobDuration:'00:08:34', slaCompliance:99.2 },
  dr:   { label:'Disaster Recovery',servers:['CTM-DR-01','CTM-DR-02'],    status:'Active — Drill', activeJobs:14, completedJobs:1013, failedJobs:21, waitingJobs:8,  agentsConnected:9,  agentsTotal:10, lastSync:'2026-04-09T12:51:00Z', version:'9.21.300', uptime:'0d 7h 50m',    avgJobDuration:'00:09:12', slaCompliance:97.1 },
}

// ── Agents ────────────────────────────────────────────────────────────────────

export const mockAgents = [
  { id:'A01', name:'zzz-linux-agent-02',  host:'zzz-linux-agent-02',                    env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:30Z', platform:'Linux',   version:'9.21.x', activeJobs:63 },
  { id:'A02', name:'ctm-server',           host:'ctm-server',                            env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:28Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
  { id:'A03', name:'ctmawsdemosaas-sap',   host:'ctmawsdemosaaspreprod-sap.vse.bmc.com', env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:27Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
  { id:'A04', name:'zzz-eks-preprod-0',    host:'zzz-eks-preprod-0.bmci2t.com',          env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:31Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
  { id:'A05', name:'in-npottapu-w4',       host:'in-npottapu-w4-in-npottapu-w4_1',       env:'DR', datacenter:'IN01 / SaaS', status:'Warning',      lastPing:'2026-04-09T12:49:10Z', platform:'Windows', version:'9.21.x', activeJobs:0  },
  { id:'A06', name:'in-npottapu-default',  host:'in-npottapu-w4-default',                env:'DR', datacenter:'IN01 / SaaS', status:'Warning',      lastPing:'2026-04-09T12:47:55Z', platform:'Windows', version:'9.21.x', activeJobs:0  },
  { id:'A07', name:'zzz-linux-agent-01',   host:'zzz-linux-agent-01',                    env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:29Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
  { id:'A08', name:'lhq7-linux-agent-01',  host:'lhq7-linux-agent-01',                   env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:30Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
  { id:'A09', name:'em-frnunez-w3',        host:'em-frnunez-w3-frnunez',                 env:'DR', datacenter:'IN01 / SaaS', status:'Connected',    lastPing:'2026-04-09T12:52:32Z', platform:'Windows', version:'9.21.x', activeJobs:0  },
  { id:'A10', name:'N/A (unresolved)',      host:'(host not resolved)',                   env:'DR', datacenter:'IN01 / SaaS', status:'Disconnected', lastPing:'2026-04-09T11:10:14Z', platform:'Linux',   version:'9.21.x', activeJobs:0  },
]

// ── App Metadata ──────────────────────────────────────────────────────────────

export const mockAppMeta = {
  'Murex':              { criticality:'Business Critical', team:'Trading Ops',        applicationType:'Trading',          serviceImpact:'Revenue Critical',      owner:'trading-dr@company.com',    rpo:'15 min' },
  'T24':                { criticality:'Business Critical', team:'Core Banking',       applicationType:'Core Banking',     serviceImpact:'Full Outage',           owner:'cbs-ops@company.com',       rpo:'5 min'  },
  'Calypso':            { criticality:'Business Critical', team:'Derivatives IT',     applicationType:'Trading',          serviceImpact:'Derivatives Trading',   owner:'calypso-dr@company.com',    rpo:'15 min' },
  'Cortex':             { criticality:'Critical',          team:'Cortex Ops',         applicationType:'Customer-Facing',  serviceImpact:'Customer Operations',   owner:'cortex-ops@company.com',    rpo:'1 hr'   },
  'Kondor':             { criticality:'High',              team:'Treasury IT',        applicationType:'Treasury',         serviceImpact:'Treasury Operations',   owner:'kondor-it@company.com',     rpo:'30 min' },
  'DataHub':            { criticality:'Medium',            team:'BI Team',            applicationType:'Analytics',        serviceImpact:'Reporting Degraded',    owner:'bi-team@company.com',       rpo:'4 hr'   },
  'SAP ERP':            { criticality:'Business Critical', team:'ERP Team',           applicationType:'ERP',              serviceImpact:'Full Outage',           owner:'sap-dr@company.com',        rpo:'30 min' },
  'Oracle Financials':  { criticality:'Critical',          team:'Finance IT',         applicationType:'Finance',          serviceImpact:'Finance Operations',    owner:'oracle-dr@company.com',     rpo:'30 min' },
  'Flexcube':           { criticality:'Business Critical', team:'Core Banking',       applicationType:'Core Banking',     serviceImpact:'Full Outage',           owner:'flexcube-dr@company.com',   rpo:'5 min'  },
  'Bloomberg Feed':     { criticality:'Critical',          team:'Market Data',        applicationType:'Market Data',      serviceImpact:'Trading Disruption',    owner:'mktdata-dr@company.com',    rpo:'5 min'  },
  'SWIFT Messaging':    { criticality:'Business Critical', team:'Payments IT',        applicationType:'Payments',         serviceImpact:'Payments Halted',       owner:'swift-ops@company.com',     rpo:'5 min'  },
  'Payment Hub':        { criticality:'Business Critical', team:'Payments IT',        applicationType:'Payments',         serviceImpact:'Payments Halted',       owner:'payments-dr@company.com',   rpo:'5 min'  },
  'RTGS Gateway':       { criticality:'Business Critical', team:'Payments IT',        applicationType:'Payments',         serviceImpact:'Interbank Settlement',  owner:'rtgs-ops@company.com',      rpo:'2 min'  },
  'SimCorp Dimension':  { criticality:'Critical',          team:'Portfolio Mgmt IT',  applicationType:'Portfolio',        serviceImpact:'Portfolio Disruption',  owner:'simcorp-dr@company.com',    rpo:'15 min' },
  'Charles River IMS':  { criticality:'Critical',          team:'Investment IT',      applicationType:'Investment Mgmt',  serviceImpact:'Trading Disruption',    owner:'criv-dr@company.com',       rpo:'15 min' },
  'Broadridge':         { criticality:'Critical',          team:'Securities IT',      applicationType:'Securities',       serviceImpact:'Settlement Disruption', owner:'broadridge-dr@company.com', rpo:'30 min' },
  'FIS Profile':        { criticality:'Critical',          team:'Core Banking',       applicationType:'Core Banking',     serviceImpact:'Full Outage',           owner:'fis-dr@company.com',        rpo:'10 min' },
  'Finastra Fusion':    { criticality:'Critical',          team:'Lending IT',         applicationType:'Lending',          serviceImpact:'Lending Operations',    owner:'finastra-dr@company.com',   rpo:'30 min' },
  'Summit FT':          { criticality:'High',              team:'Fixed Income IT',    applicationType:'Fixed Income',     serviceImpact:'Fixed Income Ops',      owner:'summit-dr@company.com',     rpo:'30 min' },
  'ION Trading':        { criticality:'High',              team:'Commodities IT',     applicationType:'Commodities',      serviceImpact:'Commodities Trading',   owner:'ion-dr@company.com',        rpo:'30 min' },
  'Openlink Endur':     { criticality:'High',              team:'Energy IT',          applicationType:'Energy',           serviceImpact:'Energy Trading Ops',    owner:'openlink-dr@company.com',   rpo:'30 min' },
  'Fidessa':            { criticality:'High',              team:'Equities IT',        applicationType:'Equities',         serviceImpact:'Equities Trading',      owner:'fidessa-dr@company.com',    rpo:'30 min' },
  'Reuters Eikon':      { criticality:'High',              team:'Market Data',        applicationType:'Market Data',      serviceImpact:'Data Feed Disruption',  owner:'reuters-dr@company.com',    rpo:'15 min' },
  'IBM MQ':             { criticality:'Critical',          team:'Middleware IT',      applicationType:'Messaging',        serviceImpact:'Integration Failure',   owner:'ibmmq-ops@company.com',     rpo:'5 min'  },
  'Kafka Messaging':    { criticality:'High',              team:'Middleware IT',      applicationType:'Streaming',        serviceImpact:'Data Pipeline Impact',  owner:'kafka-ops@company.com',     rpo:'5 min'  },
  'SWIFT Alliance':     { criticality:'Business Critical', team:'Payments IT',        applicationType:'Payments',         serviceImpact:'SWIFT Comms Halted',    owner:'swift-all@company.com',     rpo:'2 min'  },
  'Front Arena':        { criticality:'High',              team:'Cross-Asset IT',     applicationType:'Trading',          serviceImpact:'Cross-Asset Trading',   owner:'arena-dr@company.com',      rpo:'30 min' },
  'Traiana':            { criticality:'High',              team:'Post-Trade IT',      applicationType:'Post-Trade',       serviceImpact:'Trade Confirmation',    owner:'traiana-dr@company.com',    rpo:'30 min' },
  'SS&C Geneva':        { criticality:'Critical',          team:'Fund Admin IT',      applicationType:'Fund Admin',       serviceImpact:'NAV Calculation',       owner:'ssc-dr@company.com',        rpo:'1 hr'   },
  'Temenos':            { criticality:'Business Critical', team:'Retail Banking',     applicationType:'Core Banking',     serviceImpact:'Full Outage',           owner:'temenos-dr@company.com',    rpo:'5 min'  },
  'BlackRock Aladdin':  { criticality:'Critical',          team:'Risk IT',            applicationType:'Risk',             serviceImpact:'Risk Reporting',        owner:'aladdin-dr@company.com',    rpo:'1 hr'   },
  'Numerix':            { criticality:'High',              team:'Analytics IT',       applicationType:'Analytics',        serviceImpact:'Pricing Degraded',      owner:'numerix-dr@company.com',    rpo:'1 hr'   },
  'Markit EDM':         { criticality:'High',              team:'Data Management',    applicationType:'Reference Data',   serviceImpact:'Data Quality',          owner:'markit-dr@company.com',     rpo:'1 hr'   },
  'Asset Control':      { criticality:'High',              team:'Data Management',    applicationType:'Reference Data',   serviceImpact:'Data Quality',          owner:'asset-ctrl@company.com',    rpo:'1 hr'   },
  'Golden Source':      { criticality:'High',              team:'MDM Team',           applicationType:'MDM',              serviceImpact:'Master Data Quality',   owner:'golden-src@company.com',    rpo:'1 hr'   },
  'MFT Gateway':        { criticality:'Medium',            team:'Integration IT',     applicationType:'File Transfer',    serviceImpact:'File Transfers Halted', owner:'mft-ops@company.com',       rpo:'2 hr'   },
  'SFTP Server':        { criticality:'Medium',            team:'Integration IT',     applicationType:'File Transfer',    serviceImpact:'File Transfers Halted', owner:'sftp-ops@company.com',      rpo:'2 hr'   },
  'CLS Settlement':     { criticality:'Business Critical', team:'Settlement IT',      applicationType:'Settlement',       serviceImpact:'FX Settlement',         owner:'cls-ops@company.com',       rpo:'5 min'  },
  'Sophis':             { criticality:'High',              team:'Risk IT',            applicationType:'Risk',             serviceImpact:'Risk Calc Disruption',  owner:'sophis-dr@company.com',     rpo:'30 min' },
  'RiskWatch':          { criticality:'Medium',            team:'Risk IT',            applicationType:'Risk',             serviceImpact:'Risk Reporting',        owner:'riskwatch@company.com',     rpo:'2 hr'   },
  'Informatica MDM':    { criticality:'Medium',            team:'MDM Team',           applicationType:'MDM',              serviceImpact:'Data Quality',          owner:'informatica@company.com',   rpo:'2 hr'   },
  'Quantifi':           { criticality:'Medium',            team:'Analytics IT',       applicationType:'Analytics',        serviceImpact:'Pricing Degraded',      owner:'quantifi-dr@company.com',   rpo:'2 hr'   },
  'Linedata Longview':  { criticality:'Medium',            team:'Asset Mgmt IT',      applicationType:'Asset Mgmt',       serviceImpact:'Portfolio Mgmt',        owner:'linedata-dr@company.com',   rpo:'1 hr'   },
  'Imagine Software':   { criticality:'Low',               team:'Risk IT',            applicationType:'Risk',             serviceImpact:'Risk Analytics',        owner:'imagine-dr@company.com',    rpo:'4 hr'   },
  'Torstone Inferno':   { criticality:'Medium',            team:'Post-Trade IT',      applicationType:'Post-Trade',       serviceImpact:'Post-Trade Ops',        owner:'torstone-dr@company.com',   rpo:'1 hr'   },
  'Triple Point CTRM':  { criticality:'Medium',            team:'Commodities IT',     applicationType:'Commodities',      serviceImpact:'Commodity Mgmt',        owner:'triplepoint@company.com',   rpo:'1 hr'   },
  'SunGard Adaptiv':    { criticality:'High',              team:'Risk IT',            applicationType:'Risk',             serviceImpact:'Credit Risk',           owner:'sungard-dr@company.com',    rpo:'30 min' },
  'Euroclear':          { criticality:'Business Critical', team:'Settlement IT',      applicationType:'Settlement',       serviceImpact:'Securities Settlement', owner:'euroclear-dr@company.com',  rpo:'5 min'  },
  'FinancialCAD':       { criticality:'Low',               team:'Analytics IT',       applicationType:'Analytics',        serviceImpact:'Pricing Degraded',      owner:'fincad-dr@company.com',     rpo:'4 hr'   },
  'Report Portal':      { criticality:'Low',               team:'BI Team',            applicationType:'Reporting',        serviceImpact:'Reporting Unavailable', owner:'reports-dr@company.com',    rpo:'4 hr'   },
}
