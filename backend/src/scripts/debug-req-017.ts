
import { PrismaClient } from '@prisma/client'
import { traceabilityService } from '../services/traceability.service'

const prisma = new PrismaClient()

async function debugReq() {
    try {
        console.log('--- Debugging REQ-017 ---')

        // 1. Find REQ-017
        const requirements = await prisma.requirement.findMany({
            where: {
                OR: [
                    { requirementId: 'REQ-017' },
                    { title: 'sda' } // Title from screenshot
                ]
            }
        })

        if (requirements.length === 0) {
            console.log('REQ-017 not found.')
            return
        }

        const req = requirements[0]
        console.log(`Found Requirement: ${req.id} (${req.requirementId} - ${req.title})`)

        // 2. Check links
        const allLinks = await traceabilityService.getTraceLinks(req.projectId)

        const outgoing = allLinks.filter(l => l.sourceId === req.id)
        const incoming = allLinks.filter(l => l.targetId === req.id)

        console.log(`Outgoing Links (Source = REQ): ${outgoing.length}`)
        outgoing.forEach(l => console.log(` -> To ${l.targetType} ${l.targetId}`))

        console.log(`Incoming Links (Target = REQ): ${incoming.length}`)
        incoming.forEach(l => {
            console.log(` <- From ${l.sourceType} ${l.sourceId}`)
            console.log(`    Source Title: ${(l as any).sourceTitle}`)
            console.log(`    Source DisplayId: ${(l as any).sourceDisplayId}`)
        })

        if (incoming.length === 0 && outgoing.length === 0) {
            console.log('No links found. Creating a test incoming link...')
            // Find another req to link FROM
            const otherReq = await prisma.requirement.findFirst({
                where: {
                    projectId: req.projectId,
                    id: { not: req.id }
                }
            })

            if (otherReq) {
                await traceabilityService.createTraceLink(
                    req.projectId,
                    'requirement',
                    otherReq.id,
                    'requirement',
                    req.id,
                    'refines',
                    undefined,
                    'Debug Link for REQ-017'
                )
                console.log(`Created INCOMING link from ${otherReq.requirementId} to ${req.requirementId}`)
            } else {
                console.log('No other requirement found to link with.')
            }
        }

    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

debugReq()
