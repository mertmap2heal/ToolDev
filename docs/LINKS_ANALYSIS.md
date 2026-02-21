# Change Request Links – Detailed Analysis

## Expected Flow

1. User creates a CR from a requirement (row action or bulk action).
2. Backend creates `RequirementChangeRequestLink` (requirementId, changeRequestId, relationshipType).
3. Requirement Links tab fetches via `linkService.getLinks(projectId, { sourceId: requirement.id })`.
4. Links show under “Change Requests”.

## Data Flow

### Backend

- **Traceability route**: `GET /api/v1/traceability/:projectId` – returns all trace links (no filters).
- **Traceability service** `getTraceLinks(projectId)` merges:
  - `TraceLink` table
  - `IssueLink` records
  - `RequirementChangeRequestLink` records → mapped as `sourceType: 'requirement'`, `sourceId: requirementId`, `targetType: 'change_request'`.
- CR links use `linkType: 'originates_from'` or `'relates_to'`.

### Frontend

- **linkService.getLinks(projectId, filters)**:
  1. Calls `traceabilityService.getTraceLinks(projectId)` (no filters to backend).
  2. `filterByLinkageV1()` – drops function/parameter only; CR links stay.
  3. `applyFilters(links, filters)` – keeps links where `sourceId === filters.sourceId`.
- **RequirementDetailDrawer**:
  - Query key: `['requirement-links', projectId, requirement?.id]`.
  - `links` = outgoing (requirement as source).
  - `incomingLinks` = incoming (requirement as target).
  - `allLinks` = `links` + normalized `incomingLinks`.
  - CR links are outgoing, so they must appear in `links`.

## Possible Causes

1. **Backend never receives filter params**  
   Traceability API ignores filters; frontend filters in memory. Flow is correct, but we cannot verify server-side filtering.

2. **Query invalidation timing**  
   After creating a CR, `requirement-links` is invalidated. If the Links tab is closed, refetch happens when it opens. If invalidation uses a different key than the active query, the refetch may not run.

3. **ID mismatch**  
   - `RequirementChangeRequestLink.requirementId` = requirement UUID.  
   - `link.sourceId` in traceability = `l.requirementId`.  
   - Drawer filters with `requirement.id`.  
   IDs must be the same. Likely correct if creation uses the same requirement object.

4. **Link type display**  
   CR links use `originates_from` or `relates_to`. UI maps `originates_from` to “Change Requests”. If the backend returns `relates_to` for the source requirement, it must also be treated as “Change Requests”.

5. **LINKAGE_V1 behavior**  
   `requirement-links` query is enabled only when `LINKAGE_V1` is true. With it hardcoded `true`, this should not block display.

## Recommended Fixes

1. **Support traceability filters on backend**  
   Accept `sourceId`, `targetId`, etc. as query params and pass them to `getTraceLinks()`. Ensures server returns only relevant links and simplifies debugging.

2. **Pass filters from frontend**  
   Have `linkService.getLinks` call the traceability API with filters so the backend can filter server-side.

3. **Include `relates_to` in “Change Requests”**  
   Ensure both `originates_from` and `relates_to` render under “Change Requests” in the Links tab.
