import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Probe isolation (PROBE_NO_HMR=1): screening probes serve a FROZEN app.
  // Disable both HMR and the underlying watcher. Besides preventing a
  // concurrent edit from mutating a 15-minute movie run, this keeps isolated
  // probes independent of the machine-wide inotify budget used by normal dev
  // servers. Normal development retains Vite's default watcher + HMR.
  server: process.env.PROBE_NO_HMR === '1'
    ? { hmr: false, watch: null }
    : {},
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', '.chrome-smoke/**']
  }
})
