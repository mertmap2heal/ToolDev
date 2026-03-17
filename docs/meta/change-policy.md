# Change Policy

## Purpose

This document defines how changes to the specification documentation are classified, detected, and translated into codebase updates. It supports both human and AI-driven workflows.

---

## Change Classification

### Breaking Change

A change is **breaking** if it:

- Removes an attribute from an entity. `[REMOVE_ATTR]`
- Changes the data type of an attribute. `[CHANGE_TYPE]`
- Restricts cardinality (e.g. `0..n` → `1..n` or `0..1` → `1..1`). `[CHANGE_CARDINALITY]`
- Removes an allowed enum value that may exist in data. `[CHANGE_ENUM]`
- Removes or inverts a traceability relation type. `[CHANGE_RELATION]`
- Removes an API endpoint or request/response field (when API is specified).

**Required actions**: Database migration, API versioning or contract update, frontend and integration updates, release notes.

---

### Non-Breaking (Additive) Change

A change is **additive** if it:

- Adds a new attribute (nullable or with default). `[ADD_ATTR]`
- Adds a new enum value. `[CHANGE_ENUM]`
- Relaxes cardinality (e.g. `1..1` → `0..1`). `[CHANGE_CARDINALITY]`
- Adds a new relation type or entity. `[ADD_ENTITY]` / `[ADD_RELATION]`
- Adds a new validation rule that does not invalidate existing valid data.

**Required actions**: Schema migration (add column/default), API extension, UI update. Backward compatibility MUST be preserved.

---

### Migration-Triggering Change

The following trigger **database and/or application migration**:

- Any attribute add/remove/type change.
- Any change to relationship cardinality or foreign key constraints.
- Any change to unique constraints or indexes referenced in Validation Rules.
- Any change to lifecycle states or transitions (see lifecycle-model).

Migration scripts MUST be deterministic and reversible where required by enterprise policy.

---

## Detection Conventions

### For AI Agents

1. **Baseline**: Assume the current `/docs` tree is the baseline. Compare against previous commit or provided diff.
2. **Entity files**: Diff `## Attributes` tables line-by-line. Each row is one attribute; added/removed/changed rows map to `[ADD_ATTR]`, `[REMOVE_ATTR]`, `[CHANGE_TYPE]`.
3. **Enums**: Diff the "Allowed values" list. New value = additive. Removed value = breaking; check for data migration.
4. **Relations**: Diff "Relationships" table and `traceability-model.md`. Cardinality and relation type changes = migration and cascade review.
5. **Validation**: Diff "Validation Rules" and "Deletion Behavior". Update server-side and client-side validation and delete handlers.

### File-Level Triggers

| File Pattern | Change Type | Primary Impact |
|--------------|-------------|----------------|
| `docs/domain/*.md` | Attribute/relation/enum | Schema, API, UI, validation |
| `docs/relations/traceability-model.md` | Relation type, cardinality, cascade | Schema, API, traceability logic |
| `docs/ui/*.md` | Widget, action, visibility | Frontend only |
| `docs/lifecycle/lifecycle-model.md` | State, transition | State machine, permissions, UI |
| `docs/security/access-control-model.md` | Role, permission | Authorization, UI visibility |
| `docs/audit/audit-log-spec.md` | Event type, payload | Audit writer and queries |

---

## Approval and Sequencing

1. **Document first**: Specification change is committed to `/docs`.
2. **Classify**: Apply this change policy (breaking vs additive, migration-triggering).
3. **Plan**: Migration script (if any), API change, then frontend/integration.
4. **Implement**: Code changes aligned to docs. No undocumented behavior for specified entities.
5. **Verify**: Tests and E2E aligned to requirements and test specs in `/docs`.

---

## Change Impact Notes

| Change Type | Detection | Action |
|-------------|-----------|--------|
| Add attribute | New row in Attributes table | Add column (nullable or default), extend API and UI. `[ADD_ATTR]` |
| Remove attribute | Removed row in Attributes table | Migration to drop column; remove from API and UI. `[REMOVE_ATTR]` |
| Change attribute type | Modified row, Type column | Migration to alter column; update validation and API. `[CHANGE_TYPE]` |
| Add enum value | New line in Enum allowed values | No migration if stored as string; update UI/API docs. `[CHANGE_ENUM]` |
| Remove enum value | Removed line in Enum | Data migration for existing rows; update constraints. `[CHANGE_ENUM]` |
| Change cardinality | Relation table or traceability-model | FK and constraint migration; update cascade/validation. `[CHANGE_CARDINALITY]` |
