export type RequirementType = 'functional' | 'performance' | 'interface' | 'design_constraint' | 'safety' | 'security' | 'usability' | 'other';
export type RequirementLevel = 'system' | 'subsystem' | 'component' | 'interface';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';
export interface Requirement {
    id: string;
    projectId: string;
    requirementId?: string;
    title: string;
    description: string;
    parentId?: string;
    parent?: Requirement;
    children?: Requirement[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: string;
    stage: string;
    owner?: string;
    verificationMethod?: string;
    acceptanceCriteria?: string;
    source?: string;
    category?: string;
    relatedDocuments?: string[];
    tags?: string[];
    requirementType?: RequirementType;
    requirementLevel?: RequirementLevel;
    risk?: RiskLevel;
    complexity?: ComplexityLevel;
    rationale?: string;
    assumptions?: string;
    dependencies?: string[];
    conflicts?: string[];
    stakeholders?: string[];
    verificationStatus?: 'not_verified' | 'verified' | 'failed';
    verificationDate?: string;
    verificationNotes?: string;
    linkedMocCode?: number;
    moc?: {
        code: number;
        name: string;
        description?: string;
    };
    reviewStatus?: 'draft' | 'under_review' | 'approved' | 'rejected';
    comments?: RequirementComment[];
    attachments?: RequirementAttachment[];
    reviews?: RequirementReview[];
    createdAt: string;
    updatedAt: string;
}
export interface RequirementComment {
    id: string;
    requirementId: string;
    projectId: string;
    content: string;
    authorId?: string;
    authorName?: string;
    createdAt: string;
    updatedAt: string;
}
export interface RequirementAttachment {
    id: string;
    requirementId: string;
    projectId: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: string;
    uploadedByName?: string;
    createdAt: string;
}
export interface SavedView {
    id: string;
    projectId: string;
    userId?: string;
    name: string;
    type: 'personal' | 'project' | 'organization';
    filters?: string;
    columns?: string;
    sortBy?: string;
    sortOrder?: string;
    viewpoint?: string;
    concerns?: string;
    viewType?: 'diagram' | 'table' | 'matrix' | 'report';
    createdAt: string;
    updatedAt: string;
}
export interface RequirementVersion {
    id: string;
    requirementId: string;
    projectId: string;
    version: number;
    title: string;
    description: string;
    priority: string;
    status: string;
    stage?: string;
    owner?: string;
    category?: string;
    source?: string;
    verificationMethod?: string;
    acceptanceCriteria?: string;
    tags?: string[];
    changedBy?: string;
    changedByName?: string;
    changeReason?: string;
    snapshot?: string;
    createdAt: string;
}
export interface Baseline {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    status: 'active' | 'locked' | 'archived';
    createdBy?: string;
    createdByName?: string;
    lockedAt?: string;
    itemCount?: number;
    linksCount?: number;
    suspectLinksCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface BaselineItem {
    id: string;
    baselineId: string;
    requirementId: string;
    snapshot: string;
    createdAt: string;
}
export interface CreateBaselineDto {
    name: string;
    description?: string;
    requirementIds?: string[];
}
export interface RequirementComparisonItem {
    id: string;
    requirementId: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    category?: string;
    previous?: {
        title?: string;
        priority?: string;
        status?: string;
    };
}
export interface BaselineLinkChange {
    id: string;
    sourceId: string;
    sourceType: string;
    targetId: string;
    targetType: string;
    linkType: string;
}
export interface BaselineComparison {
    baselineA: {
        id: string;
        name: string;
        createdAt: string;
        linksCount?: number;
    };
    baselineB: {
        id: string;
        name: string;
        createdAt: string;
        linksCount?: number;
    };
    added: RequirementComparisonItem[];
    removed: RequirementComparisonItem[];
    modified: RequirementComparisonItem[];
    linksAdded?: BaselineLinkChange[];
    linksRemoved?: BaselineLinkChange[];
    linksSuspectChanged?: BaselineLinkChange[];
    summary?: {
        addedCount: number;
        removedCount: number;
        modifiedCount: number;
        linksAddedCount?: number;
        linksRemovedCount?: number;
    };
}
export interface SystemFunction {
    id: string;
    projectId: string;
    functionId?: string;
    name: string;
    description: string;
    sourceReqId?: string;
    status?: 'draft' | 'work-in-progress' | 'in-review' | 'done';
    owner?: string;
    verificationMethod?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Architecture {
    id: string;
    projectId: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}
export interface VerificationPlan {
    id: string;
    projectId: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateSystemFunctionDto {
    functionId?: string;
    name: string;
    description: string;
    sourceReqId?: string;
    status?: 'draft' | 'work-in-progress' | 'in-review' | 'done';
    owner?: string;
    verificationMethod?: string;
}
export interface CreateArchitectureDto {
    name: string;
    description: string;
}
export interface CreateVerificationPlanDto {
    name: string;
    description: string;
}
export interface Issue {
    id: string;
    projectId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in-progress' | 'closed';
    owner?: string;
    relatedFunctionIds?: string[];
    relatedParameterIds?: string[];
    createdAt: string;
    updatedAt: string;
}
export interface CreateIssueDto {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    owner?: string;
    relatedFunctionIds?: string[];
    relatedParameterIds?: string[];
}
export interface Parameter {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    dataType?: string;
    defaultValue?: string;
    unit?: string;
    sourceFunctionId?: string;
    sourceFunction?: {
        id: string;
        functionId?: string;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
}
export interface CreateParameterDto {
    name: string;
    description?: string;
    dataType?: string;
    defaultValue?: string;
    unit?: string;
    sourceFunctionId?: string;
}
export interface UpdateParameterDto {
    description?: string;
    dataType?: string;
    defaultValue?: string;
    unit?: string;
}
export interface ChangeRequestAttachment {
    id: string;
    changeRequestId: string;
    projectId: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: string;
    uploadedByName?: string;
    createdAt: string;
}
export interface ChangeRequest {
    id: string;
    projectId: string;
    title: string;
    description: string;
    sourceType: 'function' | 'issue' | 'parameter' | 'requirement';
    sourceId: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'approved' | 'rejected' | 'in-review';
    requestedBy?: string;
    reviewedBy?: string;
    reviewComments?: string;
    risk?: 'low' | 'medium' | 'high' | 'critical';
    effort?: 'low' | 'medium' | 'high';
    justification?: string;
    createdAt: string;
    updatedAt: string;
    attachments?: ChangeRequestAttachment[];
}
export interface CreateChangeRequestDto {
    title: string;
    description: string;
    sourceType: 'function' | 'issue' | 'parameter' | 'requirement' | 'test-plan' | 'test-case' | 'test-setup' | 'test-result';
    sourceId: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requestedBy?: string;
    risk?: 'low' | 'medium' | 'high' | 'critical';
    effort?: 'low' | 'medium' | 'high';
    justification?: string;
}
export interface CreateRequirementDto {
    requirementId?: string;
    title: string;
    description: string;
    parentId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: string;
    stage?: string;
    owner?: string;
    verificationMethod?: string;
    acceptanceCriteria?: string;
    source?: string;
    category?: string;
    relatedDocuments?: string[];
    tags?: string[];
    requirementType?: RequirementType;
    requirementLevel?: RequirementLevel;
    risk?: RiskLevel;
    complexity?: ComplexityLevel;
    rationale?: string;
    assumptions?: string;
    linkedMocCode?: string;
    dependencies?: string[];
    conflicts?: string[];
    stakeholders?: string[];
    verificationStatus?: 'not_verified' | 'verified' | 'failed';
    verificationDate?: string;
    verificationNotes?: string;
}
export interface UpdateRequirementDto {
    requirementId?: string;
    title?: string;
    description?: string;
    parentId?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: string;
    stage?: string;
    owner?: string;
    verificationMethod?: string;
    acceptanceCriteria?: string;
    source?: string;
    category?: string;
    relatedDocuments?: string[];
    tags?: string[];
    requirementType?: RequirementType;
    requirementLevel?: RequirementLevel;
    risk?: RiskLevel;
    complexity?: ComplexityLevel;
    rationale?: string;
    assumptions?: string;
    dependencies?: string[];
    conflicts?: string[];
    stakeholders?: string[];
    verificationStatus?: 'not_verified' | 'verified' | 'failed';
    verificationDate?: string;
    verificationNotes?: string;
}
export interface BulkImportRequest {
    create?: CreateRequirementDto[];
    update?: Array<{
        id: string;
        data: Partial<UpdateRequirementDto>;
    }>;
}
export interface BulkImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{
        row: number;
        errors: string[];
    }>;
}
export type ReviewStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
export type ReviewerStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'deferred';
export type ReviewType = 'initial' | 'change' | 'periodic' | 'final';
export interface RequirementReview {
    id: string;
    requirementId: string;
    projectId: string;
    reviewStatus: ReviewStatus;
    reviewType?: ReviewType;
    initiatedBy?: string;
    initiatedByName?: string;
    startedAt?: string;
    completedAt?: string;
    reviewNotes?: string;
    createdAt: string;
    updatedAt: string;
    reviewers?: RequirementReviewer[];
    requirement?: {
        id: string;
        requirementId?: string;
        title: string;
        description?: string;
    };
}
export interface RequirementReviewer {
    id: string;
    reviewId: string;
    requirementId: string;
    projectId: string;
    reviewerId?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    role?: 'reviewer' | 'approver' | 'observer';
    status: ReviewerStatus;
    reviewComments?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateReviewDto {
    reviewType?: ReviewType;
    reviewers: Array<{
        reviewerId?: string;
        reviewerName?: string;
        reviewerEmail?: string;
        role?: 'reviewer' | 'approver' | 'observer';
    }>;
    reviewNotes?: string;
}
export interface UpdateReviewerDto {
    status: ReviewerStatus;
    reviewComments?: string;
}
//# sourceMappingURL=engineering.types.d.ts.map