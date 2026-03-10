/**
 * Single source of truth for Functions module styling, tree utilities, and constants.
 * Used by: FunctionTreePanel, FunctionDetailPanel, RequirementsFunctionsTree.
 * When adding a new status, criticality level, or hierarchy level, update here
 * so all pages stay consistent.
 */
import { Box, Layers, Settings, Cpu, type LucideIcon } from 'lucide-react'
import type { SystemFunction, FunctionCriticality } from 'shared/types/engineering.types'

// ── Tree node type (shared between FunctionTreePanel and RequirementsFunctionsTree) ──

export interface FunctionTreeNode {
  function: SystemFunction
  children: FunctionTreeNode[]
}

/**
 * Build a parent-child hierarchy from a flat SystemFunction[].
 * Single source of truth for function tree construction.
 */
export function buildFunctionTree(functions: SystemFunction[]): FunctionTreeNode[] {
  const map = new Map<string, FunctionTreeNode>()
  const roots: FunctionTreeNode[] = []

  for (const fn of functions) {
    map.set(fn.id, { function: fn, children: [] })
  }

  for (const fn of functions) {
    const node = map.get(fn.id)!
    if (fn.parentId && map.has(fn.parentId)) {
      map.get(fn.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortChildren = (nodes: FunctionTreeNode[]) => {
    nodes.sort((a, b) => (a.function.sortOrder ?? 0) - (b.function.sortOrder ?? 0))
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}

/** Flatten a FunctionTreeNode hierarchy back into a sorted SystemFunction[]. */
export function flattenFunctionTree(nodes: FunctionTreeNode[]): SystemFunction[] {
  const result: SystemFunction[] = []
  const walk = (list: FunctionTreeNode[]) => {
    for (const node of list) {
      result.push(node.function)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}

// ── Level styling (tree panel: bg/text/border/badge per depth) ──

export interface FunctionLevelColor {
  text: string
  bg: string
  border: string
  icon: LucideIcon
  badge: string
}

export const FUNCTION_LEVEL_COLORS: FunctionLevelColor[] = [
  { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Box, badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  { text: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800', icon: Layers, badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  { text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-800', icon: Settings, badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  { text: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', icon: Cpu, badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  { text: 'text-fuchsia-700 dark:text-fuchsia-300', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', border: 'border-fuchsia-200 dark:border-fuchsia-800', icon: Settings, badge: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300' },
]

export function getFunctionLevelStyle(level: number): FunctionLevelColor {
  return FUNCTION_LEVEL_COLORS[Math.min(level, FUNCTION_LEVEL_COLORS.length - 1)]
}

// ── Level styling (detail panel: label + icon + color per depth) ──

export interface FunctionLevelStyle {
  label: string
  icon: LucideIcon
  color: string
  bg: string
}

export const FUNCTION_LEVEL_STYLES: FunctionLevelStyle[] = [
  { label: 'System Function', icon: Box, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  { label: 'Sub-Function L1', icon: Layers, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  { label: 'Sub-Function L2', icon: Settings, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  { label: 'Sub-Function L3', icon: Cpu, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  { label: 'Sub-Function L4', icon: Settings, color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
]

export function getFunctionDetailLevelStyle(level: number): FunctionLevelStyle {
  return FUNCTION_LEVEL_STYLES[Math.min(level, FUNCTION_LEVEL_STYLES.length - 1)]
}

// ── Status styling ──

export const FUNCTION_STATUS_DOT: Record<string, string> = {
  'draft': 'bg-gray-400',
  'work-in-progress': 'bg-yellow-500',
  'in-review': 'bg-blue-500',
  'done': 'bg-green-500',
}

export interface FunctionStatusOption {
  value: string
  label: string
  color: string
}

export const FUNCTION_STATUS_OPTIONS: FunctionStatusOption[] = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
  { value: 'work-in-progress', label: 'Work in Progress', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' },
  { value: 'in-review', label: 'In Review', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' },
  { value: 'done', label: 'Done', color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' },
]

// ── Criticality styling ──

export const FUNCTION_CRITICALITY_DOT: Record<string, string> = {
  'low': 'bg-green-400',
  'medium': 'bg-yellow-400',
  'high': 'bg-orange-500',
  'critical': 'bg-red-500',
}

export interface FunctionCriticalityOption {
  value: FunctionCriticality
  label: string
  color: string
}

export const FUNCTION_CRITICALITY_OPTIONS: FunctionCriticalityOption[] = [
  { value: 'low', label: 'Low', color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' },
]
