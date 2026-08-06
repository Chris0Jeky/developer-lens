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

type ExportBinding = Readonly<{
  localName: string
  form: string
}>

function nodeText(node: ts.Node | undefined, sourceFile: ts.SourceFile): string {
  return node ? node.getText(sourceFile) : '<anonymous>'
}

function collectExportSurface(source: string): Map<string, ExportBinding> {
  const sourceFile = ts.createSourceFile('synthetic.ts', source, ts.ScriptTarget.Latest, true)
  const surface = new Map<string, ExportBinding>()
  const add = (exportedName: string, localName: string, form: string): void => {
    surface.set(exportedName, { localName, form })
  }

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const moduleName = statement.moduleSpecifier ? nodeText(statement.moduleSpecifier, sourceFile) : '<local>'
      if (!statement.exportClause) {
        add('*', `* from ${moduleName}`, 'namespace-reexport')
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        add(statement.exportClause.name.text, `* from ${moduleName}`, 'namespace-reexport')
      } else {
        for (const specifier of statement.exportClause.elements) {
          add(
            specifier.name.text,
            nodeText(specifier.propertyName ?? specifier.name, sourceFile),
            statement.moduleSpecifier ? 'reexport' : 'named',
          )
        }
      }
      continue
    }

    if (ts.isExportAssignment(statement)) {
      add(statement.isExportEquals ? 'export=' : 'default', nodeText(statement.expression, sourceFile), 'assignment')
      continue
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    const isDefault = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        add(isDefault ? 'default' : nodeText(declaration.name, sourceFile), nodeText(declaration.name, sourceFile), 'declaration')
      }
      continue
    }

    if (
      ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
      || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
      || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)
    ) {
      add(isDefault ? 'default' : nodeText(statement.name, sourceFile), nodeText(statement.name, sourceFile), 'declaration')
    }
  }
  return surface
}

function sortedSurface(surface: Map<string, ExportBinding>): readonly [string, ExportBinding][] {
  return [...surface.entries()].sort(([left], [right]) => left.localeCompare(right))
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

    // Only the type, error code, error class, and default-deny validator are exported, with
    // each binding retaining its exact local declaration. Names alone would miss an issuer
    // exposed through `export { issuedGrants as allowedName }`.
    const expected = new Map<string, ExportBinding>([
      ['GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE', { localName: 'GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE', form: 'declaration' }],
      ['GithubCoreActivationGrant', { localName: 'GithubCoreActivationGrant', form: 'declaration' }],
      ['GithubCoreActivationGrantError', { localName: 'GithubCoreActivationGrantError', form: 'declaration' }],
      ['assertGithubCoreActivationGrant', { localName: 'assertGithubCoreActivationGrant', form: 'declaration' }],
    ])
    expect(sortedSurface(collectExportSurface(source))).toEqual(sortedSurface(expected))

    for (const synthetic of [
      'const issuedGrants = {}; export { issuedGrants }',
      'const issuedGrants = {}; export { issuedGrants as GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE }',
      'const alias = assertGithubCoreActivationGrant; export { alias as assertGithubCoreActivationGrant }',
      'export * as issuedGrants from \'./other.js\'',
      'export default function issuer() {}',
      'const issuedGrants = {}; export = issuedGrants',
    ]) {
      expect(sortedSurface(collectExportSurface(synthetic))).not.toEqual(sortedSurface(expected))
    }
  })
})
