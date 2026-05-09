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

  // Bug fix: exclude soft-deleted requirements (project-wide soft-delete rule).
  // Memory: chunk requirement scan + finding inserts so very large projects
  // don't hold rules x requirements rows in memory before insert.
  const REQ_CHUNK = 500
  const FIND_CHUNK = 1000
  let cursor: string | undefined = undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const chunk: Array<{
      id: string
      requirementId: string | null
      title: string
      acceptanceCriteria: string | null
      owner: string | null
      verificationMethod: string | null
    }> = await prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        requirementId: true,
        title: true,
        acceptanceCriteria: true,
        owner: true,
        verificationMethod: true,
      },
      orderBy: { id: 'asc' },
      take: REQ_CHUNK,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (chunk.length === 0) break

    const chunkFindings: Array<{
      projectId: string
      runId: string
      ruleId: string
      status: string
      entityType: string
      entityId: string
      message: string | null
    }> = []
    for (const rule of rules) {
      for (const req of chunk) {
        const { status, message } = evaluateRule(rule, {
          id: req.id,
          requirementId: req.requirementId,
          title: req.title,
          acceptanceCriteria: req.acceptanceCriteria,
          owner: req.owner,
          verificationMethod: req.verificationMethod,
        })
        chunkFindings.push({
          projectId,
          runId: run.id,
          ruleId: rule.id,
          status,
          entityType: 'requirement',
          entityId: req.id,
          message: message ?? null,
        })
      }
    }

    for (let i = 0; i < chunkFindings.length; i += FIND_CHUNK) {
      await prisma.complianceFinding.createMany({
        data: chunkFindings.slice(i, i + FIND_CHUNK),
      })
    }

    cursor = chunk[chunk.length - 1].id
    if (chunk.length < REQ_CHUNK) break
  }

  const created = await prisma.complianceFinding.findMany({
    where: { runId: run.id },
    include: { rule: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  })

  return { run, findings: created, error: null }
}
