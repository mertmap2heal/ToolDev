/**
 * Comprehensive full-capability demo seed for "SkyBridge-X1 — Urban Air Mobility Platform".
 * Demonstrates every DB-backed module: Requirements, PBS, Functions, Parameters, ParameterTypes,
 * ProjectUnits, CommBus/Messages/Fields, Verification, Baselines, ChangeRequests, Issues,
 * UseCases, Actors, Tasks, BoardColumns, Documents, ComplianceRules+Runs+Findings,
 * VerEvidence, and full Certification (CertPlan, CertMilestone, CertChecklist, CertSignOff, CertFinding).
 *
 * Usage: cd backend && npx tsx src/scripts/seed-full-demo.ts
 * Idempotent — safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_SLUG = 'skybridge-x1-demo'
const DEMO_NAME = 'SkyBridge-X1 Demo'
const DEMO_DOMAIN = 'Urban Air Mobility'

function slugFromName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'project'
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base
  let n = 1
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`
  }
  return slug
}

// ─── Requirements ───────────────────────────────────────────────────────────

const REQ_TEMPLATES = [
  { title: 'Vehicle shall operate within defined flight envelope', description: 'The UAM vehicle shall maintain controlled flight within defined altitude, speed, and attitude limits under all operational conditions.', type: 'functional' },
  { title: 'Battery pack energy density shall meet mission requirements', description: 'The battery system shall provide sufficient capacity for a 50 km nominal mission with 20% reserve.', type: 'performance' },
  { title: 'Detect-and-avoid shall meet aviation safety requirements', description: 'The DAA system shall detect conflicting traffic and issue resolution advisories within 2 seconds.', type: 'safety' },
  { title: 'Air Traffic Management interface protocol compliance', description: 'The vehicle shall implement the defined UTM/ATM communication protocol for flight authorisation.', type: 'interface' },
  { title: 'Maximum takeoff weight constraint', description: 'The vehicle total mass at takeoff shall not exceed the defined MTOW envelope per design baseline.', type: 'design_constraint' },
  { title: 'Encrypted command and control link', description: 'All command and control traffic shall be encrypted using the specified cryptographic mechanism.', type: 'security' },
  { title: 'Pilot interface workload shall meet human factors requirements', description: 'The cockpit or ground control interface shall maintain operator workload below defined limits.', type: 'usability' },
  { title: 'Hover accuracy at vertipad', description: 'The vehicle shall position within 0.5 m horizontal and 0.1 m vertical of the vertipad target point.', type: 'performance' },
  { title: 'Low energy return to vertipad', description: 'When available energy falls below threshold, the vehicle shall execute automated return-to-base.', type: 'safety' },
  { title: 'Propulsion motor telemetry interface', description: 'The flight computer shall receive motor health data via the defined high-speed serial interface.', type: 'interface' },
  { title: 'Operating temperature range for avionics', description: 'All onboard electronics shall operate within specified temperature bounds with design margin.', type: 'design_constraint' },
  { title: 'Geofence enforcement in all flight modes', description: 'The system shall prevent flight outside the active geofence under all commanded modes.', type: 'safety' },
  { title: 'Minimum telemetry downlink rate', description: 'The vehicle shall transmit position and state telemetry at no less than 10 Hz.', type: 'performance' },
  { title: 'Multi-sensor data fusion for navigation', description: 'The navigation system shall fuse GPS, IMU, and LIDAR data to produce position and velocity estimates.', type: 'functional' },
  { title: 'Passenger door open and close cycle', description: 'The passenger door actuator shall complete open and close cycles within specified time limits.', type: 'functional' },
  { title: 'Loss of datalink contingency procedure', description: 'On loss of the primary command link beyond timeout, the vehicle shall execute the lost-link contingency.', type: 'safety' },
  { title: 'Power management and monitoring interface', description: 'The power management unit shall report bus voltages, currents, and state of charge per interface spec.', type: 'interface' },
  { title: 'Landing gear deployment and locking', description: 'Landing gear shall deploy and lock within 5 seconds of command or auto-land trigger.', type: 'functional' },
  { title: 'Operator manual and training material usability', description: 'All operator-facing procedures shall be validated against the usability specification.', type: 'usability' },
  { title: 'Software update authenticity verification', description: 'Software updates shall be verified for integrity and authenticity prior to installation.', type: 'security' },
]

function generateRequirements(count: number) {
  const out: { title: string; description: string; requirementType: string }[] = []
  for (let i = 0; i < count; i++) {
    const t = REQ_TEMPLATES[i % REQ_TEMPLATES.length]!
    const suffix = i >= REQ_TEMPLATES.length ? ` (variant ${Math.floor(i / REQ_TEMPLATES.length) + 1})` : ''
    out.push({ title: t.title + suffix, description: t.description + (suffix ? ' Derived requirement for full coverage.' : ''), requirementType: t.type })
  }
  return out
}

const PBS_NAMES = [
  'SkyBridge-X1 Urban Air Mobility Vehicle',
  'Propulsion System',
  'Battery & Energy Storage',
  'Flight Management Computer',
  'Detect-and-Avoid System',
  'Communication Subsystem',
  'Navigation Module',
  'Airframe Structure',
  'Landing System',
  'Passenger Cabin',
  'Thermal Management',
  'Power Distribution Unit',
  'Ground Control Station',
  'Maintenance Support Equipment',
]

const FUNCTION_NAMES = [
  'Execute vertical takeoff and landing',
  'Navigate along planned route',
  'Detect and avoid conflicting traffic',
  'Manage battery state and energy flow',
  'Communicate with UTM/ATM network',
  'Maintain thermal envelope',
  'Execute safe landing at vertipad',
  'Control passenger boarding sequence',
  'Monitor propulsion system health',
  'Apply geofence constraints',
  'Fuse navigation sensor data',
  'Handle datalink loss contingency',
]

const VER_METHODS = ['Inspection', 'Test', 'Analysis', 'Demonstration'] as const
const REQ_LEVELS = ['system', 'subsystem', 'component', 'interface'] as const
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const COMPLEXITY = ['simple', 'moderate', 'complex'] as const
const SOURCES = ['Stakeholder input', 'System design', 'Regulatory requirement', 'Customer requirement', 'Derived'] as const
const STATUSES = ['draft', 'draft', 'draft', 'approved', 'approved', 'in-review', 'in-review', 'rejected'] as const
const STAGES = ['definition', 'definition', 'allocation', 'allocation', 'verification', 'validation'] as const
const REVIEW_STATUSES = ['draft', 'draft', 'in_review', 'approved', 'approved', 'rejected'] as const
// MoC codes: 1=Test, 2=Analysis, 3=Inspection, 4=Demonstration
const MOC_CODES = [1, 2, 3, 4, 1, 2, 3, 4] as const
const PRIORITIES = ['low', 'medium', 'medium', 'high', 'high', 'critical'] as const

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve first user for ownership and evidence links
  const firstUser = await prisma.user.findFirst({ select: { id: true, name: true } })
  if (!firstUser) {
    console.error('No user found. Run seed:users first.')
    process.exit(1)
  }
  const userId = firstUser.id
  console.log(`Using user: ${firstUser.name} (${userId})`)

  // ── Project ──────────────────────────────────────────────────────────────
  let project = await prisma.project.findUnique({ where: { slug: DEMO_SLUG }, select: { id: true } })
  if (!project) {
    project = await prisma.project.findFirst({ where: { name: DEMO_NAME }, select: { id: true } })
  }
  if (!project) {
    const slug = await ensureUniqueSlug(DEMO_SLUG)
    project = await prisma.project.create({
      data: { name: DEMO_NAME, description: 'Full-capability demo for Urban Air Mobility vehicle development lifecycle', domain: DEMO_DOMAIN, slug, userId },
    })
    await prisma.projectMember.create({ data: { projectId: project.id, userId, role: 'owner' } })
    // Add all other users as members so the project is visible to everyone
    const allUsers = await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } })
    for (const u of allUsers) {
      await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: project.id, userId: u.id } }, create: { projectId: project.id, userId: u.id, role: 'member', status: 'accepted' }, update: {} })
    }
    console.log(`Created project: ${DEMO_NAME} (${project.id})`)
  } else {
    console.log(`Found existing project: ${project.id}`)
  }
  const pid = project.id

  // ── Parameter Types ───────────────────────────────────────────────────────
  const paramTypeSpecs = [
    { name: 'Physical', color: '#0ea5e9', description: 'Physical/engineering quantity', translations: { c_header: 'float', matlab: 'double', python: 'float', ada: 'Float' }, valueFormat: { template: '{value} {unit}', example: '45.0 m/s', hint: 'Numeric value with SI unit' } },
    { name: 'Enumeration', color: '#8b5cf6', description: 'Discrete enumerated state', translations: { c_header: 'uint8_t', matlab: 'uint8', python: 'int', ada: 'Natural' }, valueFormat: { template: '{enum_value}', example: 'NOMINAL', hint: 'Named enumeration value' } },
    { name: 'Boolean', color: '#22c55e', description: 'True/false flag', translations: { c_header: 'bool', matlab: 'logical', python: 'bool', ada: 'Boolean' }, valueFormat: { template: '{true|false}', example: 'true', hint: 'Boolean flag' } },
    { name: 'String', color: '#f59e0b', description: 'Text label or identifier', translations: { c_header: 'char*', matlab: 'char', python: 'str', ada: 'String' }, valueFormat: { template: '"{text}"', example: '"NOMINAL"', hint: 'Quoted text string' } },
  ]
  const paramTypeIds: Record<string, string> = {}
  for (const pt of paramTypeSpecs) {
    const existing = await prisma.parameterType.findUnique({ where: { projectId_name: { projectId: pid, name: pt.name } } })
    if (existing) {
      paramTypeIds[pt.name] = existing.id
    } else {
      const created = await prisma.parameterType.create({ data: { projectId: pid, ...pt } })
      paramTypeIds[pt.name] = created.id
    }
  }
  console.log(`Parameter types: ${Object.keys(paramTypeIds).length}`)

  // ── Project Units ─────────────────────────────────────────────────────────
  const unitSpecs = [
    { name: 'metre', symbol: 'm', description: 'SI unit of length', category: 'length' },
    { name: 'metre per second', symbol: 'm/s', description: 'SI unit of speed', category: 'velocity' },
    { name: 'kilogram', symbol: 'kg', description: 'SI unit of mass', category: 'mass' },
    { name: 'percent', symbol: '%', description: 'Dimensionless percentage', category: 'dimensionless' },
    { name: 'hertz', symbol: 'Hz', description: 'SI unit of frequency', category: 'frequency' },
    { name: 'minute', symbol: 'min', description: 'Time in minutes', category: 'time' },
    { name: 'kilowatt-hour', symbol: 'kWh', description: 'Energy unit', category: 'energy' },
    { name: 'degree Celsius', symbol: 'degC', description: 'Temperature in Celsius', category: 'temperature' },
  ]
  const unitIds: Record<string, string> = {}
  for (const u of unitSpecs) {
    const existing = await prisma.projectUnit.findUnique({ where: { projectId_symbol: { projectId: pid, symbol: u.symbol } } })
    if (existing) {
      unitIds[u.symbol] = existing.id
    } else {
      const created = await prisma.projectUnit.create({ data: { projectId: pid, ...u } })
      unitIds[u.symbol] = created.id
    }
  }
  console.log(`Project units: ${Object.keys(unitIds).length}`)

  // ── PBS ───────────────────────────────────────────────────────────────────
  const componentIds: string[] = []
  let rootComp = await prisma.component.findFirst({ where: { projectId: pid, parentId: null }, select: { id: true } })
  if (!rootComp) {
    rootComp = await prisma.component.create({ data: { projectId: pid, name: PBS_NAMES[0]!, description: 'Root system node for the urban air mobility vehicle', sortOrder: 0 } })
    componentIds.push(rootComp.id)
    for (let i = 1; i < PBS_NAMES.length; i++) {
      const c = await prisma.component.create({ data: { projectId: pid, parentId: rootComp.id, name: PBS_NAMES[i]!, description: `PBS subsystem: ${PBS_NAMES[i]}`, sortOrder: i } })
      componentIds.push(c.id)
    }
    console.log(`PBS: created ${PBS_NAMES.length} components.`)
  } else {
    const all = await prisma.component.findMany({ where: { projectId: pid }, select: { id: true }, orderBy: { sortOrder: 'asc' } })
    all.forEach(c => componentIds.push(c.id))
    console.log(`PBS: using existing ${componentIds.length} components.`)
  }

  // ── System Functions ──────────────────────────────────────────────────────
  const functionIds: string[] = []
  const existingFuncs = await prisma.systemFunction.findMany({ where: { projectId: pid }, select: { id: true } })
  if (existingFuncs.length >= FUNCTION_NAMES.length) {
    existingFuncs.forEach(f => functionIds.push(f.id))
    console.log(`Functions: using existing ${functionIds.length}.`)
  } else {
    const pfx = pid.slice(0, 6)
    for (let i = 0; i < FUNCTION_NAMES.length; i++) {
      const functionId = `FUN-SBX1-${pfx}-${String(i + 1).padStart(3, '0')}`
      let f = await prisma.systemFunction.findFirst({ where: { projectId: pid, functionId } })
      if (!f) {
        f = await prisma.systemFunction.create({ data: { projectId: pid, functionId, name: FUNCTION_NAMES[i]!, description: `System function: ${FUNCTION_NAMES[i]}`, status: 'draft', level: 0, sortOrder: i } })
      }
      functionIds.push(f.id)
    }
    console.log(`Functions: created ${functionIds.length}.`)
  }

  // ── Actors (for Use Cases) ────────────────────────────────────────────────
  const actorSpecs = [
    { name: 'Pilot / Remote Pilot', type: 'primary', description: 'Human operator controlling the vehicle via cockpit or ground station' },
    { name: 'UTM System', type: 'system', description: 'Unmanned Traffic Management system providing authorisations and deconfliction' },
    { name: 'Passenger', type: 'secondary', description: 'Fare-paying occupant of the vehicle cabin' },
    { name: 'Maintenance Technician', type: 'secondary', description: 'Ground crew responsible for vehicle maintenance and ground checks' },
  ]
  const actorIds: Record<string, string> = {}
  for (const a of actorSpecs) {
    const existing = await prisma.actor.findUnique({ where: { projectId_name: { projectId: pid, name: a.name } } })
    if (existing) {
      actorIds[a.name] = existing.id
    } else {
      const created = await prisma.actor.create({ data: { projectId: pid, ...a } })
      actorIds[a.name] = created.id
    }
  }
  console.log(`Actors: ${Object.keys(actorIds).length}`)

  // ── Resolve project members for owner/stakeholder assignment ─────────────
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: pid, status: 'accepted' },
    include: { user: { select: { name: true } } },
  })
  const memberNames = projectMembers.map(m => m.user.name).filter(Boolean) as string[]
  const ownerNames = memberNames.length > 0 ? memberNames : ['Systems Engineer', 'Safety Engineer', 'Avionics Lead', 'Integration Lead']

  // ── Requirements ─────────────────────────────────────────────────────────
  const reqCount = 105
  const reqRecords: { id: string; requirementId: string }[] = []
  const existingReqs = await prisma.requirement.findMany({ where: { projectId: pid, deletedAt: null }, select: { id: true, requirementId: true }, orderBy: { requirementId: 'asc' } })
  if (existingReqs.length >= reqCount) {
    reqRecords.push(...existingReqs.slice(0, reqCount).map(r => ({ id: r.id, requirementId: r.requirementId! })))
    // Backfill richer field values on existing requirements
    const gen = generateRequirements(reqCount)
    for (let i = 0; i < reqRecords.length; i++) {
      const rec = reqRecords[i]!
      const r = gen[i]!
      const owner = ownerNames[i % ownerNames.length]!
      const verMethod = VER_METHODS[i % VER_METHODS.length]!
      const mocCode = MOC_CODES[i % MOC_CODES.length]!
      await prisma.requirement.update({
        where: { id: rec.id },
        data: {
          priority: PRIORITIES[i % PRIORITIES.length],
          status: STATUSES[i % STATUSES.length],
          stage: STAGES[i % STAGES.length],
          reviewStatus: REVIEW_STATUSES[i % REVIEW_STATUSES.length],
          requirementLevel: REQ_LEVELS[i % REQ_LEVELS.length],
          risk: RISK_LEVELS[i % RISK_LEVELS.length],
          complexity: COMPLEXITY[i % COMPLEXITY.length],
          verificationMethod: verMethod,
          linkedMocCode: mocCode,
          owner,
          stakeholders: [owner, ownerNames[(i + 1) % ownerNames.length]!],
          acceptanceCriteria: `The ${r.requirementType} requirement shall be verified by ${verMethod.toLowerCase()} per MoC ${mocCode}. Pass criteria: all specified conditions met within defined tolerances.`,
          rationale: `Required for ${r.requirementType} compliance with CS-25 / ARP4754A. Derived from system safety assessment.`,
          assumptions: 'Vehicle operating within defined environmental envelope. All interfaces per ICD revision in effect.',
          source: SOURCES[i % SOURCES.length],
        },
      })
    }
    console.log(`Requirements: updated ${reqRecords.length} with full field data.`)
  } else {
    const gen = generateRequirements(reqCount)
    for (let i = 0; i < reqCount; i++) {
      const reqId = `REQ-${String(i + 1).padStart(3, '0')}`
      const existing = await prisma.requirement.findFirst({ where: { projectId: pid, requirementId: reqId } })
      if (existing) { reqRecords.push({ id: existing.id, requirementId: existing.requirementId! }); continue }
      const r = gen[i]!
      const componentId = componentIds[i % componentIds.length]!
      const owner = ownerNames[i % ownerNames.length]!
      const verMethod = VER_METHODS[i % VER_METHODS.length]!
      const mocCode = MOC_CODES[i % MOC_CODES.length]!
      const req = await prisma.requirement.create({
        data: {
          projectId: pid, requirementId: reqId, title: r.title, description: r.description,
          requirementType: r.requirementType,
          priority: PRIORITIES[i % PRIORITIES.length],
          status: STATUSES[i % STATUSES.length],
          stage: STAGES[i % STAGES.length],
          reviewStatus: REVIEW_STATUSES[i % REVIEW_STATUSES.length],
          componentId, requirementLevel: REQ_LEVELS[i % REQ_LEVELS.length],
          risk: RISK_LEVELS[i % RISK_LEVELS.length], complexity: COMPLEXITY[i % COMPLEXITY.length],
          verificationMethod: verMethod,
          linkedMocCode: mocCode,
          owner,
          stakeholders: [owner, ownerNames[(i + 1) % ownerNames.length]!],
          acceptanceCriteria: `The ${r.requirementType} requirement shall be verified by ${verMethod.toLowerCase()} per MoC ${mocCode}. Pass criteria: all specified conditions met within defined tolerances.`,
          rationale: `Required for ${r.requirementType} compliance with CS-25 / ARP4754A. Derived from system safety assessment.`,
          assumptions: 'Vehicle operating within defined environmental envelope. All interfaces per ICD revision in effect.',
          source: SOURCES[i % SOURCES.length],
        },
      })
      reqRecords.push({ id: req.id, requirementId: req.requirementId! })
    }
    // Parent-child hierarchy: REQ-002..006 under REQ-001
    const req001 = reqRecords.find(r => r.requirementId === 'REQ-001')
    if (req001) {
      for (const cid of ['REQ-002', 'REQ-003', 'REQ-004', 'REQ-005', 'REQ-006']) {
        const child = reqRecords.find(r => r.requirementId === cid)
        if (child) await prisma.requirement.updateMany({ where: { id: child.id }, data: { parentId: req001.id } })
      }
    }
    console.log(`Requirements: created ${reqRecords.length}.`)
  }

  // ── TraceLinks: Req -> PBS ────────────────────────────────────────────────
  const existingAlloc = await prisma.traceLink.count({ where: { projectId: pid, linkType: 'allocated_to', sourceType: 'requirement', targetType: 'pbs_component' } })
  if (existingAlloc < reqRecords.length) {
    for (const req of reqRecords) {
      const full = await prisma.requirement.findUnique({ where: { id: req.id }, select: { componentId: true } })
      if (!full?.componentId) continue
      const already = await prisma.traceLink.findFirst({ where: { projectId: pid, sourceId: req.id, targetId: full.componentId } })
      if (!already) await prisma.traceLink.create({ data: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'pbs_component', targetId: full.componentId, linkType: 'allocated_to' } })
    }
    console.log('TraceLinks req -> PBS created.')
  }

  // ── TraceLinks: Req -> Function ───────────────────────────────────────────
  for (const req of reqRecords) {
    const funcId = functionIds[reqRecords.indexOf(req) % functionIds.length]!
    const exists = await prisma.traceLink.findFirst({ where: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'function', targetId: funcId } })
    if (!exists) await prisma.traceLink.create({ data: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'function', targetId: funcId, linkType: 'allocated_to' } })
  }
  console.log('TraceLinks req -> function created.')

  // ── Verification ─────────────────────────────────────────────────────────
  const moc = await prisma.verMoc.findUnique({ where: { code: 3 } })
  let method = await prisma.verMethod.findFirst({ where: { projectId: pid, methodType: 'TEST' } })
  if (!method) {
    method = await prisma.verMethod.create({ data: { projectId: pid, name: 'SBX1 Functional Test', methodType: 'TEST', description: 'Functional test method for UAM vehicle requirements', linkedMocCode: moc ? 3 : null, status: 'APPROVED' } })
  }
  let methodAnalysis = await prisma.verMethod.findFirst({ where: { projectId: pid, methodType: 'ANALYSIS' } })
  if (!methodAnalysis) {
    methodAnalysis = await prisma.verMethod.create({ data: { projectId: pid, name: 'SBX1 Safety Analysis', methodType: 'ANALYSIS', description: 'Safety analysis method per ARP4761', linkedMocCode: moc ? 3 : null, status: 'APPROVED' } })
  }
  let setup = await prisma.verTestSetup.findFirst({ where: { projectId: pid } })
  if (!setup) {
    setup = await prisma.verTestSetup.create({ data: { projectId: pid, name: 'SBX1 HIL Bench v2', description: 'Hardware-in-the-loop test bench for UAM vehicle qualification', environmentType: 'HIL', status: 'APPROVED' } })
  }

  const numTC = 50
  const testCaseIds: string[] = []
  for (let i = 0; i < numTC; i++) {
    const key = `TC-SBX1-${String(i + 1).padStart(3, '0')}`
    let tc = await prisma.verTestCase.findFirst({ where: { projectId: pid, key } })
    if (!tc) {
      tc = await prisma.verTestCase.create({
        data: {
          projectId: pid, key, title: `SBX1 test case ${i + 1}: Verify ${REQ_TEMPLATES[i % REQ_TEMPLATES.length]!.type} requirement`,
          objective: `Verify that requirement coverage is achieved for scenario ${i + 1}.`,
          preconditions: 'DUT powered, HIL bench connected, nominal test environment.', steps: ['Initialise DUT per procedure.', 'Apply test stimulus.', 'Record measurements.'], expectedResults: ['Pass criteria met per requirement.'],
          passFailCriteria: 'PASS if all expected results met; FAIL otherwise.', linkedMocCode: moc ? 3 : null, linkedMethodId: method.id, status: 'READY', version: '1.0',
        },
      })
      await prisma.verTestCaseSetup.upsert({ where: { testCaseId_setupId: { testCaseId: tc.id, setupId: setup.id } }, create: { testCaseId: tc.id, setupId: setup.id }, update: {} })
    }
    testCaseIds.push(tc.id)
  }
  console.log(`Test cases: ${testCaseIds.length}`)

  let testPlan = await prisma.verTestPlan.findFirst({ where: { projectId: pid, key: 'TP-SBX1-001' } })
  if (!testPlan) {
    testPlan = await prisma.verTestPlan.create({ data: { projectId: pid, key: 'TP-SBX1-001', name: 'SkyBridge-X1 Qualification Test Plan', description: 'Full qualification test plan for UAM vehicle', scope: 'All 50 functional test cases', phase: 'QUALIFICATION', status: 'ACTIVE' } })
    let orderIndex = 0
    for (const tcid of testCaseIds) {
      await prisma.verTestPlanCase.upsert({ where: { testPlanId_testCaseId: { testPlanId: testPlan.id, testCaseId: tcid } }, create: { testPlanId: testPlan.id, testCaseId: tcid, orderIndex: orderIndex++, isMandatory: true }, update: {} })
    }
    console.log('Test plan TP-SBX1-001 created.')
  }

  // TraceLinks: Req -> TestCase
  for (const req of reqRecords) {
    const tcId = testCaseIds[reqRecords.indexOf(req) % testCaseIds.length]!
    const exists = await prisma.traceLink.findFirst({ where: { projectId: pid, sourceId: req.id, targetId: tcId, linkType: 'verified_by' } })
    if (!exists) await prisma.traceLink.create({ data: { projectId: pid, sourceType: 'requirement', sourceId: req.id, targetType: 'test_case', targetId: tcId, linkType: 'verified_by' } })
  }
  console.log('TraceLinks req -> test_case created.')

  // Test run with results
  const existingRun = await prisma.verTestRun.findFirst({ where: { projectId: pid, runName: { contains: 'SBX1 run' } } })
  if (!existingRun) {
    const run = await prisma.verTestRun.create({ data: { projectId: pid, testPlanId: testPlan.id, runName: 'SBX1 run 1 - Baseline qualification', status: 'COMPLETED' } })
    const planCases = await prisma.verTestPlanCase.findMany({ where: { testPlanId: testPlan.id }, orderBy: { orderIndex: 'asc' }, take: 15, include: { testCase: true } })
    for (let idx = 0; idx < planCases.length; idx++) {
      const pc = planCases[idx]!
      const tc = pc.testCase
      await prisma.verTestRunResult.create({
        data: {
          testRunId: run.id, testCaseId: tc.id,
          testCaseVersionSnapshot: { version: tc.version, title: tc.title, objective: tc.objective, preconditions: tc.preconditions, steps: tc.steps, expectedResults: tc.expectedResults, passFailCriteria: tc.passFailCriteria },
          parentTestCaseVersionAtExecution: tc.version,
          resultStatus: idx < 10 ? 'PASS' : idx < 13 ? 'FAIL' : 'NOT_RUN',
          executedAt: new Date(),
        },
      })
    }
    console.log('Test run created with PASS/FAIL/NOT_RUN results.')
  }

  // ── Verification Evidence ─────────────────────────────────────────────────
  const evidenceSpecs = [
    { evidenceType: 'TEST_REPORT', title: 'HIL Bench Qualification Report Rev A', description: 'Formal qualification test report for SBX1 functional test campaign', storageRef: '/evidence/SBX1-TR-001-RevA.pdf' },
    { evidenceType: 'ANALYSIS_REPORT', title: 'Failure Modes and Effects Analysis', description: 'System-level FMEA per MIL-STD-1629A for propulsion and avionics', storageRef: '/evidence/SBX1-FMEA-001.pdf' },
    { evidenceType: 'CHECKLIST', title: 'Pre-flight Safety Checklist Completed', description: 'Completed ground safety checklist prior to first flight test', storageRef: '/evidence/SBX1-CL-001.pdf' },
    { evidenceType: 'LOG', title: 'Flight Data Recorder Log - Flight 001', description: 'Raw FDR data from first qualification flight', storageRef: '/evidence/SBX1-FDR-001.bin' },
  ]
  const evidenceIds: string[] = []
  for (const ev of evidenceSpecs) {
    let existing = await prisma.verEvidence.findFirst({ where: { projectId: pid, title: ev.title } })
    if (!existing) {
      existing = await prisma.verEvidence.create({ data: { projectId: pid, ...ev, createdByUserId: userId } })
    }
    evidenceIds.push(existing.id)
  }
  // Link first two evidence items to the test plan and test cases
  if (testPlan && evidenceIds[0]) {
    const evLink = await prisma.verEvidenceLink.findFirst({ where: { evidenceId: evidenceIds[0], linkedEntityId: testPlan.id } })
    if (!evLink) await prisma.verEvidenceLink.create({ data: { userId, evidenceId: evidenceIds[0]!, linkedEntityType: 'TEST_RUN', linkedEntityId: testPlan.id, relation: 'PRIMARY' } })
  }
  if (testCaseIds[0] && evidenceIds[1]) {
    const evLink = await prisma.verEvidenceLink.findFirst({ where: { evidenceId: evidenceIds[1], linkedEntityId: testCaseIds[0] } })
    if (!evLink) await prisma.verEvidenceLink.create({ data: { userId, evidenceId: evidenceIds[1]!, linkedEntityType: 'TEST_CASE', linkedEntityId: testCaseIds[0]!, relation: 'SUPPORTING' } })
  }
  console.log(`Verification evidence: ${evidenceIds.length}`)

  // ── Baselines ─────────────────────────────────────────────────────────────
  const baselineNames = ['BL-001 Concept Baseline', 'BL-002 Design Baseline', 'BL-003 Integration Baseline']
  const reqIdsForBl = reqRecords.map(r => r.id)
  for (const name of baselineNames) {
    let bl = await prisma.baseline.findFirst({ where: { projectId: pid, name }, include: { _count: { select: { items: true } } } })
    if (!bl) {
      bl = await prisma.baseline.create({ data: { projectId: pid, name, description: `Demo baseline: ${name}`, status: 'active', baselineType: 'functional' }, include: { _count: { select: { items: true } } } })
    }
    const itemCount = bl._count?.items ?? 0
    if (itemCount === 0) {
      const reqs = await prisma.requirement.findMany({ where: { id: { in: reqIdsForBl }, projectId: pid, deletedAt: null } })
      const links = await prisma.traceLink.findMany({ where: { projectId: pid, OR: [{ sourceType: 'requirement', sourceId: { in: reqIdsForBl } }, { targetType: 'requirement', targetId: { in: reqIdsForBl } }] } })
      await prisma.baseline.update({ where: { id: bl.id }, data: { linksSnapshot: { links: links.map(l => ({ id: l.id, sourceType: l.sourceType, sourceId: l.sourceId, targetType: l.targetType, targetId: l.targetId, linkType: l.linkType })) } } })
      await prisma.baselineItem.createMany({ data: reqs.map(req => ({ baselineId: bl!.id, requirementId: req.id, snapshot: JSON.stringify({ id: req.id, requirementId: req.requirementId, title: req.title, priority: req.priority, status: req.status }) })) })
      console.log(`Baseline "${name}" created with ${reqs.length} items.`)
    }
  }

  // ── Change Requests ───────────────────────────────────────────────────────
  const crSpecs = [
    { crId: 'CR-SBX1-001', title: 'Clarify hover accuracy requirement', status: 'approved', priority: 'high', risk: 'low' },
    { crId: 'CR-SBX1-002', title: 'Extend geofence boundary for expanded ops area', status: 'in-review', priority: 'medium', risk: 'medium' },
    { crId: 'CR-SBX1-003', title: 'Update UTM interface to v3 protocol', status: 'pending', priority: 'high', risk: 'high' },
    { crId: 'CR-SBX1-004', title: 'Add margin to DAA advisory timing', status: 'approved', priority: 'critical', risk: 'medium' },
    { crId: 'CR-SBX1-005', title: 'Revise MTOW envelope for new variant', status: 'pending', priority: 'medium', risk: 'high' },
    { crId: 'CR-SBX1-006', title: 'Tighten telemetry rate for authority compliance', status: 'in-review', priority: 'medium', risk: 'low' },
    { crId: 'CR-SBX1-007', title: 'Update lost-link timeout to 5 seconds', status: 'rejected', priority: 'low', risk: 'low' },
    { crId: 'CR-SBX1-008', title: 'Document thermal margin rationale for CS-25', status: 'approved', priority: 'low', risk: 'low' },
  ]
  for (let i = 0; i < crSpecs.length; i++) {
    const spec = crSpecs[i]!
    const existing = await prisma.changeRequest.findFirst({ where: { projectId: pid, crId: spec.crId } })
    if (!existing) {
      const req = reqRecords[i % reqRecords.length]!
      await prisma.changeRequest.create({
        data: { projectId: pid, crId: spec.crId, title: spec.title, description: `Change request affecting requirement ${req.requirementId}: ${spec.title}.`, sourceType: 'requirement', sourceId: req.id, priority: spec.priority, status: spec.status, risk: spec.risk, requestedBy: 'Demo Seed', requirementLinks: { create: [{ requirementId: req.id, relationshipType: 'originates_from' }] } },
      })
    }
  }
  console.log('Change requests created.')

  // ── Issues ────────────────────────────────────────────────────────────────
  const issueSpecs = [
    { issueKey: 'ISS-SBX1-001', title: 'Ambiguity in hover accuracy coordinate reference', type: 'specification_error' },
    { issueKey: 'ISS-SBX1-002', title: 'Missing preconditions in landing gear requirement', type: 'specification_error' },
    { issueKey: 'ISS-SBX1-003', title: 'UTM interface spec revision needed for v3', type: 'interface_error' },
    { issueKey: 'ISS-SBX1-004', title: 'Safety review finding: low energy RTH threshold', type: 'design_error' },
    { issueKey: 'ISS-SBX1-005', title: 'Operator workload limit not quantified', type: 'specification_error' },
    { issueKey: 'ISS-SBX1-006', title: 'Command link encryption algorithm not specified', type: 'specification_error' },
    { issueKey: 'ISS-SBX1-007', title: 'Thermal margin documentation gap', type: 'documentation_error' },
    { issueKey: 'ISS-SBX1-008', title: 'Geofence test coverage for edge conditions', type: 'other' },
  ]
  for (let i = 0; i < issueSpecs.length; i++) {
    const spec = issueSpecs[i]!
    const existing = await prisma.issue.findFirst({ where: { projectId: pid, issueKey: spec.issueKey } })
    if (!existing) {
      const req = reqRecords[(i + 10) % reqRecords.length]!
      const issue = await prisma.issue.create({ data: { projectId: pid, issueKey: spec.issueKey, title: spec.title, description: `Issue related to ${req.requirementId}: ${spec.title}.`, priority: 'medium', status: 'open', issueType: spec.type } })
      const reqTitle = (await prisma.requirement.findUnique({ where: { id: req.id }, select: { title: true } }))?.title
      await prisma.issueLink.create({ data: { issueId: issue.id, linkedType: 'requirement', linkedId: req.id, linkType: 'relates_to', linkedRequirementKey: req.requirementId, linkedRequirementTitle: reqTitle ?? undefined } })
    }
  }
  console.log('Issues created.')

  // ── Use Cases with Actors ─────────────────────────────────────────────────
  const ucSpecs = [
    {
      useCaseId: 'UC-SBX1-001', name: 'Execute urban delivery mission', status: 'draft',
      description: 'Pilot (or remote pilot) schedules a point-to-point delivery, vehicle navigates autonomously and returns.',
      mainFlow: '1. Pilot plans route and requests UTM authorisation.\n2. Vehicle performs pre-flight checks.\n3. Vehicle takes off and navigates to destination vertipad.\n4. Vehicle lands, offloads payload.\n5. Vehicle returns to base and lands.',
      relatedReqIdxs: [0, 1, 2, 3, 4],
      actorNames: ['Pilot / Remote Pilot', 'UTM System'],
    },
    {
      useCaseId: 'UC-SBX1-002', name: 'Handle low energy return-to-base', status: 'draft',
      description: 'When battery energy falls below threshold, the vehicle automatically returns to the nearest vertipad.',
      mainFlow: '1. Energy monitor detects low threshold.\n2. System initiates RTB sequence.\n3. Pilot / remote pilot is notified.\n4. Vehicle navigates and lands safely.',
      relatedReqIdxs: [8, 9, 10, 11],
      actorNames: ['Pilot / Remote Pilot'],
    },
    {
      useCaseId: 'UC-SBX1-003', name: 'Passenger boarding and securing', status: 'draft',
      description: 'Passenger boards the vehicle, is secured, and the cabin is prepared for flight.',
      mainFlow: '1. Door open sequence commanded.\n2. Passenger boards and is secured.\n3. Weight and balance check performed.\n4. Door closes and locks.\n5. System confirms cabin ready.',
      relatedReqIdxs: [14, 15, 16],
      actorNames: ['Passenger', 'Pilot / Remote Pilot'],
    },
    {
      useCaseId: 'UC-SBX1-004', name: 'Datalink loss contingency', status: 'draft',
      description: 'On loss of command datalink, vehicle executes predefined lost-link procedure.',
      mainFlow: '1. Link timeout triggers lost-link detection.\n2. Vehicle executes pre-planned contingency (hover or RTB).\n3. Link re-acquired; control returned to pilot.',
      relatedReqIdxs: [15, 16, 17],
      actorNames: ['Pilot / Remote Pilot', 'UTM System'],
    },
  ]
  for (const uc of ucSpecs) {
    const existing = await prisma.useCase.findFirst({ where: { projectId: pid, useCaseId: uc.useCaseId } })
    let ucId: string
    if (!existing) {
      const relatedReqIds = uc.relatedReqIdxs.map(i => reqRecords[i]?.id).filter(Boolean) as string[]
      const created = await prisma.useCase.create({ data: { projectId: pid, useCaseId: uc.useCaseId, name: uc.name, description: uc.description, mainFlow: uc.mainFlow, status: uc.status, relatedRequirementIds: relatedReqIds } })
      ucId = created.id
    } else {
      ucId = existing.id
    }
    // Link actors
    for (const actorName of uc.actorNames) {
      const actorId = actorIds[actorName]
      if (!actorId) continue
      const alreadyLinked = await prisma.useCaseActor.findUnique({ where: { useCaseId_actorId: { useCaseId: ucId, actorId } } })
      if (!alreadyLinked) await prisma.useCaseActor.create({ data: { useCaseId: ucId, actorId } })
    }
  }
  console.log('Use cases and actor links created.')

  // ── Parameters ────────────────────────────────────────────────────────────
  const paramSpecs = [
    { parameterId: 'PARAM-SBX1-001', name: 'Max cruise speed', description: 'Maximum vehicle cruise speed', unit: 'm/s', defaultValue: '55', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-002', name: 'Geofence radius', description: 'Radius of active geofence from home vertipad', unit: 'm', defaultValue: '10000', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-003', name: 'Low energy threshold', description: 'Battery SoC level triggering return-to-base', unit: '%', defaultValue: '15', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-004', name: 'Telemetry rate', description: 'Downlink telemetry frame rate', unit: 'Hz', defaultValue: '10', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-005', name: 'Max takeoff weight', description: 'Maximum total mass at takeoff', unit: 'kg', defaultValue: '750', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-006', name: 'Hover accuracy (horizontal)', description: 'Maximum horizontal position error at vertipad', unit: 'm', defaultValue: '0.5', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-007', name: 'Lost-link timeout', description: 'Duration before lost-link contingency activates', unit: 'min', defaultValue: '0.083', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-008', name: 'Battery capacity', description: 'Nominal usable battery energy', unit: 'kWh', defaultValue: '120', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-009', name: 'Max operating temperature', description: 'Maximum ambient temperature for operations', unit: 'degC', defaultValue: '55', dataType: 'number' },
    { parameterId: 'PARAM-SBX1-010', name: 'Flight mode', description: 'Active flight mode enumeration', unit: '', defaultValue: 'NOMINAL', dataType: 'string' },
  ]
  const paramIds: Record<string, string> = {}
  for (const p of paramSpecs) {
    let existing = await prisma.parameter.findFirst({ where: { projectId: pid, parameterId: p.parameterId } })
    if (!existing) {
      existing = await prisma.parameter.create({ data: { projectId: pid, ...p, status: 'approved' } })
    }
    paramIds[p.parameterId] = existing.id
  }
  console.log(`Parameters: ${Object.keys(paramIds).length}`)

  // ── CommBus / CommMessage / CommField ─────────────────────────────────────
  const canBus = await prisma.commBus.findFirst({ where: { projectId: pid, name: 'Vehicle CAN Bus High' } }) ??
    await prisma.commBus.create({ data: { projectId: pid, name: 'Vehicle CAN Bus High', description: 'Primary vehicle CAN bus for avionics and propulsion data', protocol: 'can', config: { baudrate: 1000000, termination: true } } })

  const groundLink = await prisma.commBus.findFirst({ where: { projectId: pid, name: 'Ground Control Uplink / Downlink' } }) ??
    await prisma.commBus.create({ data: { projectId: pid, name: 'Ground Control Uplink / Downlink', description: 'Bidirectional command and telemetry link to ground station', protocol: 'mavlink', config: { version: 'MAVLink 2.0', channel: 'UDP', port: 14550 } } })

  const msgSpecs = [
    { bus: canBus, name: 'Battery Status Frame', messageId: '0x1A0', direction: 'publish', description: 'Periodic battery SoC and voltage broadcast', metadata: { dlc: 8, cycleTime: 100, sender: 'Battery Management System' }, fieldSpecs: [
      { fieldName: 'SoC', description: 'State of charge', dataType: 'uint8', order: 0, config: { startBit: 0, bitLength: 8, scale: 1, offset: 0 }, paramId: paramIds['PARAM-SBX1-003'] },
      { fieldName: 'PackVoltage', description: 'Battery pack voltage', dataType: 'uint16', order: 1, config: { startBit: 8, bitLength: 16, scale: 0.1, offset: 0 }, paramId: undefined },
    ]},
    { bus: canBus, name: 'Flight Mode Status', messageId: '0x1B0', direction: 'publish', description: 'Current vehicle flight mode', metadata: { dlc: 2, cycleTime: 200, sender: 'Flight Management Computer' }, fieldSpecs: [
      { fieldName: 'FlightMode', description: 'Active flight mode code', dataType: 'uint8', order: 0, config: { startBit: 0, bitLength: 8 }, paramId: paramIds['PARAM-SBX1-010'] },
    ]},
    { bus: groundLink, name: 'HEARTBEAT', messageId: '0', direction: 'bidirectional', description: 'MAVLink heartbeat for link monitoring', metadata: { msgType: 'HEARTBEAT', queueSize: 1 }, fieldSpecs: [
      { fieldName: 'type', description: 'MAVLink system type', dataType: 'uint8', order: 0, config: { rosType: 'std_msgs/UInt8' }, paramId: undefined },
    ]},
    { bus: groundLink, name: 'GLOBAL_POSITION_INT', messageId: '33', direction: 'send', description: 'Telemetry: vehicle global position downlink', metadata: { msgType: 'GLOBAL_POSITION_INT', cycleMs: 100 }, fieldSpecs: [
      { fieldName: 'lat', description: 'Latitude in 1E7 degrees', dataType: 'int32', order: 0, config: {}, paramId: undefined },
      { fieldName: 'lon', description: 'Longitude in 1E7 degrees', dataType: 'int32', order: 1, config: {}, paramId: undefined },
      { fieldName: 'alt', description: 'Altitude MSL in mm', dataType: 'int32', order: 2, config: {}, paramId: undefined },
    ]},
  ]
  for (const msg of msgSpecs) {
    let message = await prisma.commMessage.findFirst({ where: { busId: msg.bus.id, name: msg.name } })
    if (!message) {
      message = await prisma.commMessage.create({ data: { busId: msg.bus.id, name: msg.name, messageId: msg.messageId, direction: msg.direction, description: msg.description, metadata: msg.metadata as object } })
    }
    for (const fs of msg.fieldSpecs) {
      const existing = await prisma.commField.findFirst({ where: { messageId: message.id, fieldName: fs.fieldName } })
      if (!existing) {
        await prisma.commField.create({ data: { messageId: message.id, fieldName: fs.fieldName, description: fs.description, dataType: fs.dataType, order: fs.order, config: fs.config as object, ...(fs.paramId && { parameterId: fs.paramId }) } })
      }
    }
  }
  console.log('CommBus, CommMessages, and CommFields created.')

  // ── Board Columns ─────────────────────────────────────────────────────────
  const colSpecs = [
    { statusValue: 'BACKLOG', name: 'Backlog', sortOrder: 0 },
    { statusValue: 'TODO', name: 'To Do', sortOrder: 1 },
    { statusValue: 'IN_PROGRESS', name: 'In Progress', sortOrder: 2, wipLimit: 5 },
    { statusValue: 'IN_REVIEW', name: 'In Review', sortOrder: 3, wipLimit: 3 },
    { statusValue: 'DONE', name: 'Done', sortOrder: 4 },
  ]
  for (const col of colSpecs) {
    const existing = await prisma.boardColumn.findUnique({ where: { projectId_statusValue: { projectId: pid, statusValue: col.statusValue } } })
    if (!existing) await prisma.boardColumn.create({ data: { projectId: pid, ...col } })
  }
  console.log('Board columns created.')

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const taskSpecs = [
    { title: 'Define system-level requirements for propulsion', status: 'DONE', priority: 'HIGH', estimateMinutes: 240 },
    { title: 'Run FMEA on battery management system', status: 'DONE', priority: 'CRITICAL', estimateMinutes: 480 },
    { title: 'Set up HIL test bench for avionics', status: 'IN_PROGRESS', priority: 'HIGH', estimateMinutes: 600 },
    { title: 'Draft qualification test plan TP-SBX1-001', status: 'DONE', priority: 'HIGH', estimateMinutes: 180 },
    { title: 'Resolve DAA advisory timing issue (ISS-SBX1-004)', status: 'IN_PROGRESS', priority: 'CRITICAL', estimateMinutes: 300 },
    { title: 'Update UTM interface spec for v3 protocol', status: 'TODO', priority: 'HIGH', estimateMinutes: 360 },
    { title: 'Complete hover accuracy test cases TC-SBX1-001 to TC-SBX1-010', status: 'IN_REVIEW', priority: 'HIGH', estimateMinutes: 480 },
    { title: 'Document thermal margin rationale (CR-SBX1-008)', status: 'TODO', priority: 'MEDIUM', estimateMinutes: 120 },
    { title: 'Prepare PDR compliance evidence package', status: 'TODO', priority: 'HIGH', estimateMinutes: 720 },
    { title: 'Review and close ISS-SBX1-001 through ISS-SBX1-003', status: 'BACKLOG', priority: 'MEDIUM', estimateMinutes: 180 },
    { title: 'Validate communications bus CAN timing margins', status: 'BACKLOG', priority: 'MEDIUM', estimateMinutes: 240 },
    { title: 'Update PARAM-SBX1-003 low energy threshold value', status: 'BACKLOG', priority: 'LOW', estimateMinutes: 60 },
  ]
  const taskIds: string[] = []
  for (let i = 0; i < taskSpecs.length; i++) {
    const spec = taskSpecs[i]!
    const existing = await prisma.task.findFirst({ where: { projectId: pid, title: spec.title } })
    if (!existing) {
      const task = await prisma.task.create({ data: { projectId: pid, title: spec.title, status: spec.status, priority: spec.priority, estimateMinutes: spec.estimateMinutes, sortOrder: i, assignedToUserId: userId } })
      taskIds.push(task.id)
    } else {
      taskIds.push(existing.id)
    }
  }
  // Make tasks 10-12 children of task 9 (evidence package sub-tasks)
  if (taskIds[8] && taskIds[9] && taskIds[10]) {
    await prisma.task.updateMany({ where: { id: { in: [taskIds[9]!, taskIds[10]!] } }, data: { parentTaskId: taskIds[8]! } })
  }
  console.log(`Tasks: ${taskIds.length}`)

  // ── Documents ─────────────────────────────────────────────────────────────
  const docSpecs = [
    { name: 'System Requirements Specification', type: 'requirements', content: 'This document defines the system-level requirements for the SkyBridge-X1 Urban Air Mobility vehicle, covering functional, performance, safety, interface, and security requirements.' },
    { name: 'Qualification Test Plan - TP-SBX1-001', type: 'test_plan', content: 'Qualification test plan covering all 50 functional test cases for the SkyBridge-X1 system qualification campaign.' },
    { name: 'FMEA Report - Battery Management System', type: 'analysis', content: 'Failure Modes and Effects Analysis for the battery management system per MIL-STD-1629A. 42 failure modes analysed, 3 critical, 12 major.' },
    { name: 'Interface Control Document - UTM v3', type: 'interface', content: 'Defines the interface between the SkyBridge-X1 vehicle and the UTM system including message formats, protocols, and error handling.' },
    { name: 'Certification Plan v1.0', type: 'certification', content: 'Top-level certification plan for CS-25 compliance demonstrating the compliance strategy, schedule, and resource plan.' },
  ]
  for (const doc of docSpecs) {
    const existing = await prisma.document.findFirst({ where: { projectId: pid, name: doc.name } })
    if (!existing) await prisma.document.create({ data: { projectId: pid, ...doc } })
  }
  console.log('Documents created.')

  // ── Compliance Rules + Check Run + Findings ───────────────────────────────
  const ruleSpecs = [
    { name: 'Requirement must have acceptance criteria', standard: 'DO-254', description: 'Every requirement must have a non-empty acceptance criteria field.', checkType: 'requirement_has_acceptance_criteria' },
    { name: 'Requirement must have an owner', standard: 'ARP4754A', description: 'Every requirement must be assigned to a named owner.', checkType: 'requirement_has_owner' },
    { name: 'Requirement must have a verification method', standard: 'DO-178C', description: 'Every requirement must specify how it will be verified.', checkType: 'requirement_has_verification_method' },
    { name: 'Parameter must have a unit', standard: 'ISO 29148', description: 'All physical parameters must have a unit assigned.', checkType: 'parameter_has_unit' },
  ]
  const ruleIds: string[] = []
  for (const rule of ruleSpecs) {
    let existing = await prisma.complianceRule.findFirst({ where: { projectId: pid, checkType: rule.checkType } })
    if (!existing) existing = await prisma.complianceRule.create({ data: { projectId: pid, ...rule, isActive: true } })
    ruleIds.push(existing.id)
  }
  const existingRun2 = await prisma.complianceCheckRun.findFirst({ where: { projectId: pid } })
  if (!existingRun2) {
    const checkRun = await prisma.complianceCheckRun.create({ data: { projectId: pid, name: 'Full compliance sweep - March 2026', status: 'completed', ruleIds } })
    // Create representative findings (mix of pass/fail)
    const findingData = [
      { ruleId: ruleIds[0]!, status: 'pass', entityType: 'requirement', entityId: reqRecords[0]?.id, message: 'Acceptance criteria present.' },
      { ruleId: ruleIds[1]!, status: 'fail', entityType: 'requirement', entityId: reqRecords[2]?.id, message: 'No owner assigned to REQ-003.' },
      { ruleId: ruleIds[2]!, status: 'pass', entityType: 'requirement', entityId: reqRecords[0]?.id, message: 'Verification method specified.' },
      { ruleId: ruleIds[3]!, status: 'pass', entityType: 'parameter', entityId: paramIds['PARAM-SBX1-001'], message: 'Unit m/s assigned.' },
      { ruleId: ruleIds[3]!, status: 'fail', entityType: 'parameter', entityId: paramIds['PARAM-SBX1-010'], message: 'No unit assigned to flight mode parameter.' },
    ]
    for (const f of findingData) {
      if (!f.entityId) continue
      await prisma.complianceFinding.create({ data: { projectId: pid, runId: checkRun.id, ruleId: f.ruleId, status: f.status, entityType: f.entityType, entityId: f.entityId, message: f.message } })
    }
    console.log('Compliance rules, check run, and findings created.')
  }

  // ── Certification ─────────────────────────────────────────────────────────
  await prisma.certContext.upsert({ where: { projectId: pid }, create: { projectId: pid, authority: 'EASA', certBasis: 'CS-25', standards: ['ARP4754A', 'DO-178C', 'DO-254', 'ARP4761'] }, update: {} })

  const certBlSpecs = [
    { baselineId: 'BL-PDR-2026-03', name: 'PDR Functional Baseline', status: 'Frozen' },
    { baselineId: 'BL-CDR-2026-06', name: 'CDR Allocated Baseline', status: 'Submitted' },
    { baselineId: 'BL-SRR-2025-12', name: 'SRR Product Baseline', status: 'Superseded' },
  ]
  for (const b of certBlSpecs) {
    await prisma.certBaseline.upsert({ where: { projectId_baselineId: { projectId: pid, baselineId: b.baselineId } }, create: { projectId: pid, ...b }, update: {} })
  }

  const certRelSpecs = [
    { releaseId: 'REL-2026.04', name: 'April 2026 internal build', status: 'Approved' },
    { releaseId: 'REL-2026.03', name: 'March 2026 customer delivery', status: 'Draft' },
    { releaseId: 'REL-2026.01', name: 'January 2026 snapshot', status: 'Released' },
  ]
  for (const r of certRelSpecs) {
    await prisma.certRelease.upsert({ where: { projectId_releaseId: { projectId: pid, releaseId: r.releaseId } }, create: { projectId: pid, ...r }, update: {} })
  }

  const objSpecs = [
    { objId: 'OBJ-CS25-1309-01', regRef: 'CS 25.1309', title: 'Equipment, systems, and installations', moc: 'Analysis', status: 'Complete', criticality: 'High', linkedEvidenceCount: 3, linkedCiCount: 2, notes: 'FHA and FMEA linked.', reviewed: true },
    { objId: 'OBJ-CS25-1309-02', regRef: 'CS 25.1309', title: 'Failure conditions - probability', moc: 'Test', status: 'Partial', criticality: 'High', linkedEvidenceCount: 2, linkedCiCount: 1, notes: 'Test campaign ongoing.', reviewed: false },
    { objId: 'OBJ-CS25-1301-01', regRef: 'CS 25.1301', title: 'Function and installation', moc: 'Inspection', status: 'Open', criticality: 'Medium', linkedEvidenceCount: 0, linkedCiCount: 0, notes: '', reviewed: false },
    { objId: 'OBJ-CS25-671-01', regRef: 'CS 25.671', title: 'Control system stability', moc: 'Analysis', status: 'Blocked', criticality: 'High', linkedEvidenceCount: 1, linkedCiCount: 1, notes: 'Awaiting stability report.', reviewed: false },
    { objId: 'OBJ-DO178C-A1', regRef: 'DO-178C', title: 'Software level A - requirements', moc: 'Analysis', status: 'Open', criticality: 'High', linkedEvidenceCount: 0, linkedCiCount: 0, notes: 'Software certification in progress.', reviewed: false },
    { objId: 'OBJ-ARP4754A-01', regRef: 'ARP4754A', title: 'Development assurance process', moc: 'Inspection', status: 'Partial', criticality: 'High', linkedEvidenceCount: 1, linkedCiCount: 0, notes: 'Process audit scheduled.', reviewed: false },
  ]
  for (const o of objSpecs) {
    await prisma.certObjective.upsert({ where: { projectId_objId: { projectId: pid, objId: o.objId } }, create: { projectId: pid, ...o }, update: { title: o.title, status: o.status } })
  }

  const matrixSpecs = [
    { regRef: 'CS 25.1309', objectiveCount: 2, mocMix: { Analysis: 1, Test: 1 }, statusSummary: { complete: 1, partial: 1, open: 0, blocked: 0 }, evidenceCount: 5 },
    { regRef: 'CS 25.1301', objectiveCount: 1, mocMix: { Inspection: 1 }, statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 }, evidenceCount: 0 },
    { regRef: 'CS 25.671', objectiveCount: 1, mocMix: { Analysis: 1 }, statusSummary: { complete: 0, partial: 0, open: 0, blocked: 1 }, evidenceCount: 1 },
    { regRef: 'DO-178C', objectiveCount: 1, mocMix: { Analysis: 1 }, statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 }, evidenceCount: 0 },
    { regRef: 'ARP4754A', objectiveCount: 1, mocMix: { Inspection: 1 }, statusSummary: { complete: 0, partial: 1, open: 0, blocked: 0 }, evidenceCount: 1 },
  ]
  for (const m of matrixSpecs) {
    await prisma.certComplianceMatrixRow.upsert({ where: { projectId_regRef: { projectId: pid, regRef: m.regRef } }, create: { projectId: pid, ...m }, update: { objectiveCount: m.objectiveCount, mocMix: m.mocMix as object, statusSummary: m.statusSummary as object, evidenceCount: m.evidenceCount, lastUpdated: new Date() } })
  }

  const gateSpecs = [
    { gateId: 'gate-1', label: 'All certification objectives defined', passed: true, reason: undefined },
    { gateId: 'gate-2', label: 'Compliance matrix complete', passed: false, reason: 'DO-178C objectives not yet defined' },
    { gateId: 'gate-3', label: 'Evidence index up to date', passed: false, reason: 'Pending test campaign completion' },
    { gateId: 'gate-4', label: 'No open Major findings', passed: false, reason: 'FND-SBX1-002 still open' },
    { gateId: 'gate-5', label: 'Authority review log closed', passed: false, reason: undefined },
  ]
  for (const g of gateSpecs) {
    await prisma.certReadinessGate.upsert({ where: { projectId_gateId: { projectId: pid, gateId: g.gateId } }, create: { projectId: pid, ...g }, update: { label: g.label, passed: g.passed, reason: g.reason ?? null } })
  }

  // CertPlan
  const existingCertPlan = await prisma.certPlan.findUnique({ where: { projectId: pid } })
  if (!existingCertPlan) {
    await prisma.certPlan.create({ data: { projectId: pid, version: '1.0', scopeSummary: 'Full type certification for SkyBridge-X1 UAM vehicle under CS-25 with DO-178C DAL-A software and DO-254 DAL-A hardware.', approvalStatus: 'UnderReview', complianceStrategyJson: JSON.stringify({ 'CS 25.1309': 'FHA + FMEA + system test', 'CS 25.1301': 'Inspection and ground functional test', 'DO-178C': 'Formal DO-178C software lifecycle per DAL-A' }) } })
    console.log('CertPlan created.')
  }

  // CertMilestones
  const milestoneSpecs = [
    { name: 'System Requirements Review (SRR)', date: new Date('2025-12-10'), type: 'PDR', status: 'Completed' },
    { name: 'Preliminary Design Review (PDR)', date: new Date('2026-03-15'), type: 'PDR', status: 'Completed' },
    { name: 'Critical Design Review (CDR)', date: new Date('2026-06-20'), type: 'CDR', status: 'Planned' },
    { name: 'Test Readiness Review (TRR)', date: new Date('2026-09-10'), type: 'TRR', status: 'Planned' },
    { name: 'TC Submission to EASA', date: new Date('2027-02-01'), type: 'TC submission', status: 'Planned' },
  ]
  for (const ms of milestoneSpecs) {
    const existing = await prisma.certMilestone.findFirst({ where: { projectId: pid, name: ms.name } })
    if (!existing) await prisma.certMilestone.create({ data: { projectId: pid, ...ms } })
  }
  console.log('Cert milestones created.')

  // CertChecklist + Items + SignOffs
  const checklistSpecs = [
    {
      name: 'PDR Readiness Checklist', phase: 'PDR',
      items: ['Requirements baseline frozen', 'FMEA initiated', 'Certification plan approved', 'Interface control documents released', 'Risk register reviewed'],
      signOffs: [{ role: 'Chief Engineer', person: 'J. Smith', status: 'Signed', signedAt: new Date('2026-03-14') }, { role: 'Safety Manager', person: 'A. Patel', status: 'Signed', signedAt: new Date('2026-03-14') }],
    },
    {
      name: 'CDR Readiness Checklist', phase: 'CDR',
      items: ['Design baseline frozen', 'All critical design decisions documented', 'Test plan approved', 'Software architecture review complete', 'Hardware design assurance initiated'],
      signOffs: [{ role: 'Chief Engineer', person: 'J. Smith', status: 'Pending', signedAt: undefined }, { role: 'DER / DAS', person: 'M. Carter', status: 'Pending', signedAt: undefined }],
    },
  ]
  for (const cl of checklistSpecs) {
    let checklist = await prisma.certChecklist.findFirst({ where: { projectId: pid, name: cl.name } })
    if (!checklist) {
      checklist = await prisma.certChecklist.create({ data: { projectId: pid, name: cl.name, phase: cl.phase } })
      for (let i = 0; i < cl.items.length; i++) {
        const itemStatus = cl.phase === 'PDR' ? 'Complete' : 'Open'
        await prisma.certChecklistItem.create({ data: { checklistId: checklist.id, description: cl.items[i]!, required: true, status: itemStatus, sortOrder: i } })
      }
    }
    for (const so of cl.signOffs) {
      const existing = await prisma.certSignOff.findFirst({ where: { projectId: pid, checklistId: checklist.id, role: so.role } })
      if (!existing) await prisma.certSignOff.create({ data: { projectId: pid, checklistId: checklist.id, role: so.role, person: so.person, status: so.status, signedAt: so.signedAt ?? null } })
    }
  }
  console.log('Cert checklists, items, and sign-offs created.')

  // CertFindings
  const findingSpecs = [
    { findingId: 'FND-SBX1-001', title: 'DAA advisory timing margin insufficient per CS 25.1309', severity: 'Major', status: 'Closed', linkedRegRef: 'CS 25.1309', assignedTo: 'Systems Team', dueDate: new Date('2026-03-01'), notes: 'Resolved by CR-SBX1-004.', safetyRelated: true },
    { findingId: 'FND-SBX1-002', title: 'Stability analysis not yet completed for CS 25.671', severity: 'Major', status: 'Open', linkedRegRef: 'CS 25.671', assignedTo: 'Flight Dynamics', dueDate: new Date('2026-05-15'), notes: 'Analysis in progress.', safetyRelated: true },
    { findingId: 'FND-SBX1-003', title: 'Software objectives not mapped to DO-178C requirements', severity: 'Minor', status: 'InProgress', linkedRegRef: 'DO-178C', assignedTo: 'Software Team', dueDate: new Date('2026-04-30'), notes: 'Mapping document under review.', safetyRelated: false },
    { findingId: 'FND-SBX1-004', title: 'Evidence index incomplete for ARP4754A process objectives', severity: 'Observation', status: 'Open', linkedRegRef: 'ARP4754A', assignedTo: 'Systems Team', dueDate: new Date('2026-06-01'), notes: 'To be completed prior to CDR.', safetyRelated: false },
  ]
  for (const f of findingSpecs) {
    const existing = await prisma.certFinding.findUnique({ where: { projectId_findingId: { projectId: pid, findingId: f.findingId } } })
    if (!existing) await prisma.certFinding.create({ data: { projectId: pid, ...f } })
  }
  console.log('Cert findings created.')

  // ── Requirement comments ───────────────────────────────────────────────────
  const commentSpecs = [
    { reqId: 'REQ-001', content: 'Flight envelope limits to be aligned with CS-25 airworthiness criteria.' },
    { reqId: 'REQ-009', content: 'Low energy threshold PARAM-SBX1-003 (15%) derived from endurance margin analysis.' },
    { reqId: 'REQ-012', content: 'Geofence enforcement tested in TC-SBX1-012 and TC-SBX1-013.' },
    { reqId: 'REQ-016', content: 'Lost-link timeout updated by CR-SBX1-007 (rejected - 5s too long for dense airspace).' },
  ]
  for (const c of commentSpecs) {
    const req = reqRecords.find(r => r.requirementId === c.reqId)
    if (!req) continue
    const existing = await prisma.requirementComment.count({ where: { requirementId: req.id } })
    if (existing === 0) await prisma.requirementComment.create({ data: { requirementId: req.id, projectId: pid, content: c.content, authorName: 'Demo Seed' } })
  }
  console.log('Requirement comments added.')

  // ── Diagrams (MBSE) ────────────────────────────────────────────────────────
  const diagramSpecs = [
    { diagramType: 'bdd', name: 'SkyBridge-X1 Block Definition Diagram', description: 'Top-level BDD showing system blocks and their properties' },
    { diagramType: 'ibd', name: 'Avionics IBD - Internal Block Diagram', description: 'Internal connections between avionics modules' },
    { diagramType: 'uc', name: 'Top-Level Use Case Diagram', description: 'Use cases and actors for UAM mission operations' },
    { diagramType: 'stm', name: 'Flight Mode State Machine', description: 'State machine for vehicle flight modes' },
    { diagramType: 'req', name: 'Safety Requirements Diagram', description: 'Requirement diagram for safety-critical requirements' },
  ]
  for (const d of diagramSpecs) {
    const existing = await prisma.diagram.findFirst({ where: { projectId: pid, name: d.name } })
    if (!existing) await prisma.diagram.create({ data: { projectId: pid, ...d, layout: { zoom: 1, pan: { x: 0, y: 0 } } } })
  }
  console.log('Diagrams created.')

  console.log('\n=== seed-full-demo complete ===')
  console.log(`Project: ${DEMO_NAME} (id: ${pid})`)
  console.log(`  PBS components   : ${componentIds.length}`)
  console.log(`  System functions : ${functionIds.length}`)
  console.log(`  Requirements     : ${reqRecords.length}`)
  console.log(`  Parameters       : ${Object.keys(paramIds).length}`)
  console.log(`  Param types      : ${Object.keys(paramTypeIds).length}`)
  console.log(`  Project units    : ${Object.keys(unitIds).length}`)
  console.log(`  Comm buses       : 2 (CAN + MAVLink)`)
  console.log(`  Test cases       : ${testCaseIds.length}`)
  console.log(`  Test plan/run    : 1 / 1`)
  console.log(`  Baselines        : ${baselineNames.length}`)
  console.log(`  Change requests  : ${crSpecs.length}`)
  console.log(`  Issues           : ${issueSpecs.length}`)
  console.log(`  Use cases        : ${ucSpecs.length}`)
  console.log(`  Actors           : ${actorSpecs.length}`)
  console.log(`  Tasks            : ${taskSpecs.length}`)
  console.log(`  Documents        : ${docSpecs.length}`)
  console.log(`  Compliance rules : ${ruleSpecs.length}`)
  console.log(`  Ver evidence     : ${evidenceIds.length}`)
  console.log(`  Cert objectives  : ${objSpecs.length}`)
  console.log(`  Cert milestones  : ${milestoneSpecs.length}`)
  console.log(`  Cert findings    : ${findingSpecs.length}`)
  console.log(`  Diagrams         : ${diagramSpecs.length}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
