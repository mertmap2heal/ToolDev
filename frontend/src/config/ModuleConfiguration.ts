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
    { id: 'product-breakdown-structure', label: 'PBS', icon: FolderTree, route: 'product-breakdown-structure', category: 'system', tooltip: 'Product Breakdown Structure' },
    { id: 'mbse-models', label: 'MBSE Models', icon: Boxes, route: 'mbse-models', category: 'system' },
    { id: 'functions', label: 'Functions', icon: Settings, route: 'functions', category: 'system' },
    { id: 'interface-management', label: 'Interfaces', icon: Network, route: 'interface-management', category: 'system' },
    { id: 'parameters', label: 'Parameters', icon: Sliders, route: 'parameters', category: 'system' },

    // Development & Control
    { id: 'requirements', label: 'Requirements', icon: FileCheck, route: 'requirements', category: 'development' },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: 'tasks', category: 'development' },
    { id: 'change-requests', label: 'Change Requests', icon: GitBranch, route: 'change-requests', category: 'development' },
    { id: 'issues', label: 'Issues', icon: AlertCircle, route: 'issues', category: 'development' },
    { id: 'documentation', label: 'Documentation', icon: BookOpen, route: 'documentation', category: 'development' },
    { id: 'lifecycle-status', label: 'Lifecycle', icon: Activity, route: 'lifecycle-status', category: 'development', tooltip: 'Lifecycle Status' },
    { id: 'configuration-management', label: 'Config Mgmt', icon: Layers, route: 'configuration-management', category: 'development', tooltip: 'Configuration Management' },
    { id: 'archive', label: 'Archive', icon: Archive, route: 'archive', category: 'development' },

    // Assurance & Certification
    { id: 'verification', label: 'Verification', icon: CheckCircle2, route: 'verification', category: 'assurance' },
    { id: 'validation', label: 'Validation', icon: CheckCircle, route: 'validation', category: 'assurance' },
    { id: 'safety-analysis', label: 'Safety', icon: Shield, route: 'safety-analysis', category: 'assurance', tooltip: 'Safety Analysis' },
    { id: 'risk-management', label: 'Risk', icon: AlertTriangle, route: 'risk-management', category: 'assurance', tooltip: 'Risk Management' },
    { id: 'compliance-check', label: 'Compliance', icon: ShieldCheck, route: 'compliance-check', category: 'assurance', tooltip: 'Compliance Check' },
    { id: 'certification', label: 'Certification', icon: Award, route: 'certification', category: 'assurance' },
]

export const CATEGORIES: { id: ModuleCategory; label: string }[] = [
    { id: 'system', label: 'System Definition' },
    { id: 'development', label: 'Dev & Control' },
    { id: 'assurance', label: 'Assurance' },
]
