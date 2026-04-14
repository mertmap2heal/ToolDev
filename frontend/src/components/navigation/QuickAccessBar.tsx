import { useNavigate } from 'react-router-dom'
import { PinOff } from 'lucide-react'
import { MODULES } from '../../config/ModuleConfiguration'
import { useFeaturePackage } from '../../contexts/FeaturePackageContext'

interface QuickAccessBarProps {
    projectId: string | undefined
    pinnedIds: Set<string>
    onTogglePin: (moduleId: string) => void
}

export default function QuickAccessBar({ projectId, pinnedIds, onTogglePin }: QuickAccessBarProps) {
    const navigate = useNavigate()
    const { isEnabled } = useFeaturePackage()
    const pinnedModules = MODULES.filter((m) => pinnedIds.has(m.id) && isEnabled(m.id))

    if (pinnedModules.length === 0) return null

    const handleNavigation = (route: string) => {
        if (projectId) {
            navigate(`/projects/${projectId}/${route}`)
        }
    }

    return (
        <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider min-w-fit">Quick Access:</div>
            <div className="flex flex-wrap gap-1.5">
                {pinnedModules.map((module) => (
                    <div key={module.id} className="group relative">
                        <button
                            onClick={() => handleNavigation(module.route)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                        >
                            <module.icon size={10} />
                            <span className="font-medium">{module.label}</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(module.id);
                            }}
                            className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-sm border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                            title="Unpin"
                        >
                            <PinOff size={10} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
