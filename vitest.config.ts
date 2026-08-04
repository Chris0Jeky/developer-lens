import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'shared/**/*.test.ts',
      'server/**/*.test.ts',
      'scripts/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
