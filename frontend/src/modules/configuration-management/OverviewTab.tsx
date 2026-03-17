import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  Package,
  CheckCircle,
  Shield,
  FileEdit,
  Layers,
  Truck,
  ClipboardList,
} from 'lucide-react'
import { useCMStore } from './store'

export default function OverviewTab() {
  const { state } = useCMStore()
  const { configurationItems, baselines, changeRequests, releases, auditLog } = state

  const totalCIs = configurationItems.length
  const releasedCIs = useMemo(
    () => configurationItems.filter((c) => c.status === 'Released').length,
    [configurationItems]
  )
  const safetyCriticalCIs = useMemo(
    () => configurationItems.filter((c) => c.safetyCritical).length,
    [configurationItems]
  )
  const openCRs = useMemo(
    () =>
      changeRequests.filter(
        (r) => r.status === 'Proposed' || r.status === 'UnderReview'
      ).length,
    [changeRequests]
  )
  const activeBaselines = useMemo(
    () =>
      baselines.filter(
        (b) => b.status === 'Approved' || b.status === 'Frozen' || b.status === 'Submitted'
      ).length,
    [baselines]
  )
  const pendingReleases = useMemo(
    () => releases.filter((r) => r.status === 'Draft' || r.status === 'Review').length,
    [releases]
  )
  const recentActivity = useMemo(
    () => [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10),
    [auditLog]
  )

  const cards = [
    { label: 'Total CIs', value: totalCIs, icon: Package },
    { label: 'Released CIs', value: releasedCIs, icon: CheckCircle },
    { label: 'Safety-critical CIs', value: safetyCriticalCIs, icon: Shield },
    { label: 'Open Change Requests', value: openCRs, icon: FileEdit },
    { label: 'Active Baselines', value: activeBaselines, icon: Layers },
    { label: 'Pending Releases', value: pendingReleases, icon: Truck },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {label}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Icon size={20} className="text-gray-400 dark:text-gray-500" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Compliance Snapshot
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Placeholder toggles for standards (UI only)
            </p>
          </div>
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">DO-178C</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">ARP-4754A</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">EN 9100</span>
            </label>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <ClipboardList size={16} className="text-gray-400" />
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                No activity yet.
              </div>
            ) : (
              recentActivity.map((event) => (
                <div
                  key={event.eventId}
                  className="px-4 py-2 text-sm flex flex-wrap items-center gap-2"
                >
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {format(new Date(event.timestamp), 'MMM d, HH:mm')}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{event.actor}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {event.action}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">{event.objectRef}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                    {event.details}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
