import React, { useRef, useMemo } from 'react'
import clsx from 'clsx'
import { PlayCircle } from 'lucide-react'

// Types needed for the component
interface LifecycleStep {
    id: string
    statusId: string
    order: number
}

interface TransitionRule {
    fromStatusId: string
    toStatusId: string
    allowedEngineeringRoleIds: string[]
}

interface StatusDefinition {
    id: string
    name: string
    description?: string
    color?: string
    type?: string
}

interface LifecycleFlowViewerProps {
    steps: LifecycleStep[]
    transitionRules: TransitionRule[]
    statuses: StatusDefinition[]
    currentStatusId?: string
    className?: string
}

type StepPos = { x: number; y: number }

type BackwardOrSkipArrow = {
    rule: TransitionRule
    idx: number
    fromPos: StepPos
    toPos: StepPos
    minX: number
    maxX: number
    offset?: number
    path?: string
}

type SequentialArrow = {
    rule: TransitionRule
    idx: number
    fromPos: StepPos
    toPos: StepPos
    path?: string
}

type SelfArrow = {
    rule: TransitionRule
    idx: number
    fromPos: StepPos
}

export function LifecycleFlowViewer({
    steps,
    transitionRules,
    statuses,
    currentStatusId,
    className
}: LifecycleFlowViewerProps) {
    const stepRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Sort steps by order
    const sortedSteps = useMemo(() => {
        return [...steps].sort((a, b) => a.order - b.order)
    }, [steps])

    // Smaller dimensions
    const STEP_WIDTH = 100
    const STEP_HEIGHT = 60
    const GAP = 16
    const PADDING_X = 12
    const PADDING_Y = 30
    const VERTICAL_OFFSET_BASE = 20
    const VERTICAL_OFFSET_STEP = 15

    // Calculate arrow paths
    const arrows = useMemo(() => {
        const getStepOrder = (statusId: string): number => {
            const step = steps.find(s => s.statusId === statusId)
            return step ? step.order : -1
        }

        const getTransitionType = (fromStatusId: string, toStatusId: string): 'forward' | 'backward' | 'self' => {
            if (fromStatusId === toStatusId) return 'self'
            const fromOrder = getStepOrder(fromStatusId)
            const toOrder = getStepOrder(toStatusId)
            if (fromOrder === -1 || toOrder === -1) return 'forward'
            return toOrder < fromOrder ? 'backward' : 'forward'
        }

        const isSequentialForward = (fromStatusId: string, toStatusId: string): boolean => {
            const fromStep = sortedSteps.find(s => s.statusId === fromStatusId)
            const toStep = sortedSteps.find(s => s.statusId === toStatusId)
            if (!fromStep || !toStep) return false
            return toStep.order === fromStep.order + 1
        }

        const getStepCenter = (stepIndex: number): StepPos => {
            const x = PADDING_X + (stepIndex * (STEP_WIDTH + GAP)) + (STEP_WIDTH / 2)
            const y = PADDING_Y + (STEP_HEIGHT / 2)
            return { x, y }
        }

        const backwardArrows: BackwardOrSkipArrow[] = []
        const forwardSkipArrows: BackwardOrSkipArrow[] = []
        const sequentialArrows: SequentialArrow[] = []
        const selfArrows: SelfArrow[] = []

        transitionRules.forEach((rule, idx) => {
            const fromStepIndex = sortedSteps.findIndex(s => s.statusId === rule.fromStatusId)
            const toStepIndex = sortedSteps.findIndex(s => s.statusId === rule.toStatusId)

            if (fromStepIndex === -1 || toStepIndex === -1) return

            const fromPos = getStepCenter(fromStepIndex)
            const toPos = getStepCenter(toStepIndex)

            const transitionType = getTransitionType(rule.fromStatusId, rule.toStatusId)

            if (transitionType === 'self') {
                selfArrows.push({ rule, idx, fromPos })
            } else if (transitionType === 'backward') {
                backwardArrows.push({
                    rule,
                    idx,
                    fromPos,
                    toPos,
                    minX: Math.min(fromPos.x, toPos.x),
                    maxX: Math.max(fromPos.x, toPos.x)
                })
            } else {
                if (isSequentialForward(rule.fromStatusId, rule.toStatusId)) {
                    sequentialArrows.push({ rule, idx, fromPos, toPos })
                } else {
                    forwardSkipArrows.push({
                        rule,
                        idx,
                        fromPos,
                        toPos,
                        minX: Math.min(fromPos.x, toPos.x),
                        maxX: Math.max(fromPos.x, toPos.x)
                    })
                }
            }
        })

        // Calculate vertical offsets for backward arrows
        backwardArrows.sort((a, b) => a.minX - b.minX)
        backwardArrows.forEach((arrow, i) => {
            let offset = VERTICAL_OFFSET_BASE
            for (let j = 0; j < i; j++) {
                const prev = backwardArrows[j]
                if (!(arrow.maxX < prev.minX || arrow.minX > prev.maxX)) {
                    offset = Math.max(offset, (prev.offset ?? 0) + VERTICAL_OFFSET_STEP)
                }
            }
            arrow.offset = offset
            arrow.path = `M ${arrow.fromPos.x} ${arrow.fromPos.y - STEP_HEIGHT / 2} L ${arrow.fromPos.x} ${arrow.fromPos.y - STEP_HEIGHT / 2 - offset} L ${arrow.toPos.x} ${arrow.fromPos.y - STEP_HEIGHT / 2 - offset} L ${arrow.toPos.x} ${arrow.toPos.y - STEP_HEIGHT / 2}`
        })

        // Calculate offsets for forward skip arrows
        forwardSkipArrows.sort((a, b) => a.minX - b.minX)
        forwardSkipArrows.forEach((arrow, i) => {
            let offset = VERTICAL_OFFSET_BASE
            for (let j = 0; j < i; j++) {
                const prev = forwardSkipArrows[j]
                if (!(arrow.maxX < prev.minX || arrow.minX > prev.maxX)) {
                    offset = Math.max(offset, (prev.offset ?? 0) + VERTICAL_OFFSET_STEP)
                }
            }
            arrow.offset = offset
            arrow.path = `M ${arrow.fromPos.x} ${arrow.fromPos.y + STEP_HEIGHT / 2} L ${arrow.fromPos.x} ${arrow.fromPos.y + STEP_HEIGHT / 2 + offset} L ${arrow.toPos.x} ${arrow.fromPos.y + STEP_HEIGHT / 2 + offset} L ${arrow.toPos.x} ${arrow.toPos.y + STEP_HEIGHT / 2}`
        })

        // Sequential arrows
        sequentialArrows.forEach(arrow => {
            const startX = arrow.fromPos.x + STEP_WIDTH / 2
            const endX = arrow.toPos.x - STEP_WIDTH / 2
            arrow.path = `M ${startX} ${arrow.fromPos.y} L ${endX} ${arrow.toPos.y}`
        })

        return { backwardArrows, forwardSkipArrows, sequentialArrows, selfArrows }
    }, [
        sortedSteps,
        transitionRules,
        steps,
        STEP_WIDTH,
        STEP_HEIGHT,
        GAP,
        PADDING_X,
        PADDING_Y,
        VERTICAL_OFFSET_BASE,
        VERTICAL_OFFSET_STEP,
    ])

    if (!steps || steps.length === 0) {
        return (
            <div className="p-4 text-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">No lifecycle steps defined.</p>
            </div>
        )
    }

    // Calculate container height based on max offsets
    const maxBackwardOffset = Math.max(0, ...arrows.backwardArrows.map(a => a.offset ?? 0))
    const maxForwardOffset = Math.max(0, ...arrows.forwardSkipArrows.map(a => a.offset ?? 0))

    // Also explicit self-loop height
    const hasSelfLoops = arrows.selfArrows.length > 0
    const minHeight = hasSelfLoops ? 120 : 100 // Reduced min height

    return (
        <div className={clsx("bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3", className)}>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <PlayCircle size={14} />
                    Lifecycle Flow
                </h4>
            </div>

            <div
                className="relative flow-container overflow-x-auto overflow-y-hidden px-2 rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                style={{
                    paddingTop: `${Math.max(PADDING_Y, 20 + maxBackwardOffset)}px`,
                    paddingBottom: `${Math.max(PADDING_Y, 20 + maxForwardOffset)}px`,
                    minHeight: `${minHeight}px`
                }}
            >
                {/* SVG overlay for connections */}
                <svg
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 1, minWidth: `${PADDING_X * 2 + sortedSteps.length * (STEP_WIDTH + GAP)}px` }}
                >
                    <defs>
                        <marker
                            id="viewer-arrow-forward"
                            markerWidth="6"
                            markerHeight="6"
                            refX="5"
                            refY="3"
                            orient="auto"
                        >
                            <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
                        </marker>
                        <marker
                            id="viewer-arrow-backward"
                            markerWidth="6"
                            markerHeight="6"
                            refX="5"
                            refY="3"
                            orient="auto"
                        >
                            <polygon points="0 0, 6 3, 0 6" fill="#f97316" />
                        </marker>
                    </defs>

                    {arrows.sequentialArrows.map((arrow, idx) => (
                        <path
                            key={`seq-${idx}`}
                            d={arrow.path}
                            stroke="#3b82f6"
                            strokeWidth="1.5"
                            fill="none"
                            markerEnd="url(#viewer-arrow-forward)"
                        />
                    ))}

                    {arrows.backwardArrows.map((arrow, idx) => (
                        <path
                            key={`back-${idx}`}
                            d={arrow.path}
                            stroke="#f97316"
                            strokeWidth="1.5"
                            fill="none"
                            strokeDasharray="6,4"
                            markerEnd="url(#viewer-arrow-backward)"
                            strokeLinecap="round"
                        />
                    ))}

                    {arrows.forwardSkipArrows.map((arrow, idx) => (
                        <path
                            key={`skip-${idx}`}
                            d={arrow.path}
                            stroke="#3b82f6"
                            strokeWidth="1.5"
                            fill="none"
                            markerEnd="url(#viewer-arrow-forward)"
                            strokeLinecap="round"
                        />
                    ))}

                    {arrows.selfArrows.map((arrow, idx) => (
                        <circle
                            key={`self-${idx}`}
                            cx={arrow.fromPos.x}
                            cy={arrow.fromPos.y - STEP_HEIGHT / 2 - 12}
                            r="12"
                            stroke="#a855f7"
                            strokeWidth="1.5"
                            fill="none"
                            strokeDasharray="3,3"
                        />
                    ))}
                </svg>

                {/* Steps */}
                <div className="flex items-center justify-start gap-[16px] w-full" style={{ minWidth: 'max-content' }}>
                    {sortedSteps.map((step, index) => {
                        const status = statuses.find(s => s.id === step.statusId)
                        const isCurrent = currentStatusId === step.statusId

                        const isFirst = index === 0
                        const isLast = index === sortedSteps.length - 1
                        const chevronDepth = 12 // Even smaller chevron

                        const getClipPath = () => {
                            if (isFirst && isLast) {
                                return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                            } else if (isFirst) {
                                return `polygon(0 0, calc(100% - ${chevronDepth}px) 0, 100% 50%, calc(100% - ${chevronDepth}px) 100%, 0 100%)`
                            } else if (isLast) {
                                return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${chevronDepth}px 50%)`
                            } else {
                                return `polygon(0 0, calc(100% - ${chevronDepth}px) 0, 100% 50%, calc(100% - ${chevronDepth}px) 100%, 0 100%, ${chevronDepth}px 50%)`
                            }
                        }

                        return (
                            <div
                                key={step.id}
                                ref={(el) => {
                                    if (el) stepRefs.current.set(step.id, el)
                                }}
                                className={clsx(
                                    'relative z-10',
                                    isCurrent ? 'transform scale-105' : 'opacity-90'
                                )}
                                style={{
                                    marginLeft: index > 0 ? `-${chevronDepth / 2}px` : '0'
                                }}
                            >
                                <div
                                    className={clsx(
                                        'w-[100px] px-2 py-1.5 shadow-sm transition-all duration-200 flex flex-col items-center justify-center min-h-[60px]',
                                        isCurrent
                                            ? 'bg-blue-600 dark:bg-blue-600 shadow-md shadow-blue-500/20'
                                            : 'bg-slate-600 dark:bg-slate-700',
                                        index === 0 && 'border-l-4 border-l-emerald-500',
                                        index === sortedSteps.length - 1 && 'border-r-4 border-r-rose-500'
                                    )}
                                    style={{
                                        clipPath: getClipPath(),
                                        paddingLeft: isFirst ? '0.5rem' : `calc(0.5rem + ${chevronDepth / 2}px)`,
                                        paddingRight: isLast ? '0.5rem' : `calc(0.5rem + ${chevronDepth / 2}px)`
                                    }}
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <span className={clsx(
                                            "text-xs font-bold mb-0.5",
                                            isCurrent ? "text-white" : "text-white/80"
                                        )}>{index + 1}</span>
                                        <span className="text-[10px] font-medium text-white leading-tight line-clamp-2">
                                            {status?.name || 'Unknown'}
                                        </span>
                                        {isCurrent && (
                                            <span className="mt-0.5 text-[8px] uppercase tracking-wider font-bold bg-white/20 px-1 py-0 rounded-full text-white">
                                                Current
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
