import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as definitionEntryService from '../services/definitionEntry.service'
import type { DefinitionEntryType } from '../services/definitionEntry.service'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { type, search } = req.query as { type?: string; search?: string }
    const validType = type === 'glossary' || type === 'abbreviation' ? (type as DefinitionEntryType) : undefined
    const entries = await definitionEntryService.listDefinitionEntries(projectId, {
      type: validType,
      search,
    })
    res.json({ success: true, data: entries })
  } catch (error) {
    console.error('List definition entries error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const entry = await definitionEntryService.getDefinitionEntry(projectId, id)
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Definition entry not found' })
    }
    res.json({ success: true, data: entry })
  } catch (error) {
    console.error('Get definition entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const body = req.body as {
      type?: string
      term?: string
      definition?: string
      notes?: string | null
      source?: string | null
    }
    const type = body.type === 'abbreviation' ? 'abbreviation' : 'glossary'
    const term = typeof body.term === 'string' ? body.term.trim() : ''
    const definition = typeof body.definition === 'string' ? body.definition : ''
    if (!term) {
      return res.status(400).json({ success: false, error: 'Term is required' })
    }
    if (!definition) {
      return res.status(400).json({ success: false, error: 'Definition is required' })
    }
    const entry = await definitionEntryService.createDefinitionEntry(
      projectId,
      { type, term, definition, notes: body.notes ?? null, source: body.source ?? null },
      req.userId
    )
    res.status(201).json({ success: true, data: entry })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; term?: string }
    if (err.code === 'DUPLICATE_TERM') {
      return res.status(409).json({
        success: false,
        error: 'This term already exists in the project. Use the existing definition in Archive → Glossary & Abbreviations.',
        code: 'DUPLICATE_TERM',
        term: err.term,
      })
    }
    console.error('Create definition entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const body = req.body as {
      type?: string
      term?: string
      definition?: string
      notes?: string | null
      source?: string | null
    }
    const dto: definitionEntryService.UpdateDefinitionEntryDto = {}
    if (body.type === 'abbreviation' || body.type === 'glossary') dto.type = body.type
    if (typeof body.term === 'string') dto.term = body.term
    if (typeof body.definition === 'string') dto.definition = body.definition
    if (body.notes !== undefined) dto.notes = body.notes
    if (body.source !== undefined) dto.source = body.source
    const entry = await definitionEntryService.updateDefinitionEntry(projectId, id, dto)
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Definition entry not found' })
    }
    res.json({ success: true, data: entry })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; term?: string }
    if (err.code === 'DUPLICATE_TERM') {
      return res.status(409).json({
        success: false,
        error: 'This term already exists in the project.',
        code: 'DUPLICATE_TERM',
        term: err.term,
      })
    }
    console.error('Update definition entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const entry = await definitionEntryService.deleteDefinitionEntry(projectId, id)
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Definition entry not found' })
    }
    res.json({ success: true, data: { id: entry.id } })
  } catch (error) {
    console.error('Delete definition entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const usage = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const requirements = await definitionEntryService.getDefinitionUsage(projectId, id)
    if (requirements === null) {
      return res.status(404).json({ success: false, error: 'Definition entry not found' })
    }
    res.json({ success: true, data: requirements })
  } catch (error) {
    console.error('Definition usage error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
