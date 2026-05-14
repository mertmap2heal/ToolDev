# Stakeholders — Backend Review

Scope: every backend surface the Stakeholders page reaches, plus cross-module sign-off and audit endpoints that *should* consult the Stakeholders engineering-role table. Per the README the real-vs-mock split is roughly 1:9 — five live endpoints (engineering-role assign/unassign) plus a misleading `inventory.md` attribution.

---

## 1. The `inventory.md` attribution mistake

Row 57 of `inventory.md` reads:

> **Stakeholders** | `/stakeholder` | `comm.routes.ts` (13) | Stakeholder / Committee / ApprovalRule under `modules/stakeholders/` | RACI matrix, communication timeline

Both halves are wrong. `comm.routes.ts` is mounted at `/api/v1/comm/` and exposes `CommBus`, `CommMessage`, `CommField` — parameter communication-bus models (CAN, ARINC-429, AFDX, SPI message definitions) used by the Parameters module. The 13 endpoints are buses + messages + fields CRUD. None touch stakeholder governance. The models column lists `Stakeholder / Committee / ApprovalRule` as if they were Prisma; they are TypeScript interfaces in `frontend/src/modules/stakeholders/types.ts` with no Prisma backing.

**Action.** Correct the row:

> **Stakeholders** | `/stakeholder` | 5 endpoints in `projects.routes.ts` (engineering-role assign/unassign) | `EngineeringRole`, `ProjectUserEngineeringRole`, `UserEngineeringRole`, plus seven aspirational types in `modules/stakeholders/types.ts` (no Prisma model) | RACI / Committees / Approval Rules / Communication / Audit / Settings tabs are client-side reducer state

The `comm.routes.ts` row moves under the Parameters domain.

---

## 2. The five real endpoints

Everything Stakeholders persists today goes through `projectStakeholderRoles.controller.ts` (396 lines) mounted in `projects.routes.ts:44-78`:

| Verb | Path | Handler | Auth chain |
|---|---|---|---|
| GET | `/projects/:id/engineering-roles` | `listProjectEngineeringRoles` | auth → resolveProjectParam → requireProjectMember |
| GET | `/projects/:id/users-with-roles` | `listProjectUsersWithRoles` | same |
| GET | `/projects/:id/me/engineering-roles` | `getMyProjectEngineeringRoles` | same |
| POST | `/projects/:id/engineering-roles/:roleId/assign` | `assignProjectEngineeringRole` | auth → resolveProjectParam → requireProjectOwnerOrAdmin |
| POST | `/projects/:id/engineering-roles/:roleId/unassign` | `unassignProjectEngineeringRole` | same |

**Observations.**

- `seedEngineeringRolesIfEmpty()` runs lazily inside `listProjectEngineeringRoles`. Pragmatic, but it should be a one-time seed script. The first user to view the page on a fresh database pays the cost; under load a race against the unique `name` constraint without `skipDuplicates` is possible.
- `isPlatformAdmin()` mixes `user.role` enum and `process.env.ADMIN_EMAILS`. When an admin email changes, env-edit + restart, not database. Maintenance trap; document or deprecate.
- Audit writes follow the right pattern (`writeAudit` helper) but emit `stakeholder.role.assign` (dot-separated) rather than the canonical `stakeholder:role-assign` from `validation.service.ts`. Reconcile during audit consolidation.
- The four in-controller guards (`assertProjectView`, `assertProjectManageRoles`, etc.) duplicate the route-chain middleware. Belt-and-braces; the controller can trust the middleware.

**No bug found** in the live endpoints — `userIds` to assign are correctly validated as project members. The bug class is what is **missing**: no way to create an `EngineeringRole`, no way to edit a role's `description`, no way to delete a non-system role.

---

## 3. The eight-table promotion plan

