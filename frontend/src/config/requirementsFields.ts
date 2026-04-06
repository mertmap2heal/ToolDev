export type RequirementFieldKey =
  | 'requirementId'
  | 'title'
  | 'description'
  | 'priority'
  | 'status'
  | 'owner'
  | 'category'
  | 'source'
  | 'requirementType'
  | 'requirementLevel'
  | 'risk'
  | 'complexity'
  | 'verificationMethod'
  | 'verificationStatus'
  | 'verificationDate'
  | 'linkedMocCode'
  | 'acceptanceCriteria'
  | 'stage'
  | 'rationale'
  | 'component'
  | 'reviewStatus'
  | 'createdAt'
  | 'updatedAt'

export type RequirementFieldConfig = {
  key: RequirementFieldKey
  label: string
  defaultVisible: boolean
  sortable?: boolean
  sortKey?: string
  defaultWidth?: number
}

export const REQUIREMENT_FIELDS: RequirementFieldConfig[] = [
  { key: 'requirementId', label: 'ID', defaultVisible: true, sortable: true, defaultWidth: 100 },
  { key: 'title', label: 'Title', defaultVisible: true, sortable: true, defaultWidth: 250 },
  { key: 'description', label: 'Description', defaultVisible: true, sortable: false, defaultWidth: 350 },
  { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, defaultWidth: 100 },
  { key: 'status', label: 'Status', defaultVisible: true, sortable: true, defaultWidth: 120 },
  { key: 'owner', label: 'Owner', defaultVisible: true, sortable: true, defaultWidth: 150 },
  { key: 'category', label: 'Category', defaultVisible: false, sortable: true, defaultWidth: 150 },
  { key: 'source', label: 'Source', defaultVisible: false, sortable: true, defaultWidth: 150 },
  { key: 'requirementType', label: 'Type', defaultVisible: false, sortable: true, defaultWidth: 150 },
  { key: 'requirementLevel', label: 'Level', defaultVisible: false, sortable: true, defaultWidth: 120 },
  { key: 'risk', label: 'Risk', defaultVisible: false, sortable: true, defaultWidth: 100 },
  { key: 'complexity', label: 'Complexity', defaultVisible: false, sortable: true, defaultWidth: 120 },
  { key: 'verificationMethod', label: 'Verification Method', defaultVisible: false, sortable: false, defaultWidth: 180 },
  { key: 'verificationStatus', label: 'Verification Status', defaultVisible: false, sortable: false, defaultWidth: 150 },
  { key: 'verificationDate', label: 'Verification Date', defaultVisible: false, sortable: true, defaultWidth: 150 },
  { key: 'linkedMocCode', label: 'MoC', defaultVisible: false, sortable: false, defaultWidth: 120 },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', defaultVisible: false, sortable: false, defaultWidth: 250 },
  { key: 'stage', label: 'Stage', defaultVisible: false, sortable: true, defaultWidth: 120 },
  { key: 'rationale', label: 'Rationale', defaultVisible: false, sortable: false, defaultWidth: 250 },
  { key: 'component', label: 'Component', defaultVisible: false, sortable: true, sortKey: 'componentId', defaultWidth: 150 },
  { key: 'reviewStatus', label: 'Review Status', defaultVisible: false, sortable: false, defaultWidth: 150 },
  { key: 'createdAt', label: 'Created', defaultVisible: false, sortable: true, defaultWidth: 150 },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false, sortable: true, defaultWidth: 150 },
]

export const REQUIREMENT_FIELD_LABELS: Record<RequirementFieldKey, string> = REQUIREMENT_FIELDS.reduce(
  (acc, f) => {
    acc[f.key] = f.label
    return acc
  },
  {} as Record<RequirementFieldKey, string>
)

export function getDefaultVisibleRequirementFields(): Set<RequirementFieldKey> {
  return new Set(REQUIREMENT_FIELDS.filter((f) => f.defaultVisible).map((f) => f.key))
}

