import { useState, useRef, useCallback } from 'react'
import { X, GripVertical, Trash2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import RichTextEditor from '../common/RichTextEditor'
import { verificationService } from '../../services/verification.service'
import { apiClient } from '../../services/api'

interface CustomSectionEditorProps {
  section: {
    id?: string
    title: string
    content: string
    orderIndex?: number
  }
  projectId: string
  testCaseId?: string
  sectionId?: string
  onUpdate: (section: { title: string; content: string }) => void
  onDelete?: () => void
  onImageUpload?: (file: File) => Promise<string>
  isReadOnly?: boolean
}

export default function CustomSectionEditor({
  section,
  projectId,
  testCaseId,
  sectionId,
  onUpdate,
  onDelete,
  onImageUpload,
  isReadOnly = false,
}: CustomSectionEditorProps) {
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)

  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      if (!onImageUpload) {
        // Fallback: convert to base64 data URL
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      // If sectionId exists, upload to server
      if (sectionId && testCaseId) {
        try {
          const reader = new FileReader()
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          const response = await verificationService.uploadCustomSectionImage(projectId, sectionId, {
            fileName: file.name,
            fileData: base64Data,
            mimeType: file.type,
          })

          if (response.success && response.data) {
            // Return the server URL - fileUrl is already a path like /uploads/...
            // For images in HTML, we can use the path directly if the server serves it,
            // or construct full URL. Since /uploads is served statically, use relative path
            // or construct absolute URL based on API base
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
            const serverBase = apiBase.replace('/api/v1', '')
            return `${serverBase}${response.data.fileUrl}`
          }
        } catch (error) {
          console.error('Failed to upload image:', error)
        }
      }

      // Fallback to provided handler or base64
      return onImageUpload ? onImageUpload(file) : new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    [onImageUpload, sectionId, testCaseId, projectId]
  )

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    onUpdate({ title: newTitle, content })
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    onUpdate({ title, content: newContent })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {!isReadOnly && (
            <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <GripVertical size={18} />
            </div>
          )}
          {isReadOnly ? (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title || 'Untitled Section'}</h3>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Section Title"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            />
          )}
        </div>
        {!isReadOnly && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete Section"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mt-3">
        {isReadOnly ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <RichTextEditor
              content={content}
              onChange={() => {}}
              editable={false}
              minHeight="100px"
            />
          </div>
        ) : (
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Enter section content... You can add tables, images, and formatted text."
            minHeight="200px"
            onImageUpload={handleImageUpload}
          />
        )}
      </div>
    </div>
  )
}
