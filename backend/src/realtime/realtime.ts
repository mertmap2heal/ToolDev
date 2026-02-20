import { Server } from 'socket.io';
import http from 'http';
import { getDataFlowState, updateDataFlowState, DataView, getAllViews } from './dataflowStore.js';

export function setupRealtime(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Utility to broadcast events to the War Room Terminal
  const broadcastAdminLog = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
    io.to('ADMIN_LOGS').emit('admin:log', {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });
  };

  // --- Metrics Simulation Loop ---
  setInterval(() => {
    const views = getAllViews();
    (Object.keys(views) as DataView[]).forEach(viewKey => {
      const state = views[viewKey];
      state.nodes.forEach(node => {
        if (!node.data.metrics) return;

        // Fluctuate metrics
        // Latency: small random changes, occasionally a spike
        const spike = Math.random() > 0.95 ? 500 : 0;
        node.data.metrics.latency = Math.max(2, Math.min(2000,
          node.data.metrics.latency + (Math.random() * 20 - 10) + spike
        ));

        // Load: wander between 0-100
        node.data.metrics.load = Math.max(0, Math.min(100,
          node.data.metrics.load + (Math.random() * 10 - 5)
        ));

        // Errors: mostly 0, occasionally 1-5
        if (Math.random() > 0.98) {
          node.data.metrics.errors = Math.floor(Math.random() * 5);
        } else if (Math.random() > 0.8) {
          node.data.metrics.errors = 0;
        }
      });

      // Broadcast update to all clients watching THIS specific view
      io.emit('dataflow:update', {
        view: viewKey,
        ...state
      });
    });
  }, 3000); // Update every 3 seconds

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

    socket.on('disconnect', () => {
      console.log('Realtime: client disconnected', socket.id);
      broadcastAdminLog('DEBUG', `Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
