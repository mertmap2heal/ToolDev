import { useState } from 'react'

const MOCK_OBJECTIVES = [
  { id: 'o1', objective: 'Objective 1', allocation: 'System A' },
  { id: 'o2', objective: 'Objective 2', allocation: 'System B' },
]

export default function PssaForm() {
  const [assumptions, setAssumptions] = useState('')
  const [redundancyNotes, setRedundancyNotes] = useState('')
  const [verificationStrategy, setVerificationStrategy] = useState('')
  const [complianceStatement, setComplianceStatement] = useState('')
  const [openIssues, setOpenIssues] = useState('')

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">PSSA — Preliminary System Safety Assessment</h4>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Architecture assumptions</label>
        <textarea
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
          placeholder="Architecture assumptions"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Allocated safety objectives</label>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Objective</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_OBJECTIVES.map((r) => (
                <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-2 px-3 text-gray-900 dark:text-white">{r.objective}</td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{r.allocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Redundancy / independence notes</label>
        <textarea
          value={redundancyNotes}
          onChange={(e) => setRedundancyNotes(e.target.value)}
          placeholder="Notes"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Planned verification strategy (link placeholders)</label>
        <input
          type="text"
          value={verificationStrategy}
          onChange={(e) => setVerificationStrategy(e.target.value)}
          placeholder="Link to Verification / Test Plans"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Outputs</h5>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Compliance statement</label>
            <input
              type="text"
              value={complianceStatement}
              onChange={(e) => setComplianceStatement(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Open issues</label>
            <input
              type="text"
              value={openIssues}
              onChange={(e) => setOpenIssues(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
