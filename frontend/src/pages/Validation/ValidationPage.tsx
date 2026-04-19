import { Hammer } from 'lucide-react'

/**
 * #280: explicit Coming Soon placeholder instead of the ambiguous
 * "features will be implemented here" shell.
 */
export default function ValidationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Validation</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Validation plans and results — confirm the right product meets
          stakeholder needs.
        </p>
      </div>
      <div className="p-8 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-center">
        <Hammer size={36} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Coming soon
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          The Validation module is not yet implemented. Tracking for a
          future release — the current page is a placeholder.
        </p>
      </div>
    </div>
  )
}
