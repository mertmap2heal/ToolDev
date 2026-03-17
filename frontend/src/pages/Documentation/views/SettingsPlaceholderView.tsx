import { Hash, Tag, Bookmark } from 'lucide-react'

export default function SettingsPlaceholderView() {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <Hash size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Document numbering rules</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Planned feature. Numbering rules will be configurable here.</p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <Tag size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Naming conventions</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Planned feature. Naming conventions will be configurable here.</p>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Classification tags</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Planned feature. Classification tags will be configurable here.</p>
      </div>
    </div>
  )
}
