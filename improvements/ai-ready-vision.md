# AI-Ready Vision — Human-AI Teaming for Certification Work

This document defines what "AI-ready" means for this product. It is sourced from regulatory documents (EASA, FDA, EU AI Act, ISO/IEC 42001), current academic research on LLMs in requirements engineering, and a direct scan of what incumbents and adjacent competitors are already shipping.

The core claim of this document:

> A certification tool must be built for human-AI teaming from the data model outward. Bolting AI onto an existing requirements grid is how incumbents will fail at this. Building the tool so that every object carries AI-participation provenance, so that AI actions obey tiered guardrails derived from certification levels, and so that the platform is natively scriptable by AI agents via MCP and a well-documented API — that is defensible AI-readiness for safety-critical work.

---

## 1. Reality check — is "no one doing this" true?

Partially. Three tiers of AI-readiness in the current market:

### Tier 1 — incumbents with bolted-on AI features

- **Jama Connect Advisor** (Jama Software): an AI sidekick focused on requirement quality, ambiguity detection, and writing suggestions. Scoped to the requirement text itself. Does not re-model the underlying data for human-AI collaboration.
- **Codebeamer AI** (Intland / PTC): assistant-style, integrated into their existing ALM. Limited public documentation of capability tiers.
- **Polarion / Siemens Xcelerator**: AI positioned at the platform layer, not the requirements data model layer.
- **DOORS Next + watsonx**: IBM direction, integration rather than rebuild.

All four are generic ALM platforms that added AI. None were built around AI from the data model outward.

### Tier 2 — regulated-industry AI-native platforms (direct competitor pattern)

- **Ketryx** (medical device focus). Positions explicitly as "AI-native compliance for regulated medical applications." Claims 90% reduction in documentation burden. Uses MCP for real-time compliance context in developer tools. Implements Predetermined Change Control Plans. AI agents with mandatory human-in-loop. Automated traceability across requirements, code, risks, tests.

Ketryx is the first existence proof that the "AI-native, human-in-loop, cert-focused" playbook works commercially. They hold the medical segment. **They do not hold aerospace and defence.** The aerospace space is open for the same playbook, adapted to DO-178C, DO-254, and ARP4754A.

This is the honest framing: we are not inventing a category. We are extending an existence-proven playbook into the aerospace and defence vertical where no Tier 2 player yet exists. That framing is stronger than the false claim that no one is doing this.

### Tier 3 — the incumbents at rest

- Excel, Word, and SharePoint-based requirements processes inside primes and small teams. No AI. This is a majority of the real addressable market.

### What our position actually is

> **The first AI-native requirements and certification environment for aerospace and defence, adapting the medical-device playbook proven by Ketryx to DO-178C, DO-254, and ARP4754A.**

Narrower than "no one does this." Sharper and defensible.

---

## 2. Regulatory landscape for AI in safety-critical work

AI-ready does not mean AI-unconstrained. The regulators have been ahead of most tool vendors in defining the boundaries. These are the sources that bind our design choices.

### 2.1 EASA Artificial Intelligence Roadmap 2.0 (May 2023)

EASA is the authority our primary buyer ships against. The roadmap's three-level classification of AI applications is the single most important external framework for this product:

- **Level 1 AI — human assistance.** AI enhances human capability. The human remains the decision-maker and the accountable party.
- **Level 2 AI — human-AI teaming.** AI makes decisions under human oversight. Subdivided into **2A** and **2B** based on the quality and latency of human oversight.
- **Level 3 AI — advanced automation.** Loss of direct human oversight. Subdivided into **3A** and **3B** based on whether communication or control with the AI is possible at all.

A tool that participates in certification cannot pretend to operate at Level 3. Our design commits to **Level 1 and Level 2A** behaviour: every AI action is either advisory to a human (Level 1) or tentative until a human reviews it (Level 2A). There is no path by which an AI suggestion becomes a signed-off certification artefact without human accountability.

