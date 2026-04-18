import { prisma } from './prisma'

/**
 * Derive admin flag from an email.
 * Precedence: comma-separated ADMIN_EMAILS env var, else first user in DB (by createdAt).
 */
export async function resolveIsAdmin(email: string | null): Promise<boolean> {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS
  if (list) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    return emails.includes(email.toLowerCase())
  }
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return first?.email?.toLowerCase() === email.toLowerCase()
}

/**
 * Single source of truth for admin checks.
 * Admin = role SUPERIOR_ADMIN, role COMPANY_ADMIN, listed in ADMIN_EMAILS, or first user.
 */
export async function isAdminUser(userId: string): Promise<{ email: string; role: string | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user) return null
  const isAdmin =
    user.role === 'SUPERIOR_ADMIN' ||
    user.role === 'COMPANY_ADMIN' ||
    (await resolveIsAdmin(user.email))
  return isAdmin ? user : null
}
