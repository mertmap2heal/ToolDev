---
title: "User Manual"
description: "End-user documentation for the Engineering Project Development Tool"
status: "published"
lastUpdated: "2026-04-14"
version: "1.0"
---

# User Manual

End-user documentation for the Engineering Project Development Tool — an AI-powered platform for structured engineering lifecycle management.

---

## Pages

| # | Page | Audience | Status |
|---|------|----------|--------|
| 01 | [Requirements](01-requirements.md) | All users | Published |
| 02 | [Change Requests](02-change-requests.md) | All users | Draft |
| 03 | [Issues](03-issues.md) | All users | Draft |
| 04 | [Lifecycle Status](04-lifecycle-status.md) | All users | Draft |
| 05 | [Archive](05-archive.md) | All users | Draft |
| 06 | [Stakeholders](06-stakeholders.md) | Admins | Draft |
| 07 | [PBS — Product Breakdown Structure](07-pbs.md) | All users | Draft |
| 08 | [Functions](08-functions.md) | All users | Draft |
| 09 | [Interface Management](09-interface-management.md) | All users | Draft |
| 10 | [Parameters](10-parameters.md) | All users | Published |
| 11 | [Risk Management](11-risk-management.md) | All users | Draft |

---

## How to Use This Manual

Each page covers one area of the tool and follows the same structure:

1. **Overview** — what the page does and why you would use it
2. **Who Uses This Page** — relevant roles
3. **Navigation** — how to get there
4. **Key Concepts** — terminology used on that page
5. **Page Layout** — description of each UI region
6. **Common Workflows** — step-by-step task guides
7. **Tips & Notes** — non-obvious behaviour and gotchas
8. **Related Pages** — links to adjacent features

---

## Contributing a New Page

When a new feature ships, add a manual page during the same sprint — not after.

### Steps

1. **Copy the template**
   ```bash
   cp docs/user-manual/_template.md docs/user-manual/NN-page-name.md
   ```

2. **Fill in the frontmatter**
   ```yaml
   title: "Page Name"
   description: "One-sentence description of what users accomplish here"
   status: "draft"           # Start as draft; change to "published" after review
   lastUpdated: "YYYY-MM-DD"
   version: "1.0"
   audience: "all"           # or "admin-only"
   relatedPages: []
   ```

3. **Write the content** — follow the template section order exactly. Do not skip sections; mark incomplete ones with `> TODO: ...` so the staleness audit catches them.

4. **Set `status: "review"`** when content is complete and ready for a teammate to check.

5. **Set `status: "published"`** after review sign-off.

6. **Add a row** to the table in this README.

### Writing style

- **Imperative voice**: "Click **New Requirement**" not "The requirement can be created by clicking..."
- **Task-based first**: Lead with what the user is trying to accomplish, not what the UI looks like
- **One action per step**: Each numbered step = one click or input
- **Bold UI element names**: **Save**, **Filter**, **Export** — makes steps scannable

---

## Maintenance

### Monthly audit

Run this from the project root to find stale or incomplete pages:

```bash
# Pages not updated in 90+ days
grep -r "lastUpdated" docs/user-manual/*.md | \
  awk -F'"' '{print $1, $2}' | sort -k2

# Incomplete pages (still draft or have TODO sections)
grep -r "status: \"draft\"\|TODO:" docs/user-manual/*.md | \
  grep -v "_template.md" | cut -d: -f1 | sort -u
```

### When a feature changes

1. Find all manual pages that cover the changed feature
2. Update the content and bump `lastUpdated`
3. If the change is breaking (UI redesigned, feature removed), set `status: "review"` and notify the team

### Screenshot policy

Screenshots go stale fast. Prefer text descriptions over images where possible.
When screenshots are necessary, store them in `docs/user-manual/_assets/<page-name>/` and reference them with relative paths. Add a note above the image with the version it was taken from:

```markdown
<!-- Screenshot taken in v1.0. Update if UI changes. -->
![Create Requirement modal](../_assets/requirements/create-modal.png)
```
