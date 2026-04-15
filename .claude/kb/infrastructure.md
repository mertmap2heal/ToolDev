# Infrastructure, Tooling & Environment

Docker, npm, Git, PowerShell, and startup patterns for this project.
Read alongside `learnings.md` for historical mistakes.

---

## Starting the App

```powershell
.\start.ps1           # start everything (skips npm install if node_modules exist)
.\start.ps1 --install # force reinstall all node_modules (use after pulling new deps)
```

The script:
1. Checks Docker Desktop is running (polls until daemon responds)
2. Starts `docker-compose up -d` (PostgreSQL)
3. Polls the container healthcheck until `healthy`
4. Installs npm packages in correct order: `shared/` → `backend/` → `frontend/`
5. Runs `npx prisma generate` then `npx prisma db push`
6. Starts backend (`tsx watch`) and frontend (`vite`) concurrently

**After any branch merge:** always run `.\start.ps1 --install`.
The merged branch may have added new dependencies that are in `package.json`
but not yet in `node_modules/`.

---

## npm Install Order

The monorepo has three packages with a strict dependency order:

```
shared/      ← TypeScript types only; no runtime deps
  ↓ depends on
backend/     ← imports from 'shared/'
  ↓ depends on
frontend/    ← imports from 'shared/' via Vite alias
```

Always install `shared/` first. If `shared/node_modules/` (which only contains
`typescript`) is missing, the TypeScript compiler fails to resolve `shared/types/`
in both backend and frontend.

---

## Detecting Undeclared npm Dependencies

After a merge, imports may exist in source files for packages not in `package.json`.
Run this from `frontend/` or `backend/` to find them before they cause runtime errors:

```bash
node -e "
const fs=require('fs'),path=require('path');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const declared=new Set(Object.keys({...pkg.dependencies,...pkg.devDependencies}));
function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()?walk(p):/\.(ts|tsx)$/.test(f)?[p]:[]});}
const re=/from ['\"]([^'\"./][^'\"]*)['\"]|\brequire\(['\"]([^'\"./][^'\"]*)['\"\)]/g;const used=new Set();
for(const f of walk('src')){let m;const s=fs.readFileSync(f,'utf8');while((m=re.exec(s))){const p=m[1]||m[2];used.add(p.startsWith('@')?p.split('/').slice(0,2).join('/'):p.split('/')[0]);}}
console.log([...used].filter(p=>!declared.has(p)&&!fs.existsSync('node_modules/'+p)).sort().join('\n')||'all clear');
"
```

---

## Docker

### Container readiness — not immediate

```
docker-compose up -d   ← container starts in ~100ms
                       ← PostgreSQL initialises over next 3-10 seconds
```

`docker ps` will show the container as `Up` but the database is not ready.
Scripts must poll the healthcheck:

```powershell
do {
    Start-Sleep -Seconds 3
    $status = docker inspect --format "{{.State.Health.Status}}" engineering-tool-db
} while ($status -ne "healthy")
```

### Docker Desktop not running

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

This is NOT a path problem. Docker Desktop is simply not started. Start it
and poll until `docker ps` succeeds.

### Useful Docker commands

```powershell
docker-compose up -d              # start DB
docker-compose down               # stop (data persists)
docker-compose down -v            # stop AND delete all data (irreversible!)
docker-compose logs postgres      # inspect DB logs
docker ps                         # check container health status
docker exec -it engineering-tool-db psql -U engineering_user -d engineering_tool
```

### Volume & data persistence
Data lives in Docker volume `postgres_data`. It persists across:
- `docker-compose down` ✓
- Machine restarts ✓
- `.\start.ps1` restarts ✓

It is **destroyed** by:
- `docker-compose down -v` ✗
- `docker volume rm postgres_data` ✗

Never run `down -v` unless explicitly restoring from scratch.

---

## Prisma Command Reference

```bash
# Dev workflow (run from backend/)
npx prisma generate              # regenerate client after schema change
npx prisma db push               # sync schema to dev DB (no migration file)
npx prisma db push --skip-generate  # only if generate was already run

# Migrations (only in real terminal, never in scripts)
npx prisma migrate dev --name <description>   # create + apply new migration
npx prisma migrate deploy                     # apply existing migrations (CI/prod)

# Inspection
npm run prisma:studio            # open GUI at http://localhost:5555
```

### `migrate dev` is interactive-only

`prisma migrate dev` prompts for a migration name. It fails in any non-TTY
shell (CI, PowerShell scripts, `Bash` tool calls). Use `db push` for dev and
`migrate deploy` for CI.

---

## Git Workflow Quick Reference

```bash
# Start work
git checkout master && git pull origin master
git checkout -b feature/my-feature

# Commit (Conventional Commits format)
git add src/specific/file.ts
git commit -m "feat(scope): short description"

# Before merging: sync with master
git fetch origin
git merge origin/master   # resolve any conflicts

# Push and open PR (target: master, not main)
git push -u origin feature/my-feature
gh pr create --base master --title "feat(scope): description"
```

### Branch types
| Prefix | Purpose |
|--------|---------|
| `feature/` | new functionality |
| `bugfix/` | bug fixes |
| `hotfix/` | urgent production patches (branch from `main`) |
| `chore/` | deps, config, tooling |
| `docs/` | documentation only |
| `refactor/` | restructuring without behaviour change |

### Commit message rules
- Max 72 chars on summary line
- Imperative mood: "add" not "added", "fix" not "fixed"
- No period at end
- Always add AI trailer when Claude commits:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```

### Windows heredoc and non-ASCII characters

Git commit messages written via `git commit -m "$(cat <<'EOF' ... EOF)"` on
Windows will corrupt non-ASCII characters. Always use plain ASCII in heredoc
commit messages:
- `—` → `-`
- `"` / `"` → `"`
- `…` → `...`

---

## PowerShell Scripts

Rules for any `.ps1` file in this project:

1. **Plain ASCII only.** Em-dashes, curly quotes, ellipses, and other typographic
   characters cause parser errors that point to the WRONG line.

2. **Never call `prisma migrate dev`** — it will hang waiting for stdin.

3. **Always poll Docker healthcheck** before running any DB command.

4. **Check Docker daemon** before running any `docker` command:
   ```powershell
   $dockerOk = docker ps 2>&1
   if ($LASTEXITCODE -ne 0) {
       Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
       # poll until daemon responds
   }
   ```

---

## Environment Files

`backend/.env` is gitignored and created by `start.ps1` from `backend/.env.example`.

**Required:**
```env
DATABASE_URL="postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool"
JWT_SECRET="<any strong secret>"
```

**Never commit secrets.** Never prefix sensitive values with `VITE_` (it would
expose them in the browser bundle).

If `.env` is missing, `start.ps1` copies `.env.example` automatically.

---

## CI Pipeline

`.github/workflows/ci.yml` runs on every push to `main`/`master` and on PRs:
1. `npm run lint` (frontend — ESLint)
2. `npm run build` (backend — TypeScript compilation check)

The CI does NOT run Playwright tests (requires a running database + app).
Run `npx playwright test` locally before pushing.

---

## Ports — Never Change These

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend (Express) | 5000 |
| Database (PostgreSQL) | 5432 |
| Prisma Studio | 5555 |

These are hardcoded in `docker-compose.yml`, `vite.config.ts`, `backend/.env`,
and `start.ps1`. Changing any one without updating all others will break the app.
