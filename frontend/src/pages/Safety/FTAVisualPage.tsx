import FtaCanvas from '../../components/safety/FtaCanvas'

export default function FTAVisualPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Visual Analysis (FTA)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Fault Tree canvas. Add AND/OR gates and basic events, connect edges, use Auto-layout. No probability calculations.
        </p>
      </div>
      <FtaCanvas />
    </div>
  )
}
