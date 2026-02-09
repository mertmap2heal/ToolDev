import { Outlet, Link } from 'react-router-dom'
import { ShieldX, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function PlatformAdminRouteGuard() {
  const { user } = useAuthStore()

  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const isSuperiorAdmin =
    user?.role === 'SUPERIOR_ADMIN' || user?.isSuperiorAdmin === true

  if (!isSuperiorAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 max-w-md mx-auto text-center">
          <ShieldX size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You do not have permission to access Platform Admin.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return <Outlet />
}
