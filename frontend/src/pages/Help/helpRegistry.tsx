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
} from 'lucide-react'
import type { ComponentType } from 'react'

import OverviewSection from './sections/OverviewSection'
import ParametersSection from './sections/ParametersSection'
import AiAndMcpSection from './sections/AiAndMcpSection'

/**
 * Registry of help-system pages. Adding a new page = add an entry here
 * and a section component under `pages/Help/sections/`. The sidebar
 * (HelpLayout) and the route table (App.tsx → /help/:slug) both read
 * from this list, so no other wiring is needed.
 *
 * The optional `group` field clusters entries in the sidebar; pages
 * without a group land in the default "Getting started" group.
 */

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
