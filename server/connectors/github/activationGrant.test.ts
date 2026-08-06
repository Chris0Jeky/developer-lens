import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
  assertGithubCoreActivationGrant,
  githubCoreActivationGrantTestSeam,
} from './activationGrant.js'

const cardSha256 = 'a'.repeat(64)
const keyFingerprint = 'b'.repeat(64)
const scopeAlias = `repo-${'c'.repeat(64)}`

function inventedGrant() {
  return githubCoreActivationGrantTestSeam.issueInventedGrant({
    fixture: 'invented',
    capabilityId: 'github.core',
    taskId: 'invented-grant-task',
    taskCardSha256: cardSha256,
    installationKeyFingerprint: keyFingerprint,
    scopeAlias,
  })
}

describe('github.core process-local activation grant', () => {
  it('accepts only a privately issued frozen grant and serializes no binding values', () => {
    const grant = inventedGrant()
    expect(assertGithubCoreActivationGrant(grant)).toBe(grant)
    expect(Object.isFrozen(grant)).toBe(true)
    expect(grant).toMatchObject({ capabilityId: 'github.core', taskId: 'invented-grant-task' })
    expect(JSON.stringify(grant)).toBe('{}')
  })

  it('denies lookalikes, wrong capabilities, accessors, and malformed bindings content-free', () => {
    const canaries = [
      'PRIVATE_REPOSITORY_CANARY',
      'C:\\PRIVATE_PATH_CANARY',
      'PRIVATE_KEY_CANARY',
    ]
    const forged = {
      capabilityId: 'github.core',
      taskId: 'invented-grant-task',
      taskCardSha256: cardSha256,
      installationKeyFingerprint: keyFingerprint,
      scopeAlias,
      repository: canaries[0],
    }
    for (const value of [forged, null, {}, { capabilityId: 'cap.external.model' }]) {
      try {
        assertGithubCoreActivationGrant(value)
        throw new Error('expected grant denial')
      } catch (error) {
        expect(error).toMatchObject({
          code: GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
          message: GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
        })
        const serialized = JSON.stringify(error)
        for (const canary of canaries) expect(serialized).not.toContain(canary)
      }
    }

    expect(() => githubCoreActivationGrantTestSeam.issueInventedGrant({
      fixture: 'invented',
      capabilityId: 'cap.external.model',
      taskId: 'invented-grant-task',
      taskCardSha256: cardSha256,
      installationKeyFingerprint: keyFingerprint,
      scopeAlias,
    })).toThrow(GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE)

    let getterCalled = false
    const accessor: Record<string, unknown> = {
      fixture: 'invented',
      capabilityId: 'github.core',
      taskId: 'invented-grant-task',
      installationKeyFingerprint: keyFingerprint,
      scopeAlias,
    }
    Object.defineProperty(accessor, 'taskCardSha256', {
      enumerable: true,
      get: () => { getterCalled = true; return cardSha256 },
    })
    expect(() => githubCoreActivationGrantTestSeam.issueInventedGrant(accessor))
      .toThrow(GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE)
    expect(getterCalled).toBe(false)
  })

  it('has no production grant issuer or activation-runner caller', () => {
    const root = resolve(__dirname, '../../..')
    const files: string[] = []
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry)
        if (statSync(path).isDirectory()) visit(path)
        else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry) && !/(?:\.test|\.spec)\./.test(entry)) {
          files.push(path)
        }
      }
    }
    for (const directory of ['server', 'shared', 'src', 'scripts'].map((name) => join(root, name))) {
      visit(directory)
    }

    const grantImporters: string[] = []
    const runnerImporters: string[] = []
    const testSeamImporters: string[] = []
    const grantTaskKeyImports: string[] = []
    for (const path of files) {
      const sourcePath = relative(root, path).replaceAll('\\', '/')
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      const check = (node: ts.Node): void => {
        if (
          sourcePath !== 'server/connectors/github/activationGrant.ts' &&
          ts.isIdentifier(node) &&
          node.text === 'githubCoreActivationGrantTestSeam'
        ) testSeamImporters.push(sourcePath)

        const moduleSpecifier =
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : undefined
        const requireLiteral = ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === 'require' && node.arguments.length >= 1 &&
          ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : undefined
        const dynamicLiteral = ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length >= 1 &&
          ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : undefined
        const target = moduleSpecifier ?? requireLiteral ?? dynamicLiteral
        if (target) {
          if (/(?:^|\/)activationGrant(?:\.[cm]?js|\.ts)?$/.test(target)) {
            grantImporters.push(sourcePath)
          }
          if (/(?:^|\/)activationRunner(?:\.[cm]?js|\.ts)?$/.test(target)) {
            runnerImporters.push(sourcePath)
          }
          if (sourcePath === 'server/connectors/github/activationGrant.ts'
            && /(?:^|\/)taskInstallationKey(?:\.[cm]?js|\.ts)?$/.test(target)) {
            grantTaskKeyImports.push(target)
          }
        }
        ts.forEachChild(node, check)
      }
      check(file)
    }

    expect([...new Set(grantImporters)].sort()).toEqual([
      'server/connectors/github/activationRunner.ts',
      'server/connectors/github/activationTaskLoader.ts',
      'server/storage/taskInstallationKey.ts',
    ])
    expect(testSeamImporters).toEqual([])
    expect(runnerImporters).toEqual([])
    expect(grantTaskKeyImports).toEqual([])
  })
})
