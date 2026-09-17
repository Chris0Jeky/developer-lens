import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateGovernorPolicyYaml } from './governorPolicyValidation.js'

const path = resolve('.agent-harness', 'governor.yaml')
const violations = validateGovernorPolicyYaml(await readFile(path, 'utf8'))

if (violations.length > 0) {
  for (const violation of violations) console.error(violation)
  process.exitCode = 1
} else {
  console.log('Verified parsed governor YAML structure.')
}
