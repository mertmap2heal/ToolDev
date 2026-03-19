import { prisma } from '../../lib/prisma'


export interface CreateWarehouseInput {
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  negativeStockPolicy?: 'STRICT' | 'ALLOW_WITH_WARNING'
}

export interface CreateLocationInput {
  warehouseId: string
  code: string
  name?: string
  parentLocationId?: string
  locationType?: string
  pickingPriority?: number
}

export class WarehouseService {
  async createWarehouse(input: CreateWarehouseInput) {
    // Check if code already exists
    const existing = await prisma.warehouse.findUnique({
      where: { code: input.code },
    })

    if (existing) {
      throw new Error(`Warehouse with code ${input.code} already exists`)
    }

    return await prisma.warehouse.create({
      data: {
        name: input.name,
        code: input.code,
        address: input.address,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        country: input.country,
        negativeStockPolicy: input.negativeStockPolicy || 'STRICT',
      },
    })
  }

  async getWarehouses() {
    return await prisma.warehouse.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  }

  async getWarehouse(warehouseId: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        locations: {
          orderBy: {
            code: 'asc',
          },
        },
      },
    })

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`)
    }

    return warehouse
  }

  async createLocation(input: CreateLocationInput) {
    // Check if code already exists in warehouse
    const existing = await prisma.location.findUnique({
      where: {
        warehouseId_code: {
          warehouseId: input.warehouseId,
          code: input.code,
        },
      },
    })

    if (existing) {
      throw new Error(`Location with code ${input.code} already exists in this warehouse`)
    }

    return await prisma.location.create({
      data: {
        warehouseId: input.warehouseId,
        code: input.code,
        name: input.name,
        parentLocationId: input.parentLocationId,
        locationType: input.locationType,
        pickingPriority: input.pickingPriority || 0,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })
  }

  async getLocationTree(warehouseId: string) {
    const locations = await prisma.location.findMany({
      where: {
        warehouseId,
      },
      orderBy: {
        code: 'asc',
      },
    })

    // Build tree structure
    const locationMap = new Map<string, any>()
    const rootLocations: any[] = []

    // First pass: create map
    for (const location of locations) {
      locationMap.set(location.id, {
        ...location,
        children: [],
      })
    }

    // Second pass: build tree
    for (const location of locations) {
      const locationNode = locationMap.get(location.id)!
      if (location.parentLocationId) {
        const parent = locationMap.get(location.parentLocationId)
        if (parent) {
          parent.children.push(locationNode)
        } else {
          rootLocations.push(locationNode)
        }
      } else {
        rootLocations.push(locationNode)
      }
    }

    return rootLocations
  }

  async updateWarehouse(warehouseId: string, input: Partial<CreateWarehouseInput>) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    })

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`)
    }

    return await prisma.warehouse.update({
      where: { id: warehouseId },
      data: input,
    })
  }

  async deleteWarehouse(warehouseId: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        locations: true,
      },
    })

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`)
    }

    if (warehouse.locations.length > 0) {
      throw new Error(`Cannot delete warehouse ${warehouse.name}: has ${warehouse.locations.length} locations`)
    }

    return await prisma.warehouse.delete({
      where: { id: warehouseId },
    })
  }

  async updateLocation(locationId: string, input: Partial<CreateLocationInput>) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    })

    if (!location) {
      throw new Error(`Location ${locationId} not found`)
    }

    return await prisma.location.update({
      where: { id: locationId },
      data: input,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })
  }

  async deleteLocation(locationId: string) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        children: true,
        balances: {
          where: {
            qtyOnHand: {
              gt: 0,
            },
          },
        },
      },
    })

    if (!location) {
      throw new Error(`Location ${locationId} not found`)
    }

    if (location.children.length > 0) {
      throw new Error(`Cannot delete location ${location.code}: has child locations`)
    }

    if (location.balances.length > 0) {
      throw new Error(`Cannot delete location ${location.code}: has inventory`)
    }

    return await prisma.location.delete({
      where: { id: locationId },
    })
  }
}

export const warehouseService = new WarehouseService()
