import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Standard Means of Compliance (MoC) codes 0-8
 * Based on aerospace certification standards (EASA CS-25 / CS-23 / FAR Part 25).
 */
const MOC_SEED_DATA = [
    {
        code: 0,
        name: 'Not Applicable',
        description: 'No specific means of compliance required.',
        requiresJustification: false,
    },
    {
        code: 1,
        name: 'Test',
        description: 'Compliance demonstrated through physical testing.',
        requiresJustification: false,
    },
    {
        code: 2,
        name: 'Analysis',
        description: 'Compliance demonstrated through engineering analysis or calculation.',
        requiresJustification: false,
    },
    {
        code: 3,
        name: 'Inspection',
        description: 'Compliance demonstrated through visual or physical inspection.',
        requiresJustification: false,
    },
    {
        code: 4,
        name: 'Demonstration',
        description: 'Compliance demonstrated through operational demonstration.',
        requiresJustification: false,
    },
    {
        code: 5,
        name: 'Design Review',
        description: 'Compliance demonstrated through review of design documentation.',
        requiresJustification: false,
    },
    {
        code: 6,
        name: 'Similarity',
        description: 'Compliance demonstrated by similarity to a previously certified design.',
        requiresJustification: true,
    },
    {
        code: 7,
        name: 'Service Experience',
        description: 'Compliance demonstrated through in-service experience data.',
        requiresJustification: true,
    },
    {
        code: 8,
        name: 'Equivalent Safety',
        description: 'Compliance demonstrated by showing equivalent level of safety through alternative means.',
        requiresJustification: true,
    },
]

async function main() {
    console.log('Seeding MoC codes 0-8...')

    for (const moc of MOC_SEED_DATA) {
        await prisma.verMoc.upsert({
            where: { code: moc.code },
            update: {
                name: moc.name,
                description: moc.description,
                requiresJustification: moc.requiresJustification,
                isActive: true,
            },
            create: {
                code: moc.code,
                name: moc.name,
                description: moc.description,
                requiresJustification: moc.requiresJustification,
                isActive: true,
            },
        })
        console.log(`  MoC ${moc.code}: ${moc.name}`)
    }

    console.log('Done! All 9 MoC codes seeded successfully.')
}

main()
    .catch((e) => {
        console.error('Seed error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
