import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Insight, InsightOrder } from '../../shared/types'
import { InsightStack } from './InsightStack'

function insight(order: InsightOrder): Insight {
  return {
    id: `insight-${order}`,
    order,
    category: 'focus',
    eyebrow: `Level ${order}`,
    title: `Insight ${order}`,
    body: 'A bounded interpretation.',
    ...(order === 3
      ? { reflectionQuestion: 'What evidence would change this interpretation?' }
      : {}),
    evidence: ['One supporting signal'],
    caveat: 'One visible limitation.',
    confidence: 'high',
    score: 1,
  }
}

describe('InsightStack', () => {
  afterEach(cleanup)

  it('explains evidence levels and reports filtered results', async () => {
    const user = userEvent.setup()
    render(<InsightStack insights={[insight(1), insight(2), insight(3)]} />)

    expect(screen.getByText(/directly counted from the available sources/i)).toBeInTheDocument()
    expect(screen.getByText(/reproducible combination/i)).toBeInTheDocument()
    expect(screen.getByText(/interpretation supported by multiple signals/i)).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: /question to carry forward/i }),
    ).toHaveTextContent('What evidence would change this interpretation?')

    await user.click(screen.getByRole('button', { name: /hypothesis 1/i }))
    expect(screen.getByRole('button', { name: /hypothesis 1/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 3')
    expect(screen.getByRole('heading', { name: 'Insight 3' })).toBeInTheDocument()
    expect(screen.getByText('What evidence would change this interpretation?')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Insight 1' })).not.toBeInTheDocument()
  })
})
