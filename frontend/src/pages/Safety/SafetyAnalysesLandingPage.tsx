import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { MOCK_METHOD_METADATA } from '../../data/mockSafety'
import type { SafetyMethod } from '../../types/safety.types'

const METHOD_IDS: SafetyMethod[] = [
  'FHA',
  'PSSA',
  'SSA',
  'FMEA',
  'FTA',
  'CCA',
  'Markov',
]

export default function SafetyAnalysesLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [glossaryOpen, setGlossaryOpen] = useState(true)

  const handleMethodClick = (method: SafetyMethod) => {
    if (projectId) {
      navigate(`/projects/${projectId}/safety-analysis/analyses/${method.toLowerCase()}`)
    }
  }

  const methods = MOCK_METHOD_METADATA.filter((m) => METHOD_IDS.includes(m.id))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Safety Analyses
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Select a method to view analyses or create a new one.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => handleMethodClick(m.id)}
              className="w-full flex items-start gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {m.name}
                  </h3>
                  <ChevronRight size={18} className="text-gray-400 shrink-0" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {m.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Level: {m.level}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                  &ldquo;{m.question}&rdquo;
                </p>
                <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Draft: {m.draftCount}</span>
                  <span>In Review: {m.inReviewCount}</span>
                  <span>Approved: {m.approvedCount}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden sticky top-4">
            <button
              onClick={() => setGlossaryOpen(!glossaryOpen)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <BookOpen size={16} />
                Methods Glossary
              </span>
              {glossaryOpen ? (
                <ChevronUp size={16} className="text-gray-500" />
              ) : (
                <ChevronDown size={16} className="text-gray-500" />
              )}
            </button>
            {glossaryOpen && (
              <div className="p-4 space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {m.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {m.level}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">
                      {m.question}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
