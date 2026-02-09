import { useState } from 'react'
import { Upload, X, Download, File } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { TaskAttachment } from '../../../shared/types/task.types'
import { format } from 'date-fns'

interface AttachmentsTabProps {
  taskId: string
}

export default function AttachmentsTab({ taskId }: AttachmentsTabProps) {
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const { data: attachmentsData, isLoading } = useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      const response = await taskService.getAttachments(taskId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => taskService.deleteAttachment(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const attachments = attachmentsData || []

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await taskService.uploadAttachment(taskId, file)
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading attachments...</div>
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <label className="flex flex-col items-center justify-center cursor-pointer">
          <Upload className="text-gray-400 mb-2" size={32} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Files will be stored locally
          </span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Attachments List */}
      <div className="space-y-2">
        {attachments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No attachments yet.
          </div>
        ) : (
          attachments.map((attachment: TaskAttachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3 flex-1">
                <File className="text-gray-400" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {attachment.fileName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(attachment.sizeBytes)} •{' '}
                    {format(new Date(attachment.createdAt), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={attachment.fileUrl.startsWith('data:') ? attachment.fileUrl : (import.meta.env.DEV ? attachment.fileUrl : `http://localhost:5000${attachment.fileUrl}`)}
                  download={attachment.fileName}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Download"
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this attachment?')) {
                      deleteAttachmentMutation.mutate(attachment.id)
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
