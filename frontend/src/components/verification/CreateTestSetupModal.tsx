import { useState } from 'react'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import ComponentFormSection, { Component } from './ComponentFormSection'
import InterfaceFormSection, { Interface } from './InterfaceFormSection'
import TestSetupEditor from './TestSetupEditor'
import CustomDropdown from './CustomDropdown'

interface CreateTestSetupModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function CreateTestSetupModal({ isOpen, onClose, projectId }: CreateTestSetupModalProps) {
  const [step, setStep] = useState<'form' | 'editor'>('form')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    environmentType: '',
    version: '1.0',
  })
  const [components, setComponents] = useState<Component[]>([])
  const [interfaces, setInterfaces] = useState<Interface[]>([])
  const [diagramData, setDiagramData] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()

  const createSetupMutation = useMutation({
    mutationFn: (data: any) => verificationService.createSetup(projectId, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
        queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
        onClose()
        resetForm()
      } else {
        setErrors({ submit: response.error || 'Failed to create test setup' })
      }
    },
    onError: (error: any) => {
      console.error('Create test setup error:', error)
      let errorMessage = 'Failed to create test setup.'

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
    setStep('form')
    setFormData({
      name: '',
      description: '',
      environmentType: '',
      version: '1.0',
    })
    setComponents([])
    setInterfaces([])
    setDiagramData(null)
    setErrors({})
  }

  const handleFormNext = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!formData.environmentType) {
      newErrors.environmentType = 'Environment type is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setStep('editor')
  }

  const handleEditorSave = (editorData: { diagramData: any }) => {
    setDiagramData(editorData.diagramData)
    handleSubmit(editorData)
  }

  const handleSubmit = (editorData?: { diagramData: any }) => {
    const finalDiagramData = editorData?.diagramData || diagramData

    const submitData: any = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      environmentType: formData.environmentType,
      version: formData.version || '1.0',
      components: components.length > 0 ? components : undefined,
      interfaces: interfaces.length > 0 ? interfaces : undefined,
      diagramData: finalDiagramData || undefined,
    }

    createSetupMutation.mutate(submitData)
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

  if (!isOpen) return null

  if (step === 'editor') {
    return (
      <TestSetupEditor
        isOpen={true}
        onClose={() => {
          setStep('form')
        }}
        onSave={handleEditorSave}
        formData={{
          name: formData.name,
          components,
          interfaces,
        }}
        initialDiagramData={diagramData}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Test Setup</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter test setup name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter test setup description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Environment Type <span className="text-red-500">*</span>
                    </label>
                    <CustomDropdown
                      value={formData.environmentType}
                      onChange={(value) => handleChange('environmentType', value)}
                      optionType="ENVIRONMENT_TYPE"
                      projectId={projectId}
                      placeholder="Select environment type"
                      error={errors.environmentType}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Version</label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => handleChange('version', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="1.0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Components Section */}
            <ComponentFormSection
              components={components}
              onChange={setComponents}
              projectId={projectId}
            />

            {/* Interfaces Section */}
            <InterfaceFormSection
              interfaces={interfaces}
              onChange={setInterfaces}
              projectId={projectId}
            />

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            disabled={createSetupMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFormNext}
            disabled={createSetupMutation.isPending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Next: Open Editor
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
