import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
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
    from: FROM_NAME.includes('@') ? FROM_NAME : `"${FROM_NAME}" <${process.env.SMTP_USER ?? 'noreply@localhost'}>`,
    to,
    subject: 'Your Engineering Tool account',
    text,
    html,
  })
}
