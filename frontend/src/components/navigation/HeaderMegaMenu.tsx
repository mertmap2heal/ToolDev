import { useNavigate } from 'react-router-dom'
import { Pin, PinOff, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { MODULES, type ModuleCategory } from '../../config/ModuleConfiguration'
import { useFeaturePackage } from '../../contexts/FeaturePackageContext'

interface HeaderMegaMenuProps {
    activeCategory: ModuleCategory | null
    projectId: string | undefined
    pinnedIds: Set<string>
    onTogglePin: (moduleId: string) => void
    isOpen: boolean
    onClose: () => void
}

export default function HeaderMegaMenu({ activeCategory, projectId, pinnedIds, onTogglePin, isOpen, onClose }: HeaderMegaMenuProps) {
    const navigate = useNavigate()
    const { isEnabled } = useFeaturePackage()

    if (!isOpen || !activeCategory) return null

    const modules = MODULES.filter((m) => m.category === activeCategory && isEnabled(m.id))

    const handleNavigation = (route: string) => {
        if (projectId) {
            navigate(`/projects/${projectId}/${route}`)
            onClose()
        }
    }

    return (
        <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-lg z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="container mx-auto px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {modules.map((module) => (
                        <div key={module.id} className="relative group">
                            <button
                                onClick={() => handleNavigation(module.route)}
                                className="w-full flex items-start p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                            >
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 mr-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                                    <module.icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white flex items-center justify-between">
                                        {module.label}
                                        <ChevronRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                                    </div>
                                    {module.tooltip && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                            {module.tooltip}
                                        </div>
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(module.id)
                                }}
                                className={clsx(
                                    "absolute top-2 right-2 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all",
                                    pinnedIds.has(module.id)
                                        ? "opacity-100 text-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "opacity-0 group-hover:opacity-100 text-gray-400"
                                )}
                                title={pinnedIds.has(module.id) ? "Unpin" : "Pin to Quick Access"}
                            >
                                {pinnedIds.has(module.id) ?
                                    <PinOff size={14} fill="currentColor" /> :
                                    <Pin size={14} />
                                }
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Backdrop for clicking outside */}
            <div
                className="fixed inset-0 top-[var(--header-height)] z-[-1]"
                onClick={onClose}
                aria-hidden="true"
            />
        </div>
    )
}
