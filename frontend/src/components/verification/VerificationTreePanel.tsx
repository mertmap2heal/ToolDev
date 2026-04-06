import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  FolderTree,
  FileText,
  CheckCircle,
  Settings,
  Play,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
  Trash2,
  Unlink,
  Inbox,
  Edit2,
  GitPullRequest,
  AlertCircle,
  BarChart3,
  Copy,
  Link2,
  ExternalLink,
  Download,
} from 'lucide-react'
import clsx from 'clsx'
import { VERIFICATION_NODE_TYPE_TO_TAB } from '../../config/verificationTabs'

// Node types for tree (keep in sync with VerificationNodeType in config/verificationTabs.ts)
export type VerNodeType = 'test-plan' | 'test-case' | 'test-setup' | 'test-run' | 'requirement' | 'unassigned-group' | 'plan-requirements-group'

export interface VerTreeNode {
  type: VerNodeType
  id: string
  planId?: string
  label: string
  key?: string
  status?: string
  children?: VerTreeNode[]
  /** For requirement nodes: link sourceId (requirement id) */
  requirementId?: string
  caseId?: string
}

/** Link-like shape for requirement–test-case links (sourceType=requirement, targetType=test_case) */
export interface RequirementTestCaseLinkLike {
  id?: string
  sourceId: string
  targetId: string
  sourceTitle?: string
  sourceDisplayId?: string
}

/** Link-like shape for linked elements under a requirement (e.g. issues, change requests) */
export interface VerLinkLike {
  id?: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  targetLabel?: string
  targetTitle?: string
  targetDisplayId?: string
  sourceTitle?: string
  sourceDisplayId?: string
  sourceLabel?: string
  linkType?: string
  _displayTargetType?: string
}

export interface VerLinkedElementClickPayload {
  targetType: string
  targetId: string
  sourceType: string
  sourceId: string
  isOutgoing: boolean
  link: VerLinkLike
}

export interface VerificationTreePanelProps {
  projectId: string
  plans: Array<{
    id: string
    name: string
    key?: string
    status?: string
    planCases?: Array<{ id?: string; key?: string; title?: string; testCaseId?: string; testCase?: { id: string; key?: string; title?: string } }>
    linkedSetups?: string[]
    planSetups?: Array<{ id: string; name?: string }>
  }>
  testCases: Array<{ id: string; key?: string; title?: string; status?: string; linkedSetupIds?: string[]; setupIds?: string[] }>
  testSetups: Array<{ id: string; name?: string; status?: string }>
  runsByPlanId: Record<string, Array<{ id: string; runName?: string; status?: string }>>
  selectedNode: { type: VerNodeType; id: string } | null
  onSelect: (node: { type: VerNodeType; id: string } | null) => void
  onCreatePlan: () => void
  onCreateCase: (planId: string) => void
  onCreateSetup: (planId: string) => void
  onCreateRun: (planId: string) => void
  onDeletePlan: (planId: string) => void
  onDeleteCase: (caseId: string) => void
  onDeleteSetup: (setupId: string) => void
  onDeleteRun: (runId: string) => void
  onRemoveCaseFromPlan: (planId: string, caseId: string) => void
  onRemoveSetupFromPlan?: (planId: string, setupId: string) => void
  onAddCaseToPlan: (planId: string, caseId: string) => void
  onAddSetupToPlan?: (planId: string, setupId: string) => void
  /** Optional: show requirements under test cases and allow link/unlink */
  requirementTestCaseLinks?: RequirementTestCaseLinkLike[]
  onAddRequirementToTestCase?: (caseId: string) => void
  onRemoveRequirementFromTestCase?: (reqId: string, caseId: string) => void
  onRequirementClick?: (reqId: string) => void
  onDropRequirementsOnTestCase?: (requirementIds: string[], caseId: string) => void
  /** Optional: list of all requirements to show "Unassigned requirements" section (requirements not linked to any test case) */
  requirements?: Array<{ id: string; title?: string; requirementId?: string; isLocked?: boolean }>
  /** Optional: requirement-level actions (parity with PBS/Functions tree) */
  onEditRequirement?: (reqId: string) => void
  onCreateChangeRequest?: (reqId: string) => void
  onCreateIssue?: (reqId: string) => void
  onOpenTraceabilityMatrix?: (focusReqId?: string) => void
  /** Optional: open traceability matrix focused to a test case */
  onOpenTraceabilityMatrixForCase?: (caseId: string) => void
  /** Optional: show linked elements under requirement nodes (issues, CRs, etc.) */
  getLinksForRequirement?: (reqId: string) => VerLinkLike[]
  onLinkedElementClick?: (payload: VerLinkedElementClickPayload) => void
  /** Optional: remove a link (parity with PBS/Functions tree for linked elements) */
  onRemoveLink?: (linkId: string) => void
  /** Optional: export requirements for a test plan (parity with PBS/Functions Export for component/function) */
  onExportForPlan?: (planId: string, planName?: string) => void
  /** Optional: export requirements for a test case */
  onExportForTestCase?: (caseId: string, caseName?: string) => void
  /** Optional: open Verification page with focus on plan or case (parity with PBS/Functions "Open in PBS/Functions page") */
  onOpenInVerificationPage?: (nodeType: 'test-plan' | 'test-case', id: string) => void
}

/** Re-export from single source of truth (config) for node-type -> tab mapping. */
const TAB_MAP = VERIFICATION_NODE_TYPE_TO_TAB as Record<VerNodeType, string>

