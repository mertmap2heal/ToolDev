import { Router } from 'express'
import {
  register,
  login,
  forgotPassword,
  reauth,
  getCurrentUser,
  changeMyPassword,
  updateMyProfile,
  getUsers,
  createAdminUser,
  resetUserPassword,
  updateUserInviteEmail,
  sendUserInvite,
} from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import rateLimit from 'express-rate-limit'

// Tighter limit for credential endpoints — 10 attempts per 15-minute window (#36)
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts — please try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
})

// Slightly looser limit for account-management endpoints (password reset, invite) (#36)
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
})

const router = Router()

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     description: >-
 *       Create a new user account and return a session JWT. Public — no
 *       authentication required. The first user created on a fresh
 *       deployment (or any user whose email is in `ADMIN_EMAILS`) becomes an
 *       admin. Rate-limited to 10 attempts per 15-minute window.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               name: { type: string }
 *               company: { type: string }
 *           example:
 *             email: engineer@example.com
 *             password: passw0rd123
 *             name: Jane Engineer
 *             company: Acme Aerospace
 *     responses:
 *       '201':
 *         description: Account created. Returns the user and a session JWT.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { type: object }
 *                         token: { type: string }
 *             example:
 *               success: true
 *               data:
 *                 user: { id: usr_1, email: engineer@example.com, name: Jane Engineer, role: USER, isAdmin: false }
 *                 token: eyJhbGciOiJIUzI1Ni) ...
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/register', credentialLimiter, register)

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and obtain a session JWT
 *     description: >-
 *       Authenticate with email + password and return a session JWT.
 *       Public — no authentication required. Rate-limited to 10 attempts per
 *       15-minute window.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *           example:
 *             email: engineer@example.com
 *             password: passw0rd123
 *     responses:
 *       '200':
 *         description: Authenticated. Returns the user and a session JWT.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { type: object }
 *                         token: { type: string }
 *             example:
 *               success: true
 *               data:
 *                 user: { id: usr_1, email: engineer@example.com, name: Jane Engineer, role: USER, mustChangePassword: false }
 *                 token: eyJhbGciOiJIUzI1Ni) ...
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         description: Invalid email or password.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Invalid credentials' }
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/login', credentialLimiter, login)

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset email
 *     description: >-
 *       Trigger a password-reset email for the given address. Public — no
 *       authentication required. Always returns 200 with the same generic
 *       message regardless of whether the email exists, to avoid leaking
 *       which addresses are registered. Rate-limited.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *           example:
 *             email: engineer@example.com
 *     responses:
 *       '200':
 *         description: Generic acknowledgement (sent whether or not the address exists).
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { type: string }
 *             example:
 *               success: true
 *               message: If that email is registered, a reset link has been sent.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/forgot-password', credentialLimiter, forgotPassword)

