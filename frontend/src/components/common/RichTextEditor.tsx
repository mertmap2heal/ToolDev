import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
// Table extension uses named export
import { Table } from '@tiptap/extension-table'
// Table sub-extensions can use default imports
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
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
} from 'lucide-react'
import clsx from 'clsx'
import { useCallback, useEffect, useRef } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  editable?: boolean
  onImageUpload?: (file: File) => Promise<string> // Returns image URL
}

/**
 * RichTextEditor component provides a full-featured rich text editing experience
 * using TipTap. Supports formatting, lists, tables, links, and more.
 */
export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Enter description...',
  className,
  minHeight = '150px',
  editable = true,
  onImageUpload,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Disable link from StarterKit since we're adding it explicitly with custom config
        link: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 dark:border-gray-600',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 px-2 py-1',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
        },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

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

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor || !onImageUpload) return

    try {
      // Show loading state or placeholder
      const placeholderUrl = URL.createObjectURL(file)
      editor.chain().focus().setImage({ src: placeholderUrl }).run()

      // Upload image and get URL
      const imageUrl = await onImageUpload(file)

      // Replace placeholder with actual URL
      const currentContent = editor.getHTML()
      const updatedContent = currentContent.replace(placeholderUrl, imageUrl)
      editor.commands.setContent(updatedContent)
    } catch (error) {
      console.error('Image upload failed:', error)
      // Remove placeholder image on error
      editor.chain().focus().deleteSelection().run()
    }
  }, [editor, onImageUpload])

  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleImageUpload])

  if (!editor) {
    return null
  }

  return (
    <div className={clsx('rich-text-editor', className)}>
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap gap-1 p-2 border border-b-0 border-gray-300 dark:border-gray-600 rounded-t-lg bg-gray-50 dark:bg-gray-800">
          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
            >
              <Undo size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
            >
              <Redo size={16} />
            </ToolbarButton>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
            >
              <Heading1 size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
            >
              <Heading2 size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="Heading 3"
            >
              <Heading3 size={16} />
            </ToolbarButton>
          </div>

          {/* Text Formatting */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="Bold"
            >
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="Italic"
            >
              <Italic size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              title="Underline"
            >
              <UnderlineIcon size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="Strikethrough"
            >
              <Strikethrough size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              title="Inline Code"
            >
              <Code size={16} />
            </ToolbarButton>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="Bullet List"
            >
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="Numbered List"
            >
              <ListOrdered size={16} />
            </ToolbarButton>
          </div>

          {/* Blocks */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="Quote"
            >
              <Quote size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Line"
            >
              <Minus size={16} />
            </ToolbarButton>
          </div>

          {/* Link, Table & Image */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={setLink}
              isActive={editor.isActive('link')}
              title="Add Link"
            >
              <LinkIcon size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={addTable}
              title="Insert Table"
            >
              <TableIcon size={16} />
            </ToolbarButton>
            {onImageUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <ToolbarButton
                  onClick={triggerImageUpload}
                  title="Insert Image"
                >
                  <ImageIcon size={16} />
                </ToolbarButton>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bubble Menu removed temporarily - BubbleMenu not available in TipTap v3 export */}

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={clsx(
          'prose prose-sm dark:prose-invert max-w-none',
          'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          editable ? 'rounded-b-lg' : 'rounded-lg',
          'p-3 overflow-y-auto'
        )}
        style={{ minHeight }}
      />

      <style>{`
        .ProseMirror {
          outline: none;
          min-height: ${minHeight};
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .dark .ProseMirror p.is-editor-empty:first-child::before {
          color: #6b7280;
        }
        .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .ProseMirror h2 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .ProseMirror h3 {
          font-size: 1.1em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
        }
        .dark .ProseMirror blockquote {
          border-left-color: #4b5563;
          color: #9ca3af;
        }
        .ProseMirror code {
          background-color: #f3f4f6;
          padding: 0.125em 0.25em;
          border-radius: 0.25em;
          font-family: monospace;
          font-size: 0.9em;
        }
        .dark .ProseMirror code {
          background-color: #374151;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1em 0;
        }
        .dark .ProseMirror hr {
          border-top-color: #4b5563;
        }
        .ProseMirror table {
          border-collapse: collapse;
          margin: 1em 0;
          overflow: hidden;
          table-layout: fixed;
          width: 100%;
        }
        .ProseMirror td,
        .ProseMirror th {
          border: 1px solid #d1d5db;
          min-width: 1em;
          padding: 0.5em;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .dark .ProseMirror td,
        .dark .ProseMirror th {
          border-color: #4b5563;
        }
        .ProseMirror th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        .dark .ProseMirror th {
          background-color: #374151;
        }
        .ProseMirror .selectedCell {
          background-color: #dbeafe;
        }
        .dark .ProseMirror .selectedCell {
          background-color: #1e3a5f;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.25rem;
          margin: 0.5em 0;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
        }
      `}</style>
    </div>
  )
}

/**
 * Toolbar button component for the rich text editor
 */
interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  size?: 'small' | 'normal'
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
  size = 'normal',
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'rounded transition-colors',
        size === 'small' ? 'p-1' : 'p-1.5',
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
