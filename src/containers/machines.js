/**
 * Fly.io Machines API client for managing per-user workspace machines.
 *
 * Uses the Fly Machines REST API:
 * https://fly.io/docs/machines/api/
 */

const db = require('../db');

const FLY_API_URL = process.env.FLY_API_URL || 'https://api.machines.dev';
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_APP_NAME = process.env.FLY_APP_NAME || 'huffpuff-workspaces';
const FLY_IMAGE = process.env.FLY_IMAGE || 'registry.fly.io/huffpuff-workspaces:latest';
const FLY_REGION = process.env.FLY_REGION || 'sjc';

// Machine config
const MACHINE_CPU_KIND = 'shared';
const MACHINE_CPUS = 1;
const MACHINE_MEMORY_MB = 512;
const VOLUME_SIZE_GB = 1;

function flyFetch(path, options = {}) {
  if (!FLY_API_TOKEN) throw new Error('FLY_API_TOKEN not set');
  return fetch(`${FLY_API_URL}/v1/apps/${FLY_APP_NAME}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// -- DB helpers --

function getMachine(userId) {
  return db.prepare('SELECT * FROM machines WHERE user_id = ?').get(userId);
}

function upsertMachine(userId, data) {
  const existing = getMachine(userId);
  if (existing) {
    db.prepare(`
      UPDATE machines SET machine_id = ?, volume_id = ?, status = ?, last_active_at = datetime('now')
      WHERE user_id = ?
    `).run(data.machineId || existing.machine_id, data.volumeId || existing.volume_id, data.status, userId);
  } else {
    db.prepare(`
      INSERT INTO machines (user_id, machine_id, volume_id, status, last_active_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(userId, data.machineId, data.volumeId, data.status);
  }
  return getMachine(userId);
}

// -- Fly Machines API --

async function createVolume(userId) {
  const res = await flyFetch('/volumes', {
    method: 'POST',
    body: JSON.stringify({
      name: `workspace_${userId}`,
      size_gb: VOLUME_SIZE_GB,
      region: FLY_REGION,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create volume: ${await res.text()}`);
  return res.json();
}

async function listMachines() {
  const res = await flyFetch('/machines');
  if (!res.ok) throw new Error(`Failed to list machines: ${await res.text()}`);
  return res.json();
}

async function createMachine(userId, volumeId) {
  const res = await flyFetch('/machines', {
    method: 'POST',
    body: JSON.stringify({
      name: `workspace-${userId}`,
      region: FLY_REGION,
      config: {
        image: FLY_IMAGE,
        env: {
          FILES_ROOT: '/home/user/workspace',
          TTYD_CMD: 'claude',
        },
        guest: {
          cpu_kind: MACHINE_CPU_KIND,
          cpus: MACHINE_CPUS,
          memory_mb: MACHINE_MEMORY_MB,
        },
        mounts: [{
          volume: volumeId,
          path: '/home/user',
        }],
        services: [{
          ports: [{ port: 3000, handlers: ['http'] }],
          protocol: 'tcp',
          internal_port: 3000,
        }],
        auto_destroy: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // If machine already exists, find and return it
    if (text.includes('already_exists')) {
      const machines = await listMachines();
      const existing = machines.find(m => m.name === `workspace-${userId}`);
      if (existing) return existing;
    }
    throw new Error(`Failed to create machine: ${text}`);
  }
  return res.json();
}

async function startMachine(machineId) {
  const res = await flyFetch(`/machines/${machineId}/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to start machine: ${await res.text()}`);
}

async function stopMachine(machineId) {
  const res = await flyFetch(`/machines/${machineId}/stop`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to stop machine: ${await res.text()}`);
}

async function getMachineStatus(machineId) {
  const res = await flyFetch(`/machines/${machineId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.state; // 'started', 'stopped', 'created', etc.
}

async function waitForMachine(machineId, targetState = 'started', timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await getMachineStatus(machineId);
    if (state === targetState) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Machine ${machineId} did not reach state ${targetState} within ${timeoutMs}ms`);
}

// -- Public API --

/**
 * Ensure a user has a running workspace machine.
 * Creates one if it doesn't exist, starts it if stopped.
 * Returns the machine record from DB.
 */
async function ensureMachine(userId) {
  let record = getMachine(userId);

  // No machine yet — create volume + machine
  if (!record) {
    console.log(`Creating workspace for user ${userId}...`);
    const volume = await createVolume(userId);
    const machine = await createMachine(userId, volume.id);
    record = upsertMachine(userId, {
      machineId: machine.id,
      volumeId: volume.id,
      status: 'started',
    });
    await waitForMachine(machine.id, 'started');
    console.log(`Workspace created for user ${userId}: machine=${machine.id}`);
    return getMachine(userId);
  }

  // Machine exists — check state
  const state = await getMachineStatus(record.machine_id);

  if (state === 'started') {
    upsertMachine(userId, { status: 'started' });
    return getMachine(userId);
  }

  if (state === 'stopped' || state === 'created') {
    console.log(`Starting workspace for user ${userId}...`);
    await startMachine(record.machine_id);
    await waitForMachine(record.machine_id, 'started');
    upsertMachine(userId, { status: 'started' });
    console.log(`Workspace started for user ${userId}`);
    return getMachine(userId);
  }

  throw new Error(`Machine ${record.machine_id} in unexpected state: ${state}`);
}

/**
 * Stop a user's workspace machine (for idle cleanup).
 */
async function stopUserMachine(userId) {
  const record = getMachine(userId);
  if (!record) return;

  try {
    await stopMachine(record.machine_id);
    upsertMachine(userId, { status: 'stopped' });
    console.log(`Workspace stopped for user ${userId}`);
  } catch (err) {
    console.error(`Failed to stop workspace for user ${userId}:`, err.message);
  }
}

/**
 * Get the internal Fly address for a user's machine.
 * Fly machines on the same app can reach each other via:
 *   http://<machine-id>.vm.<app-name>.internal:3000
 */
function getMachineAddress(record) {
  return `http://${record.machine_id}.vm.${FLY_APP_NAME}.internal:3000`;
}

/**
 * Update last_active_at for a user (call on each proxied request).
 */
function touchMachine(userId) {
  db.prepare("UPDATE machines SET last_active_at = datetime('now') WHERE user_id = ?").run(userId);
}

/**
 * Get all machines that have been idle for more than `minutes`.
 */
function getIdleMachines(minutes) {
  return db.prepare(`
    SELECT * FROM machines
    WHERE status = 'started'
    AND last_active_at < datetime('now', ?)
  `).all(`-${minutes} minutes`);
}

module.exports = {
  ensureMachine,
  stopUserMachine,
  getMachine,
  getMachineAddress,
  touchMachine,
  getIdleMachines,
};
