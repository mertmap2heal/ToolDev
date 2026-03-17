import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateUomInput {
  code: string
  name: string
  description?: string
}

export class UomService {
  async createUom(input: CreateUomInput) {
    // Check if code already exists
    const existing = await prisma.uom.findUnique({
      where: { code: input.code },
    })

    if (existing) {
      throw new Error(`UOM with code ${input.code} already exists`)
    }

    return await prisma.uom.create({
      data: input,
    })
  }

  async getUoms() {
    return await prisma.uom.findMany({
      orderBy: {
        code: 'asc',
      },
    })
  }

  async getUom(uomId: string) {
    const uom = await prisma.uom.findUnique({
      where: { id: uomId },
    })

    if (!uom) {
      throw new Error(`UOM ${uomId} not found`)
    }

    return uom
  }
}

export const uomService = new UomService()
