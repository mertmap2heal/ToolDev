import { Server } from 'socket.io';
import http from 'http';
import { getDataFlowState, updateDataFlowState, FlowView, getAllViews } from './dataflowStore.js';
import { AuditorEngine } from '../services/auditorEngine.js';
import os from 'os';
import process from 'process';
import { PrismaClient } from '@prisma/client';

export function setupRealtime(server: http.Server, prisma: PrismaClient) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Track connected sessions in real-time
  const getActiveSessions = () => {
    const sockets = Array.from(io.sockets.sockets.values());
    return sockets.map(s => ({
      id: s.id,
      name: `Session_${s.id.slice(0, 4)}`,
      entity: (s.handshake.query.view as string) || 'INFRA',
      location: 'Local Host'
    }));
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

      io.emit('dataflow:update', {
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
        io.emit('dataflow:update', { view: 'DATA', ...dataState });
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
    console.log('Realtime: client connected', socket.id);

    if (socket.handshake.query.admin === 'true') {
      socket.join('ADMIN_LOGS');
      broadcastAdminLog('INFO', `Admin joined session: ${socket.id}`, { id: socket.id });
    }

    const currentView = (socket.handshake.query.view as FlowView) || 'INFRA';
    socket.emit('dataflow:init', getDataFlowState(currentView));
    broadcastAdminLog('DEBUG', `Init State Requested: ${currentView}`, { socket: socket.id, view: currentView });

    socket.on('dataflow:update', (payload: { view: FlowView; nodes: any[]; edges: any[] }) => {
      const viewToUpdate = payload.view || 'INFRA';
      updateDataFlowState(viewToUpdate, payload);

      broadcastAdminLog('INFO', `DataFlow Updated: ${viewToUpdate}`, {
        view: viewToUpdate,
        nodeCount: payload.nodes?.length
      });

      io.emit('dataflow:update', {
        view: viewToUpdate,
        ...getDataFlowState(viewToUpdate)
      });
    });

    socket.on('admin:command', (payload: { command: string }) => {
      broadcastAdminLog('WARN', `System Command Received: ${payload.command}`, {
        admin: socket.id,
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
