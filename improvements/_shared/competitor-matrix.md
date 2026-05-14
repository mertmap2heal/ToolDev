# Competitor Feature Matrix

Synthesized from `competitor-jama.md`, `competitor-polarion.md`, `competitor-codebeamer.md`, `competitor-doors.md`, `competitor-jira-xray.md`, and the strategy documents in `improvements/vision-and-usp.md` and `improvements/ai-ready-vision.md`. All competitor citations and source URLs live in the individual profile files; this matrix only summarises and ranks. Date of synthesis: 2026-05-14.

The matrix is read in three layers:

1. **Pricing, deployment, and aerospace credibility** — the procurement-shaped facts a buyer evaluates first.
2. **Capability-by-capability comparison** — eight dimensions, each broken down into 4–8 sub-capabilities. Cells use a deliberately small vocabulary: **Native**, **Native + Aerospace**, **Native (basic)**, **Add-on (vendor)**, **Add-on (third-party)**, **Custom field / scripted**, **None**, **Roadmap**.
3. **Threat and opening summary** — what each competitor's strongest move means for us, and where the air is cleanest.

The "Us (current)" column reflects what is committed to the schema and shipping in master today. The "Us (target)" column reflects what `vision-and-usp.md` §7–§10 and `ai-ready-vision.md` §6–§8 say must be true at launch.

---

## 0. Procurement-shaped facts

### Pricing

| Vendor | Public list | Typical 10-user-team year | Procurement motion |
|--------|------------|---------------------------|-----|
| Jama Connect | Quote-only | Tens of thousands of USD, four user tiers | Sales-led, slow response cited in reviews |
| Siemens Polarion | Quote-only; SaaS named-user $1,788/yr with 10-user minimum | ~$18k floor before extensions | Quote-only via Siemens or regional reseller; paid add-ons for Jira, Jenkins, DOORS migration, Capella, etc. |
| PTC Codebeamer | ~$102/user/month (3HTI calculator) | ~$12k/yr base; called "very high" for SMBs in Capterra reviews | Enterprise procurement; SaaS or on-prem |
| IBM DOORS Next | ~$820/user/month list; 3-year licence ~EUR 12k/seat | ~$98k/yr base; total cost dominated by services + Jazz infra | Enterprise procurement, multi-year |
| Jira + Xray + R4J + Confluence | Public per-user | $1.9k–$2.2k base; $5k–$10k once add-ons reach Part-11-ish posture | Self-serve credit-card; 15–100 hr admin setup |
| **Us (current)** | Not yet launched | n/a | Self-serve `start.ps1`; Docker + Postgres locally |
| **Us (target)** | Public per-seat, two-tier minimum; free dev tier | Sub-$5k/yr aspiration for 10-engineer team | Self-serve in <15 minutes per `vision-and-usp.md` §8.1 |

### Deployment

| Vendor | SaaS | On-prem | Gov cloud | Hybrid AI |
|--------|------|---------|-----------|-----------|
| Jama Connect | Yes (AWS GovCloud US for ITAR/EAR/DoD) | Yes | AWS GovCloud US | Cloud-managed Advisor |
| Polarion | Polarion X SaaS (Xcelerator Cloud) | Yes (SVN + Tomcat) | unknown | Yes — Copilot can call customer-owned Azure OpenAI |
| Codebeamer | Codebeamer+ SaaS + Azure Marketplace managed | Yes (Win/Linux/Docker) | DoD IL6 / Azure Government Secret (2026) | Yes — Codebeamer AI 1.0 |
| DOORS Next | DOORS Next on Cloud | Yes (Liberty + Db2/Oracle/MSSQL) | Yes via IBM Cloud | Engineering AI Hub (paid add-on) |
| Jira + Xray | Atlassian Cloud (only path forward post-Connect EOL Dec 2026) | Data Center on-prem | Atlassian Government Cloud | Rovo + MCP server (GA Feb 2026) |
| **Us (current)** | None — `start.ps1` developer-local only | n/a | n/a | None |
| **Us (target)** | Multi-tenant SaaS + customer-managed cloud + BYOK + self-hosted | Optional | Roadmap | BYOK + self-hosted (`roadmap.md` B4) |

### Aerospace credibility