function buildTree(
  plans: VerificationTreePanelProps['plans'],
  testCases: VerificationTreePanelProps['testCases'],
  testSetups: VerificationTreePanelProps['testSetups'],
  runsByPlanId: Record<string, Array<{ id: string; runName?: string; status?: string }>>,
  searchQuery: string,
  requirementTestCaseLinks?: RequirementTestCaseLinkLike[],
  requirements?: Array<{ id: string; title?: string; requirementId?: string }>
): VerTreeNode[] {
  const q = searchQuery.trim().toLowerCase()
  // Build test-case lookup maps from BOTH:
  //  - the `testCases` prop
  //  - and the test cases nested under each plan's `planCases[].testCase`
  // This prevents cases where `testCases` prop is empty while plans still contain test-case objects,
  // which would otherwise break linking resolution (traceLinks.targetId -> visible test-case node).
  const planTestCases = plans
    .flatMap((p) => (p.planCases ?? []).map((pc: any) => pc?.testCase).filter(Boolean)) as Array<{
    id: string
    key?: string
    title?: string
    status?: string
  }>
  const allTestCasesForMap = [...testCases, ...planTestCases]

  const caseMap = new Map(allTestCasesForMap.map((c) => [c.id, c]))
  const caseKeyToId = new Map<string, string>()
  for (const c of allTestCasesForMap) {
    const key = (c as { key?: string }).key
    if (key) caseKeyToId.set(key, c.id)
  }
  const setupMap = new Map(testSetups.map((s) => [s.id, s]))
  const knownCaseIds = new Set(caseMap.keys())
  const reqLinksByCaseIdStable = requirementTestCaseLinks?.length
    ? (() => {
        const m = new Map<string, RequirementTestCaseLinkLike[]>()
        const targetIdToCaseId = (targetId: string): string | null => {
          const c = caseMap.get(targetId)
          if (c && (c as { id?: string }).id) return (c as { id: string }).id
          const byKey = caseKeyToId.get(targetId)
          if (byKey) return byKey
          const byKeyLower = caseKeyToId.get(targetId.toLowerCase())
          if (byKeyLower) return byKeyLower
          const str = String(targetId)
          for (const tc of allTestCasesForMap) {
            const id = (tc as { id: string }).id
            const key = (tc as { key?: string }).key
            if (id === targetId || id === str || key === targetId || key === str) return id
          }
          return null
        }
        for (const link of requirementTestCaseLinks) {
          const treeCaseId = targetIdToCaseId(link.targetId) ?? link.targetId
          const list = m.get(treeCaseId) ?? []
          list.push(link)
          m.set(treeCaseId, list)
        }
        return m
      })()
    : new Map<string, RequirementTestCaseLinkLike[]>()

  const linkedRequirementIds = new Set(
    (() => {
      const ids = new Set<string>()
      reqLinksByCaseIdStable.forEach((links) => links.forEach((l) => ids.add(l.sourceId)))
      return ids
    })()
  )
  const unassignedReqs =
    requirements?.filter(
      (r) =>
        !linkedRequirementIds.has(r.id) &&
        (!q ||
          r.title?.toLowerCase().includes(q) ||
          r.requirementId?.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q))
    ) ?? []

  const planNodes = plans
    .filter((plan) => !q || (plan.name?.toLowerCase().includes(q) || plan.key?.toLowerCase().includes(q)))
    .map((plan) => {
      const rawCases = plan.planCases ?? []
      const planCaseIds = rawCases.map((pc: any) =>
        pc?.testCase?.id ?? pc?.testCaseId ?? (typeof pc === 'object' && pc !== null && 'id' in pc ? pc.id : (pc as string))
      )
      let planSetupIds: string[] = Array.isArray(plan.linkedSetups)
        ? [...plan.linkedSetups]
        : (plan.planSetups ?? []).map((ps) => (typeof ps === 'object' && ps !== null && 'id' in ps ? ps.id : (ps as string)))
      if (planSetupIds.length === 0 && planCaseIds.length > 0) {
        const derived: string[] = []
        planCaseIds.forEach((cid) => {
          const c = caseMap.get(cid)
          const ids = ((c as any)?.linkedSetupIds ?? (c as any)?.setupIds ?? []) as string[]
          ids.forEach((sid) => {
            if (!derived.includes(sid)) derived.push(sid)
          })
        })
        planSetupIds = derived
      }
      const runs = runsByPlanId[plan.id] ?? []

      const caseNodes: VerTreeNode[] = planCaseIds
        .map((cid) => {
          const pc = rawCases.find((p: any) => (p.testCase?.id ?? p.testCaseId ?? p.id) === cid)
          const c = caseMap.get(cid) ?? pc?.testCase ?? (plan.planCases ?? []).find((p: any) => p.id === cid)
          if (!c) return null
          const caseId = (c as any).id ?? cid
          const label = (c as any).title ?? (c as any).name ?? c.id
          const key = (c as any).key
          if (q && !label?.toLowerCase().includes(q) && !key?.toLowerCase().includes(q)) return null
          // Use the original `cid` (from plan.planCases) as the first lookup key.
          // In practice, `caseId` can be a different resolved identifier, which can cause linked requirements
          // to render under the plan-level requirements group but not under the test-case node.
          const reqLinks = reqLinksByCaseIdStable.get(cid) ?? reqLinksByCaseIdStable.get(caseId) ?? []
          const requirementChildren: VerTreeNode[] = reqLinks.map((link) => ({
            type: 'requirement' as const,
            id: `req-${link.sourceId}-${caseId}`,
            label: link.sourceTitle ?? link.sourceDisplayId ?? link.sourceId.slice(0, 8),
            requirementId: link.sourceId,
            caseId,
          }))
          return {
            type: 'test-case' as const,
            id: caseId,
            planId: plan.id,
            label,
            key,
            status: (c as any).status,
            children: requirementChildren.length > 0 ? requirementChildren : undefined,
          }
        })
        .filter(Boolean) as VerTreeNode[]

      const setupNodes: VerTreeNode[] = planSetupIds
        .map((sid) => {
          const s = setupMap.get(sid)
          if (!s) return null
          const label = s.name ?? sid
          if (q && !label.toLowerCase().includes(q)) return null
          return {
            type: 'test-setup' as const,
            id: s.id,
            planId: plan.id,
            label,
            status: s.status,
            children: undefined,
          }
        })
        .filter(Boolean) as VerTreeNode[]

      const runNodes: VerTreeNode[] = runs
        .map((r) => {
          const label = r.runName ?? r.id
          if (q && !label.toLowerCase().includes(q)) return null
          return {
            type: 'test-run' as const,
            id: r.id,
            planId: plan.id,
            label,
            status: r.status,
            children: undefined,
          }
        })
        .filter(Boolean) as VerTreeNode[]

      const planReqLinks: RequirementTestCaseLinkLike[] = []
      const seenReqIds = new Set<string>()
      for (const cid of planCaseIds) {
        const links = reqLinksByCaseIdStable.get(cid) ?? []
        for (const link of links) {
          if (!seenReqIds.has(link.sourceId)) {
            seenReqIds.add(link.sourceId)
            planReqLinks.push(link)
          }
        }
      }
      const planRequirementsNode: VerTreeNode | null =
        planReqLinks.length > 0
          ? {
              type: 'plan-requirements-group',
              id: `plan-reqs-${plan.id}`,
              planId: plan.id,
              label: 'Requirements',
              children: planReqLinks.map((link) => ({
                type: 'requirement' as const,
                id: `req-plan-${link.sourceId}-${plan.id}`,
                requirementId: link.sourceId,
                label: link.sourceTitle ?? link.sourceDisplayId ?? link.sourceId.slice(0, 8),
                caseId: undefined,
              })),
            }
          : null

      const children: VerTreeNode[] = [
        ...(planRequirementsNode ? [planRequirementsNode] : []),
        ...caseNodes,
        ...setupNodes,
        ...runNodes,
      ]
      const matchesSearch = !q || children.length > 0 || plan.name?.toLowerCase().includes(q) || plan.key?.toLowerCase().includes(q)
      if (q && !matchesSearch) return null as any

      return {
        type: 'test-plan',
        id: plan.id,
        label: plan.name ?? plan.id,
        key: plan.key,
        status: plan.status,
        children: children.length ? children : undefined,
      }
    })
    .filter(Boolean) as VerTreeNode[]

  const allPlanCaseIds = new Set<string>()
  for (const plan of plans) {
    const rawCases = plan.planCases ?? []
    const planCaseIds = rawCases.map((pc: any) =>
      pc?.testCase?.id ?? pc?.testCaseId ?? (typeof pc === 'object' && pc !== null && 'id' in pc ? pc.id : (pc as string))
    )
    for (const cid of planCaseIds) {
      const c = caseMap.get(cid)
      const caseId = (c as { id?: string })?.id ?? caseKeyToId.get(cid) ?? caseKeyToId.get(String(cid).toLowerCase()) ?? cid
      if (knownCaseIds.has(caseId)) allPlanCaseIds.add(caseId)
    }
  }
  const caseIdsWithLinksNotInPlan = requirementTestCaseLinks?.length
    ? [...reqLinksByCaseIdStable.keys()].filter((cid) => !allPlanCaseIds.has(cid) && caseMap.has(cid))
    : []
  const otherTestCasesNode: VerTreeNode | null =
    caseIdsWithLinksNotInPlan.length > 0
      ? {
          type: 'test-plan',
          id: '_other_cases_with_links',
          planId: undefined,
          label: `Other test cases (${caseIdsWithLinksNotInPlan.length})`,
          children: caseIdsWithLinksNotInPlan
            .map((caseId) => {
              const c = caseMap.get(caseId)!
              const label = (c as { title?: string; name?: string }).title ?? (c as { name?: string }).name ?? (c as { id: string }).id
              const key = (c as { key?: string }).key
              const reqLinks = reqLinksByCaseIdStable.get(caseId) ?? []
              const requirementChildren: VerTreeNode[] = reqLinks.map((link) => ({
                type: 'requirement' as const,
                id: `req-${link.sourceId}-${caseId}`,
                label: link.sourceTitle ?? link.sourceDisplayId ?? link.sourceId.slice(0, 8),
                requirementId: link.sourceId,
                caseId,
              }))
              return {
                type: 'test-case' as const,
                id: caseId,
                planId: undefined,
                label,
                key,
                status: (c as { status?: string }).status,
                children: requirementChildren.length > 0 ? requirementChildren : undefined,
              }
            }) as VerTreeNode[],
        }
      : null

  const unassignedNode: VerTreeNode | null =
    requirements != null
      ? {
          type: 'unassigned-group',
          id: 'unassigned',
          label: `Unassigned (${unassignedReqs.length})`,
          children:
            unassignedReqs.length > 0
              ? unassignedReqs.map((r) => ({
                  type: 'requirement' as const,
                  id: `req-unassigned-${r.id}`,
                  requirementId: r.id,
                  label: r.title ?? r.requirementId ?? r.id.slice(0, 8),
                  caseId: undefined,
                }))
              : [],
        }
      : null

  // Plans first, then other cases with links, then Unassigned last (UX: keep "catch-all" at bottom).
  const roots: VerTreeNode[] = []
  roots.push(...planNodes)
  if (otherTestCasesNode && (otherTestCasesNode.children?.length ?? 0) > 0) roots.push(otherTestCasesNode)
  if (unassignedNode) roots.push(unassignedNode)
  return roots
}

