import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Menu } from 'lucide-react'
import CategoryTabs from './CategoryTabs'
import ModuleLauncher from './ModuleLauncher'
import QuickAccessBar from './QuickAccessBar'
import ModuleDrawer from './ModuleDrawer'
import { type ModuleCategory } from '../../config/ModuleConfiguration'

const DEFAULT_PINNED_IDS = ['requirements', 'issues', 'change-requests', 'verification']

// Custom hook since usehooks-ts might not be available
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue
        }
        try {
            // Get from local storage by key
            const item = window.localStorage.getItem(key)
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            // If error also return initialValue
            console.log(error)
            return initialValue
        }
    })

    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue = (value: T) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore =
                value instanceof Function ? value(storedValue) : value
            // Save state
            setStoredValue(valueToStore)
            // Save to local storage
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore))
            }
        } catch (error) {
            // A more advanced implementation would handle the error case
            console.log(error)
        }
    }
    return [storedValue, setValue]
}

export default function TopMegaNav() {
    const { projectId } = useParams<{ projectId: string }>()

    // Persistence
    const [activeCategory, setActiveCategory] = useLocalStorage<ModuleCategory>('mega-menu-category', 'system')
    const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>('mega-menu-pinned', DEFAULT_PINNED_IDS)

    const pinnedSet = new Set(pinnedIds)

    // Responsive State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // Listen for screen resize to close drawer if going back to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1200) {
                setIsDrawerOpen(false)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const handleTogglePin = (moduleId: string) => {
        const newSet = new Set(pinnedSet)
        if (newSet.has(moduleId)) {
            newSet.delete(moduleId)
        } else {
            newSet.add(moduleId)
        }
        setPinnedIds(Array.from(newSet))
    }

    return (
        <div className="mt-4">
            <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden mb-6">
                <div className="px-4 py-3">
                    {/* Desktop View (>= 1200px) */}
                    <div className="hidden xl:block space-y-3">
                        <div className="flex items-center justify-between">
                            <CategoryTabs activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
                        </div>

                        <ModuleLauncher
                            activeCategory={activeCategory}
                            projectId={projectId}
                            pinnedIds={pinnedSet}
                            onTogglePin={handleTogglePin}
                        />

                        <QuickAccessBar
                            projectId={projectId}
                            pinnedIds={pinnedSet}
                            onTogglePin={handleTogglePin}
                        />
                    </div>

                    {/* Mobile/Tablet View (< 1200px) */}
                    <div className="xl:hidden flex items-center justify-between">
                        <div className="font-semibold text-gray-700 dark:text-gray-200">
                            Menu
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                            >
                                <Menu size={18} />
                                <span>Browse Modules</span>
                            </button>
                        </div>
                    </div>

                    {/* Mobile Quick Access (visible below header) */}
                    <div className="xl:hidden mt-2">
                        <QuickAccessBar
                            projectId={projectId}
                            pinnedIds={pinnedSet}
                            onTogglePin={handleTogglePin}
                        />
                    </div>
                </div>
            </div>

            <ModuleDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                projectId={projectId}
                pinnedIds={pinnedSet}
                onTogglePin={handleTogglePin}
            />
        </div>
    )
}
