# Parameters Page — API, MCP, AI Testing Guide

Complete reference for testing the Parameters page: REST API, AI endpoints, MCP server, BYOK credentials, and security model.

> **Scope:** everything shipped on branch `improve-params-page` (collapses PRs #365–#371). None of this is on `dev` / `master` yet.

---

## Table of contents

1. [Where the code lives](#where-the-code-lives)
2. [Environment setup](#environment-setup)
3. [REST — Parameters page API](#rest--parameters-page-api)
4. [REST — AI endpoints](#rest--ai-endpoints)
5. [REST — BYOK credentials](#rest--byok-credentials)
6. [Admin — MCP key management](#admin--mcp-key-management)
7. [MCP — Streamable HTTP protocol](#mcp--streamable-http-protocol)
8. [Claude Desktop integration](#claude-desktop-integration)
9. [Audit trail](#audit-trail)
10. [Security review](#security-review)
11. [Plan implementation status](#plan-implementation-status)
12. [Gotchas](#gotchas)

---

## Where the code lives

| Area | Path |
|---|---|
| REST parameters controller | `backend/src/controllers/parameter.controller.ts` |
| REST parameters routes | `backend/src/routes/parameters.routes.ts` |
| AI `/ai/draft` handler | `backend/src/routes/aiParameter.routes.ts` |
| AI draft service | `backend/src/services/aiParameter.service.ts` |
| Provider adapters | `backend/src/services/aiProvider/index.ts`, `anthropic.adapter.ts` |
| BYOK credentials | `backend/src/services/aiCredentials.service.ts` |
| BYOK controller | `backend/src/controllers/aiCredential.controller.ts` |
| BYOK routes | `backend/src/routes/aiCredential.routes.ts` |
| MCP server | `backend/src/mcp/server.ts` |
| MCP tools | `backend/src/mcp/tools/*.ts` (7 tools) |
| MCP auth | `backend/src/mcp/auth.ts` |
| MCP audit writer | `backend/src/mcp/audit.ts` |
| MCP Streamable HTTP route | `backend/src/routes/mcp.routes.ts` |
| Admin MCP-keys routes | `backend/src/routes/mcpKey.routes.ts` |
| Admin MCP-keys UI | `frontend/src/components/admin/McpKeysPanel.tsx` |
| BYOK settings UI | `frontend/src/pages/Settings/SettingsPage.tsx` (AI Access section) |
| Parameters page | `frontend/src/pages/Parameters/ParametersPage.tsx` |
| Board view | `frontend/src/components/parameters/ParameterBoardView.tsx` |
| Graph folder groups | `frontend/src/components/parameters/ParameterFolderGroupNode.tsx` |
| Command palette | `frontend/src/components/parameters/ParameterCommandPalette.tsx` |
| Communications tab | `frontend/src/pages/Parameters/CommunicationsTab.tsx` |

---

## Environment setup

```bash
git checkout improve-params-page
cd backend && npm install
npx prisma generate
npx prisma db push --skip-generate
cd .. && ./start.ps1
```

### `backend/.env`

```
# Required
DATABASE_URL="postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool"
JWT_SECRET="<strong random>"

# AI feature flag (three-layer gate)
FEATURES_AI_ENABLED="true"

# Hosted default provider (Option C)
AI_DEFAULT_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-api03-..."

# BYOK at-rest encryption key (Option B)
AI_CREDENTIAL_KEY="<32+ char random; rotate via KMS in production>"
```

### Helper variables

```bash
API="http://localhost:5000/api/v1"
TOKEN="<JWT from /api/v1/auth/login or localStorage.token>"
PROJECT_ID="<uuid>"
```

### Obtain a token via CLI

```bash
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' \
  | jq -r '.data.token'
```

---

## REST — Parameters page API

All routes require `Authorization: Bearer <JWT>`. Response envelope:

```json
{ "success": true, "data": <T>, "message": "optional" }
{ "success": false, "error": "<human message>", "code": "<optional code>" }
```

### List parameters (legacy, unbounded)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID?search=battery&status=approved&sort=updatedAt&order=desc" | jq
```

Query params: `search | q`, `status`, `dataType`, `unit`, `ownerType`, `folderId` (`__none__` = ungrouped), `tags` (comma-separated), `hasFormula` (`true|false`), `authorType` (comma-separated), `sort` (`name|createdAt|updatedAt`), `order`.

### List parameters (paged — aerospace scale)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID?page=1&pageSize=200&sort=name&order=asc" | jq
```

Response (wrapped):

```json
{
  "success": true,
  "data": [ /* Parameter[] */ ],
  "total": 10342,
  "page": 1,
  "pageSize": 200
}
```

### Filter to AI-authored rows

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID?page=1&pageSize=50&authorType=ai_suggestion,ai_accepted,ai_applied" | jq
```

### Get facets (filter-bar source-of-truth)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/facets" | jq
# => { dataType: [...], unit: [...], status: [...], tag: [...], total: N }
```

### Get single parameter

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/<parameterId>" | jq
```

### Create

```bash
curl -s -X POST "$API/parameters/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"main_battery_voltage",
    "description":"Pack voltage at nominal discharge",
    "dataType":"float",
    "defaultValue":"400.0",
    "unit":"V",
    "minValue":"350",
    "maxValue":"420",
    "status":"draft"
  }' | jq
```

### Update

```bash
curl -s -X PUT "$API/parameters/$PROJECT_ID/<parameterId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","maxValue":"430"}' | jq
```

### Delete

```bash
curl -s -X DELETE "$API/parameters/$PROJECT_ID/<parameterId>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Bulk update (Board view uses this on drag)

```bash
curl -s -X PATCH "$API/parameters/$PROJECT_ID/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["uuid1","uuid2"],"updates":{"status":"approved"}}' | jq
```

### Impact (blast radius)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/impact/<parameterId>" | jq
# => { parameterId, parameterName, requirements[], traceLinks[], components[], functions[] }
```

### Version history

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/versions/<parameterId>" | jq
```

### Export (CSV / JSON / XLSX)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/export/csv" -o parameters.csv
```

### Parameter folders

```bash
# List folders
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/folders" | jq

# Create folder
curl -s -X POST "$API/parameters/$PROJECT_ID/folders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Powertrain","color":"#f59e0b","parentId":null}' | jq
```

---

## REST — AI endpoints

Three-layer gate: `FEATURES_AI_ENABLED` env + `Project.aiEnabled` + package tier includes `ai`. Any layer off → `403 { code: "AI_DISABLED_ENV|AI_DISABLED_PROJECT|AI_DISABLED_PACKAGE" }`.

### Ping

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/parameters/$PROJECT_ID/ai/ping" | jq
# => { success: true, data: { projectId, userId, ts } }
```

### Draft a parameter

```bash
curl -s -X POST "$API/parameters/$PROJECT_ID/ai/draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description":"tail rotor torque under autorotation",
    "contextText":"Rotorcraft, emergency descent; measured at gearbox output"
  }' | jq
```

Response:

```json
{
  "success": true,
  "data": {
    "draft": {
      "name": "tail_rotor_torque_autorot",
      "description": "Torque at tail rotor during autorotation",
      "dataType": "float",
      "defaultValue": "0",
      "unit": "Nm",
      "minValue": "-500",
      "maxValue": "500"
    },
    "provenance": {
      "model": "claude-opus-4-7",
      "modelVersion": "2026-04-01",
      "promptId": "prompt_v1_parameter_draft",
      "contextHash": "abc123...",
      "tokensIn": 312,
      "tokensOut": 187
    },
    "invocationId": "uuid..."
  }
}
```

Provider precedence (per request):
1. User has active `UserAiCredential` for `AI_DEFAULT_PROVIDER` → BYOK (decrypted once, zeroed after use).
2. Else env `ANTHROPIC_API_KEY` (hosted default, Option C).

Errors:
- `400 { error: "description (>= 3 chars) is required" }`
- `403 { error: "...", code: "AI_DISABLED_*" }`
- `500 { error: "<adapter error>" }` — LLM call failed; `AiInvocation` row still written with `success=false`.

---

## REST — BYOK credentials

User-scoped. Plaintext only on create; never returned again.

### Create

```bash
curl -s -X POST "$API/ai/credentials" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"anthropic",
    "label":"Personal Claude key",
    "plaintextKey":"sk-ant-api03-..."
  }' | jq
```

Response includes `maskedTail` (last 4 chars) + metadata. No `keyCiphertext` ever leaves the backend.

Supported providers: `anthropic`, `openai`, `azure`, `google`, `self_hosted`. Only `anthropic` adapter is live; others are schema-declared pending adapter impl.

### List (caller's only — admins get no cross-user access)

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API/ai/credentials" | jq
```

### Revoke

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API/ai/credentials/<credentialId>" | jq
```

---

## Admin — MCP key management

Guarded by `requireAdmin` → only `SUPERIOR_ADMIN` / `COMPANY_ADMIN` / `ADMIN_EMAILS` reach these.

### Issue

```bash
curl -s -X POST "$API/admin/projects/$PROJECT_ID/mcp-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Claude Desktop — alice",
    "scopes":["read","draft","review","impact"],
    "itarScope":false,
    "expiresAt":"2026-12-31T23:59:59Z"
  }' | jq
# => { success: true, data: { id, plaintext: "mcp_a1b2..." } }
```

**Plaintext returned once.** Copy immediately or issue a new key.

Scope → tool mapping:

| Scope | Tools |
|---|---|
| `read` | `list_parameters`, `get_parameter`, `search_parameters` |
| `draft` | `draft_parameter`, `accept_parameter` |
| `review` | `review_parameter` |
| `impact` | `impact_parameter` |
| `itar` (boolean flag) | sees `classification=itar` rows in any read tool |

### List (all keys for a project, revoked included)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/admin/projects/$PROJECT_ID/mcp-keys" | jq
```

### Revoke

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API/admin/projects/$PROJECT_ID/mcp-keys/<keyId>" | jq
```

---

## MCP — Streamable HTTP protocol

JSON-RPC 2.0 over Streamable HTTP (MCP protocol `2025-11-25`). Single URL: `/api/v1/mcp`. Key auth only (no JWT — MCP clients authenticate with the scoped API key).

```bash
MCP="http://localhost:5000/api/v1/mcp"
MCP_KEY="mcp_a1b2..."

HEADERS=(
  -H "Authorization: Bearer $MCP_KEY"
  -H "Accept: application/json, text/event-stream"
  -H "Content-Type: application/json"
)
```

### Initialize (required first call)

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":1,"method":"initialize",
  "params":{
    "protocolVersion":"2025-11-25",
    "capabilities":{},
    "clientInfo":{"name":"curl-test","version":"1.0"}
  }
}'
```

### List tools

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":2,"method":"tools/list"
}'
```

### Call tools

**`list_parameters`** — paged read.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"list_parameters","arguments":{"page":1,"pageSize":20,"status":"approved"}}
}'
```

**`get_parameter`** — by id or name.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":4,"method":"tools/call",
  "params":{"name":"get_parameter","arguments":{"name":"main_battery_voltage"}}
}'
```

**`search_parameters`** — substring over name + description.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":5,"method":"tools/call",
  "params":{"name":"search_parameters","arguments":{"query":"battery","limit":10}}
}'
```

**`draft_parameter`** — T1 LLM call, returns draft + invocationId.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":6,"method":"tools/call",
  "params":{"name":"draft_parameter","arguments":{"description":"tail rotor pitch angle"}}
}'
```

**`accept_parameter`** — persists the draft (needs `invocationId` from `draft_parameter`).

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":7,"method":"tools/call",
  "params":{"name":"accept_parameter","arguments":{
    "invocationId":"<from draft>",
    "name":"tail_rotor_pitch",
    "dataType":"float","unit":"deg","minValue":"-30","maxValue":"30"
  }}
}'
```

**`review_parameter`** — T2 LLM critique.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":8,"method":"tools/call",
  "params":{"name":"review_parameter","arguments":{"parameterId":"<uuid>"}}
}'
```

**`impact_parameter`** — T3 deterministic BFS over the derived-parameter DAG.

```bash
curl -s -X POST "$MCP" "${HEADERS[@]}" -d '{
  "jsonrpc":"2.0","id":9,"method":"tools/call",
  "params":{"name":"impact_parameter","arguments":{"parameterId":"<uuid>","depth":5}}
}'
```

Response shape (all tools):

```json
{
  "jsonrpc":"2.0","id":N,
  "result":{
    "content":[{"type":"text","text":"<JSON-stringified tool output>"}]
  }
}
```

---

## Claude Desktop integration

1. Settings → Connectors → **Add custom MCP server**.
2. URL: `https://<host>/api/v1/mcp` (Claude Desktop on user's laptop → backend must be reachable over network, not just `localhost`).
3. API key: plaintext from the admin panel (issued once).
4. Chat: *"What parameters are in project X?"* — Claude lists tools, picks `list_parameters`, calls it.

Deployment notes:
- Anthropic's remote-MCP transport is Streamable HTTP as of protocol `2025-11-25`. SSE-only is deprecated.
- If Anthropic's hosted Claude calls through a managed proxy, allowlist their IP ranges (published on their status page).
- For production, serve over TLS. MCP keys travel in `Authorization: Bearer`; a plaintext HTTP endpoint leaks them.

---

## Audit trail

Every AI action writes an `AiInvocation` row.

```sql
-- Recent calls
SELECT "toolName", tier, success, "contextTokens", "outputTokens", "durationMs", "createdAt"
FROM "AiInvocation"
WHERE "projectId" = '<id>'
ORDER BY "createdAt" DESC LIMIT 20;

-- MCP traffic only
SELECT "toolName", success, "durationMs"
FROM "AiInvocation"
WHERE "agentKeyId" IS NOT NULL
ORDER BY "createdAt" DESC LIMIT 20;

-- REST traffic only
SELECT "toolName", "userId", success
FROM "AiInvocation"
WHERE "agentKeyId" IS NULL
ORDER BY "createdAt" DESC LIMIT 20;

-- Failed calls (debug path)
SELECT "toolName", "errorMessage", "createdAt"
FROM "AiInvocation"
WHERE success = false
ORDER BY "createdAt" DESC LIMIT 20;
```

Columns: `projectId`, `userId`, `agentKeyId`, `toolName`, `tier` (T0-T4), `model`, `modelVersion`, `promptId`, `contextHash`, `inputHash`, `outputHash`, `contextTokens`, `outputTokens`, `success`, `errorMessage`, `durationMs`, `createdAt`.

ISO/IEC 42001 Annex B export endpoint lands in a follow-up (not in this branch).

---

## Security review

### What is protected

| Threat | Mitigation | Where |
|---|---|---|
| JWT theft via stored-XSS | Token in `localStorage`, Axios interceptor attaches; HTTP-only cookies out of scope | `frontend/src/services/api.ts` |
| SQL injection | Prisma parameterised queries throughout; no raw `$queryRaw` in AI / MCP paths | all services |
| BYOK plaintext leak | AES-256-GCM envelope `iv\|\|tag\|\|ciphertext`, base64; DEK from `AI_CREDENTIAL_KEY` via SHA-256; plaintext never returned by any endpoint, decrypted only inside the single outbound call | `backend/src/services/aiCredentials.service.ts` |
| MCP key forgery | SHA-256 hash + constant-time compare (`crypto.timingSafeEqual`); plaintext shown once then discarded | `backend/src/mcp/auth.ts` |
| Cross-project MCP read | Key pins to its issuing `projectId`; no tool accepts a `projectId` argument; `McpAuthContext` is the sole source | all MCP tools |
| Cross-user credential read | `resolveUserKey` / `listCredentialsForUser` filter by `userId`; admins do **not** get elevated decrypt | `backend/src/services/aiCredentials.service.ts` |
| ITAR leak via REST | `buildParameterWhere` excludes `classification='itar'` unless the caller has `SUPERIOR_ADMIN` / `COMPANY_ADMIN` role; count + list both filter | `backend/src/controllers/parameter.controller.ts` |
| ITAR leak via MCP | `hasScope(ctx,'itar')` filter on every read tool; `impact_parameter` prunes ITAR nodes from BFS frontier | `backend/src/mcp/tools/*.ts` |
| Feature-flag bypass | Three-layer `requireAiEnabled` middleware (env + project + package) in front of every `/ai/*` route | `backend/src/middleware/requireAiEnabled.middleware.ts` |
| MCP without TLS in production | Deployment responsibility — this repo does not enforce HTTPS-only | operator config |
| CSRF on AI / admin endpoints | JWT-bearer auth with `SameSite` defaults; no cookie-session for API; MCP uses its own bearer key | |
| Input size bomb on `/ai/draft` | `description` min 3, backend-side no explicit max but Anthropic rate-limits; `contextText` truncated in prompt construction | `aiParameter.service.ts` |
| Model-injection via description | Only sent to LLM as `user` message; no template string interpolation into system prompt; output parsed strictly as JSON | `aiParameter.service.ts` |

### Residual risks

1. **`JWT_SECRET` / `AI_CREDENTIAL_KEY` rotation** — current impl reads from env. Rotating `AI_CREDENTIAL_KEY` orphans every stored BYOK key (by design; users re-paste). Rotating `JWT_SECRET` logs everyone out (acceptable). No managed-KMS hook yet.
2. **MCP key lifetime** — `expiresAt` is optional. Operators must pick a sensible default (90d recommended). No auto-rotation.
3. **ITAR scope is role-based, not per-project** — SUPERIOR_ADMIN sees every project's ITAR rows. Per-project scope is a follow-up.
4. **No OAuth 2.1 + PKCE for MCP** — scoped API keys cover internal trusted agents; OAuth is the fast-follow for external consumers.
5. **MCP server publicly reachable** — by design for Claude Desktop, but document clearly so the operator allowlists upstream IPs (Anthropic / customer proxy) and runs behind a rate-limiter.
6. **BYOK plaintext in-process memory** — decrypted key is a JS string for the duration of one request. V8 strings are immutable and not explicitly zeroed; a heap dump during that window would expose the key. Mitigation is process isolation + short request duration.
7. **AI provider adapter is only `anthropic`** — BYOK UI accepts `openai / azure / google / self_hosted` but the resolver throws `Unsupported AI provider` for them. A user who picks an unsupported provider stores a key that will never be usable until adapter ships.
8. **Audit row logs tokens, not prompts** — `inputHash` / `outputHash` are SHA-256 only. For a full re-run / forensic replay, prompts + outputs would also need retention, which in turn needs a retention policy. Deliberate trade-off.
9. **No rate-limit on `/ai/draft` or MCP** — Anthropic / OpenAI enforce their own limits, but a malicious user with a valid token could burn the operator's hosted key. Add a per-user rate limiter before exposing to untrusted users.
10. **MCP tools do not enforce `lockVersion`** — `accept_parameter` uses `create`, no optimistic-lock check. For update-capable tools (landing in the next phase), `lockVersion` comparison is required.

### Hardening checklist before production

- [ ] Move `AI_CREDENTIAL_KEY` + `JWT_SECRET` to a managed KMS (Vault / AWS KMS / Azure Key Vault).
- [ ] Enforce HTTPS-only in front of `/api/v1/mcp` via reverse proxy.
- [ ] Rate-limit `/ai/*` and `/mcp` per user / per key (per-second + burst).
- [ ] Add MCP-key `expiresAt` default in the admin UI (90 days).
- [ ] Scope ITAR per-project, not by global admin role.
- [ ] Ship OAuth 2.1 + PKCE for MCP and deprecate the static-key path for external clients.
- [ ] Wire axe-core into Playwright; run in CI.
- [ ] Add NDJSON export of `AiInvocation` for ISO/IEC 42001 audits.
- [ ] Stress-test `draft_parameter` with adversarial `description` values (prompt injection hardening).

---

## Plan implementation status

### Shipped on `improve-params-page` (PRs #365–#371)

| PR | Phase | Scope |
|---|---|---|
| #365 | 1c step 1 | Anthropic adapter + `/ai/draft` |
| #366 | 1c b+c+d+e | BYOK + MCP server + 7 tools + admin MCP-keys panel |
| #367 | 3 | Graph view folder containers + diff-only updates |
| #368 | 4 | Board view (Draft / Approved / Obsolete kanban) |
| #369 | 5 | CommunicationsTab resize panes + filter bar + memo'd rows |
| #370 | 6 | Command palette (Cmd/Ctrl+K) |
| #371 | 6 | ITAR filter on REST + `authorType` query |

### Not yet implemented

| Area | Notes |
|---|---|
| OpenAI / Azure / Google / self-hosted adapters | schema-declared, adapters still anthropic-only |
| TypeaheadCombobox for Communications field editor | still a `<select>` |
| ReqIF 1.2 for parameters | OEM ↔ supplier hand-off |
| Baselines UI | create / compare / restore |
| Version diff in drawer | side-by-side field diff |
| Scenario overlays | `{ parameterId → value }` sidebar |
| Bulk-ops job runner | `ParameterBulkJob` table exists; worker not written |
| Multi-user optimistic-locking UI | 409 on stale write + "user X also viewing" chip |
| Per-project ITAR scope | currently role-based |
| OAuth 2.1 + PKCE for MCP | scoped API keys live, OAuth is fast-follow |
| Axe-core in Playwright | accessibility CI |
| Perf SLA harness | p95 gates on paged list / graph render / drag |
| Air-gap Playwright spec | `FEATURES_AI_ENABLED=false` full happy-path |
| `AiInvocation` NDJSON export | ISO/IEC 42001 Annex B |
| MATLAB Toolbox | **separate repo** `engineering-tool-matlab` — not in this repo by design |

**Full plan implemented? No.** Core AI / MCP / Parameters UX is ready. Integration (ReqIF, baselines, scenarios, bulk runner) and compliance (OAuth, per-project ITAR, NDJSON export, axe-core, perf harness) remain.

---

## Gotchas

- `prisma migrate dev` fails in non-interactive shells on Windows. Use `prisma db push` for dev; `prisma migrate deploy` for CI.
- MCP Streamable HTTP needs `Accept: application/json, text/event-stream` on both `POST` and `GET`. Omit it and the SDK rejects.
- `FEATURES_AI_ENABLED=false` removes every AI button and returns 403 on every `/ai/*` and MCP call. Defence / air-gapped customers keep this off.
- Zod version must be `^3.25 || ^4.0` for the MCP SDK's dual-export compat. Older Zod 3.22.x fails type-check.
- MCP server hard-pins requests to the key's `projectId`. A single key cannot jump projects — by design. For multi-project agents, issue multiple keys.
- BYOK `AI_CREDENTIAL_KEY` rotation orphans every stored key. Users must re-paste. In production, use a managed KMS with versioned keys.
- `start.ps1` must run from project root. After a branch merge, run `./start.ps1 --install` to pick up new npm deps.
