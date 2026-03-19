import { prisma } from '../lib/prisma'


export type CheckType =
  | 'requirement_has_acceptance_criteria'
  | 'requirement_has_owner'
  | 'requirement_has_verification_method'

function evaluateRule(
  rule: { checkType: string; name: string },
  req: { id: string; requirementId: string | null; title: string; acceptanceCriteria: string | null; owner: string | null; verificationMethod: string | null }
): { status: 'pass' | 'fail'; message?: string } {
  switch (rule.checkType) {
    case 'requirement_has_acceptance_criteria': {
      const ok = !!req.acceptanceCriteria?.trim()
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? undefined : 'Requirement has no acceptance criteria',
      }
    }
    case 'requirement_has_owner': {
      const ok = !!req.owner?.trim()
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? undefined : 'Requirement has no owner',
      }
    }
    case 'requirement_has_verification_method': {
      const ok = !!req.verificationMethod?.trim()
      return {
        status: ok ? 'pass' : 'fail',
        message: ok ? undefined : 'Requirement has no verification method',
      }
    }
    default:
      return { status: 'pass', message: `Unknown check type: ${rule.checkType}` }
  }
}

export async function runComplianceChecks(
  projectId: string,
  options?: { ruleIds?: string[]; name?: string }
) {
  const ruleFilter = options?.ruleIds?.length
    ? { id: { in: options.ruleIds }, isActive: true }
    : { isActive: true }
  const rules = await prisma.complianceRule.findMany({
    where: { projectId, ...ruleFilter },
    orderBy: { createdAt: 'asc' },
  })

  if (rules.length === 0) {
    return {
      run: null,
      findings: [],
      error: 'No active rules to run. Add rules first.',
    }
  }

  const run = await prisma.complianceCheckRun.create({
    data: {
      projectId,
      name: options?.name ?? `Run ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      status: 'completed',
      ruleIds: rules.map((r) => r.id),
    },
  })

  const requirements = await prisma.requirement.findMany({
    where: { projectId },
    select: {
      id: true,
      requirementId: true,
      title: true,
      acceptanceCriteria: true,
      owner: true,
      verificationMethod: true,
    },
  })

  const findings: Array<{
    runId: string
    ruleId: string
    status: string
    entityType: string
    entityId: string
    message: string | null
  }> = []

  for (const rule of rules) {
    for (const req of requirements) {
      const { status, message } = evaluateRule(rule, {
        id: req.id,
        requirementId: req.requirementId,
        title: req.title,
        acceptanceCriteria: req.acceptanceCriteria,
        owner: req.owner,
        verificationMethod: req.verificationMethod,
      })
      findings.push({
        runId: run.id,
        ruleId: rule.id,
        status,
        entityType: 'requirement',
        entityId: req.id,
        message: message ?? null,
      })
    }
  }

  await prisma.complianceFinding.createMany({
    data: findings.map((f) => ({
      projectId,
      runId: f.runId,
      ruleId: f.ruleId,
      status: f.status,
      entityType: f.entityType,
      entityId: f.entityId,
      message: f.message,
    })),
  })

  const created = await prisma.complianceFinding.findMany({
    where: { runId: run.id },
    include: { rule: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  })

  return { run, findings: created, error: null }
}
