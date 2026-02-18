import { CheckCircle } from 'lucide-react'


export default function ValidationPage() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Validation</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Validation plans and results — confirm the right product meets stakeholder needs.
        </p>
      </div>
      <div className="p-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400">
        <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Validation features will be implemented here.</p>
      </div>
    </div>
  )
}
