/**
 * Seed certification data for a project (context, baselines, releases, objectives, compliance matrix, readiness gates).
 * Usage: npx tsx src/scripts/seed-certification.ts [projectId]
 * If projectId is omitted, uses the first project in the DB.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projectId = process.argv[2]
  let pid = projectId
  if (!pid) {
    const project = await prisma.project.findFirst({ select: { id: true, name: true } })
    if (!project) {
      console.error('No project found. Create a project first or pass projectId.')
      process.exit(1)
    }
    pid = project.id
    console.log(`Using project: ${project.name} (${pid})`)
  } else {
    const project = await prisma.project.findUnique({ where: { id: pid }, select: { name: true } })
    if (!project) {
      console.error('Project not found:', pid)
      process.exit(1)
    }
    console.log(`Seeding certification for: ${project.name} (${pid})`)
  }

  await prisma.certContext.upsert({
    where: { projectId: pid },
    create: {
      projectId: pid,
      authority: 'EASA',
      certBasis: 'CS-25',
      standards: ['ARP4754A', 'DO-178C'],
      selectedBaselineId: null,
      selectedReleaseId: null,
    },
    update: {},
  })

  const baselines = [
    { baselineId: 'BL-2026-03-PDR', name: 'PDR Functional Baseline', status: 'Frozen' },
    { baselineId: 'BL-2026-05-CDR', name: 'CDR Allocated Baseline', status: 'Submitted' },
    { baselineId: 'BL-2026-01-SRR', name: 'SRR Product Baseline', status: 'Superseded' },
  ]
  for (const b of baselines) {
    await prisma.certBaseline.upsert({
      where: { projectId_baselineId: { projectId: pid, baselineId: b.baselineId } },
      create: { projectId: pid, ...b },
      update: { name: b.name, status: b.status },
    })
  }

  const releases = [
    { releaseId: 'REL-2026.04', name: 'April 2026 internal build', status: 'Approved' },
    { releaseId: 'REL-2026.03', name: 'March 2026 customer delivery', status: 'Draft' },
    { releaseId: 'REL-2026.02', name: 'February 2026 snapshot', status: 'Released' },
  ]
  for (const r of releases) {
    await prisma.certRelease.upsert({
      where: { projectId_releaseId: { projectId: pid, releaseId: r.releaseId } },
      create: { projectId: pid, ...r },
      update: { name: r.name, status: r.status },
    })
  }

  const objectives = [
    { objId: 'OBJ-CS25-1309-01', regRef: 'CS 25.1309', title: 'Equipment, systems, and installations', moc: 'Analysis', status: 'Complete', criticality: 'High', linkedEvidenceCount: 3, linkedCiCount: 2, notes: 'FHA and FMEA linked.', reviewed: true },
    { objId: 'OBJ-CS25-1309-02', regRef: 'CS 25.1309', title: 'Failure conditions – probability', moc: 'Test', status: 'Partial', criticality: 'High', linkedEvidenceCount: 2, linkedCiCount: 1, notes: 'Test campaign ongoing.', reviewed: false },
    { objId: 'OBJ-CS25-1301-01', regRef: 'CS 25.1301', title: 'Function and installation', moc: 'Inspection', status: 'Open', criticality: 'Medium', linkedEvidenceCount: 0, linkedCiCount: 0, notes: '', reviewed: false },
    { objId: 'OBJ-CS25-1302-01', regRef: 'CS 25.1302', title: 'Instruments and equipment', moc: 'Test', status: 'Complete', criticality: 'Medium', linkedEvidenceCount: 4, linkedCiCount: 3, notes: 'All tests passed.', reviewed: true },
    { objId: 'OBJ-CS25-671-01', regRef: 'CS 25.671', title: 'Control system', moc: 'Analysis', status: 'Blocked', criticality: 'High', linkedEvidenceCount: 1, linkedCiCount: 1, notes: 'Awaiting stability report.', reviewed: false },
    { objId: 'OBJ-CS25-672-01', regRef: 'CS 25.672', title: 'Stability augmentation and control', moc: 'Simulation', status: 'Open', criticality: 'High', linkedEvidenceCount: 0, linkedCiCount: 0, notes: '', reviewed: false },
  ]
  for (const o of objectives) {
    await prisma.certObjective.upsert({
      where: { projectId_objId: { projectId: pid, objId: o.objId } },
      create: { projectId: pid, ...o },
      update: { title: o.title, moc: o.moc, status: o.status, criticality: o.criticality, linkedEvidenceCount: o.linkedEvidenceCount, linkedCiCount: o.linkedCiCount, notes: o.notes, reviewed: o.reviewed },
    })
  }

  const matrixRows = [
    { regRef: 'CS 25.1309', objectiveCount: 2, mocMix: { Analysis: 1, Test: 1 }, statusSummary: { complete: 1, partial: 1, open: 0, blocked: 0 }, evidenceCount: 5 },
    { regRef: 'CS 25.1301', objectiveCount: 1, mocMix: { Inspection: 1 }, statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 }, evidenceCount: 0 },
    { regRef: 'CS 25.1302', objectiveCount: 1, mocMix: { Test: 1 }, statusSummary: { complete: 1, partial: 0, open: 0, blocked: 0 }, evidenceCount: 4 },
    { regRef: 'CS 25.671', objectiveCount: 1, mocMix: { Analysis: 1 }, statusSummary: { complete: 0, partial: 0, open: 0, blocked: 1 }, evidenceCount: 1 },
    { regRef: 'CS 25.672', objectiveCount: 1, mocMix: { Simulation: 1 }, statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 }, evidenceCount: 0 },
    { regRef: 'CS 23.1309', objectiveCount: 1, mocMix: { Similarity: 1 }, statusSummary: { complete: 1, partial: 0, open: 0, blocked: 0 }, evidenceCount: 2 },
  ]
  for (const r of matrixRows) {
    await prisma.certComplianceMatrixRow.upsert({
      where: { projectId_regRef: { projectId: pid, regRef: r.regRef } },
      create: { projectId: pid, ...r },
      update: { objectiveCount: r.objectiveCount, mocMix: r.mocMix as object, statusSummary: r.statusSummary as object, evidenceCount: r.evidenceCount, lastUpdated: new Date() },
    })
  }

  const gates = [
    { gateId: 'gate-1', label: 'All certification objectives defined', passed: true, reason: undefined },
    { gateId: 'gate-2', label: 'Compliance matrix complete', passed: true, reason: undefined },
    { gateId: 'gate-3', label: 'Evidence index up to date', passed: false, reason: 'Pending verification evidence' },
    { gateId: 'gate-4', label: 'No open Major findings', passed: true, reason: undefined },
    { gateId: 'gate-5', label: 'Authority review log closed', passed: false, reason: undefined },
  ]
  for (const g of gates) {
    await prisma.certReadinessGate.upsert({
      where: { projectId_gateId: { projectId: pid, gateId: g.gateId } },
      create: { projectId: pid, ...g },
      update: { label: g.label, passed: g.passed, reason: g.reason ?? null },
    })
  }

  console.log('Certification seed done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