| Vendor | DO-178C | DO-254 | ARP4754A | DO-326A | Named A&D customers | Tool-qualification path |
|--------|---------|--------|----------|---------|---------------------|-------------------------|
| Jama Connect | Airborne Systems template kit + AFuzion checklists | Same | Same | Same | "5 of top 10 aerospace; 8 of top 10 space launch"; NASA JPL, Teledyne e2v, REGENT publicly named | TÜV SÜD validated for safety-related development |
| Polarion | Marketed | Inferred | Inferred | Inferred | FAA + unnamed "Global Defense Industries Giant"; no Airbus/Boeing/Lockheed testimonials surfaced | CFR 21 Part 11 audited heavily in medical |
| Codebeamer | Template kit + DO-330 case | Template kit | Referenced in blog only — no named template kit | None confirmed | None public on Boeing/Airbus/Lockheed/Collins scale; flagship references are automotive (BMW, Lamborghini, Veoneer) and medtech (Medtronic) | DoD IL6 (joint with Windchill, 2026); FDA e-sig in template |
| DOORS Next | De facto standard at primes | Same | Same | Same | Every prime; FAA/EASA workflows | Decades of certification continuity — the bar |
| Jira + Xray | **No aerospace tool-qualification claim across the stack.** | Same | Same | Same | NASA general adoption (Xray); DoD general adoption (Atlassian) — no avionics workflow claim | Only via academic-style discipline (Scrum4DO178C research) |
| **Us (current)** | Cert models present (CertContext / CertObjective / CertBaseline / CertPlan / CertMilestone / CertSignOff) | Schema-ready | Schema-ready | Schema-ready | None — pre-launch | None |
| **Us (target)** | First-class objective engine, opinionated templates, evidence-at-creation | Same | Same first-class | Same first-class | Aerospace-exclusive marketing for first 18 months per `vision-and-usp.md` §11 | Provenance schema + MCP tier guardrails per `ai-ready-vision.md` §6–§7 |

---

## 1. Requirements authoring & traceability

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray stack | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Atomic, ID'd, versioned requirement | Native | Native (Work Item) | Native (tracker item) | Native (object in module) | Custom issue type | Native (`Requirement` + `RequirementVersion`) | Native, immutable ID, full version chain |
| Rich-text inline editing (TipTap-class) | Native (Document View) | Native (LiveDocs) | Native (Document View) | Native (DOORS Next rich-text mode) | None — Wiki via Confluence add-on | Native (TipTap) | Same |
| Word-style document view of a spec | Native | Native — paragraph = Work Item | Native + .docx round-trip via MergeFields | Native | Add-on only | Documentation module renders sections; no LiveDoc parity | LiveDoc-class paragraph-as-object — gap to close |
| Hierarchical numbering | Native | Native | Native | Native | Add-on | Partial (per page) | Native across requirements + documents |
| Atomic-language enforcement (one-verb, one-object) | Native + AI (Advisor) | Add-on (Polarion Copilot, 2512) | Native (AI 1.0 Requirements Assistant) | Add-on (Engineering AI Hub) | None | None | Native — refuses to save malformed requirements per `vision-and-usp.md` §10 |
| INCOSE / EARS rule library | 40 INCOSE rules, 6 EARS patterns (Advisor) | INCOSE Content Validation in Copilot | INCOSE + ISTQB | INCOSE-style (Engineering AI Hub) | None | None | INCOSE + EARS + DO-178C-shaped acceptance criteria |
| Typed trace links (configurable) | Native | Native | Native | Native (typed: Satisfies, Validates, Derives) | One-hop via issue-link types | Native (`TraceLink`) | Same; objective-shaped link types as defaults |
| Suspect-link propagation on upstream change | Native (Live Traceability) | Native | Native | Native | Add-on (easeRequirements "Suspect Logic") | Native (`TraceLink.isSuspect`) | Same + AI-suggested impact |
| Live traceability matrix UI | Native (Coverage Report) | Native (Multilevel Traceability widget) | Native (Coverage Browser, Traceability Matrix plugin) | Native (Links Explorer + tree/grid views) | Add-on (Xray Traceability Report) | Partial — `Traceability` page exists | Objective-completion matrix per `design-system.md` §8.2 |
| Bulk-edit selected items | Native (List View) | Native (Work Items table) | Native (tracker table) | Native | Native (issue list) | Partial | First-class on every list view |
| Advanced typed filtering | Native (Advanced Filters with sub-filters across relationships) | Native (Lucene + SQL pass-through) | Native | Native (queries on artefacts + module) | JQL native | Saved views per `frontend/src/store/savedView` — partial | Advanced filter parity with Jama |

