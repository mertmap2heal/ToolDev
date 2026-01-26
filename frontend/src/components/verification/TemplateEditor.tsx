import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Table as TableIcon,
  Undo,
  Redo,
} from 'lucide-react'
import { useCallback, useEffect } from 'react'
import clsx from 'clsx'

const DEFAULT_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

const PLACEHOLDERS: { group: string; items: { label: string; value: string }[] }[] = [
  {
    group: 'Project',
    items: [
      { label: 'Project name', value: '{{project.name}}' },
      { label: 'Project ID', value: '{{project.id}}' },
    ],
  },
  {
    group: 'Test Plan',
    items: [
      { label: 'Name', value: '{{testPlan.name}}' },
      { label: 'Key', value: '{{testPlan.key}}' },
      { label: 'Description', value: '{{testPlan.description}}' },
      { label: 'Phase', value: '{{testPlan.phase}}' },
      { label: 'Status', value: '{{testPlan.status}}' },
      { label: 'Entry criteria', value: '{{testPlan.entryCriteria}}' },
      { label: 'Exit criteria', value: '{{testPlan.exitCriteria}}' },
    ],
  },
  {
    group: 'Test Case',
    items: [
      { label: 'Title', value: '{{testCase.title}}' },
      { label: 'Key', value: '{{testCase.key}}' },
      { label: 'Objective', value: '{{testCase.objective}}' },
      { label: 'Preconditions', value: '{{testCase.preconditions}}' },
      { label: 'Pass/fail criteria', value: '{{testCase.passFailCriteria}}' },
      { label: 'Status', value: '{{testCase.status}}' },
      { label: 'Version', value: '{{testCase.version}}' },
    ],
  },
  {
    group: 'Requirements & Steps',
    items: [
      { label: 'Requirements list', value: '{{requirements.list}}' },
      { label: 'Steps table', value: '{{steps.table}}' },
    ],
  },
  {
    group: 'Test Setup',
    items: [{ label: 'Setup summary', value: '{{testSetup.summary}}' }],
  },
]

function ToolbarButton({
  onClick,
  disabled,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
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
        'p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40',
        isActive && 'bg-gray-200 dark:bg-gray-600'
      )}
    >
      {children}
    </button>
  )
}

interface TemplateEditorProps {
  contentJson: object | null
  onChange: (json: object) => void
  editable?: boolean
}

export default function TemplateEditor({
  contentJson,
  onChange,
  editable = true,
}: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
      Placeholder.configure({ placeholder: 'Start writing or insert placeholders…' }),
      Underline,
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'border-collapse border border-gray-300 dark:border-gray-600' },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: { class: 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1' },
      }),
      TableCell.configure({
        HTMLAttributes: { class: 'border border-gray-300 dark:border-gray-600 px-2 py-1' },
      }),
    ],
    content: contentJson && (contentJson as any).type === 'doc' ? contentJson : DEFAULT_DOC,
    editable,
    onUpdate: ({ editor }) => {
      const j = editor.getJSON()
      if (j && typeof j === 'object') onChange(j as object)
    },
  })

  const insertPlaceholder = useCallback(
    (value: string) => {
      editor?.chain().focus().insertContent(value).run()
    },
    [editor]
  )

  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    const next = contentJson && (contentJson as any).type === 'doc' ? contentJson : DEFAULT_DOC
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      editor.commands.setContent(next as any)
    }
  }, [contentJson, editor])

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editable, editor])

  const addTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0 flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
        {editable && (
          <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                <Undo size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                <Redo size={16} />
              </ToolbarButton>
            </div>
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
            <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
                <Bold size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
                <Italic size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
                <UnderlineIcon size={16} />
              </ToolbarButton>
            </div>
            <div className="flex items-center gap-0.5 pr-2 border-r border-gray-300 dark:border-gray-600">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet list">
                <List size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list">
                <ListOrdered size={16} />
              </ToolbarButton>
            </div>
            <div className="flex items-center gap-0.5">
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal line">
                <Minus size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={addTable} title="Insert table">
                <TableIcon size={16} />
              </ToolbarButton>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 min-h-[320px] prose prose-sm max-w-none bg-white text-gray-900 [&_.tiptap]:bg-white [&_.tiptap]:text-gray-900">
          <EditorContent editor={editor} />
        </div>
      </div>

      {editable && (
        <div className="w-64 shrink-0 space-y-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Insert placeholders</div>
          {PLACEHOLDERS.map((g) => (
            <div key={g.group}>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{g.group}</div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => insertPlaceholder(p.value)}
                    className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { PLACEHOLDERS }
