/**
 * Seed the Demo_Project with full-lifecycle traceability dataset (Electric Autonomous Delivery Drone).
 * Usage: npx tsx src/scripts/seed-demo-project.ts [projectId]
 * If projectId is omitted, creates or finds project with slug "demo-project".
 */
import { prisma } from '../lib/prisma'


const DEMO_SLUG = 'demo-project'
const DEMO_NAME = 'Demo_Project'
const DEMO_DOMAIN = 'Electric Autonomous Delivery Drone'

// PBS component names (root + 12 children)
const PBS_NAMES = [
  'Electric Autonomous Delivery Drone',
  'Battery Management System',
  'Navigation Module',
  'Propulsion System',
  'Flight Controller',
  'Sensor Suite',
  'Communication Module',
  'Payload Bay',
  'Thermal Management',
  'Ground Control Interface',
  'Safety Module',
  'Power Distribution',
  'Landing Gear',
  'Cargo Door Actuator',
]

// System function names
const FUNCTION_NAMES = [
  'Navigate to waypoint',
  'Manage battery state',
  'Execute delivery sequence',
  'Detect obstacles',
  'Communicate with GCS',
  'Maintain thermal envelope',
  'Execute safe landing',
  'Control payload door',
  'Monitor propulsion health',
  'Apply geofence constraints',
  'Acquire and process sensor data',
  'Handle loss of link',
]

const REQUIREMENT_TYPES = ['functional', 'performance', 'safety', 'interface', 'design_constraint', 'security', 'usability'] as const
const REQUIREMENT_LEVELS = ['system', 'subsystem', 'component', 'interface'] as const
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const COMPLEXITY_LEVELS = ['simple', 'moderate', 'complex'] as const
const VERIFICATION_METHODS = ['Inspection', 'Test', 'Analysis', 'Demonstration'] as const
const SOURCES = ['Stakeholder input', 'System design'] as const

