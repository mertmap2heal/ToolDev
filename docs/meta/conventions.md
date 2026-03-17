# Documentation Conventions

## Purpose

This document defines the structural and stylistic conventions used across all specification documents in the aerospace lifecycle management tool. Conformance ensures machine-readability and consistent AI-driven codebase updates.

---

## File Naming

| Rule | Convention |
|------|------------|
| Format | Lowercase, hyphen-separated |
| Pattern | `[entity-or-topic].md` |
| Examples | `requirements.md`, `traceability-model.md`, `access-control-model.md` |

---

## Heading Hierarchy

| Level | Use Case | Format |
|-------|----------|--------|
| H1 | Document title only | Single `#` |
| H2 | Major sections (Overview, Attributes, etc.) | `##` |
| H3 | Subsections within a section | `###` |
| H4 | Optional granular breakdown | `####` |

Do not skip levels. Do not use H1 for section titles within a file.

---

## Table Conventions

- **Header row**: Required. Use pipe `|` for column separation.
- **Alignment row**: Optional. Use `:---`, `:---:`, `---:` for alignment.
- **Empty cells**: Use `—` or leave blank. Do not use "N/A" in schema tables; use `—` for not applicable.
- **No merged cells**: Markdown does not support cell merge; split into multiple tables if needed.

---

## Attribute Type Vocabulary

Use only the following types in Attributes tables:

| Type | Meaning |
|------|---------|
| `string` | Unicode text, length bounded per attribute |
| `text` | Unlimited or large text (e.g. description) |
| `integer` | Signed 32-bit integer |
| `bigint` | Signed 64-bit integer |
| `decimal(p,s)` | Exact numeric; p = precision, s = scale |
| `boolean` | true / false |
| `date` | Calendar date (YYYY-MM-DD), no timezone |
| `datetime` | Date and time with timezone (ISO 8601) |
| `uuid` | UUID v4 identifier |
| `enum` | One of a fixed set; reference enum name |
| `json` | JSON object; structure documented separately |

---

## Cardinality Notation

| Notation | Meaning |
|----------|---------|
| `0..1` | Zero or one |
| `1..1` | Exactly one |
| `0..n` | Zero or more |
| `1..n` | One or more |

Always use this notation in Relationships and traceability tables. No synonyms (e.g. "many", "optional").

---

## Enum Documentation

- Each enum has a **name** (PascalCase).
- List **allowed values** explicitly, one per line or in a table.
- Document **semantic meaning** of each value in one sentence.

---

## Identifiers

- **Primary key**: Document as attribute with type `uuid` (or `integer` if legacy). Name: `id`.
- **External keys**: Name pattern `[target_entity_singular]_id` (e.g. `requirement_id`, `test_case_id`).
- **Unique business keys**: Document in Validation Rules (e.g. unique constraint on `code`).

---

## Change Impact Annotations

Each entity or major spec document MUST include a **Change Impact Notes** section at the end. Use the following tags for machine detection:

- `[ADD_ATTR]` — Adding an attribute: schema migration, API and UI update.
- `[REMOVE_ATTR]` — Removing an attribute: breaking change; migration required.
- `[CHANGE_TYPE]` — Changing attribute type: breaking; migration and validation update.
- `[CHANGE_ENUM]` — Adding/removing/reordering enum values: backward compatibility and UI/API review.
- `[CHANGE_CARDINALITY]` — Changing relationship cardinality: migration and business rule update.
- `[CHANGE_VALIDATION]` — Changing validation rules: API and UI validation update.

---

## Language Rules

- **Active voice**: "The system shall store" not "Stored by the system".
- **Deterministic**: No "may", "might", "can be" without explicit conditions. Use "MUST", "SHALL", "MUST NOT", "MAY" (RFC 2119 style).
- **No marketing**: No superlatives, no vague benefits. State behavior and constraints only.
- **References**: Reference other docs by path: `../domain/requirements.md`, `./traceability-model.md`.

---

## Versioning

- Documents do not embed version numbers in content. Versioning is handled by the change-policy and source control.
- When versioning is added to the product, attribute names such as `version` or `revision` will be defined in the respective entity files.

---

## Change Impact Notes

| Change Type | Detection | Action |
|-------------|-----------|--------|
| Add/remove heading | Structural diff | Update TOC and any cross-references |
| Add/remove table row | Line diff in table | Schema/API/UI update per entity |
| Change enum list | Diff in Enum section | Backward compatibility and migration check |
| Change cardinality | Diff in Relations table or traceability-model | Migration and cascade policy check |
