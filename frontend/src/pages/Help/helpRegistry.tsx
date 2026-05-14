import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Sliders,
  ListChecks,
  CheckCircle2,
  Network,
  Workflow,
  ShieldCheck,
  Bot,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react'
import type { ComponentType } from 'react'

import OverviewSection from './sections/OverviewSection'
import ParametersSection from './sections/ParametersSection'
import AiAndMcpSection from './sections/AiAndMcpSection'
import AdminSection from './sections/AdminSection'
import RequirementsSection from './sections/RequirementsSection'
import VerificationSection from './sections/VerificationSection'
import ValidationSection from './sections/ValidationSection'
import InterfacesSection from './sections/InterfacesSection'
import CmSection from './sections/CmSection'
import SecuritySection from './sections/SecuritySection'

/**
 * Registry of help-system pages. Adding a new page = add an entry here
 * and a section component under `pages/Help/sections/`. The sidebar
 * (HelpLayout) and the route table (App.tsx → /help/:slug) both read
 * from this list, so no other wiring is needed.
 *
 * Visibility is gated by `audience`:
 *   - 'member'         (default) any signed-in user sees it
 *   - 'admin'          requires user.isAdmin / role===COMPANY_ADMIN
 *   - 'platform-admin' requires user.isSuperiorAdmin
 *
 * Pages a user can't access are filtered out of the sidebar; the
 * direct URL redirects to the overview.
 */
export type HelpAudience = 'member' | 'admin' | 'platform-admin'

export interface HelpPage {
  /** URL slug under /help (e.g. 'parameters') */
  slug: string
  /** Sidebar label */
  label: string
  /** Sidebar icon */
  icon: LucideIcon
  /** Optional sidebar group header */
  group?: string
  /** Page heading rendered above the content */
  title: string
  /** One-line page description */
  blurb: string
  /** The component that renders the page body */
  Component: ComponentType
  /** Who is allowed to see this page (default: 'member') */
  audience?: HelpAudience
  /** Optional flag — hide from sidebar (still routable) */
  hidden?: boolean
}

export const HELP_PAGES: HelpPage[] = [
  {
    slug: 'overview',
    label: 'Overview',
    icon: BookOpen,
    group: 'Getting started',
    title: 'Documentation',
    blurb: 'How to use the engineering tool, module by module.',
    Component: OverviewSection,
  },
  {
    slug: 'parameters',
    label: 'Parameters',
    icon: Sliders,
    group: 'Modules',
    title: 'Parameters',
    blurb:
      'Manage typed, versioned engineering parameters with virtualised list, kanban board, and dependency graph views.',
    Component: ParametersSection,
  },
  {
    slug: 'ai-and-mcp',
    label: 'AI & MCP',
    icon: Bot,
    group: 'Platform',
    title: 'AI assistance & Model Context Protocol',
    blurb:
      'Connect Claude Desktop or any MCP-compliant client, bring your own provider key, or use the operator default.',
    Component: AiAndMcpSection,
  },
  {
    slug: 'admin',
    label: 'Admin & MCP keys',
    icon: ShieldAlert,
    group: 'Administration',
    title: 'Administration',
    blurb:
      'Project AI toggle, MCP key issuance, role assignments, audit log access. Visible to admins only.',
    Component: AdminSection,
    audience: 'admin',
  },
  // Placeholders — sections to flesh out next:
  {
    slug: 'requirements',
    label: 'Requirements',
    icon: ListChecks,
    group: 'Modules',
    title: 'Requirements',
    blurb:
      "Author, trace, version, and review the project's formal requirements register.",
    Component: RequirementsSection,
  },
  {
    slug: 'verification',
    label: 'Verification',
    icon: CheckCircle2,
    group: 'Modules',
    title: 'Verification',
    blurb:
      'Test cases, plans, runs, results, and methods of compliance per ARP4754A.',
    Component: VerificationSection,
  },
  {
    slug: 'validation',
    label: 'Validation',
    icon: ClipboardCheck,
    group: 'Modules',
    title: 'Validation',
    blurb:
      'Confirm the delivered system meets stakeholder needs through demonstrations, operational tests, simulations, analyses, and stakeholder sign-offs.',
    Component: ValidationSection,
  },
  {
    slug: 'interfaces',
    label: 'Interfaces',
    icon: Network,
    group: 'Modules',
    title: 'Interface management',
    blurb:
      'Model the connections between system elements; generate Interface Control Documents.',
    Component: InterfacesSection,
  },
  {
    slug: 'cm',
    label: 'Configuration Management',
    icon: Workflow,
    group: 'Modules',
    title: 'Configuration Management',
    blurb:
      'Configuration items, baselines, change requests, deviations, and waivers per IEEE 828-2012.',
    Component: CmSection,
  },
  {
    slug: 'security',
    label: 'Security & access',
    icon: ShieldCheck,
    group: 'Platform',
    title: 'Security & access',
    blurb:
      'Package tiers, ITAR classification, BYOK encryption, MCP key issuance, audit logs.',
    Component: SecuritySection,
  },
]

export function getHelpPage(slug: string | undefined): HelpPage | null {
  if (!slug) return null
  return HELP_PAGES.find((p) => p.slug === slug) ?? null
}

/**
 * Resolve whether a viewer with the given flags can see a help page.
 * Pages without an explicit audience are visible to every signed-in
 * user.
 */
export function canSeeHelpPage(
  page: HelpPage,
  viewer: { isAdmin?: boolean; isSuperiorAdmin?: boolean; role?: string | null },
): boolean {
  const isAdminLike =
    !!viewer.isAdmin ||
    !!viewer.isSuperiorAdmin ||
    viewer.role === 'COMPANY_ADMIN' ||
    viewer.role === 'SUPERIOR_ADMIN'
  const isPlatformAdmin = !!viewer.isSuperiorAdmin || viewer.role === 'SUPERIOR_ADMIN'
  switch (page.audience) {
    case 'platform-admin':
      return isPlatformAdmin
    case 'admin':
      return isAdminLike
    default:
      return true
  }
}

