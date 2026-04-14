/**
 * Single source of truth for Verification section: main tabs, labels, and node-type-to-tab mapping.
 * Used by: VerificationLayoutPage (tab bar + tree selection), VerificationPage (valid tabs),
 * VerificationTreePanel (re-export for context menu / open-in-verification), RequirementsPage (verification side panel).
 * When adding a new verification feature/tab, add it here so the side menu and all pages stay consistent.
 */
import {
  BarChart3,
  FileText,
  CheckCircle,
  Settings,
  Play,
  Table2,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

/** Node types that can appear in the verification tree (must match VerNodeType in VerificationTreePanel). */
export type VerificationNodeType =
  | 'test-plan'
  | 'test-case'
  | 'test-setup'
  | 'test-run'
  | 'requirement'
  | 'unassigned-group'
  | 'plan-requirements-group'

/** Tab id for URL and routing (e.g. ?tab=plans). */
export type VerificationTabId =
  | 'overview'
  | 'plans'
  | 'cases'
  | 'runs'
  | 'setups'
  | 'results'
  | 'reviews'
  | 'traceability'

export interface VerificationMainTab {
  id: VerificationTabId
  label: string
  icon: LucideIcon
}

/** Main content tabs shown in the verification tab bar (order defines display order). */
export const VERIFICATION_MAIN_TABS: VerificationMainTab[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'plans', label: 'Test Plans', icon: FileText },
  { id: 'cases', label: 'Test Cases', icon: CheckCircle },
  { id: 'runs', label: 'Test Runs', icon: Play },
  { id: 'setups', label: 'Test Setups', icon: Settings },
  { id: 'results', label: 'Test Results', icon: CheckCircle },
  { id: 'reviews', label: 'Reviews', icon: ClipboardList },
  { id: 'traceability', label: 'Traceability Matrix', icon: Table2 },
]

/** Tab id -> label (for breadcrumbs, titles, etc.). */
export const VERIFICATION_TAB_LABELS: Record<string, string> = Object.fromEntries(
  VERIFICATION_MAIN_TABS.map((t) => [t.id, t.label])
)

/** Valid tab query param values. */
export const VERIFICATION_VALID_TAB_IDS: string[] = VERIFICATION_MAIN_TABS.map((t) => t.id)

/** Map tree node type to which main tab to show when selecting that node (used by verification layout and requirements page). */
export const VERIFICATION_NODE_TYPE_TO_TAB: Record<VerificationNodeType, VerificationTabId> = {
  'test-plan': 'plans',
  'test-case': 'cases',
  'test-setup': 'setups',
  'test-run': 'runs',
  requirement: 'cases',
  'unassigned-group': 'cases',
  'plan-requirements-group': 'plans',
}

/** Get the verification tab id for a tree node type (for navigation from tree / "Open in Verification page"). */
export function getVerificationTabForNodeType(nodeType: VerificationNodeType): VerificationTabId {
  return VERIFICATION_NODE_TYPE_TO_TAB[nodeType] ?? 'overview'
}

/** Build verification URL with tab and optional focus/filters (for use from Requirements page, deep links, drill-down). */
export function buildVerificationUrl(
  projectId: string,
  options: {
    tab?: VerificationTabId | string
    focusType?: string
    focusId?: string
    openCreate?: string
    openCreateCase?: string
    openCreateSetup?: string
    openCreateRun?: string
    status?: string
    moc?: string
  }
): string {
  const params = new URLSearchParams()
  params.set('tab', (options.tab && VERIFICATION_VALID_TAB_IDS.includes(options.tab) ? options.tab : 'overview'))
  if (options.focusType) params.set('focusType', options.focusType)
  if (options.focusId) params.set('focusId', options.focusId)
  if (options.openCreate) params.set('openCreate', options.openCreate)
  if (options.openCreateCase) params.set('openCreateCase', options.openCreateCase)
  if (options.openCreateSetup) params.set('openCreateSetup', options.openCreateSetup)
  if (options.openCreateRun) params.set('openCreateRun', options.openCreateRun)
  if (options.status) params.set('status', options.status)
  if (options.moc) params.set('moc', options.moc)
  const qs = params.toString()
  return `/projects/${projectId}/verification${qs ? `?${qs}` : ''}`
}

/** URL focus params drive VerificationPage's drawer open effect; clear them when dismissing a drawer so it does not immediately reopen. */
export function clearVerificationFocusForClosedEntity(
  params: URLSearchParams,
  entity: 'plan' | 'case' | 'setup' | 'result' | 'run',
  entityId: string | null | undefined
): void {
  if (!entityId) return
  const ft = (params.get('focusType') ?? '').toLowerCase().replace(/-/g, '_')
  const fid = params.get('focusId')
  const caseId = params.get('caseId')

  const normEntity =
    entity === 'plan'
      ? 'test_plan'
      : entity === 'case'
        ? 'test_case'
        : entity === 'setup'
          ? 'test_setup'
          : entity === 'result'
            ? 'test_result'
            : 'test_run'

  if (fid === entityId && ft === normEntity) {
    params.delete('focusType')
    params.delete('focusId')
  }
  if (entity === 'case' && caseId === entityId) {
    params.delete('caseId')
  }
}
