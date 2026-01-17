export interface RequirementTemplate {
  id: string
  projectId: string
  name: string
  description?: string
  requirementType?: string
  category?: string
  templateFields?: Record<string, any> // Predefined field values
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRequirementTemplateDto {
  name: string
  description?: string
  requirementType?: string
  category?: string
  templateFields?: Record<string, any>
  isDefault?: boolean
}

export interface UpdateRequirementTemplateDto {
  name?: string
  description?: string
  requirementType?: string
  category?: string
  templateFields?: Record<string, any>
  isDefault?: boolean
}
