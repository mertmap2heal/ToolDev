import { useState } from 'react'
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react'
import { MOCK_REVIEW_INBOX } from '../../data/mockSafety'
import clsx from 'clsx'

export default function ReviewsPage() {
  const [commentModal, setCommentModal] = useState<string | null>(null)

  const handleApprove = () => alert('Approve will be implemented later. UI only.')
  const handleReject = () => alert('Reject will be implemented later. UI only.')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Reviews & Approvals</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Inbox (mock). Approve / Reject / Comment are UI stubs.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Item</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Severity</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_REVIEW_INBOX.map((r) => (
              <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{r.itemName}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.type}</td>
                <td className="py-3 px-4">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      r.severity === 'Catastrophic' && 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
                      r.severity === 'Major' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                    )}
                  >
                    {r.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.status}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleApprove}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title="Approve"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={handleReject}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Reject"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => setCommentModal(r.id)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Comment"
                    >
                      <MessageSquare size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {commentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Comment (placeholder)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub.</p>
            <button onClick={() => setCommentModal(null)} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
