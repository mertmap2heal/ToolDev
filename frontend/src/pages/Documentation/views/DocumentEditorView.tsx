import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Search,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  FileCode,
  Save,
  Download,
  Package,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import RichTextEditor from '../../../components/common/RichTextEditor'
import type {
  Document,
  DocumentSection,
  DocumentStatus,
  ArtifactReferenceBlock,
  LinkedArtifacts,
} from '../types'
import { DOC_STATUSES } from '../mockData'

const ROUTES: Record<string, string> = {
  requirements: 'requirements',
  interfaces: 'interface-management',
  verification: 'verification',
  risks: 'risk-management',
  issues: 'issues',
  changeRequests: 'change-requests',
  configBaselines: 'configuration-management',
}

const STATUS_COLORS: Record<DocumentStatus, string> = {
  Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  'In Review': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  Approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  Released: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
}

interface DocumentEditorViewProps {
  document: Document
  onUpdateDocument: (doc: Document) => void
  onExport: () => void
  onAddToPack: () => void
  onOpenArtifactPicker: () => void
  onInsertGeneratedSection: () => void
  onPlannedFeature: () => void
  onImagePlaceholder: () => void
}

export default function DocumentEditorView({
  document: doc,
  onUpdateDocument,
  onExport,
  onAddToPack,
  onOpenArtifactPicker,
  onInsertGeneratedSection,
  onPlannedFeature,
  onImagePlaceholder,
}: DocumentEditorViewProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [sections, setSections] = useState<DocumentSection[]>(doc.sections)
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(doc.sections[0]?.id ?? null)
  const [sectionContent, setSectionContent] = useState(() => {
    const sec = doc.sections.find((s) => s.id === (doc.sections[0]?.id ?? null))
    return sec && sec.type !== 'artifact_block' ? sec.content : ''
  })

  useEffect(() => {
    setSections(doc.sections)
    if (doc.sections.length > 0 && !doc.sections.some((s) => s.id === currentSectionId)) {
      setCurrentSectionId(doc.sections[0].id)
      const sec = doc.sections[0]
      setSectionContent(sec.type !== 'artifact_block' ? sec.content : '')
    }
  }, [doc.id, doc.sections])
  const [status, setStatus] = useState<DocumentStatus>(doc.status)
  const [outlineSearch, setOutlineSearch] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const currentSection = sections.find((s) => s.id === currentSectionId)
  const isArtifactBlock = currentSection?.type === 'artifact_block'
  const artifactBlockData = isArtifactBlock && currentSection?.content
    ? (() => {
        try {
          return JSON.parse(currentSection.content) as ArtifactReferenceBlock
        } catch {
          return null
        }
      })()
    : null

  const updateSectionContent = useCallback(
    (sectionId: string, content: string) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, content } : s))
      )
    },
    []
  )

  const handleSelectSection = (sec: DocumentSection) => {
    if (currentSectionId && currentSectionId !== sec.id) {
      const prev = sections.find((s) => s.id === currentSectionId)
      if (prev && prev.type !== 'artifact_block') {
        updateSectionContent(currentSectionId, sectionContent)
      }
    }
    setCurrentSectionId(sec.id)
    if (sec.type === 'artifact_block') {
      setSectionContent('')
    } else {
      setSectionContent(sec.content)
    }
  }

  const handleContentChange = (content: string) => {
    setSectionContent(content)
    if (currentSectionId) updateSectionContent(currentSectionId, content)
  }

  const handleSave = () => {
    const updated: Document = {
      ...doc,
      sections: sections.map((s) =>
        s.id === currentSectionId && s.type !== 'artifact_block'
          ? { ...s, content: sectionContent }
          : s
      ),
      status,
      lastUpdated: new Date().toISOString().slice(0, 10),
    }
    onUpdateDocument(updated)
  }

  const handleStatusChange = (newStatus: DocumentStatus) => setStatus(newStatus)

  const addSection = () => {
    const id = `sec-${Date.now()}`
    const newSec: DocumentSection = {
      id,
      title: 'New Section',
      content: '',
      orderIndex: sections.length,
      type: 'text',
      status: 'Draft',
    }
    setSections((prev) => [...prev, newSec].sort((a, b) => a.orderIndex - b.orderIndex))
    setCurrentSectionId(id)
    setSectionContent('')
    setEditingSectionId(id)
    setEditingTitle('New Section')
  }

  const renameSection = (sectionId: string, title: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)))
    setEditingSectionId(null)
  }

  const deleteSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
    if (currentSectionId === sectionId) {
      const next = sections.find((s) => s.id !== sectionId)
      setCurrentSectionId(next?.id ?? null)
      setSectionContent(next && next.type !== 'artifact_block' ? next.content : '')
    }
  }

  const moveSection = (sectionId: string, dir: 'up' | 'down') => {
    const idx = sections.findIndex((s) => s.id === sectionId)
    if (idx < 0) return
    const newOrder = [...sections]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= newOrder.length) return
    ;[newOrder[idx].orderIndex, newOrder[swap].orderIndex] = [
      newOrder[swap].orderIndex,
      newOrder[idx].orderIndex,
    ]
    newOrder.sort((a, b) => a.orderIndex - b.orderIndex)
    setSections(newOrder)
  }

  const openLinkedArtifact = (key: keyof LinkedArtifacts) => {
    const route = ROUTES[key === 'changeRequests' ? 'changeRequests' : key]
    if (route && projectId) {
      navigate(`/projects/${projectId}/${route}?from=documentation`)
    } else {
      onPlannedFeature()
    }
  }

  const filteredSections = outlineSearch.trim()
    ? sections.filter((s) => s.title.toLowerCase().includes(outlineSearch.toLowerCase()))
    : sections

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)] min-h-[400px]">
      {/* Left: Outline */}
      <div className="lg:col-span-3 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={outlineSearch}
              onChange={(e) => setOutlineSearch(e.target.value)}
              placeholder="Search sections"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredSections.map((sec) => (
            <div
              key={sec.id}
              className={clsx(
                'rounded-lg border mb-1',
                currentSectionId === sec.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
              )}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSelectSection(sec)}
                  className="flex-1 text-left px-2 py-1.5 text-sm font-medium text-gray-900 dark:text-white truncate"
                >
                  {editingSectionId === sec.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => renameSection(sec.id, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameSection(sec.id, editingTitle)
                      }}
                      className="w-full bg-transparent border-b border-gray-400 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    sec.title
                  )}
                </button>
                {editingSectionId !== sec.id && (
                  <>
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
                        setEditingSectionId(sec.id)
                        setEditingTitle(sec.title)
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteSection(sec.id)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="px-2 pb-1">
                <span
                  className={clsx(
                    'text-xs px-1.5 py-0.5 rounded',
                    sec.status === 'Complete'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {sec.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={addSection}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            <Plus size={16} />
            Add section
          </button>
        </div>
      </div>

      {/* Center: Editor */}
      <div className="lg:col-span-6 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Heading 3"
          >
            <Heading3 size={16} />
          </button>
          <span className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Bullet list"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Numbered list"
          >
            <ListOrdered size={16} />
          </button>
          <button
            onClick={() => {}}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Table"
          >
            <TableIcon size={16} />
          </button>
          <button
            onClick={onImagePlaceholder}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Image (placeholder)"
          >
            <ImageIcon size={16} />
          </button>
          <span className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={onOpenArtifactPicker}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Insert Artifact Reference"
          >
            <Link2 size={14} />
            Insert Artifact Reference
          </button>
          <button
            onClick={onInsertGeneratedSection}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Insert Generated Section"
          >
            <FileCode size={14} />
            Insert Generated Section
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!currentSectionId ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Select a section from the outline.</p>
          ) : isArtifactBlock && artifactBlockData ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Artifact Reference</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                Type: {artifactBlockData.artifactType} · ID: {artifactBlockData.artifactId}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Source: {artifactBlockData.sourceModule}</p>
              <button
                onClick={() => {
                  const route = ROUTES[artifactBlockData.artifactType] || artifactBlockData.artifactType
                  if (projectId && route) navigate(`/projects/${projectId}/${route}?from=documentation`)
                  else onPlannedFeature()
                }}
                className="mt-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Open source
              </button>
            </div>
          ) : currentSection?.type === 'generated_block' ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400">
              Generated content will be pulled from [Requirements/Interfaces/Verification] in future release.
            </div>
          ) : (
            <div className="doc-editor-content [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-white">
              <RichTextEditor
                content={sectionContent}
                onChange={handleContentChange}
                placeholder="Section content…"
                minHeight="200px"
                className="min-h-[200px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Metadata & Actions */}
      <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metadata</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <span className={clsx('inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[status])}>
            {status}
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Version</p>
          <p className="text-sm text-gray-900 dark:text-white">{doc.version}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Owner</p>
          <p className="text-sm text-gray-900 dark:text-white">{doc.owner}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Last updated</p>
          <p className="text-sm text-gray-900 dark:text-white">{doc.lastUpdated}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Save size={16} />
            Save
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Change Status</label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as DocumentStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {DOC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onExport}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={onAddToPack}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Package size={16} />
            Add to Evidence Pack
          </button>
        </div>
        {doc.linkedArtifacts && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Linked artifacts</h3>
            <ul className="space-y-2">
              {(['requirements', 'interfaces', 'verification', 'risks', 'issues', 'changeRequests'] as const).map(
                (key) => {
                  const count = doc.linkedArtifacts?.[key] ?? 0
                  const label =
                    key === 'changeRequests' ? 'Change Requests' : key.charAt(0).toUpperCase() + key.slice(1)
                  return (
                    <li key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {label}: {count}
                      </span>
                      <button
                        onClick={() => openLinkedArtifact(key)}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Open
                      </button>
                    </li>
                  )
                }
              )}
            </ul>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Versioning</h3>
          <button
            onClick={onPlannedFeature}
            className="w-full text-left py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Create new version (placeholder)
          </button>
          <button
            onClick={onPlannedFeature}
            className="w-full text-left py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Release document (placeholder)
          </button>
          <button
            onClick={onPlannedFeature}
            className="w-full text-left py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            View version history (placeholder)
          </button>
        </div>
      </div>
    </div>
  )
}
