import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Pin, PinOff } from 'lucide-react'
import clsx from 'clsx'
import { MODULES, type ModuleCategory } from '../../config/ModuleConfiguration'

interface ModuleLauncherProps {
    activeCategory: ModuleCategory
    projectId: string | undefined
    pinnedIds: Set<string>
    onTogglePin: (moduleId: string) => void
}

export default function ModuleLauncher({ activeCategory, projectId, pinnedIds, onTogglePin }: ModuleLauncherProps) {
    const navigate = useNavigate()
    const modules = MODULES.filter((m) => m.category === activeCategory)

    // Responsive overflow handling (simplified for this iteration)
    // In a real optimized version, we'd use ResizeObserver to determine how many fit.
    // For now, we'll arbitrarily limit to ~8 visible, then dropdown.
    const VISIBLE_LIMIT = 8
    const visibleModules = modules.slice(0, VISIBLE_LIMIT)
    const overflowModules = modules.slice(VISIBLE_LIMIT)

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleNavigation = (route: string) => {
        if (projectId) {
            navigate(`/projects/${projectId}/${route}`)
            setIsDropdownOpen(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2 mt-4">
            {visibleModules.map((module) => (
                <div key={module.id} className="relative group">
                    <button
                        onClick={() => handleNavigation(module.route)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all duration-200 min-w-[140px]"
                        title={module.tooltip || module.label}
                    >
                        <module.icon size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {module.label}
                        </span>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(module.id)
                        }}
                        className={clsx(
                            "absolute -top-1 -right-1 p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity",
                            pinnedIds.has(module.id) && "opacity-100 text-blue-500"
                        )}
                        title={pinnedIds.has(module.id) ? "Unpin" : "Pin to Quick Access"}
                    >
                        {pinnedIds.has(module.id) ?
                            <PinOff size={12} className="text-blue-500" fill="currentColor" /> :
                            <Pin size={12} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                        }
                    </button>
                </div>
            ))}

            {overflowModules.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    >
                        More <ChevronDown size={14} />
                    </button>

                    {isDropdownOpen && (
                        <div role="menu" className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                            {overflowModules.map((module) => (
                                <div key={module.id} className="relative group/item px-1">
                                    <button
                                        onClick={() => handleNavigation(module.route)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                                    >
                                        <module.icon size={16} className="text-gray-400 group-hover/item:text-blue-500" />
                                        {module.label}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTogglePin(module.id)
                                        }}
                                        className={clsx(
                                            "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600",
                                            pinnedIds.has(module.id) && "opacity-100"
                                        )}
                                    >
                                        {pinnedIds.has(module.id) ?
                                            <PinOff size={12} className="text-blue-500" fill="currentColor" /> :
                                            <Pin size={12} className="text-gray-400" />
                                        }
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
