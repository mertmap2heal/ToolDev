import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  FileText,
  Link,
  Unlink,
  Target,
  Shield,
  Loader,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import { useCaseService } from '../../../services/usecase.service'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import type { UseCase } from 'shared/types/usecase.types'
import clsx from 'clsx'

/**
 * Validation issue severity levels following industrial standards
 */
type IssueSeverity = 'error' | 'warning' | 'info'

/**
 * Validation rule categories based on INCOSE and ISO standards
 */
type RuleCategory =
  | 'completeness'      // Missing required attributes
  | 'traceability'      // Missing or broken trace links
  | 'consistency'       // Conflicting or duplicate data
  | 'conformance'       // Violations of modeling rules
  | 'verification'      // Verification coverage issues

/**
 * Structure for validation issues
 */
interface ValidationIssue {
  id: string
  severity: IssueSeverity
  category: RuleCategory
  ruleId: string
  ruleName: string
  message: string
  elementType: 'requirement' | 'function' | 'traceLink' | 'useCase'
  elementId: string
  elementName: string
  suggestion?: string
}

/**
 * Validation rule definition
 */
interface ValidationRule {
  id: string
  name: string
  category: RuleCategory
  severity: IssueSeverity
  description: string
  enabled: boolean
}

interface ModelValidationEngineProps {
  projectId: string
  onClose?: () => void
  isPanel?: boolean
}

/**
 * Default validation rules based on industrial standards
 */
const DEFAULT_RULES: ValidationRule[] = [
  // Completeness Rules
  { id: 'REQ-COMP-001', name: 'Requirement Description Required', category: 'completeness', severity: 'error', description: 'Every requirement must have a description', enabled: true },
  { id: 'REQ-COMP-002', name: 'Requirement Owner Required', category: 'completeness', severity: 'warning', description: 'Requirements should have an assigned owner', enabled: true },
  { id: 'REQ-COMP-003', name: 'Verification Method Required', category: 'completeness', severity: 'warning', description: 'Requirements should specify verification method', enabled: true },
  { id: 'REQ-COMP-004', name: 'Acceptance Criteria Required', category: 'completeness', severity: 'info', description: 'Requirements should have acceptance criteria', enabled: true },

  // Traceability Rules
  { id: 'TRACE-001', name: 'Orphan Requirement', category: 'traceability', severity: 'warning', description: 'Requirements should be linked to at least one function or parent', enabled: true },
  { id: 'TRACE-002', name: 'Orphan Function', category: 'traceability', severity: 'warning', description: 'Functions should satisfy at least one requirement', enabled: true },
  { id: 'TRACE-003', name: 'Suspect Link Present', category: 'traceability', severity: 'warning', description: 'Suspect links need review after source changes', enabled: true },
  { id: 'TRACE-004', name: 'Circular Dependency', category: 'traceability', severity: 'error', description: 'Circular trace dependencies detected', enabled: true },

  // Consistency Rules
  { id: 'CONS-001', name: 'Duplicate ID', category: 'consistency', severity: 'error', description: 'Requirement IDs must be unique', enabled: true },
  { id: 'CONS-002', name: 'Parent-Child Priority Mismatch', category: 'consistency', severity: 'info', description: 'Child requirement priority should not exceed parent', enabled: true },

  // Conformance Rules
  { id: 'CONF-001', name: 'Invalid Status Transition', category: 'conformance', severity: 'warning', description: 'Status transitions should follow workflow', enabled: true },
  { id: 'CONF-002', name: 'Missing Requirement Type', category: 'conformance', severity: 'info', description: 'Requirements should have a type classification', enabled: true },

  // Verification Rules
  { id: 'VER-001', name: 'Unverified Approved Requirement', category: 'verification', severity: 'warning', description: 'Approved requirements should be verified', enabled: true },
  { id: 'VER-002', name: 'Failed Verification', category: 'verification', severity: 'error', description: 'Requirement verification has failed', enabled: true },
]

/**
 * ModelValidationEngine performs comprehensive model validation
 * based on industrial standards (INCOSE, ISO/IEC/IEEE 29148, SysML)
 */
