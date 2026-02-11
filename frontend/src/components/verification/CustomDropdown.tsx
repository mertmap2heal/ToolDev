import { useState, useRef, useEffect } from 'react'
import { Trash2, Plus, ChevronDown, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

export type CustomOptionType = 'ENVIRONMENT_TYPE' | 'COMPONENT_TYPE' | 'INTERFACE_TYPE' | 'PHASE'

interface CustomOption {
  id: string
  projectId: string
  optionType: CustomOptionType
  value: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  optionType: CustomOptionType
  projectId: string
  placeholder?: string
  error?: string
  className?: string
}

export default function CustomDropdown({
  value,
  onChange,
  optionType,
  projectId,
  placeholder = 'Select an option',
  error,
  className = '',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newOptionValue, setNewOptionValue] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()

  // Fetch options
  const { data: optionsResponse, isLoading } = useQuery({
    queryKey: ['custom-options', projectId, optionType],
    queryFn: () => verificationService.getCustomOptions(projectId, optionType),
  })

  const options: CustomOption[] = optionsResponse?.success && optionsResponse.data
    ? (optionsResponse.data as CustomOption[])
    : []

  // Add custom option mutation
  const addOptionMutation = useMutation({
    mutationFn: (val: string) => verificationService.addCustomOption(projectId, optionType, val),
    onSuccess: (response) => {
      if (response.success && response.data) {
        // Auto-select the newly added option
        const capitalizedValue = capitalizeFirstLetter((response.data as { value: string }).value)
        onChange(capitalizedValue)
      }
      queryClient.invalidateQueries({ queryKey: ['custom-options', projectId, optionType] })
      setNewOptionValue('')
      setShowAddInput(false)
    },
  })

  // Remove custom option mutation
  const removeOptionMutation = useMutation({
    mutationFn: (id: string) => verificationService.removeCustomOption(projectId, id),
    onSuccess: (_, removedId) => {
      queryClient.invalidateQueries({ queryKey: ['custom-options', projectId, optionType] })
      // If the removed option was selected, clear the selection
      if (options.find((opt) => opt.id === removedId)?.value === value) {
        onChange('')
      }
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowAddInput(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Focus input when add input is shown
  useEffect(() => {
    if (showAddInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showAddInput])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setShowAddInput(false)
  }

  const handleAddOption = () => {
    if (!newOptionValue.trim()) return
    addOptionMutation.mutate(newOptionValue.trim())
  }

  const handleRemoveOption = (e: React.MouseEvent, option: CustomOption) => {
    e.stopPropagation()
    if (!option.isSystem) {
      removeOptionMutation.mutate(option.id)
    }
  }

  const capitalizeFirstLetter = (str: string) => {
    if (!str || str.length === 0) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  const handleNewOptionBlur = () => {
    if (newOptionValue.trim()) {
      setNewOptionValue(capitalizeFirstLetter(newOptionValue.trim()))
    }
  }

  const handleNewOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    } else if (e.key === 'Escape') {
      setShowAddInput(false)
      setNewOptionValue('')
    }
  }

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 text-left border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center justify-between`}
      >
        <span className={value ? '' : 'text-gray-500 dark:text-gray-400'}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-center text-gray-500 dark:text-gray-400">Loading options...</div>
          ) : options.length === 0 ? (
            <div className="p-3 text-center text-gray-500 dark:text-gray-400">No options available</div>
          ) : (
            <>
              {options.map((option) => (
                <div
                  key={option.id}
                  className={`px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between ${
                    value === option.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="flex-1 text-gray-900 dark:text-white">{option.value}</span>
                  {!option.isSystem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Are you sure you want to remove "${option.value}"? This will remove it from all future dropdowns.`)) {
                          handleRemoveOption(e, option)
                        }
                      }}
                      className="ml-2 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                      title="Remove custom option"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add custom option input */}
              {showAddInput ? (
                <div className="p-2 border-t-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newOptionValue}
                      onChange={(e) => setNewOptionValue(e.target.value)}
                      onBlur={handleNewOptionBlur}
                      onKeyDown={handleNewOptionKeyDown}
                      placeholder="Enter new option name"
                      className="flex-1 px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      disabled={!newOptionValue.trim() || addOptionMutation.isPending}
                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Add option"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddInput(false)
                        setNewOptionValue('')
                      }}
                      className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {addOptionMutation.isPending && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adding option...</p>
                  )}
                </div>
              ) : (
                <div
                  className="px-4 py-2 border-t-2 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"
                  onClick={() => setShowAddInput(true)}
                >
                  <Plus size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">Add custom option</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
