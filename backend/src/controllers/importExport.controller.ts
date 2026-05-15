import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'
import taskService from '../services/task.service'

/**
 * #291 (CSV injection, CWE-1236): neutralise Excel/LibreOffice formula
 * triggers by prefixing them with a single apostrophe before applying
 * the RFC-4180 quote/escape rules. Without this, an attacker who can set
 * a task title can ship =HYPERLINK / =IMPORTXML / DDE payloads into an
 * auditor's spreadsheet.
 */
const FORMULA_PREFIXES = /^[=+\-@\t\r]/

function csvSafeCell(raw: string): string {
  const neutralised = FORMULA_PREFIXES.test(raw) ? `'${raw}` : raw
  if (
    neutralised.includes(',') ||
    neutralised.includes('"') ||
    neutralised.includes('\n') ||
    neutralised.includes('\r')
  ) {
    return `"${neutralised.replace(/"/g, '""')}"`
  }
  return neutralised
}


export const exportTasks = async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      status,
      priority,
      due_from,
      due_to,
      columns,
    } = req.body

    // #291: projectId is validated by requireBodyProjectMember upstream.
    // Force the filter to exactly that id so the controller cannot be
    // talked into an unscoped dump by setting project_id = undefined.
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id is required' })
    }

    const filters: any = {
      projectId: project_id,
      status: status || undefined,
      priority: priority || undefined,
      dueFrom: due_from || undefined,
      dueTo: due_to || undefined,
      page: 1,
      pageSize: 10000, // Get all tasks for export
    }

    const { tasks } = await taskService.listTasks(filters)

    // Default columns if not specified
    const exportColumns = columns || ['title', 'status', 'priority', 'due_date', 'tags']

    // Convert to CSV
    const csvRows: string[] = []

    // Header row
    csvRows.push(exportColumns.join(','))

    // Data rows
    for (const task of tasks) {
      const row: string[] = []
      for (const col of exportColumns) {
        let value: string = ''
        switch (col) {
          case 'title':
            value = task.title || ''
            break
          case 'description':
            value = task.descriptionRich || ''
            break
          case 'status':
            value = task.status || ''
            break
          case 'priority':
            value = task.priority || ''
            break
          case 'due_date':
            value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
            break
          case 'start_date':
            value = task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ''
            break
          case 'tags':
            value = task.tags?.map((t: any) => t.tag?.name).filter(Boolean).join(';') || ''
            break
          case 'estimate_minutes':
            value = task.estimateMinutes ? String(task.estimateMinutes) : ''
            break
          default:
            value = ''
        }
        // #291: neutralise formula triggers, then RFC-4180 quote.
        row.push(csvSafeCell(value))
      }
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.csv"`)
    res.send(csv)
  } catch (error: any) {
    console.error('Export tasks error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const importTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { csv_data, project_id, mapping } = req.body

    if (!csv_data) {
      return res.status(400).json({
        success: false,
        error: 'csv_data is required',
      })
    }
    // #291: must scope imports to a specific project. The route-level
    // requireBodyProjectMember middleware guarantees membership, but we
    // assert again here for defense-in-depth.
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id is required' })
    }

    // Parse CSV (simple parsing for MVP)
    const lines = csv_data.split('\n').filter((line: string) => line.trim())
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'CSV must have at least a header and one data row',
      })
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
    const dataRows = lines.slice(1)

    // Default mapping if not provided
    const columnMapping = mapping || {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      due_date: 'due_date',
      tags: 'tags',
    }

    const results: any[] = []
    const errors: any[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const values = row.split(',').map((v: string) => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))

      try {
        const taskData: any = {
          projectId: project_id,
        }

        // Map columns
        for (const [targetField, sourceColumn] of Object.entries(columnMapping)) {
          const columnIndex = headers.indexOf(sourceColumn as string)
          if (columnIndex >= 0 && values[columnIndex]) {
            const value = values[columnIndex]
            switch (targetField) {
              case 'title':
                taskData.title = value
                break
              case 'description':
                taskData.descriptionRich = value
                break
              case 'status':
                taskData.status = value.toUpperCase()
                break
              case 'priority':
                taskData.priority = value.toUpperCase()
                break
              case 'due_date':
                taskData.dueDate = value
                break
              case 'start_date':
                taskData.startDate = value
                break
              case 'tags':
                // Tags will be handled separately
                break
            }
          }
        }

        if (!taskData.title) {
          errors.push({ row: i + 2, error: 'Title is required' })
          continue
        }

        // Create task
        const task = await taskService.createTask(taskData)

        // Handle tags if provided. SEC-2 (#375): TaskTag is project-scoped,
        // so resolve the (projectId, name) compound key from the newly-
        // created task's projectId. If a tag with that name does not exist
        // for this project, create one scoped to the project.
        const tagsColumnIndex = headers.indexOf(columnMapping.tags || 'tags')
        if (tagsColumnIndex >= 0 && values[tagsColumnIndex] && task.projectId) {
          const tagNames = values[tagsColumnIndex].split(';').map((t: string) => t.trim()).filter(Boolean)
          for (const tagName of tagNames) {
            let tag = await prisma.taskTag.findUnique({
              where: {
                projectId_name: {
                  projectId: task.projectId,
                  name: tagName,
                },
              },
            })
            if (!tag) {
              tag = await prisma.taskTag.create({
                data: {
                  name: tagName,
                  projectId: task.projectId,
                },
              })
            }
            // Link tag
            await prisma.taskTagLink.create({
              data: {
                taskId: task.id,
                tagId: tag.id,
              },
            }).catch(() => {
              // Ignore if already linked
            })
          }
        }

        results.push({ row: i + 2, taskId: task.id, title: task.title })
      } catch (error: any) {
        errors.push({ row: i + 2, error: error.message || 'Failed to create task' })
      }
    }

    res.json({
      success: true,
      data: {
        imported: results.length,
        errorCount: errors.length,
        results,
        errors: errors.slice(0, 10), // Limit error details
      },
    })
  } catch (error: any) {
    console.error('Import tasks error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
