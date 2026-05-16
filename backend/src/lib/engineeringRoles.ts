/**
 * Single source of truth for the discipline-role catalogue (R-7).
 *
 * Consumed by:
 *   - src/scripts/seed-engineering-roles.ts (standalone idempotent seed)
 *   - src/controllers/projectStakeholderRoles.controller.ts (lazy empty-DB fallback)
 *
 * These values are stored verbatim as `EngineeringRole.name` (a `@unique`
 * column), so they must stay stable spaced display strings. `CCB Member` is
 * the one CCB role from kb/configuration-management.md with no equivalent
 * already present.
 */
export const PREDEFINED_ENGINEERING_ROLES: string[] = [
  'Systems Engineer',
  'Requirements Engineer',
  'Design Engineer',
  'Integration Engineer',
  'Test Engineer',
  'Verification Engineer',
  'Validation Engineer',
  'Configuration Manager',
  'Quality Assurance',
  'Project Manager',
  'Safety Engineer',
  'Software Engineer',
  'Hardware Engineer',
  'Systems Architect',
  'Test Manager',
  'Compliance Engineer',
  'CCB Member',
]
