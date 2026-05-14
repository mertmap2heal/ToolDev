# Competitor — IBM DOORS Next (and Classic DOORS)

The incumbent of aerospace and defence requirements management. Installed at every prime — Lockheed Martin, Boeing, Airbus, BAE Systems — and at every major Tier 1 supplier. "DOORS" is shorthand for "requirements tool" in DO-178C culture, the way "Hoover" is shorthand for vacuum cleaner. Two products under one brand: **DOORS Classic** (9.x, desktop client, DXL-scripted, end of new feature development) and **DOORS Next** (web-based, Jazz/ELM-based, IBM's strategic platform). For aerospace teams the question is rarely "DOORS or not" — it is "still on Classic, migrating to Next, or escaping the family entirely."

## At a glance

| | |
|--|--|
| Vendor | IBM |
| Product (current) | IBM Engineering Requirements Management DOORS Next (part of IBM ELM) |
| Product (legacy) | IBM Engineering Requirements Management DOORS (Classic, 9.7.x) |
| Founded | Telelogic DOORS acquired by IBM 2008; DOORS Next launched on Jazz platform ~2013 |
| Deployment | On-premises (Linux/Windows + WAS Liberty + DB2/Oracle/MS SQL); IBM-hosted SaaS ("DOORS Next on Cloud"); customer-managed cloud |
| Pricing posture | Per-user authorised licence ~USD 820/user/month list, three-year licence ~EUR 12,000/seat; floating + token licences also sold. Total cost dominated by professional services and Jazz infrastructure |
| Aerospace credibility | Effectively unchallengeable — the de facto standard at primes and at FAA/EASA for DO-178C/DO-254/ARP4754A programmes |
| 2026 market mindshare | 6.9% in Application Requirements Management (down from 8.9% YoY — losing ground but still dominant in regulated segments) |

---

## 1. Requirements authoring & traceability

**DOORS Classic** stores requirements as objects inside hierarchical "formal modules" — closer to a structured spreadsheet than a document. Authoring happens through a thick Windows client; every column, view, attribute, and link type is customisable via **DXL (DOORS Extension Language)**, a C-like proprietary scripting language used to write everything from validation rules to import/export tools to in-product reports. DXL is the single biggest source of DOORS lock-in: 20+ years of in-house DXL libraries at primes, none of which port forward. DOORS Next replaces the thick client with a browser UI on IBM's Carbon design system; modules can be authored as either tabular or "rich-text document" style with full TipTap-like inline editing. Traceability is via typed links ("Satisfies", "Validated by", "Derives from") explored through the **Links Explorer** — a graphical diagram showing outgoing links (red, right-arrows) and incoming links (orange, left-arrows) across multiple levels, filterable by direction or link type, plus tree and grid views for hierarchical drilling. ([Wikipedia — DOORS Extension Language](https://en.wikipedia.org/wiki/DOORS_Extension_Language), [Softacus — DOORS Classic vs DOORS Next](https://softacus.com/blog/articles/dng/differences-between-doors-next-generation-and-doors-classic), [Sodius Willert — Traceability links in DOORS Next](https://www.sodiuswillert.com/en/blog/how-to-set-up-create-and-use-traceability-links-in-ibm-doors-next), [Jazz.net — Traceability in DOORS Next](https://jazz.net/library/article/88104))

## 2. Baselining and versioning

DOORS Classic had a simple linear baseline model — snapshot the module at a point in time, attribute history is preserved per object. DOORS Next replaced this with the full **Jazz configuration management** model: every project has one or more **components**, each component has **streams** (mutable working branches) and **baselines** (immutable snapshots). When a component is created an initial baseline is created automatically and a first stream branches from it. Streams can be compared, baselines can be diffed, and **change sets** can be opened on top of a stream to gate edits behind review — semantically similar to a Git branch + pull request. The global tier is **Global Configuration Management (GCM)**: an enterprise application that composes configurations across DOORS Next, EWM, and ETM into a single "global configuration" — needed for any cross-tool traceability under variants or parallel releases. GCM is powerful but operationally heavy: training, server provisioning, and a dedicated configuration-management role are usually all required to make it usable. ([IBM Docs — Configuration management in DOORS Next](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=overview-configuration-management), [Jazz.net — Adding configs to a stream in GCM](https://jazz.net/help-dev/clm/topic/com.ibm.rational.gcapp.doc/topics/t_add_configs2stream.html), [IEEE Spectrum — How GCM and CLM work together](https://spectrum.ieee.org/global-configuration-management))

## 3. Review/approval workflows

Reviews are run through DOORS Next's built-in review feature: requirements (or modules, or baselines) are sent to a list of reviewers who can approve/reject with comments, and the review state is tracked on the artefact. **Baselines can be electronically signed** — DOORS Next allows attaching one or more e-signatures to a baseline for compliance evidence, and the signature event is captured in the immutable history alongside the baseline itself. Deeper workflow (state machines, approval gates with conditional logic, work-item-driven change control) lives in **IBM Engineering Workflow Management (EWM, formerly RTC — Rational Team Concert)**, integrated via OSLC links to requirements; EWM work items can themselves require e-signatures at specific transitions (e.g. CCB approval). DOORS Next keeps a full audit history of every requirement modification — who changed what, when, attribute-by-attribute — viewable from the artefact history tab and queryable through the Lifecycle Query Engine. ([IBM Docs — Signing a baseline electronically](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.2?topic=artifacts-signing-baseline-electronically), [Proexcellency — DOORS Next overview](https://www.proexcellency.com/blogs/sap-online-training/a-complete-overview-of-ibm-rational-doors-next-generation-for-requirements-engineers), [rpeactual — Getting eSignature details from WorkItem](https://rpeactual.wordpress.com/2022/02/18/how-to-get-esignature-details-from-workitem/))

## 4. Variant & reuse management

Native variant management is limited — DOORS Next handles per-stream/per-component branching well, but feature-based product line engineering needs an external add-on. The canonical pairing is **PTC pure::variants** with its DOORS Next connector: a feature model in pure::variants is bound to requirements in DOORS Next, and variant-specific requirement sets are generated by feature selection. Module baselines in DOORS Next (introduced in recent versions) interoperate with pure::variants to lock the requirement set per variant. Reuse-within-DOORS is via the **reuse pattern** — link an object to another module by reference rather than copying it; edits propagate. This pattern is powerful but easy to misuse: cross-module reuse without GCM discipline regularly produces traceability matrices that are silently inconsistent across baselines, a known source of audit findings at primes. ([PTC — pure::variants DOORS Next connector](https://www.ptc.com/en/products/pure-variants/connectors/ibm-engineering-requirements-doors-next), [Medium / Tom Hollowell — Module baselines in DOORS Next with pure::variants](https://medium.com/@tom_80522/embracing-the-evolution-module-baselines-in-ibm-doors-next-with-pure-variants-4ad09b5af4ba), [IBM — Engineering Requirements DOORS family overview](https://www.ibm.com/products/requirements-management))

## 5. Test management integration

The IBM-native pairing is **IBM Engineering Test Management (ETM)**, formerly **Rational Quality Manager (RQM)** before the 2019 Engineering rebrand. ETM and DOORS Next link over OSLC: requirements in DOORS Next can be linked to test plans, test cases, and individual test script steps in ETM, and the link types are bidirectional ("Validated by" / "Validates"). Test results in ETM update the requirement's verification status through the link. The integration covers Classic DOORS too (DOORS 9.6+ over OSLC; the older RQMi integration is deprecated and no longer supported in ETM 5.x+). For DO-178C teams this is the canonical test-evidence path: requirement → test case → test execution → pass/fail, all recorded and baselineable. The downside is the same as everywhere in ELM — ETM is a separate Jazz application with its own server, licensing, role configuration, and operational burden. ([IBM Docs — Integrating DOORS and ETM](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors/9.7.2?topic=integrating-doors-engineering-test-management), [Jazz.net — ETM and DOORS integration](https://jazz.net/help-dev/clm/topic/com.ibm.rational.test.qm.doc/topics/c_int_rqm_doors.html), [Softacus — IBM Engineering Test Management (ETM)](https://softacus.com/blog/ibm-engineering-test-management-etm), [SodiusWillert — IBM Engineering Test Management](https://www.sodiuswillert.com/en/ibm-elm/ibm-engineering-test-management))

## 6. Reporting & dashboards

Three reporting layers, all separate products. **Jazz Reporting Service (JRS) / Report Builder** is the modern web tool — query Lifecycle Query Engine data sources, build interactive tables and graphs, export to multiple formats; designed for traceability matrices, gap analyses, and project-status dashboards. **IBM Engineering Lifecycle Optimization — Publishing (Document Builder, formerly Rational Publishing Engine)** is the document-generation engine — render DOORS Next data into formatted Word, PDF, or HTML deliverables using DOCX/template-driven layouts. **BIRT** (Business Intelligence and Reporting Tools, the legacy Eclipse-based reporting framework) still exists for parametric, on-premise reports written by power users — used heavily on Classic, less on Next. JRS reports are known to **silently drop data** when DOORS Next configurations are not correctly cached in the Lifecycle Query Engine, an issue IBM has explicit support documentation for. The breadth of reporting is unmatched in the industry; the operational complexity of getting it right at scale is also unmatched. ([IBM Docs — Integrating DOORS and JRS](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors/9.7.0?topic=integrating-jazz-reporting-service), [Jazz.net — JRS Report Builder best practices](https://jazz.net/wiki/bin/view/Deployment/JRSReportBuilderBestPractices), [IBM Support — JRS reports with DNG configurations may not report complete data](https://www.ibm.com/support/pages/jazz-reporting-service-reports-use-ibm-engineering-requirements-management-doors-next-configurations-lifecycle-query-engine-do-not-report-complete-data))

## 7. API & integration surface

DOORS was an early and influential contributor to **OSLC (Open Services for Lifecycle Collaboration)** — the W3C-aligned linked-data standard for cross-tool engineering data. DOORS Next exposes the full **OSLC RM v2.0 API** (REST + RDF, OAuth-secured) for read, query, create, update, and link operations on requirements; this is the supported integration surface and is what every third-party connector (Jama, Polarion, MATLAB Simulink, IBM Engineering Insights, custom in-house tools) consumes. A **Reportable REST API** provides bulk export to XML/CSV. **ReqIF (Requirements Interchange Format, OMG standard)** import/export is supported natively — the standard mechanism for OEM-to-supplier requirement handoffs in automotive and aerospace; this is also where DOORS-to-DOORS-Next data migration runs. An open-source **IBM/ELM-Python-Client** on GitHub demonstrates OSLC Query, ReqIF round-trip, and Reportable REST against DOORS Next, EWM, and ETM. The DXL scripting that powered Classic integrations does **not** port — DOORS Next replaces DXL with server-side JavaScript widgets on dashboards and the OSLC/REST API for everything else, which is one of the largest single migration costs for primes moving off Classic. ([GitHub — IBM/ELM-Python-Client](https://github.com/IBM/ELM-Python-Client), [IBM Docs — OSLC integration requirements](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.3.0_beta?topic=services-additional-oslc-integration-requirements), [Doorsnext.com — Extending IBM Engineering with widgets and OSLC](https://doorsnext.com/services/extending-widgets-oslc/), [SodiusWillert — Exchanging requirements between DOORS and DOORS Next via ReqIF](https://www.sodiuswillert.com/ese-reports/exchanging-requirements-between-doors-and-doors-next))

## 8. UX patterns

DOORS Classic is the textbook example of "power user productivity, novice intimidation" — a Windows MDI interface from the early 2000s built around modules, attributes, views, and DXL. The learning curve is famously steep; "needs DOORS training" is a hiring requirement at primes. DOORS Next was IBM's attempt to fix this — a fully web-based UI on IBM's Carbon design system, document-style or table-style editing, modern artefact links, and Links Explorer visualisation — and **the modernisation is real but the criticism is also real**. Common 2026 review feedback (PeerSpot, G2, Capterra, average 7.6/10):

- "Not very comfortable or intuitive to use" for occasional users (engineers who touch it monthly, not daily) — the surface feels modern but the underlying object model still requires DOORS mental-model knowledge to navigate
- Slow page loads and "system crashes" reported at scale — performance with MS SQL Server backends is a permanent limitation IBM has explicitly documented; Db2 and Oracle scale better
- Migration from Classic is "arduous" and "recommends a DXL programmer" to inventory legacy scripts before retiring them
- Reporting is "cumbersome without additional tools" — JRS/Document Builder are powerful but not what users want in-product
- "Lacks Agile integration" — DOORS Next does not fit naturally into sprint cadences; EWM is the answer but doubles the licence cost
- Cost concerns consistent — "it is expensive" appears in nearly every negative review

The 2026 mindshare drop (8.9% → 6.9% YoY in Application Requirements Management) reflects the slow attrition: not catastrophic but real, especially at the small-team end of the market where Jama Connect and codeBeamer have been winning. ([PeerSpot — DOORS Next reviews 2026](https://www.peerspot.com/products/ibm-doors-next-reviews), [PeerSpot — DOORS Next pros and cons](https://www.peerspot.com/products/ibm-doors-next-pros-and-cons), [Visure — IBM DOORS Disadvantages](https://visuresolutions.com/ibm-doors-guide/disadvantages/), [IBM Support — DOORS Next 7.x performance considerations](https://www.ibm.com/support/pages/ibm-doors-next-7x-performance-considerations), [IBM Support — Microsoft SQL Server and DOORS Next 7.0.x performance](https://www.ibm.com/support/pages/performance-considerations-microsoft%C2%AE-sql-server%C2%AE-and-ibm%C2%AE-doors%C2%AE-next-70x-engineering-lifecycle-management), [Jama Software — What is IBM DOORS](https://www.jamasoftware.com/blog/ibm-doors-software/))

## AI features (2026 update)

IBM's recent answer to the AI gap is **IBM Engineering AI Hub** — a paid add-on to ELM that introduces AI-powered agents for:
- Requirement quality analysis (clarity, ambiguity, INCOSE-style scoring)
- Natural-language conversational assistance over the requirement corpus
- Work-items management automation in EWM
- MBSE use-case discovery on architecture models

This is a **bolt-on** product. AI provenance, sign-off provenance, and certification-level tier control are not part of the DOORS Next data model — they are concerns the customer must layer on top of the audit history if their certification authority requires it. ([IBM Docs — AI automation in DOORS Next 7.2](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=overview-ai-automation), [IBM — Engineering Requirements Management product page](https://www.ibm.com/products/requirements-management))

---

## Strengths

1. **Aerospace credibility is unmatched.** Every DER, every FAA/EASA reviewer, every Tier 1 supplier expects to see DOORS data. Replacing DOORS at a prime is a multi-year change-management exercise even when the tool is universally hated, because the audit trail must survive the migration.
2. **Genuine end-to-end ALM coverage.** Requirements (DOORS Next) + workflow/change (EWM) + test (ETM) + reporting (JRS, Document Builder) + global configuration (GCM) + AI (Engineering AI Hub) — a single vendor, single integration story, single procurement contract.
3. **Open APIs through OSLC and ReqIF.** Unlike most enterprise tools, DOORS does not lock you in at the data layer — ReqIF round-trip and OSLC integration mean the bytes can move, even if the workflows can't.
4. **Scale to enterprise.** DOORS Next on Db2 with GCM correctly configured runs at hundreds of millions of artefacts and tens of thousands of users — proven at primes.
5. **20+ years of certification credibility.** Whatever the UX complaints, no auditor has ever rejected a DOORS audit package on tool grounds.

## Weaknesses

1. **Operational overhead is enormous.** ELM is six interlocking server applications (DNG, EWM, ETM, GCM, JRS, JTS, Lifecycle Query Engine), each with its own licensing, role configuration, backup story, and upgrade window. Standing up a working ELM environment is a 6–12 month consulting engagement before the first requirement is written. That is exactly the cost we eliminate.
2. **DXL migration trap.** Every Classic shop carries thousands of lines of DXL — validation rules, custom exports, in-house dashboards — and **none of it ports to DOORS Next**. Migration projects routinely run multi-year and shed value during the rewrite.
3. **UX is "modernised but not modern."** DOORS Next looks like 2018 Carbon. Engineers under 35 who learned Linear, Notion, Figma find it slow, dense, and frictional. The 2026 mindshare drop is the leading indicator.
4. **AI is bolted on.** Engineering AI Hub is a paid add-on; AI provenance and certification-tier guardrails are not in the data model. For aerospace teams operating under EASA Level 2A / EU AI Act, the audit story for AI-touched requirements is something the customer must build, not something the tool provides.
5. **Pricing locks out small teams.** USD ~820/user/month and three-year commitments price small aerospace teams (3–50 engineers, our ICP) out of the discussion. DOORS Next on Cloud SaaS reduces the operational burden but not the licence cost.
6. **Performance ceilings on MS SQL Server.** Documented and permanent — teams running ELM on the Microsoft stack hit query performance ceilings IBM acknowledges and does not plan to fix.
7. **Reporting requires a separate role.** Building a useful JRS dashboard or Document Builder template is not engineer work — it is a tooling specialist's job. The total cost of "we use DOORS" includes that specialist forever.

## Where DOORS wins against us

- Programmes already on DOORS where the audit trail is in the existing baselines. We cannot replace incumbent installations at primes for the same reason DOORS cannot be displaced: certification continuity has value above tool quality.
- Customers who explicitly want IBM's enterprise procurement story — single PO, single SLA, single support tier across the whole ALM stack.
- Teams that need full MBSE round-trip (Rhapsody) tightly bound to requirements — IBM has the integrated story end-to-end.

## Where we win against DOORS

- **Time to first requirement.** We ship a DO-178C-shaped project in minutes; DOORS Next is a 6+ month consulting engagement before first use.
- **Certification-native data model.** DO-178C objectives, ARP4754A function levels, DAL propagation are first-class entities for us; in DOORS Next they are custom attributes the customer wires together.
- **AI-native provenance.** Every AI contribution carries certification-tier guardrails and signed human disposition. IBM's AI Hub is bolted on; ours is in the schema.
- **Price point.** Self-serve pricing in the range a small team can buy without a procurement cycle. IBM's licence model is procurement-only.
- **Modern UX.** No DXL, no thick client, no Carbon-2018 density. Built for engineers who learned tools in the Linear / Notion / Figma era.
- **No multi-app sprawl.** Requirements, workflow, test, reporting, and AI live in one application with one data model. The ELM operational tax is not collected.

---

## Strategic takeaway for our positioning

DOORS is the named adversary in `vision-and-usp.md`, and the research confirms exactly why. The DOORS audience is bifurcating:

1. **Primes and Tier 1s** stay on DOORS because the audit cost of moving is unjustifiable. We do not target them.
2. **Small aerospace and defence teams** are exactly the segment the 2026 mindshare drop is bleeding from — they cannot afford the licence, cannot afford the rollout, and cannot afford the dedicated specialists DOORS requires. They are our ICP.

The fight is not "is your tool better than DOORS." It is "is your audit package as credible as a DOORS audit package, delivered at 1% of the cost and 1% of the rollout time." Every comparison page, every demo, every onboarding email should answer that question and only that question.

## Sources

- [IBM — Engineering Requirements Management product page](https://www.ibm.com/products/requirements-management)
- [IBM Docs — DOORS Next 7.0.3 configuration management overview](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=overview-configuration-management)
- [IBM Docs — DOORS Next 7.0.2 signing a baseline electronically](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.2?topic=artifacts-signing-baseline-electronically)
- [IBM Docs — DOORS and ETM integration](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors/9.7.2?topic=integrating-doors-engineering-test-management)
- [IBM Docs — DOORS and Jazz Reporting Service integration](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors/9.7.0?topic=integrating-jazz-reporting-service)
- [IBM Docs — AI automation in DOORS Next 7.2](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=overview-ai-automation)
- [IBM Docs — OSLC integration requirements for DOORS Next 7.3.0 beta](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.3.0_beta?topic=services-additional-oslc-integration-requirements)
- [IBM Support — DOORS Next 7.x performance considerations](https://www.ibm.com/support/pages/ibm-doors-next-7x-performance-considerations)
- [IBM Support — MS SQL Server and DOORS Next 7.0.x performance](https://www.ibm.com/support/pages/performance-considerations-microsoft%C2%AE-sql-server%C2%AE-and-ibm%C2%AE-doors%C2%AE-next-70x-engineering-lifecycle-management)
- [IBM Support — JRS reports may not return complete data with DNG configurations](https://www.ibm.com/support/pages/jazz-reporting-service-reports-use-ibm-engineering-requirements-management-doors-next-configurations-lifecycle-query-engine-do-not-report-complete-data)
- [Jazz.net — Adding configurations to a stream in GCM](https://jazz.net/help-dev/clm/topic/com.ibm.rational.gcapp.doc/topics/t_add_configs2stream.html)
- [Jazz.net — Traceability in DOORS Next](https://jazz.net/library/article/88104)
- [Jazz.net — JRS Report Builder best practices](https://jazz.net/wiki/bin/view/Deployment/JRSReportBuilderBestPractices)
- [Jazz.net — ETM and DOORS integration](https://jazz.net/help-dev/clm/topic/com.ibm.rational.test.qm.doc/topics/c_int_rqm_doors.html)
- [IEEE Spectrum — How GCM and IBM CLM work together](https://spectrum.ieee.org/global-configuration-management)
- [GitHub — IBM/ELM-Python-Client (OSLC, ReqIF, Reportable REST examples)](https://github.com/IBM/ELM-Python-Client)
- [PTC — pure::variants DOORS Next connector](https://www.ptc.com/en/products/pure-variants/connectors/ibm-engineering-requirements-doors-next)
- [Wikipedia — DOORS Extension Language (DXL)](https://en.wikipedia.org/wiki/DOORS_Extension_Language)
- [Softacus — DOORS Classic vs DOORS Next Generation](https://softacus.com/blog/articles/dng/differences-between-doors-next-generation-and-doors-classic)
- [Softacus — IBM Engineering Test Management overview](https://softacus.com/blog/ibm-engineering-test-management-etm)
- [Sodius Willert — Traceability links in DOORS Next](https://www.sodiuswillert.com/en/blog/how-to-set-up-create-and-use-traceability-links-in-ibm-doors-next)
- [Sodius Willert — Exchanging requirements via ReqIF](https://www.sodiuswillert.com/ese-reports/exchanging-requirements-between-doors-and-doors-next)
- [Sodius Willert — IBM Engineering Test Management product overview](https://www.sodiuswillert.com/en/ibm-elm/ibm-engineering-test-management)
- [doorsnext.com — Extending IBM Engineering with widgets and OSLC](https://doorsnext.com/services/extending-widgets-oslc/)
- [PeerSpot — DOORS Next reviews 2026](https://www.peerspot.com/products/ibm-doors-next-reviews)
- [PeerSpot — DOORS Next pros and cons (2026 mindshare)](https://www.peerspot.com/products/ibm-doors-next-pros-and-cons)
- [Visure — IBM DOORS disadvantages](https://visuresolutions.com/ibm-doors-guide/disadvantages/)
- [Jama Software — What is IBM DOORS](https://www.jamasoftware.com/blog/ibm-doors-software/)
- [Capterra — IBM Engineering Requirements Management DOORS Next reviews 2026](https://www.capterra.com/p/238454/IBM-Engineering-Requirements-Management-DOORS-Next/reviews/)
- [G2 — DOORS Next pricing 2026](https://www.g2.com/products/ibm-engineering-requirements-management-doors-next/pricing)
- [Proexcellency — Complete overview of DOORS Next for requirements engineers](https://www.proexcellency.com/blogs/sap-online-training/a-complete-overview-of-ibm-rational-doors-next-generation-for-requirements-engineers)
- [Medium / Tom Hollowell — Module baselines in DOORS Next with pure::variants](https://medium.com/@tom_80522/embracing-the-evolution-module-baselines-in-ibm-doors-next-with-pure-variants-4ad09b5af4ba)
- [mgtechsoft — Migrating from DOORS to DOORS Next: complete guide](https://mgtechsoft.com/blog/migrating-from-doors-to-doors-next-a-complete-guide-for-modern-engineering-teams/)
- [rpeactual — Getting eSignature details from a WorkItem](https://rpeactual.wordpress.com/2022/02/18/how-to-get-esignature-details-from-workitem/)
