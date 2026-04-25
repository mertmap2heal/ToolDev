import { prisma } from '../lib/prisma'

/**
 * Parameter scenarios — named what-if overlays. A scenario stores
 * (parameterId -> overrideValue) pairs. Applying it returns the live
 * parameter set with the override values swapped in for the matching
 * rows; the underlying Parameter rows are never mutated.
 */

export async function listScenarios(projectId: string) {
  const list = await prisma.parameterScenario.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { overrides: true } } },
  })
  return list.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    description: s.description,
    createdBy: s.createdBy,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    overrideCount: s._count.overrides,
  }))
}

export async function getScenario(scenarioId: string, projectId: string) {
  return prisma.parameterScenario.findFirst({
    where: { id: scenarioId, projectId },
    include: { overrides: true },
  })
}

export async function createScenario(args: {
  projectId: string
  createdBy: string
  name: string
  description?: string
  overrides?: Array<{ parameterId: string; value: string }>
}) {
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.parameterScenario.create({
      data: {
        projectId: args.projectId,
        createdBy: args.createdBy,
        name: args.name,
        description: args.description,
      },
    })
    if (args.overrides && args.overrides.length > 0) {
      await tx.parameterScenarioOverride.createMany({
        data: args.overrides.map((o) => ({
          scenarioId: scenario.id,
          parameterId: o.parameterId,
          value: o.value,
        })),
      })
    }
    return scenario
  })
}

export async function updateScenario(args: {
  scenarioId: string
  projectId: string
  name?: string
  description?: string
  overrides?: Array<{ parameterId: string; value: string }>
}) {
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.parameterScenario.update({
      where: { id: args.scenarioId },
      data: {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
      },
    })
    if (args.overrides) {
      // Replace strategy: drop everything + reinsert. Simpler than diffing.
      await tx.parameterScenarioOverride.deleteMany({
        where: { scenarioId: args.scenarioId },
      })
      if (args.overrides.length > 0) {
        await tx.parameterScenarioOverride.createMany({
          data: args.overrides.map((o) => ({
            scenarioId: args.scenarioId,
            parameterId: o.parameterId,
            value: o.value,
          })),
        })
      }
    }
    return scenario
  })
}

export async function deleteScenario(scenarioId: string, projectId: string) {
  await prisma.parameterScenario.deleteMany({
    where: { id: scenarioId, projectId },
  })
}

/**
 * Set or update a single override on a scenario. Convenience for the
 * "right-click parameter -> add to scenario" flow.
 */
export async function setOverride(args: {
  scenarioId: string
  parameterId: string
  value: string
}) {
  return prisma.parameterScenarioOverride.upsert({
    where: {
      scenarioId_parameterId: {
        scenarioId: args.scenarioId,
        parameterId: args.parameterId,
      },
    },
    update: { value: args.value },
    create: { scenarioId: args.scenarioId, parameterId: args.parameterId, value: args.value },
  })
}

export async function removeOverride(scenarioId: string, parameterId: string) {
  await prisma.parameterScenarioOverride.deleteMany({
    where: { scenarioId, parameterId },
  })
}
