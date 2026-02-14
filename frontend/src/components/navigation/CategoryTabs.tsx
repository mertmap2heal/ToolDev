import clsx from 'clsx'
import { CATEGORIES, type ModuleCategory } from '../../config/ModuleConfiguration'

interface CategoryTabsProps {
    activeCategory: ModuleCategory
    onSelectCategory: (category: ModuleCategory) => void
}

export default function CategoryTabs({ activeCategory, onSelectCategory }: CategoryTabsProps) {
    return (
        <div role="tablist" className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
            {CATEGORIES.map((category) => (
                <button
                    key={category.id}
                    role="tab"
                    aria-selected={activeCategory === category.id}
                    aria-controls={`panel-${category.id}`}
                    id={`tab-${category.id}`}
                    onClick={() => onSelectCategory(category.id)}
                    className={clsx(
                        'px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                        activeCategory === category.id
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                    )}
                >
                    {category.label}
                </button>
            ))}
        </div>
    )
}
