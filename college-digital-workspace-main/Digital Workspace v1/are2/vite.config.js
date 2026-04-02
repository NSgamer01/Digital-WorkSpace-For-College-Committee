import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    headers: {
      // Allow Google OAuth popup to communicate back to the opener.
      // Without this: "COOP policy would block the window.closed call"
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',

      // NOTE: Do NOT set Content-Security-Policy here or in index.html.
      // Google's GIS/gapi scripts load dozens of sub-resources from
      // internal domains (gstatic.com, googleusercontent.com, etc.)
      // that change without notice. A whitelist-based CSP will always
      // break them. For production, use report-only mode first to
      // discover all required domains before enforcing.
    },
  },

  build: {
    rollupOptions: {
      external: ['gapi-script'],
    },
    sourcemap: true,
    target: 'es2020',
  },

  optimizeDeps: {
    exclude: ['gapi-script'],
  },

  envPrefix: 'VITE_',
})
