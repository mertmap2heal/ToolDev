import { Hammer } from 'lucide-react'

/**
 * #280: the Architecture page used to render a search box + collapsible
 * filter shell + "Architecture form will be implemented here" panel —
 * controls that do nothing behind a page header that looked finished.
 * Replace with a single explicit Coming Soon card so users know the
 * module is not ready.
 */
export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Architecture</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Block diagrams, allocations, and interface contracts.
        </p>
      </div>
      <div className="p-8 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-center">
        <Hammer size={36} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Coming soon
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          The Architecture module is not yet implemented. Tracking for a
          future release — the current page is a placeholder and does not
          persist any input.
        </p>
      </div>
    </div>
  )
}
