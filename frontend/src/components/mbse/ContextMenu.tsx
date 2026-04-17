import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { MenuItem } from './contextMenuHelpers'

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/**
 * Context menu for element right-click actions
 */
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let newX = x
      let newY = y

      if (x + rect.width > viewportWidth - 10) {
        newX = viewportWidth - rect.width - 10
      }

      if (y + rect.height > viewportHeight - 10) {
        newY = viewportHeight - rect.height - 10
      }

      setAdjustedPosition({ x: Math.max(10, newX), y: Math.max(10, newY) })
    }
  }, [x, y])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return
    if (item.submenu) {
      setActiveSubmenu(activeSubmenu === item.id ? null : item.id)
    } else if (item.onClick) {
      item.onClick()
      onClose()
    }
  }

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.divider) {
      return <div key={`divider-${index}`} className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
    }

    const hasSubmenu = item.submenu && item.submenu.length > 0
    const isSubmenuActive = activeSubmenu === item.id

    return (
      <div
        key={item.id}
        className="relative"
        onMouseEnter={() => hasSubmenu && setActiveSubmenu(item.id)}
        onMouseLeave={() => hasSubmenu && setActiveSubmenu(null)}
      >
        <button
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors rounded',
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : item.danger
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          )}
        >
          {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
          <span className="flex-1">{item.label}</span>
          {hasSubmenu && <ChevronRight size={14} className="text-gray-400" />}
        </button>

        {hasSubmenu && isSubmenuActive && (
          <div className="absolute left-full top-0 ml-1 min-w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            {item.submenu!.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item, index) => renderMenuItem(item, index))}
    </div>,
    document.body,
  )
}
