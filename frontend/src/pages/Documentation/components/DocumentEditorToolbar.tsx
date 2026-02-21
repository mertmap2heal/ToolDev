import { useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Table as TableIcon,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Image as ImageIcon,
  FileCode,
  Link2,
} from 'lucide-react'
import clsx from 'clsx'

type TabId = 'home' | 'insert' | 'references'

interface DocumentEditorToolbarProps {
  editor: Editor | null
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onOpenArtifactPicker: () => void
  onInsertGeneratedSection: () => void
  onImagePlaceholder?: () => void
}

function ToolbarBtn({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'rounded p-1.5 transition-colors',
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
}

export default function DocumentEditorToolbar({
  editor,
  activeTab,
  onTabChange,
  onOpenArtifactPicker,
  onInsertGeneratedSection,
  onImagePlaceholder,
}: DocumentEditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const disabled = !editor

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const handleImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        editor.chain().focus().setImage({ src: dataUrl }).run()
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [editor]
  )

  const triggerImage = useCallback(() => {
    if (onImagePlaceholder) {
      onImagePlaceholder()
    } else {
      fileInputRef.current?.click()
    }
  }, [onImagePlaceholder])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'references', label: 'References' },
  ]

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* Tab headers */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-t transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-white dark:bg-gray-800">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFile}
          className="hidden"
        />

        {activeTab === 'home' && (
          <>
            <div className="flex items-center gap-0.5 pr-1">
              <ToolbarBtn
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={disabled || !editor?.can().undo()}
                title="Undo"
              >
                <Undo size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={disabled || !editor?.can().redo()}
                title="Redo"
              >
                <Redo size={16} />
              </ToolbarBtn>
            </div>
            <ToolbarDivider />
            <div className="flex items-center gap-0.5 pr-1">
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor?.isActive('heading', { level: 1 })}
                disabled={disabled}
                title="Heading 1"
              >
                <Heading1 size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor?.isActive('heading', { level: 2 })}
                disabled={disabled}
                title="Heading 2"
              >
                <Heading2 size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor?.isActive('heading', { level: 3 })}
                disabled={disabled}
                title="Heading 3"
              >
                <Heading3 size={16} />
              </ToolbarBtn>
            </div>
            <ToolbarDivider />
            <div className="flex items-center gap-0.5 pr-1">
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleBold().run()}
                isActive={editor?.isActive('bold')}
                disabled={disabled}
                title="Bold"
              >
                <Bold size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                isActive={editor?.isActive('italic')}
                disabled={disabled}
                title="Italic"
              >
                <Italic size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                isActive={editor?.isActive('underline')}
                disabled={disabled}
                title="Underline"
              >
                <UnderlineIcon size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                isActive={editor?.isActive('strike')}
                disabled={disabled}
                title="Strikethrough"
              >
                <Strikethrough size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleCode().run()}
                isActive={editor?.isActive('code')}
                disabled={disabled}
                title="Inline Code"
              >
                <Code size={16} />
              </ToolbarBtn>
            </div>
            <ToolbarDivider />
            <div className="flex items-center gap-0.5 pr-1">
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                isActive={editor?.isActive('bulletList')}
                disabled={disabled}
                title="Bullet List"
              >
                <List size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                isActive={editor?.isActive('orderedList')}
                disabled={disabled}
                title="Numbered List"
              >
                <ListOrdered size={16} />
              </ToolbarBtn>
            </div>
            <ToolbarDivider />
            <div className="flex items-center gap-0.5">
              <ToolbarBtn
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                isActive={editor?.isActive('blockquote')}
                disabled={disabled}
                title="Quote"
              >
                <Quote size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                disabled={disabled}
                title="Horizontal Line"
              >
                <Minus size={16} />
              </ToolbarBtn>
            </div>
          </>
        )}

        {activeTab === 'insert' && (
          <>
            <div className="flex items-center gap-0.5 pr-1">
              <ToolbarBtn onClick={setLink} isActive={editor?.isActive('link')} disabled={disabled} title="Add Link">
                <LinkIcon size={16} />
              </ToolbarBtn>
              <ToolbarBtn onClick={addTable} disabled={disabled} title="Insert Table">
                <TableIcon size={16} />
              </ToolbarBtn>
              <ToolbarBtn onClick={triggerImage} disabled={disabled} title="Insert Image">
                <ImageIcon size={16} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                disabled={disabled}
                title="Horizontal Line"
              >
                <Minus size={16} />
              </ToolbarBtn>
            </div>
            <ToolbarDivider />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenArtifactPicker}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Insert Artifact Reference"
              >
                <Link2 size={14} />
                Insert Artifact Reference
              </button>
              <button
                type="button"
                onClick={onInsertGeneratedSection}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Insert Generated Section"
              >
                <FileCode size={14} />
                Insert Generated Section
              </button>
            </div>
          </>
        )}

        {activeTab === 'references' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenArtifactPicker}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Insert Artifact Reference"
            >
              <Link2 size={16} />
              Insert Artifact Reference
            </button>
            <button
              type="button"
              onClick={onInsertGeneratedSection}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Insert Generated Section"
            >
              <FileCode size={16} />
              Insert Generated Section
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
