interface TableSkeletonProps {
  rows?: number
  cols: number
}

export default function TableSkeleton({ rows = 6, cols }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-2">
              <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
