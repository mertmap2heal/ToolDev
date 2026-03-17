# Demo Project: Full-Lifecycle Traceability Dataset

This folder documents the demo dataset used to demonstrate full-lifecycle traceability within the tool.

## Purpose

Generate a comprehensive, realistic dataset for an **Electric Autonomous Delivery Drone** system, with requirements linked across the systems engineering V-model: PBS (Product Breakdown Structure), functions, verification (test cases/plans), baselines, change requests, and issues.

## Domain

**Electric Autonomous Delivery Drone** – a complex system including battery management, navigation, propulsion, flight control, sensors, communication, payload, thermal management, safety, and ground control.

## What Is Created

| Artifact | Count |
|----------|--------|
| Requirements | 100+ (Functional, Performance, Safety, Interface, and related types) |
| Requirement hierarchy | Some requirements have parent/child (e.g. REQ-001 as parent) |
| PBS components | 10–15 (root + children) |
| System functions | 8–15 primary functions |
| Test cases | Enough to link every requirement to ≥1 test case |
| Test plans | At least one plan containing the test cases |
| Test run + results | One demo run with a subset of cases marked PASS |
| Baselines | 3 (e.g. Concept, Design, Integration) |
| Change requests | 5–10, linked to requirements |
| Issues | 5–10+, linked to requirements |
| Use cases | 2–3 with related requirements |
| Parameters | A few key system parameters |
| Requirement comments | Sample comments on requirements |

**Traceability:** Every requirement is linked to at least one PBS component, one function, and one test case. Change request and issue links are visible in the requirements section via the traceability API.

## Features Demonstrated (All Doable Manually)

Everything the seed creates can be recreated by a user through the existing UI/API:

| Feature | How to do it manually |
|--------|------------------------|
| **Project** | Create project (Projects → New). Name e.g. "Demo_Project", domain "Electric Autonomous Delivery Drone". |
| **PBS (Components)** | In project: open PBS / Product Breakdown Structure. Create root component, then add child components (or use sync if your UI supports it). |
| **Requirements** | Requirements → Create requirement. Set type (Functional, Performance, Safety, Interface, etc.), title, description. |
| **Requirement → Component** | Assign requirement to component: requirement detail → assign to PBS component (or drag-and-drop in list view). This creates the allocated_to trace link. |
| **Functions** | Functions → Create function. Add name, description. Optionally assign to PBS component. |
| **Requirement → Function** | Traceability: create link from requirement to function (link type e.g. allocated_to). Or from Traceability view: add link source=requirement, target=function. |
| **Test cases** | Verification → Test cases → Create test case. Add key, title, objective, steps, expected results. Link to method/setup if needed. |
| **Test plan** | Verification → Test plans → Create test plan. Add test cases to the plan (add-case). |
| **Requirement → Test case** | From test case: add verification link to requirement (creates "test case verifies requirement"). Or from Traceability: create link requirement → test_case, linkType verified_by. |
| **Test run** | Verification → Test runs → Create run from plan. Execute and record results (PASS/FAIL) per test case. |
| **Baselines** | Baselines → Create baseline. Choose scope (all requirements or by component/function). Creates snapshot of requirements and trace links. |
| **Change requests** | Change requests → Create. Set source type "requirement", pick requirement, optionally add impacted requirements. Links appear in requirement traceability. |
| **Issues** | Issues → Create issue. Then link issue to requirement (Issues → issue detail → Links → link to requirement). Links appear in requirement traceability. |
| **Use cases** | Use cases → Create use case. Add name, flows; set related requirement IDs if supported by UI. |
| **Parameters** | Parameters → Create parameter. Name, unit, default value. Optionally link to requirements via traceability. |
| **Requirement comments** | Open requirement → Comments → Add comment. |
| **Requirement hierarchy** | Edit requirement → set parent requirement (or use "Move" / "Set parent" in list). |

## How to Run the Seed

From the repository root:

```bash
cd backend
npm run seed:demo
```

Or with a specific project ID (e.g. after creating the project in the UI):

```bash
cd backend
npx tsx src/scripts/seed-demo-project.ts <projectId>
```

If no project ID is provided, the script creates or finds a project with slug `demo-project` (name: "Demo_Project", domain: "Electric Autonomous Delivery Drone") and populates it.

**Prerequisites:** Database is migrated (`npx prisma migrate dev` or `npx prisma db push`), and at least one user exists (e.g. run `npm run seed:users` first so the project can be owned).

## Seed Script Location

The seed logic lives in:

- `backend/src/scripts/seed-demo-project.ts`

Data is defined inline in that script (no separate data files) for consistency with existing seed scripts.