**Where we lag.** LiveDoc-class paragraph = first-class object is a real gap against Polarion, Jama Document View, and Codebeamer Document View. INCOSE/EARS write-time enforcement does not exist. **Where we win.** Schema-ready trace + suspect-flag without the configuration tax; INCOSE enforcement can land as part of the "refuses to save malformed requirements" mechanic (`vision-and-usp.md` §10), which is more opinionated than the competitor "scoring + suggestion" pattern.

---

## 2. Baselining & versioning

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray stack | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Versioned per-artefact history | Native | Native (SVN) | Native | Native (Jazz config mgmt) | Native field history — not snapshot | Native (`RequirementVersion`) — but inconsistent across models | Universal version chain on every cert-relevant artefact |
| Named project-scope baseline | Native | Native (Document Baseline + project) | Native | Native | Add-on (Baseline X / RTM / R4J) | Native (`Baseline` / `BaselineItem`) — Verification has `VerBaseline`, Cert has `CertBaseline` | Single unified baseline primitive across modules |
| Auto-baseline on review start | Native (Review Center) | Configurable workflow | Workflow-based | Configurable | None | None | Native — sign-off implies frozen baseline |
| Baseline diff / compare view | Native (item, set, project diff) | Native (paragraph-level history) | Native | Native (streams + baseline diff) | Limited (snapshot diff in Baseline X) | None | First-class diff |
| Branch a baseline for parallel work | Native (Reuse + Synchronization) | Native (Live-Branch) | Native (Streams + Stream Baselines) | Native (streams + change sets) | Cloning breaks traceability | None | Native; aligned with variant module |
| Electronic signature on baseline | Native (Part 11) | Native (Part 11 workflow gates) | Native (Part 11) | Native (sign baseline electronically) | Add-on (eSign for Jira) | None — `RequirementReview` has approval but no Part-11 binding | Part-11-grade signature with reauthentication, bound to immutable baseline |
| Permanent purge protection on signed artefacts | Implicit | Implicit (SVN) | Implicit | Implicit (Jazz) | Issues can be deleted permanently | Soft-delete on `Requirement` only (6 of 178 models per inventory-models.md) | Audit-grade on all cert-relevant tables |

**Where we lag.** Versioning is inconsistent in the schema — 5 different patterns per `inventory-models.md`. No e-signature primitive bound to baselines. Soft-delete coverage is sparse. **Where we win.** Once unified, "auto-baseline on sign-off" is opinionated by default — engineers cannot forget to freeze the artefact under review.

---

## 3. Review / approval workflows

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray stack | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Configurable review cycle with roles | Native (Review Center) | Native (workflow + signers) | Native (Review Hub UI 3.2) | Native | Add-on (SoftComply eQMS) | `RequirementReview` exists | Native |
| Multi-stage signer chain | Native | Native — different signer sets per stage | Native (per-transition signer rules) | Native (EWM-driven) | Add-on stitched | Partial | Native, opinionated per-DAL templates |
| CFR 21 Part 11 e-signature (reauthenticated) | Native | Native | Native | Native | **Only via eSign + Issue History + Auditor combination** | None | Native — load-bearing for medical extension later |
| Immutable audit trail of every change | Native | Native | Native | Native | **Permanent issue deletion is allowed** — gap in Atlassian | Six separate audit tables, no unified provenance | Universal provenance + immutable audit per `ai-ready-vision.md` §6 |
| Comment / annotation per item or paragraph | Native | Native (paragraph-level) | Native | Native | Native | Native (`RequirementComment`) | Same |
| Change Request workflow integrated with review | Native | Native (Work Item type) | Native | Native (EWM linked) | Add-on | Native (`ChangeRequest` + workflow) | Native; objective-aware impact analysis |
| Quoted review-cycle reduction | "Up to 50%" (Jama claim) | n/a | n/a | n/a | n/a | n/a | Demo target — measurable in pilot |

