# Vision, Positioning & Unique Selling Proposition

## 1. Critical reading of the stated ambition

The stated ambition contains two productive tensions that must be resolved before any code, copy, or branding work proceeds. They are addressed head-on here because if they survive into launch messaging, the product loses.

### Tension A — "Easy for any industry" vs "aerospace and defence first"

These two goals pull in opposite directions. Each regulated industry has its own objective catalogue, its own artefact taxonomy, and its own review culture:

- Aerospace software: DO-178C (Tables A-1 through A-10 per DAL)
- Aerospace hardware: DO-254 (verification independence and appendix B)
- Aerospace system: ARP4754A (5 levels of function development)
- Aerospace cyber: DO-326A / ED-203A
- Automotive: ISO 26262 (parts 2–9, ASIL A–D)
- Medical software: IEC 62304 (classes A–C)
- Industrial functional safety: IEC 61508 (SIL 1–4)
- Rail: EN 50128 / EN 50657
- Nuclear: IEC 61513
- Process: IEC 61511

A tool that promises to serve all of them on day one is a generic CRUD database with a custom field for "standard." That is exactly what DOORS, Polarion, and Jama already sell and exactly why procurement at a certification authority considers them expensive and amateur at the same time.

**Resolution.** The tool ships as a certification-native environment for aerospace and defence. The data model and objective engine are designed to extend to other standards later, but the first eighteen months of marketing, defaults, templates, and case studies are aerospace-exclusive. Breadth destroys credibility before depth earns it.

### Tension B — "Easy" vs "Certification framework"

Certification is not hard because the tools are bad. It is hard because regulators intend it to be hard. Promising "easy certification" reads as naive to any DER, any TSO, and any FAA/EASA reviewer. The fastest way to lose aerospace credibility is to market certification as simple.

**Resolution.** We do not market ease of certification. We market ease of the *tool* so the engineer can spend their hours on the certification thinking instead of on the tool. The pain we remove is the tool pain, not the regulatory pain. That distinction is load-bearing in every piece of copy we write.

---

## 2. Vision

> **Make certification a by-product of good engineering, not a parallel bureaucracy.**

One sentence. Internalised by every team member. Applied as a decision rubric: if a feature makes engineering better *and* certification evidence falls out naturally, build it. If a feature only makes certification paperwork easier, question whether we are solving the wrong problem.

## 3. Mission

> **Give a ten-person aerospace team the certification-native requirements environment that a thousand-person prime takes a year to stand up on DOORS.**

Specific on size (ten-person), specific on adversary (DOORS), specific on unit of time (under a year). No adjectives.

## 4. Who we serve — the Ideal Customer Profile

- **Team size:** 3 to 50 engineers. Lead plus a handful of engineers doing both system and software.
- **Industry focus:** aerospace and defence. Subset of automotive and medical only once aerospace share of revenue exceeds 60%.
- **Certification target:** DO-178C (DAL A–D), DO-254, ARP4754A, DO-326A, MIL-STD-882, ISO 9001 AS9100. Future: ISO 26262, IEC 62304.
- **Procurement posture:** self-serve first touch, enterprise contract on expansion. Can decide to buy within a week, not a quarter.
- **Pain signature:** currently using Excel, Word, Jira, or a barely-tolerated DOORS installation; cannot afford a Jama rollout; cannot wait six months to be productive.
- **Primary buyer:** Engineering Director or Chief Engineer. Not a Compliance Manager at a prime.

## 5. Who we explicitly do not serve

Anti-ICP is a positioning document, not a rejection list. Naming it sharpens everything else.

- Teams at primes (Lockheed, Boeing, Airbus) with existing DOORS or Teamcenter installations. We do not displace; we do not integrate deep enough.
- Consumer software teams with no certification obligation. They do not need us and they drag product decisions toward the generic.
- Teams that want infinitely configurable workflows and custom fields. They are the reason DOORS is unusable.
- Compliance-only roles buying a tool for their engineers. We build for engineers first. If compliance staff use the output, that is downstream.
- Enterprises demanding six-month procurement cycles with consulting deployment. Not our entry motion.

The product may one day serve some of these segments. It will not be positioned or priced for them in the first eighteen months.

