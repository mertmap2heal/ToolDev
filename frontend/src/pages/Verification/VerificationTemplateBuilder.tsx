import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { VerificationTemplateSection } from './verificationTemplateUtils'
import { contentJsonToSections, sectionsToContentJson } from './verificationTemplateUtils'
import { PLACEHOLDERS } from '../../components/verification/TemplateEditor'

const SECTION_TYPES: { value: VerificationTemplateSection['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'table', label: 'Table placeholder' },
  { value: 'placeholder', label: 'Placeholder' },
]

const ALL_PLACEHOLDER_ITEMS = PLACEHOLDERS.flatMap((g) => g.items)

interface VerificationTemplateBuilderProps {
  name: string
  type: 'TEST_CASE' | 'TEST_PLAN'
  contentJson: object | null
  onSave: (payload: { name: string; contentJson: object }) => void
  onBack: () => void
  onPublish?: (payload: { name: string; contentJson: object }) => void
  onVersions?: () => void
  isDraft?: boolean
}

export default function VerificationTemplateBuilder({
  name: initialName,
  type: initialType,
  contentJson,
  onSave,
  onBack,
  onPublish,
  onVersions,
  isDraft = true,
}: VerificationTemplateBuilderProps) {
  const [name, setName] = useState(initialName)
  const [type, setType] = useState<'TEST_CASE' | 'TEST_PLAN'>(initialType)
  const [sections, setSections] = useState<VerificationTemplateSection[]>(() =>
    contentJsonToSections(contentJson)
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const addSection = () => {
    const id = `bp-${Date.now()}`
    setSections((prev) => [
      ...prev,
      { id, title: 'New Section', orderIndex: prev.length, type: 'text' },
    ])
    setEditingId(id)
    setEditingTitle('New Section')
  }

  const updateSection = (id: string, updates: Partial<VerificationTemplateSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const deleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const moveSection = (id: string, dir: 'up' | 'down') => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx < 0) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= sections.length) return
    const newSections = [...sections]
    ;[newSections[idx], newSections[swap]] = [newSections[swap], newSections[idx]]
    setSections(newSections.map((s, i) => ({ ...s, orderIndex: i })))
  }

  const handleSave = () => {
    const ordered = sections.map((s, i) => ({ ...s, orderIndex: i }))
    onSave({
      name: name || 'Unnamed template',
      contentJson: sectionsToContentJson(ordered),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          Back to library
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Section blueprint tree */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Section blueprint</h3>
          <ul className="space-y-2">
            {sections.map((sec) => (
              <li
                key={sec.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  {editingId === sec.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        updateSection(sec.id, { title: editingTitle })
                        setEditingId(null)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                      {sec.title}
                    </span>
                  )}
                  <button
                    onClick={() => moveSection(sec.id, 'up')}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveSection(sec.id, 'down')}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(sec.id)
                      setEditingTitle(sec.title)
                    }}
                    className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteSection(sec.id)}
                    className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <select
                  value={sec.type}
                  onChange={(e) =>
                    updateSection(sec.id, {
                      type: e.target.value as VerificationTemplateSection['type'],
                      placeholderValue: undefined,
                    })
                  }
                  className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {SECTION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {sec.type === 'placeholder' && (
                  <select
                    value={sec.placeholderValue ?? ''}
                    onChange={(e) => updateSection(sec.id, { placeholderValue: e.target.value || undefined })}
                    className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mt-1"
                  >
                    <option value="">Select placeholder</option>
                    {ALL_PLACEHOLDER_ITEMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={addSection}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            <Plus size={16} />
            Add section
          </button>
        </div>

        {/* Center: Preview */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            {sections.length === 0 ? (
              <p>Add sections to see preview.</p>
            ) : (
              sections.map((sec, i) => (
                <div key={sec.id} className="flex gap-2 flex-wrap">
                  <span className="font-mono text-gray-500 dark:text-gray-400">{i + 1}.</span>
                  <span className="text-gray-900 dark:text-white">{sec.title}</span>
                  <span className="text-gray-400 dark:text-gray-500">({sec.type})</span>
                  {sec.type === 'placeholder' && sec.placeholderValue && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {sec.placeholderValue}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Template settings */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Template settings</h3>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Template name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'TEST_CASE' | 'TEST_PLAN')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="TEST_CASE">Test Case</option>
              <option value="TEST_PLAN">Test Plan</option>
            </select>
          </div>
          <button
            onClick={handleSave}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Save
          </button>
          {onPublish && isDraft && (
            <button
              onClick={() => {
                const payload = {
                  name: name || 'Unnamed template',
                  contentJson: sectionsToContentJson(sections.map((s, i) => ({ ...s, orderIndex: i }))),
                }
                onSave(payload)
                onPublish(payload)
              }}
              className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Publish
            </button>
          )}
          {onVersions && (
            <button
              onClick={onVersions}
              className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Versions
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