const STATUS_DOT: Record<string, string> = {
  APPROVED: 'bg-green-500',
  READY: 'bg-green-500',
  COMPLETED: 'bg-green-500',
  PASS: 'bg-green-500',
  IN_PROGRESS: 'bg-yellow-500',
  REVIEWED: 'bg-blue-500',
  DRAFT: 'bg-gray-400',
  PLANNED: 'bg-gray-400',
  NOT_RUN: 'bg-gray-400',
  SKIPPED: 'bg-gray-400',
  FAIL: 'bg-red-500',
  FAILED: 'bg-red-500',
  ABORTED: 'bg-red-500',
  BLOCKED: 'bg-yellow-500',
}

export default function VerificationTreePanel({
  projectId,
  plans,
  testCases,
  testSetups,
  runsByPlanId,
  selectedNode,
  onSelect,
  onCreatePlan,
  onCreateCase,
  onCreateSetup,
  onCreateRun,
  onDeletePlan,
  onDeleteCase,
  onDeleteSetup,
  onDeleteRun,
  onRemoveCaseFromPlan,
  onRemoveSetupFromPlan,
  onAddCaseToPlan,
  onAddSetupToPlan,
  requirementTestCaseLinks,
  onAddRequirementToTestCase,
  onRemoveRequirementFromTestCase,
  onRequirementClick,
  onDropRequirementsOnTestCase,
  requirements,
  onEditRequirement,
  onCreateChangeRequest,
  onCreateIssue,
  onOpenTraceabilityMatrix,
  onOpenTraceabilityMatrixForCase,
  getLinksForRequirement,
  onLinkedElementClick,
  onRemoveLink,
  onExportForPlan,
  onExportForTestCase,
  onOpenInVerificationPage,
}: VerificationTreePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showBadges, setShowBadges] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedRequirementIds, setExpandedRequirementIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ node: VerTreeNode; x: number; y: number } | null>(null)
  const [linkedElementContextMenu, setLinkedElementContextMenu] = useState<{
    link: VerLinkLike
    payload: VerLinkedElementClickPayload
    x: number
    y: number
  } | null>(null)
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set())
  const [dragOverPlanId, setDragOverPlanId] = useState<string | null>(null)
  const [dragOverCaseId, setDragOverCaseId] = useState<string | null>(null)
  const dragNodeRef = useRef<VerTreeNode | null>(null)
  const hasAutoExpandedCasesRef = useRef(false)
  const treeScrollRef = useRef<HTMLDivElement>(null)

  const tree = useMemo(
    () =>
      buildTree(
        plans,
        testCases,
        testSetups,
        runsByPlanId,
        searchQuery,
        requirementTestCaseLinks,
        requirements
      ),
    [plans, testCases, testSetups, runsByPlanId, searchQuery, requirementTestCaseLinks, requirements]
  )

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        return true
      } catch {
        return false
      }
    }
  }, [])

  const buildDeepLink = useCallback((node: VerTreeNode): string | null => {
    if (node.type === 'requirement') {
      if (!node.requirementId) return null
      return `${window.location.origin}/projects/${projectId}/requirements?requirementId=${node.requirementId}`
    }
    const tab = TAB_MAP[node.type]
    if (!tab) return null
    const qs = new URLSearchParams()
    qs.set('tab', tab)
    qs.set('focusType', node.type)
    qs.set('focusId', node.id)
    return `${window.location.origin}/projects/${projectId}/verification?${qs.toString()}`
  }, [projectId])

  const handleCopyDeepLink = useCallback(async (node: VerTreeNode) => {
    const url = buildDeepLink(node)
    if (!url) return
    await copyText(url)
  }, [buildDeepLink, copyText])

  const allPlanIds = useMemo(() => tree.map((n) => n.id), [tree])
  const unassignedNodeInTree = useMemo(() => tree.find((n) => n.type === 'unassigned-group') ?? null, [tree])
  const unassignedCount = unassignedNodeInTree?.children?.length ?? 0
  const jumpToUnassigned = useCallback(() => {
    treeScrollRef.current?.querySelector('[data-node-id="unassigned"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const allExpandableIds = useMemo(() => {
    const ids: string[] = []
    const caseExpandable = !!(onDropRequirementsOnTestCase || onAddRequirementToTestCase)
    tree.forEach((plan) => {
      if (plan.type === 'unassigned-group') {
        ids.push(plan.id)
      } else if (plan.type === 'test-plan') {
        ids.push(plan.id)
        ;(plan.children ?? []).forEach((child) => {
          if (child.type === 'plan-requirements-group' && (child.children?.length ?? 0) > 0) ids.push(child.id)
          if (child.type === 'test-case' && ((child.children?.length ?? 0) > 0 || caseExpandable)) ids.push(child.id)
        })
      }
    })
    return ids
  }, [tree, onDropRequirementsOnTestCase, onAddRequirementToTestCase])

  useEffect(() => {
    if (hasAutoExpandedCasesRef.current) return
    const toExpand: string[] = []
    tree.forEach((root) => {
      if (root.type === 'unassigned-group') {
        toExpand.push(root.id)
      }
      if (root.type === 'test-plan' && root.children) {
        root.children.forEach((child) => {
          if (child.type === 'test-case' && (child.children?.length ?? 0) > 0) toExpand.push(child.id)
        })
      }
    })
    const hasUnassigned = tree.some((r) => r.type === 'unassigned-group')
    if (hasUnassigned && !toExpand.includes('unassigned')) toExpand.push('unassigned')
    if (toExpand.length === 0) return
    hasAutoExpandedCasesRef.current = true
    setExpandedIds((prev) => {
      const next = new Set(prev)
      toExpand.forEach((id) => next.add(id))
      return next
    })
  }, [tree])
  const effectiveExpanded = searchQuery.trim() ? new Set(allExpandableIds) : expandedIds

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (allExpanded) setExpandedIds(new Set())
    else setExpandedIds(new Set(allExpandableIds))
    setAllExpanded(!allExpanded)
  }, [allExpanded, allExpandableIds])

  const toggleRequirementExpand = useCallback((reqId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRequirementIds((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

  const isExpandableNode = useCallback((node: VerTreeNode) => {
    if (node.type === 'unassigned-group') return true
    if (node.type === 'test-plan') return (node.children?.length ?? 0) > 0
    if (node.type === 'plan-requirements-group') return (node.children?.length ?? 0) > 0
    if (node.type === 'test-case') return (node.children?.length ?? 0) > 0 || !!(onDropRequirementsOnTestCase || onAddRequirementToTestCase)
    return false
  }, [onDropRequirementsOnTestCase, onAddRequirementToTestCase])

  const handleSelect = useCallback(
    (node: VerTreeNode, e: React.MouseEvent) => {
      e.stopPropagation()
      if (node.type === 'unassigned-group') {
        setMultiSelectedIds(new Set())
        onSelect({ type: 'unassigned-group', id: node.id })
        return
      }
      if (node.type === 'requirement' && node.requirementId) {
        onRequirementClick?.(node.requirementId)
        return
      }
      if ((e as any).ctrlKey || (e as any).metaKey) {
        setMultiSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(node.id)) next.delete(node.id)
          else next.add(node.id)
          return next
        })
      } else {
        setMultiSelectedIds(new Set())
        onSelect({ type: node.type, id: node.id })
      }
    },
    [onSelect, onRequirementClick]
  )

  const handleRowClick = useCallback(
    (node: VerTreeNode, e: React.MouseEvent) => {
      if (node.type === 'requirement' && node.requirementId) {
        handleSelect(node, e)
        return
      }
      if (node.type === 'unassigned-group') {
        toggleExpand(node.id, e)
        handleSelect(node, e)
        return
      }
      if (isExpandableNode(node)) {
        toggleExpand(node.id, e)
        return
      }
      handleSelect(node, e)
    },
    [handleSelect, isExpandableNode, toggleExpand]
  )

  const handleRowDoubleClick = useCallback(
    (node: VerTreeNode, e: React.MouseEvent) => {
      e.stopPropagation()
      if (node.type === 'requirement' || node.type === 'plan-requirements-group') return
      if (node.type === 'unassigned-group') {
        setMultiSelectedIds(new Set())
        onSelect({ type: 'unassigned-group', id: node.id })
        return
      }
      setMultiSelectedIds(new Set())
      onSelect({ type: node.type, id: node.id })
    },
    [onSelect]
  )

  const handleContextMenu = useCallback((node: VerTreeNode, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ node, x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    const close = () => {
      setContextMenu(null)
      setLinkedElementContextMenu(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const handleDragStart = useCallback((node: VerTreeNode, e: React.DragEvent) => {
    if (node.type !== 'test-case' && node.type !== 'test-setup') return
    dragNodeRef.current = node
    e.dataTransfer.setData('application/ver-node', JSON.stringify({ type: node.type, id: node.id }))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((planId: string, e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/ver-node')
    if (!data) return
    try {
      const { type } = JSON.parse(data)
      if (type === 'test-case' || type === 'test-setup') e.dataTransfer.dropEffect = 'move'
      setDragOverPlanId(planId)
    } catch {
      setDragOverPlanId(null)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverPlanId(null)
  }, [])

  const handleDrop = useCallback(
    (planId: string, e: React.DragEvent) => {
      e.preventDefault()
      setDragOverPlanId(null)
      const data = e.dataTransfer.getData('application/ver-node')
      if (!data) return
      try {
        const { type, id } = JSON.parse(data)
        if (type === 'test-case') onAddCaseToPlan(planId, id)
        else if (type === 'test-setup' && onAddSetupToPlan) onAddSetupToPlan(planId, id)
      } catch {
        // ignore
      }
      dragNodeRef.current = null
    },
    [onAddCaseToPlan, onAddSetupToPlan]
  )

  const handleRequirementDragOver = useCallback((caseId: string, e: React.DragEvent) => {
    if (!onDropRequirementsOnTestCase) return
    const ids = e.dataTransfer.getData('application/requirement-ids')
    if (!ids) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'link'
    setDragOverCaseId(caseId)
  }, [onDropRequirementsOnTestCase])

  const handleRequirementDragLeave = useCallback(() => {
    setDragOverCaseId(null)
  }, [])

  const handleRequirementDrop = useCallback(
    (caseId: string, e: React.DragEvent) => {
      e.preventDefault()
      setDragOverCaseId(null)
      if (!onDropRequirementsOnTestCase) return
      try {
        const ids = e.dataTransfer.getData('application/requirement-ids')
        if (ids) {
          const arr = JSON.parse(ids) as string[]
          if (Array.isArray(arr) && arr.length) onDropRequirementsOnTestCase(arr, caseId)
        }
      } catch {
        // ignore
      }
    },
    [onDropRequirementsOnTestCase]
  )

  const renderNode = (node: VerTreeNode, depth: number): React.ReactNode => {
    const isPlan = node.type === 'test-plan'
    const isCase = node.type === 'test-case'
    const isRequirement = node.type === 'requirement'
    const isUnassignedGroup = node.type === 'unassigned-group'
    const isPlanRequirementsGroup = node.type === 'plan-requirements-group'
    const hasChildren = (isPlan || isCase || isUnassignedGroup || isPlanRequirementsGroup) && (node.children?.length ?? 0) > 0
    const isExpanded = (isPlan || isCase || isUnassignedGroup || isPlanRequirementsGroup) && effectiveExpanded.has(node.id)
    const reqLinks = isRequirement && node.requirementId && getLinksForRequirement ? getLinksForRequirement(node.requirementId) : []
    const hasReqLinks = reqLinks.length > 0
    const showReqExpand = isRequirement && hasReqLinks && !!onLinkedElementClick
    const isReqExpanded = isRequirement && node.requirementId ? expandedRequirementIds.has(node.requirementId) : false
    const isSelected =
      !isRequirement &&
      !isPlanRequirementsGroup &&
      selectedNode?.type === node.type &&
      selectedNode?.id === node.id
    const isMultiSelected = multiSelectedIds.has(node.id)
    const isDropTargetPlan = isPlan && dragOverPlanId === node.id
    const isDropTargetCase = isCase && onDropRequirementsOnTestCase && dragOverCaseId === node.id
    const isDropTarget = isDropTargetPlan || isDropTargetCase

    const Icon =
      node.type === 'test-plan'
        ? FileText
        : node.type === 'test-case'
          ? CheckCircle
          : node.type === 'test-setup'
            ? Settings
            : node.type === 'test-run'
              ? Play
              : node.type === 'unassigned-group'
                ? Inbox
                : node.type === 'plan-requirements-group'
                  ? FileText
                  : FileText

    const statusDot = node.status && STATUS_DOT[node.status] ? STATUS_DOT[node.status] : 'bg-gray-400'
    const showExpand =
      (isPlan && hasChildren) ||
      isUnassignedGroup ||
      (isPlanRequirementsGroup && hasChildren) ||
      (isCase && (hasChildren || !!onDropRequirementsOnTestCase || !!onAddRequirementToTestCase))
    const canDropRequirement = isCase && !!onDropRequirementsOnTestCase

    return (
      <div key={`${node.type}-${node.id}`}>
        <div
          className={clsx(
            'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-150 text-sm',
            isSelected && 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400/50',
            isMultiSelected && !isSelected && 'bg-blue-50 dark:bg-blue-900/20',
            isDropTarget && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30',
            !isSelected && !isMultiSelected && !isDropTarget && 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={(e) => handleRowClick(node, e)}
          onDoubleClick={(e) => handleRowDoubleClick(node, e)}
          onContextMenu={(e) => handleContextMenu(node, e)}
          draggable={!isRequirement && (node.type === 'test-case' || node.type === 'test-setup')}
          onDragStart={!isRequirement ? (e) => handleDragStart(node, e) : undefined}
          onDragOver={
            isPlan
              ? (e) => handleDragOver(node.id, e)
              : canDropRequirement
                ? (e) => handleRequirementDragOver(node.id, e)
                : undefined
          }
          onDragLeave={isPlan ? handleDragLeave : canDropRequirement ? handleRequirementDragLeave : undefined}
          onDrop={
            isPlan
              ? (e) => handleDrop(node.id, e)
              : canDropRequirement
                ? (e) => handleRequirementDrop(node.id, e)
                : undefined
          }
          data-node-type={node.type}
          data-node-id={node.id}
          data-droppable={isPlan ? 'plan' : canDropRequirement ? 'test-case' : undefined}
        >
          {showReqExpand ? (
            <button
              type="button"
              onClick={(e) => toggleRequirementExpand(node.requirementId!, e)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
            >
              {isReqExpanded ? (
                <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-500 dark:text-gray-400" />
              )}
            </button>
          ) : showExpand ? (
            <button
              onClick={(e) => toggleExpand(node.id, e)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-500 dark:text-gray-400" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <Icon size={14} className="flex-shrink-0 text-gray-500 dark:text-gray-400" />
          {node.key && (
            <span className="flex-shrink-0 text-[10px] font-mono text-gray-400 dark:text-gray-500">{node.key}</span>
          )}
          <span className={clsx('truncate flex-1', (isSelected || isMultiSelected) && 'font-medium')}>{node.label}</span>
          {showBadges && (isPlan || isCase) && (
            <span className="flex items-center gap-1.5 flex-shrink-0">
              {isPlan && (
                <>
                  <span
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300"
                    title="Test cases in plan"
                  >
                    {node.children?.filter((c) => c.type === 'test-case').length ?? 0} C
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300"
                    title="Setups in plan"
                  >
                    {node.children?.filter((c) => c.type === 'test-setup').length ?? 0} S
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300"
                    title="Runs for plan"
                  >
                    {node.children?.filter((c) => c.type === 'test-run').length ?? 0} R
                  </span>
                </>
              )}
              {isCase && (
                <>
                  <span
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300"
                    title="Requirements verified by this case"
                  >
                    {node.children?.filter((c) => c.type === 'requirement').length ?? 0} Req
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300"
                    title="Linked setups"
                  >
                    {node.children?.filter((c) => c.type === 'test-setup').length ?? 0} S
                  </span>
                </>
              )}
            </span>
          )}
          {node.status && !isRequirement && (
            <span className={clsx('flex-shrink-0 w-2 h-2 rounded-full', statusDot)} title={node.status} />
          )}
        </div>

        {(isPlan || isCase || isUnassignedGroup || isPlanRequirementsGroup) && isExpanded && hasChildren && node.children && (
          <div className="relative">
            <div
              className="absolute top-0 bottom-0 border-l border-gray-200 dark:border-gray-700"
              style={{ left: `${depth * 20 + 18}px` }}
            />
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
        {isCase && isExpanded && !hasChildren && (onDropRequirementsOnTestCase || onAddRequirementToTestCase) && (
          <div
            className="text-xs text-gray-400 dark:text-gray-500 italic"
            style={{ paddingLeft: `${depth * 20 + 28}px` }}
          >
            No linked requirements — drag a requirement here or use context menu → Link requirement.
          </div>
        )}
        {isUnassignedGroup && isExpanded && (!node.children || node.children.length === 0) && (
          <div
            className="text-xs text-gray-400 dark:text-gray-500 italic"
            style={{ paddingLeft: `${depth * 20 + 28}px` }}
          >
            No unassigned requirements. All requirements are linked to test cases.
          </div>
        )}
        {isRequirement && node.requirementId && isReqExpanded && reqLinks.length > 0 && onLinkedElementClick && (
          <div className="relative">
            <div
              className="absolute top-0 bottom-0 border-l border-gray-200 dark:border-gray-700"
              style={{ left: `${depth * 20 + 18}px` }}
            />
            {reqLinks.map((link) => {
              const isOutgoing = link.sourceType === 'requirement' && link.sourceId === node.requirementId
              const displayType = (link as VerLinkLike)._displayTargetType ?? (isOutgoing ? link.targetType : link.sourceType)
              const label = isOutgoing
                ? (link.targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? `${link.targetType}:${link.targetId.slice(0, 8)}`)
                : (link.sourceLabel ?? link.sourceTitle ?? link.sourceDisplayId ?? `${link.sourceType}:${link.sourceId.slice(0, 8)}`)
              const payload: VerLinkedElementClickPayload = {
                targetType: isOutgoing ? link.targetType : link.sourceType,
                targetId: isOutgoing ? link.targetId : link.sourceId,
                sourceType: link.sourceType,
                sourceId: link.sourceId,
                isOutgoing,
                link,
              }
              return (
                <div
                  key={link.id ?? `link-${link.sourceType}-${link.sourceId}-${link.targetType}-${link.targetId}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onLinkedElementClick(payload)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setLinkedElementContextMenu({ link, payload, x: e.clientX, y: e.clientY })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onLinkedElementClick(payload)
                    }
                  }}
                  className="flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 border-l-2 border-gray-200 dark:border-gray-700 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
                  title="Click to preview"
                >
                  <Link2 size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0 capitalize">
                    {String(displayType).replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 truncate">{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100%-1rem)] m-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-1 justify-end mb-2">
            <button
              onClick={toggleAll}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title={allExpanded ? 'Collapse all' : 'Expand all'}
            >
              {allExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setShowBadges((v) => !v)}
              className={clsx(
                'p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700',
                showBadges ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              )}
              title={showBadges ? 'Hide relationship badges' : 'Show relationship badges'}
            >
              <BarChart3 size={14} />
            </button>
            <button
              onClick={onCreatePlan}
              className="p-1.5 rounded hover:bg-teal-100 dark:hover:bg-teal-900/30 text-teal-600 dark:text-teal-400"
              title="New test plan"
            >
              <Plus size={14} />
            </button>
          </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plans, cases..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl
              bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
              placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {requirements != null && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Unassigned: {unassignedCount}</span>
            <button
              type="button"
              onClick={jumpToUnassigned}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              Jump to Unassigned
            </button>
          </div>
        )}
      </div>

      <div ref={treeScrollRef} className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            <FolderTree className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">
              {searchQuery ? 'No items match your search.' : 'No test plans yet.'}
            </p>
            {!searchQuery && (
              <>
                <p className="mt-1 text-xs opacity-70">Create a test plan from the Verification page or use the button above.</p>
                <button
                  type="button"
                  onClick={onCreatePlan}
                  className="mt-3 px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1.5 mx-auto"
                >
                  <Plus size={14} />
                  Create first test plan
                </button>
              </>
            )}
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {(onDropRequirementsOnTestCase || onAddRequirementToTestCase) && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-center text-gray-400 dark:text-gray-500">
          Drag requirements onto test cases to link them
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'test-plan' && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleCopyDeepLink(contextMenu.node)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <ExternalLink size={14} />
                Copy deep link
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateCase(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Plus size={14} />
                Create test case
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateSetup(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Plus size={14} />
                Create test setup
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateRun(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Play size={14} />
                Create test run
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              {onOpenInVerificationPage && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInVerificationPage('test-plan', contextMenu.node.id)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <ExternalLink size={14} />
                  Open in Verification page
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Copy size={14} />
                Copy plan ID
              </button>
              {onExportForPlan && (
                <button
                  type="button"
                  onClick={() => {
                    onExportForPlan(contextMenu.node.id, contextMenu.node.label)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Download size={14} />
                  Export requirements for plan
                </button>
              )}
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this test plan?')) onDeletePlan(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
          {contextMenu.node.type === 'test-case' && contextMenu.node.planId && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleCopyDeepLink(contextMenu.node)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <ExternalLink size={14} />
                Copy deep link
              </button>
              {onOpenTraceabilityMatrixForCase && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTraceabilityMatrixForCase(contextMenu.node.id)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <BarChart3 size={14} />
                  Open traceability matrix
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: 'test-case', id: contextMenu.node.id })
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                Open
              </button>
              {onOpenInVerificationPage && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInVerificationPage('test-case', contextMenu.node.id)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <ExternalLink size={14} />
                  Open in Verification page
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Copy size={14} />
                Copy case ID
              </button>
              {onExportForTestCase && (
                <button
                  type="button"
                  onClick={() => {
                    onExportForTestCase(contextMenu.node.id, contextMenu.node.label)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Download size={14} />
                  Export requirements for test case
                </button>
              )}
              {onAddRequirementToTestCase && (
                <button
                  type="button"
                  onClick={() => {
                    onAddRequirementToTestCase(contextMenu.node.id)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Plus size={14} />
                  Link requirement
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onRemoveCaseFromPlan(contextMenu.node.planId!, contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Unlink size={14} />
                Unlink from plan
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this test case?')) onDeleteCase(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
          {contextMenu.node.type === 'test-setup' && contextMenu.node.planId && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleCopyDeepLink(contextMenu.node)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <ExternalLink size={14} />
                Copy deep link
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: 'test-setup', id: contextMenu.node.id })
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                Open
              </button>
              {onRemoveSetupFromPlan && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveSetupFromPlan(contextMenu.node.planId!, contextMenu.node.id)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Unlink size={14} />
                  Unlink from plan
                </button>
              )}
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this test setup?')) onDeleteSetup(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
          {contextMenu.node.type === 'requirement' && contextMenu.node.requirementId && !contextMenu.node.caseId && (() => {
            const reqMeta = requirements?.find((r) => r.id === contextMenu.node.requirementId)
            const isLocked = reqMeta?.isLocked ?? false
            return (
            <>
              <button
                type="button"
                onClick={() => {
                  handleCopyDeepLink(contextMenu.node)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <ExternalLink size={14} />
                Copy requirement link
              </button>
              <button
                type="button"
                onClick={() => {
                  onRequirementClick?.(contextMenu.node.requirementId!)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                Open
              </button>
              {onEditRequirement && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onEditRequirement(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Edit2 size={14} />
                  Edit requirement
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.requirementId!)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Copy size={14} />
                Copy requirement ID
              </button>
              {onCreateChangeRequest && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateChangeRequest(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <GitPullRequest size={14} />
                  Create change request
                </button>
              )}
              {onCreateIssue && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateIssue(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <AlertCircle size={14} />
                  Create issue
                </button>
              )}
              {onOpenTraceabilityMatrix && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTraceabilityMatrix(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <BarChart3 size={14} />
                  View in traceability matrix
                </button>
              )}
            </>
            )
          })()}
          {contextMenu.node.type === 'requirement' && contextMenu.node.requirementId && contextMenu.node.caseId && (() => {
            const reqMeta = requirements?.find((r) => r.id === contextMenu.node.requirementId)
            const isLocked = reqMeta?.isLocked ?? false
            return (
            <>
              <button
                type="button"
                onClick={() => {
                  onRequirementClick?.(contextMenu.node.requirementId!)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                Open
              </button>
              {onEditRequirement && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onEditRequirement(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Edit2 size={14} />
                  Edit requirement
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.requirementId!)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <Copy size={14} />
                Copy requirement ID
              </button>
              {onCreateChangeRequest && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateChangeRequest(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <GitPullRequest size={14} />
                  Create change request
                </button>
              )}
              {onCreateIssue && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateIssue(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <AlertCircle size={14} />
                  Create issue
                </button>
              )}
              {onOpenTraceabilityMatrix && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTraceabilityMatrix(contextMenu.node.requirementId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <BarChart3 size={14} />
                  View in traceability matrix
                </button>
              )}
              {onRemoveRequirementFromTestCase && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveRequirementFromTestCase(contextMenu.node.requirementId!, contextMenu.node.caseId!)
                    setContextMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <Unlink size={14} />
                  Unlink from test case
                </button>
              )}
            </>
            )
          })()}
          {contextMenu.node.type === 'test-run' && (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: 'test-run', id: contextMenu.node.id })
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                Open
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this test run?')) onDeleteRun(contextMenu.node.id)
                  setContextMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {linkedElementContextMenu && (
        <div
          className="fixed z-50 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[180px]"
          style={{ left: linkedElementContextMenu.x, top: linkedElementContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onLinkedElementClick?.(linkedElementContextMenu.payload)
              setLinkedElementContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
          >
            <ExternalLink size={14} />
            View target
          </button>
          {onRemoveLink && linkedElementContextMenu.link.id && (
            <button
              type="button"
              onClick={() => {
                onRemoveLink(linkedElementContextMenu.link.id!)
                setLinkedElementContextMenu(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left"
            >
              <Unlink size={14} />
              Remove link
            </button>
          )}
        </div>
      )}
    </div>
  )
}
