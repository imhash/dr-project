import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration — Control-M Resiliency Dashboard
 *
 * Environment variables (set in .env or .env.local):
 *
 *   VITE_CTM_API_URL      Base URL for Control-M Automation API proxy.
 *                         Default: '/ctm-api'  (proxied below — do NOT change
 *                         unless you want to hit the API directly from the browser)
 *
 *   VITE_CTM_API_KEY      API key for x-api-key authentication.
 *                         Obtain from Control-M SaaS portal → API Tokens.
 *
 *   VITE_CTM_SERVER       Default server name filter for job status queries.
 *                         e.g. 'PROD'  →  /run/jobs/status?limit=1000&server=PROD
 *                         Leave empty to fetch all servers.
 *
 *   VITE_USE_MOCK         Set to 'true' to use local mock data (no live API calls).
 *                         Useful for offline development / demos.
 *
 * Proxy target options:
 *   Production SaaS:  https://se-preprod-aapi.us1.controlm.com
 *   Demo environment: https://ctmawsdemoprod.vse.bmc.com
 *
 * The proxy rewrites:
 *   /ctm-api/<path>  →  https://<target>/automation-api/<path>
 */
export default defineConfig(({ mode }) => {
  // Load env so we can read VITE_ vars during config resolution (optional)
  const env = loadEnv(mode, process.cwd(), '')

  const ctmTarget = env.VITE_CTM_PROXY_TARGET

  return {
    plugins: [react()],

    // ── Dev server ────────────────────────────────────────────────────────────
    server: {
      port: 3000,
      strictPort: false,

      proxy: !ctmTarget ? {} : {
        /**
         * /ctm-api/**  →  <ctmTarget>/automation-api/**
         *
         * All browser requests to /ctm-api are forwarded here so the
         * x-api-key header is sent cross-origin without CORS issues.
         */
        '/ctm-api': {
          target:       ctmTarget,
          changeOrigin: true,
          secure:       false,   // allow self-signed / internal CA certs (demo + on-prem CTM)
          rewrite:      (path) => path.replace(/^\/ctm-api/, '/automation-api'),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('[ctm-proxy] error:', err.message)
            })
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log(`[ctm-proxy] ${req.method} ${req.url}  →  ${ctmTarget}${proxyReq.path}`)
            })
          },
        },
      },
    },

    // ── Preview server (vite preview) ────────────────────────────────────────
    preview: {
      port: 4173,
    },

    // ── Build ─────────────────────────────────────────────────────────────────
    build: {
      outDir:         'dist',
      sourcemap:      mode !== 'production',
      chunkSizeWarningLimit: 600,  // kB — suppress warnings for recharts / lucide bundles
    },

    // ── Env variable prefix exposed to client code ───────────────────────────
    // Only variables prefixed with VITE_ are exposed (Vite default).
    // This is just a reminder — no change needed.
    envPrefix: 'VITE_',
  }
})
