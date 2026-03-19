/**
 * Strategy Pattern for test execution behaviors.
 * Manual vs Automated workflows differ in audit requirements and allowed transitions.
 */
import type { VerTestRunResult } from '@prisma/client'
import { prisma } from '../../../lib/prisma'

export interface ExecutionStrategy {
  canUpdateStatus(result: VerTestRunResult, newStatus: string): boolean
  recordAuditEvent(params: {
    projectId: string
    entityType: string
    entityId: string
    action: string
    oldValue?: unknown
    newValue?: unknown
    performedByUserId?: string | null
  }): Promise<void>
}

export class ManualExecutionStrategy implements ExecutionStrategy {
  canUpdateStatus(_result: VerTestRunResult, newStatus: string): boolean {
    const allowed = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'PASSED_WITH_ERRORS']
    return allowed.includes(newStatus)
  }

  async recordAuditEvent(params: {
    projectId: string
    entityType: string
    entityId: string
    action: string
    oldValue?: unknown
    newValue?: unknown
    performedByUserId?: string | null
  }): Promise<void> {
    await prisma.verAuditEvent.create({
      data: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue != null ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
        newValue: params.newValue != null ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
        performedByUserId: params.performedByUserId ?? undefined,
      },
    })
  }
}

export class AutomatedExecutionStrategy implements ExecutionStrategy {
  canUpdateStatus(_result: VerTestRunResult, newStatus: string): boolean {
    const allowed = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'PASSED_WITH_ERRORS']
    return allowed.includes(newStatus)
  }

  async recordAuditEvent(params: {
    projectId: string
    entityType: string
    entityId: string
    action: string
    oldValue?: unknown
    newValue?: unknown
    performedByUserId?: string | null
  }): Promise<void> {
    // Minimal audit for automation - still record but automation source
    await prisma.verAuditEvent.create({
      data: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue != null ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
        newValue: params.newValue != null ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
        performedByUserId: params.performedByUserId ?? undefined,
      },
    })
  }
}

export function getExecutionStrategy(executionContext: Record<string, unknown> | null | undefined): ExecutionStrategy {
  if (executionContext?.source === 'automated') {
    return new AutomatedExecutionStrategy()
  }
  return new ManualExecutionStrategy()
}
