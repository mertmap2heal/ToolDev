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
  setInterval(async () => {
    try {
      const views = getAllViews();
      const dataState = views['DATA'];
      if (dataState) {
        for (const node of dataState.nodes) {
          const modelName = node.data.metadata?.model;
          if (modelName && (prisma as any)[modelName.toLowerCase()]) {
            const count = await (prisma as any)[modelName.toLowerCase()].count();
            node.data.metadata.records = count;
          }
        }
        io.to('view:DATA').emit('dataflow:update', { view: 'DATA', ...dataState });
      }
    } catch (e) {
      console.error('Realtime: DB Polling failed', e);
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

    socket.on('disconnect', () => {
      console.log('Realtime: client disconnected', socket.id);
      broadcastAdminLog('DEBUG', `Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
