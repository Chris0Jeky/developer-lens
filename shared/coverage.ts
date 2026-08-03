import { z } from 'zod'
import { CapabilityIdSchema } from './capabilities.js'

export const COVERAGE_CONTRACT_VERSION = '1.0.0' as const

export const COVERAGE_STATUSES = [
  'never_authorized',
  'refused',
  'unavailable',
  'restricted',
  'truncated',
  'stale',
  'failed',
  'deleted',
  'censored',
  'complete',
] as const
export const CoverageStatusSchema = z.enum(COVERAGE_STATUSES)
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>

const UtcTimestampSchema = z.string().datetime({ offset: true })
const NonnegativeCountSchema = z.number().int().nonnegative()

export const CoverageRecordSchema = z
  .object({
    coverageId: z.string().min(1),
    capabilityId: CapabilityIdSchema,
    scopeAlias: z.string().min(1),
    rangeStart: UtcTimestampSchema,
    rangeEnd: UtcTimestampSchema,
    status: CoverageStatusSchema,
    expectedUnits: NonnegativeCountSchema.nullable(),
    observedUnits: NonnegativeCountSchema,
    omittedUnits: NonnegativeCountSchema.nullable(),
    saturationReason: z.string().regex(/^[A-Z0-9_]+$/).optional(),
    retryable: z.boolean(),
    observedAt: UtcTimestampSchema,
    limitationCode: z.string().regex(/^[A-Z0-9_]+$/),
  })
  .strict()
  .superRefine((coverage, context) => {
    if (Date.parse(coverage.rangeStart) >= Date.parse(coverage.rangeEnd)) {
      context.addIssue({ code: 'custom', message: 'Coverage ranges must be half-open and increasing', path: ['rangeEnd'] })
    }
    if (coverage.status === 'complete' && coverage.expectedUnits === null) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires expectedUnits', path: ['expectedUnits'] })
    }
    if (coverage.status === 'complete' && coverage.expectedUnits !== null && coverage.observedUnits !== coverage.expectedUnits) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires all expected units to be observed', path: ['observedUnits'] })
    }
    if (coverage.status === 'complete' && coverage.omittedUnits !== 0) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires zero omitted units', path: ['omittedUnits'] })
    }
    if (coverage.expectedUnits !== null && coverage.observedUnits > coverage.expectedUnits) {
      context.addIssue({ code: 'custom', message: 'observedUnits cannot exceed expectedUnits', path: ['observedUnits'] })
    }
    if (
      coverage.expectedUnits !== null && coverage.omittedUnits !== null &&
      coverage.observedUnits + coverage.omittedUnits !== coverage.expectedUnits
    ) {
      context.addIssue({ code: 'custom', message: 'Observed and omitted units must account for expected units', path: ['omittedUnits'] })
    }
    if (coverage.status === 'truncated' && !coverage.saturationReason) {
      context.addIssue({ code: 'custom', message: 'Truncated coverage requires a saturation reason', path: ['saturationReason'] })
    }
    if (coverage.status !== 'truncated' && coverage.saturationReason) {
      context.addIssue({ code: 'custom', message: 'Only truncated coverage may have a saturation reason', path: ['saturationReason'] })
    }
  })

export type CoverageRecord = z.infer<typeof CoverageRecordSchema>

/** A missing or restricted state never becomes a numeric zero in a derived view. */
export function completeObservedUnits(coverage: CoverageRecord): number | null {
  return coverage.status === 'complete' ? coverage.observedUnits : null
}
