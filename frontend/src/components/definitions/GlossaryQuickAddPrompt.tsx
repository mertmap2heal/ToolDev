import { FileText } from 'lucide-react'

interface GlossaryQuickAddPromptProps {
  term: string
  onAddGlossary: () => void
  onAddAbbreviation: () => void
  onIgnore: () => void
}

export default function GlossaryQuickAddPrompt({
  term,
  onAddGlossary,
  onAddAbbreviation,
  onIgnore,
}: GlossaryQuickAddPromptProps) {
  return (
    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-left">
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
        <FileText size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
        Add &quot;{term}&quot; to Glossary or Abbreviations?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddGlossary}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Add as Glossary
        </button>
        <button
          type="button"
          onClick={onAddAbbreviation}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Add as Abbreviation
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  )
}
