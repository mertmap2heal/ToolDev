import { useState, useRef } from 'react'
import { X, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Upload, File } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

interface CreateTestCaseModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

interface Step {
  id: string
  text: string
}

interface Criterion {
  id: string
  text: string
  checked: boolean
}

export default function CreateTestCaseModal({ isOpen, onClose, projectId }: CreateTestCaseModalProps) {
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    objective: '',
    preconditions: '',
    expectedResults: '',
    linkedMocCode: '',
    linkedMethodId: '',
    ownerUserId: '',
  })
  const [steps, setSteps] = useState<Step[]>([{ id: '1', text: '' }])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [selectedSetups, setSelectedSetups] = useState<string[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>([
    'title',
    'key',
    'objective',
    'preconditions',
    'steps',
    'expectedResults',
    'passFailCriteria',
    'moc',
    'method',
    'setups',
    'owner',
    'attachments',
  ])
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()

  // Fetch MoCs
  const { data: mocs = [] } = useQuery({
    queryKey: ['mocs'],
    queryFn: async () => {
      const response = await verificationService.getMocs()
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  // Fetch Methods
  const { data: methods = [] } = useQuery({
    queryKey: ['methods', projectId],
    queryFn: async () => {
      const response = await verificationService.getMethods(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Fetch Setups
  const { data: setups = [] } = useQuery({
    queryKey: ['setups', projectId],
    queryFn: async () => {
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const createTestCaseMutation = useMutation({
    mutationFn: (data: any) => verificationService.createTestCase(projectId, data),
    onSuccess: async (response) => {
      if (response.success && response.data) {
        const testCaseId = response.data.id

        // Link test setups
        if (selectedSetups.length > 0) {
          for (const setupId of selectedSetups) {
            try {
              await verificationService.linkSetup(projectId, testCaseId, setupId)
            } catch (error) {
              console.error('Failed to link setup:', error)
            }
          }
        }

        // Upload attachments and create evidence
        if (attachments.length > 0) {
          for (const file of attachments) {
            try {
              // Convert file to base64
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => {
                  const result = reader.result as string
                  resolve(result)
                }
                reader.onerror = reject
                reader.readAsDataURL(file)
              })

              // Create evidence record
              const evidenceResponse = await verificationService.createEvidence(projectId, {
                evidenceType: 'OTHER',
                title: file.name,
                description: `Attachment for test case ${formData.title}`,
                storageRef: base64,
              })

              if (evidenceResponse.success && evidenceResponse.data) {
                // Link evidence to test case
                await verificationService.linkEvidence(projectId, evidenceResponse.data.id, {
                  linkedEntityType: 'TEST_CASE',
                  linkedEntityId: testCaseId,
                  relation: 'SUPPORTING',
                })
              }
            } catch (error) {
              console.error('Failed to upload attachment:', error)
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
        queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
        onClose()
        resetForm()
      } else {
        setErrors({ submit: response.error || 'Failed to create test case' })
      }
    },
    onError: (error: any) => {
      console.error('Create test case error:', error)
      let errorMessage = 'Failed to create test case.'

      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }

      setErrors({ submit: errorMessage })
    },
  })

  const resetForm = () => {
    setFormData({
      key: '',
      title: '',
      objective: '',
      preconditions: '',
      expectedResults: '',
      linkedMocCode: '',
      linkedMethodId: '',
      ownerUserId: '',
    })
    setSteps([{ id: '1', text: '' }])
    setCriteria([])
    setAttachments([])
    setSelectedSetups([])
    setErrors({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: any = {
      title: formData.title.trim(),
      objective: formData.objective?.trim() || undefined,
      preconditions: formData.preconditions?.trim() || undefined,
      expectedResults: formData.expectedResults?.trim() || undefined,
      ownerUserId: formData.ownerUserId?.trim() || undefined,
    }

    if (formData.key.trim()) {
      submitData.key = formData.key.trim()
    }

    // Convert steps array to array of strings
    const stepTexts = steps.filter((s) => s.text.trim()).map((s) => s.text.trim())
    if (stepTexts.length > 0) {
      submitData.steps = stepTexts
    }

    // Convert criteria to string (comma-separated checked items)
    const checkedCriteria = criteria.filter((c) => c.checked && c.text.trim()).map((c) => c.text.trim())
    const allCriteria = criteria.filter((c) => c.text.trim()).map((c) => c.text.trim())
    if (allCriteria.length > 0) {
      submitData.passFailCriteria = checkedCriteria.length > 0 ? checkedCriteria.join(', ') : allCriteria.join(', ')
    }

    if (formData.linkedMocCode) {
      submitData.linkedMocCode = parseInt(formData.linkedMocCode, 10)
    }

    if (formData.linkedMethodId) {
      submitData.linkedMethodId = formData.linkedMethodId
    }

    createTestCaseMutation.mutate(submitData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const addStep = () => {
    setSteps([...steps, { id: Date.now().toString(), text: '' }])
  }

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter((s) => s.id !== id))
    }
  }

  const updateStep = (id: string, text: string) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const addCriterion = () => {
    setCriteria([...criteria, { id: Date.now().toString(), text: '', checked: false }])
  }

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id))
  }

  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments([...attachments, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setAttachments([...attachments, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sectionOrder]
    if (direction === 'up' && index > 0) {
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setSectionOrder(newOrder)
  }

  const renderSection = (sectionId: string) => {
    const index = sectionOrder.indexOf(sectionId)

    switch (sectionId) {
      case 'title':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter test case title"
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
          </div>
        )

      case 'key':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Key</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => handleChange('key', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Auto-generated if left empty"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave empty to auto-generate a unique key</p>
          </div>
        )

      case 'objective':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Objective</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={formData.objective}
              onChange={(e) => handleChange('objective', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter test case objective"
            />
          </div>
        )

      case 'preconditions':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preconditions</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={formData.preconditions}
              onChange={(e) => handleChange('preconditions', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter preconditions"
            />
          </div>
        )

      case 'steps':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Steps</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  <Plus size={14} />
                  Add Step
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === sectionOrder.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-2">
                  <span className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium min-w-[24px]">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={step.text}
                    onChange={(e) => updateStep(step.id, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={`Step ${idx + 1}`}
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      className="mt-2 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case 'expectedResults':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expected Results</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={formData.expectedResults}
              onChange={(e) => handleChange('expectedResults', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter expected results"
            />
          </div>
        )

      case 'passFailCriteria':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pass/Fail Criteria</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addCriterion}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  <Plus size={14} />
                  Add Criterion
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === sectionOrder.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {criteria.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No criteria added yet</p>
              ) : (
                criteria.map((criterion) => (
                  <div key={criterion.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={criterion.checked}
                      onChange={(e) => updateCriterion(criterion.id, { checked: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={criterion.text}
                      onChange={(e) => updateCriterion(criterion.id, { text: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter criterion"
                    />
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )

      case 'moc':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Means of Compliance (MoC)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <select
              value={formData.linkedMocCode}
              onChange={(e) => handleChange('linkedMocCode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select MoC (optional)</option>
              {mocs.map((moc: any) => (
                <option key={moc.code} value={moc.code}>
                  {moc.code}: {moc.description}
                </option>
              ))}
            </select>
          </div>
        )

      case 'method':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Verification Method</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <select
              value={formData.linkedMethodId}
              onChange={(e) => handleChange('linkedMethodId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Method (optional)</option>
              {methods.map((method: any) => (
                <option key={method.id} value={method.id}>
                  {method.name} ({method.methodType})
                </option>
              ))}
            </select>
          </div>
        )

      case 'setups':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Setups</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {setups.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No test setups available</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {setups.map((setup: any) => (
                    <div key={setup.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedSetups.includes(setup.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSetups([...selectedSetups, setup.id])
                          } else {
                            setSelectedSetups(selectedSetups.filter((id) => id !== setup.id))
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{setup.name}</div>
                        {setup.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{setup.description}</div>
                        )}
                        {setup.environmentType && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Type: {setup.environmentType}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      case 'owner':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner User ID</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.ownerUserId}
              onChange={(e) => handleChange('ownerUserId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter owner user ID (optional)"
            />
          </div>
        )

      case 'attachments':
        return (
          <div key={sectionId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sectionOrder.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 mb-4"
            >
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <Upload className="text-gray-400 mb-2" size={32} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Files will be attached as evidence</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <File className="text-gray-400" size={20} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{file.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Test Case</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {sectionOrder.map((sectionId) => renderSection(sectionId))}

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6 max-w-4xl mx-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={createTestCaseMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTestCaseMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTestCaseMutation.isPending ? 'Creating...' : 'Create Test Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
