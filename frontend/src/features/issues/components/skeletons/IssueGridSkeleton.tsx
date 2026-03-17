/**
 * High-fidelity skeleton for the issue grid/table.
 * Mirrors IssueDashboard table layout: ID, Severity, Title, Status, DAL, Owner.
 */
const ROWS = 10

const barWidths = [
  ['w-14', 'w-16', 'w-48', 'w-20', 'w-8', 'w-24'],
  ['w-14', 'w-20', 'w-64', 'w-24', 'w-8', 'w-28'],
  ['w-14', 'w-16', 'w-40', 'w-20', 'w-8', 'w-20'],
  ['w-14', 'w-24', 'w-56', 'w-28', 'w-8', 'w-24'],
  ['w-14', 'w-16', 'w-72', 'w-20', 'w-8', 'w-32'],
  ['w-14', 'w-20', 'w-44', 'w-24', 'w-8', 'w-24'],
  ['w-14', 'w-16', 'w-52', 'w-20', 'w-8', 'w-20'],
  ['w-14', 'w-24', 'w-60', 'w-28', 'w-8', 'w-28'],
  ['w-14', 'w-16', 'w-36', 'w-20', 'w-8', 'w-24'],
  ['w-14', 'w-20', 'w-48', 'w-24', 'w-8', 'w-20'],
] as const

export default function IssueGridSkeleton() {
  return (
    <table className="w-full">
      <thead className="border-b border-slate-700">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            ID
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            Severity
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            Title
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            Status
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            DAL
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
            Owner
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-700">
        {Array.from({ length: ROWS }).map((_, rowIdx) => (
          <tr key={rowIdx} className="hover:bg-slate-700/50">
            {barWidths[rowIdx].map((w, colIdx) => (
              <td key={colIdx} className="px-4 py-3">
                <div
                  className={`animate-pulse h-4 bg-slate-700 rounded ${w}`}
                  style={{ minWidth: colIdx === 2 ? 120 : undefined }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
