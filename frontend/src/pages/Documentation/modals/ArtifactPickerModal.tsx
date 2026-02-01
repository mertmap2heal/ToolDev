import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ArtifactReferenceBlock } from '../types'

const TABS = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'verification', label: 'Verification' },
  { id: 'risks', label: 'Risks' },
  { id: 'issues', label: 'Issues' },
  { id: 'changeRequests', label: 'Change Requests' },
  { id: 'configBaselines', label: 'Config Baselines' },
] as const

const MOCK_ITEMS: Record<string, { id: string; title: string }[]> = {
  requirements: [
    { id: 'R-001', title: 'System shall meet DO-178C' },
    { id: 'R-002', title: 'Interface definitions' },
    { id: 'R-003', title: 'Performance budget' },
  ],
  interfaces: [
    { id: 'IF-001', title: 'Power interface' },
    { id: 'IF-002', title: 'Data bus' },
  ],
  verification: [
    { id: 'V-001', title: 'Test plan SRS' },
    { id: 'V-002', title: 'Test case TC-01' },
  ],
  risks: [
    { id: 'RISK-001', title: 'Schedule risk' },
    { id: 'RISK-002', title: 'Technical risk' },
  ],
  issues: [
    { id: 'ISS-001', title: 'Open issue 1' },
    { id: 'ISS-002', title: 'Open issue 2' },
  ],
  changeRequests: [
    { id: 'CR-001', title: 'Change request A' },
    { id: 'CR-002', title: 'Change request B' },
  ],
  configBaselines: [
    { id: 'CB-001', title: 'Baseline 1' },
    { id: 'CB-002', title: 'Baseline 2' },
  ],
}

interface ArtifactPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (block: ArtifactReferenceBlock) => void
}

export default function ArtifactPickerModal({ isOpen, onClose, onSelect }: ArtifactPickerModalProps) {
  const [activeTab, setActiveTab] = useState<string>('requirements')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const items = MOCK_ITEMS[activeTab] ?? []

  const handleSelect = (id: string, title: string) => {
    const label = TABS.find((t) => t.id === activeTab)?.label ?? activeTab
    onSelect({
      type: 'artifact_reference',
      artifactType: activeTab,
      artifactId: id,
      sourceModule: label,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Insert Artifact Reference</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="border-b border-gray-200 dark:border-gray-700 flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item.id, item.title)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.id}</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {items.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No items in this category (mock data).</p>
          )}
        </div>
      </div>
    </div>
  )
}
