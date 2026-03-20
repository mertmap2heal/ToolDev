import { useState, useRef } from 'react'
import { X, Plus, Trash2, Upload, File, Layers, Link as LinkIcon, CheckSquare, Square, Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import CustomSectionEditor from './CustomSectionEditor'
import StructuredStepEditor, { parseStepsToPairs, pairsToStepsAndExpected, type StepPair } from './StructuredStepEditor'
import clsx from 'clsx'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateTestCaseModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

interface Criterion {
  id: string
  text: string
  checked: boolean
}

export default function CreateTestCaseModal({ isOpen, onClose, projectId }: CreateTestCaseModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [activeTab, setActiveTab] = useState<'general' | 'steps' | 'verifies' | 'attachments' | 'custom'>('general')

  const [formData, setFormDataBase] = useState({
    key: '',
    title: '',
    objective: '',
    preconditions: '',
    linkedMocCode: '',
    linkedMethodId: '',
    ownerUserId: '',
  })
  type FormDataType = { key: string; title: string; objective: string; preconditions: string; linkedMocCode: string; linkedMethodId: string; ownerUserId: string }
  const setFormData = (v: FormDataType | ((prev: FormDataType) => FormDataType)) => { setFormDataBase(v as any); markDirty() }

  const [stepPairs, setStepPairs] = useState<StepPair[]>(() => parseStepsToPairs([], []))
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [customSections, setCustomSections] = useState<Array<{ id: string; title: string; content: string; orderIndex: number }>>([])
  const [selectedLinks, setSelectedLinks] = useState<{ type: 'requirement' | 'function'; id: string }[]>([])
  const [linkSearchTerm, setLinkSearchTerm] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  onDiscardRef.current = () => {
    setFormDataBase({ key: '', title: '', objective: '', preconditions: '', linkedMocCode: '', linkedMethodId: '', ownerUserId: '' })
    setStepPairs(parseStepsToPairs([], []))
    setCriteria([])
    setAttachments([])
    setCustomSections([])
    setSelectedLinks([])
    setLinkSearchTerm('')
    setErrors({})
  }

  const queryClient = useQueryClient()

  // Queries
  const { data: mocs = [] } = useQuery({
    queryKey: ['mocs'],
    queryFn: async () => {
      const res = await verificationService.getMocs()
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const { data: methods = [] } = useQuery({
    queryKey: ['methods', projectId],
    queryFn: async () => {
      const res = await verificationService.getMethods(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const res = await requirementService.getAllRequirements(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const res = await functionService.getFunctions(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const verifyTargets = [
    ...requirements.map((r: any) => ({ ...r, type: 'requirement', label: r.title, identifier: r.requirementId })),
    ...functions.map((f: any) => ({ ...f, type: 'function', label: f.name, identifier: f.functionId })),
  ].filter(target => {
    if (!linkSearchTerm) return true
    const term = linkSearchTerm.toLowerCase()
    return (
      (target.label?.toLowerCase() || '').includes(term) ||
      (target.identifier?.toLowerCase() || '').includes(term)
    )
  })

  const createTestCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. Create Test Case
      const response = await verificationService.createTestCase(projectId, data)
      if (!response.success || !response.data) throw new Error(response.error || 'Failed to create test case')

      const testCaseId = (response.data as { id: string }).id

      // 2. Link Verification Elements (Requirements/Functions)
      for (const link of selectedLinks) {
        await verificationService.linkTestCaseVerificationElement(projectId, testCaseId, link.type, link.id)
      }

      // 3. Attachments
      for (const file of attachments) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const evidenceRes = await verificationService.createEvidence(projectId, {
          evidenceType: 'OTHER',
          title: file.name,
          description: `Attachment for test case ${formData.title}`,
          storageRef: base64,
        })

        if (evidenceRes.success && evidenceRes.data) {
          await verificationService.linkEvidence(projectId, (evidenceRes.data as { id: string }).id, {
            linkedEntityType: 'TEST_CASE',
            linkedEntityId: testCaseId,
            relation: 'SUPPORTING',
          })
        }
      }

      // 4. Custom Sections
      for (let i = 0; i < customSections.length; i++) {
        await verificationService.createCustomSection(projectId, testCaseId, {
          title: customSections[i].title,
          content: customSections[i].content,
          orderIndex: i,
        })
      }

      // 5. Step Design Notes (per-step notes during authoring)
      const designNotes = stepPairs.map((p) => p.designNote ?? '')
      if (designNotes.some((n) => n.trim())) {
        await verificationService.createCustomSection(projectId, testCaseId, {
          title: '_StepDesignNotes',
          content: JSON.stringify(designNotes),
          orderIndex: -1,
        })
      }

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      resetDirty()
      onClose()
      resetForm()
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to create test case' })
    },
  })

  const resetForm = () => {
    setFormData({
      key: '',
      title: '',
      objective: '',
      preconditions: '',
      linkedMocCode: '',
      linkedMethodId: '',
      ownerUserId: '',
    })
    setStepPairs(parseStepsToPairs([], []))
    setCriteria([])
    setAttachments([])
    setCustomSections([])
    setSelectedLinks([])
    setErrors({})
    setActiveTab('general')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!formData.title.trim()) {
      setErrors({ title: 'Title is required' })
      return
    }

    const submitData: any = {
      title: formData.title.trim(),
      objective: formData.objective?.trim() || undefined,
      preconditions: formData.preconditions?.trim() || undefined,
      ownerUserId: formData.ownerUserId?.trim() || undefined,
    }

    if (formData.key.trim()) submitData.key = formData.key.trim()

    // Steps and expected results from structured editor
    const { steps: stepsArr, expectedResults } = pairsToStepsAndExpected(stepPairs)
    if (stepsArr.some((s) => s) || expectedResults.some((e) => e)) {
      submitData.steps = stepsArr
      submitData.expectedResults = expectedResults
    }

    // Criteria
    const checkedCriteria = criteria.filter((c) => c.checked && c.text.trim()).map((c) => c.text.trim())
    const allCriteria = criteria.filter((c) => c.text.trim()).map((c) => c.text.trim())
    if (allCriteria.length > 0) {
      submitData.passFailCriteria = checkedCriteria.length > 0 ? checkedCriteria.join(', ') : allCriteria.join(', ')
    }

    if (formData.linkedMocCode) submitData.linkedMocCode = parseInt(formData.linkedMocCode, 10)
    if (formData.linkedMethodId) submitData.linkedMethodId = formData.linkedMethodId

    createTestCaseMutation.mutate(submitData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors)
    }
  }

  const toggleLink = (type: 'requirement' | 'function', id: string) => {
    const exists = selectedLinks.some(l => l.type === type && l.id === id)
    if (exists) {
      setSelectedLinks(selectedLinks.filter(l => !(l.type === type && l.id === id)))
    } else {
      setSelectedLinks([...selectedLinks, { type, id }])
    }
  }

  // Helpers for Criteria
  const addCriterion = () => setCriteria([...criteria, { id: Date.now().toString(), text: '', checked: false }])
  const removeCriterion = (id: string) => setCriteria(criteria.filter((c) => c.id !== id))
  const updateCriterion = (id: string, updates: Partial<Criterion>) => setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)))

  // Helpers for Attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments([...attachments, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Test Case</h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button onClick={guardClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          {[
            { id: 'general', label: 'General', icon: Layers },
            { id: 'steps', label: 'Steps & Criteria', icon: clsx },
            { id: 'verifies', label: 'Verifies', count: selectedLinks.length },
            { id: 'attachments', label: 'Attachments', count: attachments.length },
            { id: 'custom', label: 'Custom Sections', count: customSections.length },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter test case title"
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => handleChange('key', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
                    <input
                      type="text"
                      value={formData.ownerUserId}
                      onChange={(e) => handleChange('ownerUserId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="User ID"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Objective</label>
                  <textarea
                    rows={3}
                    value={formData.objective}
                    onChange={(e) => handleChange('objective', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter objective"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preconditions</label>
                  <textarea
                    rows={2}
                    value={formData.preconditions}
                    onChange={(e) => handleChange('preconditions', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter preconditions"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MoC</label>
                    <select
                      value={formData.linkedMocCode}
                      onChange={(e) => handleChange('linkedMocCode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select MoC</option>
                      {mocs.map((moc: any) => (
                        <option key={moc.code} value={moc.code}>
                          {moc.code}: {moc.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
                    <select
                      value={formData.linkedMethodId}
                      onChange={(e) => handleChange('linkedMethodId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select Method</option>
                      {(Array.isArray(methods) ? methods : []).map((method: any) => (
                        <option key={method.id} value={method.id}>
                          {method.name} ({method.methodType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Steps Tab */}
            {activeTab === 'steps' && (
              <div className="space-y-6">
                <StructuredStepEditor
                  pairs={stepPairs}
                  onChange={setStepPairs}
                  readOnly={false}
                />

                {/* Criteria */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pass/Fail Criteria</label>
                    <button
                      type="button"
                      onClick={addCriterion}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      <Plus size={14} /> Add Criterion
                    </button>
                  </div>
                  <div className="space-y-2">
                    {criteria.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No criteria added.</p>
                    ) : (
                      criteria.map((c) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={c.checked}
                            onChange={(e) => updateCriterion(c.id, { checked: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <input
                            type="text"
                            value={c.text}
                            onChange={(e) => updateCriterion(c.id, { text: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Criterion"
                          />
                          <button
                            type="button"
                            onClick={() => removeCriterion(c.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Verifies Tab */}
            {activeTab === 'verifies' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 mb-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select requirements or functions this test case verifies.
                  </p>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search requirements or functions..."
                      value={linkSearchTerm}
                      onChange={(e) => setLinkSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {verifyTargets.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    No matching requirements or functions found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {verifyTargets.map((target: any) => {
                      const isSelected = selectedLinks.some(l => l.type === target.type && l.id === target.id)
                      return (
                        <div
                          key={`${target.type}-${target.id}`}
                          onClick={() => toggleLink(target.type, target.id)}
                          className={clsx(
                            "cursor-pointer flex items-center p-3 rounded-lg border transition-colors",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className={clsx("mr-3", isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400")}>
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={clsx(
                                "text-xs px-2 py-0.5 rounded font-medium flex-shrink-0",
                                target.type === 'requirement'
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              )}>
                                {target.type === 'requirement' ? 'REQ' : 'FUNC'}
                              </span>
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{target.identifier}</span>
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white truncate" title={target.label}>{target.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attachments</h3>
                  <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload files</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                          <button type="button" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Sections Tab */}
            {activeTab === 'custom' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Fields</h3>
                  <button
                    type="button"
                    onClick={() => setCustomSections([...customSections, { id: Date.now().toString(), title: `Section ${customSections.length + 1}`, content: '', orderIndex: customSections.length }])}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Section
                  </button>
                </div>

                {customSections.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No custom sections added.</p>
                ) : (
                  customSections.map((section, idx) => (
                    <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative">
                      <button
                        type="button"
                        onClick={() => setCustomSections(customSections.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const newSections = [...customSections]
                          newSections[idx].title = e.target.value
                          setCustomSections(newSections)
                        }}
                        className="block w-full text-sm font-medium border-none p-0 mb-2 focus:ring-0 bg-transparent"
                        placeholder="Section Title"
                      />
                      <textarea
                        rows={2}
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...customSections]
                          newSections[idx].content = e.target.value
                          setCustomSections(newSections)
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        placeholder="Content..."
                      />
                    </div>
                  ))
                )}
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={guardClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-case-form"
            disabled={createTestCaseMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createTestCaseMutation.isPending ? 'Creating...' : 'Create Test Case'}
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}