**Where we lag.** No Part-11 e-signature primitive. Six audit tables instead of one universal provenance log. **Where we win.** Strategy already requires unified provenance and human-only sign-off per `vision-and-usp.md` §8.5 — once built, it is more auditable than the multi-add-on Jira stack and as auditable as Jama/Polarion.

---

## 4. Variant & reuse management

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Branch a spec for variant evolution | Native (Reuse + Sync) | Native (Live-Branch) | Native (Streams + Stream Baselines + Delta Merge β) | Native (streams + change sets) | None (clone-only) | None | Roadmap — variant catalogue per project |
| Feature-model / product-line engineering (150% model) | Add-on (third-party PV connector) | Add-on (pure::variants) | Add-on (Pure Variants 7.2) | Add-on (pure::variants DOORS Next connector) | None | None | Deferred — out of scope first 18 mo per `vision-and-usp.md` §11 |
| Shared / reusable requirements with linked propagation | Native (Global ID) | Native | Native (work-set merging) | Native (reuse pattern — known footgun) | None | None | Roadmap |
| Variant-specific export per delivery | Native | Native | Native | Native (with PV) | None | None | Roadmap |
| Cross-project comparison of variants | Native | Native | Native | Native | None | None | Roadmap |

**Where we lag.** Whole module missing. This is Codebeamer's signature strength. **Where we win.** Per `vision-and-usp.md` §11 this is deliberately a Year-2 expansion — for the small-team A&D ICP, single-product programmes dominate and variant management can ship lean (branch-and-baseline) without a Pure-Variants-class feature model. **Deliberate omission** for first 18 months.

---

## 5. Test management integration

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Native Test Case as first-class object | Native | Native (Polarion QA) | Native | Add-on app (IBM ETM) | Add-on (Xray, Zephyr) | Native (`VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult` — 28 verification models) | Same, with method-of-compliance binding |
| Method-of-Compliance (Test/Analysis/Inspection/Demonstration) primitive | Custom field | Custom field | Custom field | Custom field | Custom field | Native (`VerMoc`) | Native — non-negotiable for applicable DALs per `vision-and-usp.md` §8.2 |
| Bi-directional req ↔ test ↔ defect traceability | Native | Native | Native | Native | Native (Xray) | Native | Same |
| Automated test result ingestion (xUnit / JUnit / NUnit / Robot) | REST API + samples; third-party connectors | xUnit out-of-box + Open API | Jenkins plugins (xUnit, coverage publisher) | ETM (Selenium / Jenkins) | Xray plugins | None — endpoint exists but no parser | Native xUnit + JUnit + Robot + Pytest |
| AI test-case generation from requirement | unknown | unknown | Native (AI 1.0 Test Case Assistant) | unknown | Native (Xray Standard) | None | Native via MCP tools |
| Coverage report (requirement-to-test) | Native | Native (Multilevel Traceability widget) | Native (Coverage Browser) | Native (JRS Report Builder) | Native (Xray Coverage) | Partial | Native |
| Test plan with execution cycles | Native | Native | Native | Native | Native | Native (`VerTestPlan`) | Same |

**Where we lag.** No xUnit/JUnit ingestion service; no AI test-case generator. **Where we win.** Verification schema is already the deepest in any non-Polarion competitor (28 models). With `VerMoc` we are one of the few stacks with the MoC primitive baked in rather than custom-fielded.

---

## 6. Reporting & dashboards

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Out-of-box per-project dashboards | Native | Native (LiveDashboards) | Native (widget-based) | Native (JRS) | Native + Xray gadgets | Partial — `DashboardPage` exists | Objective-completion matrix as default landing |
| Custom report builder | Add-on / Velocity templates | Native (Wiki/LiveReport) | Native | Native (Document Builder, JRS, BIRT) | Add-on (eazyBI) | None | "Audit package as a command" — opinionated outputs per `vision-and-usp.md` §8.3 |
| Traceability matrix report | Native (Coverage Report) | Native | Native | Native (JRS query) | Native (Xray) | Partial | Native, one-command export |
| PSAC / SDP / SVP / SAS / SCI / SECI artefact generation | Manual via Word/Excel template | Manual via LiveReport | Template kit | Manual via Document Builder | Manual | None — `Documentation` module exists with corporate DOCX templates | Native — one command per `vision-and-usp.md` §8.3 |
| Velocity / freeform export templating | Native (paid add-on) | Native (Wiki) | Native (.docx) | Native (Document Builder) | Add-on | Partial (`CorporateDocxTemplate`) | Native opinionated templates; freeform discouraged |
| Scheduled / recurring exports | Native | Native | Native | Native | Add-on | Native (`ScheduledExport`) | Same |