export default function ModelValidationEngine({
  projectId,
  onClose,
  isPanel = false,
}: ModelValidationEngineProps) {
  const [rules, setRules] = useState<ValidationRule[]>(DEFAULT_RULES)
  const [expandedCategories, setExpandedCategories] = useState<Set<RuleCategory>>(
    new Set(['completeness', 'traceability', 'consistency', 'conformance', 'verification'])
  )
  const [showRulesConfig, setShowRulesConfig] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  // Fetch all model data
  const { data: requirements = [], isLoading: loadingReqs, refetch: refetchReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs, refetch: refetchFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: traceLinks = [], isLoading: loadingLinks, refetch: refetchLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: useCases = [], isLoading: loadingUCs } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Run validation and collect issues
  const validationIssues = useMemo(() => {
    const issues: ValidationIssue[] = []
    const enabledRules = rules.filter((r) => r.enabled)

    // Helper to create issue
    const addIssue = (
      rule: ValidationRule,
      elementType: ValidationIssue['elementType'],
      elementId: string,
      elementName: string,
      message: string,
      suggestion?: string
    ) => {
      issues.push({
        id: `${rule.id}-${elementId}`,
        severity: rule.severity,
        category: rule.category,
        ruleId: rule.id,
        ruleName: rule.name,
        message,
        elementType,
        elementId,
        elementName,
        suggestion,
      })
    }

    // Build lookup maps
    const reqMap = new Map(requirements.map((r) => [r.id, r]))
    const funcMap = new Map(functions.map((f) => [f.id, f]))
    const reqIdSet = new Set(requirements.map((r) => r.requirementId).filter(Boolean))

    // Get linked requirement IDs (requirements that have trace links to functions)
    const linkedReqIds = new Set<string>()
    const linkedFuncIds = new Set<string>()
    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement') linkedReqIds.add(link.sourceId)
      if (link.targetType === 'function') linkedFuncIds.add(link.targetId)
    })
    functions.forEach((func) => {
      if (func.sourceReqId) {
        linkedReqIds.add(func.sourceReqId)
        linkedFuncIds.add(func.id)
      }
    })

    // Validate each requirement
    requirements.forEach((req) => {
      // REQ-COMP-001: Description required
      if (enabledRules.find((r) => r.id === 'REQ-COMP-001') && !req.description?.trim()) {
        addIssue(
          enabledRules.find((r) => r.id === 'REQ-COMP-001')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" has no description`,
          'Add a detailed description explaining the requirement'
        )
      }

      // REQ-COMP-002: Owner required
      if (enabledRules.find((r) => r.id === 'REQ-COMP-002') && !req.owner) {
        addIssue(
          enabledRules.find((r) => r.id === 'REQ-COMP-002')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" has no owner assigned`,
          'Assign an owner responsible for this requirement'
        )
      }

      // REQ-COMP-003: Verification method required
      if (enabledRules.find((r) => r.id === 'REQ-COMP-003') && !req.verificationMethod) {
        addIssue(
          enabledRules.find((r) => r.id === 'REQ-COMP-003')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" has no verification method`,
          'Specify how this requirement will be verified (test, analysis, inspection, demonstration)'
        )
      }

      // REQ-COMP-004: Acceptance criteria required
      if (enabledRules.find((r) => r.id === 'REQ-COMP-004') && !req.acceptanceCriteria) {
        addIssue(
          enabledRules.find((r) => r.id === 'REQ-COMP-004')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" has no acceptance criteria`,
          'Define measurable criteria for requirement satisfaction'
        )
      }

      // TRACE-001: Orphan requirement
      if (enabledRules.find((r) => r.id === 'TRACE-001')) {
        const hasParent = !!req.parentId
        const hasTraceLink = linkedReqIds.has(req.id)
        if (!hasParent && !hasTraceLink) {
          addIssue(
            enabledRules.find((r) => r.id === 'TRACE-001')!,
            'requirement',
            req.id,
            req.requirementId || req.title,
            `Requirement "${req.title}" is orphaned (no parent or trace links)`,
            'Link this requirement to a function or parent requirement'
          )
        }
      }

      // CONF-002: Missing requirement type
      if (enabledRules.find((r) => r.id === 'CONF-002') && !req.requirementType) {
        addIssue(
          enabledRules.find((r) => r.id === 'CONF-002')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" has no type classification`,
          'Classify as functional, performance, interface, safety, etc.'
        )
      }

      // VER-001: Unverified approved requirement
      if (enabledRules.find((r) => r.id === 'VER-001')) {
        const isApproved = req.status?.toLowerCase().includes('approved')
        const isNotVerified = req.verificationStatus !== 'verified'
        if (isApproved && isNotVerified) {
          addIssue(
            enabledRules.find((r) => r.id === 'VER-001')!,
            'requirement',
            req.id,
            req.requirementId || req.title,
            `Approved requirement "${req.title}" is not verified`,
            'Complete verification activities for this requirement'
          )
        }
      }

      // VER-002: Failed verification
      if (enabledRules.find((r) => r.id === 'VER-002') && req.verificationStatus === 'failed') {
        addIssue(
          enabledRules.find((r) => r.id === 'VER-002')!,
          'requirement',
          req.id,
          req.requirementId || req.title,
          `Requirement "${req.title}" verification has failed`,
          'Investigate verification failure and update requirement or implementation'
        )
      }

      // CONS-002: Parent-child priority mismatch
      if (enabledRules.find((r) => r.id === 'CONS-002') && req.parentId) {
        const parent = reqMap.get(req.parentId)
        if (parent) {
          const priorityOrder = ['low', 'medium', 'high', 'critical']
          const childPriority = priorityOrder.indexOf(req.priority)
          const parentPriority = priorityOrder.indexOf(parent.priority)
          if (childPriority > parentPriority) {
            addIssue(
              enabledRules.find((r) => r.id === 'CONS-002')!,
              'requirement',
              req.id,
              req.requirementId || req.title,
              `Child requirement "${req.title}" has higher priority than parent`,
              'Review priority alignment with parent requirement'
            )
          }
        }
      }
    })

    // Check for duplicate requirement IDs
    if (enabledRules.find((r) => r.id === 'CONS-001')) {
      const idCounts = new Map<string, Requirement[]>()
      requirements.forEach((req) => {
        if (req.requirementId) {
          const existing = idCounts.get(req.requirementId) || []
          existing.push(req)
          idCounts.set(req.requirementId, existing)
        }
      })
      idCounts.forEach((reqs, reqId) => {
        if (reqs.length > 1) {
          reqs.forEach((req) => {
            addIssue(
              enabledRules.find((r) => r.id === 'CONS-001')!,
              'requirement',
              req.id,
              reqId,
              `Duplicate requirement ID "${reqId}" found`,
              'Ensure each requirement has a unique identifier'
            )
          })
        }
      })
    }

    // Validate functions
    functions.forEach((func) => {
      // TRACE-002: Orphan function
      if (enabledRules.find((r) => r.id === 'TRACE-002') && !linkedFuncIds.has(func.id)) {
        addIssue(
          enabledRules.find((r) => r.id === 'TRACE-002')!,
          'function',
          func.id,
          func.functionId || func.name,
          `Function "${func.name}" has no requirement traceability`,
          'Link this function to a requirement it satisfies'
        )
      }
    })

    // Validate trace links
    traceLinks.forEach((link) => {
      // TRACE-003: Suspect links
      if (enabledRules.find((r) => r.id === 'TRACE-003') && link.isSuspect) {
        const sourceName = link.sourceType === 'requirement'
          ? reqMap.get(link.sourceId)?.title || link.sourceId
          : funcMap.get(link.sourceId)?.name || link.sourceId
        addIssue(
          enabledRules.find((r) => r.id === 'TRACE-003')!,
          'traceLink',
          link.id,
          `${link.sourceType} → ${link.targetType}`,
          `Suspect link from "${sourceName}" needs review`,
          'Review and clear suspect flag after verifying link validity'
        )
      }
    })

    // TRACE-004: Check for circular dependencies (simplified check)
    if (enabledRules.find((r) => r.id === 'TRACE-004')) {
      const visited = new Set<string>()
      const recursionStack = new Set<string>()

      const hasCycle = (reqId: string): boolean => {
        visited.add(reqId)
        recursionStack.add(reqId)

        const childLinks = traceLinks.filter(
          (l) => l.sourceType === 'requirement' && l.sourceId === reqId && l.targetType === 'requirement'
        )

        for (const link of childLinks) {
          if (!visited.has(link.targetId)) {
            if (hasCycle(link.targetId)) return true
          } else if (recursionStack.has(link.targetId)) {
            return true
          }
        }

        recursionStack.delete(reqId)
        return false
      }

      requirements.forEach((req) => {
        if (!visited.has(req.id) && hasCycle(req.id)) {
          addIssue(
            enabledRules.find((r) => r.id === 'TRACE-004')!,
            'requirement',
            req.id,
            req.requirementId || req.title,
            `Circular dependency detected involving "${req.title}"`,
            'Remove circular trace links to maintain hierarchy integrity'
          )
        }
      })
    }

    return issues
  }, [requirements, functions, traceLinks, useCases, rules])

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const grouped = new Map<RuleCategory, ValidationIssue[]>()
    validationIssues.forEach((issue) => {
      const existing = grouped.get(issue.category) || []
      existing.push(issue)
      grouped.set(issue.category, existing)
    })
    return grouped
  }, [validationIssues])

  // Calculate statistics
  const stats = useMemo(() => {
    const errors = validationIssues.filter((i) => i.severity === 'error').length
    const warnings = validationIssues.filter((i) => i.severity === 'warning').length
    const infos = validationIssues.filter((i) => i.severity === 'info').length
    const total = validationIssues.length
    const score = total === 0 ? 100 : Math.max(0, 100 - (errors * 10 + warnings * 3 + infos))
    return { errors, warnings, infos, total, score }
  }, [validationIssues])

  const toggleCategory = (category: RuleCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    )
  }

  const runValidation = async () => {
    setIsValidating(true)
    await Promise.all([refetchReqs(), refetchFuncs(), refetchLinks()])
    setIsValidating(false)
  }

  const getSeverityIcon = (severity: IssueSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-500" />
      case 'info':
        return <Info size={16} className="text-blue-500" />
    }
  }

  const getCategoryIcon = (category: RuleCategory) => {
    switch (category) {
      case 'completeness':
        return <FileText size={16} />
      case 'traceability':
        return <Link size={16} />
      case 'consistency':
        return <Target size={16} />
      case 'conformance':
        return <Shield size={16} />
      case 'verification':
        return <CheckCircle size={16} />
    }
  }

  const getCategoryLabel = (category: RuleCategory) => {
    switch (category) {
      case 'completeness':
        return 'Completeness'
      case 'traceability':
        return 'Traceability'
      case 'consistency':
        return 'Consistency'
      case 'conformance':
        return 'Conformance'
      case 'verification':
        return 'Verification'
    }
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks || loadingUCs

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-blue-500" size={20} />
            Model Validation
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ISO/IEC/IEEE 29148 & INCOSE compliance checks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runValidation}
            disabled={isLoading || isValidating}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-1"
          >
            {isValidating ? (
              <Loader size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Validate
          </button>
          <button
            onClick={() => setShowRulesConfig(!showRulesConfig)}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg',
              showRulesConfig
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            Rules
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Score Card */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div
              className={clsx(
                'text-3xl font-bold',
                stats.score >= 80 ? 'text-green-600' : stats.score >= 50 ? 'text-amber-600' : 'text-red-600'
              )}
            >
              {stats.score}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Model Health Score
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle size={14} />
              {stats.errors} errors
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={14} />
              {stats.warnings} warnings
            </span>
            <span className="flex items-center gap-1 text-blue-600">
              <Info size={14} />
              {stats.infos} info
            </span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all',
              stats.score >= 80 ? 'bg-green-500' : stats.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${stats.score}%` }}
          />
        </div>
      </div>

      {/* Rules Configuration Panel */}
      {showRulesConfig && (
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Validation Rules Configuration
          </div>
          <div className="space-y-2">
            {rules.map((rule) => (
              <label
                key={rule.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{rule.id}</span>
                    <span className="text-sm text-gray-900 dark:text-white">{rule.name}</span>
                    {getSeverityIcon(rule.severity)}
                  </div>
                  <p className="text-xs text-gray-500">{rule.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <Loader className="animate-spin mr-2" size={16} />
            Loading model data...
          </div>
        ) : validationIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <CheckCircle size={32} className="text-green-500 mb-2" />
            <p className="text-sm">No validation issues found</p>
            <p className="text-xs">Model passes all enabled validation rules</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(['error', 'warning', 'info'] as IssueSeverity[]).map((severity) => {
              const severityIssues = validationIssues.filter((i) => i.severity === severity)
              if (severityIssues.length === 0) return null

              return (
                <div key={severity}>
                  {(['completeness', 'traceability', 'consistency', 'conformance', 'verification'] as RuleCategory[]).map(
                    (category) => {
                      const categoryIssues = severityIssues.filter((i) => i.category === category)
                      if (categoryIssues.length === 0) return null

                      const isExpanded = expandedCategories.has(category)

                      return (
                        <div key={`${severity}-${category}`}>
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(severity)}
                              {getCategoryIcon(category)}
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {getCategoryLabel(category)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({categoryIssues.length})
                              </span>
                            </div>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          {isExpanded && (
                            <div className="bg-gray-50 dark:bg-gray-900/30">
                              {categoryIssues.map((issue) => (
                                <div
                                  key={issue.id}
                                  className="px-4 py-3 border-l-4 ml-4 mr-2 mb-2 bg-white dark:bg-gray-800 rounded-r"
                                  style={{
                                    borderLeftColor:
                                      issue.severity === 'error'
                                        ? '#ef4444'
                                        : issue.severity === 'warning'
                                          ? '#f59e0b'
                                          : '#3b82f6',
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="text-sm text-gray-900 dark:text-white">
                                        {issue.message}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 font-mono">
                                          {issue.ruleId}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {issue.elementType}: {issue.elementName}
                                        </span>
                                      </div>
                                      {issue.suggestion && (
                                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                                          💡 {issue.suggestion}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        {requirements.length} requirements • {functions.length} functions • {traceLinks.length} trace links validated
      </div>
    </div>
  )

  if (isPanel) {
    return content
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[800px] h-[80vh] flex flex-col">
        {content}
      </div>
    </div>
  )
}
