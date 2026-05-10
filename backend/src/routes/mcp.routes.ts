import { Router } from 'express'
import { handleMcpRequest } from '../mcp/server'

/**
 * Public MCP endpoint. Mounted at /api/v1/mcp.
 *
 * Auth is NOT `authenticateToken` (that's for users) - MCP uses the
 * scoped API key from the `Authorization: Bearer <mcpKey>` header and
 * the handler verifies it inside `handleMcpRequest`. A missing /
 * revoked / expired key returns 401 before any tool executes.
 *
 * Streamable HTTP transport per spec: a single `/mcp` URL accepts
 * POST (for requests) and may upgrade to SSE for streaming. The SDK
 * transport handles both.
 */
const router = Router()

router.post('/', handleMcpRequest)
router.get('/', handleMcpRequest) // SSE standalone stream

export default router