Per `frontend.md` §2–§10, seven tabs have client-side types but no Prisma persistence. Minimum schema (all carry the universal provenance lattice per `gap-summary.md` #5):

- **`Committee`** — `id, projectId, name, kind ('CCB'|'ReviewBoard'|'AuthorityInterface'|'SupplierPanel'|'ProgramGovernance'), meetingFrequency, nextMeetingAt, notes, createdAt, updatedAt, deletedAt`. Owns `members[]` and `defaultFor[]`.
- **`CommitteeMember`** — `id, committeeId, userId, committeeRole ('Chair'|'Voting'|'NonVoting'|'Observer'|'Secretary'|'Auditor'), validFrom, validUntil`. Unique `(committeeId, userId)`.
- **`CommitteeDefaultReviewer`** — `id, committeeId, baselineKind`. Bound to `BaselineRoot.kind` (`VER`|`CERT`|`PARAM`|`VALIDATION`|`CM`|`RELEASE`|`SAFETY_GATE`) once the unified baseline primitive lands.
- **`RaciEntry`** — `id, projectId, subjectType ('SystemFunction'|'Requirement'|'CertObjective'|'Component'|'Deliverable'), subjectId, riskFlag, notes, deletedAt`. Polymorphic subject ref (same pattern as `TraceLink`).
- **`RaciAssignment`** — `id, raciId, userId, letter ('R'|'A'|'C'|'I')`. Unique `(raciId, userId, letter)`.
- **`ApprovalRule`** — `id, projectId, appliesToKind ('BASELINE'|'RELEASE'|'CERT_PACKAGE'|'SAFETY_GATE'|'DEVIATION'|'WAIVER'), conditionAst Json (typed AST, not free text), requiredApprovals, twoPersonRule, delegationAllowed, escalationPath, status ('ACTIVE'|'DISABLED'), deletedAt`.
- **`ApprovalRuleGroup`** — `id, ruleId, committeeId`. Joins rules to required committees.
- **`CommunicationEvent`** — `id, projectId, kind ('ANNOUNCEMENT'|'REVIEW_REQUEST'|'DECISION'|'NOTE'), audienceKind ('COMMITTEE'|'ROLE'|'ALL'), audienceRef, summary, body, linkedEntityType, linkedEntityId, sentAt, createdById, deletedAt`.

**Deliberately omitted.**

- **`Stakeholder` table.** A user + engineering roles + committee memberships is already the entity; a separate `Stakeholder` row creates a sync problem with `User`. The `StakeholderUser` shape returned by `listProjectUsersWithRoles` already does this.
- **`StakeholderRequest` table.** Use `Task.kind='STAKEHOLDER_REQUEST'` per `frontend.md` §7.
- **`StakeholderAuditEvent` table.** Use central `AuditLog`. The mock `AuditEvent` and its 16 `AuditAction` values become a controlled-vocabulary list of `AuditLog.action` strings.
- **`Delegation` table.** `ApprovalRule.delegationAllowed` + sign-off "on behalf of" field suffices v1.

---

## 4. Role separation in API — the rule

Per `.claude/project.md` "Roles terminology", every backend endpoint that gates a write or surfaces a list must be explicit about which of the three role concepts it consults:

- **Project membership** — *is this user a project member at all?* — `ProjectMember.status='accepted'` or `Project.userId`. Already in `requireProjectMember` middleware.
- **Admin permission** — *does this user have the admin role to call this kind of endpoint?* — `UserAdminRole` + `AdminRole.defaultPermissions Json`. Used by `requireAdmin`, `requireProjectOwnerOrAdmin`.
- **Engineering role** — *is this user authorised to sign as a Verification Engineer / Configuration Manager / Safety Engineer for this transition?* — `ProjectUserEngineeringRole` for `(projectId, userId, roleId)`.

The bug class to design out: a Validation/Certification/CM sign-off endpoint comparing against `User.role` (global enum), `signerRoleLabel` (free text), or `requireAdmin` (encodes no discipline). All three are wrong.

The right pattern is a new middleware:

```
requireEngineeringRole(['VerificationEngineer', 'CCBMember'])
```

…that resolves `req.params.projectId`, looks up the seeded `EngineeringRole.id` per name, queries `ProjectUserEngineeringRole` for `(projectId, userId=req.user.userId, roleId IN [...])`, and rejects 403 if no row matches. Single chokepoint for closing the free-text-signer-role defect (`ValidationSignOff.signerRoleLabel` the canonical example).

---

## 5. Integration with Certification sign-offs

`CertSignOff` today is a row. No documented check that the signer holds a relevant engineering role; no `requiredRole` column on the objective being signed.

Two integration points:

1. **Per-objective required role.** `CertObjective` gains `requiredEngineeringRoleId String?` (nullable). When set, the sign-off endpoint runs `requireEngineeringRole([role.name])` before writing `CertSignOff`.
2. **Default-reviewer chain from Committee.** When a `CertBaseline` is approved, Cert looks up `CommitteeDefaultReviewer` for `baselineKind='CERT'` and surfaces those committee members as suggested reviewers. The link that `Committee.defaultReviewersFor` in the mock type was aiming at.

Both integrations are zero-cost once the middleware and `CommitteeDefaultReviewer` table exist.

---

## 6. Integration with CM CCB roles

Per `configuration-management.md` KB, the CM module needs six seeded roles (`ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor`). Cross-cutting refactor #5 in `gap-summary.md` phrases them as `AdminRole` templates — but the use case (*who can chair a CCB on this project?*) is a discipline question.

**Resolution.** Seed them as **`EngineeringRole` rows**, not `AdminRole` templates. Five already exist or have near-equivalents in the 16-name `PREDEFINED_ROLES` array at `projectStakeholderRoles.controller.ts:5-22` (e.g. `Configuration Manager`, `Safety Engineer`, `Systems Engineer`, `Verification Engineer`, `Quality Assurance`). `CCBMember` is the only genuinely new role. Add to the seed list and cross-cutting refactor #5 is mostly done.

The CM module's CCB workflow consults `ProjectUserEngineeringRole` with `roleId = (lookup CCBMember)` to derive the eligible voter set. No new permission table; no parallel role concept. `AdminRole` continues to gate **API write capability**; `EngineeringRole` gates **sign-off authorisation**.

---

## 7. Approval-rule engine

Mock `ApprovalRule.condition` is a free-text string. To become real, two pieces:

**Typed condition AST.** Example — "Cert package on a DAL-A project requires 2 approvals from CCBMember, two-person rule":

```json
{
  "appliesToKind": "CERT_PACKAGE",
  "conditionAst": {
    "op": "AND",
    "args": [
      { "op": "EQ", "field": "project.dal", "value": "A" },
      { "op": "EQ", "field": "package.kind", "value": "PSAC" }
    ]
  },
  "requiredApprovals": 2,
  "requiredRoles": ["CCBMember"],
  "twoPersonRule": true
}
```

**Evaluator that consults the AST on sign-off.** Pseudocode:

```
function evaluateRulesFor(action: { kind, baselineId, signerUserId }) {
  const rules = await prisma.approvalRule.findMany({
    where: { projectId, appliesToKind: action.kind, status: 'ACTIVE', deletedAt: null }
  })
  for (const rule of rules) {
    if (!matchesAst(rule.conditionAst, contextOf(action))) continue
    const requiredRoleIds = await resolveRoleIds(rule.requiredGroups)
    const eligible = await prisma.projectUserEngineeringRole.findMany({
      where: { projectId, roleId: { in: requiredRoleIds } }
    })
    if (!eligible.some(s => s.userId === action.signerUserId)) return DENY
    if (rule.twoPersonRule && signerHasAlreadySigned(...)) return DENY
    if (countSignaturesSoFar() + 1 < rule.requiredApprovals) return NEED_MORE
  }
  return ALLOW
}
```

This engine is what Cert / Validation / CM need. Build it once in `stakeholders.service.ts` (new file); other modules call it. The "Impact preview" panel becomes real by running the AST across candidate artefacts and surfacing the matched set.

---

## 8. Audit consolidation

Stakeholders' engineering-role writes already follow the central-`AuditLog` pattern (`cross-cutting.md` positive #1). Aligning the rest:

- `<module>:<kebab-verb>` action strings: `committee:create`, `raci:update`, `approval-rule:disable`, `comm-event:post`.
- Promote `AuditLog.details` from `String?` to `Json` so server-side filtering is indexable (caveat from the Validation cross-cut entry).
- Audit tab becomes a filtered view of `AuditLog` where `action LIKE 'stakeholder.%' OR 'committee:%' OR 'raci:%' OR 'approval-rule:%' OR 'comm-event:%'`.
- Delete mock `AuditEvent`, `auditEvents: AuditEvent[]`, `nextEventId`, `appendAudit` from `store.ts`.

---

## 9. Provenance lattice

Per `gap-summary.md` #5, every cert-relevant row carries the eight-column lattice. Stakeholders governance tables are all cert-relevant — a committee membership delta, an approval-rule edit, a RACI change all affect "who signed what." Apply to `Committee`, `CommitteeMember`, `RaciEntry`, `RaciAssignment`, `ApprovalRule`, `CommunicationEvent`.

Backfill is trivial — these are new tables; seed fills `authorType='human'`. The provenance fields let an AI tool that drafts a "default RACI for an avionics programme" mark every entry with `authorType='ai'`, `authorAiPromptId=<prompt>`, `reviewStatus='pending'` — surfacing to the user that the matrix needs review before sign-off.

---

## 10. What stays off the backend roadmap

- `Stakeholder` as a separate Prisma model. Use `User` + `ProjectUserEngineeringRole` + `CommitteeMember`.
- `StakeholderAuditEvent` table. Central `AuditLog` is the right place.
- `StakeholderRequest` table. Use `Task.kind='STAKEHOLDER_REQUEST'`.
- `Delegation` table. `ApprovalRule.delegationAllowed` + sign-off "on behalf of" suffices.
- `Stakeholder.discipline` enum. This is `EngineeringRole.name` under a different name.
