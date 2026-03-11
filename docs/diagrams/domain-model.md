# Domain Model Diagram

## Purpose

This document provides a single visual view of all domain entities and their relationships. Attribute details and validation rules are in the entity specs; this page is diagram and index only. Cardinality notation follows [../meta/conventions.md](../meta/conventions.md). Relation definitions are normative in [../relations/traceability-model.md](../relations/traceability-model.md).

---

## Entity-Relationship Overview

```mermaid
erDiagram
  PBS ||--o{ Requirement : "part-of"
  PBS ||--o{ TestCase : "part-of"
  PBS ||--o{ TestPlan : "part-of"
  PBS ||--o{ Function : "part-of"
  PBS ||--o| PBS : "parent"
  Requirement ||--o| Requirement : "derives-from"
  TestCase ||--o{ Requirement : "verifies"
  Function ||--o{ Requirement : "satisfies"
  TestRun ||--|| TestCase : "executed-in"
  TestRun ||--o| TestPlan : "executes_plan"
  TestPlan ||--o{ TestCase : "contains"
  Function ||--o| Function : "parent"
  Requirement }o--o| User : "created_by"
  Requirement }o--o| User : "updated_by"
  TestRun }o--o| User : "executed_by"
  User ||--o{ Role : "has_role"
  PBS {
    uuid id PK
    uuid parent_id FK
  }
  Requirement {
    uuid id PK
    uuid project_id FK
    uuid derived_by FK
  }
  TestCase {
    uuid id PK
    uuid project_id FK
  }
  TestPlan {
    uuid id PK
    uuid project_id FK
  }
  TestRun {
    uuid id PK
    uuid test_case_id FK
    uuid test_plan_id FK
    uuid executed_by_id FK
  }
  Function {
    uuid id PK
    uuid project_id FK
    uuid parent_function_id FK
  }
  User {
    uuid id PK
  }
  Role {
    name PK
  }
```

---

## Relation Legend

| Relation | Source | Target | Cardinality | Description |
|----------|--------|--------|-------------|-------------|
| part-of | Requirement, TestCase, TestPlan, Function | PBS | 1..1 | Entity is scoped to one PBS node (project_id). |
| part-of (parent) | PBS | PBS | 0..1 | PBS node has at most one parent. |
| verifies | TestCase | Requirement | 1..n | Test case verifies one or more requirements. |
| derives-from | Requirement | Requirement | 0..1 | Child requirement derives from one parent. |
| satisfies | Function | Requirement | 1..n | Function satisfies one or more requirements. |
| executed-in | TestRun | TestCase | 1..1 | Test run executes one test case. |
| executes_plan | TestRun | TestPlan | 0..1 | Test run may belong to one test plan. |
| contains | TestPlan | TestCase | 0..n | Test plan contains zero or more test cases (many-to-many). |
| parent | Function | Function | 0..1 | Function may have one parent function. |
| created_by, updated_by | Domain entities | User | 0..1 | Attribution (optional). |
| executed_by | TestRun | User | 0..1 | Executor (optional). |
| has_role | User | Role | 0..n | User has zero or more roles. |

---

## Entity to Spec Index

| Entity | Spec Document |
|--------|----------------|
| PBS | [../domain/pbs.md](../domain/pbs.md) |
| Requirement | [../domain/requirements.md](../domain/requirements.md) |
| Test Case | [../domain/test-cases.md](../domain/test-cases.md) |
| Test Plan | [../domain/test-plans.md](../domain/test-plans.md) |
| Test Run | [../domain/test-runs.md](../domain/test-runs.md) |
| Function | [../domain/functions.md](../domain/functions.md) |
| User | [../domain/users.md](../domain/users.md) |
| Relations (normative) | [../relations/traceability-model.md](../relations/traceability-model.md) |

---

## Change Impact Notes

- Diagram and table MUST be updated when entities or relations change in [../relations/traceability-model.md](../relations/traceability-model.md) or domain specs. `[ADD_RELATION]`, `[REMOVE_RELATION]`, `[CHANGE_CARDINALITY]` in traceability-model imply an update here.
