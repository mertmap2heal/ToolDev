import { Link } from 'react-router-dom'

export default function PlatformAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Platform Admin
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Manage companies, company limits, and view global audit logs. Use the sidebar to switch company context.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/platform-admin/companies"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Companies</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View and manage companies
          </p>
        </Link>
        <Link
          to="/platform-admin/limits"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Company limits</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            User quota per company
          </p>
        </Link>
        <Link
          to="/platform-admin/audit-logs"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Global audit logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Platform-wide audit trail
          </p>
        </Link>
      </div>
    </div>
  )
}
