import { Shield, FileCheck, GitBranch, Download } from 'lucide-react'

const SECURITY_ITEMS = [
  {
    icon: Shield,
    title: 'Role-Based Access Control',
    description: 'Granular permissions and role assignments to control who can view, edit, and approve artifacts.',
  },
  {
    icon: FileCheck,
    title: 'Audit Logs',
    description: 'Comprehensive audit trails for changes, access, and key actions across the platform.',
  },
  {
    icon: GitBranch,
    title: 'Traceability',
    description: 'End-to-end traceability from stakeholder needs through verification evidence.',
  },
  {
    icon: Download,
    title: 'Export & Import',
    description: 'Export data for external audits and import from legacy systems.',
  },
]

export default function SecuritySection() {
  return (
    <section id="security" className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Security & Compliance</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Enterprise-grade security and compliance features for regulated environments.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                  <Icon size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
