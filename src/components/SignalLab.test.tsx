import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { SignalMetric } from '../../shared/types'
import { SignalLab } from './SignalLab'

const signal: SignalMetric = {
  id: 'flow',
  category: 'flow',
  order: 2,
  label: 'Integration window',
  value: '88%',
  title: 'merged within 24 hours',
  context: '2h median · 9h at p75',
  explanation: 'The tail stays visible.',
  basis: '20 merged PRs',
  formula: 'within-day merges divided by merged PRs',
  caveat: 'Process affects latency.',
  confidence: 'high',
}

describe('SignalLab', () => {
  afterEach(cleanup)

  it('keeps the basis, method, and caveat attached to a signal', async () => {
    const user = userEvent.setup()
    render(<SignalLab signals={[signal]} />)

    expect(screen.getByText('Based on 20 merged PRs')).toBeInTheDocument()
    await user.click(screen.getByText('Method & lens limit'))
    expect(screen.getByText(/within-day merges divided/i)).toBeInTheDocument()
    expect(screen.getByText(/process affects latency/i)).toBeInTheDocument()
  })
})
