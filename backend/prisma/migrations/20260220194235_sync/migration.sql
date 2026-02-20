-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "avatarUrl" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePasswordOnFirstLogin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL DEFAULT '__default__',
    "name" TEXT NOT NULL,
    "defaultPermissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineeringRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineeringRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEngineeringRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEngineeringRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLimit" (
    "id" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "companyName" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deadline" TIMESTAMP(3),
    "strictLifecycleGates" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "projectId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requirementId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "componentId" TEXT,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewStatus" TEXT DEFAULT 'draft',
    "stage" TEXT NOT NULL,
    "owner" TEXT,
    "verificationMethod" TEXT,
    "acceptanceCriteria" TEXT,
    "source" TEXT,
    "category" TEXT,
    "relatedDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirementType" TEXT,
    "requirementLevel" TEXT,
    "risk" TEXT,
    "complexity" TEXT,
    "rationale" TEXT,
    "assumptions" TEXT,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conflicts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stakeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" TEXT,
    "verificationDate" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "linkedMocCode" INTEGER,
    "thresholdValue" TEXT,
    "objectiveValue" TEXT,
    "customAttributes" JSONB,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lifecycleId" TEXT,
    "statusId" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementSubscription" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "RequirementSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementComment" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementAttachment" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemFunction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "functionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceReqId" TEXT,
    "status" TEXT DEFAULT 'draft',
    "owner" TEXT,
    "verificationMethod" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "criticality" TEXT DEFAULT 'medium',
    "pbsComponentId" TEXT,
    "allocatedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Architecture" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Architecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "direction" TEXT,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "isSuspect" BOOLEAN NOT NULL DEFAULT false,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "sections" JSONB,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT,
    "assigneeId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "relatedFunctionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedParameterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimatedTime" TEXT,
    "actualTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueSystemNote" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueSystemNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueSubscription" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueLabel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueLink" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "linkedType" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'relates_to',
    "linkedRequirementKey" TEXT,
    "linkedRequirementTitle" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT,
    "defaultValue" TEXT,
    "unit" TEXT,
    "sourceFunctionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "owner" TEXT,
    "reviewedBy" TEXT,
    "reviewComments" TEXT,
    "risk" TEXT,
    "effort" TEXT,
    "justification" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequestAttachment" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementChangeRequestLink" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'originates_from',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementChangeRequestLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "filters" TEXT,
    "columns" TEXT,
    "sortBy" TEXT,
    "sortOrder" TEXT,
    "viewpoint" TEXT,
    "concerns" TEXT,
    "viewType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementVersion" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT,
    "owner" TEXT,
    "category" TEXT,
    "source" TEXT,
    "verificationMethod" TEXT,
    "acceptanceCriteria" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "changedBy" TEXT,
    "changedByName" TEXT,
    "changeReason" TEXT,
    "snapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdByName" TEXT,
    "lockedAt" TIMESTAMP(3),
    "linksSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineItem" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "useCaseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preconditions" TEXT,
    "postconditions" TEXT,
    "mainFlow" TEXT,
    "alternativeFlows" TEXT,
    "extensions" TEXT,
    "priority" TEXT,
    "complexity" TEXT,
    "status" TEXT DEFAULT 'draft',
    "relatedRequirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCaseActor" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "UseCaseActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirementType" TEXT,
    "category" TEXT,
    "templateFields" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "diagramType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceElementId" TEXT,
    "sourceElementType" TEXT,
    "layout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRequirementType" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRequirementType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementReview" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'draft',
    "reviewType" TEXT,
    "initiatedBy" TEXT,
    "initiatedByName" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementReviewer" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewerEmail" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewComments" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementReviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Uom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trackingPolicy" TEXT NOT NULL DEFAULT 'NONE',
    "uomId" TEXT NOT NULL,
    "categoryId" TEXT,
    "projectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "negativeStockPolicy" TEXT NOT NULL DEFAULT 'STRICT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "parentLocationId" TEXT,
    "locationType" TEXT,
    "pickingPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLocationSetting" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reorderPoint" DECIMAL(65,30) DEFAULT 0,
    "minQty" DECIMAL(65,30) DEFAULT 0,
    "maxQty" DECIMAL(65,30),
    "safetyStock" DECIMAL(65,30) DEFAULT 0,
    "leadTimeDays" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemLocationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeDefinition" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "barcodeValue" TEXT NOT NULL,
    "barcodeType" TEXT NOT NULL DEFAULT 'CODE128',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAnalytics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "overdueTasks" INTEGER NOT NULL DEFAULT 0,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "currentLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "qtyReserved" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "qtyAvailable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "itemId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "qtyDelta" DECIMAL(65,30) NOT NULL,
    "uomId" TEXT NOT NULL,
    "serialId" TEXT,
    "unitCost" DECIMAL(65,30),
    "metadataJson" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT,
    "qtyReserved" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationAllocation" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "serialId" TEXT,
    "qty" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyOrdered" DECIMAL(65,30) NOT NULL,
    "qtyReceived" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "uomId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "trackingRequirements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "poLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "qtyReceived" DECIMAL(65,30) NOT NULL,
    "locationId" TEXT NOT NULL,
    "serialId" TEXT,
    "unitCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyOrdered" DECIMAL(65,30) NOT NULL,
    "qtyAllocated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "qtyShipped" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "uomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "shippedAt" TIMESTAMP(3),
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyShipped" DECIMAL(65,30) NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "serialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferLine" (
    "id" TEXT NOT NULL,
    "transferOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "serialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "reasonCode" TEXT NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentLine" (
    "id" TEXT NOT NULL,
    "stockAdjustmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qtyDelta" DECIMAL(65,30) NOT NULL,
    "serialId" TEXT,
    "unitCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCount" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "warehouseId" TEXT NOT NULL,
    "locationScope" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountLine" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "expectedQty" DECIMAL(65,30) NOT NULL,
    "countedQty" DECIMAL(65,30) NOT NULL,
    "varianceQty" DECIMAL(65,30) NOT NULL,
    "serialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAttachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryComment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryApproval" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "userId" TEXT,
    "userName" TEXT,

    CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "descriptionRich" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimateMinutes" INTEGER,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "parentTaskId" TEXT,
    "assignedToUserId" TEXT,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTagLink" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TaskTagLink_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "bodyRich" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedIdentifier" TEXT NOT NULL,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRelation" (
    "id" TEXT NOT NULL,
    "fromTaskId" TEXT NOT NULL,
    "toTaskId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "rruleText" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurrenceInstance" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurrenceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSavedView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL,
    "queryJson" TEXT,
    "columnsJson" TEXT,
    "sortJson" TEXT,
    "groupJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "statusValue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wipLimit" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "conditionsJson" TEXT NOT NULL,
    "actionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "inputJson" TEXT,
    "outputJson" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'TASK',
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "userId" TEXT,
    "userName" TEXT,

    CONSTRAINT "TaskAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFeed" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,

    CONSTRAINT "ActivityFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "description" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "title" TEXT NOT NULL,
    "descriptionRich" TEXT,
    "status" TEXT,
    "priority" TEXT,
    "estimateMinutes" INTEGER,
    "tags" TEXT[],
    "checklistItems" JSONB,
    "projectId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerMoc" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiresJustification" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequiredEvidenceTypes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerMoc_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "VerMethod" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "methodType" TEXT NOT NULL,
    "description" TEXT,
    "linkedMocCode" INTEGER,
    "applicablePhases" JSONB,
    "requiredEvidenceTypes" JSONB,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestSetup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environmentType" TEXT NOT NULL,
    "components" JSONB,
    "interfaces" JSONB,
    "diagramData" JSONB,
    "diagramExportPath" TEXT,
    "photos" JSONB,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "preconditions" TEXT,
    "steps" JSONB,
    "expectedResults" JSONB,
    "passFailCriteria" TEXT,
    "linkedMocCode" INTEGER,
    "linkedMethodId" TEXT,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestCaseSetup" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTestCaseSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,
    "entryCriteria" TEXT,
    "exitCriteria" TEXT,
    "phase" TEXT,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestPlanCase" (
    "id" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTestPlanCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testPlanId" TEXT,
    "runName" TEXT NOT NULL,
    "runNumber" INTEGER,
    "executedByUserId" TEXT,
    "executionContext" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestRunResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "testCaseVersionSnapshot" JSONB NOT NULL,
    "setupVersionSnapshot" JSONB,
    "resultStatus" TEXT NOT NULL DEFAULT 'NOT_RUN',
    "actualResults" JSONB,
    "notes" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerEvidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageRef" TEXT NOT NULL,
    "checksum" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerEvidenceLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageRef" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "checksum" TEXT,
    "resultStatus" TEXT NOT NULL DEFAULT 'NOT_RUN',
    "executedAt" TIMESTAMP(3),
    "executedByUserId" TEXT,
    "executedByName" TEXT,
    "testEnvironment" TEXT,
    "linkedSetupId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestResultLink" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTestResultLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "datePlanned" TIMESTAMP(3) NOT NULL,
    "dateHeld" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerReviewItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "findingSeverity" TEXT,
    "findingText" TEXT,
    "actionOwnerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerNonconformity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceTestRunResultId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerNonconformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerReverifyTask" (
    "id" TEXT NOT NULL,
    "nonconformityId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "requiredRunContext" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerReverifyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baselineType" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "allowedMocCodes" JSONB,
    "mocRulesByCriticality" JSONB,
    "lifecycleRules" JSONB,
    "namingRules" JSONB,
    "permissionsMap" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerCustomOption" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "optionType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerCustomOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerAuditEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "performedByUserId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestCaseCustomSection" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerTestCaseCustomSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestCaseSectionImage" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTestCaseSectionImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "description" TEXT,
    "checkType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheckRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "ruleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertContext" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'EASA',
    "certBasis" TEXT NOT NULL DEFAULT 'CS-25',
    "standards" TEXT[] DEFAULT ARRAY['ARP4754A', 'DO-178C']::TEXT[],
    "selectedBaselineId" TEXT,
    "selectedReleaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertRelease" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertObjective" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objId" TEXT NOT NULL,
    "regRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "moc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "criticality" TEXT NOT NULL DEFAULT 'Medium',
    "linkedEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "linkedCiCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "safetyObjectiveRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertObjectiveRequirementLink" (
    "id" TEXT NOT NULL,
    "certObjectiveId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertObjectiveRequirementLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertComplianceMatrixRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regRef" TEXT NOT NULL,
    "objectiveCount" INTEGER NOT NULL DEFAULT 0,
    "mocMix" JSONB NOT NULL,
    "statusSummary" JSONB NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertComplianceMatrixRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertFinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Minor',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "linkedRegRef" TEXT,
    "linkedObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedTo" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "safetyRelated" BOOLEAN NOT NULL DEFAULT false,
    "safetyNcrRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertReviewLogEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewType" TEXT NOT NULL,
    "scopeSummary" TEXT NOT NULL DEFAULT '',
    "findingsRaised" INTEGER NOT NULL DEFAULT 0,
    "findingsClosed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertReviewLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertActivityLogEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "actor" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertActivityLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertReadinessGate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertReadinessGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertPackage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'Authority submission',
    "scopeBaseline" TEXT,
    "scopeRelease" TEXT,
    "includedRegulations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertCorrespondence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "attachmentRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedFindingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedObjectiveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertCorrespondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertMeeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "attendees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CertMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertActionItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "description" TEXT NOT NULL DEFAULT '',
    "linkedFindingId" TEXT,
    "linkedObjectiveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "scopeSummary" TEXT NOT NULL DEFAULT '',
    "complianceStrategyJson" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'Draft',
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "relatedReviewId" TEXT,
    "relatedPackageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertChecklist" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "baselineId" TEXT,
    "releaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertSignOff" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "checklistId" TEXT,
    "milestoneId" TEXT,
    "role" TEXT NOT NULL DEFAULT '',
    "person" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertSignOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteEmail_key" ON "User"("inviteEmail");

-- CreateIndex
CREATE INDEX "AdminRole_companyKey_idx" ON "AdminRole"("companyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_companyKey_name_key" ON "AdminRole"("companyKey", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EngineeringRole_name_key" ON "EngineeringRole"("name");

-- CreateIndex
CREATE INDEX "UserEngineeringRole_userId_idx" ON "UserEngineeringRole"("userId");

-- CreateIndex
CREATE INDEX "UserEngineeringRole_roleId_idx" ON "UserEngineeringRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEngineeringRole_userId_roleId_key" ON "UserEngineeringRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLimit_companyKey_key" ON "CompanyLimit"("companyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_companyKey_key" ON "Organization"("companyKey");

-- CreateIndex
CREATE INDEX "Component_projectId_idx" ON "Component"("projectId");

-- CreateIndex
CREATE INDEX "Component_parentId_idx" ON "Component"("parentId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_status_idx" ON "ProjectMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- CreateIndex
CREATE INDEX "Requirement_parentId_idx" ON "Requirement"("parentId");

-- CreateIndex
CREATE INDEX "Requirement_componentId_idx" ON "Requirement"("componentId");

-- CreateIndex
CREATE INDEX "Requirement_linkedMocCode_idx" ON "Requirement"("linkedMocCode");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_projectId_requirementId_key" ON "Requirement"("projectId", "requirementId");

-- CreateIndex
CREATE INDEX "RequirementSubscription_requirementId_idx" ON "RequirementSubscription"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementSubscription_userId_idx" ON "RequirementSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementSubscription_requirementId_userId_key" ON "RequirementSubscription"("requirementId", "userId");

-- CreateIndex
CREATE INDEX "RequirementComment_requirementId_idx" ON "RequirementComment"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementComment_projectId_idx" ON "RequirementComment"("projectId");

-- CreateIndex
CREATE INDEX "RequirementAttachment_requirementId_idx" ON "RequirementAttachment"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementAttachment_projectId_idx" ON "RequirementAttachment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemFunction_functionId_key" ON "SystemFunction"("functionId");

-- CreateIndex
CREATE INDEX "SystemFunction_projectId_idx" ON "SystemFunction"("projectId");

-- CreateIndex
CREATE INDEX "SystemFunction_parentId_idx" ON "SystemFunction"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_issueKey_key" ON "Issue"("issueKey");

-- CreateIndex
CREATE INDEX "Issue_projectId_idx" ON "Issue"("projectId");

-- CreateIndex
CREATE INDEX "Issue_issueKey_idx" ON "Issue"("issueKey");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "Issue_assigneeId_idx" ON "Issue"("assigneeId");

-- CreateIndex
CREATE INDEX "IssueComment_issueId_idx" ON "IssueComment"("issueId");

-- CreateIndex
CREATE INDEX "IssueComment_authorId_idx" ON "IssueComment"("authorId");

-- CreateIndex
CREATE INDEX "IssueComment_parentCommentId_idx" ON "IssueComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "IssueSystemNote_issueId_idx" ON "IssueSystemNote"("issueId");

-- CreateIndex
CREATE INDEX "IssueSystemNote_userId_idx" ON "IssueSystemNote"("userId");

-- CreateIndex
CREATE INDEX "IssueSystemNote_createdAt_idx" ON "IssueSystemNote"("createdAt");

-- CreateIndex
CREATE INDEX "IssueSubscription_userId_idx" ON "IssueSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueSubscription_issueId_userId_key" ON "IssueSubscription"("issueId", "userId");

-- CreateIndex
CREATE INDEX "IssueLabel_projectId_idx" ON "IssueLabel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueLabel_projectId_name_key" ON "IssueLabel"("projectId", "name");

-- CreateIndex
CREATE INDEX "IssueLink_issueId_idx" ON "IssueLink"("issueId");

-- CreateIndex
CREATE INDEX "IssueLink_linkedType_linkedId_idx" ON "IssueLink"("linkedType", "linkedId");

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_projectId_name_key" ON "Parameter"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_crId_key" ON "ChangeRequest"("crId");

-- CreateIndex
CREATE INDEX "ChangeRequest_projectId_idx" ON "ChangeRequest"("projectId");

-- CreateIndex
CREATE INDEX "ChangeRequest_sourceType_sourceId_idx" ON "ChangeRequest"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ChangeRequest_crId_idx" ON "ChangeRequest"("crId");

-- CreateIndex
CREATE INDEX "ChangeRequestAttachment_changeRequestId_idx" ON "ChangeRequestAttachment"("changeRequestId");

-- CreateIndex
CREATE INDEX "ChangeRequestAttachment_projectId_idx" ON "ChangeRequestAttachment"("projectId");

-- CreateIndex
CREATE INDEX "RequirementChangeRequestLink_requirementId_idx" ON "RequirementChangeRequestLink"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementChangeRequestLink_changeRequestId_idx" ON "RequirementChangeRequestLink"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementChangeRequestLink_requirementId_changeRequestId_key" ON "RequirementChangeRequestLink"("requirementId", "changeRequestId");

-- CreateIndex
CREATE INDEX "SavedView_projectId_idx" ON "SavedView"("projectId");

-- CreateIndex
CREATE INDEX "SavedView_userId_idx" ON "SavedView"("userId");

-- CreateIndex
CREATE INDEX "SavedView_viewpoint_idx" ON "SavedView"("viewpoint");

-- CreateIndex
CREATE INDEX "RequirementVersion_requirementId_idx" ON "RequirementVersion"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementVersion_projectId_idx" ON "RequirementVersion"("projectId");

-- CreateIndex
CREATE INDEX "RequirementVersion_version_idx" ON "RequirementVersion"("version");

-- CreateIndex
CREATE INDEX "Baseline_projectId_idx" ON "Baseline"("projectId");

-- CreateIndex
CREATE INDEX "BaselineItem_baselineId_idx" ON "BaselineItem"("baselineId");

-- CreateIndex
CREATE INDEX "BaselineItem_requirementId_idx" ON "BaselineItem"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCase_useCaseId_key" ON "UseCase"("useCaseId");

-- CreateIndex
CREATE INDEX "UseCase_projectId_idx" ON "UseCase"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCase_projectId_useCaseId_key" ON "UseCase"("projectId", "useCaseId");

-- CreateIndex
CREATE INDEX "Actor_projectId_idx" ON "Actor"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_projectId_name_key" ON "Actor"("projectId", "name");

-- CreateIndex
CREATE INDEX "UseCaseActor_useCaseId_idx" ON "UseCaseActor"("useCaseId");

-- CreateIndex
CREATE INDEX "UseCaseActor_actorId_idx" ON "UseCaseActor"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCaseActor_useCaseId_actorId_key" ON "UseCaseActor"("useCaseId", "actorId");

-- CreateIndex
CREATE INDEX "RequirementTemplate_projectId_idx" ON "RequirementTemplate"("projectId");

-- CreateIndex
CREATE INDEX "RequirementTemplate_isDefault_idx" ON "RequirementTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "Diagram_projectId_idx" ON "Diagram"("projectId");

-- CreateIndex
CREATE INDEX "Diagram_sourceElementId_idx" ON "Diagram"("sourceElementId");

-- CreateIndex
CREATE INDEX "CustomRequirementType_projectId_idx" ON "CustomRequirementType"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRequirementType_projectId_typeName_key" ON "CustomRequirementType"("projectId", "typeName");

-- CreateIndex
CREATE INDEX "RequirementReview_requirementId_idx" ON "RequirementReview"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementReview_projectId_idx" ON "RequirementReview"("projectId");

-- CreateIndex
CREATE INDEX "RequirementReview_reviewStatus_idx" ON "RequirementReview"("reviewStatus");

-- CreateIndex
CREATE INDEX "RequirementReviewer_reviewId_idx" ON "RequirementReviewer"("reviewId");

-- CreateIndex
CREATE INDEX "RequirementReviewer_requirementId_idx" ON "RequirementReviewer"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementReviewer_projectId_idx" ON "RequirementReviewer"("projectId");

-- CreateIndex
CREATE INDEX "RequirementReviewer_reviewerId_idx" ON "RequirementReviewer"("reviewerId");

-- CreateIndex
CREATE INDEX "RequirementReviewer_status_idx" ON "RequirementReviewer"("status");

-- CreateIndex
CREATE INDEX "ItemCategory_parentId_idx" ON "ItemCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Uom_code_key" ON "Uom"("code");

-- CreateIndex
CREATE INDEX "Uom_code_idx" ON "Uom"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");

-- CreateIndex
CREATE INDEX "Item_sku_idx" ON "Item"("sku");

-- CreateIndex
CREATE INDEX "Item_projectId_idx" ON "Item"("projectId");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_isActive_idx" ON "Item"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_code_idx" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_code_idx" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");

-- CreateIndex
CREATE INDEX "Location_warehouseId_idx" ON "Location"("warehouseId");

-- CreateIndex
CREATE INDEX "Location_parentLocationId_idx" ON "Location"("parentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_warehouseId_code_key" ON "Location"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "ItemLocationSetting_itemId_idx" ON "ItemLocationSetting"("itemId");

-- CreateIndex
CREATE INDEX "ItemLocationSetting_locationId_idx" ON "ItemLocationSetting"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemLocationSetting_itemId_locationId_key" ON "ItemLocationSetting"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "BarcodeDefinition_itemId_idx" ON "BarcodeDefinition"("itemId");

-- CreateIndex
CREATE INDEX "BarcodeDefinition_isPrimary_idx" ON "BarcodeDefinition"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeDefinition_barcodeValue_key" ON "BarcodeDefinition"("barcodeValue");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAnalytics_projectId_key" ON "ProjectAnalytics"("projectId");

-- CreateIndex
CREATE INDEX "SerialNumber_itemId_idx" ON "SerialNumber"("itemId");

-- CreateIndex
CREATE INDEX "SerialNumber_serialCode_idx" ON "SerialNumber"("serialCode");

-- CreateIndex
CREATE INDEX "SerialNumber_status_idx" ON "SerialNumber"("status");

-- CreateIndex
CREATE INDEX "SerialNumber_currentLocationId_idx" ON "SerialNumber"("currentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_itemId_serialCode_key" ON "SerialNumber"("itemId", "serialCode");

-- CreateIndex
CREATE INDEX "InventoryBalance_itemId_idx" ON "InventoryBalance"("itemId");

-- CreateIndex
CREATE INDEX "InventoryBalance_locationId_idx" ON "InventoryBalance"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_itemId_locationId_key" ON "InventoryBalance"("itemId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLedger_idempotencyKey_key" ON "InventoryLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryLedger_itemId_occurredAt_idx" ON "InventoryLedger"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryLedger_fromLocationId_occurredAt_idx" ON "InventoryLedger"("fromLocationId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryLedger_toLocationId_occurredAt_idx" ON "InventoryLedger"("toLocationId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryLedger_referenceType_referenceId_idx" ON "InventoryLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryLedger_eventType_idx" ON "InventoryLedger"("eventType");

-- CreateIndex
CREATE INDEX "InventoryLedger_occurredAt_idx" ON "InventoryLedger"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryLedger_idempotencyKey_idx" ON "InventoryLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Reservation_itemId_idx" ON "Reservation"("itemId");

-- CreateIndex
CREATE INDEX "Reservation_locationId_idx" ON "Reservation"("locationId");

-- CreateIndex
CREATE INDEX "Reservation_referenceType_referenceId_idx" ON "Reservation"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "ReservationAllocation_reservationId_idx" ON "ReservationAllocation"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationAllocation_serialId_idx" ON "ReservationAllocation"("serialId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_number_idx" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_number_key" ON "GoodsReceipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_idempotencyKey_key" ON "GoodsReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GoodsReceipt_number_idx" ON "GoodsReceipt"("number");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_status_idx" ON "GoodsReceipt"("status");

-- CreateIndex
CREATE INDEX "GoodsReceipt_idempotencyKey_idx" ON "GoodsReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_goodsReceiptId_idx" ON "GoodsReceiptLine"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_itemId_idx" ON "GoodsReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_serialId_idx" ON "GoodsReceiptLine"("serialId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_number_key" ON "SalesOrder"("number");

-- CreateIndex
CREATE INDEX "SalesOrder_number_idx" ON "SalesOrder"("number");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_itemId_idx" ON "SalesOrderLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "Shipment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Shipment_number_idx" ON "Shipment"("number");

-- CreateIndex
CREATE INDEX "Shipment_salesOrderId_idx" ON "Shipment"("salesOrderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_idempotencyKey_idx" ON "Shipment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ShipmentLine_shipmentId_idx" ON "ShipmentLine"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLine_itemId_idx" ON "ShipmentLine"("itemId");

-- CreateIndex
CREATE INDEX "ShipmentLine_serialId_idx" ON "ShipmentLine"("serialId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferOrder_number_key" ON "TransferOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TransferOrder_idempotencyKey_key" ON "TransferOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferOrder_number_idx" ON "TransferOrder"("number");

-- CreateIndex
CREATE INDEX "TransferOrder_fromWarehouseId_idx" ON "TransferOrder"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "TransferOrder_toWarehouseId_idx" ON "TransferOrder"("toWarehouseId");

-- CreateIndex
CREATE INDEX "TransferOrder_status_idx" ON "TransferOrder"("status");

-- CreateIndex
CREATE INDEX "TransferOrder_idempotencyKey_idx" ON "TransferOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferLine_transferOrderId_idx" ON "TransferLine"("transferOrderId");

-- CreateIndex
CREATE INDEX "TransferLine_itemId_idx" ON "TransferLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_number_key" ON "StockAdjustment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_idempotencyKey_key" ON "StockAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockAdjustment_number_idx" ON "StockAdjustment"("number");

-- CreateIndex
CREATE INDEX "StockAdjustment_status_idx" ON "StockAdjustment"("status");

-- CreateIndex
CREATE INDEX "StockAdjustment_idempotencyKey_idx" ON "StockAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdjustmentLine_stockAdjustmentId_idx" ON "AdjustmentLine"("stockAdjustmentId");

-- CreateIndex
CREATE INDEX "AdjustmentLine_itemId_idx" ON "AdjustmentLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_number_key" ON "CycleCount"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_idempotencyKey_key" ON "CycleCount"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CycleCount_number_idx" ON "CycleCount"("number");

-- CreateIndex
CREATE INDEX "CycleCount_warehouseId_idx" ON "CycleCount"("warehouseId");

-- CreateIndex
CREATE INDEX "CycleCount_status_idx" ON "CycleCount"("status");

-- CreateIndex
CREATE INDEX "CycleCount_idempotencyKey_idx" ON "CycleCount"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CycleCountLine_cycleCountId_idx" ON "CycleCountLine"("cycleCountId");

-- CreateIndex
CREATE INDEX "CycleCountLine_itemId_idx" ON "CycleCountLine"("itemId");

-- CreateIndex
CREATE INDEX "InventoryAttachment_entityType_entityId_idx" ON "InventoryAttachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InventoryComment_entityType_entityId_idx" ON "InventoryComment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InventoryComment_createdAt_idx" ON "InventoryComment"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryApproval_entityType_entityId_idx" ON "InventoryApproval"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InventoryApproval_status_idx" ON "InventoryApproval"("status");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_entityType_entityId_idx" ON "InventoryAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_occurredAt_idx" ON "InventoryAuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_correlationId_idx" ON "InventoryAuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_assignedToUserId_idx" ON "Task"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_dueDate_idx" ON "Task"("projectId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_name_key" ON "TaskTag"("name");

-- CreateIndex
CREATE INDEX "TaskTag_name_idx" ON "TaskTag"("name");

-- CreateIndex
CREATE INDEX "TaskTagLink_taskId_idx" ON "TaskTagLink"("taskId");

-- CreateIndex
CREATE INDEX "TaskTagLink_tagId_idx" ON "TaskTagLink"("tagId");

-- CreateIndex
CREATE INDEX "Checklist_taskId_idx" ON "Checklist"("taskId");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "TaskComment_createdAt_idx" ON "TaskComment"("createdAt");

-- CreateIndex
CREATE INDEX "CommentMention_commentId_idx" ON "CommentMention"("commentId");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "TaskLink_taskId_idx" ON "TaskLink"("taskId");

-- CreateIndex
CREATE INDEX "TaskRelation_fromTaskId_idx" ON "TaskRelation"("fromTaskId");

-- CreateIndex
CREATE INDEX "TaskRelation_toTaskId_idx" ON "TaskRelation"("toTaskId");

-- CreateIndex
CREATE INDEX "TaskRelation_relationType_idx" ON "TaskRelation"("relationType");

-- CreateIndex
CREATE UNIQUE INDEX "RecurrenceRule_taskId_key" ON "RecurrenceRule"("taskId");

-- CreateIndex
CREATE INDEX "RecurrenceRule_taskId_idx" ON "RecurrenceRule"("taskId");

-- CreateIndex
CREATE INDEX "RecurrenceInstance_ruleId_idx" ON "RecurrenceInstance"("ruleId");

-- CreateIndex
CREATE INDEX "RecurrenceInstance_taskId_idx" ON "RecurrenceInstance"("taskId");

-- CreateIndex
CREATE INDEX "RecurrenceInstance_occurrenceDate_idx" ON "RecurrenceInstance"("occurrenceDate");

-- CreateIndex
CREATE INDEX "TaskSavedView_projectId_idx" ON "TaskSavedView"("projectId");

-- CreateIndex
CREATE INDEX "TaskSavedView_userId_idx" ON "TaskSavedView"("userId");

-- CreateIndex
CREATE INDEX "BoardColumn_projectId_idx" ON "BoardColumn"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardColumn_projectId_statusValue_key" ON "BoardColumn"("projectId", "statusValue");

-- CreateIndex
CREATE INDEX "AutomationRule_isActive_idx" ON "AutomationRule"("isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_idx" ON "AutomationRun"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationRun_triggeredAt_idx" ON "AutomationRun"("triggeredAt");

-- CreateIndex
CREATE INDEX "AutomationRun_correlationId_idx" ON "AutomationRun"("correlationId");

-- CreateIndex
CREATE INDEX "TaskAuditLog_entityType_entityId_idx" ON "TaskAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TaskAuditLog_occurredAt_idx" ON "TaskAuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "TaskAuditLog_correlationId_idx" ON "TaskAuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "ActivityFeed_taskId_idx" ON "ActivityFeed"("taskId");

-- CreateIndex
CREATE INDEX "ActivityFeed_occurredAt_idx" ON "ActivityFeed"("occurredAt");

-- CreateIndex
CREATE INDEX "ActivityFeed_correlationId_idx" ON "ActivityFeed"("correlationId");

-- CreateIndex
CREATE INDEX "TaskNotification_isRead_idx" ON "TaskNotification"("isRead");

-- CreateIndex
CREATE INDEX "TaskNotification_createdAt_idx" ON "TaskNotification"("createdAt");

-- CreateIndex
CREATE INDEX "TimeLog_taskId_idx" ON "TimeLog"("taskId");

-- CreateIndex
CREATE INDEX "TimeLog_userId_idx" ON "TimeLog"("userId");

-- CreateIndex
CREATE INDEX "TimeLog_loggedAt_idx" ON "TimeLog"("loggedAt");

-- CreateIndex
CREATE INDEX "TaskTemplate_projectId_idx" ON "TaskTemplate"("projectId");

-- CreateIndex
CREATE INDEX "TaskTemplate_isGlobal_idx" ON "TaskTemplate"("isGlobal");

-- CreateIndex
CREATE INDEX "VerMoc_isActive_idx" ON "VerMoc"("isActive");

-- CreateIndex
CREATE INDEX "VerMethod_projectId_idx" ON "VerMethod"("projectId");

-- CreateIndex
CREATE INDEX "VerMethod_linkedMocCode_idx" ON "VerMethod"("linkedMocCode");

-- CreateIndex
CREATE INDEX "VerMethod_status_idx" ON "VerMethod"("status");

-- CreateIndex
CREATE INDEX "VerTestSetup_projectId_idx" ON "VerTestSetup"("projectId");

-- CreateIndex
CREATE INDEX "VerTestSetup_status_idx" ON "VerTestSetup"("status");

-- CreateIndex
CREATE INDEX "VerTestCase_projectId_idx" ON "VerTestCase"("projectId");

-- CreateIndex
CREATE INDEX "VerTestCase_linkedMocCode_idx" ON "VerTestCase"("linkedMocCode");

-- CreateIndex
CREATE INDEX "VerTestCase_linkedMethodId_idx" ON "VerTestCase"("linkedMethodId");

-- CreateIndex
CREATE INDEX "VerTestCase_status_idx" ON "VerTestCase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VerTestCase_projectId_key_key" ON "VerTestCase"("projectId", "key");

-- CreateIndex
CREATE INDEX "VerTestCaseSetup_testCaseId_idx" ON "VerTestCaseSetup"("testCaseId");

-- CreateIndex
CREATE INDEX "VerTestCaseSetup_setupId_idx" ON "VerTestCaseSetup"("setupId");

-- CreateIndex
CREATE UNIQUE INDEX "VerTestCaseSetup_testCaseId_setupId_key" ON "VerTestCaseSetup"("testCaseId", "setupId");

-- CreateIndex
CREATE INDEX "VerTestPlan_projectId_idx" ON "VerTestPlan"("projectId");

-- CreateIndex
CREATE INDEX "VerTestPlan_status_idx" ON "VerTestPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VerTestPlan_projectId_key_key" ON "VerTestPlan"("projectId", "key");

-- CreateIndex
CREATE INDEX "VerTestPlanCase_testPlanId_idx" ON "VerTestPlanCase"("testPlanId");

-- CreateIndex
CREATE INDEX "VerTestPlanCase_testCaseId_idx" ON "VerTestPlanCase"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "VerTestPlanCase_testPlanId_testCaseId_key" ON "VerTestPlanCase"("testPlanId", "testCaseId");

-- CreateIndex
CREATE INDEX "VerTestRun_projectId_idx" ON "VerTestRun"("projectId");

-- CreateIndex
CREATE INDEX "VerTestRun_testPlanId_idx" ON "VerTestRun"("testPlanId");

-- CreateIndex
CREATE INDEX "VerTestRun_status_idx" ON "VerTestRun"("status");

-- CreateIndex
CREATE INDEX "VerTestRunResult_testRunId_idx" ON "VerTestRunResult"("testRunId");

-- CreateIndex
CREATE INDEX "VerTestRunResult_testCaseId_idx" ON "VerTestRunResult"("testCaseId");

-- CreateIndex
CREATE INDEX "VerTestRunResult_resultStatus_idx" ON "VerTestRunResult"("resultStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VerTestRunResult_testRunId_testCaseId_key" ON "VerTestRunResult"("testRunId", "testCaseId");

-- CreateIndex
CREATE INDEX "VerEvidence_projectId_idx" ON "VerEvidence"("projectId");

-- CreateIndex
CREATE INDEX "VerEvidence_evidenceType_idx" ON "VerEvidence"("evidenceType");

-- CreateIndex
CREATE INDEX "VerEvidenceLink_evidenceId_idx" ON "VerEvidenceLink"("evidenceId");

-- CreateIndex
CREATE INDEX "VerEvidenceLink_linkedEntityType_linkedEntityId_idx" ON "VerEvidenceLink"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "VerTestResult_projectId_idx" ON "VerTestResult"("projectId");

-- CreateIndex
CREATE INDEX "VerTestResult_resultStatus_idx" ON "VerTestResult"("resultStatus");

-- CreateIndex
CREATE INDEX "VerTestResult_executedAt_idx" ON "VerTestResult"("executedAt");

-- CreateIndex
CREATE INDEX "VerTestResult_linkedSetupId_idx" ON "VerTestResult"("linkedSetupId");

-- CreateIndex
CREATE INDEX "VerTestResultLink_testResultId_idx" ON "VerTestResultLink"("testResultId");

-- CreateIndex
CREATE INDEX "VerTestResultLink_linkedEntityType_linkedEntityId_idx" ON "VerTestResultLink"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "VerReview_projectId_idx" ON "VerReview"("projectId");

-- CreateIndex
CREATE INDEX "VerReview_status_idx" ON "VerReview"("status");

-- CreateIndex
CREATE INDEX "VerReviewItem_reviewId_idx" ON "VerReviewItem"("reviewId");

-- CreateIndex
CREATE INDEX "VerReviewItem_entityType_entityId_idx" ON "VerReviewItem"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "VerReviewItem_status_idx" ON "VerReviewItem"("status");

-- CreateIndex
CREATE INDEX "VerNonconformity_projectId_idx" ON "VerNonconformity"("projectId");

-- CreateIndex
CREATE INDEX "VerNonconformity_sourceTestRunResultId_idx" ON "VerNonconformity"("sourceTestRunResultId");

-- CreateIndex
CREATE INDEX "VerNonconformity_status_idx" ON "VerNonconformity"("status");

-- CreateIndex
CREATE INDEX "VerNonconformity_severity_idx" ON "VerNonconformity"("severity");

-- CreateIndex
CREATE INDEX "VerReverifyTask_nonconformityId_idx" ON "VerReverifyTask"("nonconformityId");

-- CreateIndex
CREATE INDEX "VerReverifyTask_testCaseId_idx" ON "VerReverifyTask"("testCaseId");

-- CreateIndex
CREATE INDEX "VerReverifyTask_status_idx" ON "VerReverifyTask"("status");

-- CreateIndex
CREATE INDEX "VerBaseline_projectId_idx" ON "VerBaseline"("projectId");

-- CreateIndex
CREATE INDEX "VerBaseline_baselineType_idx" ON "VerBaseline"("baselineType");

-- CreateIndex
CREATE UNIQUE INDEX "VerSettings_projectId_key" ON "VerSettings"("projectId");

-- CreateIndex
CREATE INDEX "VerSettings_projectId_idx" ON "VerSettings"("projectId");

-- CreateIndex
CREATE INDEX "VerCustomOption_projectId_optionType_idx" ON "VerCustomOption"("projectId", "optionType");

-- CreateIndex
CREATE UNIQUE INDEX "VerCustomOption_projectId_optionType_value_key" ON "VerCustomOption"("projectId", "optionType", "value");

-- CreateIndex
CREATE INDEX "VerTemplate_projectId_idx" ON "VerTemplate"("projectId");

-- CreateIndex
CREATE INDEX "VerTemplate_projectId_type_idx" ON "VerTemplate"("projectId", "type");

-- CreateIndex
CREATE INDEX "VerTemplate_status_idx" ON "VerTemplate"("status");

-- CreateIndex
CREATE INDEX "VerTemplateVersion_templateId_idx" ON "VerTemplateVersion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "VerTemplateVersion_templateId_version_key" ON "VerTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "VerAuditEvent_projectId_idx" ON "VerAuditEvent"("projectId");

-- CreateIndex
CREATE INDEX "VerAuditEvent_entityType_entityId_idx" ON "VerAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "VerAuditEvent_performedAt_idx" ON "VerAuditEvent"("performedAt");

-- CreateIndex
CREATE INDEX "VerAuditEvent_action_idx" ON "VerAuditEvent"("action");

-- CreateIndex
CREATE INDEX "VerTestCaseCustomSection_testCaseId_idx" ON "VerTestCaseCustomSection"("testCaseId");

-- CreateIndex
CREATE INDEX "VerTestCaseCustomSection_projectId_idx" ON "VerTestCaseCustomSection"("projectId");

-- CreateIndex
CREATE INDEX "VerTestCaseCustomSection_orderIndex_idx" ON "VerTestCaseCustomSection"("orderIndex");

-- CreateIndex
CREATE INDEX "VerTestCaseSectionImage_sectionId_idx" ON "VerTestCaseSectionImage"("sectionId");

-- CreateIndex
CREATE INDEX "VerTestCaseSectionImage_projectId_idx" ON "VerTestCaseSectionImage"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceRule_projectId_idx" ON "ComplianceRule"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceCheckRun_projectId_idx" ON "ComplianceCheckRun"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceCheckRun_createdAt_idx" ON "ComplianceCheckRun"("createdAt");

-- CreateIndex
CREATE INDEX "ComplianceFinding_projectId_idx" ON "ComplianceFinding"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceFinding_createdAt_idx" ON "ComplianceFinding"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertContext_projectId_key" ON "CertContext"("projectId");

-- CreateIndex
CREATE INDEX "CertContext_projectId_idx" ON "CertContext"("projectId");

-- CreateIndex
CREATE INDEX "CertBaseline_projectId_idx" ON "CertBaseline"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CertBaseline_projectId_baselineId_key" ON "CertBaseline"("projectId", "baselineId");

-- CreateIndex
CREATE INDEX "CertRelease_projectId_idx" ON "CertRelease"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CertRelease_projectId_releaseId_key" ON "CertRelease"("projectId", "releaseId");

-- CreateIndex
CREATE INDEX "CertObjective_projectId_idx" ON "CertObjective"("projectId");

-- CreateIndex
CREATE INDEX "CertObjective_regRef_idx" ON "CertObjective"("regRef");

-- CreateIndex
CREATE UNIQUE INDEX "CertObjective_projectId_objId_key" ON "CertObjective"("projectId", "objId");

-- CreateIndex
CREATE INDEX "CertObjectiveRequirementLink_certObjectiveId_idx" ON "CertObjectiveRequirementLink"("certObjectiveId");

-- CreateIndex
CREATE INDEX "CertObjectiveRequirementLink_requirementId_idx" ON "CertObjectiveRequirementLink"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "CertObjectiveRequirementLink_certObjectiveId_requirementId_key" ON "CertObjectiveRequirementLink"("certObjectiveId", "requirementId");

-- CreateIndex
CREATE INDEX "CertComplianceMatrixRow_projectId_idx" ON "CertComplianceMatrixRow"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CertComplianceMatrixRow_projectId_regRef_key" ON "CertComplianceMatrixRow"("projectId", "regRef");

-- CreateIndex
CREATE INDEX "CertFinding_projectId_idx" ON "CertFinding"("projectId");

-- CreateIndex
CREATE INDEX "CertFinding_status_idx" ON "CertFinding"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CertFinding_projectId_findingId_key" ON "CertFinding"("projectId", "findingId");

-- CreateIndex
CREATE INDEX "CertReviewLogEntry_projectId_idx" ON "CertReviewLogEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CertReviewLogEntry_projectId_reviewId_key" ON "CertReviewLogEntry"("projectId", "reviewId");

-- CreateIndex
CREATE INDEX "CertActivityLogEntry_projectId_idx" ON "CertActivityLogEntry"("projectId");

-- CreateIndex
CREATE INDEX "CertActivityLogEntry_timestamp_idx" ON "CertActivityLogEntry"("timestamp");

-- CreateIndex
CREATE INDEX "CertReadinessGate_projectId_idx" ON "CertReadinessGate"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CertReadinessGate_projectId_gateId_key" ON "CertReadinessGate"("projectId", "gateId");

-- CreateIndex
CREATE INDEX "CertPackage_projectId_idx" ON "CertPackage"("projectId");

-- CreateIndex
CREATE INDEX "CertCorrespondence_projectId_idx" ON "CertCorrespondence"("projectId");

-- CreateIndex
CREATE INDEX "CertCorrespondence_authority_idx" ON "CertCorrespondence"("authority");

-- CreateIndex
CREATE INDEX "CertCorrespondence_date_idx" ON "CertCorrespondence"("date");

-- CreateIndex
CREATE INDEX "CertMeeting_projectId_idx" ON "CertMeeting"("projectId");

-- CreateIndex
CREATE INDEX "CertMeeting_date_idx" ON "CertMeeting"("date");

-- CreateIndex
CREATE INDEX "CertActionItem_projectId_idx" ON "CertActionItem"("projectId");

-- CreateIndex
CREATE INDEX "CertActionItem_meetingId_idx" ON "CertActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "CertActionItem_status_idx" ON "CertActionItem"("status");

-- CreateIndex
CREATE INDEX "CertActionItem_dueDate_idx" ON "CertActionItem"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CertPlan_projectId_key" ON "CertPlan"("projectId");

-- CreateIndex
CREATE INDEX "CertPlan_projectId_idx" ON "CertPlan"("projectId");

-- CreateIndex
CREATE INDEX "CertMilestone_projectId_idx" ON "CertMilestone"("projectId");

-- CreateIndex
CREATE INDEX "CertMilestone_date_idx" ON "CertMilestone"("date");

-- CreateIndex
CREATE INDEX "CertChecklist_projectId_idx" ON "CertChecklist"("projectId");

-- CreateIndex
CREATE INDEX "CertChecklist_phase_idx" ON "CertChecklist"("phase");

-- CreateIndex
CREATE INDEX "CertChecklistItem_checklistId_idx" ON "CertChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "CertSignOff_projectId_idx" ON "CertSignOff"("projectId");

-- CreateIndex
CREATE INDEX "CertSignOff_checklistId_idx" ON "CertSignOff"("checklistId");

-- CreateIndex
CREATE INDEX "CertSignOff_milestoneId_idx" ON "CertSignOff"("milestoneId");

-- AddForeignKey
ALTER TABLE "UserEngineeringRole" ADD CONSTRAINT "UserEngineeringRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEngineeringRole" ADD CONSTRAINT "UserEngineeringRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "EngineeringRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_linkedMocCode_fkey" FOREIGN KEY ("linkedMocCode") REFERENCES "VerMoc"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSubscription" ADD CONSTRAINT "RequirementSubscription_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSubscription" ADD CONSTRAINT "RequirementSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementComment" ADD CONSTRAINT "RequirementComment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementAttachment" ADD CONSTRAINT "RequirementAttachment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemFunction" ADD CONSTRAINT "SystemFunction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemFunction" ADD CONSTRAINT "SystemFunction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SystemFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Architecture" ADD CONSTRAINT "Architecture_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationPlan" ADD CONSTRAINT "VerificationPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceLink" ADD CONSTRAINT "TraceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "IssueComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueSystemNote" ADD CONSTRAINT "IssueSystemNote_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueSystemNote" ADD CONSTRAINT "IssueSystemNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueSubscription" ADD CONSTRAINT "IssueSubscription_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueSubscription" ADD CONSTRAINT "IssueSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueLink" ADD CONSTRAINT "IssueLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parameter" ADD CONSTRAINT "Parameter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parameter" ADD CONSTRAINT "Parameter_sourceFunctionId_fkey" FOREIGN KEY ("sourceFunctionId") REFERENCES "SystemFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestAttachment" ADD CONSTRAINT "ChangeRequestAttachment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementChangeRequestLink" ADD CONSTRAINT "RequirementChangeRequestLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementChangeRequestLink" ADD CONSTRAINT "RequirementChangeRequestLink_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineItem" ADD CONSTRAINT "BaselineItem_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "Baseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseActor" ADD CONSTRAINT "UseCaseActor_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseActor" ADD CONSTRAINT "UseCaseActor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementTemplate" ADD CONSTRAINT "RequirementTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRequirementType" ADD CONSTRAINT "CustomRequirementType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementReview" ADD CONSTRAINT "RequirementReview_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementReviewer" ADD CONSTRAINT "RequirementReviewer_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "RequirementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLocationSetting" ADD CONSTRAINT "ItemLocationSetting_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLocationSetting" ADD CONSTRAINT "ItemLocationSetting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeDefinition" ADD CONSTRAINT "BarcodeDefinition_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAnalytics" ADD CONSTRAINT "ProjectAnalytics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationAllocation" ADD CONSTRAINT "ReservationAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationAllocation" ADD CONSTRAINT "ReservationAllocation_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLine" ADD CONSTRAINT "TransferLine_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLine" ADD CONSTRAINT "TransferLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLine" ADD CONSTRAINT "TransferLine_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLine" ADD CONSTRAINT "TransferLine_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLine" ADD CONSTRAINT "TransferLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentLine" ADD CONSTRAINT "AdjustmentLine_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentLine" ADD CONSTRAINT "AdjustmentLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentLine" ADD CONSTRAINT "AdjustmentLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentLine" ADD CONSTRAINT "AdjustmentLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "CycleCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTagLink" ADD CONSTRAINT "TaskTagLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTagLink" ADD CONSTRAINT "TaskTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TaskTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_fromTaskId_fkey" FOREIGN KEY ("fromTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_toTaskId_fkey" FOREIGN KEY ("toTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceInstance" ADD CONSTRAINT "RecurrenceInstance_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurrenceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceInstance" ADD CONSTRAINT "RecurrenceInstance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSavedView" ADD CONSTRAINT "TaskSavedView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFeed" ADD CONSTRAINT "ActivityFeed_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerMethod" ADD CONSTRAINT "VerMethod_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerMethod" ADD CONSTRAINT "VerMethod_linkedMocCode_fkey" FOREIGN KEY ("linkedMocCode") REFERENCES "VerMoc"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestSetup" ADD CONSTRAINT "VerTestSetup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCase" ADD CONSTRAINT "VerTestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCase" ADD CONSTRAINT "VerTestCase_linkedMocCode_fkey" FOREIGN KEY ("linkedMocCode") REFERENCES "VerMoc"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCase" ADD CONSTRAINT "VerTestCase_linkedMethodId_fkey" FOREIGN KEY ("linkedMethodId") REFERENCES "VerMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseSetup" ADD CONSTRAINT "VerTestCaseSetup_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "VerTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseSetup" ADD CONSTRAINT "VerTestCaseSetup_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "VerTestSetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestPlan" ADD CONSTRAINT "VerTestPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestPlanCase" ADD CONSTRAINT "VerTestPlanCase_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "VerTestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestPlanCase" ADD CONSTRAINT "VerTestPlanCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "VerTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRun" ADD CONSTRAINT "VerTestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRun" ADD CONSTRAINT "VerTestRun_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "VerTestPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRunResult" ADD CONSTRAINT "VerTestRunResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "VerTestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRunResult" ADD CONSTRAINT "VerTestRunResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "VerTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerEvidence" ADD CONSTRAINT "VerEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerEvidenceLink" ADD CONSTRAINT "VerEvidenceLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerEvidenceLink" ADD CONSTRAINT "VerEvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "VerEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestResult" ADD CONSTRAINT "VerTestResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestResult" ADD CONSTRAINT "VerTestResult_linkedSetupId_fkey" FOREIGN KEY ("linkedSetupId") REFERENCES "VerTestSetup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestResultLink" ADD CONSTRAINT "VerTestResultLink_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "VerTestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerReview" ADD CONSTRAINT "VerReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerReviewItem" ADD CONSTRAINT "VerReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "VerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerNonconformity" ADD CONSTRAINT "VerNonconformity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerNonconformity" ADD CONSTRAINT "VerNonconformity_sourceTestRunResultId_fkey" FOREIGN KEY ("sourceTestRunResultId") REFERENCES "VerTestRunResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerReverifyTask" ADD CONSTRAINT "VerReverifyTask_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "VerNonconformity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerReverifyTask" ADD CONSTRAINT "VerReverifyTask_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "VerTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerBaseline" ADD CONSTRAINT "VerBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerSettings" ADD CONSTRAINT "VerSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerCustomOption" ADD CONSTRAINT "VerCustomOption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTemplate" ADD CONSTRAINT "VerTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTemplateVersion" ADD CONSTRAINT "VerTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VerTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerAuditEvent" ADD CONSTRAINT "VerAuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseCustomSection" ADD CONSTRAINT "VerTestCaseCustomSection_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "VerTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseCustomSection" ADD CONSTRAINT "VerTestCaseCustomSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseSectionImage" ADD CONSTRAINT "VerTestCaseSectionImage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VerTestCaseCustomSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestCaseSectionImage" ADD CONSTRAINT "VerTestCaseSectionImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheckRun" ADD CONSTRAINT "ComplianceCheckRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFinding" ADD CONSTRAINT "ComplianceFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFinding" ADD CONSTRAINT "ComplianceFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ComplianceCheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFinding" ADD CONSTRAINT "ComplianceFinding_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertContext" ADD CONSTRAINT "CertContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertBaseline" ADD CONSTRAINT "CertBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertRelease" ADD CONSTRAINT "CertRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertObjective" ADD CONSTRAINT "CertObjective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertObjectiveRequirementLink" ADD CONSTRAINT "CertObjectiveRequirementLink_certObjectiveId_fkey" FOREIGN KEY ("certObjectiveId") REFERENCES "CertObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertObjectiveRequirementLink" ADD CONSTRAINT "CertObjectiveRequirementLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertComplianceMatrixRow" ADD CONSTRAINT "CertComplianceMatrixRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertFinding" ADD CONSTRAINT "CertFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertReviewLogEntry" ADD CONSTRAINT "CertReviewLogEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertActivityLogEntry" ADD CONSTRAINT "CertActivityLogEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertReadinessGate" ADD CONSTRAINT "CertReadinessGate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertPackage" ADD CONSTRAINT "CertPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertCorrespondence" ADD CONSTRAINT "CertCorrespondence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertMeeting" ADD CONSTRAINT "CertMeeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertActionItem" ADD CONSTRAINT "CertActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CertMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertPlan" ADD CONSTRAINT "CertPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertMilestone" ADD CONSTRAINT "CertMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertChecklist" ADD CONSTRAINT "CertChecklist_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertChecklistItem" ADD CONSTRAINT "CertChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "CertChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertSignOff" ADD CONSTRAINT "CertSignOff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertSignOff" ADD CONSTRAINT "CertSignOff_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "CertChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
