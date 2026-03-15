import {
    Users,
    Boxes,
    CheckCircle2,
    AlertCircle,
    FileCheck,
    Settings,
    BookOpen,
    Sliders,
    GitBranch,
    ClipboardList,
    Archive,
    Activity,
    Shield,
    ShieldCheck,
    Award,
    CheckCircle,
    AlertTriangle,
    Network,
    Layers,
    FolderTree,
    type LucideIcon,
} from 'lucide-react'

export type ModuleCategory = 'system' | 'development' | 'assurance'

export interface ModuleDefinition {
    id: string
    label: string
    icon: LucideIcon
    route: string
    category: ModuleCategory
    tooltip?: string
}

export const MODULES: ModuleDefinition[] = [
    // System Definition
    { id: 'stakeholder', label: 'Stakeholder', icon: Users, route: 'stakeholder', category: 'system' },
    { id: 'product-breakdown-structure', label: 'Product Breakdown Structure', icon: FolderTree, route: 'product-breakdown-structure', category: 'system' },
    { id: 'mbse-models', label: 'MBSE Models', icon: Boxes, route: 'mbse-models', category: 'system' },
    { id: 'functions', label: 'Functions', icon: Settings, route: 'functions', category: 'system' },
    { id: 'interface-management', label: 'Interface Management', icon: Network, route: 'interface-management', category: 'system' },
    { id: 'parameters', label: 'Parameters', icon: Sliders, route: 'parameters', category: 'system' },

    // Development & Control
    { id: 'requirements', label: 'Requirements', icon: FileCheck, route: 'requirements', category: 'development' },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: 'tasks', category: 'development' },
    { id: 'change-requests', label: 'Change Requests', icon: GitBranch, route: 'change-requests', category: 'development' },
    { id: 'issues', label: 'Issues', icon: AlertCircle, route: 'issues', category: 'development' },
    { id: 'documentation', label: 'Documentation', icon: BookOpen, route: 'documentation', category: 'development' },
    { id: 'lifecycle-status', label: 'Lifecycle Status', icon: Activity, route: 'lifecycle-status', category: 'development' },
    { id: 'configuration-management', label: 'Configuration Management', icon: Layers, route: 'configuration-management', category: 'development' },
    { id: 'archive', label: 'Archive', icon: Archive, route: 'archive', category: 'development' },

    // Assurance & Certification
    { id: 'verification', label: 'Verification', icon: CheckCircle2, route: 'verification', category: 'assurance' },
    { id: 'validation', label: 'Validation', icon: CheckCircle, route: 'validation', category: 'assurance' },
    { id: 'safety-analysis', label: 'Safety Analysis', icon: Shield, route: 'safety-analysis', category: 'assurance' },
    { id: 'risk-management', label: 'Risk Management', icon: AlertTriangle, route: 'risk-management', category: 'assurance' },
    { id: 'compliance-check', label: 'Compliance Check', icon: ShieldCheck, route: 'compliance-check', category: 'assurance' },
    { id: 'certification', label: 'Certification', icon: Award, route: 'certification', category: 'assurance' },
    { id: 'audit', label: 'Audit Log', icon: ClipboardList, route: 'audit', category: 'assurance' },
]

export const CATEGORIES: { id: ModuleCategory; label: string }[] = [
    { id: 'system', label: 'System Definition' },
    { id: 'development', label: 'Development & Control' },
    { id: 'assurance', label: 'Assurance' },
]
