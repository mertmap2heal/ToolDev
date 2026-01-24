const SEVERITY_DEFINITIONS = [
  { name: 'Catastrophic', description: 'Multiple fatalities; hull loss.' },
  { name: 'Hazardous', description: 'Large reduction in safety margins; serious injuries.' },
  { name: 'Major', description: 'Significant reduction in safety margins.' },
  { name: 'Minor', description: 'Slight reduction in safety margins.' },
  { name: 'No Safety Effect', description: 'No effect on safety.' },
]

const STATUS_DEFINITIONS = [
  { name: 'Draft', description: 'Work in progress.' },
  { name: 'Open', description: 'Accepted; not yet mitigated.' },
  { name: 'Mitigated', description: 'Mitigations in place.' },
  { name: 'Verified', description: 'Verification complete.' },
  { name: 'Closed', description: 'No longer applicable or accepted.' },
]

const NAMING_RULES = [
  { id: '1', rule: 'Hazard IDs', value: 'HZD-XXX (placeholder)' },
  { id: '2', rule: 'Analysis IDs', value: 'By method + sequence (placeholder)' },
]

export default function SafetySettingsPage() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Safety Settings
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Read-only reference. Future rule-engine toggles are placeholders.
      </p>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
          Severity definitions
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {SEVERITY_DEFINITIONS.map((s) => (
              <tr
                key={s.name}
                className="border-t border-gray-200 dark:border-gray-700"
              >
                <td className="py-2 px-4 text-gray-900 dark:text-white">{s.name}</td>
                <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                  {s.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
          Status definitions
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {STATUS_DEFINITIONS.map((s) => (
              <tr
                key={s.name}
                className="border-t border-gray-200 dark:border-gray-700"
              >
                <td className="py-2 px-4 text-gray-900 dark:text-white">{s.name}</td>
                <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                  {s.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
          Naming rules (placeholders)
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Rule
              </th>
              <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {NAMING_RULES.map((r) => (
              <tr
                key={r.id}
                className="border-t border-gray-200 dark:border-gray-700"
              >
                <td className="py-2 px-4 text-gray-900 dark:text-white">{r.rule}</td>
                <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Future rule-engine toggles (placeholders)
        </h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" disabled className="rounded" />
            Auto-validate severity consistency
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" disabled className="rounded" />
            Enforce traceability before close
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" disabled className="rounded" />
            Require verification links for Catastrophic
          </label>
        </div>
      </section>
    </div>
  )
}
