import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Insight, InsightOrder } from '../../shared/types'
import { V2StoryPath } from './V2StoryPath'

function insight(order: InsightOrder): Insight {
  return {
    id: `insight-${order}`,
    order,
    category: 'focus',
    eyebrow: `Level ${order}`,
    title: `Insight ${order}`,
    body: 'A bounded interpretation.',
    evidence: [`Evidence headline ${order}`, `Supporting signal ${order}`],
    caveat: 'One visible limitation.',
    confidence: 'high',
    score: 1,
  }
}

describe('V2StoryPath', () => {
  afterEach(cleanup)

  it('renders an accessible ordered rail from observed to hypothesis', () => {
    render(<V2StoryPath insights={[insight(3), insight(1), insight(2)]} />)

    const path = screen.getByRole('region', { name: /story path/i })
    const steps = screen.getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Observed'),
      expect.stringContaining('Derived'),
      expect.stringContaining('Hypothesis'),
    ])
    expect(path).toHaveTextContent('Evidence headline 1')
    expect(path).toHaveTextContent('Evidence headline 2')
    expect(path).toHaveTextContent('Evidence headline 3')
    expect(screen.getByRole('heading', { name: /read the signal in three careful moves/i })).toBeInTheDocument()
  })

  it('does not invent a step when its validated insight is absent', () => {
    render(<V2StoryPath insights={[insight(1)]} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Derived')).not.toBeInTheDocument()
    expect(screen.queryByText('Hypothesis')).not.toBeInTheDocument()
  })
})