## 6. Positioning statement

> For small aerospace and defence teams facing DO-178C, DO-254, or ARP4754A certification, this is the first requirements environment where the audit package is a by-product of daily engineering — not a six-month assembly exercise at the end of the programme. Unlike DOORS, Jama, and Codebeamer, which were built as generic ALM platforms and later fitted with certification plug-ins, every object in this tool is shaped by the certification objective it serves.

Four working parts:
1. **Segment:** small aerospace and defence teams.
2. **Problem:** audit package assembly is a separate, manual, end-of-programme exercise.
3. **Category reframing:** certification-native, not ALM-adapted.
4. **Named adversaries:** DOORS, Jama, Codebeamer. Named deliberately. Buyers compare, so we stand in the comparison.

## 7. Core unique selling proposition

> **Certification-native and AI-native. Not ALM-adapted, not AI-bolted-on.**

One sentence, two clauses, both load-bearing. Every derivative message derives from this.

**Certification-native:** every requirement is born with its verification method, its evidence links, and its objective mapping. The data model is DO-178C objectives first, requirements second — the inverse of every incumbent. This is architectural, not cosmetic.

**AI-native:** every object carries AI-participation provenance on every cert-relevant field. AI actions operate inside a tiered guardrail matrix derived from certification levels. The tool exposes its capabilities natively over REST, webhooks, and an MCP server so any agent can drive it within its tier. AI proposes; a human disposes; every sign-off is human.

The two clauses are not separate features. They are interlocked: you cannot do AI-native safely without certification-native provenance, and you cannot ship a modern certification-native tool in 2026 without AI-native workflows. Incumbents who bolted AI onto generic ALM cannot honestly claim AI-native, because their data model does not carry AI provenance. Tools that "add certification" to a generic AI product cannot claim certification-native, because their objective catalogue is a custom field.

Full articulation of the AI-native half in [ai-ready-vision.md](ai-ready-vision.md).

## 8. Supporting USPs

Five supporting pillars. Each one is falsifiable — there is a concrete thing we build or do not build that proves or disproves it.

### 8.1 Zero-rollout

- **Claim:** the team is writing their first certified-structure requirement within fifteen minutes of sign-up.
- **Proof:** pre-wired DO-178C / DO-254 / ARP4754A templates. Objective catalogues shipped as seed data. Project types pre-configured per DAL. No admin configuration required.
- **Anti-proof we commit to:** no consulting engagement, no "professional services package," no setup call required for the free tier.

### 8.2 Evidence-at-creation

- **Claim:** the verification plan and evidence scaffolding exist from the moment a requirement is created — not bolted on later.
- **Proof:** the requirement editor always has a verification method field (Test / Analysis / Inspection / Demonstration) and a MoC link. The object is literally invalid without them for applicable DALs.
- **Anti-proof:** no feature flag hides verification fields. No "Verification-Lite" mode. Non-negotiable.

### 8.3 Audit package as a command, not a project

- **Claim:** the certification package (PSAC, SDP, SVP, SAS, SCI, SECI artefacts) can be generated at any point in the programme, not only at the end.
- **Proof:** one command produces a regulator-ready export of the current state — per-requirement evidence, traceability matrix, objective satisfaction table, review sign-offs.
- **Anti-proof:** no "build your own export template" wizard. Opinionated outputs only.

### 8.4 Opinionated defaults, engineer-respecting depth

- **Claim:** a team that follows the defaults produces an audit-ready project. A team that needs depth can drill into every object.
- **Proof:** strict templates for each standard. Hidden advanced panels for DER/expert overrides. Everything is a first-class object with a full audit trail.
- **Anti-proof:** no "choose your own taxonomy" onboarding. We do not ship a blank canvas.

### 8.5 Human-AI teaming, built into the data model

- **Claim:** every cert-relevant field on every object records who or what produced the value, and every sign-off is traceable to a named human. AI proposes; a human disposes; every suggestion, acceptance, override, and sign-off is an immutable audit event.
- **Proof:** the provenance schema (`ai-ready-vision.md` §6) is present on every requirement, verification, evidence, change request, and review from the first commit. The MCP server (`ai-ready-vision.md` §7.2) exposes capabilities strictly inside a tiered guardrail matrix.
- **Anti-proof:** no AI sign-off mode exists in any tier. The product cannot be configured to let AI approve an artefact. The export pipeline rejects any artefact whose review chain is AI-only.

