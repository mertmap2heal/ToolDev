import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Request, Response } from 'express'
import type { McpAuthContext } from './auth'
import { verifyMcpKey, hasScope } from './auth'
import {
  listParamsInputSchema,
  listParamsInputZod,
  handleListParameters,
} from './tools/list_parameters'
import {
  getParamInputSchema,
  getParamInputZod,
  handleGetParameter,
} from './tools/get_parameter'
import {
  searchParamsInputSchema,
  searchParamsInputZod,
  handleSearchParameters,
} from './tools/search_parameters'

/**
 * Streamable HTTP MCP server for the parameters slice.
 *
 * Wire-up (plan §2.1): Claude Desktop / claude-code / any MCP client
 * adds our server URL + the issued API key. The key pins the call to
 * a single project - there is no `projectId` argument on any tool. A
 * key that belongs to project A can never read project B.
 *
 * Transport: stateless Streamable HTTP (`sessionIdGenerator: undefined`)
 * so every request is self-contained. Matches the MCP 2025-11-25
 * protocol `Streamable HTTP` transport. SSE upgrade happens per-request
 * when the client sends `Accept: text/event-stream`.
 *
 * Key verification happens BEFORE transport.handleRequest so we can
 * short-circuit with 401 for bad tokens without spinning up an
 * McpServer instance.
 *
 * Every tool call calls `recordCall` in `./audit.ts` which writes an
 * `AiInvocation` row (`agentKeyId` set, `userId` null).
 */

function buildServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer(
    {
      name: 'engineering-tool-parameters',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  // Read tools - require the `read` scope. The SDK's zod-compat
  // generic inference collapses on deeply-nested optional chains, so
  // we cast the schema records to `any` - runtime validation still
  // goes through the exported zod objects below.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySchema = (s: unknown) => s as any

  if (hasScope(ctx, 'read')) {
    server.registerTool(
      'list_parameters',
      {
        description:
          'Page through parameters in the active project. Respects itar classification unless the key has itar scope.',
        inputSchema: anySchema(listParamsInputSchema),
      },
      async (rawInput: unknown) => {
        const input = listParamsInputZod.parse(rawInput)
        const result = await handleListParameters(ctx, input)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      },
    )

    server.registerTool(
      'get_parameter',
      {
        description: 'Fetch a single parameter by id or name.',
        inputSchema: anySchema(getParamInputSchema),
      },
      async (rawInput: unknown) => {
        const input = getParamInputZod.parse(rawInput)
        const result = await handleGetParameter(ctx, input)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      },
    )

    server.registerTool(
      'search_parameters',
      {
        description: 'Substring search over parameter name / description (case-insensitive).',
        inputSchema: anySchema(searchParamsInputSchema),
      },
      async (rawInput: unknown) => {
        const input = searchParamsInputZod.parse(rawInput)
        const result = await handleSearchParameters(ctx, input)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      },
    )
  }

  // Draft / review / impact / accept tools land in phase 1c step (d).

  return server
}

/**
 * Handle a single MCP HTTP request. Called from the Express route.
 * Stateless: a fresh McpServer + transport is created per request.
 */
export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) {
    res.status(401).json({ error: 'missing bearer token' })
    return
  }
  const ctx = await verifyMcpKey(token)
  if (!ctx) {
    res.status(401).json({ error: 'invalid or revoked token' })
    return
  }

  const server = buildServer(ctx)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: (e as Error).message })
    }
  } finally {
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
  }
}
