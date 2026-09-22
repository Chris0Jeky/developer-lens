import { describe, expect, it } from 'vitest'

import {
  V2_DEMO_INSIGHTS,
  V2_DEMO_INSIGHTS_SCHEMA,
  V2_DEMO_PAYLOAD,
  V2_DEMO_PAYLOAD_SCHEMA,
} from './v2Demo.js'

const blankQuestions = [
  ['spaces', '   '],
  ['tabs and line breaks', '\t\r\n'],
  ['Unicode spaces', '\u00a0\u2003'],
  ['byte-order-mark whitespace', '\ufeff'],
] as const

describe('V2 reflection question visible-content contract', () => {
  it.each(blankQuestions)('rejects %s in an order-3 insight', (_label, question) => {
    const insights = V2_DEMO_INSIGHTS.map((insight) => ({
      ...insight,
      evidence: [...insight.evidence],
      ...(insight.order === 3 ? { reflectionQuestion: question } : {}),
    }))

    expect(V2_DEMO_INSIGHTS_SCHEMA.safeParse(insights).success).toBe(false)
  })

  it.each(blankQuestions)('rejects %s at the public payload boundary', (_label, question) => {
    const payload = {
      ...V2_DEMO_PAYLOAD,
      insightReflectionQuestions: ['', '', question],
    }

    expect(V2_DEMO_PAYLOAD_SCHEMA.safeParse(payload).success).toBe(false)
  })

  it('keeps valid bounded content unchanged rather than silently normalizing it', () => {
    const question = '  What evidence would change this interpretation?  '
    const payload = V2_DEMO_PAYLOAD_SCHEMA.parse({
      ...V2_DEMO_PAYLOAD,
      insightReflectionQuestions: ['', '', question],
    })

    expect(payload.insightReflectionQuestions[2]).toBe(question)
  })
})
