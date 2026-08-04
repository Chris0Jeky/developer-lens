import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Insight, InsightOrder } from '../../shared/types'
import { V2StoryPath } from './V2StoryPath'

function insight(
  order: InsightOrder,
  overrides: Partial<Pick<Insight, 'confidence' | 'caveat'>> = {},
): Insight {
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
    ...overrides,
  }
}

describe('V2StoryPath', () => {
  afterEach(cleanup)

  it('renders an accessible ordered rail from observed to hypothesis', () => {
    render(<V2StoryPath insights={[
      insight(3, { confidence: 'low', caveat: 'A bounded hypothesis.' }),
      insight(1, { confidence: 'high', caveat: 'A counted signal.' }),
      insight(2, { confidence: 'medium', caveat: 'A reproducible connection.' }),
    ]} />)

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
    expect(path).toHaveTextContent('high confidence · evidence fit')
    expect(path).toHaveTextContent('medium confidence · evidence fit')
    expect(path).toHaveTextContent('low confidence · evidence fit')
    expect(path.querySelector('[data-limit="Lens limit · A bounded hypothesis."]')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /high confidence.*counted signal/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /medium confidence.*reproducible connection/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /low confidence.*bounded hypothesis/i })).toBeInTheDocument()
    expect(screen.getByText(/confidence describes the fit of the available evidence.*not a score about a person/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /read the signal in three careful moves/i })).toBeInTheDocument()
  })

  it('does not invent a step when its validated insight is absent', () => {
    render(<V2StoryPath insights={[insight(1)]} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Derived')).not.toBeInTheDocument()
    expect(screen.queryByText('Hypothesis')).not.toBeInTheDocument()
  })

  it('does not invent a limitation when the insight has no caveat', () => {
    render(<V2StoryPath insights={[insight(2, { caveat: undefined, confidence: 'medium' })]} />)

    expect(screen.getByRole('listitem', { name: /medium confidence.*evidence fit/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /story path/i }).querySelector('.v2-story-path__limit')).not.toBeInTheDocument()
  })
})
