import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { canonicalizeWindowsTestTempEnvironment } from './scripts/canonicalTestTempEnvironment.js'

// Storage-v3 requires canonical artifact-root paths. On Windows, TEMP/TMP can
// arrive through an 8.3 short path, so normalize the runner environment before
// Vitest starts workers or imports fixtures. Production path checks stay strict.
canonicalizeWindowsTestTempEnvironment()

// Local Windows runs of the full parallel suite hit worker contention: known-slow
// tests (whole-dashboard render in src/App.test.tsx and dynamic-import storms in
// server/storage/v3Proposal.test.ts) intermittently exceed the 5s default timeout
// even though they pass in isolation, and full runs can OOM the box. The shared-artifact
// lifecycle test in scripts/storeLifecycle.test.ts is explicitly timed at 20s because
// its whole-lifecycle SQLite fixture can also exceed 5s under hosted-run contention.
// Cap workers and widen the timeout only on local Windows; hosted CI (ubuntu) and
// other platforms keep default parallelism and the strict 5s default timeout.
const localWindows = process.platform === 'win32' && !process.env.CI

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    ...(localWindows ? { maxWorkers: 2, testTimeout: 15_000 } : {}),
    include: [
      'shared/**/*.test.ts',
      'server/**/*.test.ts',
      'scripts/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
