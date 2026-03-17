import { useState } from 'react'

interface FmeaRow {
  id: string
  item: string
  function_: string
  failureMode: string
  cause: string
  localEffect: string
  endEffect: string
  detection: string
  mitigation: string
  severity: string
  occurrence: string
  detectionRating: string
  rpn: string
}

const SEVERITY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const INITIAL_ROW: Omit<FmeaRow, 'id'> = {
  item: '',
  function_: '',
  failureMode: '',
  cause: '',
  localEffect: '',
  endEffect: '',
  detection: '',
  mitigation: '',
  severity: '',
  occurrence: '',
  detectionRating: '',
  rpn: '—',
}

let nextId = 1
function genId() {
  return `fmea-${nextId++}`
}

export default function FmeaForm() {
  const [rows, setRows] = useState<FmeaRow[]>([{ ...INITIAL_ROW, id: genId() }])

  const addRow = () => {
    setRows((prev) => [...prev, { ...INITIAL_ROW, id: genId() }])
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: keyof FmeaRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        FMEA — Failure Modes and Effects Analysis
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Table editor. RPN is display only; no computation.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Item</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Function</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Failure mode</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Cause</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Local effect</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">End effect</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Detection</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Mitigation</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Sev</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Occ</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Det</th>
              <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">RPN</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-1 px-2">
                  <input
                    value={r.item}
                    onChange={(e) => updateRow(r.id, 'item', e.target.value)}
                    placeholder="Link"
                    className="w-24 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.function_}
                    onChange={(e) => updateRow(r.id, 'function_', e.target.value)}
                    className="w-20 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.failureMode}
                    onChange={(e) => updateRow(r.id, 'failureMode', e.target.value)}
                    className="w-24 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.cause}
                    onChange={(e) => updateRow(r.id, 'cause', e.target.value)}
                    className="w-20 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.localEffect}
                    onChange={(e) => updateRow(r.id, 'localEffect', e.target.value)}
                    className="w-24 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.endEffect}
                    onChange={(e) => updateRow(r.id, 'endEffect', e.target.value)}
                    className="w-24 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.detection}
                    onChange={(e) => updateRow(r.id, 'detection', e.target.value)}
                    className="w-20 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.mitigation}
                    onChange={(e) => updateRow(r.id, 'mitigation', e.target.value)}
                    className="w-24 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <select
                    value={r.severity}
                    onChange={(e) => updateRow(r.id, 'severity', e.target.value)}
                    className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    <option value="">—</option>
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.occurrence}
                    onChange={(e) => updateRow(r.id, 'occurrence', e.target.value)}
                    placeholder="—"
                    className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.detectionRating}
                    onChange={(e) => updateRow(r.id, 'detectionRating', e.target.value)}
                    placeholder="—"
                    className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-2 text-gray-500 dark:text-gray-400">{r.rpn}</td>
                <td className="py-1 px-1">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        + Add row
      </button>
    </div>
  )
}
