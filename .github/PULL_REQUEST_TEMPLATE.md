<!--
See CONTRIBUTING.md. Open this pull request ready for review, not as a draft, once the work is
complete. The `Prove the pull request` gate must be green before merge, and merges use a merge
commit rather than a squash.
-->

## What changed

<!-- One paragraph. Link the issue if there is one. -->

## Proof

Narrowest command that exercises this change:

```powershell

```

Result:

## Not verified

<!-- Say what this change does NOT prove. An accurate gap is more useful than an optimistic claim. -->

## Checklist

- [ ] Invented or synthetic fixtures only — no real or private data, no `.developer-lens/` or
      generated `public/data/` content, no real repository, organisation, or user names.
- [ ] No real credentials or tokens in the diff, tests, or screenshots. Clearly invented
      secret-shaped canaries are allowed inside rejection and privacy tests, and must not reach any
      generated fixture, golden file, or export.
- [ ] The narrowest proving command above was actually run, and it touches the changed files.
- [ ] `npm run check` passes for a code or configuration change (`npm run verify:context` and
      `git diff --check origin/main...HEAD` for a documentation-only change).
- [ ] Documentation state is in sync if an authority file moved: `CLAUDE.md`, `AGENTS.md`,
      `docs/data-charter.md`, `docs/source-capability-matrix.md`, `docs/OWNER_CONSTITUTION.md`,
      `HUMAN_TODO.md`, `docs/analyser-program/CURRENT_STATE.md`.
- [ ] I am proposing this contribution under **AGPL-3.0-only**, and I have read the
      contributor-agreement note in `CONTRIBUTING.md`.