**Where we lag.** Out-of-the-box audit-grade dashboards do not exist yet. **Where we win.** Aiming for "no build-your-own-export-wizard" — DO-178C objective table, PSAC, SAS, SCI, SECI artefacts produced from one command. This is more opinionated than any incumbent and is a marketing differentiator.

---

## 7. API & integration surface

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Documented REST API | Native | Native (OpenAPI; pagination in 2304) | Native (Swagger v2/v3) | Native (OSLC + Reportable REST) | Native (Jira REST v3 + Forge) | Native (Express routes, no OpenAPI yet) | OpenAPI 3.1 served at `/api/v1/docs` per `roadmap.md` B1 |
| ReqIF import/export | Native ("Universal ReqIF") | Native (extended to LiveDocs with test steps) | Native | Native | None | None | Roadmap |
| OSLC linked-data | Limited | Native | Limited | Native (DOORS was an OSLC pioneer) | None | None | Deferred — OSLC + ReqIF only matters for prime-displacement, which is anti-ICP |
| Webhooks | Yes (less documented) | Yes | Yes | Yes (Jazz events) | Native (mature) | Partial (Socket.IO for live UI metrics) | Native webhook surface for CI/CD and customer agents |
| MCP server | Native (first in market, May 2026) | Roadmap (Copilot uses Azure OpenAI, no MCP yet) | Roadmap | Roadmap (Engineering AI Hub) | Native (Rovo MCP Server, GA Feb 2026) | None | Native per `ai-ready-vision.md` §7.2 — must ship at launch |
| AI-participation provenance in API | None | None | None | None | None — Rovo has no certification-grade provenance | Partial (Parameter only) | Universal provenance on every cert-relevant artefact per `ai-ready-vision.md` §6 |
| BYOK / customer-owned LLM endpoint | None | Native (hybrid SaaS calls customer Azure OpenAI) | None | None | None | None | Native per `roadmap.md` B4 |
| Excel round-trip | Native (JCI Excel Functions) | Yes (import wizard) | Native | Yes (Reportable REST) | Yes | Partial (export only) | Native round-trip with validation |
| Jira / Azure DevOps bridge | Native (JCI) | Add-on extension | Native (Jira) | Add-on (OSLC) | n/a | None | Integrate — keep customer's existing task queue per `ai-ready-vision.md` §8.2 |
| Capella / SysML / MATLAB connectors | Native (Cameo, Capella, Sparx EA, Simulink) | Native (Capella via OSLC, Rhapsody from 2410) | Native | Native (Rhapsody) | None | None | Roadmap — A&D-relevant MBSE tools first (Capella, Rhapsody) |

**Where we lag.** No OpenAPI, no webhooks-as-product, no MCP server yet. ReqIF / OSLC absent — both will be requested by buyers comparing to DOORS/Polarion. **Where we win.** Provenance-in-the-data-model is a unique architectural claim no competitor can retrofit credibly. Shipping MCP at launch puts us in a two-vendor club with Jama until Atlassian/PTC/Siemens/IBM catch up. **Critical: Jama shipped first ALM MCP server in May 2026 — "first MCP-native" is no longer claimable. Reposition to "first certification-native MCP" with tier guardrails.**

---

## 8. UX patterns

