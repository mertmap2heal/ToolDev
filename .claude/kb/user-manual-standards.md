# User Manual Standards & Maintenance Guide

This file documents the conventions, template, and maintenance processes for `docs/user-manual/`.
Follow these standards when adding or updating manual pages. Derived from industry research on
SaaS documentation best practices (Notion, Linear, GitHub Docs patterns).

---

## Philosophy

**70% task-based, 30% reference.**

Engineers and PMs are goal-driven. They come to docs to accomplish something, not to read about UI elements. Every page should lead with what the user is trying to do, not what the product looks like.

Write in **imperative voice**:
- "Click **New Requirement**" — correct
- "The requirement can be created by clicking New Requirement" — wrong
- "You might want to click New Requirement" — wrong

Each numbered step = one action. No compound steps ("Click X and then Y").
Bold every UI element name on first use in a step.

---

## File Naming Convention

```
docs/user-manual/
├── NN-kebab-case-name.md     # NN = two-digit sequence number (01, 02 ...)
├── _template.md              # underscore prefix = not a published page
├── README.md                 # index file
└── _assets/
    └── <page-name>/          # screenshots for that page
        └── feature-v1.0.png
```

Sequence numbers keep pages in logical order in the filesystem. When inserting a new page between two existing ones, use a decimal convention (e.g. `07a-`) rather than renumbering existing files.

---

## YAML Frontmatter — Required Fields

Every page must have this frontmatter block:

```yaml
---
title: "Page Name"
description: "One-sentence description of what users accomplish here"
status: "published"        # draft | review | published | deprecated
lastUpdated: "YYYY-MM-DD"
version: "1.0"
audience: "all"            # all | admin-only
relatedPages:
  - "02-change-requests.md"
---
```

### Status lifecycle

```
draft → review → published → deprecated
```

- `draft`: in progress, do not link to from other docs
- `review`: content complete, needs peer review
- `published`: live and accurate
- `deprecated`: outdated (add a `> **Deprecated:** This page describes v1.x behaviour.` callout at the top)

---

## Page Section Order

Every page must follow this exact section order. Do not skip sections; use `> TODO: ...` for incomplete ones.

```markdown
# Page Title
> One-line benefit statement

## Overview          ← 2–4 sentences: what + why
## Who Uses This Page ← role table
## Navigation        ← breadcrumb path to reach the page
## Key Concepts      ← terminology table (only non-obvious terms)
## Page Layout       ← one subsection per visual region of the UI
## Common Workflows  ← numbered how-to tasks (imperative voice)
## Tips & Notes      ← gotchas, permission requirements, shortcuts
## Related Pages     ← links with one-line reason
```

### Why this order

| Position | Section | Reason |
|----------|---------|--------|
| First | Overview | User confirms they're on the right page before reading further |
| Second | Key Concepts | Give vocab before describing UI — users need the words to understand the layout |
| Third | Page Layout | Orient the user to what they're seeing |
| Fourth | Workflows | Get them productive (most-read section) |
| Last | Tips | Reward users who read carefully; not blocking |

---

## Common Workflows Section — Writing Guide

Each workflow is a `### How to [verb] [noun]` heading followed by numbered steps.

```markdown
### How to create a requirement

1. Click **New Requirement** in the top-right corner.
2. Enter a **Title** (required, max 200 characters).
3. Optionally set **Priority** (High / Medium / Low) and **Owner**.
4. Click **Save**.

**Result:** The new requirement appears in the table with status **Draft**.
```

Always include:
- A `**Result:**` line stating what the user should see after completing the steps
- The actual button/field name as it appears in the UI (copy it from the component)

---

## Screenshot Policy

Screenshots go stale quickly. Prefer text descriptions where possible.

When a screenshot genuinely helps (complex modal, matrix view), store it in `docs/user-manual/_assets/<page-name>/` and annotate with the version:

```markdown
<!-- Screenshot taken in v1.0. Update when UI changes. -->
![Create Requirement modal](_assets/requirements/create-modal-v1.0.png)
```

Screenshot naming: `feature-description-vX.Y.png` so old and new versions can coexist.

---

## Maintenance Process

### Monthly audit script (run from project root)

```bash
# Find pages with stale lastUpdated (change 90 to desired days)
echo "=== Pages not updated in 90+ days ==="
grep -r "lastUpdated:" docs/user-manual/*.md | grep -v "_template" | \
  awk -F'"' '{print $2, $1}' | sort

# Find incomplete pages
echo "=== Draft or TODO pages ==="
grep -rl 'status: "draft"\|> TODO:' docs/user-manual/*.md | grep -v "_template"
```

### When a feature changes

1. Identify all manual pages that describe the changed feature
2. Update the content
3. Bump `lastUpdated` to today's date
4. If the feature was redesigned significantly, set `status: "review"` and get a second pair of eyes

### When a feature is removed

1. Set `status: "deprecated"` in frontmatter
2. Add a callout at the top of the page:
   ```markdown
   > **Deprecated:** This feature was removed in v2.0. See [Replacement Page](NN-page.md).
   ```
3. Do **not** delete the file immediately — keep it for one release cycle so users on the old version can still find it

---

## What Makes Docs Rot — and How to Prevent It

| Cause | Prevention |
|-------|-----------|
| Updates happen after shipping (by then, no one cares) | Add "update docs" to Definition of Done |
| No clear owner | One person per page section owns freshness |
| No way to see what's stale | `status` frontmatter + monthly audit script |
| Screenshots break after every UI tweak | Version screenshots, prefer text, use `<!-- version -->` annotations |
| Docs not linked from the product | Link directly to manual pages from in-app tooltips and help buttons |

---

## Template Location

The canonical blank template is at `docs/user-manual/_template.md`.

To add a new page:
```bash
cp docs/user-manual/_template.md docs/user-manual/NN-page-name.md
```

Then fill in the frontmatter and each section. The template contains inline guidance comments (lines starting with `<!--`) that should be deleted before publishing.
