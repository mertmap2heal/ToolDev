import { PrismaClient } from '@prisma/client'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'

const prisma = new PrismaClient()

interface ReqIFSpecObject {
  identifier: string
  longName?: string
  type: string
  lastChange?: string
  values?: any[]
  children?: ReqIFSpecObject[]
}

interface ReqIFSpecification {
  identifier: string
  longName?: string
  type: string
  lastChange?: string
  values?: any[]
  children?: ReqIFSpecObject[]
}

interface ReqIFDocument {
  'reqif:REQ-IF': {
    '@_xmlns:reqif': string
    '@_xmlns:xsi': string
    '@_xsi:schemaLocation'?: string
    'reqif:HEADER': {
      'reqif:REQ-IF-HEADER': {
        'reqif:IDENTIFIER': string
        'reqif:CREATION-TIME': string
        'reqif:REQ-IF-VERSION': string
        'reqif:SOURCE-TOOL-ID'?: string
        'reqif:TOOL-ID'?: string
        'reqif:TITLE'?: string
        'reqif:COMMENT'?: string
      }
    }
    'reqif:CORE-CONTENT': {
      'reqif:REQ-IF-CONTENT': {
        'reqif:SPEC-OBJECTS'?: {
          'reqif:SPEC-OBJECT': ReqIFSpecObject[]
        }
        'reqif:SPEC-TYPES'?: any
        'reqif:SPEC-RELATIONS'?: any
        'reqif:SPECIFICATIONS'?: {
          'reqif:SPECIFICATION': ReqIFSpecification[]
        }
        'reqif:SPEC-RELATION-TYPES'?: any
        'reqif:DATATYPES'?: any
        'reqif:SPEC-HIERARCHIES'?: any
      }
    }
  }
}

/**
 * ReqIF Service for importing and exporting requirements in ReqIF format
 * Supports ReqIF 1.2 and 2.0 formats
 */
