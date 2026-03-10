/**
 * Single source of truth for PBS section tabs and panel definitions.
 * Used by: PBSNodeEditor (editor tabs), PBSPage (right-panel tabs), RequirementsPage (left-panel tabs).
 * When adding a new PBS editor tab or panel, update here so all pages stay consistent.
 */
import {
  Box,
  FileText,
  Link2,
  Paperclip,
  History,
  ListChecks,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type PBSEditorTabId =
  | 'overview'
  | 'attributes'
  | 'relationships'
  | 'attachments'
  | 'requirements'
  | 'functions'
  | 'changelog'

export interface PBSEditorTab {
  id: PBSEditorTabId
  label: string
  icon: LucideIcon
}

export const PBS_EDITOR_TABS: PBSEditorTab[] = [
  { id: 'overview', label: 'Overview', icon: Box },
  { id: 'attributes', label: 'Attributes', icon: FileText },
  { id: 'relationships', label: 'Relationships', icon: Link2 },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
  { id: 'requirements', label: 'Requirements', icon: ListChecks },
  { id: 'functions', label: 'Functions', icon: Settings },
  { id: 'changelog', label: 'Change Log', icon: History },
]

export type PBSRightPanelTabId = 'requirements' | 'functions'

export interface PBSRightPanelTab {
  id: PBSRightPanelTabId
  label: string
}

export const PBS_RIGHT_PANEL_TABS: PBSRightPanelTab[] = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'functions', label: 'Functions' },
]

export type RequirementsLeftPanelTabId = 'pbs' | 'functions' | 'verification'

export interface RequirementsLeftPanelTab {
  id: RequirementsLeftPanelTabId
  label: string
  activeClass: string
  inactiveClass: string
}

export const REQUIREMENTS_LEFT_PANEL_TABS: RequirementsLeftPanelTab[] = [
  {
    id: 'pbs',
    label: 'PBS',
    activeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500',
    inactiveClass: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
  },
  {
    id: 'functions',
    label: 'Functions',
    activeClass: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500',
    inactiveClass: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
  },
  {
    id: 'verification',
    label: 'Verification',
    activeClass: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-b-2 border-teal-500',
    inactiveClass: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
  },
]
