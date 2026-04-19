# Safety Analysis Standards Reference

Background for the Safety Analysis module (`frontend/src/pages/Safety/`, `backend/src/**/safety*`). Use this when designing models, validating user input, or mapping UI copy to regulatory terminology.

---

## ARP4761A (SAE, Dec 2023)

Guidelines and methods for conducting the safety assessment process on civil airborne systems and equipment. Revises ARP4761:1996. Canonical reference for FAA / EASA Part 25 safety compliance.

### Process chain
```
FHA  -->  PSSA  -->  SSA
  (function)    (architecture)   (implementation)
               \__________ CCA __________/
                  (common cause analysis)
```

- **FHA** — Functional Hazard Assessment. Performed early. Runs twice: AFHA (Aircraft-level), then SFHA (System-level). Qualitative. Output: list of failure conditions + hazard classifications.
- **PSSA** — Preliminary System Safety Assessment. Top-down; determines how failures lead to the FHA's hazards. Drives derived safety requirements.
- **SSA** — System Safety Assessment. Runs parallel to implementation. Verifies the design meets the requirements from PSSA. Feeds the certification package.
- **CCA** — Common Cause Analysis. Orthogonal to the chain. Zonal analysis + particular-risks analysis + common-mode analysis. Identifies failures that defeat independence.

### Hazard severity (aircraft-level, per AC 25.1309-1A)
| Severity | Failure rate target | Description |
|----------|---------------------|-------------|
| `Catastrophic` | ≤ 1e-9 / flight hour | Hull loss or multiple fatalities |
| `Hazardous` | ≤ 1e-7 / flight hour | Large reduction in safety margins |
| `Major` | ≤ 1e-5 / flight hour | Significant reduction in safety margins |
| `Minor` | ≤ 1e-3 / flight hour | Slight reduction in safety margins |
| `NoSafetyEffect` | no requirement | No effect on safety |

Store as a single `severity` string column on `Hazard`; validate against the enum.

### DAL mapping (DO-178C)
Hazard severity maps to a Development Assurance Level for software:

| Hazard | DAL |
|--------|-----|
| Catastrophic | A |
| Hazardous | B |
| Major | C |
| Minor | D |
| No safety effect | E |

Store DAL as a separate column on Hazard (and propagate to requirements/components downstream).

---

## ISO 26262 (Road vehicles — functional safety, 2018 ed. 2)

Automotive adaptation of IEC 61508. ASIL (Automotive Safety Integrity Level) replaces DAL.

### ASIL determination (Part 3 HARA)
Per hazardous event, assess:
- **Severity S0..S3** — S0 = no injury; S3 = life-threatening.
- **Exposure E0..E4** — E0 = incredible; E4 = high probability (daily driving).
- **Controllability C0..C3** — C0 = controllable in general; C3 = difficult or impossible to control.

ASIL table: `ASIL = f(S, E, C)`. Range: `QM | A | B | C | D` (QM = quality managed, no safety requirement).

Analysis method requirements:
| ASIL | FMEA | FTA |
|------|------|-----|
| A | recommended | recommended |
| B | recommended | recommended |
| C | **highly recommended** | **highly recommended** |
| D | **highly recommended** | **highly recommended** |

Store ASIL as a column on Hazard. Store S/E/C scores as separate columns — needed for HARA audit trail under `strictMode`.

---

## IEC 61508

Generic functional safety for E/E/PE systems. Uses SIL 1..4 instead of ASIL or DAL. Not directly in scope for v1 of the module but both aerospace (DAL) and automotive (ASIL) cross-reference it.

---

## Analysis method data shapes

### FMEA (Failure Modes and Effects Analysis)
Bottom-up. One row per (component × failure mode):
```
component, failureMode, effect, cause,
severity (1..10), occurrence (1..10), detection (1..10),
rpn (= severity * occurrence * detection, 1..1000),
mitigation
```
RPN is ALWAYS computed server-side on write; the client must not set it.

### FTA (Fault Tree Analysis)
Top-down, deductive. Graph with:
- Nodes: `TOP` (one), `AND`, `OR`, `INHIBIT` gates; `BASIC` events.
- Edges: parent-child (gate inputs).
- `BASIC` events carry an optional `probability Float`.
- Compute minimal cut-sets via MOCUS algorithm. Cut-set = minimal set of basic events whose simultaneous occurrence causes the TOP event.

### Markov chain
- States (`safe | degraded | failed` tags).
- Transitions: from → to with `rate Float`.
- Steady-state probability = left-null-space of the rate matrix (π · Q = 0, Σπ = 1).
- Solve with Gauss-Seidel or LU decomposition (use `mathjs` unless smaller footprint required).

---

## UI copy and naming conventions

When labelling UI fields:
- `severity` for aerospace hazard severity (string).
- `asil` for automotive; hide when project domain ≠ automotive.
- `dal` for software/hardware DAL; separate from severity.
- Never use `criticality` as a catch-all — it is ambiguous across standards.

---

## Sources
- SAE ARP4761A (Dec 2023). Commercial document; summaries via [AFuzion](https://afuzion.com/rp-4761a-introduction-avionics-safety-ad/) and [Jama Software](https://www.jamasoftware.com/requirements-management-guide/aerospace-and-defense/understanding-arp4761a-guidelines-for-system-safety-assessment-in-aerospace/).
- ISO 26262:2018. [Embitel FMEA/FTA summary](https://www.embitel.com/safety-analysis-activities-for-iso-26262-compliant-solution-development).
- RTCA DO-178C § 6.3. DAL mapping.
- FAA AC 25.1309-1A. Aircraft failure condition categories.
