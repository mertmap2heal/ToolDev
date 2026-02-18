import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  FileText,
  FileCode,
  Package,
  Upload,
  History,
  Settings,
  Plus,
  Upload as ImportIcon,
} from 'lucide-react'
import clsx from 'clsx'

import type {
  Document,
  Template,
  EvidencePack,
  ExportProfile,
  ExportHistoryItem,
  ArtifactReferenceBlock,
} from './types'
import {
  MOCK_DOCUMENTS,
  MOCK_TEMPLATES,
  MOCK_EVIDENCE_PACKS,
  MOCK_EXPORT_PROFILES,
  MOCK_EXPORT_HISTORY,
} from './mockData'
import PlannedFeatureModal from './PlannedFeatureModal'
import CreateDocumentModal from './modals/CreateDocumentModal'
import ExportModal from './modals/ExportModal'
import ArtifactPickerModal from './modals/ArtifactPickerModal'
import AddToPackModal from './modals/AddToPackModal'
import ExportHistoryDetailModal from './modals/ExportHistoryDetailModal'
import CreateExportProfileModal from './modals/CreateExportProfileModal'
import DocumentsLibraryView from './views/DocumentsLibraryView'
import DocumentEditorView from './views/DocumentEditorView'
import TemplatesLibraryView from './views/TemplatesLibraryView'
import TemplateBuilderView from './views/TemplateBuilderView'
import EvidencePacksView from './views/EvidencePacksView'
import EvidencePackBuilderView from './views/EvidencePackBuilderView'
import ImportExportCenterView from './views/ImportExportCenterView'
import ExportHistoryView from './views/ExportHistoryView'
import SettingsPlaceholderView from './views/SettingsPlaceholderView'