| Capability | Jama | Polarion | Codebeamer | DOORS Next | Jira+Xray | Us (current) | Us (target) |
|-----|-----|-----|-----|-----|-----|-----|-----|
| Navigation model | Three-pane (Explorer / Item / Relationships) | Wiki + Work Items table + Documents | Tracker tree + dashboards | Project / Component / Stream / Module hierarchy | Backlog / Board / Issue | Sidebar + module pages + detail drawers (per architecture.md) | Streamlined per `design-system.md` §6 |
| Document-style spec view | Native | Native | Native | Native | Add-on (Confluence) | None | Roadmap (LiveDoc-equivalent for SRS / ICD / VVP) |
| Keyboard shortcuts | Reviewers call this average | Power-user-only | Some | Average | Strong | None | Keyboard-first per `design-system.md` |
| Bulk edit | Native | Native | Native | Native | Native | Partial | Native |
| Saved / shareable filters | Native (Advanced Filters with sub-filters) | Native (saved queries) | Native | Native | Native (JQL filters) | Native (`SavedView`) | Same + AI-suggested filters |
| Diff view between versions | Native | Native (paragraph) | Native | Native | Add-on | None | Native |
| Mobile-grade UX | Limited | Limited | Limited | Limited | Native | None | None — out of scope first 18 mo |
| Empty / error / loading states | Generic | Dated | Mixed | Mixed (Carbon 2018) | Generic | Generic loading spinners | Opinionated empty / loading / error per `design-system.md` |
| Visible design age | "Dated" (G2 2026) | "Older and confusing" (G2 2026) | "Overwhelming" (G2 / Capterra 2026) | "Modernised but not modern" (G2 2026) | Modern but generic | n/a | Sets a new aesthetic bar per `ui-research.md` |

**Where we lag.** No document-mode spec view; no diff view yet. **Where we win.** Every public review of the four legacy incumbents in 2026 hammers on UX. Polarion 2512 still ships paid Velocity widgets in 2026. The new tool gets the easiest credibility win in the matrix — modern, opinionated, opinionated again — provided the brand and copy disciplines from `design-system.md` actually land.

---

## 9. Threat and opening summary