export const reqifService = {
  /**
   * Export requirements to ReqIF format
   */
  async exportToReqIF(projectId: string, requirementIds?: string[]): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: {
          where: requirementIds ? { id: { in: requirementIds } } : undefined,
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    const requirements = project.requirements
    const now = new Date().toISOString()
    const identifier = `reqif-${projectId}-${Date.now()}`

    // Build ReqIF document structure
    const reqifDoc: ReqIFDocument = {
      'reqif:REQ-IF': {
        '@_xmlns:reqif': 'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd',
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:schemaLocation': 'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd',
        'reqif:HEADER': {
          'reqif:REQ-IF-HEADER': {
            'reqif:IDENTIFIER': identifier,
            'reqif:CREATION-TIME': now,
            'reqif:REQ-IF-VERSION': '1.2',
            'reqif:SOURCE-TOOL-ID': 'Engineering-Tool',
            'reqif:TOOL-ID': 'Engineering-Tool-v1.0',
            'reqif:TITLE': project.name,
            'reqif:COMMENT': project.description || `Requirements export from ${project.name}`,
          },
        },
        'reqif:CORE-CONTENT': {
          'reqif:REQ-IF-CONTENT': {
            'reqif:SPEC-OBJECTS': {
              'reqif:SPEC-OBJECT': requirements.map((req) => reqifService.mapRequirementToSpecObject(req)),
            },
            'reqif:SPECIFICATIONS': {
              'reqif:SPECIFICATION': [
                {
                  identifier: `spec-${projectId}`,
                  longName: project.name,
                  type: 'SPECIFICATION',
                  lastChange: now,
                  children: requirements.map((req) => ({
                    identifier: `specobj-${req.id}`,
                    type: 'SPEC-OBJECT-REF',
                  })),
                },
              ],
            },
          },
        },
      },
    }

    // Convert to XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true,
    })

    const xml = builder.build(reqifDoc)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
  },

  /**
   * Map a requirement to ReqIF SPEC-OBJECT
   */
  mapRequirementToSpecObject(req: any): ReqIFSpecObject {
    const now = new Date().toISOString()
    const values: any[] = []

    // Add standard ReqIF attributes
    if (req.requirementId) {
      values.push({
        identifier: 'req-id',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-id-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.requirementId,
      })
    }

    values.push({
      identifier: 'req-title',
      type: 'ATTRIBUTE-VALUE-STRING',
      definition: { identifier: 'req-title-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
      value: req.title || '',
    })

    values.push({
      identifier: 'req-description',
      type: 'ATTRIBUTE-VALUE-XHTML',
      definition: { identifier: 'req-desc-def', type: 'ATTRIBUTE-DEFINITION-XHTML' },
      value: `<div>${this.escapeXml(req.description || '')}</div>`,
    })

    if (req.priority) {
      values.push({
        identifier: 'req-priority',
        type: 'ATTRIBUTE-VALUE-ENUMERATION',
        definition: { identifier: 'req-priority-def', type: 'ATTRIBUTE-DEFINITION-ENUMERATION' },
        value: req.priority,
      })
    }

    if (req.status) {
      values.push({
        identifier: 'req-status',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-status-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.status,
      })
    }

    if (req.requirementType) {
      values.push({
        identifier: 'req-type',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-type-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.requirementType,
      })
    }

    if (req.requirementLevel) {
      values.push({
        identifier: 'req-level',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-level-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.requirementLevel,
      })
    }

    if (req.risk) {
      values.push({
        identifier: 'req-risk',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-risk-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.risk,
      })
    }

    if (req.complexity) {
      values.push({
        identifier: 'req-complexity',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-complexity-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.complexity,
      })
    }

    if (req.rationale) {
      values.push({
        identifier: 'req-rationale',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-rationale-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.rationale,
      })
    }

    if (req.assumptions) {
      values.push({
        identifier: 'req-assumptions',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-assumptions-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.assumptions,
      })
    }

    if (req.verificationStatus) {
      values.push({
        identifier: 'req-verification-status',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-verification-status-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.verificationStatus,
      })
    }

    if (req.verificationNotes) {
      values.push({
        identifier: 'req-verification-notes',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-verification-notes-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.verificationNotes,
      })
    }

    if (req.owner) {
      values.push({
        identifier: 'req-owner',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-owner-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.owner,
      })
    }

    if (req.category) {
      values.push({
        identifier: 'req-category',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-category-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.category,
      })
    }

    if (req.source) {
      values.push({
        identifier: 'req-source',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-source-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.source,
      })
    }

    if (req.tags && req.tags.length > 0) {
      values.push({
        identifier: 'req-tags',
        type: 'ATTRIBUTE-VALUE-STRING',
        definition: { identifier: 'req-tags-def', type: 'ATTRIBUTE-DEFINITION-STRING' },
        value: req.tags.join(', '),
      })
    }

    return {
      identifier: `specobj-${req.id}`,
      longName: req.title,
      type: 'SPEC-OBJECT',
      lastChange: req.updatedAt ? new Date(req.updatedAt).toISOString() : now,
      values,
    }
  },

  /**
   * Import requirements from ReqIF format
   */
  async importFromReqIF(projectId: string, reqifXml: string): Promise<{
    created: number
    updated: number
    skipped: number
    errors: Array<{ row: number; errors: string[] }>
  }> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
    })

    let reqifDoc: ReqIFDocument
    try {
      reqifDoc = parser.parse(reqifXml) as ReqIFDocument
    } catch (error: any) {
      throw new Error(`Invalid ReqIF XML: ${error.message}`)
    }

    const reqifContent = reqifDoc['reqif:REQ-IF']?.['reqif:CORE-CONTENT']?.['reqif:REQ-IF-CONTENT']
    if (!reqifContent) {
      throw new Error('Invalid ReqIF structure: missing REQ-IF-CONTENT')
    }

    const specObjects = reqifContent['reqif:SPEC-OBJECTS']?.['reqif:SPEC-OBJECT'] || []
    if (!Array.isArray(specObjects)) {
      throw new Error('Invalid ReqIF structure: SPEC-OBJECTS must be an array')
    }

    const created: number[] = []
    const updated: number[] = []
    const skipped: number[] = []
    const errors: Array<{ row: number; errors: string[] }> = []

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // Process each spec object
    for (let i = 0; i < specObjects.length; i++) {
      const specObj = specObjects[i]
      try {
        const requirement = this.mapSpecObjectToRequirement(specObj, projectId)

        // Check if requirement already exists (by requirementId if available)
        let existing = null
        if (requirement.requirementId) {
          existing = await prisma.requirement.findFirst({
            where: {
              projectId,
              requirementId: requirement.requirementId,
            },
          })
        }

        if (existing) {
          // Update existing requirement
          await prisma.requirement.update({
            where: { id: existing.id },
            data: {
              title: requirement.title,
              description: requirement.description,
              priority: requirement.priority || existing.priority,
              status: requirement.status || existing.status,
              requirementType: requirement.requirementType || existing.requirementType,
              requirementLevel: requirement.requirementLevel || existing.requirementLevel,
              risk: requirement.risk || existing.risk,
              complexity: requirement.complexity || existing.complexity,
              rationale: requirement.rationale || existing.rationale,
              assumptions: requirement.assumptions || existing.assumptions,
              owner: requirement.owner || existing.owner,
              category: requirement.category || existing.category,
              source: requirement.source || existing.source,
              tags: requirement.tags || existing.tags,
              verificationStatus: requirement.verificationStatus || existing.verificationStatus,
              verificationNotes: requirement.verificationNotes || existing.verificationNotes,
            },
          })
          updated.push(i)
        } else {
          // Create new requirement
          await prisma.requirement.create({
            data: {
              ...requirement,
              projectId,
              priority: requirement.priority || 'medium',
              status: requirement.status || 'draft',
            },
          })
          created.push(i)
        }
      } catch (error: any) {
        errors.push({
          row: i + 1,
          errors: [error.message || 'Failed to import requirement'],
        })
        skipped.push(i)
      }
    }

    return {
      created: created.length,
      updated: updated.length,
      skipped: skipped.length,
      errors,
    }
  },

  /**
   * Map ReqIF SPEC-OBJECT to requirement DTO
   */
  mapSpecObjectToRequirement(specObj: ReqIFSpecObject, projectId: string): any {
    const values = specObj.values || []
    const requirement: any = {
      projectId,
    }

    // Extract values from ReqIF attributes
    values.forEach((attr) => {
      const identifier = attr.identifier || ''
      const value = attr.value || ''

      if (identifier.includes('req-id') || identifier.includes('requirement-id')) {
        requirement.requirementId = value
      } else if (identifier.includes('req-title') || identifier.includes('title')) {
        requirement.title = value
      } else if (identifier.includes('req-description') || identifier.includes('description')) {
        // Extract text from XHTML
        requirement.description = this.extractTextFromXhtml(value)
      } else if (identifier.includes('req-priority') || identifier.includes('priority')) {
        requirement.priority = value
      } else if (identifier.includes('req-status') || identifier.includes('status')) {
        requirement.status = value
      } else if (identifier.includes('req-type') || identifier.includes('type')) {
        requirement.requirementType = value
      } else if (identifier.includes('req-level') || identifier.includes('level')) {
        requirement.requirementLevel = value
      } else if (identifier.includes('req-risk') || identifier.includes('risk')) {
        requirement.risk = value
      } else if (identifier.includes('req-complexity') || identifier.includes('complexity')) {
        requirement.complexity = value
      } else if (identifier.includes('req-rationale') || identifier.includes('rationale')) {
        requirement.rationale = value
      } else if (identifier.includes('req-assumptions') || identifier.includes('assumptions')) {
        requirement.assumptions = value
      } else if (identifier.includes('req-owner') || identifier.includes('owner')) {
        requirement.owner = value
      } else if (identifier.includes('req-category') || identifier.includes('category')) {
        requirement.category = value
      } else if (identifier.includes('req-source') || identifier.includes('source')) {
        requirement.source = value
      } else if (identifier.includes('req-tags') || identifier.includes('tags')) {
        requirement.tags = typeof value === 'string' ? value.split(',').map((t) => t.trim()) : []
      } else if (identifier.includes('req-verification-status')) {
        requirement.verificationStatus = value
      } else if (identifier.includes('req-verification-notes')) {
        requirement.verificationNotes = value
      }
    })

    // Use longName as title if title not found
    if (!requirement.title && specObj.longName) {
      requirement.title = specObj.longName
    }

    // Use identifier as requirementId if not found
    if (!requirement.requirementId && specObj.identifier) {
      requirement.requirementId = specObj.identifier.replace('specobj-', '')
    }

    // Ensure required fields
    if (!requirement.title) {
      requirement.title = specObj.identifier || 'Untitled Requirement'
    }
    if (!requirement.description) {
      requirement.description = ''
    }

    return requirement
  },

  /**
   * Extract plain text from XHTML content
   */
  extractTextFromXhtml(xhtml: string): string {
    if (!xhtml) return ''
    // Simple extraction - remove HTML tags
    return xhtml
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  },

  /**
   * Escape XML special characters
   */
  escapeXml(text: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  },
}
