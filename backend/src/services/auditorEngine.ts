export interface AuditFinding {
    id: string;
    nodeId: string;
    level: 'CRITICAL' | 'WARNING' | 'OPTIMIZATION';
    category: 'CIRCULAR' | 'PERFORMANCE' | 'GOVERNANCE';
    title: string;
    description: string;
    fixable: boolean;
}

export class AuditorEngine {
    /**
     * Run a full platform audit
     */
    static runAudit(nodes: any[], edges: any[]): AuditFinding[] {
        const findings: AuditFinding[] = [];

        // 1. Detect Circular Dependencies (Structural Risk)
        this.checkCircular(nodes, edges, findings);

        // 2. Check Performance Gaps (In-memory heuristics)
        this.checkPerformance(nodes, findings);

        // 3. Governance Compliance Analysis
        this.checkGovernance(nodes, edges, findings);

        return findings;
    }

    private static checkCircular(nodes: any[], edges: any[], findings: AuditFinding[]) {
        // Simplified DFS to find loops in relationships (e.g., Requirements pointing back to themselves)
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycle = (u: string) => {
            visited.add(u);
            recStack.add(u);

            const neighbors = edges.filter(e => e.source === u).map(e => e.target);
            for (const v of neighbors) {
                if (!visited.has(v)) {
                    if (hasCycle(v)) return true;
                } else if (recStack.has(v)) {
                    return true;
                }
            }

            recStack.delete(u);
            return false;
        };

        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                if (hasCycle(node.id)) {
                    findings.push({
                        id: `circular-${node.id}`,
                        nodeId: node.id,
                        level: 'CRITICAL',
                        category: 'CIRCULAR',
                        title: 'Circular Relationship Detected',
                        description: `Entity ${node.id} is part of a circular dependency loop. This may cause infinite recursion in downstream logic or requirement validation.`,
                        fixable: false
                    });
                }
            }
        });
    }

    private static checkPerformance(nodes: any[], findings: AuditFinding[]) {
        nodes.forEach(node => {
            // Logic heuristic: Database nodes with high metrics but no indexed fields reported
            if (node.data.type === 'db') {
                const metrics = node.data.metrics || { latency: 0, load: 0 };
                const fields = node.data.fields || [];
                const hasIndexes = fields.some((f: any) => f.indexed);

                if (metrics.latency > 100 && !hasIndexes) {
                    findings.push({
                        id: `perf-index-${node.id}`,
                        nodeId: node.id,
                        level: 'WARNING',
                        category: 'PERFORMANCE',
                        title: 'Missing Indices on High-Traffic Table',
                        description: `Node ${node.id} shows elevated latency. No secondary indices were detected in the schema definition for common filter paths.`,
                        fixable: true
                    });
                }

                if (metrics.load > 85) {
                    findings.push({
                        id: `perf-load-${node.id}`,
                        nodeId: node.id,
                        level: 'CRITICAL',
                        category: 'PERFORMANCE',
                        title: 'I/O Saturation Threat',
                        description: `Database node ${node.id} is operating at near-peak capacity. Sustained load may lead to connection pool exhaustion.`,
                        fixable: false
                    });
                }
            }
        });
    }

    private static checkGovernance(nodes: any[], edges: any[], findings: AuditFinding[]) {
        // Value Stream Analysis: Requirements must lead to verification
        nodes.filter(n => n.id.toLowerCase().includes('requirement')).forEach(req => {
            const hasVerification = edges.some(e => e.source === req.id && e.target.toLowerCase().includes('ver'));

            if (!hasVerification) {
                findings.push({
                    id: `gov-orphan-${req.id}`,
                    nodeId: req.id,
                    level: 'WARNING',
                    category: 'GOVERNANCE',
                    title: 'Orphaned Requirement',
                    description: `This requirement has no associated Verification Test Case or Validation Objective. It falls outside the certified value stream.`,
                    fixable: true
                });
            }
        });

        // PO compliance: Purchase Orders should link to a Project
        nodes.filter(n => n.id.toLowerCase().includes('purchaseorder')).forEach(po => {
            const isLinkedToProject = edges.some(e => (e.source === po.id || e.target === po.id) && (e.source.toLowerCase().includes('project') || e.target.toLowerCase().includes('project')));

            if (!isLinkedToProject) {
                findings.push({
                    id: `gov-compliance-${po.id}`,
                    nodeId: po.id,
                    level: 'CRITICAL',
                    category: 'GOVERNANCE',
                    title: 'Unallocated Expenditure',
                    description: `Purchase Order ${po.id} is not associated with an active Project ID. This violates financial governance protocols.`,
                    fixable: false
                });
            }
        });
    }
}
