import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

export type RelationshipItem = {
  id: string
  label: string
  subLabel?: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  title?: string
}

export type RelationshipSection = {
  id: string
  label: string
  items: RelationshipItem[]
  emptyText?: string
}

export default function RelationshipsPanel({
  title = 'Relationships',
  sections,
  className,
  dense = false,
}: {
  title?: string
  sections: RelationshipSection[]
  className?: string
  dense?: boolean
}) {
  if (!sections.length) return null

  return (
    <div className={clsx('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
      </div>
      <div className={clsx('px-4 py-3 space-y-3', dense && 'py-2')}>
        {sections.map((section) => (
          <div key={section.id} className="space-y-1.5">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {section.label}
            </div>
            {section.items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {section.emptyText ?? '—'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const clickable = typeof item.onClick === 'function' && !item.disabled
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      disabled={!clickable}
                      title={item.title}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                        'border-gray-200 dark:border-gray-700',
                        clickable
                          ? 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                          : 'bg-gray-50/40 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 cursor-default',
                        item.disabled && 'opacity-60'
                      )}
                    >
                      {Icon && <Icon size={14} className="flex-shrink-0" />}
                      <span className="font-medium">{item.label}</span>
                      {item.subLabel && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.subLabel}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

