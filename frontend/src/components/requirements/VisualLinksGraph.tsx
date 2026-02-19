
import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Position,
    MarkerType,
    Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Requirement } from 'shared/types/engineering.types';
import { useNavigate } from 'react-router-dom';
import {
    FileText,
    Settings,
    AlertCircle,
    GitPullRequest,
    Target,
    Shield,
    ClipboardCheck,
    BookOpen,
    Link2,
    Check,
    Layers
} from 'lucide-react';

interface VisualLinksGraphProps {
    requirement: Requirement;
    links: any[]; // Using any for now to match the mix of types in the drawer
    projectId: string;
}

const nodeWidth = 180;
const nodeHeight = 80;

const getLinkTypeLabel = (linkType: string) => {
    switch (linkType) {
        case 'derived_from': return '<<deriveReqt>>'; // SysML standard
        case 'derived_to': return '<<derived to>>';
        case 'satisfies': return '<<satisfy>>';       // SysML standard
        case 'satisfied_by': return '<<satisfied by>>';
        case 'verifies': return '<<verify>>';         // SysML standard
        case 'verified_by': return '<<verified by>>';
        case 'refines': return '<<refine>>';          // SysML standard
        case 'refined_by': return '<<refined by>>';
        case 'traces_to': return '<<trace>>';         // SysML standard
        case 'traces_from': return '<<traced from>>';
        case 'copies': return '<<copy>>';             // SysML standard
        case 'copied_from': return '<<copied from>>';
        case 'allocate': return '<<allocate>>';       // SysML standard
        case 'allocated_to': return '<<allocated to>>';
        case 'mitigates': return '<<mitigates>>';     // Safety standard
        case 'mitigated_by': return '<<mitigated by>>';
        case 'related_to': return '<<related>>';
        default: return `<<${linkType.replace(/_/g, ' ')}>>`;
    }
};

const getIcon = (type: string) => {
    switch (type) {
        case 'requirement': return <FileText size={16} className="text-blue-500" />;
        case 'function': return <Settings size={16} className="text-green-500" />;
        case 'issue': return <AlertCircle size={16} className="text-orange-500" />;
        case 'change_request': return <GitPullRequest size={16} className="text-purple-500" />;
        case 'pbs_component': return <Target size={16} className="text-green-500" />;
        case 'test_case': return <ClipboardCheck size={16} className="text-teal-500" />;
        case 'test_plan': return <ClipboardCheck size={16} className="text-teal-600" />;
        default: return <Link2 size={16} className="text-gray-500" />;
    }
};

