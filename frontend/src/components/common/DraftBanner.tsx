import { RotateCcw } from 'lucide-react'

interface DraftBannerProps {
  onDiscard: () => void
}

export default function DraftBanner({ onDiscard }: DraftBannerProps) {
  return (
    <button
      type="button"
      onClick={onDiscard}
      title="Clear all fields"
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-amber-200 dark:border-amber-700"
    >
      <RotateCcw size={12} />
      Clear all
    </button>
  )
}
