import {
  FileCheck,
  GitBranch,
  AlertCircle,
  AlertTriangle,
  ClipboardCheck,
  BookOpen,
} from 'lucide-react'
import FeatureCard from './FeatureCard'

const FEATURES = [
  {
    icon: FileCheck,
    title: 'Requirements & Traceability',
    description: 'Manage requirements with full traceability from stakeholder needs through verification evidence.',
  },
  {
    icon: GitBranch,
    title: 'Change Requests',
    description: 'Track and control changes with formal change request workflow and impact analysis.',
  },
  {
    icon: AlertCircle,
    title: 'Issues',
    description: 'Raise and manage issues linked to requirements, functions, and verification evidence.',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Management',
    description: 'Identify, assess, and mitigate risks with structured workflows and reporting.',
  },
  {
    icon: ClipboardCheck,
    title: 'Verification Templates',
    description: 'Define verification strategies with reusable templates and evidence collection.',
  },
  {
    icon: BookOpen,
    title: 'Documentation & Audit Trails',
    description: 'Document decisions and maintain audit trails for compliance and certification.',
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">What it does</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            A unified platform for engineering lifecycle management with traceability, change control, and audit readiness.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </div>
    </section>
  )
}
