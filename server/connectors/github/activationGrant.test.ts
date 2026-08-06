import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
  GithubCoreActivationGrantError,
  assertGithubCoreActivationGrant,
} from './activationGrant.js'
import { loadTaskInstallationKeyForGithubCoreGrant } from '../../storage/taskInstallationKey.js'
import { loadHashBoundGithubCoreActivationTaskCard } from './activationTaskLoader.js'

const cardSha256 = 'a'.repeat(64)
const keyFingerprint = 'b'.repeat(64)
const scopeAlias = `repo-${'c'.repeat(64)}`

/**
 * A plain object shaped exactly like a grant. #151: there is no production issuer, so even a
 * perfectly-shaped, frozen lookalike must be refused by the default-deny validator. Success paths
 * in the consumer tests inject their own validator via `vi.mock`, never a production issuer.
 */
function lookalikeGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.freeze({
    capabilityId: 'github.core',
    taskId: 'invented-grant-task',
    taskCardSha256: cardSha256,
    installationKeyFingerprint: keyFingerprint,
    scopeAlias,
    ...overrides,
  })
}

describe('github.core process-local activation grant', () => {
  it('default-denies every input content-free: no production issuer exists (#151)', () => {
    const canaries = ['PRIVATE_REPOSITORY_CANARY', 'C:\\PRIVATE_PATH_CANARY', 'PRIVATE_KEY_CANARY']
    const forged = lookalikeGrant({ repository: canaries[0] })
    for (const value of [
      lookalikeGrant(),
      forged,
      null,
      undefined,
      {},
      { capabilityId: 'cap.external.model' },
      Object.freeze({ ...lookalikeGrant() }),
    ]) {
      try {
        assertGithubCoreActivationGrant(value)
        throw new Error('expected default-deny')
      } catch (error) {
        expect(error).toBeInstanceOf(GithubCoreActivationGrantError)
        expect(error).toMatchObject({
          code: GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
          message: GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE,
        })
        const serialized = JSON.stringify(error)
        for (const canary of canaries) expect(serialized).not.toContain(canary)
      }
    }
  })

  it('never invokes accessors on a lookalike before denying', () => {
    let getterCalled = false
    const accessor: Record<string, unknown> = {
      capabilityId: 'github.core',
      taskId: 'invented-grant-task',
      installationKeyFingerprint: keyFingerprint,
      scopeAlias,
    }
    Object.defineProperty(accessor, 'taskCardSha256', {
      enumerable: true,
      get: () => { getterCalled = true; return cardSha256 },
    })
    expect(() => assertGithubCoreActivationGrant(accessor)).toThrow(GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE)
    expect(getterCalled).toBe(false)
  })

  it('every production consumer seam default-denies an un-issued grant', async () => {
    // Proves the runner/task-loader/key-loader wire the real default-deny validator: a plain grant
    // object (all that arbitrary local code can build now that the issuer is gone) is refused
    // before any filesystem, card, or key access.
    await expect(loadTaskInstallationKeyForGithubCoreGrant({
      workspaceRoot: 'C:\\does-not-exist',
      grant: lookalikeGrant() as never,
    })).rejects.toMatchObject({ code: 'INVALID_TASK_INSTALLATION_KEY' })

    await expect(loadHashBoundGithubCoreActivationTaskCard({
      workspaceRoot: 'C:\\does-not-exist',
      taskId: 'invented-grant-task',
      expectedSha256: cardSha256,
      grant: lookalikeGrant() as never,
    })).rejects.toMatchObject({ code: 'INVALID_GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD' })
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

  it('the production grant module exports no issuer and no WeakSet registrar (#151)', () => {
    const modulePath = resolve(__dirname, 'activationGrant.ts')
    const source = readFileSync(modulePath, 'utf8')
    // No issuer identifier, test seam, or set-registration call may survive in the production module.
    expect(source).not.toMatch(/issueInventedGrant/)
    expect(source).not.toMatch(/githubCoreActivationGrantTestSeam/)
    expect(source).not.toMatch(/issuedGrants\s*\.\s*add\b/)

    const file = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true)
    const exportedNames = new Set<string>()
    const collect = (node: ts.Node): void => {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
      const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      if (isExported) {
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
          || ts.isTypeAliasDeclaration(node)) && node.name) exportedNames.add(node.name.text)
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) exportedNames.add(decl.name.text)
          }
        }
      }
      ts.forEachChild(node, collect)
    }
    collect(file)
    // Only the type, error code, error class, and default-deny validator are exported.
    expect([...exportedNames].sort()).toEqual([
      'GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE',
      'GithubCoreActivationGrant',
      'GithubCoreActivationGrantError',
      'assertGithubCoreActivationGrant',
    ])
  })
})