| Competitor | Their strongest move against us | Our defence | Strongest opening |
|-----|-----|-----|-----|
| Jama Connect | Live Traceability + auto-baseline + native CFR 21 Part 11 + Airborne Systems template kit + **first ALM MCP server (May 2026)** + #1 G2 grid | Match the MCP server but add **certification-tier provenance** Jama lacks. Compete on opinionated DO-178C objectives engine + price + small-team time-to-value. Treat "ARP4754A / DO-178C objective engine" as our first-class abstraction Jama models as a template. | Aerospace small-team buyers who balk at Jama quote-only pricing and slow sales response; teams who need AI provenance for EASA Level 1/2A. |
| Polarion | LiveDocs + Live-Branch + SVN forensic history + Part 11 + Polarion Copilot (March 2026) + 21+ standards | Compete on UX, time-to-value, total cost. Do not attempt to match LiveDocs depth in v1 — match it via opinionated "spec = document + atomic items" pattern instead. | Small-team buyers; first-time aerospace buyers who cannot afford a Polarion admin; teams who need Part 11 without a Java extension. |
| Codebeamer | Streams + Stream Baselines + Pure Variants 7.2 + Delta Merge + Compliance template kits + Windchill / IL6 + AI 1.0 | Concede variants for 18 months — anti-ICP. Compete on ARP4754A primitives (Codebeamer's named template gap), aerospace UX, price. | Aerospace teams whose templates Codebeamer does not ship (ARP4754A first-class); 3–50-engineer tier priced out of $102/seat/mo. |
| DOORS Next | Aerospace credibility moat at primes; ELM end-to-end story; OSLC + ReqIF; Engineering AI Hub | Do not target primes. Win the small-team segment DOORS is bleeding (8.9% → 6.9% mindshare YoY). Compete on time to first requirement (minutes vs 6 months), no DXL, no Carbon-2018. | Every greenfield aerospace programme under 50 engineers; teams escaping DXL maintenance; teams whose JRS reports "silently drop data." |
| Jira + Xray | Cheap entry; marketplace ecosystem; Rovo + MCP; self-serve procurement | Make TCO honest: $5k–$10k once Part-11 add-ons land. Replace requirements + baselines + objectives + AI provenance + evidence; integrate with Jira as the customer's task queue. | Aerospace teams who outgrew spreadsheets and are about to choose Jira-as-coping-mechanism — intercept them with a certification-native first impression. |

### Three threats to track this year

1. **Jama MCP server (May 2026)** — kills our "first MCP-native" claim. Reposition immediately: **first certification-native MCP, with tier guardrails and AI-participation provenance in the data model**. (See `ai-ready-vision.md` §6–§7 for the differentiation.)
2. **Polarion Copilot (March 2026)** — INCOSE Content Validation + Similarity Analysis + Consistency Check against linked items. Killed the naive "we have AI, they don't" angle. Reposition: **opinionated refusal-at-write-time** is stronger than "score-and-suggest".
3. **Codebeamer AI 1.0 (January 2026)** — Requirements Assistant + Test Case Assistant shipped GA. Same reposition as #2.

### Three openings we should attack first

1. **No competitor has AI-participation provenance in the data model.** Every AI tool from Jama Advisor to Polarion Copilot to Rovo to Engineering AI Hub bolts AI onto the existing schema. The audit story for AI-touched artefacts under EASA Level 2A / EU AI Act / FDA GMLP must be customer-built today. Our provenance schema (`ai-ready-vision.md` §6.1) on every cert-relevant artefact is a durable architectural moat.
2. **No competitor ships an ARP4754A first-class template.** Codebeamer references ARP4754A in blog content; Jama bundles it in Airborne Systems kit but the underlying data model treats it as configuration. A first-class function-level / FDAL primitive is a buyer-visible artefact.
3. **No competitor produces an audit package as a one-command export.** Every incumbent ships "build your own report template" wizards (Velocity, BIRT, Document Builder, Wiki). Our "PSAC / SAS / SCI / SECI in one command from current project state" is a demo moment no incumbent matches.

### Three things every competitor has that we do not yet, ordered by buyer-visibility

1. **CFR 21 Part 11 / DO-178C-grade electronic signature on baselines and review approvals.** Table stakes for any aerospace or medical conversation. Build this before the first paying customer.
2. **ReqIF round-trip.** Required for any OEM-to-supplier exchange. Will be requested by every buyer with one foot still in DOORS or Polarion.
3. **Document-mode spec view (LiveDoc / Document View).** Engineers expect to scroll a specification. The atomic-items-only view is correct for our schema but uncomfortable for migrators.

### Three deliberate omissions per `vision-and-usp.md` §9 — do not chase these

1. **Feature-model product-line engineering (Pure Variants-class).** Out of scope for first 18 months.
2. **Generic configurable workflow engine (Jira-style state machine).** Replaced with opinionated state machines per certification standard.
3. **Custom-field anarchy on requirements.** Out of scope by architectural decision.

---

## 10. Coverage scorecard (capability count, normalised)

Rough count of capabilities marked Native or Native+Aerospace in each profile across all 8 dimensions. Read as a directional indicator, not a verdict.

| Vendor | Native capabilities (of ~60 tracked) | Comment |
|-----|-----|-----|
| Jama Connect | ~50 | Strongest small-team A&D incumbent; AI investment is accelerating |
| Polarion | ~52 | Strongest unified data model; weakest UX |
| Codebeamer | ~48 | Strongest variants; weakest aerospace marketing depth |
| DOORS Next | ~46 (counting full ELM stack as one product) | Highest operational tax in industry |
| Jira + Xray (stack-of-add-ons) | ~30 native + 15 add-on | Cheapest entry, fragmented audit trail |
| **Us (current)** | ~22 native + 12 partial | Verification, requirements core, change requests, certification scaffolding shipped; baselines partial; reviews partial; signatures absent; AI provenance limited |
| **Us (target launch)** | ~45 native + opinionated defaults | Closes ~70% of the gap against Jama-class; remaining 30% is variant management (deferred) and OSLC/ReqIF (deferred unless buyer-blocking) |

---

## 11. Read this matrix together with

- `vision-and-usp.md` — for which competitor features are deliberate omissions vs gaps.
- `ai-ready-vision.md` — for the AI provenance architecture that becomes our durable moat.
- `inventory-models.md` — for the schema gaps (six audit tables, five versioning patterns, polymorphic FKs, sparse soft-delete) that block the "match Jama on baselines + reviews" milestone.
- `inventory-frontend.md` — for the page-level coverage that is currently mock-only (Safety module) or under-guarded (Architecture, Reports placeholders).
