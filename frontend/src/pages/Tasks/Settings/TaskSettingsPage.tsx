import { useState, useEffect } from 'react'
import {
  Settings2,
  Save,
  RotateCcw,
  CheckCircle2,
  Palette,
  Bell,
  Zap,
  LayoutGrid,
} from 'lucide-react'

interface TaskSettings {
  defaultView: 'list' | 'board' | 'calendar'
  defaultStatus: string
  defaultPriority: string
  showCompletedTasks: boolean
  autoArchiveDays: number
  enableTimeTracking: boolean
  enableAutomation: boolean
  notifyOnAssignment: boolean
  notifyOnStatusChange: boolean
  notifyOnComment: boolean
  notifyOnDueSoon: boolean
  dueSoonDays: number
  taskPrefix: string
  enableSubtasks: boolean
  maxAttachmentSize: number
}

const DEFAULT_SETTINGS: TaskSettings = {
  defaultView: 'list',
  defaultStatus: 'TODO',
  defaultPriority: 'MEDIUM',
  showCompletedTasks: true,
  autoArchiveDays: 30,
  enableTimeTracking: true,
  enableAutomation: true,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
  notifyOnComment: true,
  notifyOnDueSoon: true,
  dueSoonDays: 3,
  taskPrefix: 'TASK',
  enableSubtasks: true,
  maxAttachmentSize: 10,
}

const STORAGE_KEY = 'task-settings'

function loadSettings(): TaskSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch { /* ignore parse errors */ }
  return DEFAULT_SETTINGS
}

export default function TaskSettingsPage() {
  const [settings, setSettings] = useState<TaskSettings>(loadSettings)
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof TaskSettings>(key: K, value: TaskSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.removeItem(STORAGE_KEY)
    setSaved(false)
  }

  const sections = [
    {
      title: 'General',
      icon: LayoutGrid,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Default View</p>
              <p className="text-[10px] text-gray-500">View shown when opening tasks</p>
            </div>
            <select
              value={settings.defaultView}
              onChange={(e) => update('defaultView', e.target.value as TaskSettings['defaultView'])}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="list">List</option>
              <option value="board">Board</option>
              <option value="calendar">Calendar</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Default Status</p>
              <p className="text-[10px] text-gray-500">Status for new tasks</p>
            </div>
            <select
              value={settings.defaultStatus}
              onChange={(e) => update('defaultStatus', e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Default Priority</p>
              <p className="text-[10px] text-gray-500">Priority for new tasks</p>
            </div>
            <select
              value={settings.defaultPriority}
              onChange={(e) => update('defaultPriority', e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Task ID Prefix</p>
              <p className="text-[10px] text-gray-500">Prefix for task identifiers</p>
            </div>
            <input
              type="text"
              value={settings.taskPrefix}
              onChange={(e) => update('taskPrefix', e.target.value.toUpperCase())}
              className="w-24 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-center"
              maxLength={6}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Display',
      icon: Palette,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      content: (
        <div className="space-y-4">
          <ToggleSetting
            label="Show Completed Tasks"
            desc="Display completed tasks in lists and boards"
            value={settings.showCompletedTasks}
            onChange={(v) => update('showCompletedTasks', v)}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Auto-Archive</p>
              <p className="text-[10px] text-gray-500">Archive completed tasks after N days</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={settings.autoArchiveDays}
                onChange={(e) => update('autoArchiveDays', parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center"
                min={0}
                max={365}
              />
              <span className="text-[10px] text-gray-500">days</span>
            </div>
          </div>
          <ToggleSetting
            label="Enable Subtasks"
            desc="Allow tasks to have nested subtasks"
            value={settings.enableSubtasks}
            onChange={(v) => update('enableSubtasks', v)}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Max Attachment Size</p>
              <p className="text-[10px] text-gray-500">Maximum file upload size</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={settings.maxAttachmentSize}
                onChange={(e) => update('maxAttachmentSize', parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center"
                min={1}
                max={100}
              />
              <span className="text-[10px] text-gray-500">MB</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Features',
      icon: Zap,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      content: (
        <div className="space-y-4">
          <ToggleSetting
            label="Time Tracking"
            desc="Enable time tracking for tasks"
            value={settings.enableTimeTracking}
            onChange={(v) => update('enableTimeTracking', v)}
          />
          <ToggleSetting
            label="Automation Rules"
            desc="Enable task automation engine"
            value={settings.enableAutomation}
            onChange={(v) => update('enableAutomation', v)}
          />
        </div>
      ),
    },
    {
      title: 'Notifications',
      icon: Bell,
      color: 'text-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-900/30',
      content: (
        <div className="space-y-4">
          <ToggleSetting
            label="On Assignment"
            desc="Notify when a task is assigned to you"
            value={settings.notifyOnAssignment}
            onChange={(v) => update('notifyOnAssignment', v)}
          />
          <ToggleSetting
            label="On Status Change"
            desc="Notify when task status changes"
            value={settings.notifyOnStatusChange}
            onChange={(v) => update('notifyOnStatusChange', v)}
          />
          <ToggleSetting
            label="On Comment"
            desc="Notify when someone comments on your task"
            value={settings.notifyOnComment}
            onChange={(v) => update('notifyOnComment', v)}
          />
          <ToggleSetting
            label="Due Soon Reminder"
            desc="Notify before task due date"
            value={settings.notifyOnDueSoon}
            onChange={(v) => update('notifyOnDueSoon', v)}
          />
          {settings.notifyOnDueSoon && (
            <div className="flex items-center justify-between pl-6">
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Reminder Days</p>
                <p className="text-[10px] text-gray-500">Days before due date to send reminder</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={settings.dueSoonDays}
                  onChange={(e) => update('dueSoonDays', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center"
                  min={1}
                  max={14}
                />
                <span className="text-[10px] text-gray-500">days</span>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
              <Settings2 size={18} className="text-gray-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Task Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure task management preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              {saved ? <><CheckCircle2 size={12} /> Saved</> : <><Save size={12} /> Save Changes</>}
            </button>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${section.bg}`}>
                    <Icon size={13} className={section.color} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                </div>
                <div className="px-5 py-4">
                  {section.content}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ToggleSetting({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${value ? 'left-[18px]' : 'left-[3px]'}`} />
      </button>
    </div>
  )
}