/**
 * @openapi
 * /auth/reauth:
 *   post:
 *     tags: [Auth]
 *     summary: Re-authenticate for a signing event (CFR 21 Part 11)
 *     description: >-
 *       Re-enter the account password to mint a short-lived (60-second)
 *       re-authentication token. Required by CFR 21 Part 11 signing
 *       endpoints — the caller must already hold a valid session JWT, and
 *       the re-auth token is then sent as the `X-Reauth-Token` header on the
 *       sign-off request. Rate-limited like `/login`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, format: password }
 *           example:
 *             password: passw0rd123
 *     responses:
 *       '200':
 *         description: Re-authenticated. Returns a 60-second re-auth token.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         reauthToken: { type: string }
 *                         expiresAt: { type: string, format: date-time }
 *             example:
 *               success: true
 *               data:
 *                 reauthToken: eyJhbGciOiJIUzI1Ni) ...
 *                 expiresAt: '2026-05-17T14:23:11.000Z'
 *       '401':
 *         description: Missing session token, or the supplied password is wrong.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Invalid password' }
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/reauth', credentialLimiter, authenticateToken, reauth)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     description: Return the profile of the user identified by the session JWT.
 *     responses:
 *       '200':
 *         description: The current user's profile.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: usr_1, email: engineer@example.com, name: Jane Engineer, role: USER, isAdmin: false }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/me', authenticateToken, getCurrentUser)

/**
 * @openapi
 * /auth/me/password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change the current user's password
 *     description: >-
 *       Change the password of the authenticated user. The current password
 *       must be supplied and verified before the change is applied.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *           example:
 *             currentPassword: passw0rd123
 *             newPassword: newpassw0rd456
 *     responses:
 *       '200':
 *         description: Password updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { type: string }
 *             example: { success: true, message: 'Password updated' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         description: Not authenticated, or the current password is wrong.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Current password is incorrect' }
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/me/password', authenticateToken, changeMyPassword)

/**
 * @openapi
 * /auth/me/profile:
 *   patch:
 *     tags: [Auth]
 *     summary: Update the current user's profile
 *     description: Update the name and/or avatar of the authenticated user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               avatarUrl: { type: string, format: uri }
 *           example:
 *             name: Jane A. Engineer
 *     responses:
 *       '200':
 *         description: Profile updated. Returns the updated user.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: usr_1, email: engineer@example.com, name: Jane A. Engineer }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/me/profile', authenticateToken, updateMyProfile)

/**
 * @openapi
 * /auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: List all users
 *     description: >-
 *       List every user account. Admin-only — the controller rejects
 *       non-admin callers with 403.
 *     responses:
 *       '200':
 *         description: The list of users.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *             example:
 *               success: true
 *               data:
 *                 - { id: usr_1, email: engineer@example.com, name: Jane Engineer, role: USER }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Auth]
 *     summary: Create a user as an admin
 *     description: >-
 *       Create a new user account. Admin-only. Optionally sends an invite
 *       email if SMTP is configured.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name]
 *             properties:
 *               email: { type: string, format: email }
 *               name: { type: string }
 *               company: { type: string }
 *               role: { type: string, enum: [USER, COMPANY_ADMIN, SUPERIOR_ADMIN] }
 *           example:
 *             email: newhire@example.com
 *             name: New Hire
 *             role: USER
 *     responses:
 *       '201':
 *         description: User created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: usr_2, email: newhire@example.com, name: New Hire, role: USER }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/users', authenticateToken, getUsers)
router.post('/users', authenticateToken, createAdminUser)

/**
 * @openapi
 * /auth/users/{userId}/password:
 *   put:
 *     tags: [Auth]
 *     summary: Reset another user's password (admin)
 *     description: >-
 *       Set a new password for the given user. Admin-only. Rate-limited to
 *       20 requests per 15-minute window.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: The id of the user whose password is being reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, format: password, minLength: 8 }
 *           example:
 *             newPassword: resetpassw0rd789
 *     responses:
 *       '200':
 *         description: Password reset.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { type: string }
 *             example: { success: true, message: 'Password updated' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/users/:userId/password', authenticateToken, accountLimiter, resetUserPassword)

/**
 * @openapi
 * /auth/users/{userId}:
 *   patch:
 *     tags: [Auth]
 *     summary: Update a user's invite email (admin)
 *     description: >-
 *       Change the email address on a pending-invite user account.
 *       Admin-only. Rate-limited.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: The id of the user being updated.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *           example:
 *             email: corrected@example.com
 *     responses:
 *       '200':
 *         description: Invite email updated. Returns the updated user.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: usr_2, email: corrected@example.com }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/users/:userId', authenticateToken, accountLimiter, updateUserInviteEmail)

/**
 * @openapi
 * /auth/users/{userId}/send-invite:
 *   post:
 *     tags: [Auth]
 *     summary: Send (or re-send) an invite email (admin)
 *     description: >-
 *       Send a fresh invite email to the given user. Admin-only. Requires
 *       SMTP to be configured. Rate-limited.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: The id of the user to invite.
 *     responses:
 *       '200':
 *         description: Invite email sent.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { type: string }
 *             example: { success: true, message: 'Invite sent' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/:userId/send-invite', authenticateToken, accountLimiter, sendUserInvite)

export default router
