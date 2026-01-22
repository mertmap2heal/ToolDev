import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedUoms() {
  try {
    const existingUoms = await prisma.uom.findMany()
    
    if (existingUoms.length > 0) {
      console.log(`Found ${existingUoms.length} existing UOMs:`)
      existingUoms.forEach(uom => {
        console.log(`  - ${uom.code}: ${uom.name}`)
      })
      return
    }

    console.log('No UOMs found. Creating default UOMs...')
    
    const defaultUoms = [
      { code: 'EA', name: 'Each', description: 'Each unit' },
      { code: 'PC', name: 'Piece', description: 'Piece' },
      { code: 'KG', name: 'Kilogram', description: 'Kilogram' },
      { code: 'M', name: 'Meter', description: 'Meter' },
      { code: 'L', name: 'Liter', description: 'Liter' },
      { code: 'BOX', name: 'Box', description: 'Box' },
      { code: 'PKG', name: 'Package', description: 'Package' },
    ]

    await prisma.uom.createMany({
      data: defaultUoms,
    })

    console.log(`Created ${defaultUoms.length} default UOMs!`)
  } catch (error) {
    console.error('Error seeding UOMs:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUoms()
