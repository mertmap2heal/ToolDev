import { useState } from 'react'
import { Plus, X, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { AutomationRule, AutomationTriggerType } from 'shared/types/task.types'

interface AutomationRuleBuilderProps {
  // SEC-2 (#375): rules are project-scoped, so the builder requires the
  // active project context to call createAutomationRule.
  projectId: string
  onClose?: () => void
}

export default function AutomationRuleBuilder({ projectId, onClose }: AutomationRuleBuilderProps) {
  const [ruleName, setRuleName] = useState('')
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('task_created')
  const [conditions, setConditions] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const queryClient = useQueryClient()

  const createRuleMutation = useMutation({
    mutationFn: (data: {
      name: string
      triggerType: string
      conditionsJson: string
      actionsJson: string
    }) => taskService.createAutomationRule({ ...data, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules', projectId] })
      if (onClose) onClose()
    },
  })

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        field: 'status',
        operator: 'equals',
        value: '',
      },
    ])
  }

  const addAction = () => {
    setActions([
      ...actions,
      {
        type: 'set_status',
        value: '',
      },
    ])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!ruleName.trim()) {
      alert('Rule name is required')
      return
    }

    const conditionsJson = JSON.stringify({
      operator: 'AND',
      conditions: conditions.length > 0 ? conditions : [{ field: 'status', operator: 'is_true', value: true }],
    })

    const actionsJson = JSON.stringify(actions.length > 0 ? actions : [])

    createRuleMutation.mutate({
      name: ruleName.trim(),
      triggerType,
      conditionsJson,
      actionsJson,
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rule Name
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g., Auto-tag high priority tasks"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Trigger
          </label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="task_created">Task Created</option>
            <option value="status_changed">Status Changed</option>
            <option value="due_date_changed">Due Date Changed</option>
            <option value="comment_added">Comment Added</option>
            <option value="tag_added">Tag Added</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Conditions (when all are true)
            </label>
            <button
              type="button"
              onClick={addCondition}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={12} />
              Add Condition
            </button>
          </div>
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  value={condition.field}
                  onChange={(e) => {
                    const newConditions = [...conditions]
                    newConditions[index].field = e.target.value
                    setConditions(newConditions)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="has_tag">Has Tag</option>
                  <option value="title_contains">Title Contains</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => {
                    const newConditions = [...conditions]
                    newConditions[index].operator = e.target.value
                    setConditions(newConditions)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="is_true">Is True</option>
                  <option value="is_false">Is False</option>
                </select>
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => {
                    const newConditions = [...conditions]
                    newConditions[index].value = e.target.value
                    setConditions(newConditions)
                  }}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {conditions.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No conditions (rule will always execute)
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Actions
            </label>
            <button
              type="button"
              onClick={addAction}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={12} />
              Add Action
            </button>
          </div>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  value={action.type}
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].type = e.target.value
                    setActions(newActions)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="set_status">Set Status</option>
                  <option value="set_priority">Set Priority</option>
                  <option value="add_tag">Add Tag</option>
                  <option value="set_due_date_offset">Set Due Date (days from now)</option>
                  <option value="post_comment">Post Comment</option>
                </select>
                <input
                  type="text"
                  value={action.value}
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].value = e.target.value
                    setActions(newActions)
                  }}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setActions(actions.filter((_, i) => i !== index))}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {actions.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                Add at least one action
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={createRuleMutation.isPending || actions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save size={16} />
            {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
          </button>
        </div>
      </form>
    </div>
  )
}
