import { prisma } from '../../lib/prisma'


export interface CreateCustomerInput {
  code: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export class CustomerService {
  async createCustomer(input: CreateCustomerInput) {
    const existing = await prisma.customer.findUnique({
      where: { code: input.code },
    })

    if (existing) {
      throw new Error(`Customer with code ${input.code} already exists`)
    }

    return await prisma.customer.create({
      data: input,
    })
  }

  async getCustomers() {
    return await prisma.customer.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  }

  async getCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    return customer
  }
}

export const customerService = new CustomerService()
