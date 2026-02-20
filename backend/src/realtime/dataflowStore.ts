// In-memory store for multi-view data flow

export type DataView = 'INFRA' | 'APP' | 'TRACE' | 'DATA' | 'SCHEMA';

export interface DataFlowState {
  nodes: any[];
  edges: any[];
}

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
  nodes: [
    { id: 'db-user', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'User Store', type: 'db', status: 'online', metadata: { model: 'User', records: 1250 }, metrics: { latency: 5, load: 10, errors: 0 } } },
    { id: 'db-project', type: 'custom', position: { x: 300, y: 0 }, data: { label: 'Project Store', type: 'db', status: 'online', metadata: { model: 'Project', records: 45 }, metrics: { latency: 8, load: 15, errors: 0 } } },
    { id: 'db-requirement', type: 'custom', position: { x: 600, y: 0 }, data: { label: 'Requirement Store', type: 'db', status: 'online', metadata: { model: 'Requirement', records: 890 }, metrics: { latency: 150, load: 70, errors: 0 } } },
    { id: 'db-task', type: 'custom', position: { x: 300, y: 200 }, data: { label: 'Task Store', type: 'db', status: 'online', metadata: { model: 'Task', records: 156 }, metrics: { latency: 12, load: 20, errors: 0 } } },
    { id: 'db-item', type: 'custom', position: { x: 600, y: 200 }, data: { label: 'Inventory Items', type: 'db', status: 'online', metadata: { model: 'Item', records: 3421 }, metrics: { latency: 20, load: 45, errors: 0 } } },
  ],
  edges: [
    { id: 'de-user-proj', source: 'db-user', target: 'db-project', animated: true, label: 'owns_projects' },
    { id: 'de-proj-req', source: 'db-project', target: 'db-requirement', animated: true, label: 'contains_reqs' },
    { id: 'de-proj-task', source: 'db-project', target: 'db-task', animated: true, label: 'project_tasks' },
    { id: 'de-proj-item', source: 'db-project', target: 'db-item', animated: true, label: 'project_inventory' },
    { id: 'de-req-task', source: 'db-requirement', target: 'db-task', animated: true, label: 'linked_to' },
  ],
};

