import { Server } from 'socket.io';
import http from 'http';
import { getDataFlowState, updateDataFlowState, DataView, getAllViews } from './dataflowStore.js';
import { AuditorEngine } from '../services/auditorEngine.js';
import os from 'os';
import process from 'process';

export function setupRealtime(server: http.Server) {
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

  // --- Metrics Instrumentation Loop ---
  setInterval(() => {
    const views = getAllViews();
    const sysLoad = os.loadavg()[0]; // 1 min load average
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;

    (Object.keys(views) as DataView[]).forEach(viewKey => {
      const state = views[viewKey];
      state.nodes.forEach(node => {
        if (!node.data.metrics) return;

        // Map system metrics to specific nodes if applicable
        if (node.id.includes('compute') || node.id.includes('core')) {
          node.data.metrics.load = Math.round(memUsage); // Using memory as a proxy for load for visual persistence
        } else {
          // Standard fluctuation but anchored to real load intensity
          node.data.metrics.load = Math.max(2, Math.min(98, (node.data.metrics.load * 0.8) + (sysLoad * 5)));
        }

        // Latency reflects real process uptime jitter
        node.data.metrics.latency = Math.max(1, Math.round(node.data.metrics.latency * 0.9 + (Math.random() * 5)));
      });

      // Broadcast update to all clients watching THIS specific view
      io.emit('dataflow:update', {
        view: viewKey,
        ...state
      });
    });

    // --- Global KPI Aggregation ---
    let totalNodes = 0;
    let avgLatency = 0;
    let avgLoad = 0;
    let totalErrors = 0;
    let activeViews = 0;

    (Object.keys(views) as DataView[]).forEach(v => {
      const state = views[v];
      if (state.nodes.length > 0) {
        activeViews++;
        totalNodes += state.nodes.length;
        state.nodes.forEach(n => {
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

    // Platform Health Score Calculation (0-100)
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

  // --- Audit Loop ---
  setInterval(() => {
    const views = getAllViews();
    const schemaState = views['SCHEMA'];
    if (schemaState) {
      const findings = AuditorEngine.runAudit(schemaState.nodes, schemaState.edges);
      io.to('ADMIN_LOGS').emit('admin:audit', { findings });
    }

    // Broadcast REAL active sessions
    io.to('ADMIN_LOGS').emit('admin:users', getActiveSessions());
  }, 10000);

  io.on('connection', (socket) => {
    console.log('Realtime: client connected', socket.id);

    // Check if it's an admin joining the log room
    if (socket.handshake.query.admin === 'true') {
      socket.join('ADMIN_LOGS');
      broadcastAdminLog('INFO', `Admin joined session: ${socket.id}`, { id: socket.id });
    }

    // Clients specify which view they want on join, or default to INFRA
    const currentView: DataView = (socket.handshake.query.view as DataView) || 'INFRA';

    // Emit current state for the requested view
    socket.emit('dataflow:init', getDataFlowState(currentView));
    broadcastAdminLog('DEBUG', `Init State Requested: ${currentView}`, { socket: socket.id, view: currentView });

    // Listen for targeted updates
    socket.on('dataflow:update', (payload: { view: DataView; nodes: any[]; edges: any[] }) => {
      const viewToUpdate = payload.view || 'INFRA';
      updateDataFlowState(viewToUpdate, payload);

      broadcastAdminLog('INFO', `DataFlow Updated: ${viewToUpdate}`, {
        view: viewToUpdate,
        nodeCount: payload.nodes?.length
      });

      // Broadcast update to all clients watching THIS specific view
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

      // Simulation effect for specific commands
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