const TABS = [
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'templates', label: 'Templates', icon: FileCode },
  { id: 'evidencePacks', label: 'Evidence Packs', icon: Package },
  { id: 'importExport', label: 'Import / Export', icon: Upload },
  { id: 'exportHistory', label: 'Export History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

function getNextDocId(docs: Document[]): string {
  const nums = docs
    .map((d) => {
      const m = d.id.match(/DOC-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `DOC-${String(max + 1).padStart(3, '0')}`
}

function getNextTemplateId(templates: Template[]): string {
  const nums = templates
    .map((t) => {
      const m = t.id.match(/TPL-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `TPL-${String(max + 1).padStart(3, '0')}`
}

function getNextPackId(packs: EvidencePack[]): string {
  const nums = packs
    .map((p) => {
      const m = p.id.match(/PACK-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `PACK-${String(max + 1).padStart(3, '0')}`
}

function getNextProfileId(profiles: ExportProfile[]): string {
  const nums = profiles
    .map((p) => {
      const m = p.id.match(/EXP-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `EXP-${String(max + 1).padStart(3, '0')}`
}

export default function DocumentationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('documents')
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS)
  const [templates, setTemplates] = useState<Template[]>(MOCK_TEMPLATES)
  const [evidencePacks, setEvidencePacks] = useState<EvidencePack[]>(MOCK_EVIDENCE_PACKS)
  const [exportProfiles, setExportProfiles] = useState<ExportProfile[]>(MOCK_EXPORT_PROFILES)
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(MOCK_EXPORT_HISTORY)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const [openPackId, setOpenPackId] = useState<string | null>(null)
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
  const [isCreateDocumentOpen, setIsCreateDocumentOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isArtifactPickerOpen, setIsArtifactPickerOpen] = useState(false)
  const [isAddToPackOpen, setIsAddToPackOpen] = useState(false)
  const [addToPackDocIds, setAddToPackDocIds] = useState<string[]>([])
  const [isExportHistoryDetailOpen, setIsExportHistoryDetailOpen] = useState(false)
  const [exportHistoryDetailEntry, setExportHistoryDetailEntry] = useState<ExportHistoryItem | null>(null)
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ExportProfile | null>(null)
  const [isPlannedFeatureOpen, setIsPlannedFeatureOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const openDocument = documents.find((d) => d.id === openDocumentId) ?? null
  const openPack = evidencePacks.find((p) => p.id === openPackId) ?? null
  const openTemplate = templates.find((t) => t.id === openTemplateId) ?? null

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handleCreateDocument = (doc: Omit<Document, 'id'> & { id: string }) => {
    setDocuments((prev) => [doc as Document, ...prev])
    setIsCreateDocumentOpen(false)
  }

  const handleDuplicateDocument = (doc: Document) => {
    const nextId = getNextDocId(documents)
    const copy: Document = {
      ...doc,
      id: nextId,
      title: `${doc.title} (copy)`,
      version: 'v0.1',
      status: 'Draft',
      lastUpdated: new Date().toISOString().slice(0, 10),
      sections: doc.sections.map((s) => ({ ...s, id: `${s.id}-${Date.now()}` })),
    }
    setDocuments((prev) => [copy, ...prev])
  }

  const handleUpdateDocument = (doc: Document) => {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)))
  }

  const handleInsertArtifactBlock = (block: ArtifactReferenceBlock) => {
    if (!openDocumentId) return
    const doc = documents.find((d) => d.id === openDocumentId)
    if (!doc) return
    const newSec = {
      id: `sec-${Date.now()}`,
      title: `Ref: ${block.artifactId}`,
      content: JSON.stringify(block),
      orderIndex: doc.sections.length,
      type: 'artifact_block' as const,
      status: 'Complete' as const,
    }
    const updated: Document = {
      ...doc,
      sections: [...doc.sections, newSec],
    }
    setDocuments((prev) => prev.map((d) => (d.id === openDocumentId ? updated : d)))
    setIsArtifactPickerOpen(false)
  }

  const handleInsertGeneratedSection = () => {
    setIsPlannedFeatureOpen(true)
  }

  const handleExportDocument = (doc: Document) => {
    setAddToPackDocIds([doc.id])
    setIsExportOpen(true)
  }

  const handleExportFromEditor = () => {
    if (openDocumentId) setAddToPackDocIds([openDocumentId])
    setIsExportOpen(true)
  }

  const handleExportConfirm = (entry: ExportHistoryItem) => {
    setExportHistory((prev) => [entry, ...prev])
    showToast('Export recorded (local)')
    setIsExportOpen(false)
  }

  const handleAddToPack = (docIds: string[]) => {
    setAddToPackDocIds(docIds)
    setIsAddToPackOpen(true)
  }

  const handleAddToPackConfirm = (packId: string, docIds: string[]) => {
    const docs = documents.filter((d) => docIds.includes(d.id))
    setEvidencePacks((prev) =>
      prev.map((p) => {
        if (p.id !== packId) return p
        const existingIds = new Set(p.items.map((i) => i.documentId))
        const newItems = docIds
          .filter((id) => !existingIds.has(id))
          .map((id) => {
            const d = docs.find((x) => x.id === id)!
            return { documentId: d.id, documentTitle: d.title, version: d.version, status: d.status }
          })
        return { ...p, items: [...p.items, ...newItems], lastUpdated: new Date().toISOString().slice(0, 10) }
      })
    )
    setIsAddToPackOpen(false)
  }

  const handleCreatePackFromAddModal = (title: string): string => {
    const id = getNextPackId(evidencePacks)
    setEvidencePacks((prev) => [
      ...prev,
      {
        id,
        title,
        purpose: 'Internal Review',
        status: 'Draft',
        items: [],
        lastUpdated: new Date().toISOString().slice(0, 10),
      },
    ])
    return id
  }

  const handleUseTemplate = (template: Template) => {
    const nextId = getNextDocId(documents)
    const sections = template.sectionBlueprint.map((bp, i) => ({
      id: `sec-${Date.now()}-${i}`,
      title: bp.title,
      content: '',
      orderIndex: i,
      type: bp.type,
      status: 'Draft' as const,
    }))
    const doc: Document = {
      id: nextId,
      title: `New ${template.docType}`,
      type: template.docType,
      status: 'Draft',
      version: 'v0.1',
      owner: '—',
      lastUpdated: new Date().toISOString().slice(0, 10),
      source: 'Manual',
      tags: [],
      sections,
    }
    setDocuments((prev) => [doc, ...prev])
    setActiveTab('documents')
    setOpenDocumentId(nextId)
  }

  const handleEditTemplate = (templateId: string) => {
    setOpenTemplateId(templateId)
  }

  const handleDuplicateTemplate = (template: Template) => {
    const nextId = getNextTemplateId(templates)
    setTemplates((prev) => [
      ...prev,
      {
        ...template,
        id: nextId,
        name: `${template.name} (copy)`,
        lastUpdated: new Date().toISOString().slice(0, 10),
        sectionBlueprint: template.sectionBlueprint.map((s) => ({ ...s, id: `${s.id}-${Date.now()}` })),
      },
    ])
  }

  const handleSaveTemplate = (t: Template) => {
    const existing = templates.find((x) => x.id === t.id)
    if (existing) {
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? t : x)))
    } else {
      setTemplates((prev) => [...prev, t])
    }
    setOpenTemplateId(null)
  }

  const handleCreatePack = () => {
    const id = getNextPackId(evidencePacks)
    setEvidencePacks((prev) => [
      ...prev,
      {
        id,
        title: 'New Evidence Pack',
        purpose: 'Internal Review',
        status: 'Draft',
        items: [],
        lastUpdated: new Date().toISOString().slice(0, 10),
      },
    ])
    setOpenPackId(id)
    setActiveTab('evidencePacks')
  }

  const handleUpdatePack = (pack: EvidencePack) => {
    setEvidencePacks((prev) => prev.map((p) => (p.id === pack.id ? pack : p)))
  }

  const handleDuplicatePack = (pack: EvidencePack) => {
    const id = getNextPackId(evidencePacks)
    setEvidencePacks((prev) => [
      ...prev,
      {
        ...pack,
        id,
        title: `${pack.title} (copy)`,
        status: 'Draft',
        items: [...pack.items],
        lastUpdated: new Date().toISOString().slice(0, 10),
      },
    ])
  }

  const handleSaveExportProfile = (profile: ExportProfile) => {
    const existing = exportProfiles.find((p) => p.id === profile.id)
    if (existing) {
      setExportProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)))
    } else {
      setExportProfiles((prev) => [...prev, profile])
    }
    setIsCreateProfileOpen(false)
    setEditingProfile(null)
  }

  const handleEditProfile = (profile: ExportProfile) => {
    setEditingProfile(profile)
    setIsCreateProfileOpen(true)
  }

  const exportItemCount = addToPackDocIds.length || (openDocumentId ? 1 : 0)
  const exportItemIds = addToPackDocIds.length ? addToPackDocIds : openDocumentId ? [openDocumentId] : []

  if (openDocumentId && openDocument) {
    return (
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Documentation</h2>
          <button
            onClick={() => setOpenDocumentId(null)}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            Back to library
          </button>
        </div>
        <DocumentEditorView
          document={openDocument}
          onUpdateDocument={handleUpdateDocument}
          onExport={handleExportFromEditor}
          onAddToPack={() => {
            setAddToPackDocIds([openDocumentId])
            setIsAddToPackOpen(true)
          }}
          onOpenArtifactPicker={() => setIsArtifactPickerOpen(true)}
          onInsertGeneratedSection={handleInsertGeneratedSection}
          onPlannedFeature={() => setIsPlannedFeatureOpen(true)}
          onImagePlaceholder={() => setIsPlannedFeatureOpen(true)}
        />
        <ArtifactPickerModal
          isOpen={isArtifactPickerOpen}
          onClose={() => setIsArtifactPickerOpen(false)}
          onSelect={handleInsertArtifactBlock}
        />
        <PlannedFeatureModal isOpen={isPlannedFeatureOpen} onClose={() => setIsPlannedFeatureOpen(false)} />
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          profiles={exportProfiles}
          onExport={handleExportConfirm}
          itemCount={1}
          itemIds={[openDocumentId]}
          onToast={showToast}
        />
        <AddToPackModal
          isOpen={isAddToPackOpen}
          onClose={() => setIsAddToPackOpen(false)}
          packs={evidencePacks}
          documents={documents}
          selectedDocumentIds={addToPackDocIds}
          onAdd={handleAddToPackConfirm}
          onCreatePack={handleCreatePackFromAddModal}
        />
      </div>
    )
  }

  if (openPackId && openPack) {
    return (
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Documentation</h2>
          <button
            onClick={() => setOpenPackId(null)}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            Back to packs
          </button>
        </div>
        <EvidencePackBuilderView
          pack={openPack}
          documents={documents}
          onUpdatePack={handleUpdatePack}
          onBack={() => setOpenPackId(null)}
          onExportPack={() => {
            showToast('Export queued (placeholder)')
          }}
        />
      </div>
    )
  }

  if (openTemplateId !== null) {
    return (
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Documentation</h2>
        </div>
        <TemplateBuilderView
          template={openTemplate}
          onSave={handleSaveTemplate}
          onBack={() => setOpenTemplateId(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-shrink-0 space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Documentation</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create, control, and export project documentation and evidence (UI-only)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search documents, templates, packs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setIsCreateDocumentOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={16} />
            Create Document
          </button>
          <button
            onClick={handleCreatePack}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Package size={16} />
            Create Evidence Pack
          </button>
          <button
            onClick={() => setIsPlannedFeatureOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ImportIcon size={16} />
            Import
          </button>
        </div>
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                    active
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {activeTab === 'documents' && (
          <DocumentsLibraryView
            documents={documents}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCreateDocument={() => setIsCreateDocumentOpen(true)}
            onOpenDocument={setOpenDocumentId}
            onDuplicateDocument={handleDuplicateDocument}
            onExportDocument={handleExportDocument}
            onAddToPack={handleAddToPack}
            onPlannedFeature={() => setIsPlannedFeatureOpen(true)}
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesLibraryView
            templates={templates}
            onUseTemplate={handleUseTemplate}
            onEditTemplate={handleEditTemplate}
            onDuplicateTemplate={handleDuplicateTemplate}
            onExportTemplatePlaceholder={() => setIsPlannedFeatureOpen(true)}
          />
        )}
        {activeTab === 'evidencePacks' && (
          <EvidencePacksView
            packs={evidencePacks}
            onCreatePack={handleCreatePack}
            onOpenPack={setOpenPackId}
            onExportPackPlaceholder={() => setIsPlannedFeatureOpen(true)}
            onDuplicatePack={handleDuplicatePack}
            onIncludeComplianceMatrix={() => setIsPlannedFeatureOpen(true)}
          />
        )}
        {activeTab === 'importExport' && (
          <ImportExportCenterView
            profiles={exportProfiles}
            onImportDocumentPlaceholder={() => setIsPlannedFeatureOpen(true)}
            onImportTemplatePlaceholder={() => setIsPlannedFeatureOpen(true)}
            onImportExternalPlaceholder={() => setIsPlannedFeatureOpen(true)}
            onCreateProfile={() => {
              setEditingProfile(null)
              setIsCreateProfileOpen(true)
            }}
            onEditProfile={handleEditProfile}
          />
        )}
        {activeTab === 'exportHistory' && (
          <ExportHistoryView
            history={exportHistory}
            onViewDetails={(entry) => {
              setExportHistoryDetailEntry(entry)
              setIsExportHistoryDetailOpen(true)
            }}
          />
        )}
        {activeTab === 'settings' && <SettingsPlaceholderView />}
      </div>

      <CreateDocumentModal
        isOpen={isCreateDocumentOpen}
        onClose={() => setIsCreateDocumentOpen(false)}
        onCreate={handleCreateDocument}
        nextId={getNextDocId(documents)}
        templates={templates}
      />
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        profiles={exportProfiles}
        onExport={handleExportConfirm}
        itemCount={exportItemCount}
        itemIds={exportItemIds}
        onToast={showToast}
      />
      <AddToPackModal
        isOpen={isAddToPackOpen}
        onClose={() => setIsAddToPackOpen(false)}
        packs={evidencePacks}
        documents={documents}
        selectedDocumentIds={addToPackDocIds}
        onAdd={handleAddToPackConfirm}
        onCreatePack={handleCreatePackFromAddModal}
      />
      <ExportHistoryDetailModal
        isOpen={isExportHistoryDetailOpen}
        onClose={() => {
          setIsExportHistoryDetailOpen(false)
          setExportHistoryDetailEntry(null)
        }}
        entry={exportHistoryDetailEntry}
        profiles={exportProfiles}
      />
      <CreateExportProfileModal
        isOpen={isCreateProfileOpen}
        onClose={() => {
          setIsCreateProfileOpen(false)
          setEditingProfile(null)
        }}
        onSave={handleSaveExportProfile}
        nextId={getNextProfileId(exportProfiles)}
        initial={editingProfile}
      />
      <PlannedFeatureModal isOpen={isPlannedFeatureOpen} onClose={() => setIsPlannedFeatureOpen(false)} />

      {toastMessage && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg z-50">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
