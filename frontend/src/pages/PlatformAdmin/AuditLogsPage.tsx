export default function AuditLogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Global audit logs
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Platform-wide audit trail for administrative actions.
      </p>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Global audit log entries will be loaded from the platform-admin API.
        </p>
      </div>
    </div>
  )
}
