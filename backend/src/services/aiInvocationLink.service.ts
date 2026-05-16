// R-5 (#404) — AI-invocation-to-artefact join.
//
// Thin query service over the AiInvocationLink table — the polymorphic join
// that records which artefact(s) an AiInvocation produced or modified. The
// table alone makes the ai-ready-vision.md §6.2 audit queries ("which prompt
// produced REQ-1024", "which invocations touched this artefact") possible; the
// three functions below are what make them answerable.
//
// Forward-only audit fact: this service is the SOLE writer (R-4 posture, no
// append-only $use guard). There is no update or delete surface — links are
// recorded going forward and never mutated.
//
// Services throw plain Errors; controllers translate them to HTTP responses
// (per .claude/kb/backend-patterns.md). This file wires no endpoint — per-
// consumer AI write paths populate the link in their own tickets.
import type { AiInvocation, AiInvocationLink } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Record that an AiInvocation produced or modified an artefact. `artefactType`
 * is the artefact's model name ("Requirement", "VerTestCase", "Parameter", …);
 * `artefactId` is that artefact's id. Polymorphic — no FK on the artefact side,
 * consistent with TraceLink. One invocation may link to many artefacts.
 */
export async function linkInvocationToArtefact(
  invocationId: string,
  artefactType: string,
  artefactId: string,
): Promise<AiInvocationLink> {
  return prisma.aiInvocationLink.create({
    data: { invocationId, artefactType, artefactId },
  })
}

/** Every artefact link recorded for a given invocation, newest first. */
export async function getArtefactsForInvocation(
  invocationId: string,
): Promise<AiInvocationLink[]> {
  return prisma.aiInvocationLink.findMany({
    where: { invocationId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Every invocation that touched a given artefact, newest first. Each row
 * includes the joined `invocation` so the consumer gets `projectId`,
 * `promptId`, `model`, `credentialId`, `createdAt` in one query — that is
 * what answers the ai-ready-vision.md §6.2 audit questions.
 */
export async function getInvocationsForArtefact(
  artefactType: string,
  artefactId: string,
): Promise<(AiInvocationLink & { invocation: AiInvocation })[]> {
  return prisma.aiInvocationLink.findMany({
    where: { artefactType, artefactId },
    include: { invocation: true },
    orderBy: { createdAt: 'desc' },
  })
}
