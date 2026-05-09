import { Server, Socket } from 'socket.io';
import http from 'http';
import { getDataFlowState, updateDataFlowState, FlowView, getAllViews } from './dataflowStore.js';
import { AuditorEngine } from '../services/auditorEngine.js';
import os from 'os';
import process from 'process';
import { PrismaClient } from '@prisma/client';
import {
  extractTokenFromHandshake,
  verifySocketToken,
  getAllowedOrigins,
  isProjectMember,
  type SocketUser,
} from './realtimeAuth.js';

/**
 * Socket with the authenticated user attached. We read the user off
 * socket.data so the outer types stay compatible with socket.io.
 */
interface AuthedSocketData {
  user: SocketUser;
}

export function setupRealtime(server: http.Server, prisma: PrismaClient) {
  const allowedOrigins = getAllowedOrigins();
  const io = new Server(server, {
    cors: {
      // Restrict Socket.IO CORS to known front-end origins. See #170.
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // --- Authentication middleware -----------------------------------------
  // Rejects unauthenticated connections and attaches the verified user to
  // socket.data. See realtimeAuth.ts for the pure logic being called here.
  io.use(async (socket, next) => {
    try {
      const token = extractTokenFromHandshake(socket.handshake);
      const result = await verifySocketToken(token, process.env.JWT_SECRET);
      if (!result.ok || !result.user) {
        return next(new Error(result.error || 'Authentication required'));
      }
      (socket.data as AuthedSocketData).user = result.user;
      return next();
    } catch (err) {
      console.error('Realtime: auth middleware error', err);
      return next(new Error('Authentication required'));
    }
  });

  const getUser = (socket: Socket): SocketUser | undefined =>
    (socket.data as AuthedSocketData | undefined)?.user;

  // Track connected sessions in real-time
  const getActiveSessions = () => {
    const sockets = Array.from(io.sockets.sockets.values());
    return sockets.map(s => {
      const user = getUser(s);
      return {
        id: s.id,
        name: user?.email ? `User_${user.email}` : `Session_${s.id.slice(0, 4)}`,
        entity: (s.handshake.query.view as string) || 'INFRA',
        location: 'Local Host',
      };
    });
  };

  // Utility to broadcast events to the War Room Terminal
  const broadcastAdminLog = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
    io.to('ADMIN_LOGS').emit('admin:log', {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });
  };

  // --- Metrics Instrumentation Loop (System Vitals) ---
  // ADMIN_LOGS room is gated on join (admin role only). The raw dataflow
  // view updates are emitted to room `view:<viewKey>` so only sockets that
  // explicitly joined a view receive updates (replaces broadcast-to-all).
  setInterval(() => {
    const views = getAllViews();
    const sysLoad = os.loadavg()[0]; // 1 min load average
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;

    (Object.keys(views) as FlowView[]).forEach(viewKey => {
      const state = views[viewKey];
      state.nodes.forEach((node: any) => {
        if (!node.data.metrics) return;

        if (node.id.includes('compute') || node.id.includes('core')) {
          node.data.metrics.load = Math.round(memUsage);
        } else {
          node.data.metrics.load = Math.max(2, Math.min(98, (node.data.metrics.load * 0.8) + (sysLoad * 5)));
        }
        node.data.metrics.latency = Math.max(1, Math.round(node.data.metrics.latency * 0.9 + (Math.random() * 5)));
      });

      io.to(`view:${viewKey}`).emit('dataflow:update', {
        view: viewKey,
        ...state
      });
    });

    // Global KPI Aggregation
    let totalNodes = 0;
    let avgLatency = 0;
    let avgLoad = 0;
    let totalErrors = 0;
    let activeViews = 0;

    (Object.keys(views) as FlowView[]).forEach(v => {
      const state = views[v];
      if (state.nodes.length > 0) {
        activeViews++;
        totalNodes += state.nodes.length;
        state.nodes.forEach((n: any) => {
          if (n.data.metrics) {
            avgLatency += n.data.metrics.latency || 0;
            avgLoad += n.data.metrics.load || 0;
            totalErrors += n.data.metrics.errors || 0;
          }
        });
      }
    });

    if (totalNodes > 0) {
      avgLatency /= totalNodes;
      avgLoad /= totalNodes;
    }

    const healthScore = Math.max(0, 100 - (avgLoad * 0.3) - (totalErrors * 2));

    io.to('ADMIN_LOGS').emit('admin:kpi', {
      healthScore: Math.round(healthScore),
      avgLatency: Math.round(avgLatency),
      avgLoad: Math.round(avgLoad),
      totalErrors,
      totalNodes,
      activeViews,
      timestamp: new Date().toISOString()
    });
  }, 3000);

  // --- Database Polling Loop (Actual Counts) ---
  // Guard against tick re-entrancy + capped-parallel fan-out so that one
  // slow count() cannot serialize 157 model counts and starve the pool.
  let dbPollInFlight = false;
  const DB_POLL_CONCURRENCY = 8;
  setInterval(async () => {
    if (dbPollInFlight) {
      // Previous tick still running -> drop this one. Counts are advisory.
      return;
    }
    dbPollInFlight = true;
    try {
      const views = getAllViews();
      const dataState = views['DATA'];
      if (dataState) {
        const targets = dataState.nodes
          .map((node: any) => {
            const modelName = node.data.metadata?.model;
            if (!modelName) return null;
            const delegate = (prisma as any)[modelName.toLowerCase()];
            if (!delegate || typeof delegate.count !== 'function') return null;
            return { node, delegate };
          })
          .filter((t: any): t is { node: any; delegate: any } => t !== null);

        let cursor = 0;
        const worker = async () => {
          while (cursor < targets.length) {
            const i = cursor++;
            const { node, delegate } = targets[i];
            try {
              node.data.metadata.records = await delegate.count();
            } catch (err) {
              console.error(`Realtime: count() failed for ${node.data.metadata?.model}`, err);
            }
          }
        };
        const pool = Math.min(DB_POLL_CONCURRENCY, targets.length);
        await Promise.all(Array.from({ length: pool }, () => worker()));

        io.to('view:DATA').emit('dataflow:update', { view: 'DATA', ...dataState });
      }
    } catch (e) {
      console.error('Realtime: DB Polling failed', e);
    } finally {
      dbPollInFlight = false;
    }
  }, 30000);

  // --- Audit Loop ---
  setInterval(() => {
    const views = getAllViews();
    const schemaState = views['SCHEMA'];
    if (schemaState) {
      const findings = AuditorEngine.runAudit(schemaState.nodes, schemaState.edges);
      io.to('ADMIN_LOGS').emit('admin:audit', { findings });
    }
    io.to('ADMIN_LOGS').emit('admin:users', getActiveSessions());
  }, 10000);

  io.on('connection', (socket) => {
    const user = getUser(socket);
    console.log('Realtime: client connected', socket.id, 'user:', user?.userId);

    // Admin room membership is driven by verified JWT role, never by a
    // client-supplied query parameter. See #170.
    if (user?.isAdmin) {
      socket.join('ADMIN_LOGS');
      broadcastAdminLog('INFO', `Admin joined session: ${socket.id}`, {
        id: socket.id,
        userId: user.userId,
      });
    }

    // Per-view room join: every authenticated user can subscribe to a view
    // (read-only). Replaces the previous io.emit broadcast.
    const currentView = (socket.handshake.query.view as FlowView) || 'INFRA';
    socket.join(`view:${currentView}`);
    socket.emit('dataflow:init', getDataFlowState(currentView));
    broadcastAdminLog('DEBUG', `Init State Requested: ${currentView}`, { socket: socket.id, view: currentView });

    // Project-scoped room join request. Verifies membership before joining.
    socket.on('project:join', async (payload: { projectId?: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const u = getUser(socket);
        const projectId = payload?.projectId;
        if (!u || !projectId || typeof projectId !== 'string') {
          ack?.({ ok: false, error: 'Invalid request' });
          return;
        }
        // Admins bypass membership (they have platform-wide visibility).
        if (!u.isAdmin) {
          const allowed = await isProjectMember(u.userId, projectId);
          if (!allowed) {
            ack?.({ ok: false, error: 'Not a project member' });
            return;
          }
        }
        socket.join(`project:${projectId}`);
        ack?.({ ok: true });
      } catch (err) {
        console.error('Realtime: project:join error', err);
        ack?.({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('project:leave', (payload: { projectId?: string }) => {
      const projectId = payload?.projectId;
      if (typeof projectId === 'string' && projectId.length > 0) {
        socket.leave(`project:${projectId}`);
      }
    });

    // Admin-only: mutate dataflow state. Silently no-op (plus admin log) for
    // non-admin sockets to avoid leaking that the room exists.
    socket.on('dataflow:update', (payload: { view: FlowView; nodes: any[]; edges: any[] }) => {
      const u = getUser(socket);
      if (!u?.isAdmin) {
        broadcastAdminLog('WARN', `Rejected dataflow:update from non-admin socket`, {
          socket: socket.id,
          userId: u?.userId,
        });
        return;
      }
      const viewToUpdate = payload.view || 'INFRA';
      updateDataFlowState(viewToUpdate, payload);

      broadcastAdminLog('INFO', `DataFlow Updated: ${viewToUpdate}`, {
        view: viewToUpdate,
        nodeCount: payload.nodes?.length
      });

      io.to(`view:${viewToUpdate}`).emit('dataflow:update', {
        view: viewToUpdate,
        ...getDataFlowState(viewToUpdate)
      });
    });

    socket.on('admin:command', (payload: { command: string }) => {
      const u = getUser(socket);
      if (!u?.isAdmin) {
        broadcastAdminLog('WARN', `Rejected admin:command from non-admin socket`, {
          socket: socket.id,
          userId: u?.userId,
        });
        return;
      }
      broadcastAdminLog('WARN', `System Command Received: ${payload.command}`, {
        admin: socket.id,
        userId: u.userId,
        command: payload.command
      });

      if (payload.command === 'Flush Cache') {
        broadcastAdminLog('INFO', 'Clearing Redis Layer...', { status: 'COMPLETE' });
      }
    });

    // ── Parameter-level presence ────────────────────────────────────
    // When a user opens the parameter detail drawer the client emits
    // `parameter:viewing` with the parameter id. Anyone else in the
    // same project room receives `parameter:viewers` carrying the
    // current viewer set. Pure ephemeral state — never persisted.
    socket.on('parameter:viewing', (payload: { projectId?: string; parameterId?: string }) => {
      const u = getUser(socket);
      const { projectId, parameterId } = payload || {};
      if (!u || !projectId || !parameterId) return;
      // Mark on socket.data so disconnects can be cleaned up.
      const sd = socket.data as AuthedSocketData & { viewing?: Set<string> };
      sd.viewing = sd.viewing ?? new Set<string>();
      sd.viewing.add(`${projectId}:${parameterId}`);
      socket.join(`param-presence:${projectId}:${parameterId}`);
      // Broadcast updated viewer list (excluding self).
      const viewers = computeViewers(io, projectId, parameterId);
      io.to(`param-presence:${projectId}:${parameterId}`).emit('parameter:viewers', {
        projectId, parameterId, viewers,
      });
    });

    socket.on('parameter:stop-viewing', (payload: { projectId?: string; parameterId?: string }) => {
      const { projectId, parameterId } = payload || {};
      if (!projectId || !parameterId) return;
      const sd = socket.data as AuthedSocketData & { viewing?: Set<string> };
      sd.viewing?.delete(`${projectId}:${parameterId}`);
      socket.leave(`param-presence:${projectId}:${parameterId}`);
      const viewers = computeViewers(io, projectId, parameterId);
      io.to(`param-presence:${projectId}:${parameterId}`).emit('parameter:viewers', {
        projectId, parameterId, viewers,
      });
    });

    socket.on('disconnect', () => {
      console.log('Realtime: client disconnected', socket.id);
      broadcastAdminLog('DEBUG', `Client disconnected: ${socket.id}`);
      // Clean up presence rooms the socket was in.
      const sd = socket.data as AuthedSocketData & { viewing?: Set<string> };
      if (sd.viewing) {
        for (const key of sd.viewing) {
          const [projectId, parameterId] = key.split(':');
          const viewers = computeViewers(io, projectId, parameterId);
          io.to(`param-presence:${projectId}:${parameterId}`).emit('parameter:viewers', {
            projectId, parameterId, viewers,
          });
        }
      }
    });
  });

  return io;
}

function computeViewers(io: Server, projectId: string, parameterId: string) {
  const room = io.sockets.adapter.rooms.get(`param-presence:${projectId}:${parameterId}`);
  if (!room) return [];
  const seen = new Map<string, { userId: string; email: string | null }>();
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid);
    const u = (s?.data as AuthedSocketData | undefined)?.user;
    if (u && !seen.has(u.userId)) {
      seen.set(u.userId, { userId: u.userId, email: u.email });
    }
  }
  return Array.from(seen.values());
}