// Custom Node Component
const CustomNode = ({ data }: { data: any }) => {
    return (
        <div className={`px-4 py-3 shadow-md rounded-md border-2 bg-white dark:bg-gray-800 w-[180px] ${data.isMain ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'}`}>
            <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
            <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" /> {/* Incoming from top? Rare but possible */}
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" /> {/* Outgoing to bottom? */}

            {/* Actually, for "bottom" nodes (verification), they are SOURCES linking TO main (TARGET).
                Main is at top (0,0), Verification is at bottom (0, 350).
                Logic: source: nodeId, target: 'main'.
                Source (Verification Node) connects from Position.Top.
                Target (Main Node) receives at Position.Bottom.

                Wait, my edges define `sourcePosition: Position.Top` and `targetPosition: Position.Top`?
                That logic in addLinkedNodes for bottom nodes was:
                sourcePosition: Position.Top
                targetPosition: Position.Top (Target is Main, Main is above, so Main receives at Bottom?)

                Let's stick to simple handles on all sides to cover all edge definitions.
                React Flow edges default to looking for handle with type="source"/"target".
                If multiple handles exist, we might need id. 
                But for simple graphs, one source/target handle per side (or just generic source/target handles) works if positioned correctly.
            */}

            {/* Specific handles to support the graph structure */}
            {/* Left Handle: Target for incoming links from Left Nodes */}
            <Handle
                type="target"
                position={Position.Left}
                id="target-left"
                className="w-3 h-3 !bg-gray-400 transition-opacity hover:opacity-100 opacity-0"
            />
            {/* Right Handle: Source for outgoing links to Right Nodes */}
            <Handle
                type="source"
                position={Position.Right}
                id="source-right"
                className="w-3 h-3 !bg-gray-400 transition-opacity hover:opacity-100 opacity-0"
            />

            {/* Top Handle: Source for Bottom Nodes (connecting upwards) */}
            <Handle
                type="source"
                position={Position.Top}
                id="source-top"
                className="w-3 h-3 !bg-gray-400 transition-opacity hover:opacity-100 opacity-0"
            />
            {/* Bottom Handle: Target for Bottom Nodes (receiving from below) */}
            <Handle
                type="target"
                position={Position.Bottom}
                id="target-bottom"
                className="w-3 h-3 !bg-gray-400 transition-opacity hover:opacity-100 opacity-0"
            />

            <div className="flex items-center">
                <div className="rounded-full w-8 h-8 flex justify-center items-center bg-gray-100 dark:bg-gray-700 mr-2">
                    {getIcon(data.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate">{data.id}</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate" title={data.label}>{data.label}</div>
                </div>
            </div>
            {data.type !== 'requirement' && (
                <div className="mt-1 text-[10px] text-gray-400 capitalize text-center">{data.type.replace(/_/g, ' ')}</div>
            )}
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

export const VisualLinksGraph: React.FC<VisualLinksGraphProps> = ({ requirement, links, projectId }) => {
    const navigate = useNavigate();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!requirement) return;

        // Center Node (Current Requirement)
        const mainNode: Node = {
            id: 'main',
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
                label: requirement.title,
                id: requirement.requirementId || 'REQ-???',
                type: 'requirement',
                isMain: true
            },
        };

        const newNodes: Node[] = [mainNode];
        const newEdges: Edge[] = [];

        // Separate links into incoming (left) and outgoing (right) based on logic
        // For now, we'll just split them evenly or by type if we were smarter,
        // but a simple layout strategy is: 
        // Parents/Sources -> Left
        // Children/Targets -> Right
        // Tests/Verifications -> Bottom

        // Simplification for this iteration: use radial layout or simple column
        const incomingTypes = ['derived_from', 'satisfied_by', 'refined_by', 'constrained_by', 'supported_by'];
        const verificationTypes = ['verified_by', 'tested_by'];

        const leftLinks: any[] = [];
        const rightLinks: any[] = [];
        const bottomLinks: any[] = [];

        links.forEach(link => {
            if (incomingTypes.includes(link.linkType)) {
                leftLinks.push(link);
            } else if (verificationTypes.includes(link.linkType) || link.targetType.includes('test')) {
                bottomLinks.push(link);
            } else {
                rightLinks.push(link);
            }
        });

        // Helper to add nodes
        const addLinkedNodes = (linkList: any[], xOffset: number, yStartOffset: number, sourceHandle: Position, targetHandle: Position, isIncoming: boolean) => {
            let yPos = yStartOffset - ((linkList.length - 1) * (nodeHeight + 80)) / 2;

            linkList.forEach((link, index) => {
                const nodeId = `node-${index}-${xOffset}`;

                let label = link.targetId; // Fallback
                if (link.targetItem) {
                    label = link.targetItem.title || link.targetItem.name || link.targetId;
                }

                newNodes.push({
                    id: nodeId,
                    type: 'custom',
                    position: { x: xOffset, y: yPos },
                    data: {
                        label: link.targetTitle || link.targetId, // Expecting parent to pass this
                        id: link.displayId || link.targetId,      // Expecting parent to pass this
                        type: link.targetType
                    },
                    sourcePosition: isIncoming ? Position.Right : Position.Left,
                    targetPosition: isIncoming ? Position.Right : Position.Left,
                });

                // Edge
                newEdges.push({
                    id: `edge-${index}-${xOffset}`,
                    source: isIncoming ? nodeId : 'main',
                    target: isIncoming ? 'main' : nodeId,
                    label: getLinkTypeLabel(link.linkType),
                    type: 'smoothstep',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 20,
                        height: 20,
                        color: '#6b7280',
                    },
                    style: { stroke: '#6b7280', strokeWidth: 2 },
                    labelStyle: { fill: '#111827', fontWeight: 700, fontSize: 11 },
                    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8, stroke: '#e5e7eb', strokeWidth: 0.5 },
                    labelShowBg: true,
                    zIndex: 10,
                });

                yPos += nodeHeight + 80;
            });
        };

        addLinkedNodes(leftLinks, -450, 0, Position.Right, Position.Left, true);
        addLinkedNodes(rightLinks, 450, 0, Position.Left, Position.Right, false);

        // Bottom nodes (Verification)
        if (bottomLinks.length > 0) {
            const xStart = -((bottomLinks.length - 1) * (nodeWidth + 80)) / 2;
            let xPos = xStart;

            bottomLinks.forEach((link, index) => {
                const nodeId = `node-bottom-${index}`;
                newNodes.push({
                    id: nodeId,
                    type: 'custom',
                    position: { x: xPos, y: 350 },
                    data: {
                        label: link.targetTitle || link.targetId,
                        id: link.displayId || link.targetId,
                        type: link.targetType
                    },
                    sourcePosition: Position.Top,
                    targetPosition: Position.Top,
                });

                newEdges.push({
                    id: `edge-bottom-${index}`,
                    source: nodeId,
                    target: 'main',
                    label: getLinkTypeLabel(link.linkType),
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#10b981' },
                    style: { stroke: '#10b981', strokeWidth: 2 },
                    labelStyle: { fill: '#065f46', fontWeight: 700, fontSize: 11 },
                    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8, stroke: '#d1fae5', strokeWidth: 0.5 },
                    labelShowBg: true,
                    zIndex: 10,
                });
                xPos += nodeWidth + 80;
            });
        }

        setNodes(newNodes);
        setEdges(newEdges);
    }, [requirement, links]);

    // Handle node click to navigate
    // Note: we'd need the real IDs and types to conform to buildDeepLink

    return (
        <div className="h-[500px] w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background gap={12} size={1} />
                <Controls />
                <MiniMap
                    nodeStrokeColor={(n) => {
                        if (n.type === 'custom') return '#ddd';
                        return '#eee';
                    }}
                    nodeColor={(n) => {
                        if (n.data?.isMain) return '#3b82f6';
                        return '#fff';
                    }}
                />
            </ReactFlow>
        </div>
    );
};
