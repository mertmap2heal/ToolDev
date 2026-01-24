import { useState } from 'react'
import clsx from 'clsx'

type TabId = 'zsa' | 'pra' | 'cmf'

const TABS: { id: TabId; label: string }[] = [
  { id: 'zsa', label: 'Zonal Safety Analysis (ZSA)' },
  { id: 'pra', label: 'Particular Risk Analysis (PRA)' },
  { id: 'cmf', label: 'Common Mode Failures (CMF)' },
]

export default function CcaForm() {
  const [activeTab, setActiveTab] = useState<TabId>('zsa')
  const [zsaItems, setZsaItems] = useState('')
  const [zsaNarrative, setZsaNarrative] = useState('')
  const [zsaMitigations, setZsaMitigations] = useState('')
  const [praItems, setPraItems] = useState('')
  const [praNarrative, setPraNarrative] = useState('')
  const [praMitigations, setPraMitigations] = useState('')
  const [cmfItems, setCmfItems] = useState('')
  const [cmfNarrative, setCmfNarrative] = useState('')
  const [cmfMitigations, setCmfMitigations] = useState('')
  const [linkedHazards, setLinkedHazards] = useState('')
  const [linkedReqs, setLinkedReqs] = useState('')

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        CCA — Common Cause Analysis
      </h4>
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === t.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'zsa' && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Affected systems/items (placeholder links)</label>
            <input
              type="text"
              value={zsaItems}
              onChange={(e) => setZsaItems(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Risk narrative</label>
            <textarea
              value={zsaNarrative}
              onChange={(e) => setZsaNarrative(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mitigations</label>
            <textarea
              value={zsaMitigations}
              onChange={(e) => setZsaMitigations(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      )}

      {activeTab === 'pra' && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Affected systems/items (placeholder links)</label>
            <input
              type="text"
              value={praItems}
              onChange={(e) => setPraItems(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Risk narrative</label>
            <textarea
              value={praNarrative}
              onChange={(e) => setPraNarrative(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mitigations</label>
            <textarea
              value={praMitigations}
              onChange={(e) => setPraMitigations(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      )}

      {activeTab === 'cmf' && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Affected systems/items (placeholder links)</label>
            <input
              type="text"
              value={cmfItems}
              onChange={(e) => setCmfItems(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Risk narrative</label>
            <textarea
              value={cmfNarrative}
              onChange={(e) => setCmfNarrative(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mitigations</label>
            <textarea
              value={cmfMitigations}
              onChange={(e) => setCmfMitigations(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Outputs</h5>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-gray-500 dark:text-gray-400 mb-1">Linked hazards</label>
            <input
              type="text"
              value={linkedHazards}
              onChange={(e) => setLinkedHazards(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-gray-500 dark:text-gray-400 mb-1">Linked requirements</label>
            <input
              type="text"
              value={linkedReqs}
              onChange={(e) => setLinkedReqs(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
