import { X, Lock } from 'lucide-react'

interface LockWarningModalProps {
    isOpen: boolean
    onClose: () => void
    message: string
    title?: string
}

export default function LockWarningModal({
    isOpen,
    onClose,
    message,
    title = 'Requirement Locked',
}: LockWarningModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                            <Lock size={20} className="text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                        <p className="text-red-800 dark:text-red-300">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
