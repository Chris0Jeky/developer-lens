import { describe, expect, it } from 'vitest'

import { V2_DEMO_INSIGHTS, V2_DEMO_INSIGHTS_SCHEMA } from './v2Demo.js'

function cloneInsights() {
  return V2_DEMO_INSIGHTS.map((insight) => ({
    ...insight,
    evidence: [...insight.evidence],
  }))
}

describe('V2 demo insight contract', () => {
  it('accepts the canonical observed, derived, and hypothesis sequence', () => {
    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(V2_DEMO_INSIGHTS).success).toBe(true)
  })

  it.each([0, 1])('rejects a reflection question on non-hypothesis insight %i', (index) => {
    const insights = cloneInsights()
    insights[index] = {
      ...insights[index],
      reflectionQuestion: 'What evidence would change this interpretation?',
    }

    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(insights).success).toBe(false)
  })

  it('rejects a question that stays in the third array position after semantic orders move', () => {
    const insights = cloneInsights()
    insights[0] = { ...insights[0], order: 3 }
    insights[2] = { ...insights[2], order: 1 }

    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(insights).success).toBe(false)
  })

  it('requires the hypothesis insight to carry a bounded non-empty reflection question', () => {
    const missingQuestion = cloneInsights()
    delete missingQuestion[2].reflectionQuestion

    const emptyQuestion = cloneInsights()
    emptyQuestion[2] = { ...emptyQuestion[2], reflectionQuestion: '' }

    const oversizedQuestion = cloneInsights()
    oversizedQuestion[2] = { ...oversizedQuestion[2], reflectionQuestion: 'x'.repeat(241) }

    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(missingQuestion).success).toBe(false)
    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(emptyQuestion).success).toBe(false)
    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(oversizedQuestion).success).toBe(false)
  })
})