## 9. What competitors do that we refuse to do

These are deliberate omissions, not gaps.

- **Infinite configurability.** Every DOORS install is a different schema. We ship one opinionated schema per standard and version it centrally.
- **Custom-field anarchy.** We do not allow arbitrary custom fields on requirements. Users who need them are using us wrong.
- **Generic workflow engine.** We do not build a Jira-style state machine. We ship one correct state machine per certification standard.
- **Multi-tenant consulting-led deployment.** We do not sell setup engagements. The tool deploys itself.
- **"AI-powered" features with Sparkles iconography.** AI suggestions are labelled plainly and must cite their evidence. No magic.
- **Roadmaps driven by the largest customer's feature request.** We are opinionated. Feedback weighted by ICP fit, not contract size.

## 10. Vision for the requirement itself

Incumbents model a requirement as a row in a table with a text field and some links. That is why requirements management feels like data entry.

Our model:

> **A requirement is a testable promise, born with an owner, a verification method, a measurable success criterion, a standard objective it satisfies, and an evidence slot waiting to be filled.**

Every field in that sentence corresponds to a first-class property of the object. None of them can be empty for an applicable DAL. The editor enforces atomicity (one verb, one object, one success criterion) and flags ambiguous language inline. The tool refuses to save a malformed requirement the same way a compiler refuses to compile malformed code.

This is the hardest piece of work in the product and the piece that most earns the "certification-native" claim. It is also the demo moment that sells to every aerospace chief engineer who has ever tried to extract a testable requirement from a Word document.

## 11. Expansion roadmap (not for launch messaging)

Internal sequencing only. Not for marketing copy until we have aerospace references.

- **Months 0–9:** aerospace software (DO-178C) as primary, aerospace hardware (DO-254) as secondary.
- **Months 9–18:** system-level ARP4754A and cyber DO-326A added. First paying defence customer.
- **Months 18–30:** expand to automotive ISO 26262 — chosen second because the functional-safety mental model overlaps aerospace significantly.
- **Months 30+:** medical IEC 62304, industrial IEC 61508, rail EN 50128 evaluated based on pipeline demand.

This is deliberately sequential. Each new standard is a case study of the objective engine extending, proving the architecture. It is not a marketing claim until the proof exists.

## 12. Elevator pitch templates

Three versions at three lengths, all grounded in the above.

**Thirty seconds, investor:**
> We sell certification-native requirements management to small aerospace and defence teams. Incumbents like DOORS, Jama, and Codebeamer are generic ALM platforms with certification bolted on — they take six months to roll out and produce inconsistent audit packages. We are the inverse: DO-178C objectives are the root of our data model, every requirement is born with its verification and evidence, and the audit package is one command away. A ten-person team is productive in a day, not a quarter.

**Ten seconds, engineer:**
> DOORS and Jama treat certification as an export format. We treat it as the data model. That means every requirement you write is already audit-shaped, and your cert package is one command, not three months of assembly.

**Three seconds, landing hero:**
> Certify in months. Not years.
> Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not for AI autonomy.

## 13. What must be true for this positioning to survive contact with the market

This is the honest risk section. Any of these failing invalidates parts of the above.

- **Aerospace buyers must value "certification-native" over "feature parity with DOORS."** If they only buy on feature parity, we lose to Jama. Mitigation: the sales motion emphasises the full certification loop, not feature lists.
- **The objective engine must actually extend.** If DO-178C and ISO 26262 cannot share a common model, we will end up rewriting twice.
- **Small teams must have budget.** If aerospace small teams remain on Excel because nobody will approve spend, we sell upmarket and lose positioning.
- **Incumbent inertia must be overcomeable.** DOORS has thirty years of institutional memory behind it. We do not displace primes. We win greenfield.

If any of these break, the positioning bends — but it bends rather than shatters, because the vision and USP are grounded in an architectural difference, not a feature race.
