# Git Workflow

## Branching strategy

```
master        ← production-stable; protected; only merges from dev; all CI must pass
dev           ← integration branch; protected; feature branches merge here first
feature/*     ← new features (branch from dev)
bugfix/*      ← bug fixes (branch from dev)
hotfix/*      ← urgent production fixes (branch from master)
chore/*       ← dependency updates, config, tooling (branch from dev)
docs/*        ← documentation-only changes (branch from dev)
refactor/*    ← code restructuring with no behaviour change (branch from dev)
```

**Flow:** `feature/*` → PR → `dev` → PR → `master` (release)

`dev` is always ahead of `master`. No direct commits to either protected branch.
CI must pass on every PR before merge. `master` only receives merges from `dev` via PR.

## Branch naming

```
feature/short-description          # e.g. feature/add-export-pdf
bugfix/short-description           # e.g. bugfix/fix-auth-token-expiry
hotfix/short-description           # e.g. hotfix/patch-sql-injection
chore/short-description            # e.g. chore/upgrade-prisma-v6
docs/short-description             # e.g. docs/update-api-reference
refactor/short-description         # e.g. refactor/extract-email-service
```

Rules:
- All lowercase, hyphens only (no underscores, no slashes in the description)
- Keep it short — 2–5 words

## Creating a feature branch

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

## Commit message format — Conventional Commits

```
<type>(<scope>): <short summary>

[optional body — explain WHY, not what]

[optional footer: BREAKING CHANGE, closes #issue]
```

### Types
| Type | When to use |
|------|-------------|
| `feat` | New feature or user-facing capability |
| `fix` | Bug fix |
| `chore` | Build, deps, tooling, config — no production code change |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `style` | Formatting, missing semicolons — no logic change |
| `ci` | CI/CD pipeline changes |

### Scope (optional but recommended)
Use the affected area: `auth`, `requirements`, `verification`, `frontend`, `backend`, `db`, `api`, `tasks`, `export`, `certification`, etc.

### Examples
```
feat(requirements): add bulk export to Excel
fix(auth): resolve token not refreshing on 401
chore(deps): upgrade Prisma to v6
refactor(verification): extract test-run execution into service
docs: update CLAUDE.md with new module structure
feat(certification)!: redesign compliance matrix API

BREAKING CHANGE: matrix endpoint now returns { rows, columns } instead of flat array
```

### Rules
- Summary line: max 72 characters, imperative mood ("add" not "added"), no period at end
- Body: wrap at 72 characters, explain motivation and contrast with previous behaviour
- Breaking changes: add `!` after type/scope AND `BREAKING CHANGE:` footer

## AI agent commit rules

When Claude Code (or any AI agent) makes commits on behalf of the user:

1. **Always create a feature branch** — never commit directly to `main` or `master`
2. **One logical unit per commit** — don't bundle unrelated changes
3. **Use Conventional Commits format** (see above)
4. **Include Co-Authored-By trailer:**
   ```
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
5. **Stage specific files** — avoid `git add .` or `git add -A` unless the full working tree is intentional
6. **Never use `--no-verify`** — hooks exist for a reason
7. **Never force-push** to shared branches (`main`, `master`) without explicit user instruction
8. **Confirm before destructive operations** — `reset --hard`, `branch -D`, `push --force`

## Pull Request process

1. Push feature branch: `git push -u origin feature/your-feature-name`
2. Open PR against `dev` for day-to-day feature work
3. PR title = commit message format: `feat(scope): short summary`
4. PR body must include:
   - **Summary** — what changed and why (2–5 bullets)
   - **Test plan** — how to verify the change works
   - **Screenshots** (if UI change)
5. Squash or rebase before merge to keep history clean
6. Delete branch after merge

## Merging to master (releasing)

`master` only receives merges from `dev` via PR, and only when all CI checks pass. Use a PR titled:
```
chore(release): vX.Y.Z
```

## Tags / releases

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Use semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: breaking API or schema changes
- MINOR: new features, backwards-compatible
- PATCH: bug fixes only

## Useful git aliases (optional setup)

```bash
git config alias.co checkout
git config alias.br branch
git config alias.st status
git config alias.lg "log --oneline --graph --decorate --all"
```

## Quick reference

```bash
# Start new feature
git checkout dev && git pull && git checkout -b feature/my-feature

# Commit
git add src/specific/file.ts
git commit -m "feat(scope): short description"

# Push and open PR (target: dev)
git push -u origin feature/my-feature
gh pr create --title "feat(scope): short description" --base dev

# After PR merged, clean up
git checkout dev && git pull
git branch -d feature/my-feature

# Release to master (from dev, when ready)
gh pr create --title "chore(release): vX.Y.Z" --base master --head dev
```
