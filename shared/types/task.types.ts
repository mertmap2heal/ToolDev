export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TaskRelationType = 'BLOCKS' | 'BLOCKED_BY' | 'RELATES' | 'DUPLICATES' | 'PARENT' | 'CHILD'
export type ViewType = 'LIST' | 'BOARD' | 'CALENDAR' | 'TIMELINE'
export type AutomationTriggerType =
  | 'task_created'
  | 'status_changed'
  | 'due_date_changed'
  | 'comment_added'
  | 'tag_added'
export type AutomationRunStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED'

export interface TaskTag {
  id: string
  name: string
  color?: string
  createdAt: string
}

export interface ChecklistItem {
  id: string
  checklistId: string
  content: string
  isDone: boolean
  sortOrder: number
  createdAt: string
}

export interface Checklist {
  id: string
  taskId: string
  title: string
  sortOrder: number
  createdAt: string
  items: ChecklistItem[]
}

export interface TaskComment {
  id: string
  taskId: string
  bodyRich: string
  authorId?: string
  authorName?: string
  createdAt: string
  updatedAt: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  fileName: string
  storageKey: string
  fileUrl: string
  sizeBytes?: number
  mimeType?: string
  createdAt: string
}

export interface TaskLink {
  id: string
  taskId: string
  url: string
  title?: string
  createdAt: string
}

export interface TaskRelation {
  id: string
  fromTaskId: string
  toTaskId: string
  relationType: TaskRelationType
  createdAt: string
  fromTask?: {
    id: string
    title: string
    status: TaskStatus
    dueDate?: string
  }
  toTask?: {
    id: string
    title: string
    status: TaskStatus
    dueDate?: string
  }
}

export interface Task {
  id: string
  projectId?: string
  title: string
  descriptionRich?: string
  status: TaskStatus
  priority: TaskPriority
  startDate?: string
  dueDate?: string
  estimateMinutes?: number
  blocked: boolean
  blockedReason?: string
  parentTaskId?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  tags?: Array<{
    taskId: string
    tagId: string
    tag: TaskTag
  }>
  checklists?: Checklist[]
  comments?: TaskComment[]
  attachments?: TaskAttachment[]
  links?: TaskLink[]
  relationsFrom?: TaskRelation[]
  relationsTo?: TaskRelation[]
  children?: Array<{
    id: string
    title: string
    status: TaskStatus
    priority: TaskPriority
    dueDate?: string
  }>
  project?: {
    id: string
    name: string
  }
  _count?: {
    attachments: number
    comments: number
  }
}

export interface CreateTaskDto {
  projectId?: string
  title: string
  descriptionRich?: string
  status?: TaskStatus
  priority?: TaskPriority
  startDate?: string
  dueDate?: string
  estimateMinutes?: number
  blocked?: boolean
  blockedReason?: string
  parentTaskId?: string
  tagIds?: string[]
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}

export interface ListTasksFilters {
  projectId?: string
  assignedToUserId?: string
  search?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueFrom?: string
  dueTo?: string
  createdFrom?: string
  createdTo?: string
  tag?: string
  blocked?: boolean
  hasAttachments?: boolean
  hasComments?: boolean
  overdue?: boolean
  hasDependencies?: boolean
  sort?: string
  groupBy?: string
  page?: number
  pageSize?: number
}

export interface BoardColumn {
  id: string
  projectId?: string
  statusValue: string
  name: string
  wipLimit?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
  taskCount?: number
}

export interface SavedView {
  id: string
  projectId?: string
  userId?: string
  name: string
  viewType: ViewType
  queryJson?: string
  columnsJson?: string
  sortJson?: string
  groupJson?: string
  createdAt: string
  updatedAt: string
}

export interface AutomationRule {
  id: string
  name: string
  isActive: boolean
  triggerType: AutomationTriggerType
  conditionsJson: string
  actionsJson: string
  createdAt: string
  updatedAt: string
}

export interface AutomationRun {
  id: string
  ruleId: string
  triggeredAt: string
  status: AutomationRunStatus
  inputJson?: string
  outputJson?: string
  correlationId?: string
}

export interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  beforeJson?: string
  afterJson?: string
  occurredAt: string
  correlationId?: string
  userId?: string
  userName?: string
}

export interface ActivityFeedEntry {
  id: string
  taskId?: string
  eventType: string
  payloadJson: string
  occurredAt: string
  correlationId?: string
}
