// Mock data simulating Control-M Automation API responses

const now  = Date.now()
const ago  = (mins) => new Date(now - mins * 60_000).toISOString()
const from = (mins) => new Date(now + mins * 60_000).toISOString()

function phase(overrides) {
  return {
    jobId: null, name: null, folder: null, status: 'Executing', held: false,
    startTimeISO: null, endTimeISO: null, estEndISO: null,
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

// ─── CRM Readiness — 2 folder runs ───────────────────────────────────────────
const crmFolderRuns = [
  folderRun({
    runId: 'IN01:14ff5-R1', runNo: 1,
    folder: 'mha_DRM_CRM_PRE_CHECKS',
    status: 'Ended OK',
    startTimeISO: ago(6), endTimeISO: ago(3),
    steps: [
      step({ jobId: 'IN01:14ff5-01', name: 'CHECK-DB-CONNECTIVITY',    status: 'Ended OK',     startTimeISO: ago(6), endTimeISO: ago(5), duration: '00:01:02', log: [logLine(ago(6),'INFO','Connecting to DR Oracle 10.20.1.45:1521'), logLine(ago(5),'SUCCESS','Connected. Latency: 4ms')] }),
      step({ jobId: 'IN01:14ff5-02', name: 'VALIDATE-SCHEMA-VERSION',  status: 'Ended OK',     startTimeISO: ago(5), endTimeISO: ago(4), duration: '00:00:48', log: [logLine(ago(5),'INFO','Comparing schema PROD vs DR'), logLine(ago(4),'SUCCESS','Schema v42.3.1 — match confirmed')] }),
      step({ jobId: 'IN01:14ff5-03', name: 'CHECK-APP-SERVICES',       status: 'Ended OK',     startTimeISO: ago(4), endTimeISO: ago(3), duration: '00:01:15', log: [logLine(ago(4),'INFO','Pinging 6 application services'), logLine(ago(3),'SUCCESS','6/6 services healthy')] }),
    ],
    log: [
      logLine(ago(6), 'INFO',    'Folder run 1 started: PRE_CHECKS'),
      logLine(ago(5), 'SUCCESS', 'DB connectivity: PASS'),
      logLine(ago(4), 'SUCCESS', 'Schema validation: PASS'),
      logLine(ago(3), 'SUCCESS', 'App services: PASS — folder completed OK'),
    ],
  }),
  folderRun({
    runId: 'IN01:14ff5-R2', runNo: 2,
    folder: 'mha_DRM_CRM_DATA_INTEGRITY',
    status: 'Executing',
    startTimeISO: ago(2), endTimeISO: null,
    steps: [
      step({ jobId: 'IN01:14ff5-04', name: 'VERIFY-DATA-REPLICATION', status: 'Executing',    startTimeISO: ago(2), endTimeISO: null,   duration: null,       log: [logLine(ago(2),'INFO','Replication lag check started'), logLine(ago(1),'INFO','DataGuard lag: 14s'), logLine(ago(0),'WARN','Lag >10s threshold — monitoring')] }),
      step({ jobId: 'IN01:14ff5-05', name: 'CHECK-NETWORK-ROUTES',   status: 'Waiting',      startTimeISO: null,   endTimeISO: null,   duration: null,       log: [] }),
      step({ jobId: 'IN01:14ff5-06', name: 'VALIDATE-SSL-CERTS',     status: 'Waiting',      startTimeISO: null,   endTimeISO: null,   duration: null,       log: [] }),
    ],
    log: [
      logLine(ago(2), 'INFO', 'Folder run 2 started: DATA_INTEGRITY'),
      logLine(ago(1), 'WARN', 'DataGuard replication lag: 14s (threshold: 10s)'),
      logLine(ago(0), 'INFO', 'Network routes and SSL checks: pending'),
    ],
  }),
]

// ─── Trading Portal Readiness — 2 folder runs ────────────────────────────────
const tradingFolderRuns = [
  folderRun({
    runId: 'IN01:14ffx-R1', runNo: 1,
    folder: 'mha_DRM_TRD_MARKET_DATA',
    status: 'Ended OK',
    startTimeISO: ago(5), endTimeISO: ago(3),
    steps: [
      step({ jobId: 'IN01:14ffx-01', name: 'CHECK-MARKET-FEED',      status: 'Ended OK',     startTimeISO: ago(5), endTimeISO: ago(4), duration: '00:00:55', log: [logLine(ago(5),'INFO','Testing Bloomberg feed'), logLine(ago(4),'SUCCESS','Feed connected. Latency: 2ms')] }),
      step({ jobId: 'IN01:14ffx-02', name: 'CHECK-RISK-ENGINE',      status: 'Ended OK',     startTimeISO: ago(4), endTimeISO: ago(3), duration: '00:01:08', log: [logLine(ago(4),'INFO','Risk engine health check'), logLine(ago(3),'SUCCESS','VaR test passed')] }),
    ],
    log: [
      logLine(ago(5), 'INFO',    'Folder run 1 started: MARKET_DATA'),
      logLine(ago(4), 'SUCCESS', 'Market feed: PASS'),
      logLine(ago(3), 'SUCCESS', 'Risk engine: PASS — folder completed OK'),
    ],
  }),
  folderRun({
    runId: 'IN01:14ffx-R2', runNo: 2,
    folder: 'mha_DRM_TRD_SYSTEMS',
    status: 'Ended Not OK',
    startTimeISO: ago(3), endTimeISO: ago(0),
    steps: [
      step({ jobId: 'IN01:14ffx-03', name: 'VALIDATE-POSITION-DATA', status: 'Ended Not OK', startTimeISO: ago(3), endTimeISO: ago(2), duration: '00:01:22', log: [logLine(ago(3),'INFO','Comparing position records PROD vs DR'), logLine(ago(2),'ERROR','Mismatch: PROD=14,382 DR=14,201. Delta=181 records')] }),
      step({ jobId: 'IN01:14ffx-04', name: 'VERIFY-OMS-GATEWAY',    status: 'Ended Not OK', startTimeISO: ago(2), endTimeISO: ago(1), duration: '00:00:38', log: [logLine(ago(2),'INFO','Testing FIX gateway 10.20.2.88:4001'), logLine(ago(1),'ERROR','Connection refused. Failover OMS also unreachable.')] }),
      step({ jobId: 'IN01:14ffx-05', name: 'CHECK-SETTLEMENT-SVC',  status: 'Executing',    startTimeISO: ago(0), endTimeISO: null,   duration: null,       log: [logLine(ago(0),'INFO','Settlement service check in progress')] }),
    ],
    log: [
      logLine(ago(3), 'INFO',  'Folder run 2 started: SYSTEMS'),
      logLine(ago(2), 'ERROR', 'FAIL: Position data mismatch (181 records delta)'),
      logLine(ago(1), 'ERROR', 'FAIL: OMS FIX gateway unreachable'),
      logLine(ago(0), 'INFO',  'Settlement service check in progress...'),
    ],
  }),
]

// ─── SAP ERP Readiness — 3 folder runs (all OK) ──────────────────────────────
const sapFolderRuns = [
  folderRun({
    runId: 'IN01:1500b-R1', runNo: 1,
    folder: 'mha_DRM_SAP_INSTANCE',
    status: 'Ended OK',
    startTimeISO: ago(25), endTimeISO: ago(20),
    steps: [
      step({ jobId: 'IN01:1500b-01', name: 'CHECK-SAP-INSTANCE',      status: 'Ended OK', startTimeISO: ago(25), endTimeISO: ago(23), duration: '00:02:10', log: [logLine(ago(25),'INFO','SAP DR instance health check'), logLine(ago(23),'SUCCESS','SAP ABAP stack responding SM51 OK')] }),
      step({ jobId: 'IN01:1500b-02', name: 'VALIDATE-HANA-REPLICATION',status: 'Ended OK', startTimeISO: ago(23), endTimeISO: ago(20), duration: '00:03:05', log: [logLine(ago(23),'INFO','HANA system replication status check'), logLine(ago(22),'INFO','Mode: SYNC. Status: ACTIVE'), logLine(ago(20),'SUCCESS','Replication lag: 0s')] }),
    ],
    log: [
      logLine(ago(25), 'INFO',    'Folder run 1 started: SAP_INSTANCE'),
      logLine(ago(23), 'SUCCESS', 'SAP instance: PASS'),
      logLine(ago(20), 'SUCCESS', 'HANA replication: PASS (lag 0s) — folder completed OK'),
    ],
  }),
  folderRun({
    runId: 'IN01:1500b-R2', runNo: 2,
    folder: 'mha_DRM_SAP_INTERFACES',
    status: 'Ended OK',
    startTimeISO: ago(20), endTimeISO: ago(12),
    steps: [
      step({ jobId: 'IN01:1500b-03', name: 'CHECK-RFC-CONNECTIONS',   status: 'Ended OK', startTimeISO: ago(20), endTimeISO: ago(17), duration: '00:03:00', log: [logLine(ago(20),'INFO','Testing 12 RFC destinations'), logLine(ago(17),'SUCCESS','12/12 RFC connections healthy')] }),
      step({ jobId: 'IN01:1500b-04', name: 'CHECK-PIIPO-CHANNELS',   status: 'Ended OK', startTimeISO: ago(17), endTimeISO: ago(12), duration: '00:05:12', log: [logLine(ago(17),'INFO','PI/PO integration channels check'), logLine(ago(12),'SUCCESS','24/24 channels active')] }),
    ],
    log: [
      logLine(ago(20), 'INFO',    'Folder run 2 started: SAP_INTERFACES'),
      logLine(ago(17), 'SUCCESS', 'RFC connections: PASS (12/12)'),
      logLine(ago(12), 'SUCCESS', 'PI/PO channels: PASS (24/24) — folder completed OK'),
    ],
  }),
  folderRun({
    runId: 'IN01:1500b-R3', runNo: 3,
    folder: 'mha_DRM_SAP_BATCH',
    status: 'Ended OK',
    startTimeISO: ago(12), endTimeISO: ago(5),
    steps: [
      step({ jobId: 'IN01:1500b-05', name: 'VALIDATE-BATCH-JOBS',    status: 'Ended OK', startTimeISO: ago(12), endTimeISO: ago(9),  duration: '00:03:00', log: [logLine(ago(12),'INFO','SM36 batch schedule check'), logLine(ago(9),'SUCCESS','86 jobs transferred to DR')] }),
      step({ jobId: 'IN01:1500b-06', name: 'CHECK-PRINT-SPOOL',      status: 'Ended OK', startTimeISO: ago(9),  endTimeISO: ago(5),  duration: '00:04:00', log: [logLine(ago(9),'INFO','SPAD print spool check'), logLine(ago(5),'SUCCESS','8/8 printers active')] }),
    ],
    log: [
      logLine(ago(12), 'INFO',    'Folder run 3 started: SAP_BATCH'),
      logLine(ago(9),  'SUCCESS', 'Batch jobs: PASS (86 transferred)'),
      logLine(ago(5),  'SUCCESS', 'Print spool: PASS — folder completed OK. ALL CHECKS PASSED.'),
    ],
  }),
]

// ─── Core Banking — 3 folder runs, 1 has failure ─────────────────────────────
const cbsFolderRuns = [
  folderRun({
    runId: 'IN01:1501b-R1', runNo: 1,
    folder: 'mha_DRM_CBS_CORE',
    status: 'Ended OK',
    startTimeISO: ago(35), endTimeISO: ago(24),
    steps: [
      step({ jobId: 'IN01:1501b-01', name: 'CHECK-T24-CONNECTIVITY', status: 'Ended OK', startTimeISO: ago(35), endTimeISO: ago(32), duration: '00:03:00', log: [logLine(ago(35),'INFO','T24 DR instance health check'), logLine(ago(32),'SUCCESS','T24 responding on port 9099')] }),
      step({ jobId: 'IN01:1501b-02', name: 'VALIDATE-EOD-POSITION',  status: 'Ended OK', startTimeISO: ago(32), endTimeISO: ago(24), duration: '00:08:00', log: [logLine(ago(32),'INFO','Comparing GL balances PROD vs DR'), logLine(ago(24),'SUCCESS','GL balances match. Total: $4.2B')] }),
    ],
    log: [
      logLine(ago(35), 'INFO',    'Folder run 1 started: CBS_CORE'),
      logLine(ago(32), 'SUCCESS', 'T24 connectivity: PASS'),
      logLine(ago(24), 'SUCCESS', 'EOD GL position: PASS — folder completed OK'),
    ],
  }),
  folderRun({
    runId: 'IN01:1501b-R2', runNo: 2,
    folder: 'mha_DRM_CBS_PAYMENTS',
    status: 'Ended Not OK',
    startTimeISO: ago(24), endTimeISO: ago(12),
    steps: [
      step({ jobId: 'IN01:1501b-03', name: 'CHECK-SWIFT-GATEWAY',    status: 'Ended Not OK', startTimeISO: ago(24), endTimeISO: ago(20), duration: '00:04:00', log: [logLine(ago(24),'INFO','SWIFT gateway DR connectivity test'), logLine(ago(22),'WARN','Primary SWIFT endpoint timeout'), logLine(ago(20),'ERROR','FAIL: DR BIC not activated. Contact SWIFT CSC.')] }),
      step({ jobId: 'IN01:1501b-04', name: 'CHECK-ATM-SWITCH',       status: 'Ended OK',     startTimeISO: ago(20), endTimeISO: ago(16), duration: '00:04:00', log: [logLine(ago(20),'INFO','ATM switch failover test'), logLine(ago(16),'SUCCESS','248 ATMs redirected to DR')] }),
      step({ jobId: 'IN01:1501b-05', name: 'CHECK-MOBILE-BANKING',   status: 'Ended OK',     startTimeISO: ago(16), endTimeISO: ago(12), duration: '00:04:00', log: [logLine(ago(16),'INFO','Mobile banking API gateway check'), logLine(ago(12),'SUCCESS','API gateway active. Push notifications OK')] }),
    ],
    log: [
      logLine(ago(24), 'INFO',  'Folder run 2 started: CBS_PAYMENTS'),
      logLine(ago(20), 'ERROR', 'FAIL: SWIFT DR BIC not activated'),
      logLine(ago(16), 'SUCCESS','ATM switch: PASS (248 ATMs)'),
      logLine(ago(12), 'SUCCESS','Mobile banking: PASS — folder completed with 1 failure'),
    ],
  }),
  folderRun({
    runId: 'IN01:1501b-R3', runNo: 3,
    folder: 'mha_DRM_CBS_REPORTING',
    status: 'Ended OK',
    startTimeISO: ago(12), endTimeISO: ago(4),
    steps: [
      step({ jobId: 'IN01:1501b-06', name: 'VALIDATE-CUSTOMER-DATA', status: 'Ended OK', startTimeISO: ago(12), endTimeISO: ago(8),  duration: '00:04:00', log: [logLine(ago(12),'INFO','Customer record count validation'), logLine(ago(8),'SUCCESS','1,247,832 records verified')] }),
      step({ jobId: 'IN01:1501b-07', name: 'CHECK-REGULATORY-RPT',   status: 'Ended OK', startTimeISO: ago(8),  endTimeISO: ago(4),  duration: '00:04:00', log: [logLine(ago(8),'INFO','CBB reporting gateway check'), logLine(ago(4),'SUCCESS','Reporting gateway accessible')] }),
    ],
    log: [
      logLine(ago(12), 'INFO',    'Folder run 3 started: CBS_REPORTING'),
      logLine(ago(8),  'SUCCESS', 'Customer data: PASS (1.2M records)'),
      logLine(ago(4),  'SUCCESS', 'Regulatory reporting: PASS — folder completed OK'),
    ],
  }),
]

// ─── HR Portal — 1 folder run ────────────────────────────────────────────────
const hrFolderRuns = [
  folderRun({
    runId: 'IN01:1502b-R1', runNo: 1,
    folder: 'mha_DRM_HR_CHECKS',
    status: 'Ended OK',
    startTimeISO: ago(12), endTimeISO: ago(4),
    steps: [
      step({ jobId: 'IN01:1502b-01', name: 'CHECK-HRMS-INSTANCE',  status: 'Ended OK', startTimeISO: ago(12), endTimeISO: ago(10), duration: '00:02:00', log: [logLine(ago(12),'INFO','HRMS DR instance check'), logLine(ago(10),'SUCCESS','HRMS web portal accessible')] }),
      step({ jobId: 'IN01:1502b-02', name: 'VALIDATE-PAYROLL-DATA',status: 'Ended OK', startTimeISO: ago(10), endTimeISO: ago(7),  duration: '00:03:00', log: [logLine(ago(10),'INFO','Payroll record validation'), logLine(ago(7),'SUCCESS','3,412 employee records verified')] }),
      step({ jobId: 'IN01:1502b-03', name: 'CHECK-AD-SYNC',        status: 'Ended OK', startTimeISO: ago(7),  endTimeISO: ago(4),  duration: '00:03:00', log: [logLine(ago(7),'INFO','Active Directory sync status'), logLine(ago(4),'SUCCESS','AD sync current — last sync 4 min ago')] }),
    ],
    log: [
      logLine(ago(12), 'INFO',    'Folder run 1 started: HR_CHECKS'),
      logLine(ago(10), 'SUCCESS', 'HRMS instance: PASS'),
      logLine(ago(7),  'SUCCESS', 'Payroll data: PASS (3,412 records)'),
      logLine(ago(4),  'SUCCESS', 'AD sync: PASS — folder completed OK. ALL CHECKS PASSED.'),
    ],
  }),
]

// ─── Reporting Suite — 1 folder run with partial failure ─────────────────────
const rptFolderRuns = [
  folderRun({
    runId: 'IN01:1503b-R1', runNo: 1,
    folder: 'mha_DRM_RPT_CHECKS',
    status: 'Ended Not OK',
    startTimeISO: ago(10), endTimeISO: ago(2),
    steps: [
      step({ jobId: 'IN01:1503b-01', name: 'CHECK-TABLEAU-SERVER',   status: 'Ended OK',     startTimeISO: ago(10), endTimeISO: ago(8), duration: '00:02:00', log: [logLine(ago(10),'INFO','Tableau DR server check'), logLine(ago(8),'SUCCESS','Tableau Server 2024.1 responding')] }),
      step({ jobId: 'IN01:1503b-02', name: 'VALIDATE-DATA-SOURCES',  status: 'Ended Not OK', startTimeISO: ago(8),  endTimeISO: ago(5), duration: '00:03:00', log: [logLine(ago(8),'INFO','Testing 14 data source connections'), logLine(ago(5),'ERROR','3/14 unreachable: DW_PROD_REPLICA, MART_FINANCE, MART_RISK')] }),
      step({ jobId: 'IN01:1503b-03', name: 'CHECK-SCHEDULED-REPORTS',status: 'Ended OK',     startTimeISO: ago(5),  endTimeISO: ago(2), duration: '00:03:00', log: [logLine(ago(5),'INFO','Scheduled report transfer check'), logLine(ago(2),'SUCCESS','87 reports transferred to DR Tableau')] }),
    ],
    log: [
      logLine(ago(10), 'INFO',    'Folder run 1 started: RPT_CHECKS'),
      logLine(ago(8),  'SUCCESS', 'Tableau server: PASS'),
      logLine(ago(5),  'ERROR',   'FAIL: 3/14 data sources unreachable'),
      logLine(ago(2),  'SUCCESS', 'Scheduled reports: PASS — folder completed with 1 failure'),
    ],
  }),
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
    app: 'CRM', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 0, executingPhases: 2, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 0,
    phases: {
      switchover: phase({ jobId: 'IN01:14fed', name: 'mha-DRM-CRM-MASTER-SWITCHOVER', folder: 'mha-DRM-CRM-MASTER-SWITCHOVER', status: 'Executing', startTimeISO: ago(7), estEndISO: from(3), rtoTargetMins: 10, elapsedMins: 7, rtoPct: 70, rtoStatus: 'At Risk' }),
      switchback: null,
      readiness: phase({ jobId: 'IN01:14ff5', name: 'mha_DRM_CRM_READINESS', folder: 'mha_DRM_CRM_READINESS', status: 'Executing', startTimeISO: ago(6), estEndISO: from(46), rtoTargetMins: 52, elapsedMins: 6, rtoPct: 12, rtoStatus: 'On Track', ...rdxCounts(crmFolderRuns), folderRuns: crmFolderRuns }),
    },
  },
  {
    app: 'Trading Portal', server: 'IN01',
    totalPhases: 3, completedPhases: 0, failedPhases: 0, executingPhases: 3, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'On Track', completionPct: 0,
    phases: {
      switchover: phase({ jobId: 'IN01:14fct', name: 'mha-DRM-MASTER-SWITCHOVER', folder: 'mha-DRM-MASTER-SWITCHOVER', status: 'Executing', startTimeISO: ago(13), estEndISO: from(3), rtoTargetMins: 16, elapsedMins: 13, rtoPct: 81, rtoStatus: 'At Risk' }),
      switchback: phase({ jobId: 'IN01:14fdl', name: 'ARB_DRM_MASTER_SWITCHBACK', folder: 'ARB_DRM_MASTER_SWITCHBACK', status: 'Executing', startTimeISO: ago(9), estEndISO: from(47), rtoTargetMins: 56, elapsedMins: 9, rtoPct: 16, rtoStatus: 'On Track' }),
      readiness: phase({ jobId: 'IN01:14ffx', name: 'mha_DRM_TRADING-PORTAL_READINESS', folder: 'mha_DRM_TRADING-PORTAL_READINESS', startTimeISO: ago(5), endTimeISO: ago(0), rtoTargetMins: 51, elapsedMins: 5, rtoPct: 10, rtoStatus: 'On Track', ...rdxCounts(tradingFolderRuns), folderRuns: tradingFolderRuns }),
    },
  },
  {
    app: 'SAP ERP', server: 'IN01',
    totalPhases: 2, completedPhases: 2, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: phase({ jobId: 'IN01:1500a', name: 'mha-DRM-SAP-MASTER-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(40), endTimeISO: ago(22), rtoTargetMins: 30, elapsedMins: 18, rtoPct: 60, rtoStatus: 'On Track' }),
      switchback: null,
      readiness: phase({ jobId: 'IN01:1500b', name: 'mha_DRM_SAP_READINESS', startTimeISO: ago(25), endTimeISO: ago(5), rtoTargetMins: 60, elapsedMins: 20, rtoPct: 33, rtoStatus: 'On Track', ...rdxCounts(sapFolderRuns), folderRuns: sapFolderRuns }),
    },
  },
  {
    app: 'Core Banking', server: 'IN01',
    totalPhases: 2, completedPhases: 0, failedPhases: 1, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 71,
    phases: {
      switchover: phase({ jobId: 'IN01:1501a', name: 'mha-DRM-CBS-MASTER-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(45), endTimeISO: ago(20), rtoTargetMins: 25, elapsedMins: 25, rtoPct: 100, rtoStatus: 'Met' }),
      switchback: null,
      readiness: phase({ jobId: 'IN01:1501b', name: 'mha_DRM_CBS_READINESS', startTimeISO: ago(35), endTimeISO: ago(4), rtoTargetMins: 45, elapsedMins: 31, rtoPct: 69, rtoStatus: 'On Track', ...rdxCounts(cbsFolderRuns), folderRuns: cbsFolderRuns }),
    },
  },
  {
    app: 'HR Portal', server: 'IN01',
    totalPhases: 1, completedPhases: 1, failedPhases: 0, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'Completed', drillHealth: 'On Track', completionPct: 100,
    phases: {
      switchover: phase({ jobId: 'IN01:1502a', name: 'mha-DRM-HR-SWITCHOVER', status: 'Ended OK', startTimeISO: ago(20), endTimeISO: ago(10), rtoTargetMins: 15, elapsedMins: 10, rtoPct: 67, rtoStatus: 'On Track' }),
      switchback: null,
      readiness: phase({ jobId: 'IN01:1502b', name: 'mha_DRM_HR_READINESS', startTimeISO: ago(12), endTimeISO: ago(4), rtoTargetMins: 20, elapsedMins: 8, rtoPct: 40, rtoStatus: 'On Track', ...rdxCounts(hrFolderRuns), folderRuns: hrFolderRuns }),
    },
  },
  {
    app: 'Reporting Suite', server: 'IN01',
    totalPhases: 1, completedPhases: 0, failedPhases: 1, executingPhases: 0, breachedPhases: 0,
    overallStatus: 'In Progress', drillHealth: 'At Risk', completionPct: 67,
    phases: {
      switchover: null,
      switchback: null,
      readiness: phase({ jobId: 'IN01:1503b', name: 'mha_DRM_REPORTING_READINESS', startTimeISO: ago(10), endTimeISO: ago(2), rtoTargetMins: 30, elapsedMins: 8, rtoPct: 27, rtoStatus: 'On Track', ...rdxCounts(rptFolderRuns), folderRuns: rptFolderRuns }),
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
  'CRM':             { criticality: 'High',     team: 'CRM Team',     applicationType: 'Customer-Facing', serviceImpact: 'Customer Operations', owner: 'crm-ops@company.com'     },
  'Trading Portal':  { criticality: 'Critical', team: 'Trading Ops',  applicationType: 'Trading',         serviceImpact: 'Revenue Critical',    owner: 'trading-dr@company.com'  },
  'SAP ERP':         { criticality: 'Critical', team: 'ERP Team',     applicationType: 'ERP',             serviceImpact: 'Full Business Ops',   owner: 'sap-basis@company.com'   },
  'Core Banking':    { criticality: 'Critical', team: 'Core Banking', applicationType: 'Banking',         serviceImpact: 'Full Outage',         owner: 'cbs-ops@company.com'     },
  'HR Portal':       { criticality: 'Medium',   team: 'HR IT',        applicationType: 'Internal',        serviceImpact: 'Employee Services',   owner: 'hr-it@company.com'       },
  'Reporting Suite': { criticality: 'Low',      team: 'BI Team',      applicationType: 'Analytics',       serviceImpact: 'Reporting Degraded',  owner: 'bi-team@company.com'     },
}
