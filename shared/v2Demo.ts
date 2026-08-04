import { z } from 'zod'
import { payloadForSink, registerPublicPayload } from './privacy.js'
import type { Insight } from './types.js'

const INSIGHT_COUNT = 3

const V2_INSIGHT_SCHEMA = z
  .object({
    id: z.string(),
    order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    category: z.enum(['rhythm', 'focus', 'delivery', 'collaboration', 'craft', 'trajectory']),
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    reflectionQuestion: z.string().optional(),
    evidence: z.array(z.string()).length(2),
    caveat: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    score: z.number(),
  })
  .strict()

/**
 * The public sink accepts only flat scalar/scalar-array values. Parallel arrays
 * keep every displayed insight field inside this one strict registered payload.
 */
export const V2_DEMO_PAYLOAD_SCHEMA = z
  .object({
    storyId: z.string(),
    title: z.string(),
    summary: z.string(),
    boundary: z.string(),
    insightIds: z.array(z.string()).length(INSIGHT_COUNT),
    insightOrders: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).length(INSIGHT_COUNT),
    insightCategories: z.array(z.enum(['rhythm', 'focus', 'delivery', 'collaboration', 'craft', 'trajectory'])).length(INSIGHT_COUNT),
    insightEyebrows: z.array(z.string()).length(INSIGHT_COUNT),
    insightTitles: z.array(z.string()).length(INSIGHT_COUNT),
    insightBodies: z.array(z.string()).length(INSIGHT_COUNT),
    insightReflectionQuestions: z.tuple([
      z.literal(''),
      z.literal(''),
      z.string().min(1).max(240),
    ]),
    insightEvidenceOne: z.array(z.string()).length(INSIGHT_COUNT),
    insightEvidenceTwo: z.array(z.string()).length(INSIGHT_COUNT),
    insightCaveats: z.array(z.string()).length(INSIGHT_COUNT),
    insightConfidences: z.array(z.enum(['high', 'medium', 'low'])).length(INSIGHT_COUNT),
    insightScores: z.array(z.number()).length(INSIGHT_COUNT),
    closingCaveat: z.string(),
  })
  .strict()

export const V2_DEMO_REGISTRATION = registerPublicPayload(
  'public_showcase.v1',
  V2_DEMO_PAYLOAD_SCHEMA,
  {
    storyId: 'C0',
    title: 'C0',
    summary: 'C0',
    boundary: 'C0',
    insightIds: 'C0',
    insightOrders: 'C0',
    insightCategories: 'C0',
    insightEyebrows: 'C0',
    insightTitles: 'C0',
    insightBodies: 'C0',
    insightReflectionQuestions: 'C0',
    insightEvidenceOne: 'C0',
    insightEvidenceTwo: 'C0',
    insightCaveats: 'C0',
    insightConfidences: 'C0',
    insightScores: 'C0',
    closingCaveat: 'C0',
  },
)

export type V2DemoPayload = z.output<typeof V2_DEMO_PAYLOAD_SCHEMA>

/** Validated at the public sink before either metadata or insights are exposed. */
export const V2_DEMO_PAYLOAD: V2DemoPayload = payloadForSink(
  'public',
  V2_DEMO_REGISTRATION,
  {
    storyId: 'v2-synthetic-signal-garden',
    title: 'A small system learned to make its signals legible.',
    summary:
      'An invented three-layer story showing how visible events can become bounded patterns without pretending to know intent.',
    boundary:
      'Invented C0 content only. This story uses no account, repository, or local-history input.',
    insightIds: ['v2-observed-rhythm', 'v2-derived-connection', 'v2-hypothesis-focus'],
    insightOrders: [1, 2, 3],
    insightCategories: ['rhythm', 'delivery', 'trajectory'],
    insightEyebrows: ['Observed · rhythm', 'Derived · delivery', 'Hypothesis · focus'],
    insightTitles: [
      'The signal arrives in short, repeatable waves.',
      'Small batches keep the handoff surface narrow.',
      'The system may be optimized for deliberate coordination.',
    ],
    insightBodies: [
      'The invented event stream lights up in three compact windows, separated by quiet gaps.',
      'The observed wave shape and batch sizes combine into a reproducible delivery pattern.',
      'The aligned signals support a useful question: does a visible pause make the next handoff clearer?',
    ],
    insightReflectionQuestions: [
      '',
      '',
      'What additional evidence would distinguish a deliberate handoff pause from an ordinary gap in the available trace?',
    ],
    insightEvidenceOne: [
      '3 active windows in the synthetic timeline',
      'Median batch size: 4 events',
      'Wave boundaries align with handoff markers',
    ],
    insightEvidenceTwo: [
      '18 visible event records',
      'Every synthetic window contains a handoff marker',
      'Batch size stays stable across all windows',
    ],
    insightCaveats: [
      'Synthetic timestamps describe a story shape, not time worked.',
      'A derived pattern cannot explain why a batch was small.',
      'This is a bounded hypothesis, not evidence of intent or impact.',
    ],
    insightConfidences: ['high', 'medium', 'low'],
    insightScores: [0.88, 0.71, 0.54],
    closingCaveat:
      'Counts and connections stay attached to their evidence. Missing context remains unknown rather than becoming a conclusion.',
  },
)

function deriveInsights(payload: V2DemoPayload): Insight[] {
  return payload.insightIds.map((id, index) => {
    const reflectionQuestion = payload.insightReflectionQuestions[index]
    return {
      id,
      order: payload.insightOrders[index],
      category: payload.insightCategories[index],
      eyebrow: payload.insightEyebrows[index],
      title: payload.insightTitles[index],
      body: payload.insightBodies[index],
      ...(reflectionQuestion ? { reflectionQuestion } : {}),
      evidence: [payload.insightEvidenceOne[index], payload.insightEvidenceTwo[index]],
      caveat: payload.insightCaveats[index],
      confidence: payload.insightConfidences[index],
      score: payload.insightScores[index],
    }
  })
}

// Keep the InsightStack input derived exclusively from the sink-validated payload.
export const V2_DEMO_INSIGHTS: Insight[] = deriveInsights(V2_DEMO_PAYLOAD)
export const V2_DEMO_INSIGHTS_SCHEMA = z.array(V2_INSIGHT_SCHEMA).length(INSIGHT_COUNT)
V2_DEMO_INSIGHTS_SCHEMA.parse(V2_DEMO_INSIGHTS)
