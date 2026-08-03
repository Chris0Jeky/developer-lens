import { z } from 'zod'

export const PRIVACY_CONTRACT_VERSION = '1.0.0' as const

export const DATA_CLASSES = ['C0', 'C1', 'C2', 'C3', 'C4', 'X'] as const
export const DataClassSchema = z.enum(DATA_CLASSES)
export type DataClass = z.infer<typeof DataClassSchema>

export const PRIVACY_SINKS = [
  'persistence',
  'log',
  'api',
  'frontend',
  'export',
  'model',
  'public',
] as const
export const PrivacySinkSchema = z.enum(PRIVACY_SINKS)
export type PrivacySink = z.infer<typeof PrivacySinkSchema>

export const NON_PUBLIC_PRIVACY_SINKS = [
  'persistence',
  'log',
  'api',
  'frontend',
  'export',
  'model',
] as const
export const NonPublicPrivacySinkSchema = z.enum(NON_PUBLIC_PRIVACY_SINKS)
export type NonPublicPrivacySink = z.infer<typeof NonPublicPrivacySinkSchema>

const SINK_CLASS_ALLOWLIST: Readonly<Record<PrivacySink, readonly DataClass[]>> = {
  persistence: ['C1', 'C2', 'C3'],
  log: ['C1'],
  api: ['C0', 'C1', 'C2'],
  frontend: ['C0', 'C1'],
  export: ['C0', 'C1'],
  model: ['C1'],
  public: ['C0'],
}

export const PAYLOAD_FAMILIES = [
  'repository_observed.v1',
  'pull_request_fact.v1',
  'check_attempt_fact.v1',
  'release_fact.v1',
  'opaque_module_edge.v1',
] as const
export const PayloadFamilySchema = z.enum(PAYLOAD_FAMILIES)
export type PayloadFamily = z.infer<typeof PayloadFamilySchema>

export const PUBLIC_PAYLOAD_FAMILIES = ['public_showcase.v1'] as const
export const PublicPayloadFamilySchema = z.enum(PUBLIC_PAYLOAD_FAMILIES)
export type PublicPayloadFamily = z.infer<typeof PublicPayloadFamilySchema>

export type FieldClasses<T extends z.ZodRawShape> = Readonly<{
  [K in keyof z.output<z.ZodObject<T>>]: DataClass
}>

export interface RegisteredPayload<T extends z.ZodRawShape> {
  readonly family: PayloadFamily
  readonly schema: z.ZodObject<T>
  readonly fieldClasses: FieldClasses<T>
  readonly allowedSinks: readonly NonPublicPrivacySink[]
  readonly boundary: 'private'
}

export interface RegisteredPublicPayload<T extends z.ZodRawShape> {
  readonly family: PublicPayloadFamily
  readonly schema: z.ZodObject<T>
  readonly fieldClasses: FieldClasses<T>
  readonly allowedSinks: readonly ['public']
  readonly boundary: 'public'
}

type AnyRegisteredPayload<T extends z.ZodRawShape> =
  | RegisteredPayload<T>
  | RegisteredPublicPayload<T>

function exactKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key))
}

/**
 * Registers a typed canonical payload family. The data itself never supplies its
 * class: the class map is reviewed code and must exactly match the strict schema.
 */
export function registerPayload<T extends z.ZodRawShape>(
  family: PayloadFamily,
  schema: z.ZodObject<T>,
  fieldClasses: FieldClasses<T>,
  allowedSinks: readonly NonPublicPrivacySink[],
): RegisteredPayload<T> {
  PayloadFamilySchema.parse(family)
  const parsedSinks = z.array(NonPublicPrivacySinkSchema).min(1).parse(allowedSinks)
  if (new Set(parsedSinks).size !== parsedSinks.length) {
    throw new Error('Registered payload sinks must be unique')
  }
  const payloadKeys = Object.keys(schema.shape)
  const classKeys = Object.keys(fieldClasses)

  if (!exactKeys(payloadKeys, classKeys)) {
    throw new Error('Registered field classes must exactly match payload keys')
  }

  for (const fieldClass of Object.values(fieldClasses)) {
    DataClassSchema.parse(fieldClass)
  }

  return {
    family,
    schema: schema.strict(),
    fieldClasses,
    allowedSinks: parsedSinks,
    boundary: 'private',
  }
}

/** Public payloads use a distinct family and may contain only synthetic C0 fields. */
export function registerPublicPayload<T extends z.ZodRawShape>(
  family: PublicPayloadFamily,
  schema: z.ZodObject<T>,
  fieldClasses: FieldClasses<T>,
): RegisteredPublicPayload<T> {
  PublicPayloadFamilySchema.parse(family)
  const payloadKeys = Object.keys(schema.shape)
  const classKeys = Object.keys(fieldClasses)

  if (!exactKeys(payloadKeys, classKeys)) {
    throw new Error('Registered field classes must exactly match payload keys')
  }
  if (Object.values(fieldClasses).some((fieldClass) => fieldClass !== 'C0')) {
    throw new Error('Public payload fields must all be classified C0')
  }

  return {
    family,
    schema: schema.strict(),
    fieldClasses,
    allowedSinks: ['public'],
    boundary: 'public',
  }
}

function assertFlatClassifiedPayload(payload: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(payload)) {
    const isScalar = value === null || value === undefined ||
      typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    const isScalarArray = Array.isArray(value) && value.every((item) =>
      item === null || typeof item === 'string' || typeof item === 'boolean' ||
      (typeof item === 'number' && Number.isFinite(item)),
    )

    if (!isScalar && !isScalarArray) {
      throw new Error(`Field ${field} requires a separately classified nested contract`)
    }
  }
}

export function payloadForSink<T extends z.ZodRawShape>(
  sink: PrivacySink,
  registered: AnyRegisteredPayload<T>,
  payload: unknown,
): z.output<z.ZodObject<T>> {
  PrivacySinkSchema.parse(sink)
  if (!(registered.allowedSinks as readonly PrivacySink[]).includes(sink)) {
    throw new Error(`Payload family ${registered.family} is denied for ${sink}`)
  }
  const parsed = registered.schema.parse(payload)
  assertFlatClassifiedPayload(parsed)
  const allowedClasses = SINK_CLASS_ALLOWLIST[sink]

  for (const field of Object.keys(registered.fieldClasses)) {
    const fieldClass = registered.fieldClasses[field as keyof typeof registered.fieldClasses] as DataClass
    if (!allowedClasses.includes(fieldClass)) {
      throw new Error(`Field ${field} with class ${fieldClass} is denied for ${sink}`)
    }
  }

  return parsed
}

/**
 * The only serialization helper in the contract. It validates the registered,
 * purpose-built payload before producing bytes; it does not perform I/O.
 */
export function serializeForSink<T extends z.ZodRawShape>(
  sink: PrivacySink,
  registered: AnyRegisteredPayload<T>,
  payload: unknown,
): string {
  return JSON.stringify(payloadForSink(sink, registered, payload))
}

export function isClassAllowedForSink(sink: PrivacySink, fieldClass: DataClass): boolean {
  PrivacySinkSchema.parse(sink)
  DataClassSchema.parse(fieldClass)
  return SINK_CLASS_ALLOWLIST[sink].includes(fieldClass)
}
