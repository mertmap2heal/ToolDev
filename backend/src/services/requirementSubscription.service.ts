import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PREVIEW_LIMIT = 3

export type RequirementSubscriptionPreview = {
  id: string
  name: string
  avatarUrl: string | null
}

export type RequirementSubscriptionSnapshot = {
  subscribed: boolean
  subscriberCount: number
  preview: RequirementSubscriptionPreview[]
}

export const requirementSubscriptionService = {
  async getSubscriptionSnapshot(
    requirementId: string,
    userId: string
  ): Promise<RequirementSubscriptionSnapshot> {
    const [subscription, subscriberCount, preview] = await Promise.all([
      prisma.requirementSubscription.findUnique({
        where: {
          requirementId_userId: {
            requirementId,
            userId,
          },
        },
      }),
      prisma.requirementSubscription.count({
        where: { requirementId },
      }),
      prisma.requirementSubscription.findMany({
        where: { requirementId },
        orderBy: { createdAt: 'asc' },
        take: PREVIEW_LIMIT,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ])

    return {
      subscribed: !!subscription,
      subscriberCount,
      preview: preview.map((sub) => ({
        id: sub.user.id,
        name: sub.user.name,
        avatarUrl: sub.user.avatarUrl ?? null,
      })),
    }
  },

  async subscribe(requirementId: string, userId: string): Promise<void> {
    await prisma.requirementSubscription.upsert({
      where: {
        requirementId_userId: {
          requirementId,
          userId,
        },
      },
      create: {
        requirementId,
        userId,
      },
      update: {},
    })
  },

  async unsubscribe(requirementId: string, userId: string): Promise<void> {
    await prisma.requirementSubscription.deleteMany({
      where: {
        requirementId,
        userId,
      },
    })
  },
}
