import { useState, useEffect, useRef } from 'react'
import { X, ArrowLeftRight, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { Interface, InterfaceType, InterfaceStatus, TechnicalCharacteristics } from './mockInterfaces'
import { INTERFACE_TYPES, INTERFACE_STATUSES } from './constants'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateInterfaceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (newInterface: Interface) => void
  onUpdate?: (updatedInterface: Interface) => void
  nextId: string
  initialInterface?: Interface | null
  existingOwners?: string[]
  existingNames?: string[]
}

const inputBase =
  'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
const inputError = 'border-red-500 dark:border-red-500'

export default function CreateInterfaceModal({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  nextId,
  initialInterface,
  existingOwners = [],
  existingNames = [],
}: CreateInterfaceModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const isEdit = !!initialInterface && !!onUpdate

  const [name, setName] = useState('')
  const [type, setType] = useState<InterfaceType>('Data')
  const [sourceElement, setSourceElement] = useState('')
  const [targetElement, setTargetElement] = useState('')
  const [owner, setOwner] = useState('')
  const [ownerIsOther, setOwnerIsOther] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<InterfaceStatus>('Draft')
  const [constraintsText, setConstraintsText] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [techChars, setTechChars] = useState<Partial<TechnicalCharacteristics>>({})
  const [customSections, setCustomSections] = useState<Array<{ id: string; key: string; value: string }>>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  onDiscardRef.current = () => {
    setName('')
    setType('Data')
    setSourceElement('')
    setTargetElement('')
    setOwner('')
    setOwnerIsOther(false)
    setDescription('')
    setStatus('Draft')
    setConstraintsText('')
    setTechChars({})
    setCustomSections([])
    setAdvancedOpen(false)
    setErrors({})
  }

  const namesToCheck = isEdit && initialInterface
    ? existingNames.filter((n) => n.toLowerCase() !== initialInterface.name.toLowerCase())
    : existingNames

  useEffect(() => {
    if (isOpen) {
      if (initialInterface) {
        setName(initialInterface.name)
        setType(initialInterface.type)
        setSourceElement(initialInterface.sourceElement)
        setTargetElement(initialInterface.targetElement)
        setOwner(initialInterface.owner)
        setOwnerIsOther(!existingOwners.includes(initialInterface.owner))
        setDescription(initialInterface.description ?? '')
        setStatus(initialInterface.status)
        setConstraintsText((initialInterface.constraints ?? []).join(', '))
        setTechChars(initialInterface.technicalCharacteristics ?? {})
        setCustomSections(
          initialInterface.customFields
            ? Object.entries(initialInterface.customFields).map(([key, value], i) => ({
                id: `cf-${i}-${key}`,
                key,
                value,
              }))
            : []
        )
      } else {
        setName('')
        setType('Data')
        setSourceElement('')
        setTargetElement('')
        setOwner('')
        setOwnerIsOther(false)
        setDescription('')
        setStatus('Draft')
        setConstraintsText('')
        setTechChars({})
        setCustomSections([])
        setAdvancedOpen(false)
      }
      setErrors({})
    }
  }, [isOpen, initialInterface, existingOwners])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSwapSourceTarget = () => {
    setSourceElement(targetElement)
    setTargetElement(sourceElement)
    clearError('sourceTarget')
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (namesToCheck.some((n) => n.toLowerCase() === trimmedName.toLowerCase())) {
      newErrors.name = 'An interface with this name already exists'
    }
    const src = sourceElement.trim()
    const tgt = targetElement.trim()
    if (src && tgt && src === tgt) {
      newErrors.sourceTarget = 'Source and target must be different'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const constraints = constraintsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const customFieldsRecord: Record<string, string> = {}
    customSections.forEach(({ key, value }) => {
      const k = key.trim()
      if (k) customFieldsRecord[k] = value.trim()
    })

    if (isEdit && initialInterface && onUpdate) {
      const updated: Interface = {
        ...initialInterface,
        name: name.trim(),
        type,
        sourceElement: sourceElement.trim(),
        targetElement: targetElement.trim(),
        owner: owner.trim(),
        description: description.trim() || undefined,
        status,
        constraints: constraints.length > 0 ? constraints : undefined,
        technicalCharacteristics: Object.keys(techChars).some((k) => techChars[k as keyof TechnicalCharacteristics])
          ? techChars
          : undefined,
        customFields: Object.keys(customFieldsRecord).length > 0 ? customFieldsRecord : undefined,
        lastUpdated: new Date().toISOString(),
      }
      onUpdate(updated)
    } else {
      const newInterface: Interface = {
        id: nextId,
        name: name.trim(),
        type,
        sourceElement: sourceElement.trim(),
        targetElement: targetElement.trim(),
        status: 'Draft',
        owner: owner.trim(),
        description: description.trim() || undefined,
        constraints: constraints.length > 0 ? constraints : undefined,
        technicalCharacteristics: Object.keys(techChars).some((k) => techChars[k as keyof TechnicalCharacteristics])
          ? techChars
          : undefined,
        customFields: Object.keys(customFieldsRecord).length > 0 ? customFieldsRecord : undefined,
        lastUpdated: new Date().toISOString(),
      }
      onCreate(newInterface)
    }
    resetDirty()
    onClose()
  }

  const handleCancel = () => {
    setErrors({})
    guardClose()
  }

  const renderTechFields = () => {
    if (type === 'Data') {
      return (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Protocol</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, protocol: e.target.value }))}
              placeholder="e.g. CAN 2.0B"
              className={`${inputBase} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, rate: e.target.value }))}
              placeholder="e.g. 1 Mbps"
              className={`${inputBase} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Latency</label>
            <input
              type="text"
              value={techChars.latency ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, latency: e.target.value }))}
              placeholder="e.g. &lt; 5 ms"
              className={`${inputBase} text-sm`}
            />
          </div>
        </>
      )
    }
    if (type === 'Electrical') {
      return (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Voltage</label>
            <input
              type="text"
              value={techChars.voltage ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, voltage: e.target.value }))}
              placeholder="e.g. 28V DC"
              className={`${inputBase} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current</label>
            <input
              type="text"
              value={techChars.current ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, current: e.target.value }))}
              placeholder="e.g. 2A max"
              className={`${inputBase} text-sm`}
            />
          </div>
        </>
      )
    }
    if (type === 'Physical') {
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dimensions</label>
          <input
            type="text"
            value={techChars.dimensions ?? ''}
            onChange={(e) => setTechChars((p) => ({ ...p, dimensions: e.target.value }))}
            placeholder="e.g. 600mm x 400mm"
            className={`${inputBase} text-sm`}
          />
        </div>
      )
    }
    if (type === 'Software') {
      return (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API Type</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, protocol: e.target.value }))}
              placeholder="e.g. REST, gRPC"
              className={`${inputBase} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Data Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, rate: e.target.value }))}
              placeholder="e.g. 100 Hz"
              className={`${inputBase} text-sm`}
            />
          </div>
        </>
      )
    }
    if (type === 'HMI') {
      return (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Standard</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, protocol: e.target.value }))}
              placeholder="e.g. ARINC 661"
              className={`${inputBase} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Refresh Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => setTechChars((p) => ({ ...p, rate: e.target.value }))}
              placeholder="e.g. 60 fps"
              className={`${inputBase} text-sm`}
            />
          </div>
        </>
      )
    }
    return null
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-interface-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 id="create-interface-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Interface' : 'Create Interface'}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isEdit
                ? 'Modify interface details'
                : `Creating interface ${nextId}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 1–3: Identification section, reordered */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identification</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearError('name')
                    markDirty()
                  }}
                  placeholder="e.g. FCS to Actuator CAN Bus"
                  className={`${inputBase} ${errors.name ? inputError : 'border-gray-300 dark:border-gray-600'}`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value as InterfaceType); markDirty() }}
                  className={`${inputBase} border-gray-300 dark:border-gray-600`}
                >
                  {INTERFACE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InterfaceStatus)}
                    className={`${inputBase} border-gray-300 dark:border-gray-600`}
                  >
                    {INTERFACE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* 2,5,6: Connection section – Source/Target side by side, swap, validation */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Connection</h3>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Element
                </label>
                <input
                  type="text"
                  value={sourceElement}
                  onChange={(e) => {
                    setSourceElement(e.target.value)
                    clearError('sourceTarget')
                    markDirty()
                  }}
                  placeholder="e.g. FCS Controller"
                  className={`${inputBase} ${errors.sourceTarget ? inputError : 'border-gray-300 dark:border-gray-600'}`}
                />
              </div>
              <button
                type="button"
                onClick={handleSwapSourceTarget}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 self-end mb-2"
                title="Swap source and target"
              >
                <ArrowLeftRight size={18} />
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Element
                </label>
                <input
                  type="text"
                  value={targetElement}
                  onChange={(e) => {
                    setTargetElement(e.target.value)
                    clearError('sourceTarget')
                    markDirty()
                  }}
                  placeholder="e.g. Actuator Unit"
                  className={`${inputBase} ${errors.sourceTarget ? inputError : 'border-gray-300 dark:border-gray-600'}`}
                />
              </div>
            </div>
            {errors.sourceTarget && (
              <p className="mt-1 text-sm text-red-500">{errors.sourceTarget}</p>
            )}
          </section>

          {/* 8: Owner as select + Other */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ownership</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Owner (Subsystem)
              </label>
              <select
                value={ownerIsOther ? '__other__' : owner}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__other__') {
                    setOwnerIsOther(true)
                    setOwner('')
                  } else {
                    setOwnerIsOther(false)
                    setOwner(v)
                  }
                }}
                className={`${inputBase} border-gray-300 dark:border-gray-600`}
              >
                <option value="">Select owner...</option>
                {existingOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value="__other__">Other...</option>
              </select>
              {ownerIsOther && (
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Enter owner subsystem"
                  className={`${inputBase} border-gray-300 dark:border-gray-600 mt-2`}
                />
              )}
            </div>
          </section>

          {/* Description */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Description</h3>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty() }}
              rows={3}
              placeholder="Optional description"
              className={`${inputBase} border-gray-300 dark:border-gray-600`}
            />
          </section>

          {/* 14: Constraints */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Constraints</h3>
            <input
              type="text"
              value={constraintsText}
              onChange={(e) => setConstraintsText(e.target.value)}
              placeholder="Comma-separated, e.g. Max 1 Mbps, Redundant path"
              className={`${inputBase} border-gray-300 dark:border-gray-600`}
            />
          </section>

          {/* 15: Advanced – type-specific technical fields */}
          <section>
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {advancedOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              Advanced (Technical characteristics)
            </button>
            {advancedOpen && (
              <div className="mt-3 space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderTechFields()}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Custom sections
                  </h4>
                  <div className="space-y-3">
                    {customSections.map((section) => (
                      <div
                        key={section.id}
                        className="flex gap-2 items-start"
                      >
                        <input
                          type="text"
                          value={section.key}
                          onChange={(e) =>
                            setCustomSections((prev) =>
                              prev.map((s) =>
                                s.id === section.id ? { ...s, key: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Section name"
                          className={`${inputBase} flex-1 text-sm border-gray-300 dark:border-gray-600`}
                        />
                        <input
                          type="text"
                          value={section.value}
                          onChange={(e) =>
                            setCustomSections((prev) =>
                              prev.map((s) =>
                                s.id === section.id ? { ...s, value: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Value"
                          className={`${inputBase} flex-1 text-sm border-gray-300 dark:border-gray-600`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCustomSections((prev) => prev.filter((s) => s.id !== section.id))
                          }
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0"
                          title="Remove section"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCustomSections((prev) => [
                          ...prev,
                          { id: `cf-${Date.now()}`, key: '', value: '' },
                        ])
                      }
                      className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-dashed border-gray-300 dark:border-gray-600"
                    >
                      <Plus size={16} />
                      Add custom section
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