Source: [EASA AI Roadmap 2.0](https://www.easa.europa.eu/en/newsroom-and-events/news/easa-artificial-intelligence-roadmap-20-published), [EASA AI Concept Paper Issue 2](https://www.easa.europa.eu/en/document-library/general-publications/easa-artificial-intelligence-concept-paper-issue-2).

### 2.2 EU AI Act (in force, enforcement through 2026)

Our buyers are EU-based for many programmes and their use of AI in safety-critical engineering tooling is likely to fall under the high-risk category (Annex III: safety components of products covered by Union harmonisation legislation — including aerospace).

Article 9 requires a continuous, documented, lifecycle-long risk management system for any high-risk AI system. Article 26 places obligations on deployers. Fines are up to €35 million.

Practical consequences for our product:

- Every AI feature we ship will itself be an object subject to the AI Act. Our customers will ask whether we have a risk management process for our own AI.
- We ship with AI risk records pre-populated per feature, and our platform exports an AI impact report that our customer can incorporate into *their* AI Act documentation.
- This is a moat. Incumbents who bolted on AI late do not have clean risk documentation for their AI features.

Source: [EU AI Act Article 9 — Risk Management System](https://artificialintelligenceact.eu/article/9/), [Article 6 — Classification of High-Risk AI](https://artificialintelligenceact.eu/article/6/), [Article 26 — Deployer Obligations](https://artificialintelligenceact.eu/article/26/).

### 2.3 ISO/IEC 42001 — AI Management Systems (December 2023)

The international standard for an AI Management System. 38 controls across 9 control objectives, with Annex B dedicated to data quality, provenance, acquisition, and preparation. Certification cycle: 3 years with annual surveillance audits.

Our product is built so that a customer running on it has a significant head start on ISO/IEC 42001 certification for their own engineering AI use. Specifically:

- Full provenance of every AI contribution (Annex B).
- Risk assessment record for every AI feature enabled.
- Documented human oversight on every AI action.
- Exportable evidence package for ISO/IEC 42001 auditors.

This is another thing we bring to the table that incumbents with bolted-on AI cannot: our AI participation is traceable because the product was designed for it.

Source: [ISO/IEC 42001:2023 — AI Management Systems](https://www.iso.org/standard/42001), [A-LIGN — Understanding ISO 42001](https://www.a-lign.com/articles/understanding-iso-42001).

### 2.4 FDA Good Machine Learning Practice (January 2021, updated 2025)

The FDA's ten-principle guiding document applies to medical device SaMD, and the principles transfer directly to aerospace AI-assisted tooling. Relevant points:

- Performance of the collaborative human-AI team is the evaluation unit, not the performance of the AI alone.
- Transparency principles require that users are given clear, essential information about the AI.
- Post-market monitoring of AI performance is required on an ongoing basis.
- Real-world conditions testing is required.

Source: [FDA — Good Machine Learning Practice Guiding Principles](https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles), [FDA AI in SaMD](https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-software-medical-device).

---

## 3. What the research says practitioners want

The November 2025 systematic study *AI for Requirements Engineering: Industry Adoption and Practitioner Perspectives* surveyed 55 practitioners on actual AI usage in RE. The findings directly inform the design:

- **58.2%** of practitioners actively use AI in RE tasks.
- Human-AI Collaboration (HAIC) dominates every RE phase at **49.2%–60.5%** of use.
- Fully autonomous AI is only **3.8%–7.6%** of use.
- **81.2%** of adopters require human review and approval of AI suggestions.
- **71.9%** require the human to be able to override AI.
- Only **37.5%** perform AI risk assessment — this is the governance gap.

Direct quotes on what practitioners want AI to do:
- "AI can transform months-long requirement processes into weeks by providing clear technical specifications."
- "AI tools can use NLP to analyze stakeholder interviews, identify key requirements, flag ambiguities, cross-reference documentation."

Direct quotes on what they explicitly do not want AI to do:
- "Cannot build rapport, establish trust, interpret non-verbal cues, or navigate politically sensitive requirements."
- "Cannot effectively weigh political considerations, business implications, or resource constraints."
- "AI misses subtle compliance interpretations and industry practices that come from years of regulatory interaction."

The two highest barriers cited:
- AI lacks domain expertise, regulatory knowledge, and organisational memory.
- Non-deterministic behaviour hurts reproducibility.

This is the design brief, not guesswork. The product must:

- Assume HAIC, not autonomy.
- Enforce human review and override.
- Close the governance gap by making risk assessment a default, not an opt-in.
- Address domain knowledge through curated, versioned, regulated-industry-specific context supplied to the AI.
- Address non-determinism by fixing AI model version, prompt version, and context snapshot per invocation, recorded in provenance.

Source: [AI for RE — Industry Adoption (arXiv 2511.01324v3)](https://arxiv.org/html/2511.01324v3), [Generative AI for RE — Systematic Literature Review](https://onlinelibrary.wiley.com/doi/full/10.1002/spe.70029).

---

## 4. Core principle — the human-AI accountability model

One rule, derived from EASA Level 1/2A and the FDA's collaborative-team principle:

> **AI proposes. A human disposes. Every cert-relevant act carries a signed human accountability. AI actions never produce a signed artefact without a reviewing human in the provenance chain.**

This is load-bearing. It is enforced in the data model, the UI, the export pipeline, and the API.

Five corollaries:

1. **Every AI contribution is tagged** with the model, version, prompt, and context snapshot at invocation time. Tag is immutable.
2. **Every sign-off is human.** A requirement, verification, or review state cannot reach "approved" or "signed-off" on an AI action. The UI prevents it; the API rejects it; the export pipeline refuses to include it.
3. **Override is one action.** The human reviewer can accept, reject, or edit any AI suggestion with a single keyboard motion, and the provenance updates accordingly.
4. **Blame is traceable.** Every field of every object answers "who changed this?" with either a named human, a named AI model invocation, or a human-accepted-AI tuple. The audit export presents these without filtering.
5. **The AI is not a user.** AI does not have an account. AI does not have sign-off rights. AI is a *tool wielded by an accountable human*, in exactly the same way a compiler is a tool wielded by a developer. The legal, regulatory, and cultural implications of this distinction are serious, and we enforce it.

---

## 5. Guardrail taxonomy — what AI can and cannot do

A tiered capability matrix. Each capability tier is explicitly bounded by the DAL or equivalent of the target objective. Every AI feature in the product is tagged with a tier and obeys it.

| Tier | Name | What AI may do | What AI may not do | DAL applicability |
|------|------|---------------|------------------|-------------------|
| T0 | Read-only assist | Summarise, search, compare, explain | Generate text that becomes an artefact; modify any object | All DALs, all objects |
| T1 | Draft generation | Propose new requirement text; propose verification steps; propose trace links; propose test cases | Save without human review; sign off; classify DAL; select MoC for DAL A/B | All DALs, human review mandatory before save |
| T2 | Review and critique | Flag ambiguity, atomicity violations, inconsistency, broken trace, missing evidence; propose fixes | Apply fixes without human confirmation; close findings | All DALs |
| T3 | Analysis and impact | Compute impact of a proposed change; suggest affected artefacts; propose baseline updates | Execute the change; trigger the baseline; re-approve anything | All DALs, human confirmation required |
| T4 | Automated maintenance | Apply pre-approved, reversible, non-substantive changes (e.g. link updates when an upstream ID changes, trivial typo fixes in descriptions), each logged and reversible | Change any DAL-A or DAL-B artefact in any way; modify verification methods; change MoC; modify objective satisfaction | DAL C/D only, explicitly enabled per project |

Things AI never does, regardless of tier:

- **Final sign-off** on any artefact.
- **DAL classification** of new requirements or functions.
- **MoC selection** for DAL A or DAL B requirements.
- **Regulator-facing decisions** (e.g. "yes, this objective is satisfied"). AI may propose; a human decides.
- **Deletion** of any object with a cert-material link. Deletion is a human-initiated action with audit trail.
- **Baselining.** Baselines are human-initiated and human-signed.

Tier mapping to EASA levels:
- T0, T1, T2, T3 fit within **EASA Level 1** (human assistance) or **Level 2A** (human-AI teaming with active oversight).
- T4 is the outer edge of **Level 2A** and is only permitted where the action class is reversible, non-substantive, and per-project enabled by the lead.
- Nothing in the product aims at **Level 3**.

---

## 6. Provenance model — the audit spine

Provenance is the architectural feature that makes AI safe in a cert tool. The data model reserves structured provenance on every cert-relevant field.

### 6.1 Provenance record schema (per-field, per-object)

```
field_id              REQ-1024.title
value                 "The braking system shall decelerate the vehicle…"
author_type           human | ai_suggestion | ai_accepted | ai_applied
author_human_id       user_42                                    (nullable)
author_ai_model       claude-opus-4-7                            (nullable)
author_ai_version     1.2.3                                      (nullable)
author_ai_prompt_id   prompt_v7_req_draft                        (nullable)
author_ai_context_hash sha256(...)                               (nullable)
review_status         drafted | reviewed | approved | signed_off
reviewer_human_id     user_19                                    (nullable)
review_timestamp      2026-04-17T14:22:11Z                       (nullable)
sign_off_human_id     user_07                                    (nullable)
sign_off_timestamp    2026-04-17T16:01:00Z                       (nullable)
```

This schema applies to every cert-relevant field. The overhead is not optional. The audit export groups by object and presents the full provenance chain.

### 6.2 Audit queries the product must answer instantly

These are the questions a DER or an internal auditor asks, and our product must answer in one click:

- "Show every requirement whose text was originally AI-generated and the humans who reviewed them."
- "Show every trace link where the link was AI-suggested and later confirmed by a human; show the confirmer."
- "Show every sign-off and the sign-off chain that led to it."
- "Show every AI model version that has been used on this project, and when it was active."
- "Show every object where the AI suggestion was overridden by the human and the reason."

None of these should require data export and Excel analysis. The product answers them natively.

### 6.3 What this unlocks

- **ISO/IEC 42001 Annex B evidence** is exportable as a standard artefact.
- **EU AI Act Article 9** risk-management documentation has a data source.
- **EASA Level 2A** claim is defensible because the oversight is not only claimed in prose — it is recorded per field.
- **Customers can themselves achieve AI compliance faster** because the tool has done the mechanical work for them.

This is the single most differentiating thing in the product. It is the spine of the AI-ready claim.

### 6.4 Provenance extends to evidence artefacts

Evidence is the highest-stakes surface for AI participation. A requirement text generated by AI is a proposal a human can override; an evidence document misclassified by AI can cascade into an invalid verification claim. The provenance model therefore extends to every evidence artefact:

```
evidence_id                 EV-0421
source_file                 test_report_brake_actuator.pdf (sha256 hash, immutable)
upload_type                 human_upload | api_upload | integration_ingest
uploaded_by                 user_19
uploaded_at                 2026-04-17T09:12:03Z
parser_type                 human | ai_extract
parser_ai_model             claude-opus-4-7            (nullable)
parser_ai_version           1.2.3                      (nullable)
parser_ai_prompt_id         prompt_v3_test_report      (nullable)
parser_confidence_per_field { test_case_ids: 0.98, pass_fail: 0.92, timestamp: 0.99, ... }
extracted_fields            { test_case_ids: [TC-101, TC-102], pass_fail: "pass", ... }
link_suggestions            [{ requirement_id: REQ-1024, confidence: 0.91, accepted: true, by: user_42, at: ... }]
review_status               extraction_pending | reviewed | rejected | accepted
reviewer_human_id           user_42                    (nullable)
review_timestamp            2026-04-17T11:02:44Z
```

The original file is stored immutably. The parsed fields are stored as proposals until a human accepts them. The link suggestions are stored as proposals until a human accepts them. An evidence record is not valid for inclusion in a certification package until every AI-extracted field has been reviewed by a named human, per its DAL tier.

For DAL A and DAL B evidence, extraction is always T1 — the human review is mandatory and the UI makes rejection as cheap as acceptance (one keystroke). For DAL C and D evidence where the customer enables it, T4 auto-accept is possible for high-confidence extractions (>0.95) with immediate logging and revocable sign-off windows.

### 6.5 RAG citation provenance

Every AI response that draws on the project knowledge base (see §7.5) carries its citation chain as structured data, not as prose. A retrieval answer is rendered in the UI with inline citation chips; the underlying data structure is:

```
rag_response_id            RR-2026-04-17-9f2e
question                   "Which requirements satisfy DO-178C objective A-5.5?"
retrieved_sources          [
  { doc_id: REQ-1024, chunk: 3, similarity: 0.89, used: true },
  { doc_id: VER-077,  chunk: 1, similarity: 0.82, used: true },
  { doc_id: EV-0421,  chunk: 2, similarity: 0.71, used: false }
]
model                      claude-opus-4-7 · 1.2.3
prompt_id                  prompt_v4_objective_query
context_tokens             8420
response_text              "REQ-1024 and VER-077 directly satisfy A-5.5 [REQ-1024][VER-077]..."
confidence_self_reported   0.84
asked_by                   user_19 (via web UI | via MCP)
timestamp                  2026-04-17T14:02:01Z
```

The citations are queryable. The retrieved sources are inspectable. A customer asked to defend an AI-derived claim in a DER meeting has the full chain in one click: which documents were retrieved, which were used, which model, which prompt, which user asked.

This is the operational answer to the "black-box AI" objection. Every AI contribution in the product — draft, extraction, review finding, RAG answer — resolves to a traceable, reviewable, exportable record.

---

## 7. API-first and MCP strategy

The user's explicit ask: "make an API available so that AI can help generate and maintain a database of requirements." This is correct and load-bearing. A tool that an agent cannot drive is a tool that will be replaced by a tool the agent can drive.

### 7.1 API surfaces

Four surfaces, in priority order:

1. **REST API** (OpenAPI 3.1). The primary. Every object and every state transition. Versioned (`/api/v1/`, `/api/v2/` when breaking). Strong types in shared schema. Fully documented at `/docs/api`.
2. **Webhooks.** Outbound events so external systems and agent workflows react to state changes. Signed, deduplicated, retryable.
3. **GraphQL (selective).** Only for the object-graph queries that are painful over REST (cross-object trace queries, project-wide completion matrices). Not a substitute for REST — a specific-use auxiliary.
4. **MCP server.** First-class. The product ships a natively-hosted MCP server exposing the capabilities below (§7.3). Anthropic Claude, OpenAI agents, and any MCP-compliant agent connect directly.

The MCP investment is deliberate. As of April 2026, Forrester projects 30% of enterprise app vendors to launch MCP servers this year, and MCP is on the roadmap to add enterprise-grade auth, audit trails, and gateway patterns. Shipping an MCP server at launch positions us at the front of that wave, not chasing it.

Source: [MCP Roadmap 2026](https://modelcontextprotocol.io/development/roadmap), [Truto — What is MCP](https://truto.one/blog/what-is-mcp-model-context-protocol-the-2026-guide-for-saas-pms), [CData — 2026 Enterprise MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption).

### 7.2 MCP server scope (launch)

The MCP server exposes tools grouped by tier. An AI agent presents credentials, identifies itself, and operates inside the tier boundary assigned to that credential pair.

**Read tools (T0-equivalent):**
- `list_requirements(project, filter)`
- `get_requirement(id)`
- `get_objective_satisfaction(project, standard)`
- `trace_upward(id)`, `trace_downward(id)`
- `search(project, query)`

**Draft tools (T1-equivalent, always produce a review-pending draft):**
- `draft_requirement(project, context, parent_function)`
- `draft_verification_plan(requirement_id)`
- `draft_test_case(verification_id)`
- `suggest_trace_link(requirement_id, candidate_artefacts)`

**Review tools (T2-equivalent, always produce a reviewable finding):**
- `check_ambiguity(requirement_id)`
- `check_atomicity(requirement_id)`
- `check_trace_completeness(project, standard)`
- `propose_fix(finding_id)` (proposal only; application is human-confirmed)

**Impact tools (T3-equivalent):**
- `compute_impact(change_id)`
- `propose_baseline(project, state_id)` (human signs to baseline)

Explicitly not exposed over MCP:
- Sign-off on any object.
- DAL classification.
- Baselining as a single action.
- Deletion of any cert-material artefact.

Every MCP tool call is written into provenance as an AI action, exactly as a web UI interaction would be.

### 7.3 API-first as a product principle, not a checkbox

The tool is built API-first. UI is a consumer of the same API any external agent uses. This discipline has two effects:

- Any AI agent can drive the tool exactly as a human can (within its tier).
- We never ship a feature in the UI that is not available on the API.

A practical consequence: the product is scriptable on day one. A small team can pipe stakeholder emails into an agent that drafts requirements, writes them into the tool as T1 drafts, and presents them for human review. This is exactly the workflow the research shows practitioners want.

### 7.4 Evidence ingestion pipeline — AI-native from upload onward

Evidence upload is the single most painful task in certification work. Incumbents treat the uploaded file as a blob with a description field. Our pipeline treats every upload as a structured extraction opportunity.

**Pipeline stages:**

1. **Upload** — web UI, REST API (`POST /api/v1/evidence`), webhook ingest from CI/CD, or direct API from test management tool. File is stored immutably with cryptographic hash.
2. **Classify** — AI parser identifies the evidence type: test report, analysis report, inspection record, simulation output, coverage report, review record, measurement log, photo/thermal/oscilloscope image. Classification is a proposal until a human confirms.
3. **Extract** — for the classified type, the parser runs a structured extraction that pulls the cert-material fields. For a test report: referenced requirement IDs, test case IDs, pass/fail per case, test timestamps, test environment, signature blocks. For an analysis report: methodology, assumptions, conclusions, MoC justification. Per-field confidence is recorded.
4. **Link** — the parser proposes trace links into the project graph: which requirement this evidence satisfies, which verification it belongs to, which objective it advances. Each link is a proposal.
5. **Review** — the human reviewer sees the original file on the right, the extracted fields and proposed links on the left, and accepts, rejects, or edits each field with a single keystroke. The review step is non-skippable for DAL A/B; optional-auto for DAL C/D above a confidence threshold.
6. **Attach** — accepted evidence becomes a first-class object linked to requirements and verifications. The evidence is now part of the audit graph.

**Supported evidence modalities at launch:**

- **PDF** (native text extraction and scanned-document OCR)
- **Microsoft Word and Excel** (native parsing, including tables and headers)
- **Structured formats** — JSON, XML, CSV, JUnit XML, SARIF, LCOV coverage, Cobertura, cucumber, IEEE-style test reports
- **Images** (thermal plots, oscilloscope screenshots, schematic snapshots, inspection photos) via vision model with measurement-axis awareness
- **Plain text logs** from test rigs, with signal parsers for common aerospace test systems

**Fast-follow modalities:**
- Video evidence (test footage, range-safety recordings) with keyframe extraction and time-synchronised metadata
- CAD and MBSE artefacts (Cameo, Enterprise Architect exports) with structural diff parsing

**Guardrail mapping for evidence AI:**

- **T1 (Draft)**: extraction itself is always T1 — proposal only, human review required.
- **T2 (Review)**: consistency checks across evidence. Does this test report cover every test case the verification plan named? Does it reference a DAL B requirement with a MoC that doesn't apply? The parser emits findings; the human resolves them.
- **T4 (Auto-maintenance)**: only for DAL C/D customers who explicitly enable it, and only for high-confidence link proposals. Every auto-accept is reversible and logged.

**What the parser never does:**
- It never modifies the original uploaded file.
- It never sets pass/fail on a verification without human confirmation, at any DAL.
- It never accepts its own extraction for DAL A/B evidence, regardless of confidence.
- It never re-classifies existing evidence silently when a new model version is released; re-classification is a named action with a new provenance event.

### 7.5 Native RAG — the project knowledge base

Every project auto-builds a versioned, scoped, queryable knowledge base from its own contents. The knowledge base is first-class, not an auxiliary feature.

**What goes into the project KB:**

- All requirements (current and historical versions).
- All verifications, test plans, test cases, test runs.
- All evidence — both the parsed structured fields and the searchable extracted text from the original documents.
- All baselines and their diffs.
- All change requests and their decisions.
- All review threads and sign-off records.
- All objective satisfaction states.
- Project-specific standards references (e.g. the team's annotated copy of DO-178C with local clarifications).
- Custom uploaded references — ICDs, supplier documents, programme-specific guidance.

**What does NOT automatically go in:**

- Raw CI logs beyond the evidence-attached subset.
- Email archives.
- Any artefact not tagged for KB inclusion by its owner.

This scoping is a deliberate trust boundary. A user can see exactly what is in the KB and remove anything from it.

**KB architecture:**

- **Per-project vector store.** Not a tenant-wide store, not a cross-customer store. Each project's embeddings live in an isolated namespace. Aerospace and defence data is ITAR-sensitive; the architecture respects that by default.
- **Embedding model is named.** The customer sees which embedding model generated the vectors (default: Anthropic or an open-source alternative; enterprise: customer choice).
- **Retrieval is auditable.** Every RAG query records which chunks it retrieved and which it used (§6.5).
- **Permissions are inherited.** A user's RAG query cannot retrieve documents they do not have permission to read. The KB does not bypass the RBAC model.

**Model hosting options — bring your own:**

1. **Default tier** — our hosted Anthropic models (Claude Opus, Claude Sonnet, Claude Haiku) via a shared infrastructure with project-scoped data isolation.
2. **BYOK tier** — customer supplies their own Anthropic, OpenAI, or Azure OpenAI key. Requests go to the customer's account with their billing, retention, and compliance posture.
3. **Self-hosted tier** — customer runs their own inference endpoint (open-source model on customer VPC, or Azure OpenAI inside customer tenant, or air-gapped on-prem). The product talks to the customer's endpoint over a documented integration pattern.

The self-hosted tier is important. Defence customers often cannot permit data to leave their tenant, and no amount of third-party contractual promises substitutes for architectural data residency. Shipping self-hosted as a first-class option on day one is a moat against incumbents whose AI features assume vendor-hosted inference.

**Exposing the project KB as a source for the customer's AI:**

The user specifically asked for this: "expose our project requirements directly to an AI hosted by the company, native RAG, or a knowledge base creation."

We ship three surfaces for this:

1. **MCP server with retrieval tools.** `search_project_kb(project, query)`, `get_requirement_with_context(id)`, `retrieve_objective_satisfaction(project, objective_code)`. Any MCP-compliant agent the customer operates — their own Claude-based agents, their own OpenAI agents, internal agent frameworks — connects directly and queries the KB with permissions scoped to the credential.
2. **REST retrieval API.** `POST /api/v1/projects/:id/rag/query` with a question and optional scope filters. Returns cited chunks plus an answer. The customer's AI can call this from any backend.
3. **Exportable KB snapshot.** `POST /api/v1/projects/:id/kb/export` produces a ZIP of all KB content as structured JSON plus original files. The customer can load this into their own vector store if they prefer end-to-end control. The export is a signed snapshot with baseline reference, so the customer can reproduce the KB state later.

**Every RAG answer is a T2 action at most.** It is advisory. The reviewer accepts, rejects, or edits. A RAG answer never becomes a cert-material decision without human sign-off, regardless of confidence. This maps cleanly to EASA Level 1 behaviour.

**What RAG enables in practice:**

- "Which requirements are affected if we change the braking actuator interface?" — returns a list with citations, the engineer reviews.
- "Summarise every test run that contributed evidence for DO-178C objective A-5.5." — returns a structured summary with per-run links.
- "Find gaps: which objectives have requirements but no verification plan yet?" — returns a list.
- "Draft the A-5.3 narrative section for the SAS." — returns a draft with citations; the reviewer accepts, edits, or rejects.
- "What changed between baseline B-2026-03 and B-2026-04 that is relevant to the Stage 3 review?" — returns a structured diff summary.

These are the exact workflows that eat aerospace programme time today. Surfacing them as AI-accelerated, cited, reviewable operations is the demo moment for every aerospace chief engineer.

---

## 8. Integration and tool consolidation strategy

The user's ask splits into two parts: "consolidate other tools" and "integrate with other platforms." These are different strategies. Being explicit about which tool gets which matters.

### 8.1 Consolidate (we replace)

The user currently lives in these tools. We replace them:

- **Word and Excel for requirements.** Replaced entirely. No "export to Word" feature as a first-class workflow; the reason the tool exists is to stop Word-based requirements.
- **SharePoint as requirements repository.** Replaced. We are the repository.
- **Confluence for spec documentation.** Replaced for specification content; retained for broader team documentation.
- **Email threads for review.** Replaced by the first-class Review object (`design-system.md` §8.4).
- **Legacy DOORS installation.** Replaced for greenfield programmes. Migration path, not real-time bridge.
- **Generic Jira ticketing for requirement change requests.** Replaced by the Change Request object. Our change request is cert-aware; a Jira ticket is not.

### 8.2 Integrate (we connect)

These tools stay in the customer's stack. We integrate so our product is the hub, not a silo:

- **Azure DevOps / Jira** (bidirectional) — for engineering tasks, defects, and work items. Requirements flow from our tool to the work queue; defect closure signals back to our verification evidence.
- **Git / GitLab / GitHub** (bidirectional) — commit refs as evidence, PR links to requirements, code coverage attached to verifications.
- **MATLAB / Simulink** (bidirectional) — model links for DO-331 model-based development. Model block → requirement → verification triad is first-class.
- **Cameo / Rhapsody / Enterprise Architect** (unidirectional inbound first, bidirectional later) — SysML models import, system functions and interfaces derived.
- **qTest / TestRail / Azure Test Plans** (bidirectional) — test execution results flow as verification evidence automatically.
- **GitHub Actions / GitLab CI / Jenkins** (inbound) — pipeline run output flows as evidence when tagged.
- **Configuration management tools (Subversion, perforce for legacy primes)** (read-only) — baseline reading for legacy integrations.
- **Identity providers (Okta, Azure AD, Google Workspace)** — SSO and SCIM.

### 8.3 Launch-day integration surface

Not all of §8.2 ships at launch. Launch priority:

1. Azure DevOps (aerospace defence standard for many primes).
2. Jira.
3. Git (provider-agnostic via webhooks + git-plumbing).
4. Okta / Azure AD SSO.
5. qTest or TestRail (one, based on first customer).

MATLAB, Cameo, Rhapsody, Enterprise Architect are fast-follow once the first paying aerospace customer names which they use. We do not speculate on which integrations matter; we follow the first five customers' tool stacks.

---

## 9. Feature roadmap derived from this vision

Concrete features, mapped to the principles above.

### 9.1 Launch (with the first aerospace customer)

- **Provenance on every cert-relevant field** (§6.1). Non-negotiable from day one.
- **Evidence provenance and parsing pipeline** (§6.4, §7.4). PDF, Word, Excel, structured formats, and image-evidence parsing with per-field confidence and human-review gating. DAL A/B auto-accept is impossible; DAL C/D auto-accept is opt-in.
- **Native project knowledge base with RAG** (§7.5). Auto-indexed requirements, verifications, evidence, baselines, reviews. Per-project scoping. Citation-first responses.
- **BYOK and self-hosted model paths** (§7.5). Defence-friendly on day one. Customer choice of Anthropic default, customer API key, or customer-hosted endpoint.
- **Requirement ambiguity detector** (T2, EASA Level 1). In-editor inline highlighting of hedging, ambiguous terms, and shall-language violations.
- **Requirement atomicity check** (T2). Flags requirement text that contains multiple verbs, conjunctions, or success criteria.
- **Trace link suggestion** (T1). When creating a requirement under a system function, the tool suggests candidate trace links based on the function's context. Also runs on uploaded evidence to propose which requirements it satisfies.
- **Verification plan draft** (T1). Upon creating a requirement with a DAL and verification method, the tool drafts a verification plan the human reviews and accepts, rejects, or edits.
- **MCP server** (§7.2, launch scope). Now includes retrieval tools (`search_project_kb`, `get_requirement_with_context`, `retrieve_objective_satisfaction`) and evidence tools (`ingest_evidence_file`, `propose_evidence_links`).
- **REST API v1** (§7.1, full coverage). Includes evidence ingest endpoint and RAG retrieval endpoint.
- **Webhooks** (§7.1). Evidence-parsed, link-proposed, review-pending events.
- **KB export** (§7.5). One-click signed ZIP of the project KB for customers who prefer to host their own retrieval layer.
- **Per-project AI enablement** — the lead explicitly enables each AI feature for each project, with an enablement record.
- **AI usage audit export** — ISO/IEC 42001 Annex B-shaped. Covers evidence parsing and RAG usage in addition to drafting.
- **Azure DevOps and Jira integrations** (bidirectional).
- **SSO via Okta and Azure AD.**

### 9.2 Nine months in

- **Impact analysis agent** (T3). On a proposed requirement or verification change, the agent enumerates affected artefacts and scores them.
- **Review focus mode with AI critique** (T2). The reviewer sees the diff, the AI's ambiguity and atomicity findings, and the proposed fixes, and acts in one keyboard motion.
- **Test case generation** (T1). For a verification plan with a method of Test and a measurable criterion, draft test steps.
- **MBSE model import** (Cameo or Enterprise Architect, based on customer demand).
- **MATLAB / Simulink link maintenance.**
- **Post-release change control plan** (PCCP-equivalent for the tool's AI features — mimicking Ketryx's PCCP pattern).

### 9.3 Eighteen months in

- **Certification package generator with AI-drafted narrative sections** (T1). The PSAC, SDP, SVP, SAS narrative content can be AI-drafted from the underlying structured data, with human review mandated before export.
- **Automated DER pre-check.** A T2 agent walks the whole project and produces a DER findings-ready report listing every unsigned objective, every broken trace, every evidence gap. The DER reviews the report, not the project from scratch.
- **Standard-to-standard migration agent** (T2) for customers moving an existing project from one standard to another (e.g. ARP4754A + DO-178C to add ISO 26262). The agent proposes mappings; humans confirm.
- **First non-aerospace customer** onboarded — likely automotive ISO 26262, as the objective-engine architecture transfers cleanly.

---

## 10. What we refuse to build

Anti-features, named explicitly. These are positioning, not gaps.

- **Fully autonomous requirement generation from customer emails.** The research says practitioners want human-AI collaboration, not autonomy. Our product never advertises "AI writes your requirements." It advertises "AI drafts; you approve."
- **AI sign-off modes.** No setting enables AI to sign off any artefact. Not in the enterprise tier. Not in the on-prem tier. Not ever.
- **Magic "Compliance Co-Pilot" features with no audit trail.** Any "copilot" feature must emit the same provenance every other AI action emits.
- **Sparkles ✨ iconography** (see `design-system.md` §4). AI is labelled plainly.
- **AI features that bypass the tier matrix in §5.** Adding a new AI feature is a process: it gets a tier assignment, a risk record, an enablement switch, a documented guardrail, and provenance coverage. If any is missing, it does not ship.
- **Black-box AI.** The user must be able to see the model, the version, the prompt template identifier, and the context summary behind any AI suggestion. If they cannot, the feature does not ship.
- **AI features that require the customer's data to leave the tenant** unless the customer has explicitly opted in, per feature, with a visible record.

---

## 11. Brand and positioning impact

This vision gives us the second USP, complementary to "certification-native, not ALM-adapted" from `vision-and-usp.md`.

> **Certification-native and AI-native. Built for human-AI teaming from the data model outward. Every AI suggestion is traceable. Every sign-off is human. Every agent integration is first-class via MCP and the API.**

The second USP interacts with the first in a specific way: incumbents who bolt AI onto generic ALM cannot honestly claim AI-native because their data model does not carry AI provenance. We can — because we built for it.

### 11.1 Marketing implications

- **Landing hero now has a second clause.** "Certify in months, not years." plus "Built for human-AI teams." The second clause is optional for the headline but load-bearing in the subhead.
- **A dedicated `/ai` or `/ai-ready` page** is part of the launch website. It covers the human-AI accountability model, the tier matrix, provenance examples, and the MCP server.
- **A public AI model card** lists which third-party AI models our product uses by default, which prompts, what context is sent, and how to self-host a private model.
- **Trust page includes AI posture.** ISO/IEC 42001 alignment statement, EU AI Act readiness statement, SOC 2 statement.
- **Pricing transparency on AI.** If the enterprise tier includes a certain AI quota, it is named. If the customer can bring their own AI key, that is named.

### 11.2 Positioning against Ketryx

If we ever market near medical devices (18-month horizon), we position against Ketryx as follows:

> Ketryx leads medical. We lead aerospace and defence with the same architectural rigour, adapted to DO-178C, DO-254, DO-326A, and ARP4754A. The objective engine, the provenance spine, and the MCP surface transfer across verticals — but the templates, the guardrails, and the DER workflow are aerospace-first.

We do not pretend Ketryx is not there. We concede medical to them for 18 months and take aerospace cleanly.

---

## 12. Risks and open questions

Honest section. The following must resolve before the launch copy commits to AI-ready as a headline claim.

1. **Customer trust in AI for safety-critical.** Aerospace buyers are conservative. Some will reject AI involvement outright. Mitigation: every AI feature is opt-in per project, the tool is fully usable without AI, and the default new-project setting is "AI advisory only, no AI drafts."
2. **Regulator position evolution.** EASA and FAA positions are evolving. A Level 2A assumption that is sound in April 2026 may be constrained further by 2028. Mitigation: the provenance spine is future-proof; the tier matrix is a configuration, not an architectural choice.
3. **Model dependency.** Our AI features depend on third-party models. Availability, price, and capability all drift. Mitigation: the AI layer is pluggable (Anthropic default, support OpenAI, support self-hosted LLMs), and the prompt templates live in source control, not in the model vendor.
4. **Provenance overhead cost.** The provenance schema (§6.1) has a non-trivial storage and latency cost. Mitigation: at the scale of even a large aerospace programme (100k requirements × 20 fields × 10 events each), the storage is measured in gigabytes, not terabytes — trivial for modern Postgres. Latency is tested as part of launch criteria.
5. **Ketryx pivoting into aerospace.** If Ketryx extends its medical playbook into aerospace, we have direct competition with a head start. Mitigation: deliver the aerospace-first DER view (§9.3) and sign the first aerospace customer before Ketryx notices the market.
6. **The research finding that practitioners distrust AI for novel problems.** Aerospace often is novel. AI will help less where it matters most. Mitigation: we do not market AI as a silver bullet. We market AI as making the mechanical parts of certification fast so the engineers spend time on the novel parts.

---

## 13. Summary — what this changes across the rest of the docs

- `vision-and-usp.md` §7 (Core USP) gains a second clause: "certification-native *and* AI-native." §8 adds a fifth supporting USP on human-AI teaming.
- `design-system.md` §2 (design principles) is unchanged in spirit but the "show the standard in context" principle extends to "show the AI contribution in context." Every AI-generated field is visually distinct in the UI with its provenance visible.
- `roadmap.md` §9 will need an AI-ready track added alongside the design-system reskin. MCP server, API v1, and provenance schema sit alongside Phase 1 tokens in importance.
- `ui-research.md` rules hold: the AI UI uses neutral iconography, not sparkles, and the AI suggestion pattern follows the editorial alternating layout principle — critique on the left, proposal on the right, human action in the middle.

---

## Sources

- [EASA AI Roadmap 2.0 announcement](https://www.easa.europa.eu/en/newsroom-and-events/news/easa-artificial-intelligence-roadmap-20-published)
- [EASA AI domain page](https://www.easa.europa.eu/en/domains/research-innovation/ai)
- [EASA AI Concept Paper Issue 2 — Level 1 & 2 ML](https://www.easa.europa.eu/en/document-library/general-publications/easa-artificial-intelligence-concept-paper-issue-2)
- [EU AI Act Article 6 — Classification of High-Risk AI](https://artificialintelligenceact.eu/article/6/)
- [EU AI Act Article 9 — Risk Management System](https://artificialintelligenceact.eu/article/9/)
- [EU AI Act Article 26 — Deployer Obligations](https://artificialintelligenceact.eu/article/26/)
- [ISO/IEC 42001:2023 — AI Management Systems](https://www.iso.org/standard/42001)
- [A-LIGN — Understanding ISO 42001](https://www.a-lign.com/articles/understanding-iso-42001)
- [KPMG — ISO/IEC 42001 for AI Governance](https://kpmg.com/ch/en/insights/artificial-intelligence/iso-iec-42001.html)
- [FDA — Good Machine Learning Practice Guiding Principles](https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles)
- [FDA — AI in Software as a Medical Device](https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-software-medical-device)
- [Ketryx — Complete Guide to FDA AI/ML Guidance](https://www.ketryx.com/blog/a-complete-guide-to-the-fdas-ai-ml-guidance-for-medical-devices)
- [Jama Connect Advisor — AI features](https://www.jamasoftware.com/solutions/artificial-intelligence/)
- [Model Context Protocol — 2026 Roadmap](https://modelcontextprotocol.io/development/roadmap)
- [Truto — What is MCP: 2026 Guide for SaaS PMs](https://truto.one/blog/what-is-mcp-model-context-protocol-the-2026-guide-for-saas-pms)
- [CData — 2026 Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- [BuildBetter — 10 Best MCP Servers for B2B SaaS in 2026](https://blog.buildbetter.ai/best-mcp-servers-b2b-saas-teams-2026/)
- [AI for Requirements Engineering — Industry Adoption (arXiv 2511.01324v3)](https://arxiv.org/html/2511.01324v3)
- [Generative AI for Requirements Engineering — Systematic Literature Review (Wiley)](https://onlinelibrary.wiley.com/doi/full/10.1002/spe.70029)
- [Frontiers — LLMs in Software Requirement Engineering: Systematic Review](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1519437/full)
- [Programming-Helper — AI Guardrails 2026](https://www.programming-helper.com/tech/ai-guardrails-2026-enterprise-safety-guardians-secure-ai-deployment)
- [OneTrust — Responsible AI in 2026](https://www.onetrust.com/blog/responsible-ai-in-2026-a-3-step-guide-for-governance-that-scales/)
- [Cloud Security Alliance — ISO 42001 Auditing and Implementation](https://cloudsecurityalliance.org/blog/2025/05/08/iso-42001-lessons-learned-from-auditing-and-implementing-the-framework)
- [DPO Consulting — High-Risk AI Systems under EU AI Act](https://www.dpo-consulting.com/blog/high-risk-ai-systems)