function slugFromName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'project'
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let n = 1
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`
  }
  return slug
}

/** Generate 105 requirement titles/descriptions for the drone domain */
function generateRequirements(count: number): Array<{ title: string; description: string; requirementType: string }> {
  const templates: Array<{ title: string; description: string; type: string }> = [
    { title: 'System shall operate within flight envelope', description: 'The drone shall maintain flight within the defined altitude, speed, and attitude envelope under all operational conditions.', type: 'functional' },
    { title: 'Battery capacity shall meet mission duration', description: 'The battery system shall provide sufficient capacity for a minimum mission duration of 45 minutes at nominal payload.', type: 'performance' },
    { title: 'Obstacle detection and avoidance', description: 'The system shall detect obstacles and execute avoidance or hover within 2 seconds of detection.', type: 'safety' },
    { title: 'GCS communication interface', description: 'The system shall implement the defined ground control station communication protocol over the specified link.', type: 'interface' },
    { title: 'Payload weight constraint', description: 'The drone shall support a maximum payload mass of 5 kg within the defined CG envelope.', type: 'design_constraint' },
    { title: 'Secure command authentication', description: 'All commands from the GCS shall be authenticated using the project-defined security mechanism.', type: 'security' },
    { title: 'Operator workload and usability', description: 'The operator interface shall allow mission planning and monitoring without exceeding defined workload limits.', type: 'usability' },
    { title: 'Waypoint navigation accuracy', description: 'The system shall navigate to waypoints with horizontal accuracy of ±2 m under nominal conditions.', type: 'performance' },
    { title: 'Low battery return-to-home', description: 'When battery level falls below the defined threshold, the system shall initiate automated return to home.', type: 'safety' },
    { title: 'Propulsion motor control interface', description: 'The flight controller shall communicate with propulsion ESCs via the defined motor control interface.', type: 'interface' },
    { title: 'Thermal limits for electronics', description: 'All avionics shall operate within their specified temperature limits with margin per design guidelines.', type: 'design_constraint' },
    { title: 'Geofence enforcement', description: 'The system shall prevent flight outside the active geofence boundary under all conditions.', type: 'safety' },
    { title: 'Telemetry downlink rate', description: 'The system shall support a minimum telemetry downlink rate of 10 Hz for position and status.', type: 'performance' },
    { title: 'Sensor data fusion', description: 'The system shall fuse LiDAR, camera, and IMU data to produce obstacle and position estimates.', type: 'functional' },
    { title: 'Cargo door open/close sequence', description: 'The cargo door actuator shall execute the defined open and close sequences within specified times.', type: 'functional' },
    { title: 'Loss of link behavior', description: 'On loss of command link for more than the defined timeout, the system shall execute lost-link procedure.', type: 'safety' },
    { title: 'Power distribution monitoring', description: 'The power distribution unit shall monitor and report bus voltages and currents per interface spec.', type: 'interface' },
    { title: 'Landing gear deployment', description: 'Landing gear shall deploy and lock within 5 seconds when commanded or in auto-land mode.', type: 'functional' },
    { title: 'Documentation and labeling', description: 'All operator-facing functions shall be documented and labeled per usability specification.', type: 'usability' },
    { title: 'Software update integrity', description: 'Software updates shall be verified for integrity and authenticity before installation.', type: 'security' },
  ]
  const out: Array<{ title: string; description: string; requirementType: string }> = []
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length]
    const suffix = i >= templates.length ? ` (variant ${Math.floor(i / templates.length) + 1})` : ''
    out.push({
      title: t.title + suffix,
      description: t.description + (suffix ? ` Requirement instance for full coverage.` : ''),
      requirementType: t.type,
    })
  }
  return out
}

async function main() {
  const projectIdArg = process.argv[2]

  // Resolve user for project ownership
  const firstUser = await prisma.user.findFirst({ select: { id: true } })
  if (!firstUser) {
    console.error('No user found. Run seed:users first.')
    process.exit(1)
  }

  let projectId: string
  if (projectIdArg) {
    const project = await prisma.project.findUnique({
      where: { id: projectIdArg },
      select: { id: true },
    })
    if (!project) {
      console.error(`Project ${projectIdArg} not found.`)
      process.exit(1)
    }
    projectId = project.id
    console.log(`Using existing project: ${projectId}`)
  } else {
    // Prefer slug demo-project; otherwise reuse any project already named Demo_Project with same domain (avoids duplicates from earlier seed runs)
    let project = await prisma.project.findUnique({
      where: { slug: DEMO_SLUG },
      select: { id: true },
    })
    if (!project) {
      project = await prisma.project.findFirst({
        where: { name: DEMO_NAME, domain: DEMO_DOMAIN },
        select: { id: true },
      })
      if (project) {
        console.log(`Found existing Demo_Project by name/domain (id: ${project.id}). Reusing to avoid duplicates.`)
      }
    } else {
      console.log(`Found existing project: ${project.id}`)
    }
    if (!project) {
      const slug = await ensureUniqueSlug(DEMO_SLUG)
      project = await prisma.project.create({
        data: {
          name: DEMO_NAME,
          description: `Demo dataset for full-lifecycle traceability: ${DEMO_DOMAIN}`,
          domain: DEMO_DOMAIN,
          slug,
          userId: firstUser.id,
        },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, userId: firstUser.id, role: 'owner' },
      })
      console.log(`Created project: ${DEMO_NAME} (${project.id}), slug: ${slug}`)
    }
    projectId = project.id
  }

  const pid = projectId

  // --- Stakeholder names (project owner + project members) for requirement owner/stakeholders ---
  const projectWithPeople = await prisma.project.findUnique({
    where: { id: pid },
    select: {
      user: { select: { name: true } },
      teamMembers: {
        where: { status: 'accepted' },
        include: { user: { select: { name: true } } },
      },
    },
  })
  const stakeholderNames: string[] = []
  if (projectWithPeople?.user?.name) stakeholderNames.push(projectWithPeople.user.name)
  for (const m of projectWithPeople?.teamMembers ?? []) {
    if (m.user?.name && !stakeholderNames.includes(m.user.name)) stakeholderNames.push(m.user.name)
  }

  // --- PBS (Components) ---
  const componentIds: string[] = []
  let rootComponent = await prisma.component.findFirst({
    where: { projectId: pid, parentId: null },
    select: { id: true },
  })
  if (!rootComponent) {
    rootComponent = await prisma.component.create({
      data: {
        projectId: pid,
        name: PBS_NAMES[0],
        description: 'Root of product breakdown structure for the drone system',
        sortOrder: 0,
      },
    })
    componentIds.push(rootComponent.id)
    console.log(`Created root component: ${PBS_NAMES[0]}`)
    for (let i = 1; i < PBS_NAMES.length; i++) {
      const c = await prisma.component.create({
        data: {
          projectId: pid,
          parentId: rootComponent.id,
          name: PBS_NAMES[i],
          description: `PBS component: ${PBS_NAMES[i]}`,
          sortOrder: i,
        },
      })
      componentIds.push(c.id)
    }
    console.log(`Created ${PBS_NAMES.length - 1} child components.`)
  } else {
    const all = await prisma.component.findMany({
      where: { projectId: pid },
      select: { id: true },
      orderBy: { sortOrder: 'asc' },
    })
    all.forEach((c) => componentIds.push(c.id))
    if (componentIds.length === 0) componentIds.push(rootComponent.id)
    console.log(`Using existing components (${componentIds.length}).`)
  }

  // Ensure we have at least 10 components for allocation (root + 9 children)
  const componentsForAlloc = componentIds.length >= 10 ? componentIds : componentIds

  // --- System Functions ---
  const functionIds: string[] = []
  const existingFuncs = await prisma.systemFunction.findMany({
    where: { projectId: pid },
    select: { id: true },
  })
  if (existingFuncs.length >= FUNCTION_NAMES.length) {
    existingFuncs.forEach((f) => functionIds.push(f.id))
    console.log(`Using existing functions (${functionIds.length}).`)
  } else {
    const projectSuffix = pid.slice(0, 8)
    for (let i = 0; i < FUNCTION_NAMES.length; i++) {
      const functionId = `FUN-DEMO-${projectSuffix}-${String(i + 1).padStart(3, '0')}`
      let f = await prisma.systemFunction.findFirst({
        where: { projectId: pid, functionId },
      })
      if (!f) {
        f = await prisma.systemFunction.create({
          data: {
            projectId: pid,
            functionId,
            name: FUNCTION_NAMES[i],
            description: `System function: ${FUNCTION_NAMES[i]}`,
            status: 'draft',
            level: 0,
            sortOrder: i,
          },
        })
      }
      functionIds.push(f.id)
    }
    console.log(`Created/updated ${FUNCTION_NAMES.length} system functions.`)
  }

  // --- Requirements (105) ---
  const reqCount = 105
  const requirementRecords: { id: string; requirementId: string }[] = []
  const existingReqs = await prisma.requirement.findMany({
    where: { projectId: pid, deletedAt: null },
    select: { id: true, requirementId: true },
    orderBy: { requirementId: 'asc' },
  })
  if (existingReqs.length >= reqCount) {
    requirementRecords.push(...existingReqs.slice(0, reqCount).map(r => ({ id: r.id, requirementId: r.requirementId! })))
    console.log(`Using existing requirements (${requirementRecords.length}).`)
  } else {
    const gen = generateRequirements(reqCount)
    for (let i = 0; i < reqCount; i++) {
      const reqId = `REQ-${String(i + 1).padStart(3, '0')}`
      const existing = await prisma.requirement.findFirst({
        where: { projectId: pid, requirementId: reqId },
      })
      if (existing) {
        requirementRecords.push({ id: existing.id, requirementId: existing.requirementId! })
        continue
      }
      const r = gen[i]
      const componentId = componentsForAlloc[i % componentsForAlloc.length] ?? componentsForAlloc[0]
      const owner =
        stakeholderNames.length > 0 ? stakeholderNames[i % stakeholderNames.length]! : undefined
      const stakeholdersForReq: string[] = []
      if (stakeholderNames.length > 0) {
        const idx = i % stakeholderNames.length
        stakeholdersForReq.push(stakeholderNames[idx]!)
        if (stakeholderNames.length > 1) {
          stakeholdersForReq.push(stakeholderNames[(i + 1) % stakeholderNames.length]!)
        }
      }
      const req = await prisma.requirement.create({
        data: {
          projectId: pid,
          requirementId: reqId,
          title: r.title,
          description: r.description,
          requirementType: r.requirementType,
          priority: 'medium',
          status: 'draft',
          stage: 'definition',
          componentId,
          ...(owner != null && { owner }),
          ...(stakeholderNames.length > 0 && { stakeholders: stakeholdersForReq }),
          requirementLevel: REQUIREMENT_LEVELS[i % REQUIREMENT_LEVELS.length],
          risk: RISK_LEVELS[i % RISK_LEVELS.length],
          complexity: COMPLEXITY_LEVELS[i % COMPLEXITY_LEVELS.length],
          verificationMethod: VERIFICATION_METHODS[i % VERIFICATION_METHODS.length],
          acceptanceCriteria: `Verified by ${VERIFICATION_METHODS[i % VERIFICATION_METHODS.length].toLowerCase()} per ${r.requirementType} requirements.`,
          rationale: `Required for system design and ${r.requirementType} compliance.`,
          assumptions: 'Standard operating conditions apply.',
          source: SOURCES[i % SOURCES.length],
          reviewStatus: 'draft',
        },
      })
      requirementRecords.push({ id: req.id, requirementId: req.requirementId! })
    }
    console.log(`Created ${requirementRecords.length} requirements.`)
  }

  // --- Requirement hierarchy (parent/child): REQ-002..REQ-006 as children of REQ-001 ---
  const req001 = requirementRecords.find((r) => r.requirementId === 'REQ-001')
  if (req001) {
    const childIds = ['REQ-002', 'REQ-003', 'REQ-004', 'REQ-005', 'REQ-006']
    for (const cid of childIds) {
      const child = requirementRecords.find((r) => r.requirementId === cid)
      if (child) {
        await prisma.requirement.updateMany({
          where: { id: child.id, projectId: pid },
          data: { parentId: req001.id },
        })
      }
    }
    console.log('Requirement hierarchy: REQ-002..REQ-006 set as children of REQ-001.')
  }

  // --- Ensure all requirements have owner and stakeholders (from real project people) ---
  if (stakeholderNames.length > 0) {
    const gen = generateRequirements(requirementRecords.length)
    for (let i = 0; i < requirementRecords.length; i++) {
      const rec = requirementRecords[i]!
      const req = await prisma.requirement.findUnique({
        where: { id: rec.id },
        select: { owner: true, stakeholders: true, acceptanceCriteria: true, requirementLevel: true },
      })
      const needsOwner = req?.owner == null || req.owner === ''
      const needsStakeholders = req?.stakeholders == null || req.stakeholders.length === 0
      const needsOptional =
        req?.acceptanceCriteria == null ||
        req.acceptanceCriteria === '' ||
        req?.requirementLevel == null
      if (!needsOwner && !needsStakeholders && !needsOptional) continue
      const owner = stakeholderNames[i % stakeholderNames.length]!
      const stakeholders: string[] = [owner]
      if (stakeholderNames.length > 1) {
        stakeholders.push(stakeholderNames[(i + 1) % stakeholderNames.length]!)
      }
      const r = gen[i]!
      await prisma.requirement.update({
        where: { id: rec.id },
        data: {
          ...(needsOwner && { owner }),
          ...(needsStakeholders && { stakeholders }),
          ...(needsOptional && {
            requirementLevel: REQUIREMENT_LEVELS[i % REQUIREMENT_LEVELS.length],
            risk: RISK_LEVELS[i % RISK_LEVELS.length],
            complexity: COMPLEXITY_LEVELS[i % COMPLEXITY_LEVELS.length],
            verificationMethod: VERIFICATION_METHODS[i % VERIFICATION_METHODS.length],
            acceptanceCriteria: `Verified by ${VERIFICATION_METHODS[i % VERIFICATION_METHODS.length].toLowerCase()} per ${r.requirementType} requirements.`,
            rationale: `Required for system design and ${r.requirementType} compliance.`,
            assumptions: 'Standard operating conditions apply.',
            source: SOURCES[i % SOURCES.length],
          }),
        },
      })
    }
    console.log('Requirement owner/stakeholders and optional fields ensured for all.')
  }

  // --- TraceLinks: Requirement -> PBS (allocated_to) ---
  const existingAlloc = await prisma.traceLink.count({
    where: { projectId: pid, linkType: 'allocated_to', sourceType: 'requirement', targetType: 'pbs_component' },
  })
  if (existingAlloc < requirementRecords.length) {
    for (const req of requirementRecords) {
      const reqFull = await prisma.requirement.findUnique({
        where: { id: req.id },
        select: { componentId: true },
      })
      if (!reqFull?.componentId) continue
      const already = await prisma.traceLink.findFirst({
        where: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'pbs_component', targetId: reqFull.componentId },
      })
      if (!already) {
        await prisma.traceLink.create({
          data: {
            projectId: pid,
            sourceType: 'requirement',
            sourceId: req.id,
            targetType: 'pbs_component',
            targetId: reqFull.componentId,
            linkType: 'allocated_to',
          },
        })
      }
    }
    console.log('TraceLinks requirement -> pbs_component (allocated_to) ensured.')
  }

  // --- TraceLinks: Requirement -> Function (allocated_to) ---
  for (const req of requirementRecords) {
    const funcId = functionIds[requirementRecords.indexOf(req) % functionIds.length]!
    const exists = await prisma.traceLink.findFirst({
      where: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'function', targetId: funcId },
    })
    if (!exists) {
      await prisma.traceLink.create({
        data: {
          projectId: pid,
          sourceType: 'requirement',
          sourceId: req.id,
          targetType: 'function',
          targetId: funcId,
          linkType: 'allocated_to',
        },
      })
    }
  }
  console.log('TraceLinks requirement -> function (allocated_to) created.')

  // --- Verification: MoC, Method, Setup, Test Cases, Test Plan ---
  const moc = await prisma.verMoc.findUnique({ where: { code: 3 } })
  if (!moc) {
    console.log('VerMoc code 3 not found. Run seed:mocs if needed. Creating test cases without MoC link.')
  }
  let method = await prisma.verMethod.findFirst({
    where: { projectId: pid, methodType: 'TEST' },
  })
  if (!method) {
    method = await prisma.verMethod.create({
      data: {
        projectId: pid,
        name: 'Demo Functional Test',
        methodType: 'TEST',
        description: 'Functional testing for drone requirements',
        linkedMocCode: moc ? 3 : null,
        status: 'APPROVED',
      },
    })
  }
  let setup = await prisma.verTestSetup.findFirst({
    where: { projectId: pid },
  })
  if (!setup) {
    setup = await prisma.verTestSetup.create({
      data: {
        projectId: pid,
        name: 'Demo HIL Bench',
        description: 'HIL test bench for drone verification',
        environmentType: 'HIL',
        status: 'APPROVED',
      },
    })
  }

  const numTestCases = 50
  const testCaseIds: string[] = []
  for (let i = 0; i < numTestCases; i++) {
    const key = `TC-DEMO-${String(i + 1).padStart(3, '0')}`
    let tc = await prisma.verTestCase.findFirst({
      where: { projectId: pid, key },
    })
    if (!tc) {
      tc = await prisma.verTestCase.create({
        data: {
          projectId: pid,
          key,
          title: `Demo test case ${i + 1}: Verify requirement coverage`,
          objective: `Verify that linked requirements are satisfied for scenario ${i + 1}.`,
          preconditions: 'DUT powered, test environment ready.',
          steps: ['Execute test steps per procedure.', 'Record results.'],
          expectedResults: ['Pass criteria met.'],
          passFailCriteria: 'PASS if all expected results met.',
          linkedMocCode: moc ? 3 : null,
          linkedMethodId: method.id,
          status: 'READY',
          version: '1.0',
        },
      })
      await prisma.verTestCaseSetup.upsert({
        where: { testCaseId_setupId: { testCaseId: tc.id, setupId: setup.id } },
        create: { testCaseId: tc.id, setupId: setup.id },
        update: {},
      })
    }
    testCaseIds.push(tc.id)
  }
  console.log(`Test cases: ${testCaseIds.length}`)

  let testPlan = await prisma.verTestPlan.findFirst({
    where: { projectId: pid, key: 'TP-DEMO-001' },
  })
  if (!testPlan) {
    testPlan = await prisma.verTestPlan.create({
      data: {
        projectId: pid,
        key: 'TP-DEMO-001',
        name: 'Demo Qualification Test Plan',
        description: 'Test plan for drone requirement verification',
        scope: 'All demo test cases',
        phase: 'QUALIFICATION',
        status: 'ACTIVE',
      },
    })
    let orderIndex = 0
    for (const tcid of testCaseIds) {
      await prisma.verTestPlanCase.upsert({
        where: { testPlanId_testCaseId: { testPlanId: testPlan.id, testCaseId: tcid } },
        create: { testPlanId: testPlan.id, testCaseId: tcid, orderIndex: orderIndex++, isMandatory: true },
        update: {},
      })
    }
    console.log('Test plan TP-DEMO-001 created with test cases.')
  }

  // --- TraceLinks: Requirement -> Test Case (verified_by) ---
  for (const req of requirementRecords) {
    const tcId = testCaseIds[requirementRecords.indexOf(req) % testCaseIds.length]!
    const exists = await prisma.traceLink.findFirst({
      where: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'test_case', targetId: tcId, linkType: 'verified_by' },
    })
    if (!exists) {
      await prisma.traceLink.create({
        data: {
          projectId: pid,
          sourceType: 'requirement',
          sourceId: req.id,
          targetType: 'test_case',
          targetId: tcId,
          linkType: 'verified_by',
        },
      })
    }
  }
  console.log('TraceLinks requirement -> test_case (verified_by) created.')

  // --- Baselines (3) ---
  const baselineNames = ['Baseline 1 – Concept', 'Baseline 2 – Design', 'Baseline 3 – Integration']
  const reqIdsForBaseline = requirementRecords.map((r) => r.id)
  for (const name of baselineNames) {
    let bl = await prisma.baseline.findFirst({
      where: { projectId: pid, name },
      include: { _count: { select: { items: true } } },
    })
    if (!bl) {
      bl = await prisma.baseline.create({
        data: {
          projectId: pid,
          name,
          description: `Demo baseline: ${name}`,
          status: 'active',
          baselineType: 'functional',
        },
        include: { _count: { select: { items: true } } },
      })
    }
    const itemCount = '_count' in bl && bl._count ? bl._count.items : 0
    if (itemCount === 0) {
      const requirements = await prisma.requirement.findMany({
        where: { id: { in: reqIdsForBaseline }, projectId: pid, deletedAt: null },
      })
      const snapshotReqIds = requirements.map((r) => r.id)
      const traceLinks = await prisma.traceLink.findMany({
        where: {
          projectId: pid,
          OR: [
            { sourceType: 'requirement', sourceId: { in: snapshotReqIds } },
            { targetType: 'requirement', targetId: { in: snapshotReqIds } },
          ],
        },
      })
      const linksSnapshot = { links: traceLinks.map((l) => ({ id: l.id, sourceType: l.sourceType, sourceId: l.sourceId, targetType: l.targetType, targetId: l.targetId, linkType: l.linkType, isSuspect: l.isSuspect })) }
      await prisma.baseline.update({
        where: { id: bl.id },
        data: { linksSnapshot },
      })
      await prisma.baselineItem.createMany({
        data: requirements.map((req) => ({
          baselineId: bl!.id,
          requirementId: req.id,
          snapshot: JSON.stringify({
            id: req.id,
            projectId: req.projectId,
            requirementId: req.requirementId,
            title: req.title,
            description: req.description,
            priority: req.priority,
            status: req.status,
            stage: req.stage,
          }),
        })),
      })
      console.log(`Baseline "${name}" created with ${requirements.length} items.`)
    }
  }

  // --- Change Requests (5–10) with requirement links ---
  const crTitles = [
    'Clarify battery capacity requirement',
    'Extend geofence boundary for new ops area',
    'Update GCS interface to v2 protocol',
    'Add margin to obstacle detection timing',
    'Revise payload CG envelope',
    'Tighten telemetry rate for certification',
    'Update loss-of-link timeout',
    'Document thermal margin rationale',
  ]
  for (let i = 0; i < Math.min(8, crTitles.length); i++) {
    const crId = `CR-DEMO-${String(i + 1).padStart(3, '0')}`
    const existingCr = await prisma.changeRequest.findFirst({
      where: { projectId: pid, crId },
    })
    if (existingCr) continue
    const req = requirementRecords[i % requirementRecords.length]!
    await prisma.changeRequest.create({
      data: {
        projectId: pid,
        crId,
        title: crTitles[i]!,
        description: `Change request for requirement ${req.requirementId}: ${crTitles[i]!}.`,
        sourceType: 'requirement',
        sourceId: req.id,
        priority: 'medium',
        status: 'pending',
        requestedBy: 'Demo Seed',
        requirementLinks: {
          create: [{ requirementId: req.id, relationshipType: 'originates_from' }],
        },
      },
    })
  }
  console.log('Change requests with requirement links created.')

  // --- Issues (8) with requirement links ---
  const issueTitles = [
    'Ambiguity in waypoint accuracy requirement',
    'Missing preconditions in landing gear requirement',
    'Interface spec revision needed',
    'Safety review finding: low battery RTH',
    'Usability finding: operator workload',
    'Security review: command authentication',
    'Thermal margin clarification',
    'Geofence test coverage gap',
  ]
  for (let i = 0; i < issueTitles.length; i++) {
    const issueKey = `ISS-DEMO-${String(i + 1).padStart(3, '0')}`
    const existingIssue = await prisma.issue.findFirst({
      where: { projectId: pid, issueKey },
    })
    if (existingIssue) continue
    const req = requirementRecords[(i + 10) % requirementRecords.length]!
    const issue = await prisma.issue.create({
      data: {
        projectId: pid,
        issueKey,
        title: issueTitles[i]!,
        description: `Issue related to requirement ${req.requirementId}: ${issueTitles[i]!}.`,
        priority: 'medium',
        status: 'open',
        issueType: 'specification_error',
      },
    })
    await prisma.issueLink.create({
      data: {
        issueId: issue.id,
        linkedType: 'requirement',
        linkedId: req.id,
        linkType: 'relates_to',
        linkedRequirementKey: req.requirementId,
        linkedRequirementTitle: (await prisma.requirement.findUnique({ where: { id: req.id }, select: { title: true } }))?.title ?? undefined,
      },
    })
  }
  console.log('Issues with requirement links created.')

  // --- Use cases (2–3) with related requirements ---
  const useCaseSpecs = [
    { useCaseId: 'UC-DEMO-001', name: 'Execute delivery mission', description: 'Operator initiates delivery; drone navigates to waypoint, executes drop, returns.', mainFlow: '1. Operator selects payload and destination. 2. Drone takes off and navigates. 3. Drone releases payload at drop zone. 4. Drone returns to base.', relatedReqIds: requirementRecords.slice(0, 5).map((r) => r.id) },
    { useCaseId: 'UC-DEMO-002', name: 'Handle low battery', description: 'When battery is low, drone returns to home or lands safely.', mainFlow: '1. BMS detects low threshold. 2. System triggers RTH or safe landing. 3. Operator is notified.', relatedReqIds: requirementRecords.slice(8, 12).map((r) => r.id) },
    { useCaseId: 'UC-DEMO-003', name: 'Lost link recovery', description: 'On loss of command link, drone executes predefined lost-link procedure.', mainFlow: '1. Link timeout detected. 2. Execute lost-link procedure (RTH or hover). 3. Re-establish link when in range.', relatedReqIds: requirementRecords.slice(14, 18).map((r) => r.id) },
  ]
  for (const uc of useCaseSpecs) {
    const existing = await prisma.useCase.findFirst({ where: { projectId: pid, useCaseId: uc.useCaseId } })
    if (!existing) {
      await prisma.useCase.create({
        data: {
          projectId: pid,
          useCaseId: uc.useCaseId,
          name: uc.name,
          description: uc.description,
          mainFlow: uc.mainFlow,
          status: 'draft',
          relatedRequirementIds: uc.relatedReqIds,
        },
      })
    }
  }
  console.log('Use cases created with related requirements.')

  // --- Parameters (key system parameters) ---
  const paramSpecs = [
    { parameterId: 'PARAM-DEMO-001', name: 'Max flight time (min)', description: 'Maximum flight duration on full charge', unit: 'min', defaultValue: '45', dataType: 'number' },
    { parameterId: 'PARAM-DEMO-002', name: 'Geofence radius (m)', description: 'Default geofence radius from home', unit: 'm', defaultValue: '5000', dataType: 'number' },
    { parameterId: 'PARAM-DEMO-003', name: 'Low battery threshold (%)', description: 'Battery level that triggers RTH', unit: '%', defaultValue: '20', dataType: 'number' },
    { parameterId: 'PARAM-DEMO-004', name: 'Telemetry rate (Hz)', description: 'Downlink telemetry frequency', unit: 'Hz', defaultValue: '10', dataType: 'number' },
    { parameterId: 'PARAM-DEMO-005', name: 'Max payload mass (kg)', description: 'Maximum payload mass', unit: 'kg', defaultValue: '5', dataType: 'number' },
  ]
  for (const p of paramSpecs) {
    const existing = await prisma.parameter.findFirst({ where: { projectId: pid, parameterId: p.parameterId } })
    if (!existing) {
      await prisma.parameter.create({
        data: {
          projectId: pid,
          parameterId: p.parameterId,
          name: p.name,
          description: p.description,
          unit: p.unit,
          defaultValue: p.defaultValue,
          dataType: p.dataType,
          status: 'approved',
        },
      })
    }
  }
  console.log('Parameters created.')

  // --- Requirement comments (sample) ---
  const reqForComment1 = requirementRecords.find((r) => r.requirementId === 'REQ-001')
  const reqForComment2 = requirementRecords.find((r) => r.requirementId === 'REQ-010')
  if (reqForComment1) {
    const count = await prisma.requirementComment.count({ where: { requirementId: reqForComment1.id } })
    if (count === 0) {
      await prisma.requirementComment.create({
        data: { requirementId: reqForComment1.id, projectId: pid, content: 'Flight envelope to be aligned with certification limits.', authorName: 'Demo Seed' },
      })
    }
  }
  if (reqForComment2) {
    const count = await prisma.requirementComment.count({ where: { requirementId: reqForComment2.id } })
    if (count === 0) {
      await prisma.requirementComment.create({
        data: { requirementId: reqForComment2.id, projectId: pid, content: 'Low battery threshold will be parameterized (see PARAM-DEMO-003).', authorName: 'Demo Seed' },
      })
    }
  }
  console.log('Requirement comments added.')

  // --- Test run with results (demo execution) ---
  if (testPlan) {
    const existingRun = await prisma.verTestRun.findFirst({
      where: { projectId: pid, testPlanId: testPlan.id, runName: { contains: 'Demo run' } },
    })
    if (!existingRun) {
      const run = await prisma.verTestRun.create({
        data: {
          projectId: pid,
          testPlanId: testPlan.id,
          runName: 'Demo run – sample execution',
          status: 'COMPLETED',
        },
      })
      const casesInPlan = await prisma.verTestPlanCase.findMany({
        where: { testPlanId: testPlan.id },
        orderBy: { orderIndex: 'asc' },
        take: 10,
        include: { testCase: true },
      })
      for (const pc of casesInPlan) {
        const tc = pc.testCase
        await prisma.verTestRunResult.create({
          data: {
            testRunId: run.id,
            testCaseId: tc.id,
            testCaseVersionSnapshot: {
              version: tc.version,
              title: tc.title,
              objective: tc.objective,
              preconditions: tc.preconditions,
              steps: tc.steps,
              expectedResults: tc.expectedResults,
              passFailCriteria: tc.passFailCriteria,
            },
            parentTestCaseVersionAtExecution: tc.version,
            resultStatus: casesInPlan.indexOf(pc) < 5 ? 'PASS' : 'NOT_RUN',
            executedAt: new Date(),
          },
        })
      }
      console.log('Test run created with sample PASS results.')
    }
  }

  console.log('Demo project seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
