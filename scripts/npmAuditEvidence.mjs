import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isCount = (value) => Number.isSafeInteger(value) && value >= 0

/** Collection success is not a security disposition or a clean-audit claim. */
export function validateAuditEvidence(report, auditExitCode) {
  if (![0, 1].includes(auditExitCode) || !isRecord(report) || Object.hasOwn(report, 'error')) {
    throw new Error('Audit evidence is unavailable')
  }
  if (report.auditReportVersion !== 2 || !isRecord(report.metadata) || !isRecord(report.vulnerabilities)) {
    throw new Error('Audit report format is unsupported')
  }
  const counts = report.metadata.vulnerabilities
  const severities = ['info', 'low', 'moderate', 'high', 'critical']
  if (!isRecord(counts) || !isCount(counts.total) || severities.some((severity) => !isCount(counts[severity]))) {
    throw new Error('Audit vulnerability counts are invalid')
  }
  const total = severities.reduce((sum, severity) => sum + counts[severity], 0)
  const hasEntries = Object.keys(report.vulnerabilities).length > 0
  if (total !== counts.total || (total > 0) !== hasEntries || auditExitCode !== (total > 0 ? 1 : 0)) {
    throw new Error('Audit report and exit status disagree')
  }
  return { auditExitCode, vulnerabilityCount: total, report }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [reportPath, exitCode, ...extra] = process.argv.slice(2)
    if (!reportPath || !['0', '1'].includes(exitCode) || extra.length > 0) throw new Error('Invalid arguments')
    const evidence = validateAuditEvidence(JSON.parse(readFileSync(reportPath, 'utf8')), Number(exitCode))
    console.log(JSON.stringify(evidence, null, 2))
    console.log(`Audit evidence collected: ${evidence.vulnerabilityCount} vulnerabilities reported. Collection does not disposition findings.`)
  } catch {
    // Do not print arbitrary npm error bodies, configuration, or environment values.
    console.error('Audit evidence unavailable or inconsistent. Check the npm exit status and registry availability; do not infer a clean audit.')
    process.exitCode = 1
  }
}
