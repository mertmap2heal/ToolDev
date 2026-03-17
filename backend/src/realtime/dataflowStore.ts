// In-memory store for multi-view data flow

import { SchemaParser } from '../services/schemaParser.js';
import path from 'path';

export type FlowView = 'INFRA' | 'APP' | 'TRACE' | 'DATA' | 'SCHEMA';

export interface DataFlowState {
  nodes: any[];
  edges: any[];
}

// Global Initialization from Core Schema
const prismaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const prismaModels = SchemaParser.parseSchema(prismaPath);
const schemaState: DataFlowState = SchemaParser.generateFlowData(prismaModels);

const infraState: DataFlowState = {
  nodes: [
    { id: 'ui-main', type: 'custom', position: { x: 0, y: 150 }, data: { label: 'Web Frontend', type: 'ui', status: 'online', load: 12, metrics: { latency: 45, load: 12, errors: 0 } } },
    { id: 'api-gw', type: 'custom', position: { x: 300, y: 150 }, data: { label: 'API Gateway', type: 'api', status: 'online', latency: '4ms', metrics: { latency: 4, load: 45, errors: 0 } } },
    { id: 'auth-srv', type: 'custom', position: { x: 300, y: 0 }, data: { label: 'Auth Service', type: 'auth', status: 'online', metrics: { latency: 12, load: 5, errors: 0 } } },
    { id: 'compute-srv', type: 'custom', position: { x: 600, y: 150 }, data: { label: 'Core Engine', type: 'service', status: 'online', load: 45, metrics: { latency: 150, load: 85, errors: 0 } } },
    { id: 'db-primary', type: 'custom', position: { x: 900, y: 150 }, data: { label: 'PostgreSQL', type: 'db', status: 'online', metrics: { latency: 2, load: 30, errors: 0 } } },
  ],
  edges: [
    { id: 'e-ui-api', source: 'ui-main', target: 'api-gw', animated: true },
    { id: 'e-api-auth', source: 'api-gw', target: 'auth-srv', animated: true },
    { id: 'e-api-core', source: 'api-gw', target: 'compute-srv', animated: true },
    { id: 'e-core-db', source: 'compute-srv', target: 'db-primary', animated: true },
  ],
};

const appState: DataFlowState = {
  nodes: [
    { id: 'm-inventory', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Inventory management', type: 'service', status: 'online', metrics: { latency: 80, load: 40, errors: 0 } } },
    { id: 'm-tasks', type: 'custom', position: { x: 300, y: 0 }, data: { label: 'Tasks', type: 'service', status: 'online', metrics: { latency: 50, load: 20, errors: 0 } } },
    { id: 'm-lifecycle', type: 'custom', position: { x: 150, y: 200 }, data: { label: 'Lifecycle', type: 'service', status: 'online', metrics: { latency: 120, load: 60, errors: 0 } } },
    { id: 'm-ai', type: 'custom', position: { x: 450, y: 200 }, data: { label: 'AI Guide', type: 'api', status: 'online', metrics: { latency: 1500, load: 95, errors: 2 } } },
  ],
  edges: [
    { id: 'e-inv-tasks', source: 'm-inventory', target: 'm-tasks', animated: true, label: 'Sync Items' },
    { id: 'e-tasks-lc', source: 'm-tasks', target: 'm-lifecycle', animated: true },
    { id: 'e-lc-ai', source: 'm-lifecycle', target: 'm-ai', animated: true },
  ],
};

const traceState: DataFlowState = {
  nodes: [
    { id: 't-1', type: 'custom', position: { x: 50, y: 100 }, data: { label: 'User Action', type: 'ui', status: 'online', metrics: { latency: 10, load: 5, errors: 0 } } },
    { id: 't-2', type: 'custom', position: { x: 250, y: 100 }, data: { label: 'Validation', type: 'auth', status: 'online', metrics: { latency: 100, load: 15, errors: 0 } } },
    { id: 't-3', type: 'custom', position: { x: 450, y: 100 }, data: { label: 'Persistence', type: 'db', status: 'online', metrics: { latency: 5, load: 50, errors: 0 } } },
  ],
  edges: [
    { id: 'te-1', source: 't-1', target: 't-2', animated: true },
    { id: 'te-2', source: 't-2', target: 't-3', animated: true },
  ],
};

const dataState: DataFlowState = {
  nodes: prismaModels.map((m, i) => ({
    id: `db-${m.name.toLowerCase()}`,
    type: 'custom',
    position: { x: (i % 4) * 300, y: Math.floor(i / 4) * 200 },
    data: { 
      label: `${m.name} Store`, 
      type: 'db', 
      status: 'online', 
      metadata: { model: m.name, records: 0 }, 
      metrics: { latency: 5, load: 10, errors: 0 } 
    }
  })),
  edges: schemaState.edges.map(e => ({
    ...e,
    id: `de-${e.id.split('-').slice(1).join('-')}`,
    source: `db-${e.source.split('-')[1]}`,
    target: `db-${e.target.split('-')[1]}`,
  })),
};

const views: Record<FlowView, DataFlowState> = {
  INFRA: infraState,
  APP: appState,
  TRACE: traceState,
  DATA: dataState,
  SCHEMA: schemaState,
};

export function getDataFlowState(view: FlowView = 'INFRA') {
  return views[view];
}

export function updateDataFlowState(view: FlowView, newState: Partial<DataFlowState>) {
  views[view] = { ...views[view], ...newState };
}

export function getAllViews(): Record<FlowView, DataFlowState> {
  return views;
}
