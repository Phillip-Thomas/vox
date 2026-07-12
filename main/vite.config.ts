import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Probe isolation (PROBE_NO_HMR=1): screening probes must watch a FROZEN app.
  // With hmr:false Vite never calls handleHMRUpdate (verified in 6.3.5:
  // onHMRUpdate is guarded on it), so a concurrent editing session's file
  // saves cannot push updates/reloads into a 15-minute movie run (the
  // 2026-07-11 full-run stall class). Normal dev keeps HMR.
  server: process.env.PROBE_NO_HMR === '1' ? { hmr: false } : {},
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.chrome-smoke/**']
  }
})
