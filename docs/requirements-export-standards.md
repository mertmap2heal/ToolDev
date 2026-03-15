# Requirement Export Standards – Industry Analysis

This document summarizes industry standards and best practices for requirements export and documentation. It is used to align the Export Builder (custom sections, authority styling, ReqIF, PDF/Word) with regulator and customer expectations.

**References:** ISO/IEC/IEEE 29148, IEEE 830, INCOSE Guide to Writing Requirements, OMG ReqIF, FDA 21 CFR 820.30, DO-178C/DO-254, ISO 26262.

---

## 1. International and industry standards

### 1.1 ISO/IEC/IEEE 29148 (Requirements engineering)

- **Role:** Defines requirements engineering processes over the full lifecycle (systems, hardware, software). Supersedes IEEE 830-1998 for software requirements specifications.
- **Document types:** System Operational Concept, Business Requirements Specification (BRS), Stakeholder Requirements Document (StRD), Design Input Requirements.
- **Export relevance:** Tools aligned with 29148 typically support **DOCX, XLSX, PDF, HTML, CSV, and ReqIF** for interchange and formal deliverables. Current formats (CSV, Excel, PDF, Word, ReqIF) match this expectation.

### 1.2 IEEE 830 (Software Requirements Specification – structure)

- **Role:** Defines recommended practice for SRS content and organization (830-1993, 830-1998).
- **Canonical structure:**
  - **Cover:** Project name, document title (e.g. "Software Requirements Specification"), **version** (aligned with revision history), **prepared by**, organization, **date**.
  - **Table of contents** after cover.
  - **Revision history table:** Name, Date, Reason for changes, Version.
  - **Sections:** 1. Introduction (purpose, scope, conventions, references), 2. Overall description, 3. Specific requirements, 4. Supporting information (appendices, definitions).
- **Export relevance:** The "authority" preset (cover, summary, requirements table, glossary, abbreviations) aligns with this. Optional additions: **revision history** (e.g. as custom section or dedicated section type), **table of contents** (future enhancement).

### 1.3 INCOSE (Systems engineering)

- **Role:** INCOSE "Guide to Writing Requirements" and systems engineering standards stress clear separation of stakeholder needs vs. requirements and traceability.
- **Export relevance:** Section numbering, clear headings, and structured tables support traceability and review. Glossary and abbreviations sections support consistent terminology and are supported as section types.

### 1.4 ReqIF (Requirements Interchange Format)

- **Source:** OMG standard (e.g. ReqIF 1.2), supported by prostep ivip; XML-based.
- **Purpose:** Tool-neutral exchange of requirements (hierarchy, attributes, rich text, traceability). Used in automotive, aerospace, medical, defense, and software.
- **Export relevance:** ReqIF backend export is aligned with industry practice for supplier/customer exchange and tool migration.

---

## 2. Regulated and safety-critical domains

### 2.1 FDA design controls (21 CFR 820.30)

- **Design input** (requirements) and **Design History File (DHF)** must be documented and available for inspection. No mandated export format; practice is controlled documents with **approval, date, revision control, and distribution**.
- **Export relevance:** Cover with **project name, date, version, preparer/organization** and optional **classification** matches design-control expectations. A **revision history** section (who/when/why) in the export would strengthen alignment with DHF expectations.

### 2.2 DO-178C / DO-254 (aviation)

- **Role:** Software/hardware assurance; emphasis on **traceability**, **versioning**, and **controlled documentation**.
- **Export relevance:** Numbered requirements, consistent headers/footers, page numbering ("Page X of N"), and neutral table styling support review and audit. Authority styling (cover, headers/footers, page numbers, table borders) fits this. Traceability is supported in-app and via ReqIF.

### 2.3 ISO 26262 (automotive functional safety)

- **Role:** Requirements management and traceability; compliance evidence for auditors.
- **Export relevance:** Document control (version, date, author/organization) and clear structure are expected; current authority layout and optional classification are consistent.

---

## 3. Professional document structure (best practices)

From IEEE 830–style templates and common SRS guides:

- **Cover:** Document title, **project name**, **version**, **date**, **author/preparer**, **organization**. Optional: **classification** (e.g. CONFIDENTIAL, DRAFT).
- **Revision history:** Table with **name, date, reason, version** (and optionally approval).
- **Headers/footers:** Document title or short name; **page numbering** (e.g. "Page X of N"); **date or revision**.
- **Body:** Numbered sections; **new page for major sections**; consistent typography and margins (e.g. 25 mm); **tables** with clear headers and **repeated header row** on new pages.
- **Supporting material:** Glossary, abbreviations, references (custom_text and glossary/abbreviations sections).

**Current alignment:** Cover (title, project, date, version, classification, preparer), header/footer with placeholders, page numbering, section numbering, new page per section, margins/font sizes, neutral table styling, repeat header row (Word), and glossary/abbreviations are implemented. Remaining gaps vs. ideal: **revision history** as a first-class section and **table of contents** (future).

---

## 4. Document control and classification

- **Revision management:** Revisions indicate approved/released versions; history should capture **who, when, why** (and often approval). Export can support a **revision history** section populated from template or UI.
- **Classification:** Labels such as CONFIDENTIAL or DRAFT are common on cover and sometimes in footer; cover classification and optional footer text are supported.
- **Controlled document practices:** Unique ID, issue date, distribution/approval tracking are organizational; cover and footer fields (title, version, date, preparer) support them.

---

## 5. Summary: alignment and enhancements

| Area | Implementation | Industry expectation | Status |
|------|----------------|----------------------|--------|
| **Formats** | CSV, Excel, PDF, Word, ReqIF | DOCX, XLSX, PDF, ReqIF typical | Aligned |
| **Cover** | Title, project, date, version, classification, preparer | Same + revision tied to history | Add optional revision history section |
| **Structure** | Cover, summary, requirements table, glossary, abbreviations, custom text | IEEE 830–like + TOC | Optional TOC and revision history |
| **Headers/footers** | Configurable L/C/R, placeholders, page X of N | Same | Aligned |
| **Tables** | Neutral header, borders, repeat header (Word) | Same | Aligned |
| **Traceability** | In-app; ReqIF for exchange | ReqIF + document structure | Aligned |
| **Revision history** | Not a dedicated section | Expected in controlled docs | Add as section or custom content |
