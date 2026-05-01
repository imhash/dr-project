/**
 * Runtime configuration loader.
 *
 * Reads /config.json (served verbatim from public/ → dist/).
 * This file is never bundled, so customers can edit dist/config.json
 * without rebuilding the app.
 *
 * Defaults are used if a key is missing, so the file can be kept minimal.
 */

const DEFAULTS = {
  ctmApiBase:        '/ctm-api',
  ctmServer:         '',
  useMock:           false,
  refreshIntervalMs: 30_000,
  jobsLimit:         null,
  customerName:      '',
  environmentLabel:  'Live',
  appMetadata:       {},
  _appMetadataDefaults: {
    criticality:     'inferred',
    applicationType: 'Internal',
    serviceImpact:   'Full Outage',
    readinessImpact: 'Read Only',
  },
}

let _cfg = null

export async function loadConfig() {
  if (_cfg) return _cfg
  try {
    const res = await fetch('/config.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    _cfg = { ...DEFAULTS, ...json }
    // Merge nested defaults separately so partial overrides don't wipe sub-keys
    _cfg._appMetadataDefaults = { ...DEFAULTS._appMetadataDefaults, ...(json._appMetadataDefaults ?? {}) }
  } catch (err) {
    console.warn('[config] Failed to load /config.json — using defaults:', err.message)
    _cfg = { ...DEFAULTS }
  }
  return _cfg
}

/** Synchronous accessor — only valid after loadConfig() resolves. */
export function getConfig() {
  return _cfg ?? { ...DEFAULTS }
}

/**
 * Returns the report metadata for a given app name and phase key.
 * Checks appMetadata[appName] first, then _appMetadataDefaults.
 * criticality 'inferred' means the caller should infer from RTO target.
 */
export function getAppMeta(appName, phaseKey) {
  const cfg      = getConfig()
  const meta     = (cfg.appMetadata ?? {})[appName] ?? {}
  const defaults = cfg._appMetadataDefaults ?? DEFAULTS._appMetadataDefaults

  const isReadiness   = phaseKey === 'readiness'
  const serviceImpact = meta.serviceImpact
    ?? (isReadiness ? defaults.readinessImpact : defaults.serviceImpact)

  return {
    criticality:     meta.criticality     ?? defaults.criticality,
    applicationType: meta.applicationType ?? defaults.applicationType,
    serviceImpact,
  }
}