const schemaState: DataFlowState = {
  nodes: [
    // === CORE & ADMIN ===
    { id: 's-user', type: 'schema', position: { x: 0, y: 0 }, data: { label: 'User', metrics: { latency: 5, load: 10, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'email', type: 'String', unique: true }, { name: 'role', type: 'String' }] } },
    { id: 's-org', type: 'schema', position: { x: 0, y: 200 }, data: { label: 'Organization', metrics: { latency: 8, load: 5, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'companyKey', type: 'String', unique: true }, { name: 'name', type: 'String' }] } },
    { id: 's-audit', type: 'schema', position: { x: 0, y: 400 }, data: { label: 'AuditLog', metrics: { latency: 15, load: 50, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'userId', type: 'UUID', fk: true }, { name: 'action', type: 'String' }] } },

    // === ENGINEERING (LIFECYCLE) ===
    { id: 's-project', type: 'schema', position: { x: 400, y: 0 }, data: { label: 'Project', metrics: { latency: 12, load: 20, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'name', type: 'String' }, { name: 'status', type: 'String' }] } },
    { id: 's-req', type: 'schema', position: { x: 400, y: 250 }, data: { label: 'Requirement', metrics: { latency: 180, load: 85, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'title', type: 'String' }, { name: 'status', type: 'String' }] } },
    { id: 's-func', type: 'schema', position: { x: 400, y: 550 }, data: { label: 'SystemFunction', metrics: { latency: 25, load: 30, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'name', type: 'String' }] } },
    { id: 's-arch', type: 'schema', position: { x: 400, y: 800 }, data: { label: 'Architecture', metrics: { latency: 40, load: 15, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'name', type: 'String' }] } },

    // === EXECUTION (TASKS & ISSUES) ===
    { id: 's-task', type: 'schema', position: { x: 800, y: 0 }, data: { label: 'Task', metrics: { latency: 15, load: 40, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'title', type: 'String' }, { name: 'status', type: 'String' }] } },
    { id: 's-issue', type: 'schema', position: { x: 800, y: 250 }, data: { label: 'Issue', metrics: { latency: 30, load: 55, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'issueKey', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },
    { id: 's-cr', type: 'schema', position: { x: 800, y: 550 }, data: { label: 'ChangeRequest', metrics: { latency: 45, load: 10, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'crId', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },

    // === SUPPLY CHAIN (PURCHASING) ===
    { id: 's-supplier', type: 'schema', position: { x: 1200, y: 0 }, data: { label: 'Supplier', metrics: { latency: 100, load: 5, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'code', type: 'String', unique: true }, { name: 'name', type: 'String' }] } },
    { id: 's-po', type: 'schema', position: { x: 1200, y: 200 }, data: { label: 'PurchaseOrder', metrics: { latency: 150, load: 40, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'number', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },
    { id: 's-receipt', type: 'schema', position: { x: 1200, y: 450 }, data: { label: 'GoodsReceipt', metrics: { latency: 200, load: 60, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'number', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },

    // === COMMERCE (SALES) ===
    { id: 's-customer', type: 'schema', position: { x: 1600, y: 0 }, data: { label: 'Customer', metrics: { latency: 50, load: 15, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'code', type: 'String', unique: true }, { name: 'name', type: 'String' }] } },
    { id: 's-so', type: 'schema', position: { x: 1600, y: 200 }, data: { label: 'SalesOrder', metrics: { latency: 120, load: 50, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'number', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },
    { id: 's-shipment', type: 'schema', position: { x: 1600, y: 450 }, data: { label: 'Shipment', metrics: { latency: 300, load: 75, errors: 1 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'number', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },

    // === OPERATIONS (INVENTORY) ===
    { id: 's-wh', type: 'schema', position: { x: 2000, y: 0 }, data: { label: 'Warehouse', metrics: { latency: 10, load: 30, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'code', type: 'String', unique: true }, { name: 'name', type: 'String' }] } },
    { id: 's-loc', type: 'schema', position: { x: 2000, y: 250 }, data: { label: 'Location', metrics: { latency: 15, load: 40, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'warehouseId', type: 'UUID', fk: true }, { name: 'code', type: 'String' }] } },
    { id: 's-item', type: 'schema', position: { x: 2000, y: 500 }, data: { label: 'Item', metrics: { latency: 25, load: 15, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'sku', type: 'String', unique: true }, { name: 'uomId', type: 'UUID', fk: true }] } },
    { id: 's-balance', type: 'schema', position: { x: 2000, y: 750 }, data: { label: 'InventoryBalance', metrics: { latency: 40, load: 80, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'itemId', type: 'UUID', fk: true }, { name: 'locationId', type: 'UUID', fk: true }, { name: 'qtyOnHand', type: 'Decimal' }] } },

    // === QUALITY (VERIFICATION) ===
    { id: 's-ver-plan', type: 'schema', position: { x: 2400, y: 0 }, data: { label: 'VerTestPlan', metrics: { latency: 20, load: 10, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'projectId', type: 'UUID', fk: true }, { name: 'key', type: 'String', unique: true }] } },
    { id: 's-ver-tc', type: 'schema', position: { x: 2400, y: 250 }, data: { label: 'VerTestCase', metrics: { latency: 35, load: 25, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'key', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },
    { id: 's-ver-run', type: 'schema', position: { x: 2400, y: 550 }, data: { label: 'VerTestRun', metrics: { latency: 500, load: 90, errors: 5 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'status', type: 'String' }, { name: 'startedAt', type: 'Date' }] } },

    // === GOVERNANCE (CERT & COMPLIANCE) ===
    { id: 's-cert-obj', type: 'schema', position: { x: 2800, y: 0 }, data: { label: 'CertObjective', metrics: { latency: 15, load: 5, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'objId', type: 'String', unique: true }, { name: 'status', type: 'String' }] } },
    { id: 's-comp-rule', type: 'schema', position: { x: 2800, y: 250 }, data: { label: 'ComplianceRule', metrics: { latency: 25, load: 10, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'name', type: 'String' }, { name: 'standard', type: 'String' }] } },
    { id: 's-comp-finding', type: 'schema', position: { x: 2800, y: 500 }, data: { label: 'ComplianceFinding', metrics: { latency: 60, load: 45, errors: 0 }, fields: [{ name: 'id', type: 'UUID', pk: true }, { name: 'runId', type: 'UUID', fk: true }, { name: 'status', type: 'String' }] } },
  ],
  edges: [
    // Core Links
    { id: 'se-user-audit', source: 's-user', target: 's-audit', animated: true },
    { id: 'se-user-proj', source: 's-user', target: 's-project', animated: true },

    // Lifecycle Chain
    { id: 'se-proj-req', source: 's-project', target: 's-req', animated: true },
    { id: 'se-req-func', source: 's-req', target: 's-func', animated: true },
    { id: 'se-proj-task', source: 's-project', target: 's-task', animated: true },
    { id: 'se-proj-issue', source: 's-project', target: 's-issue', animated: true },

    // Value Stream Links
    { id: 'se-po-item', source: 's-po', target: 's-item', animated: true },
    { id: 'se-ship-so', source: 's-shipment', target: 's-so', animated: true },
    { id: 'se-item-balance', source: 's-item', target: 's-balance', animated: true },
    { id: 'se-loc-balance', source: 's-loc', target: 's-balance', animated: true },

    // Verification & Cert
    { id: 'se-req-tc', source: 's-req', target: 's-ver-tc', animated: true },
    { id: 'se-ver-plan-tc', source: 's-ver-plan', target: 's-ver-tc', animated: true },
    { id: 'se-tc-run', source: 's-ver-tc', target: 's-ver-run', animated: true },
    { id: 'se-req-cert', source: 's-req', target: 's-cert-obj', animated: true },
    { id: 'se-run-finding', source: 's-ver-run', target: 's-comp-finding', animated: true },
  ],
};

const views: Record<DataView, DataFlowState> = {
  INFRA: infraState,
  APP: appState,
  TRACE: traceState,
  DATA: dataState,
  SCHEMA: schemaState,
};

export function getDataFlowState(view: DataView = 'INFRA') {
  return views[view];
}

export function updateDataFlowState(view: DataView, newState: Partial<DataFlowState>) {
  views[view] = { ...views[view], ...newState };
}

export function getAllViews(): Record<DataView, DataFlowState> {
  return views;
}
