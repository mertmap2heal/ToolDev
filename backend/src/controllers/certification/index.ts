import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import type { AuthRequest } from '../../middleware/auth.middleware'
import * as certExport from '../../services/certificationExport.service'
import { getObjectiveMatrix as composeObjectiveMatrix } from '../../services/objectiveMatrix.service'

// Issue #163: confirm the authenticated user belongs to the project before
// accepting an identity-bound action. Returns the ProjectMember row or null.
async function assertProjectMember(userId: string, projectId: string) {
  return prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  })
}


// ----- Context -----
export async function getContext(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    let ctx = await prisma.certContext.findUnique({
      where: { projectId },
    })
    if (!ctx) {
      ctx = await prisma.certContext.create({
        data: {
          projectId,
          authority: 'EASA',
          certBasis: 'CS-25',
          standards: ['ARP4754A', 'DO-178C'],
        },
      })
    }
    res.json({
      success: true,
      data: {
        projectId: ctx.projectId,
        projectName: project.name,
        authority: ctx.authority,
        certBasis: ctx.certBasis,
        standards: ctx.standards as string[],
        selectedBaselineId: ctx.selectedBaselineId,
        selectedReleaseId: ctx.selectedReleaseId,
      },
    })
  } catch (e) {
    console.error('Cert getContext error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateContext(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { authority, certBasis, standards, selectedBaselineId, selectedReleaseId } = req.body
    await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const ctx = await prisma.certContext.upsert({
      where: { projectId },
      create: {
        projectId,
        authority: authority ?? 'EASA',
        certBasis: certBasis ?? 'CS-25',
        standards: Array.isArray(standards) ? standards : ['ARP4754A', 'DO-178C'],
        selectedBaselineId: selectedBaselineId ?? null,
        selectedReleaseId: selectedReleaseId ?? null,
      },
      update: {
        ...(authority != null && { authority }),
        ...(certBasis != null && { certBasis }),
        ...(Array.isArray(standards) && { standards }),
        ...(selectedBaselineId !== undefined && { selectedBaselineId: selectedBaselineId || null }),
        ...(selectedReleaseId !== undefined && { selectedReleaseId: selectedReleaseId || null }),
      },
    })
    res.json({ success: true, data: ctx })
  } catch (e) {
    console.error('Cert updateContext error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Baselines -----
export async function getBaselines(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certBaseline.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((b) => ({
        baselineId: b.baselineId,
        name: b.name,
        status: b.status,
      })),
    })
  } catch (e) {
    console.error('Cert getBaselines error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createBaseline(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { baselineId, name, status } = req.body
    if (!baselineId || !name) {
      return res.status(400).json({ success: false, error: 'baselineId and name required' })
    }
    const b = await prisma.certBaseline.create({
      data: { projectId, baselineId, name, status: status ?? 'Draft' },
    })
    res.status(201).json({ success: true, data: { baselineId: b.baselineId, name: b.name, status: b.status } })
  } catch (e) {
    console.error('Cert createBaseline error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Releases -----
export async function getReleases(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certRelease.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((r) => ({
        releaseId: r.releaseId,
        name: r.name,
        status: r.status,
      })),
    })
  } catch (e) {
    console.error('Cert getReleases error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createRelease(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { releaseId, name, status } = req.body
    if (!releaseId || !name) {
      return res.status(400).json({ success: false, error: 'releaseId and name required' })
    }
    const r = await prisma.certRelease.create({
      data: { projectId, releaseId, name, status: status ?? 'Draft' },
    })
    res.status(201).json({ success: true, data: { releaseId: r.releaseId, name: r.name, status: r.status } })
  } catch (e) {
    console.error('Cert createRelease error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Objectives -----
export async function getObjectives(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certObjective.findMany({
      where: { projectId },
      orderBy: { objId: 'asc' },
      include: {
        requirementLinks: { include: { requirement: { select: { id: true, title: true } } } },
      },
    })
    res.json({
      success: true,
      data: list.map((o) => ({
        id: o.id,
        objId: o.objId,
        regRef: o.regRef,
        title: o.title,
        moc: o.moc,
        status: o.status,
        criticality: o.criticality,
        linkedEvidenceCount: o.linkedEvidenceCount,
        linkedCiCount: o.linkedCiCount,
        notes: o.notes,
        reviewed: o.reviewed,
        safetyObjectiveRef: o.safetyObjectiveRef ?? undefined,
        linkedRequirements: o.requirementLinks.map((l) => ({
          id: l.id,
          requirementId: l.requirement.id,
          title: l.requirement.title,
        })),
      })),
    })
  } catch (e) {
    console.error('Cert getObjectives error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createObjective(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { objId, regRef, title, moc, status, criticality, notes } = req.body
    if (!objId || !regRef || !title || !moc) {
      return res.status(400).json({ success: false, error: 'objId, regRef, title, moc required' })
    }
    const o = await prisma.certObjective.create({
      data: {
        projectId,
        objId,
        regRef,
        title,
        moc,
        status: status ?? 'Open',
        criticality: criticality ?? 'Medium',
        notes: notes ?? '',
      },
    })
    res.status(201).json({
      success: true,
      data: {
        objId: o.objId,
        regRef: o.regRef,
        title: o.title,
        moc: o.moc,
        status: o.status,
        criticality: o.criticality,
        linkedEvidenceCount: o.linkedEvidenceCount,
        linkedCiCount: o.linkedCiCount,
        notes: o.notes,
        reviewed: o.reviewed,
      },
    })
  } catch (e) {
    console.error('Cert createObjective error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateObjective(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certObjective.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Objective not found' })
    }
    const o = await prisma.certObjective.update({
      where: { id },
      data: {
        ...(body.regRef != null && { regRef: body.regRef }),
        ...(body.title != null && { title: body.title }),
        ...(body.moc != null && { moc: body.moc }),
        ...(body.status != null && { status: body.status }),
        ...(body.criticality != null && { criticality: body.criticality }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.reviewed !== undefined && { reviewed: body.reviewed }),
        ...(body.safetyObjectiveRef !== undefined && { safetyObjectiveRef: body.safetyObjectiveRef || null }),
        ...(typeof body.linkedEvidenceCount === 'number' && { linkedEvidenceCount: body.linkedEvidenceCount }),
        ...(typeof body.linkedCiCount === 'number' && { linkedCiCount: body.linkedCiCount }),
      },
    })
    res.json({
      success: true,
      data: {
        objId: o.objId,
        regRef: o.regRef,
        title: o.title,
        moc: o.moc,
        status: o.status,
        criticality: o.criticality,
        linkedEvidenceCount: o.linkedEvidenceCount,
        linkedCiCount: o.linkedCiCount,
        notes: o.notes,
        reviewed: o.reviewed,
        safetyObjectiveRef: o.safetyObjectiveRef ?? undefined,
      },
    })
  } catch (e) {
    console.error('Cert updateObjective error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Compliance matrix -----
export async function getComplianceMatrix(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certComplianceMatrixRow.findMany({
      where: { projectId },
      orderBy: { regRef: 'asc' },
    })
    res.json({
      success: true,
      data: list.map((r) => ({
        regRef: r.regRef,
        objectiveCount: r.objectiveCount,
        mocMix: r.mocMix as Record<string, number>,
        statusSummary: r.statusSummary as { complete: number; partial: number; open: number; blocked: number },
        evidenceCount: r.evidenceCount,
        lastUpdated: r.lastUpdated.toISOString(),
      })),
    })
  } catch (e) {
    console.error('Cert getComplianceMatrix error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function upsertComplianceMatrixRow(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { regRef, objectiveCount, mocMix, statusSummary, evidenceCount } = req.body
    if (!regRef) {
      return res.status(400).json({ success: false, error: 'regRef required' })
    }
    const row = await prisma.certComplianceMatrixRow.upsert({
      where: { projectId_regRef: { projectId, regRef } },
      create: {
        projectId,
        regRef,
        objectiveCount: objectiveCount ?? 0,
        mocMix: mocMix ?? {},
        statusSummary: statusSummary ?? { complete: 0, partial: 0, open: 0, blocked: 0 },
        evidenceCount: evidenceCount ?? 0,
      },
      update: {
        ...(typeof objectiveCount === 'number' && { objectiveCount }),
        ...(mocMix != null && { mocMix }),
        ...(statusSummary != null && { statusSummary }),
        ...(typeof evidenceCount === 'number' && { evidenceCount }),
        lastUpdated: new Date(),
      },
    })
    res.json({
      success: true,
      data: {
        regRef: row.regRef,
        objectiveCount: row.objectiveCount,
        mocMix: row.mocMix as Record<string, number>,
        statusSummary: row.statusSummary as { complete: number; partial: number; open: number; blocked: number },
        evidenceCount: row.evidenceCount,
        lastUpdated: row.lastUpdated.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert upsertComplianceMatrixRow error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Findings -----
export async function getFindings(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certFinding.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((f) => ({
        findingId: f.findingId,
        title: f.title,
        severity: f.severity,
        status: f.status,
        linkedRegRef: f.linkedRegRef,
        linkedObjectives: f.linkedObjectives,
        linkedEvidence: f.linkedEvidence,
        assignedTo: f.assignedTo,
        dueDate: f.dueDate.toISOString(),
        notes: f.notes,
        safetyRelated: f.safetyRelated,
        safetyNcrRef: f.safetyNcrRef ?? undefined,
        createdAt: f.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('Cert getFindings error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createFinding(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const {
      findingId,
      title,
      severity,
      status,
      linkedRegRef,
      linkedObjectives,
      linkedEvidence,
      assignedTo,
      dueDate,
      notes,
      safetyRelated,
      safetyNcrRef,
    } = req.body
    if (!findingId || !title || !assignedTo || !dueDate) {
      return res.status(400).json({ success: false, error: 'findingId, title, assignedTo, dueDate required' })
    }
    const f = await prisma.certFinding.create({
      data: {
        projectId,
        findingId,
        title,
        severity: severity ?? 'Minor',
        status: status ?? 'Open',
        linkedRegRef: linkedRegRef ?? null,
        linkedObjectives: Array.isArray(linkedObjectives) ? linkedObjectives : [],
        linkedEvidence: Array.isArray(linkedEvidence) ? linkedEvidence : [],
        assignedTo,
        dueDate: new Date(dueDate),
        notes: notes ?? '',
        safetyRelated: safetyRelated === true,
        safetyNcrRef: safetyNcrRef ?? null,
      },
    })
    res.status(201).json({
      success: true,
      data: {
        findingId: f.findingId,
        title: f.title,
        severity: f.severity,
        status: f.status,
        linkedRegRef: f.linkedRegRef,
        linkedObjectives: f.linkedObjectives,
        linkedEvidence: f.linkedEvidence,
        assignedTo: f.assignedTo,
        dueDate: f.dueDate.toISOString(),
        notes: f.notes,
        safetyRelated: f.safetyRelated,
        safetyNcrRef: f.safetyNcrRef ?? undefined,
        createdAt: f.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert createFinding error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateFinding(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certFinding.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Finding not found' })
    }
    const f = await prisma.certFinding.update({
      where: { id },
      data: {
        ...(body.title != null && { title: body.title }),
        ...(body.severity != null && { severity: body.severity }),
        ...(body.status != null && { status: body.status }),
        ...(body.linkedRegRef !== undefined && { linkedRegRef: body.linkedRegRef || null }),
        ...(Array.isArray(body.linkedObjectives) && { linkedObjectives: body.linkedObjectives }),
        ...(Array.isArray(body.linkedEvidence) && { linkedEvidence: body.linkedEvidence }),
        ...(body.assignedTo != null && { assignedTo: body.assignedTo }),
        ...(body.dueDate != null && { dueDate: new Date(body.dueDate) }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.safetyRelated !== undefined && { safetyRelated: body.safetyRelated === true }),
        ...(body.safetyNcrRef !== undefined && { safetyNcrRef: body.safetyNcrRef || null }),
      },
    })
    res.json({
      success: true,
      data: {
        findingId: f.findingId,
        title: f.title,
        severity: f.severity,
        status: f.status,
        linkedRegRef: f.linkedRegRef,
        linkedObjectives: f.linkedObjectives,
        linkedEvidence: f.linkedEvidence,
        assignedTo: f.assignedTo,
        dueDate: f.dueDate.toISOString(),
        notes: f.notes,
        safetyRelated: f.safetyRelated,
        safetyNcrRef: f.safetyNcrRef ?? undefined,
        createdAt: f.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert updateFinding error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Review log -----
export async function getReviewLog(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certReviewLogEntry.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((e) => ({
        reviewId: e.reviewId,
        date: e.date.toISOString(),
        reviewType: e.reviewType,
        scopeSummary: e.scopeSummary,
        findingsRaised: e.findingsRaised,
        findingsClosed: e.findingsClosed,
        notes: e.notes,
        status: e.status,
      })),
    })
  } catch (e) {
    console.error('Cert getReviewLog error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createReviewLogEntry(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const {
      reviewId,
      date,
      reviewType,
      scopeSummary,
      findingsRaised,
      findingsClosed,
      notes,
      status,
    } = req.body
    if (!reviewId || !reviewType) {
      return res.status(400).json({ success: false, error: 'reviewId and reviewType required' })
    }
    const e = await prisma.certReviewLogEntry.create({
      data: {
        projectId,
        reviewId,
        date: date ? new Date(date) : undefined,
        reviewType,
        scopeSummary: scopeSummary ?? '',
        findingsRaised: typeof findingsRaised === 'number' ? findingsRaised : 0,
        findingsClosed: typeof findingsClosed === 'number' ? findingsClosed : 0,
        notes: notes ?? '',
        status: status ?? 'Draft',
      },
    })
    res.status(201).json({
      success: true,
      data: {
        reviewId: e.reviewId,
        date: e.date.toISOString(),
        reviewType: e.reviewType,
        scopeSummary: e.scopeSummary,
        findingsRaised: e.findingsRaised,
        findingsClosed: e.findingsClosed,
        notes: e.notes,
        status: e.status,
      },
    })
  } catch (e) {
    console.error('Cert createReviewLogEntry error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateReviewLogEntry(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certReviewLogEntry.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review log entry not found' })
    }
    const e = await prisma.certReviewLogEntry.update({
      where: { id },
      data: {
        ...(body.scopeSummary !== undefined && { scopeSummary: body.scopeSummary }),
        ...(typeof body.findingsRaised === 'number' && { findingsRaised: body.findingsRaised }),
        ...(typeof body.findingsClosed === 'number' && { findingsClosed: body.findingsClosed }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.status != null && { status: body.status }),
      },
    })
    res.json({
      success: true,
      data: {
        reviewId: e.reviewId,
        date: e.date.toISOString(),
        reviewType: e.reviewType,
        scopeSummary: e.scopeSummary,
        findingsRaised: e.findingsRaised,
        findingsClosed: e.findingsClosed,
        notes: e.notes,
        status: e.status,
      },
    })
  } catch (e) {
    console.error('Cert updateReviewLogEntry error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Activity log -----
export async function getActivityLog(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certActivityLogEntry.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: 500,
    })
    res.json({
      success: true,
      data: list.map((a) => ({
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        action: a.action,
        details: a.details,
        actor: a.actor ?? undefined,
      })),
    })
  } catch (e) {
    console.error('Cert getActivityLog error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function appendActivity(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { action, details, actor } = req.body
    if (!action || !details) {
      return res.status(400).json({ success: false, error: 'action and details required' })
    }
    const a = await prisma.certActivityLogEntry.create({
      data: { projectId, action, details, actor: actor ?? null },
    })
    res.status(201).json({
      success: true,
      data: {
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        action: a.action,
        details: a.details,
        actor: a.actor ?? undefined,
      },
    })
  } catch (e) {
    console.error('Cert appendActivity error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Readiness gates -----
export async function getReadinessGates(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certReadinessGate.findMany({
      where: { projectId },
      orderBy: { gateId: 'asc' },
    })
    res.json({
      success: true,
      data: list.map((g) => ({
        id: g.gateId,
        label: g.label,
        passed: g.passed,
        reason: g.reason ?? undefined,
      })),
    })
  } catch (e) {
    console.error('Cert getReadinessGates error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateReadinessGate(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const { passed, reason } = req.body
    const existing = await prisma.certReadinessGate.findFirst({
      where: { projectId, gateId: id },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Readiness gate not found' })
    }
    const g = await prisma.certReadinessGate.update({
      where: { id: existing.id },
      data: { ...(typeof passed === 'boolean' && { passed }), ...(reason !== undefined && { reason }) },
    })
    res.json({
      success: true,
      data: { id: g.gateId, label: g.label, passed: g.passed, reason: g.reason ?? undefined },
    })
  } catch (e) {
    console.error('Cert updateReadinessGate error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Packages -----
export async function getPackages(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certPackage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((p) => ({
        id: p.id,
        packageType: p.packageType,
        scopeBaseline: p.scopeBaseline,
        scopeRelease: p.scopeRelease,
        includedRegulations: p.includedRegulations,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('Cert getPackages error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createPackage(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { packageType, scopeBaseline, scopeRelease, includedRegulations, status } = req.body
    const p = await prisma.certPackage.create({
      data: {
        projectId,
        packageType: packageType ?? 'Authority submission',
        scopeBaseline: scopeBaseline ?? null,
        scopeRelease: scopeRelease ?? null,
        includedRegulations: Array.isArray(includedRegulations) ? includedRegulations : [],
        status: status ?? 'Draft',
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: p.id,
        packageType: p.packageType,
        scopeBaseline: p.scopeBaseline,
        scopeRelease: p.scopeRelease,
        includedRegulations: p.includedRegulations,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert createPackage error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Objective–Requirement traceability -----
export async function getObjectiveRequirementLinks(req: AuthRequest, res: Response) {
  try {
    const { projectId, objectiveId } = req.params
    const objective = await prisma.certObjective.findFirst({
      where: { id: objectiveId, projectId },
      include: {
        requirementLinks: { include: { requirement: { select: { id: true, title: true } } } },
      },
    })
    if (!objective) {
      return res.status(404).json({ success: false, error: 'Objective not found' })
    }
    res.json({
      success: true,
      data: objective.requirementLinks.map((l) => ({
        id: l.id,
        requirementId: l.requirement.id,
        title: l.requirement.title,
      })),
    })
  } catch (e) {
    console.error('Cert getObjectiveRequirementLinks error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function addObjectiveRequirementLink(req: AuthRequest, res: Response) {
  try {
    const { projectId, objectiveId } = req.params
    const { requirementId } = req.body
    if (!requirementId) {
      return res.status(400).json({ success: false, error: 'requirementId required' })
    }
    const objective = await prisma.certObjective.findFirst({
      where: { id: objectiveId, projectId },
    })
    if (!objective) {
      return res.status(404).json({ success: false, error: 'Objective not found' })
    }
    const requirement = await prisma.requirement.findFirst({
      where: { id: requirementId, projectId },
    })
    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }
    const link = await prisma.certObjectiveRequirementLink.upsert({
      where: {
        certObjectiveId_requirementId: { certObjectiveId: objectiveId, requirementId },
      },
      create: { certObjectiveId: objectiveId, requirementId },
      update: {},
      include: { requirement: { select: { id: true, title: true } } },
    })
    res.status(201).json({
      success: true,
      data: {
        id: link.id,
        requirementId: link.requirement.id,
        title: link.requirement.title,
      },
    })
  } catch (e) {
    console.error('Cert addObjectiveRequirementLink error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function removeObjectiveRequirementLink(req: AuthRequest, res: Response) {
  try {
    const { projectId, objectiveId, linkId } = req.params
    const link = await prisma.certObjectiveRequirementLink.findFirst({
      where: { id: linkId, certObjectiveId: objectiveId },
      include: { certObjective: { select: { projectId: true } } },
    })
    if (!link || link.certObjective.projectId !== projectId) {
      return res.status(404).json({ success: false, error: 'Link not found' })
    }
    await prisma.certObjectiveRequirementLink.delete({ where: { id: linkId } })
    res.json({ success: true })
  } catch (e) {
    console.error('Cert removeObjectiveRequirementLink error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Exports -----
export async function exportComplianceMatrix(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx'
    const buffer = await certExport.exportComplianceMatrix(projectId, format)
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    res.setHeader('Content-Disposition', `attachment; filename="compliance-matrix.${ext}"`)
    res.setHeader('Content-Type', mime)
    res.send(buffer)
  } catch (e) {
    console.error('Cert exportComplianceMatrix error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function exportEvidenceIndex(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx'
    const buffer = await certExport.exportEvidenceIndex(projectId, format)
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    res.setHeader('Content-Disposition', `attachment; filename="evidence-index.${ext}"`)
    res.setHeader('Content-Type', mime)
    res.send(buffer)
  } catch (e) {
    console.error('Cert exportEvidenceIndex error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function exportSummary(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const buffer = await certExport.exportSummaryPdf(projectId)
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    res.setHeader('Content-Disposition', 'attachment; filename="certification-summary.pdf"')
    res.setHeader('Content-Type', 'application/pdf')
    res.send(buffer)
  } catch (e) {
    console.error('Cert exportSummary error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function exportReviewLog(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx'
    const buffer = await certExport.exportReviewLog(projectId, format)
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    res.setHeader('Content-Disposition', `attachment; filename="review-log.${ext}"`)
    res.setHeader('Content-Type', mime)
    res.send(buffer)
  } catch (e) {
    console.error('Cert exportReviewLog error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function exportActivityLog(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx'
    const buffer = await certExport.exportActivityLog(projectId, format)
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    const ext = format === 'pdf' ? 'pdf' : 'xlsx'
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    res.setHeader('Content-Disposition', `attachment; filename="activity-log.${ext}"`)
    res.setHeader('Content-Type', mime)
    res.send(buffer)
  } catch (e) {
    console.error('Cert exportActivityLog error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function generatePackageBundleRoute(req: AuthRequest, res: Response) {
  try {
    const { projectId, packageId } = req.params
    const options = req.body || {}
    const result = await certExport.generatePackageBundle(projectId, packageId, {
      includeMatrix: options.includeMatrix !== false,
      includeEvidenceIndex: options.includeEvidenceIndex !== false,
      includeSummary: options.includeSummary !== false,
      includeReviewLog: options.includeReviewLog !== false,
      includeActivityLog: options.includeActivityLog !== false,
    })
    if (!result) {
      return res.status(404).json({ success: false, error: 'Package not found' })
    }
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.setHeader('Content-Type', 'application/zip')
    result.stream.pipe(res)
  } catch (e) {
    console.error('Cert generatePackageBundle error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// N-2.2 (#425) — the one-command, opinionated audit-package export.
//
// Composes the PSAC from the project's CURRENT state and streams a ZIP of
// PSAC.docx / PSAC.pdf / PSAC.json / manifest.json. The projectId is resolved
// by the projectIdParam middleware (membership-checked) — it is read only from
// req.params, never the body. The only client input is `artefactType`, which is
// whitelisted to PSAC.
export async function generateAuditPackageRoute(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const userId = req.userId! // guaranteed by authenticateToken
    // artefactType may arrive as a query param or in the body; default PSAC.
    const rawType =
      (req.body && req.body.artefactType) ?? (req.query.artefactType as string) ?? 'PSAC'
    if (!certExport.isSupportedAuditArtefactType(rawType)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported artefactType "${rawType}". Only PSAC is available.`,
      })
    }

    const result = await certExport.generateAuditPackage(projectId, {
      artefactType: rawType,
      generatedBy: userId,
    })
    if (!result) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }

    // Audit row — the export is a cert-relevant action. detailsJson per R-8.
    // JSON round-trip yields a plain JSON value Prisma accepts as InputJsonValue.
    const auditDetails = JSON.parse(
      JSON.stringify({
        artefactType: rawType,
        files: result.manifest.files.map((f) => f.name),
        graphCounts: result.manifest.graphCounts,
      }),
    )
    await prisma.auditLog
      .create({
        data: {
          projectId,
          userId,
          action: 'certification:audit-package-export',
          detailsJson: auditDetails,
        },
      })
      .catch((e) => console.error('Cert audit-package-export audit log error:', e))

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.setHeader('Content-Type', 'application/zip')
    result.stream.pipe(res)
  } catch (e) {
    console.error('Cert generateAuditPackage error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Full state (for frontend hydration) -----
export async function getFullState(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }

    let ctx = await prisma.certContext.findUnique({ where: { projectId } })
    if (!ctx) {
      ctx = await prisma.certContext.create({
        data: { projectId, authority: 'EASA', certBasis: 'CS-25', standards: ['ARP4754A', 'DO-178C'] },
      })
    }

    const [baselines, releases, objectives, matrixRows, findings, reviewLog, activityLog, readinessGates] =
      await Promise.all([
        prisma.certBaseline.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
        prisma.certRelease.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
        prisma.certObjective.findMany({
          where: { projectId },
          orderBy: { objId: 'asc' },
          include: {
            requirementLinks: { include: { requirement: { select: { id: true, title: true } } } },
          },
        }),
        prisma.certComplianceMatrixRow.findMany({ where: { projectId }, orderBy: { regRef: 'asc' } }),
        prisma.certFinding.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
        prisma.certReviewLogEntry.findMany({ where: { projectId }, orderBy: { date: 'desc' } }),
        prisma.certActivityLogEntry.findMany({ where: { projectId }, orderBy: { timestamp: 'desc' }, take: 200 }),
        prisma.certReadinessGate.findMany({ where: { projectId }, orderBy: { gateId: 'asc' } }),
      ])

    res.json({
      success: true,
      data: {
        context: {
          projectId: ctx.projectId,
          projectName: project.name,
          authority: ctx.authority,
          certBasis: ctx.certBasis,
          standards: ctx.standards as string[],
          selectedBaseline: ctx.selectedBaselineId
            ? baselines.find((b) => b.baselineId === ctx!.selectedBaselineId)
              ? {
                  baselineId: baselines.find((b) => b.baselineId === ctx!.selectedBaselineId)!.baselineId,
                  name: baselines.find((b) => b.baselineId === ctx!.selectedBaselineId)!.name,
                  status: baselines.find((b) => b.baselineId === ctx!.selectedBaselineId)!.status,
                }
              : null
            : null,
          selectedRelease: ctx.selectedReleaseId
            ? releases.find((r) => r.releaseId === ctx!.selectedReleaseId)
              ? {
                  releaseId: releases.find((r) => r.releaseId === ctx!.selectedReleaseId)!.releaseId,
                  name: releases.find((r) => r.releaseId === ctx!.selectedReleaseId)!.name,
                  status: releases.find((r) => r.releaseId === ctx!.selectedReleaseId)!.status,
                }
              : null
            : null,
        },
        baselines: baselines.map((b) => ({ baselineId: b.baselineId, name: b.name, status: b.status })),
        releases: releases.map((r) => ({ releaseId: r.releaseId, name: r.name, status: r.status })),
        objectives: objectives.map((o) => ({
          id: o.id,
          objId: o.objId,
          regRef: o.regRef,
          title: o.title,
          moc: o.moc,
          status: o.status,
          criticality: o.criticality,
          linkedEvidenceCount: o.linkedEvidenceCount,
          linkedCiCount: o.linkedCiCount,
          notes: o.notes,
          reviewed: o.reviewed,
          safetyObjectiveRef: o.safetyObjectiveRef ?? undefined,
          linkedRequirements: o.requirementLinks.map((l) => ({
            id: l.id,
            requirementId: l.requirement.id,
            title: l.requirement.title,
          })),
        })),
        complianceMatrix: matrixRows.map((r) => ({
          regRef: r.regRef,
          objectiveCount: r.objectiveCount,
          mocMix: r.mocMix as Record<string, number>,
          statusSummary: r.statusSummary as { complete: number; partial: number; open: number; blocked: number },
          evidenceCount: r.evidenceCount,
          lastUpdated: r.lastUpdated.toISOString(),
        })),
        findings: findings.map((f) => ({
          id: f.id,
          findingId: f.findingId,
          title: f.title,
          severity: f.severity,
          status: f.status,
          linkedRegRef: f.linkedRegRef,
          linkedObjectives: f.linkedObjectives,
          linkedEvidence: f.linkedEvidence,
          assignedTo: f.assignedTo,
          dueDate: f.dueDate.toISOString(),
          notes: f.notes,
          safetyRelated: f.safetyRelated,
          safetyNcrRef: f.safetyNcrRef ?? undefined,
          createdAt: f.createdAt.toISOString(),
        })),
        reviewLog: reviewLog.map((e) => ({
          id: e.id,
          reviewId: e.reviewId,
          date: e.date.toISOString(),
          reviewType: e.reviewType,
          scopeSummary: e.scopeSummary,
          findingsRaised: e.findingsRaised,
          findingsClosed: e.findingsClosed,
          notes: e.notes,
          status: e.status,
        })),
        activityLog: activityLog.map((a) => ({
          id: a.id,
          timestamp: a.timestamp.toISOString(),
          action: a.action,
          details: a.details,
          actor: a.actor ?? undefined,
        })),
        readinessGates: readinessGates.map((g) => ({
          id: g.gateId,
          label: g.label,
          passed: g.passed,
          reason: g.reason ?? undefined,
        })),
      },
    })
  } catch (e) {
    console.error('Cert getFullState error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Authority: Correspondence -----
export async function getCorrespondence(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certCorrespondence.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    })
    res.json({
      success: true,
      data: list.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        type: c.type,
        authority: c.authority,
        subject: c.subject,
        summary: c.summary,
        attachmentRefs: c.attachmentRefs,
        relatedFindingIds: c.relatedFindingIds,
        relatedObjectiveIds: c.relatedObjectiveIds,
      })),
    })
  } catch (e) {
    console.error('Cert getCorrespondence error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createCorrespondence(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { date, type, authority, subject, summary, attachmentRefs, relatedFindingIds, relatedObjectiveIds } = req.body
    if (!type || !authority) {
      return res.status(400).json({ success: false, error: 'type and authority required' })
    }
    const c = await prisma.certCorrespondence.create({
      data: {
        projectId,
        date: date ? new Date(date) : undefined,
        type,
        authority: authority ?? '',
        subject: subject ?? '',
        summary: summary ?? '',
        attachmentRefs: Array.isArray(attachmentRefs) ? attachmentRefs : [],
        relatedFindingIds: Array.isArray(relatedFindingIds) ? relatedFindingIds : [],
        relatedObjectiveIds: Array.isArray(relatedObjectiveIds) ? relatedObjectiveIds : [],
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: c.id,
        date: c.date.toISOString(),
        type: c.type,
        authority: c.authority,
        subject: c.subject,
        summary: c.summary,
        attachmentRefs: c.attachmentRefs,
        relatedFindingIds: c.relatedFindingIds,
        relatedObjectiveIds: c.relatedObjectiveIds,
      },
    })
  } catch (e) {
    console.error('Cert createCorrespondence error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateCorrespondence(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certCorrespondence.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Correspondence not found' })
    }
    const c = await prisma.certCorrespondence.update({
      where: { id },
      data: {
        ...(body.date != null && { date: new Date(body.date) }),
        ...(body.type != null && { type: body.type }),
        ...(body.authority != null && { authority: body.authority }),
        ...(body.subject != null && { subject: body.subject }),
        ...(body.summary != null && { summary: body.summary }),
        ...(Array.isArray(body.attachmentRefs) && { attachmentRefs: body.attachmentRefs }),
        ...(Array.isArray(body.relatedFindingIds) && { relatedFindingIds: body.relatedFindingIds }),
        ...(Array.isArray(body.relatedObjectiveIds) && { relatedObjectiveIds: body.relatedObjectiveIds }),
      },
    })
    res.json({
      success: true,
      data: {
        id: c.id,
        date: c.date.toISOString(),
        type: c.type,
        authority: c.authority,
        subject: c.subject,
        summary: c.summary,
        attachmentRefs: c.attachmentRefs,
        relatedFindingIds: c.relatedFindingIds,
        relatedObjectiveIds: c.relatedObjectiveIds,
      },
    })
  } catch (e) {
    console.error('Cert updateCorrespondence error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteCorrespondence(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.certCorrespondence.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Correspondence not found' })
    }
    await prisma.certCorrespondence.delete({ where: { id } })
    res.json({ success: true })
  } catch (e) {
    console.error('Cert deleteCorrespondence error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Authority: Meetings -----
export async function getMeetings(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certMeeting.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
      include: { actionItems: true },
    })
    res.json({
      success: true,
      data: list.map((m) => ({
        id: m.id,
        date: m.date.toISOString(),
        type: m.type,
        attendees: m.attendees,
        summary: m.summary,
        actionItems: m.actionItems.map((a) => ({
          id: a.id,
          owner: a.owner,
          dueDate: a.dueDate.toISOString(),
          status: a.status,
          description: a.description,
          linkedFindingId: a.linkedFindingId,
          linkedObjectiveId: a.linkedObjectiveId,
        })),
      })),
    })
  } catch (e) {
    console.error('Cert getMeetings error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createMeeting(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { date, type, attendees, summary } = req.body
    if (!type) {
      return res.status(400).json({ success: false, error: 'type required' })
    }
    const m = await prisma.certMeeting.create({
      data: {
        projectId,
        date: date ? new Date(date) : undefined,
        type: type ?? 'Internal',
        attendees: Array.isArray(attendees) ? attendees : [],
        summary: summary ?? '',
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: m.id,
        date: m.date.toISOString(),
        type: m.type,
        attendees: m.attendees,
        summary: m.summary,
      },
    })
  } catch (e) {
    console.error('Cert createMeeting error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateMeeting(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certMeeting.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Meeting not found' })
    }
    const m = await prisma.certMeeting.update({
      where: { id },
      data: {
        ...(body.date != null && { date: new Date(body.date) }),
        ...(body.type != null && { type: body.type }),
        ...(Array.isArray(body.attendees) && { attendees: body.attendees }),
        ...(body.summary != null && { summary: body.summary }),
      },
    })
    res.json({
      success: true,
      data: {
        id: m.id,
        date: m.date.toISOString(),
        type: m.type,
        attendees: m.attendees,
        summary: m.summary,
      },
    })
  } catch (e) {
    console.error('Cert updateMeeting error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Authority: Action items -----
export async function createActionItem(req: AuthRequest, res: Response) {
  try {
    const { projectId, meetingId } = req.params
    const { owner, dueDate, status, description, linkedFindingId, linkedObjectiveId } = req.body
    const meeting = await prisma.certMeeting.findFirst({ where: { id: meetingId, projectId } })
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' })
    }
    if (!dueDate) {
      return res.status(400).json({ success: false, error: 'dueDate required' })
    }
    const a = await prisma.certActionItem.create({
      data: {
        projectId,
        meetingId,
        owner: owner ?? '',
        dueDate: new Date(dueDate),
        status: status ?? 'Open',
        description: description ?? '',
        linkedFindingId: linkedFindingId ?? null,
        linkedObjectiveId: linkedObjectiveId ?? null,
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: a.id,
        owner: a.owner,
        dueDate: a.dueDate.toISOString(),
        status: a.status,
        description: a.description,
        linkedFindingId: a.linkedFindingId,
        linkedObjectiveId: a.linkedObjectiveId,
      },
    })
  } catch (e) {
    console.error('Cert createActionItem error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateActionItem(req: AuthRequest, res: Response) {
  try {
    const { projectId, meetingId, id } = req.params
    const body = req.body
    const actionItem = await prisma.certActionItem.findFirst({
      where: { id, meetingId, projectId },
    })
    if (!actionItem) {
      return res.status(404).json({ success: false, error: 'Action item not found' })
    }
    const a = await prisma.certActionItem.update({
      where: { id },
      data: {
        ...(body.owner != null && { owner: body.owner }),
        ...(body.dueDate != null && { dueDate: new Date(body.dueDate) }),
        ...(body.status != null && { status: body.status }),
        ...(body.description != null && { description: body.description }),
        ...(body.linkedFindingId !== undefined && { linkedFindingId: body.linkedFindingId || null }),
        ...(body.linkedObjectiveId !== undefined && { linkedObjectiveId: body.linkedObjectiveId || null }),
      },
    })
    res.json({
      success: true,
      data: {
        id: a.id,
        owner: a.owner,
        dueDate: a.dueDate.toISOString(),
        status: a.status,
        description: a.description,
        linkedFindingId: a.linkedFindingId,
        linkedObjectiveId: a.linkedObjectiveId,
      },
    })
  } catch (e) {
    console.error('Cert updateActionItem error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteActionItem(req: AuthRequest, res: Response) {
  try {
    const { projectId, meetingId, id } = req.params
    const actionItem = await prisma.certActionItem.findFirst({
      where: { id, meetingId, projectId },
    })
    if (!actionItem) {
      return res.status(404).json({ success: false, error: 'Action item not found' })
    }
    await prisma.certActionItem.delete({ where: { id } })
    res.json({ success: true })
  } catch (e) {
    console.error('Cert deleteActionItem error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Certification plan -----
export async function getPlan(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    let plan = await prisma.certPlan.findUnique({ where: { projectId } })
    if (!plan) {
      plan = await prisma.certPlan.create({
        data: { projectId, version: '1.0', scopeSummary: '', approvalStatus: 'Draft' },
      })
    }
    res.json({
      success: true,
      data: {
        id: plan.id,
        version: plan.version,
        scopeSummary: plan.scopeSummary,
        complianceStrategyJson: plan.complianceStrategyJson,
        approvalStatus: plan.approvalStatus,
        lastUpdated: plan.lastUpdated.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert getPlan error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function upsertPlan(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { version, scopeSummary, complianceStrategyJson, approvalStatus } = req.body
    const plan = await prisma.certPlan.upsert({
      where: { projectId },
      create: {
        projectId,
        version: version ?? '1.0',
        scopeSummary: scopeSummary ?? '',
        complianceStrategyJson: complianceStrategyJson ?? null,
        approvalStatus: approvalStatus ?? 'Draft',
      },
      update: {
        ...(version != null && { version }),
        ...(scopeSummary != null && { scopeSummary }),
        ...(complianceStrategyJson !== undefined && { complianceStrategyJson }),
        ...(approvalStatus != null && { approvalStatus }),
        lastUpdated: new Date(),
      },
    })
    res.json({
      success: true,
      data: {
        id: plan.id,
        version: plan.version,
        scopeSummary: plan.scopeSummary,
        complianceStrategyJson: plan.complianceStrategyJson,
        approvalStatus: plan.approvalStatus,
        lastUpdated: plan.lastUpdated.toISOString(),
      },
    })
  } catch (e) {
    console.error('Cert upsertPlan error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Milestones -----
export async function getMilestones(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certMilestone.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
    })
    res.json({
      success: true,
      data: list.map((m) => ({
        id: m.id,
        name: m.name,
        date: m.date.toISOString(),
        type: m.type,
        status: m.status,
        relatedReviewId: m.relatedReviewId,
        relatedPackageId: m.relatedPackageId,
      })),
    })
  } catch (e) {
    console.error('Cert getMilestones error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createMilestone(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, date, type, status, relatedReviewId, relatedPackageId } = req.body
    if (!name || !date) {
      return res.status(400).json({ success: false, error: 'name and date required' })
    }
    const m = await prisma.certMilestone.create({
      data: {
        projectId,
        name,
        date: new Date(date),
        type: type ?? 'Other',
        status: status ?? 'Planned',
        relatedReviewId: relatedReviewId ?? null,
        relatedPackageId: relatedPackageId ?? null,
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: m.id,
        name: m.name,
        date: m.date.toISOString(),
        type: m.type,
        status: m.status,
        relatedReviewId: m.relatedReviewId,
        relatedPackageId: m.relatedPackageId,
      },
    })
  } catch (e) {
    console.error('Cert createMilestone error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateMilestone(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const body = req.body
    const existing = await prisma.certMilestone.findFirst({ where: { id, projectId } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Milestone not found' })
    }
    const m = await prisma.certMilestone.update({
      where: { id },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.date != null && { date: new Date(body.date) }),
        ...(body.type != null && { type: body.type }),
        ...(body.status != null && { status: body.status }),
        ...(body.relatedReviewId !== undefined && { relatedReviewId: body.relatedReviewId || null }),
        ...(body.relatedPackageId !== undefined && { relatedPackageId: body.relatedPackageId || null }),
      },
    })
    res.json({
      success: true,
      data: {
        id: m.id,
        name: m.name,
        date: m.date.toISOString(),
        type: m.type,
        status: m.status,
        relatedReviewId: m.relatedReviewId,
        relatedPackageId: m.relatedPackageId,
      },
    })
  } catch (e) {
    console.error('Cert updateMilestone error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Dashboard metrics -----
export async function getCertificationMetrics(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const [objectives, findings, readinessGates, actionItems] = await Promise.all([
      prisma.certObjective.findMany({ where: { projectId }, select: { status: true } }),
      prisma.certFinding.findMany({
        where: { projectId, status: { notIn: ['Closed', 'Deferred'] } },
        select: { severity: true },
      }),
      prisma.certReadinessGate.findMany({ where: { projectId }, select: { passed: true } }),
      prisma.certActionItem.findMany({
        where: { projectId, status: 'Open', dueDate: { lt: new Date() } },
        select: { id: true },
      }),
    ])
    const totalObj = objectives.length
    const completeObj = objectives.filter((o) => o.status === 'Complete').length
    const compliancePercent = totalObj > 0 ? Math.round((completeObj / totalObj) * 100) : 0
    const openFindingsBySeverity = findings.reduce(
      (acc, f) => {
        acc[f.severity] = (acc[f.severity] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const gatesPassed = readinessGates.filter((g) => g.passed).length
    const gatesTotal = readinessGates.length
    res.json({
      success: true,
      data: {
        compliancePercent,
        totalObjectives: totalObj,
        completeObjectives: completeObj,
        openFindingsBySeverity,
        openFindingsCount: findings.length,
        readinessGatesPassed: gatesPassed,
        readinessGatesTotal: gatesTotal,
        overdueActionItemsCount: actionItems.length,
      },
    })
  } catch (e) {
    console.error('Cert getCertificationMetrics error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Checklists & sign-offs -----
export async function getChecklists(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const list = await prisma.certChecklist.findMany({
      where: { projectId },
      orderBy: { phase: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } }, signOffs: true },
    })
    res.json({
      success: true,
      data: list.map((c) => ({
        id: c.id,
        name: c.name,
        phase: c.phase,
        baselineId: c.baselineId,
        releaseId: c.releaseId,
        items: c.items.map((i) => ({
          id: i.id,
          description: i.description,
          required: i.required,
          status: i.status,
          sortOrder: i.sortOrder,
        })),
        signOffs: c.signOffs.map((s) => ({
          id: s.id,
          role: s.role,
          person: s.person,
          signedAt: s.signedAt?.toISOString(),
          status: s.status,
        })),
      })),
    })
  } catch (e) {
    console.error('Cert getChecklists error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, phase, baselineId, releaseId, items } = req.body
    if (!name || !phase) {
      return res.status(400).json({ success: false, error: 'name and phase required' })
    }
    const c = await prisma.certChecklist.create({
      data: {
        projectId,
        name,
        phase: phase ?? 'Other',
        baselineId: baselineId ?? null,
        releaseId: releaseId ?? null,
        items: Array.isArray(items) && items.length > 0
          ? {
              create: items.map((it: { description?: string; required?: boolean }, idx: number) => ({
                description: it.description ?? '',
                required: it.required !== false,
                sortOrder: idx,
              })),
            }
          : undefined,
      },
      include: { items: true },
    })
    res.status(201).json({
      success: true,
      data: {
        id: c.id,
        name: c.name,
        phase: c.phase,
        items: c.items.map((i) => ({ id: i.id, description: i.description, required: i.required, status: i.status })),
      },
    })
  } catch (e) {
    console.error('Cert createChecklist error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateChecklistItem(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistId, id } = req.params
    const { status } = req.body
    const item = await prisma.certChecklistItem.findFirst({
      where: { id, checklistId },
      include: { checklist: { select: { projectId: true } } },
    })
    if (!item || item.checklist.projectId !== projectId) {
      return res.status(404).json({ success: false, error: 'Checklist item not found' })
    }
    const updated = await prisma.certChecklistItem.update({
      where: { id },
      data: status != null ? { status } : {},
    })
    res.json({ success: true, data: { id: updated.id, status: updated.status } })
  } catch (e) {
    console.error('Cert updateChecklistItem error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// Issue #163: sign-off identity verification.
// Signer identity is derived from the authenticated session; client-supplied
// `signerId`, `userId`, `signedAt`, or `person` overrides are deliberately ignored.
// A `confirmPassword` body field must match the caller's stored password hash.
export async function addSignOff(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistId } = req.params
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { role, milestoneId, confirmPassword } = req.body as {
      role?: string
      milestoneId?: string | null
      confirmPassword?: string
    }
    if (typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'confirmPassword is required to sign off' })
    }
    const member = await assertProjectMember(userId, projectId)
    if (!member) {
      return res
        .status(403)
        .json({ success: false, error: 'Access denied: not a member of this project' })
    }
    const checklist = await prisma.certChecklist.findFirst({
      where: { id: checklistId, projectId },
    })
    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, password: true },
    })
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const passwordOk = await bcrypt.compare(confirmPassword, user.password)
    if (!passwordOk) {
      return res
        .status(401)
        .json({ success: false, error: 'Password confirmation failed' })
    }
    // Prevent duplicate sign-off by the same user on the same checklist
    const existing = await prisma.certSignOff.findFirst({
      where: { checklistId, signerId: userId },
      select: { id: true },
    })
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'You have already signed off on this checklist',
      })
    }
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      null
    const userAgent = (req.headers['user-agent'] as string | undefined) || null
    const s = await prisma.certSignOff.create({
      data: {
        projectId,
        checklistId,
        milestoneId: milestoneId ?? null,
        role: role ?? '',
        person: user.name || user.email || '',
        status: 'Signed',
        signedAt: new Date(),
        signerId: userId,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: s.id,
        role: s.role,
        person: s.person,
        status: s.status,
        signedAt: s.signedAt?.toISOString(),
        signerId: s.signerId,
      },
    })
  } catch (e) {
    console.error('Cert addSignOff error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateSignOff(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { status, confirmPassword } = req.body as {
      status?: string
      confirmPassword?: string
    }
    if (typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'confirmPassword is required to update sign-off' })
    }
    const member = await assertProjectMember(userId, projectId)
    if (!member) {
      return res
        .status(403)
        .json({ success: false, error: 'Access denied: not a member of this project' })
    }
    const s = await prisma.certSignOff.findFirst({ where: { id, projectId } })
    if (!s) {
      return res.status(404).json({ success: false, error: 'Sign-off not found' })
    }
    // Only the original signer or a platform/company admin may update an existing sign-off
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, password: true },
    })
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const isAdmin =
      user.role === 'SUPERIOR_ADMIN' || user.role === 'COMPANY_ADMIN'
    const isAuthor = s.signerId != null && s.signerId === userId
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({
        success: false,
        error: 'Only the original signer or an admin may modify this sign-off',
      })
    }
    const passwordOk = await bcrypt.compare(confirmPassword, user.password)
    if (!passwordOk) {
      return res
        .status(401)
        .json({ success: false, error: 'Password confirmation failed' })
    }
    // Status changes transitioning to "Signed" must stamp a fresh server-side signedAt
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      null
    const userAgent = (req.headers['user-agent'] as string | undefined) || null
    const nextSignedAt =
      status === 'Signed' ? new Date() : status != null && status !== 'Signed' ? null : s.signedAt
    const updated = await prisma.certSignOff.update({
      where: { id },
      data: {
        ...(status != null && { status }),
        signedAt: nextSignedAt,
        ...(status === 'Signed' && !s.signerId ? { signerId: userId } : {}),
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      },
    })
    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        signedAt: updated.signedAt?.toISOString(),
        signerId: updated.signerId,
      },
    })
  } catch (e) {
    console.error('Cert updateSignOff error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ----- Objective-completion matrix (NX-7, #460) -----
//
// GET /certification/:projectId/objective-matrix?standard=&criticality=
//
// A read-only aggregation: one CertObjective per row, with a graph-derived
// completionState and the linked-requirement / verification / evidence /
// signature counts. The projectId is resolved + membership-checked by the
// route file's `projectIdParam` param middleware — no extra tenant filter is
// needed (and a redundant one would double the DB hit). It mutates nothing,
// so it writes no AuditLog row. The `standard` / `criticality` filters are
// applied in-memory after the constant-query-count graph walk.
export async function getObjectiveMatrix(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const standardFilter =
      typeof req.query.standard === 'string' && req.query.standard.trim()
        ? req.query.standard.trim()
        : null
    const criticalityFilter =
      typeof req.query.criticality === 'string' && req.query.criticality.trim()
        ? req.query.criticality.trim()
        : null

    const matrix = await composeObjectiveMatrix(projectId)

    let objectives = matrix.objectives
    if (standardFilter) {
      objectives = objectives.filter((o) => o.standard === standardFilter)
    }
    if (criticalityFilter) {
      objectives = objectives.filter((o) => o.criticality === criticalityFilter)
    }

    res.json({
      success: true,
      data: {
        objectives,
        // availableStandards reflects the WHOLE project, not the filtered
        // subset — so the filter dropdown never loses its own selected option.
        availableStandards: matrix.availableStandards,
      },
    })
  } catch (e) {
    console.error('Cert getObjectiveMatrix error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
