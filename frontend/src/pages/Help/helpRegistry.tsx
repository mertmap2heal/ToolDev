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
  Radio,
  ShieldAlert,
} from 'lucide-react'
import type { ComponentType } from 'react'

import OverviewSection from './sections/OverviewSection'
import ParametersSection from './sections/ParametersSection'
import CommunicationsSection from './sections/CommunicationsSection'
import AiAndMcpSection from './sections/AiAndMcpSection'
import AdminSection from './sections/AdminSection'

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
    slug: 'communications',
    label: 'Communications',
    icon: Radio,
    group: 'Modules',
    title: 'Communications buses',
    blurb:
      'Model the message buses, messages, and fields that carry parameters between systems.',
    Component: CommunicationsSection,
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
    blurb: 'Coming soon — author, trace, and review requirements with version history.',
    Component: PlaceholderSection('Requirements'),
  },
  {
    slug: 'verification',
    label: 'Verification',
    icon: CheckCircle2,
    group: 'Modules',
    title: 'Verification',
    blurb: 'Coming soon — test cases, plans, runs, results, and methods of compliance.',
    Component: PlaceholderSection('Verification'),
  },
  {
    slug: 'interfaces',
    label: 'Interfaces',
    icon: Network,
    group: 'Modules',
    title: 'Interface management',
    blurb: 'Coming soon — interface control documents, ports, signals, and ICD export.',
    Component: PlaceholderSection('Interfaces'),
  },
  {
    slug: 'cm',
    label: 'Configuration Management',
    icon: Workflow,
    group: 'Modules',
    title: 'Configuration Management',
    blurb:
      'Coming soon — configuration items, baselines, change requests, deviations, and waivers.',
    Component: PlaceholderSection('Configuration Management'),
  },
  {
    slug: 'security',
    label: 'Security & access',
    icon: ShieldCheck,
    group: 'Platform',
    title: 'Security & access',
    blurb:
      'Coming soon — package tiers, ITAR classification, BYOK encryption, MCP key issuance.',
    Component: PlaceholderSection('Security & access'),
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

function PlaceholderSection(name: string): ComponentType {
  return function Placeholder() {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          Documentation for <strong>{name}</strong> has not been written yet.
        </p>
        <p className="mt-2">
          If you want to help, edit{' '}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-[12px]">
            frontend/src/pages/Help/sections/
          </code>{' '}
          and add your section to the registry.
        </p>
      </div>
    )
  }
}
