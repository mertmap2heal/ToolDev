/**
 * High-fidelity skeleton for the issue detail page.
 * Layout: header (ID + title), 70/30 two-column (main + sidebar), traceability area.
 */
export default function IssueDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="animate-pulse h-6 bg-slate-700 rounded w-24" />
        <div className="animate-pulse h-8 bg-slate-700 rounded w-3/4 max-w-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column (main content) */}
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
            <div className="animate-pulse h-4 bg-slate-700 rounded w-20" />
            <div className="space-y-2">
              <div className="animate-pulse h-3 bg-slate-700 rounded w-full" />
              <div className="animate-pulse h-3 bg-slate-700 rounded w-full" />
              <div className="animate-pulse h-3 bg-slate-700 rounded w-4/5" />
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
            <div className="animate-pulse h-4 bg-slate-700 rounded w-32" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse h-3 bg-slate-700 rounded"
                  style={{ width: `${85 - i * 10}%` }}
                />
              ))}
            </div>
          </div>
          {/* Traceability list area */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-3">
            <div className="animate-pulse h-4 bg-slate-700 rounded w-28" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="animate-pulse h-4 w-4 bg-slate-700 rounded shrink-0" />
                <div className="animate-pulse h-4 bg-slate-700 rounded w-24" />
                <div className="animate-pulse h-4 bg-slate-700 rounded flex-1 max-w-xs" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column (sidebar metadata) */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
            <div className="animate-pulse h-4 bg-slate-700 rounded w-20" />
            <div className="space-y-3">
              {['Assignee', 'Verifier', 'Created', 'Updated', 'DAL', 'Severity', 'Status'].map(
                (_, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <div className="animate-pulse h-3 bg-slate-700 rounded w-16 shrink-0" />
                    <div className="animate-pulse h-3 bg-slate-700 rounded w-24" />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
