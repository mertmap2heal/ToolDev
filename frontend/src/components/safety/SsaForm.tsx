import { useState } from 'react'

export default function SsaForm() {
  const [archRef, setArchRef] = useState('')
  const [evidenceLinks, setEvidenceLinks] = useState('')
  const [residualRisk, setResidualRisk] = useState('')
  const [meetsObjectives, setMeetsObjectives] = useState(false)
  const [certNotes, setCertNotes] = useState('')

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">SSA — System Safety Assessment</h4>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Final architecture reference (link to MBSE / Documentation)</label>
        <input
          type="text"
          value={archRef}
          onChange={(e) => setArchRef(e.target.value)}
          placeholder="Placeholder link"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Safety objective verification evidence (placeholders)</label>
        <input
          type="text"
          value={evidenceLinks}
          onChange={(e) => setEvidenceLinks(e.target.value)}
          placeholder="Placeholder"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Residual risk notes</label>
        <textarea
          value={residualRisk}
          onChange={(e) => setResidualRisk(e.target.value)}
          placeholder="Residual risk"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Outputs</h5>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={meetsObjectives}
              onChange={(e) => setMeetsObjectives(e.target.checked)}
              className="rounded"
            />
            Meets objectives (UI only)
          </label>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Certification notes</label>
            <textarea
              value={certNotes}
              onChange={(e) => setCertNotes(e.target.value)}
              placeholder="Notes"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
