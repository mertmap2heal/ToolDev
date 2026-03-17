import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export interface StepPair {
  id: string
  step: string
  expectedResult: string
  designNote?: string
}

interface StructuredStepEditorProps {
  pairs: StepPair[]
  onChange: (pairs: StepPair[]) => void
  readOnly?: boolean
  placeholder?: { step?: string; expected?: string }
  className?: string
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function parseStepsToPairs(
  steps: unknown,
  expectedResults: unknown,
  designNotes?: string[]
): StepPair[] {
  const stepsArr = Array.isArray(steps) ? steps : steps ? [String(steps)] : []
  const expectedArr = Array.isArray(expectedResults) ? expectedResults : expectedResults ? [String(expectedResults)] : []
  const notesArr = Array.isArray(designNotes) ? designNotes : []
  const maxLen = Math.max(stepsArr.length, expectedArr.length, notesArr.length, 1)
  return Array.from({ length: maxLen }, (_, i) => ({
    id: generateId(),
    step: String(stepsArr[i] ?? ''),
    expectedResult: String(expectedArr[i] ?? ''),
    designNote: String(notesArr[i] ?? ''),
  }))
}

export function pairsToStepsAndExpected(pairs: StepPair[]): { steps: string[]; expectedResults: string[] } {
  const steps = pairs.map((p) => p.step.trim())
  const expectedResults = pairs.map((p) => p.expectedResult.trim())
  return { steps, expectedResults }
}

export default function StructuredStepEditor({
  pairs,
  onChange,
  readOnly = false,
  placeholder = {},
  className,
}: StructuredStepEditorProps) {
  const addStep = () => {
    onChange([...pairs, { id: generateId(), step: '', expectedResult: '' }])
  }

  const removeStep = (id: string) => {
    if (pairs.length <= 1) return
    onChange(pairs.filter((p) => p.id !== id))
  }

  const updatePair = (id: string, updates: Partial<Pick<StepPair, 'step' | 'expectedResult' | 'designNote'>>) => {
    onChange(
      pairs.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }

  const moveUp = (index: number) => {
    if (index <= 0) return
    const next = [...pairs]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index >= pairs.length - 1) return
    const next = [...pairs]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Steps & Expected Results
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-1 px-2 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Step
          </button>
        )}
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <div
            key={pair.id}
            className="flex gap-2 items-start p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
          >
            {!readOnly && (
              <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp size={18} />
                </button>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === pairs.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            )}
            {readOnly && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0 mt-1">
                {idx + 1}.
              </span>
            )}

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                {readOnly ? (
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {pair.step || '—'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={pair.step}
                    onChange={(e) => updatePair(pair.id, { step: e.target.value })}
                    placeholder={placeholder.step ?? `Step ${idx + 1}`}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Expected result
                </span>
                {readOnly ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {pair.expectedResult || '—'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={pair.expectedResult}
                    onChange={(e) => updatePair(pair.id, { expectedResult: e.target.value })}
                    placeholder={placeholder.expected ?? `Expected result for step ${idx + 1}`}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>
              {!readOnly && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Design note (optional)
                  </span>
                  <input
                    type="text"
                    value={pair.designNote ?? ''}
                    onChange={(e) => updatePair(pair.id, { designNote: e.target.value })}
                    placeholder="Review note or observation for this step"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
              {readOnly && (pair.designNote ?? '').trim() && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Design note
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap italic">
                    {pair.designNote}
                  </p>
                </div>
              )}
            </div>

            {!readOnly && pairs.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(pair.id)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 rounded-lg transition-colors shrink-0"
                title="Remove step"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
