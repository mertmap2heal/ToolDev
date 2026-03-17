import {
  Users,
  FolderTree,
  Boxes,
  Settings,
  Network,
  Sliders,
  FileCheck,
  ClipboardList,
  GitBranch,
  AlertCircle,
  BookOpen,
  Activity,
  Layers,
  Archive,
  CheckCircle2,
  CheckCircle,
  Shield,
  AlertTriangle,
  ShieldCheck,
  Award,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ModuleItem {
  label: string
  icon: LucideIcon
  workflow: string[]
}

interface ModuleGroup {
  title: string
  items: ModuleItem[]
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: 'System Definition',
    items: [
      { label: 'Stakeholder', icon: Users, workflow: ['Capture needs and expectations', 'Map to system-level requirements'] },
      { label: 'Product Breakdown Structure', icon: FolderTree, workflow: ['Define product hierarchy', 'Allocate requirements to items'] },
      { label: 'MBSE Models', icon: Boxes, workflow: ['Create and link system models', 'Maintain model-requirement traceability'] },
      { label: 'Functions', icon: Settings, workflow: ['Define system functions', 'Allocate to components'] },
      { label: 'Interfaces', icon: Network, workflow: ['Define interface definitions', 'Track interface changes'] },
      { label: 'Parameters', icon: Sliders, workflow: ['Manage design parameters', 'Trace to requirements and functions'] },
    ],
  },
  {
    title: 'Development & Control',
    items: [
      { label: 'Requirements', icon: FileCheck, workflow: ['Manage baseline and versions', 'Track allocation and traceability'] },
      { label: 'Tasks', icon: ClipboardList, workflow: ['Create and assign tasks', 'Track progress and workflows'] },
      { label: 'Change Requests', icon: GitBranch, workflow: ['Submit and review changes', 'Impact analysis and approval'] },
      { label: 'Issues', icon: AlertCircle, workflow: ['Raise issues from any source', 'Link to requirements and evidence'] },
      { label: 'Documentation', icon: BookOpen, workflow: ['Link documents to artifacts', 'Maintain documentation traceability'] },
      { label: 'Lifecycle Status', icon: Activity, workflow: ['Track item status', 'Manage state transitions'] },
      { label: 'Configuration Management', icon: Layers, workflow: ['Manage baselines', 'Control releases'] },
      { label: 'Archive', icon: Archive, workflow: ['Archive completed items', 'Preserve audit history'] },
    ],
  },
  {
    title: 'Assurance & Certification',
    items: [
      { label: 'Verification', icon: CheckCircle2, workflow: ['Define verification strategies', 'Collect and link evidence'] },
      { label: 'Validation', icon: CheckCircle, workflow: ['Plan validation activities', 'Document validation results'] },
      { label: 'Safety Analysis', icon: Shield, workflow: ['Identify hazards', 'Perform FTA, FMEA, and analyses'] },
      { label: 'Risk Management', icon: AlertTriangle, workflow: ['Assess and mitigate risks', 'Track risk status'] },
      { label: 'Compliance Check', icon: ShieldCheck, workflow: ['Verify compliance criteria', 'Generate compliance reports'] },
      { label: 'Certification', icon: Award, workflow: ['Prepare certification packages', 'Manage certification evidence'] },
    ],
  },
]

export default function ModulesSection() {
  return (
    <section id="modules" className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Modules & Capabilities</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Comprehensive modules aligned to system engineering and product development workflows.
          </p>
        </div>
        <div className="mt-12 space-y-10">
          {MODULE_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={18} className="text-gray-600 dark:text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {item.workflow.map((w) => (
                          <li
                            key={w}
                            className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                          >
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
