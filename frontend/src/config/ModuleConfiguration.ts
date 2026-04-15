import {
    Users,
    Boxes,
    CheckCircle2,
    AlertCircle,
    FileCheck,
    BookOpen,
    Sliders,
    GitBranch,
    ClipboardList,
    Archive,
    Activity,
    Shield,
    ShieldCheck,
    Award,
    AlertTriangle,
    Network,
    Layers,
    FolderTree,
    Zap,
    FlaskConical,
    History,
    type LucideIcon,
} from 'lucide-react'
import type { PackageId } from './packageConfig'

export type ModuleCategory = 'system' | 'development' | 'assurance'

export interface ModuleDefinition {
    id: string
    label: string
    icon: LucideIcon
    route: string
    category: ModuleCategory
    tooltip?: string
    /** Minimum subscription package required to access this module */
    minPackage?: PackageId
}

export const MODULES: ModuleDefinition[] = [
    // System Definition
    { id: 'stakeholder', label: 'Stakeholder', icon: Users, route: 'stakeholder', category: 'system', minPackage: 'core' },
    { id: 'product-breakdown-structure', label: 'Product Breakdown Structure', icon: FolderTree, route: 'product-breakdown-structure', category: 'system', minPackage: 'core' },
    { id: 'mbse-models', label: 'MBSE Models', icon: Boxes, route: 'mbse-models', category: 'system', minPackage: 'complete' },
    { id: 'functions', label: 'Functions', icon: Zap, route: 'functions', category: 'system', minPackage: 'core' },
    { id: 'interface-management', label: 'Interface Management', icon: Network, route: 'interface-management', category: 'system', minPackage: 'core' },
    { id: 'parameters', label: 'Parameters', icon: Sliders, route: 'parameters', category: 'system', minPackage: 'core' },

    // Development & Control
    { id: 'requirements', label: 'Requirements', icon: FileCheck, route: 'requirements', category: 'development', minPackage: 'core' },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: 'tasks', category: 'development', minPackage: 'advanced' },
    { id: 'change-requests', label: 'Change Requests', icon: GitBranch, route: 'change-requests', category: 'development', minPackage: 'core' },
    { id: 'issues', label: 'Issues', icon: AlertCircle, route: 'issues', category: 'development', minPackage: 'core' },
    { id: 'documentation', label: 'Documentation', icon: BookOpen, route: 'documentation', category: 'development', minPackage: 'advanced' },
    { id: 'lifecycle-status', label: 'Lifecycle Status', icon: Activity, route: 'lifecycle-status', category: 'development', minPackage: 'core' },
    { id: 'configuration-management', label: 'Configuration Management', icon: Layers, route: 'configuration-management', category: 'development', minPackage: 'complete' },
    { id: 'archive', label: 'Archive', icon: Archive, route: 'archive', category: 'development', minPackage: 'core' },

    // Assurance & Certification
    { id: 'verification', label: 'Verification', icon: CheckCircle2, route: 'verification', category: 'assurance', minPackage: 'advanced' },
    { id: 'validation', label: 'Validation', icon: FlaskConical, route: 'validation', category: 'assurance', minPackage: 'complete' },
    { id: 'safety-analysis', label: 'Safety Analysis', icon: Shield, route: 'safety-analysis', category: 'assurance', minPackage: 'complete' },
    { id: 'risk-management', label: 'Risk Management', icon: AlertTriangle, route: 'risk-management', category: 'assurance', minPackage: 'core' },
    { id: 'compliance-check', label: 'Compliance Check', icon: ShieldCheck, route: 'compliance-check', category: 'assurance', minPackage: 'complete' },
    { id: 'certification', label: 'Certification', icon: Award, route: 'certification', category: 'assurance', minPackage: 'complete' },
    { id: 'audit', label: 'Audit Log', icon: History, route: 'audit', category: 'assurance', minPackage: 'core' },
]

export const CATEGORIES: { id: ModuleCategory; label: string }[] = [
    { id: 'system', label: 'System Definition' },
    { id: 'development', label: 'Development & Control' },
    { id: 'assurance', label: 'Assurance' },
]
