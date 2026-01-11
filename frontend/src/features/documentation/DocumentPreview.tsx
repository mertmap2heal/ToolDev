import { FileText, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface DocumentPreviewProps {
  title: string
  content: string
  onExport?: () => void
}

export default function DocumentPreview({
  title,
  content,
  onExport,
}: DocumentPreviewProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Download size={16} />
            <span>Export</span>
          </button>
        )}
      </div>
      <div className="p-6 prose max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
