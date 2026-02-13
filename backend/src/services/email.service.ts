import nodemailer from 'nodemailer'

const host = (process.env.SMTP_HOST ?? '').trim()
const user = (process.env.SMTP_USER ?? '').trim()
const pass = (process.env.SMTP_PASS ?? '').trim().replace(/^["']|["']$/g, '')

const transporter =
  host.toLowerCase() === 'smtp.gmail.com' && user && pass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      })
    : nodemailer.createTransport({
        host: host || undefined,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined,
      })

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const FROM_NAME = process.env.INVITE_FROM_NAME ?? 'Engineering Tool'

export interface SendInviteEmailParams {
  to: string
  userName: string
  tempPassword: string
}

export async function sendInviteEmail({
  to,
  userName,
  tempPassword,
}: SendInviteEmailParams): Promise<void> {
  const text = `
Welcome to the Engineering Tool.

Your account has been set up. You can log in with:
- URL: ${APP_URL}
- Username (login): ${userName}
- Temporary password: ${tempPassword}

Please log in and change your password after first login.

This is an automated message; please do not reply.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invitation</title></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Welcome to the Engineering Tool.</p>
  <p>Your account has been set up. You can log in with:</p>
  <ul>
    <li><strong>URL:</strong> <a href="${APP_URL}">${APP_URL}</a></li>
    <li><strong>Username (login):</strong> ${userName}</li>
    <li><strong>Temporary password:</strong> <code style="background:#f0f0f0;padding:2px 6px;">${tempPassword}</code></li>
  </ul>
  <p>Please log in and change your password after first login.</p>
  <p style="color:#666;font-size:0.9em;">This is an automated message; please do not reply.</p>
</body>
</html>
`.trim()

  await transporter.sendMail({
    from: FROM_NAME.includes('@') ? FROM_NAME : `"${FROM_NAME}" <${user || 'noreply@localhost'}>`,
    to,
    subject: 'Your Engineering Tool account',
    text,
    html,
  })
}

export interface SendForgotPasswordEmailParams {
  to: string
  userName: string
  tempPassword: string
}

export async function sendForgotPasswordEmail({
  to,
  userName,
  tempPassword,
}: SendForgotPasswordEmailParams): Promise<void> {
  const text = `
You requested a password reset for the Engineering Tool.

Log in with this temporary password, then set a new password:
- URL: ${APP_URL}
- Username (login): ${userName}
- Temporary password: ${tempPassword}

Please log in and change your password after first login.

This is an automated message; please do not reply.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password reset</title></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>You requested a password reset for the Engineering Tool.</p>
  <p>Log in with this temporary password, then set a new password:</p>
  <ul>
    <li><strong>URL:</strong> <a href="${APP_URL}">${APP_URL}</a></li>
    <li><strong>Username (login):</strong> ${userName}</li>
    <li><strong>Temporary password:</strong> <code style="background:#f0f0f0;padding:2px 6px;">${tempPassword}</code></li>
  </ul>
  <p>Please log in and change your password after first login.</p>
  <p style="color:#666;font-size:0.9em;">This is an automated message; please do not reply.</p>
</body>
</html>
`.trim()

  await transporter.sendMail({
    from: FROM_NAME.includes('@') ? FROM_NAME : `"${FROM_NAME}" <${user || 'noreply@localhost'}>`,
    to,
    subject: 'Password reset - Engineering Tool',
    text,
    html,
  })
}

export interface SendRequirementUpdateEmailParams {
  to: string
  requirementKey: string
  requirementTitle: string
  actorName: string
  timestamp: string
  changes: string[]
  link: string
  action?: 'updated' | 'deleted'
}

export async function sendRequirementUpdateEmail({
  to,
  requirementKey,
  requirementTitle,
  actorName,
  timestamp,
  changes,
  link,
  action = 'updated',
}: SendRequirementUpdateEmailParams): Promise<void> {
  const toolName = process.env.APP_NAME ?? FROM_NAME ?? 'Engineering Tool'
  const subject = action === 'deleted'
    ? `[${toolName}] Requirement ${requirementKey} deleted`
    : `[${toolName}] Requirement ${requirementKey} updated`

  const changeLines = changes.length > 0 ? changes : ['Requirement updated']
  const text = `
${toolName} notification

Requirement: ${requirementKey} - ${requirementTitle}
Updated by: ${actorName}
Time: ${timestamp}

Changes:
${changeLines.map((line) => `- ${line}`).join('\n')}

Open Requirement: ${link}

This is an automated message; please do not reply.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Requirement update</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
  <h2 style="margin: 0 0 12px;">${toolName} notification</h2>
  <p style="margin: 0 0 6px;"><strong>Requirement:</strong> ${requirementKey} &ndash; ${requirementTitle}</p>
  <p style="margin: 0 0 6px;"><strong>Updated by:</strong> ${actorName}</p>
  <p style="margin: 0 0 12px;"><strong>Time:</strong> ${timestamp}</p>
  <div style="margin: 12px 0; padding: 12px; background: #f3f4f6; border-radius: 8px;">
    <strong>Changes</strong>
    <ul style="margin: 8px 0 0 16px; padding: 0;">
      ${changeLines.map((line) => `<li>${line}</li>`).join('')}
    </ul>
  </div>
  <p style="margin: 16px 0;">
    <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px;">Open Requirement</a>
  </p>
  <p style="color:#6b7280;font-size:0.9em;">This is an automated message; please do not reply.</p>
</body>
</html>
`.trim()

  await transporter.sendMail({
    from: FROM_NAME.includes('@') ? FROM_NAME : `"${FROM_NAME}" <${user || 'noreply@localhost'}>`,
    to,
    subject,
    text,
    html,
  })
}
