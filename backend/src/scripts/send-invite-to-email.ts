/**
 * One-off: send invite email to a given address.
 * Finds user by inviteEmail or email, sets temp password, sends email.
 * Usage: npx tsx src/scripts/send-invite-to-email.ts <email>
 * Example: npx tsx src/scripts/send-invite-to-email.ts mmertcaferoglu@gmail.com
 *
 * #303: the generated temp password is intentionally NOT logged to stdout.
 * stdout ends up in shell history, CI logs, and terminal buffers where
 * anyone with file-system or build-log access can retrieve a credential
 * that should have stayed in the invite email alone.
 */
import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendInviteEmail } from '../services/email.service'

function randomTempPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let s = ''
  for (let i = 0; i < length; i++) s += chars[bytes[i]! % chars.length]
  return s
}

async function main() {
  const toEmail = process.argv[2]?.trim()
  if (!toEmail || !toEmail.includes('@')) {
    console.error('Usage: npx tsx src/scripts/send-invite-to-email.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ inviteEmail: toEmail }, { email: toEmail }],
    },
    select: { id: true, email: true, inviteEmail: true, name: true },
  })

  if (!user) {
    console.error('No user found with inviteEmail or email:', toEmail)
    process.exit(1)
  }

  const recipient = user.inviteEmail ?? user.email
  if (!recipient || !recipient.includes('@')) {
    console.error('User has no valid email for receiving invite.')
    process.exit(1)
  }

  const tempPassword = randomTempPassword(14)
  const hashedPassword = await bcrypt.hash(tempPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, mustChangePasswordOnFirstLogin: true },
  })

  await sendInviteEmail({
    to: recipient,
    userName: user.email,
    tempPassword,
  })

  console.log('Invite sent to', recipient, 'for user', user.email)
  // #303: tempPassword deliberately withheld from stdout. The recipient
  // receives it via email; requesters who need it must read the email.
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
