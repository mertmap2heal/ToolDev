# Configuration Management Reference

Background for the Configuration Management module (`frontend/src/modules/configuration-management/`, `backend/src/**/cm*`). Anchored in IEEE 828-2012. Use when designing models, sequencing workflows, or mapping UI labels to formal CM terminology.

---

## IEEE 828-2012 — Configuration Management in Systems and Software Engineering

Defines the minimum requirements for CM activities across systems and software. The standard splits CM into five activity areas:

1. **CM planning** — the CM Plan documents tooling, roles, activities per lifecycle phase.
2. **Configuration identification** — every controlled artefact (CI) gets a unique ID, version, and baseline assignment.
3. **Configuration change control** — formal change request → impact analysis → CCB decision → implementation → verification.
4. **Configuration status accounting** — recording and reporting state of each CI and each change request.
5. **Configuration audit** — functional (FCA) and physical (PCA) audits to confirm the as-built matches the as-designed.

### Configuration item (CI) lifecycle
```
Created --> Draft --> InReview --> Released --> Obsolete
                         |            |
                         +-- Locked by Baseline
                         +-- Locked for Release
```
- A CI becomes locked when a baseline snapshots it. Edits to a locked CI require creating a new version.
- Supersession: `Released` CIs cannot be deleted — mark `Obsolete` only.

### Baseline types
| Baseline | Created at | Freezes |
|----------|-----------|---------|
| Functional | SRR | Functional requirements CIs |
| Allocated | PDR | Derived / allocated requirements + architecture CIs |
| Product | CDR / QR | Full design CIs, including test specs |
| Release | pre-delivery | Deliverable set |

Lifecycle phases: SRR (System Requirements Review) → PDR (Preliminary Design Review) → CDR (Critical Design Review) → QR (Qualification Review).

### CCB (Change Control Board)
Change requests route through the CCB. Typical CCB roles, seeded as `AdminRole` templates per company:
- **ConfigManager** — chairs the CCB, owns the CM plan.
- **SystemEngineer** — impact analysis on requirements + architecture.
- **VerificationEngineer** — impact on V&V artefacts.
- **SafetyEngineer** — safety / hazard impact (required for `safetyImpact=true` CRs).
- **CCBMember** — voting member.
- **Auditor** — read-only access to full audit trail.

Enforce role checks via `requireAdminRole(['ConfigManager','CCBMember'])`. Never trust `req.body.signerId` — always derive from `req.user` (review finding #163).

### Deviations and waivers
- **Deviation** — authorisation to depart from the current baseline during production. Typically short-lived.
- **Waiver** — permanent relaxation of a requirement for a specific delivery.

Both need linkage to CIs and an approving authority. Under `strictMode`, both require a cryptographic signer (future work).

---

## ISO 10007:2017 — CM guidelines

Complementary to IEEE 828. Commonly cited by civil aviation and automotive QMS.
Use when a customer asks for ISO 10007 mapping:
- CI identification → §5.2
- Configuration control → §5.3
- Status accounting → §5.4
- Configuration audit → §5.5

---

## EIA-649-C

Industry practice standard, widely used in aerospace/defence. Emphasises:
- **Configuration information** as a product's total definition.
- **Performance-based CM** — CM must enable the product to perform its function.
- **Interchangeability** rules for hardware CIs.

---

## DAL propagation in CM

A CI inherits DAL from the highest-DAL requirement it satisfies. The CM module must:
1. Track DAL on every CI.
2. On CR approval, compute the new DAL of impacted CIs (monotonic non-decrease).
3. Reject a baseline freeze if any required DAL-annotated CI is missing.

---

## strictMode rules (project-scoped)

When `Project.strictMode = true`, the CM module must enforce:
- CIs locked by a baseline are **immutable** — any mutation returns 409.
- Baseline approval requires ≥2 distinct approvers.
- Release approval requires a signed set of roles matching the release target (Customer / Authority / Internal).
- Deviation / Waiver status transitions are append-only in the audit log.
- Change request approval requires an explicit `safetyImpact` flag and, when true, a SafetyEngineer sign-off.

Off-mode: all of these become warnings, not errors, so unregulated customers can iterate faster.

---

## Sources
- [IEEE 828-2012 — IEEE Standards Association](https://standards.ieee.org/ieee/828/10549/)
- [IEEE 828-2012 PDF (Orthant mirror)](https://raw.githubusercontent.com/Orthant/IEEE/master/828-2012.pdf)
- [ISO 10007 — Wikipedia](https://en.wikipedia.org/wiki/ISO_10007)
- [DAU — Configuration Management](https://content1.dau.edu/DAUMIG_se-brainbook_189/content/Management%20Processes/Configuration-Management.html)
