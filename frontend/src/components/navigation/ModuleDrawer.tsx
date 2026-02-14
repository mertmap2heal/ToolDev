import { X, Pin, PinOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import CategoryTabs from './CategoryTabs'
import { MODULES, type ModuleCategory } from '../../config/ModuleConfiguration'

interface ModuleDrawerProps {
    isOpen: boolean
    onClose: () => void
    activeCategory: ModuleCategory
    onSelectCategory: (category: ModuleCategory) => void
    projectId: string | undefined
    pinnedIds: Set<string>
    onTogglePin: (moduleId: string) => void
}

export default function ModuleDrawer({
    isOpen,
    onClose,
    activeCategory,
    onSelectCategory,
    projectId,
    pinnedIds,
    onTogglePin,
}: ModuleDrawerProps) {
    const navigate = useNavigate()
    const modules = MODULES.filter((m) => m.category === activeCategory)

    if (!isOpen) return null

    const handleNavigation = (route: string) => {
        if (projectId) {
            navigate(`/projects/${projectId}/${route}`)
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div className="relative w-80 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col transition-transform duration-300">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Modules</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <CategoryTabs activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                    {modules.map(module => (
                        <div key={module.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors">
                            <button
                                onClick={() => handleNavigation(module.route)}
                                className="flex items-center gap-3 flex-1 text-left"
                            >
                                <module.icon size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" />
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {module.label}
                                    </div>
                                    {module.tooltip && (
                                        <div className="text-xs text-gray-400 dark:text-gray-500">{module.tooltip}</div>
                                    )}
                                </div>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(module.id);
                                }}
                                className={clsx(
                                    "p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                                    pinnedIds.has(module.id) ? "text-blue-500" : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                                )}
                            >
                                {pinnedIds.has(module.id) ? <PinOff size={16} fill="currentColor" /> : <Pin size={16} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
