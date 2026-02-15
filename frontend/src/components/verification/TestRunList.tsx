import { Plus, Play } from 'lucide-react'

export default function TestRunList() {
    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                    <Plus size={16} />
                    Create Test Run
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Play size={32} className="text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Test Runs</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                    Test runs allow you to execute a set of test cases and track their results over time.
                </p>
                <button className="px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    Learn more about Test Runs
                </button>
            </div>
        </div>
    )
}
