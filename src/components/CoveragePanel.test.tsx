import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DashboardMeta } from '../../shared/types'
import { CoveragePanel } from './CoveragePanel'

const meta: DashboardMeta = {
  schemaVersion: 1,
  range: '6m',
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-07-01T00:00:00.000Z',
  generatedAt: '2026-07-01T00:00:00.000Z',
  mode: 'demo',
  privacy: 'public-demo',
  subject: { login: 'synthetic-builder' },
  coverageScore: 100,
  coverage: [],
  warnings: [],
}

describe('CoveragePanel', () => {
  afterEach(cleanup)

  it('states the hosted synthetic boundary without implying personal coverage', () => {
    render(<CoveragePanel meta={meta} />)

    expect(screen.getByRole('heading', { name: 'Complete synthetic evidence' })).toBeInTheDocument()
    expect(screen.getByText(/does not represent a real github account/i)).toBeInTheDocument()
    expect(screen.getByText(/no account, token, private repository/i)).toBeInTheDocument()
  })
})
