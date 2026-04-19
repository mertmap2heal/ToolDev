# Interface Management Reference

Background for the Interface Management module (`frontend/src/pages/InterfaceManagement/`, `backend/src/**/interface*`). Grounded in SysML 1.6 and Interface Control Document (ICD) conventions.

---

## SysML primitives for interfaces

SysML models interfaces with two constructs:

- **Port** — a typed interaction point on a Block. Classified as `FlowPort` (directional data / matter / energy flow), `StandardPort` (service-based, with required/provided operations), or `ProxyPort` (transparent to owning block behaviour).
- **Connector** — links two Ports. Usually assembly-internal in an Internal Block Diagram (IBD).

Signals = messages + event data flowing through Ports. Properties on a Signal carry the payload.

---

## Interface data model

Each Interface row represents a connection between two system elements with a defined exchange:

| Field | Notes |
|-------|-------|
| `ifKey` | Display key, e.g. `IF-001`. Atomic allocator per project. |
| `kind` | `Physical | Electrical | Data | Software | HMI` |
| `sourceId` + `sourceKind` | Target table + row — e.g. `component`, `function`, `system`. |
| `targetId` + `targetKind` | Symmetric. |
| `status` | `Draft | Frozen | Released` |
| `constraints` | Free-text array (timing, isolation, redundancy). |
| `technical` | `Json` — kind-specific fields (see below). |
| `signals[]` | Child rows for each message / channel / line. |

### Per-kind technical fields

- **Data** — `protocol` (CAN, ARINC-429, AFDX, Ethernet, SPI...), `baudRate`, `latency`, `direction`, `errorDetection`.
- **Electrical** — `voltage`, `current`, `impedance`, `connectorType`, `pinout`.
- **Physical** — `dimensions`, `material`, `fitTolerance`, `torqueSpec`.
- **Software** — `apiType` (REST, gRPC, IPC), `auth`, `rateLimit`, `schema`.
- **HMI** — `displayStandard` (e.g. ARINC 661), `refreshRate`, `inputDevice`, `accessibility`.

Store these as a flexible `Json` column but validate server-side with a Zod schema per kind to catch typos.

---

## ICD (Interface Control Document)

Two canonical views, both generated from the same underlying model:

### Blackbox ICD
Exposes only the external Ports of the subject Block. For each external Port:
- Name + direction
- Data type + unit
- Rate / protocol
- Min / max / default values
- Error behaviour

Used when handing an interface to a vendor or another team who does not need the internals.

### Whitebox ICD
Adds internal Parts and their Ports. Used for integration testing or for safety assessors who need to trace hazard containment into subsystems.

### Generation pipeline
```
Interface row  -->  GET /:id/icd?format=json   (tabular payload)
                                             \
                                              -->  format=csv   (direct CSV response)
                                              -->  format=docx  (merges into CorporateDocxTemplate)
```
Consistent with the existing `corporate-docx-templates` / `export-jobs` infrastructure.

---

## ARP4754A (aerospace) notes

Although not a strict dependency, aerospace customers expect interfaces to map to ARP4754A:
- Interface requirements flow from the functional architecture.
- Each interface should trace to at least one functional requirement and one verification activity.
- Freezing an interface should be gated by a baseline freeze (link to CM module).

---

## Cross-module responsibilities

| Module | Relationship |
|--------|--------------|
| Architecture (Components / Functions) | Source + target of an Interface — must exist before the Interface is created. |
| Requirements | Interface requirements traced through the existing `TraceLink` table. |
| Verification | Interface test cases — linked via `RiskArtifactLink` / `TraceLink`. |
| Configuration Management | Each Interface is a CI (type `Interface`). Baseline freezes lock edits. |
| Documentation | Evidence packs embed ICD tables via an `artifact_block` referencing the Interface. |
| Safety | Interfaces are zonal-analysis targets for CCA. |

---

## Sources
- SysML 1.6, OMG. Canonical spec behind the Port + Connector + Signal vocabulary.
- [Creating Interface Control Document tables — No Magic / Dassault](https://docs.nomagic.com/spaces/SYSMLP2024xR3/pages/227158880/Creating+Interface+Control+Document+tables)
- [Model-based ICDs — No Magic blog](https://blog.nomagic.com/model-based-interface-control-documents-icd/)
- [Verifying Interfaces and Generating ICDs — OMG / SPIE 2018, Herzig et al.](https://www.omg.org/sysml/Verifying_Interfaces_and_Generating_Interface_Control_Documents-SPIE-2018-Herzig-et-al.pdf)
