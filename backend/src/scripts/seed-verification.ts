import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed Means of Compliance (MoC) codes 0-8
 * Based on aerospace industry standards (DO-178C, ARP4754A, ISO 26262)
 */
async function seedVerificationMoc() {
  try {
    const existingMocs = await prisma.verMoc.findMany()
    
    if (existingMocs.length > 0) {
      console.log(`Found ${existingMocs.length} existing MoC codes:`)
      existingMocs.forEach(moc => {
        console.log(`  - MoC ${moc.code}: ${moc.name}`)
      })
      return
    }

    console.log('No MoC codes found. Creating default MoC codes 0-8...')
    
    const defaultMocs = [
      {
        code: 0,
        name: 'Not Applicable / Exempt',
        description: 'Verification is not applicable or the requirement is exempt from verification',
        requiresJustification: true,
        defaultRequiredEvidenceTypes: ['JUSTIFICATION', 'APPROVAL'],
        isActive: true,
      },
      {
        code: 1,
        name: 'Analysis',
        description: 'Verification by analysis (mathematical analysis, modeling, simulation, or formal methods)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['ANALYSIS_REPORT', 'MODEL', 'CALCULATION'],
        isActive: true,
      },
      {
        code: 2,
        name: 'Similarity',
        description: 'Verification by similarity to previously verified items (reuse argument)',
        requiresJustification: true,
        defaultRequiredEvidenceTypes: ['SIMILARITY_REPORT', 'COMPARISON', 'JUSTIFICATION'],
        isActive: true,
      },
      {
        code: 3,
        name: 'Test',
        description: 'Verification by test (laboratory test, ground test, flight test)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['TEST_REPORT', 'TEST_RESULTS', 'TEST_DATA'],
        isActive: true,
      },
      {
        code: 4,
        name: 'Inspection',
        description: 'Verification by inspection (visual inspection, measurement, examination)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['INSPECTION_REPORT', 'CHECKLIST', 'PHOTOS'],
        isActive: true,
      },
      {
        code: 5,
        name: 'Demonstration',
        description: 'Verification by demonstration (operational demonstration, proof of concept)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['DEMONSTRATION_REPORT', 'VIDEO', 'OBSERVATION_LOG'],
        isActive: true,
      },
      {
        code: 6,
        name: 'Review',
        description: 'Verification by review (design review, code review, document review)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['REVIEW_REPORT', 'REVIEW_CHECKLIST', 'SIGN_OFF'],
        isActive: true,
      },
      {
        code: 7,
        name: 'Simulation',
        description: 'Verification by simulation (hardware-in-the-loop, software-in-the-loop, model-in-the-loop)',
        requiresJustification: false,
        defaultRequiredEvidenceTypes: ['SIMULATION_REPORT', 'SIM_OUTPUT', 'CONFIGURATION'],
        isActive: true,
      },
      {
        code: 8,
        name: 'Other',
        description: 'Verification by other means (custom method, combination of methods)',
        requiresJustification: true,
        defaultRequiredEvidenceTypes: ['CUSTOM_REPORT', 'JUSTIFICATION'],
        isActive: true,
      },
    ]

    for (const moc of defaultMocs) {
      await prisma.verMoc.upsert({
        where: { code: moc.code },
        update: moc,
        create: moc,
      })
    }

    console.log(`Created/updated ${defaultMocs.length} MoC codes!`)
    console.log('MoC codes seeded successfully.')
  } catch (error) {
    console.error('Error seeding MoC codes:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedVerificationMoc()
