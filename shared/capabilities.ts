import { z } from 'zod'
import { DataClassSchema } from './privacy.js'

export const CAPABILITY_CONTRACT_VERSION = '1.0.0' as const

export const CAPABILITY_IDS = [
  'github.core',
  'cap.local.git',
  'cap.git.signatures',
  'cap.commit.intent',
  'cap.github.issue_taxonomy',
  'cap.github.actions',
  'cap.github.deployments',
  'cap.github.dependencies',
  'cap.github.security',
  'cap.github.projects',
  'cap.github.ownership',
  'cap.source.structure',
  'cap.external.model',
] as const

export const CapabilityIdSchema = z.enum(CAPABILITY_IDS)
export type CapabilityId = z.infer<typeof CapabilityIdSchema>

const CapabilityDefinitionSchema = z
  .object({
    id: CapabilityIdSchema,
    authorization: z.literal('never_authorized'),
    purposeCode: z.string().regex(/^[A-Z0-9_]+$/),
    classCeiling: DataClassSchema,
    requiredGates: z.array(z.enum(['G2', 'G3', 'G4'])).readonly(),
    phase: z.enum(['P4/P7', 'P6', 'P7', 'P8', 'P9', 'P10', 'P12']),
    retentionCode: z.string().regex(/^[A-Z0-9_]+$/),
    deletionCode: z.string().regex(/^[A-Z0-9_]+$/),
    refusalStatus: z.enum(['never_authorized', 'refused', 'unavailable', 'restricted']),
  })
  .strict()

export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>

const capability = (
  id: CapabilityId,
  purposeCode: string,
  classCeiling: z.infer<typeof DataClassSchema>,
  requiredGates: CapabilityDefinition['requiredGates'],
  phase: CapabilityDefinition['phase'],
  retentionCode: string,
  deletionCode: string,
  refusalStatus: CapabilityDefinition['refusalStatus'],
): CapabilityDefinition =>
  CapabilityDefinitionSchema.parse({
    id,
    authorization: 'never_authorized',
    purposeCode,
    classCeiling,
    requiredGates,
    phase,
    retentionCode,
    deletionCode,
    refusalStatus,
  })

/**
 * This is descriptive metadata only. There is deliberately no activation,
 * query, credential, collection, or storage operation in this module.
 */
export const CAPABILITY_REGISTRY = [
  capability('github.core', 'REPOSITORY_LIFECYCLE', 'C2', ['G2'], 'P4/P7', 'C1_36M_C2_13M', 'DELETE_SOURCE_DESCENDANTS', 'never_authorized'),
  capability('cap.local.git', 'SELECTED_REF_TOPOLOGY', 'C2', ['G2'], 'P6', 'C2_13M', 'DELETE_TOPOLOGY_DESCENDANTS', 'refused'),
  capability('cap.git.signatures', 'SIGNATURE_POLICY_COVERAGE', 'C3', ['G2'], 'P6', 'C3_90D_C1_36M', 'DELETE_SIGNATURE_SUMMARIES', 'refused'),
  capability('cap.commit.intent', 'AGGREGATE_INTENT_MIX', 'C4', ['G2'], 'P6', 'C4_PROCESS_C1_36M', 'DELETE_INTENT_SUMMARIES', 'refused'),
  capability('cap.github.issue_taxonomy', 'ISSUE_LINKAGE_TAXONOMY', 'C3', ['G2'], 'P7', 'C3_90D_C1_36M', 'DELETE_TAXONOMY_DESCENDANTS', 'never_authorized'),
  capability('cap.github.actions', 'AGGREGATE_CHECK_FEEDBACK', 'C3', ['G2', 'G3'], 'P8', 'C3_90D_C1_36M', 'DELETE_ACTIONS_DESCENDANTS', 'refused'),
  capability('cap.github.deployments', 'DEPLOYMENT_RELEASE_LINKAGE', 'C3', ['G2', 'G3'], 'P8', 'C3_90D_C1_36M', 'DELETE_DEPLOYMENT_DESCENDANTS', 'refused'),
  capability('cap.github.dependencies', 'DEPENDENCY_UPDATE_WAVES', 'C3', ['G2', 'G3'], 'P9', 'C3_90D', 'DELETE_DEPENDENCY_DESCENDANTS', 'never_authorized'),
  capability('cap.github.security', 'AGGREGATE_SECURITY_LIFECYCLE', 'C3', ['G2', 'G3'], 'P9', 'C3_90D', 'DELETE_SECURITY_DESCENDANTS', 'restricted'),
  capability('cap.github.projects', 'PROJECT_STATUS_TRANSITIONS', 'C3', ['G2', 'G3'], 'P10', 'C3_90D', 'DELETE_PROJECT_DESCENDANTS', 'unavailable'),
  capability('cap.github.ownership', 'OWNERSHIP_COVERAGE_COUNTS', 'C4', ['G2', 'G3'], 'P10', 'C4_PROCESS_C3_90D_C1_36M', 'DELETE_OWNERSHIP_DESCENDANTS', 'never_authorized'),
  capability('cap.source.structure', 'OPAQUE_MODULE_GRAPH', 'C4', ['G2', 'G3'], 'P10', 'C4_PROCESS_C3_90D_C1_36M', 'DELETE_STRUCTURE_DESCENDANTS', 'never_authorized'),
  capability('cap.external.model', 'CONTROLLED_HYPOTHESES', 'C1', ['G2', 'G4'], 'P12', 'OWNER_PROVIDER_DECISION', 'DELETE_MODEL_DESCENDANTS', 'never_authorized'),
] as const

const capabilityMap = new Map(CAPABILITY_REGISTRY.map((definition) => [definition.id, definition]))

export function getCapabilityDefinition(id: unknown): CapabilityDefinition {
  const parsedId = CapabilityIdSchema.parse(id)
  const definition = capabilityMap.get(parsedId)
  if (!definition) {
    throw new Error(`Capability registry is incomplete for ${parsedId}`)
  }
  return definition
}
