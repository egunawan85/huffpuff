/**
 * Periodically checks for idle workspace machines and stops them.
 */

const { getIdleMachines, stopUserMachine } = require('./machines');

const IDLE_TIMEOUT_MINUTES = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '30', 10);
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

function startIdleMonitor() {
  console.log(`Idle monitor: will stop machines after ${IDLE_TIMEOUT_MINUTES}m of inactivity`);

  setInterval(async () => {
    try {
      const idle = getIdleMachines(IDLE_TIMEOUT_MINUTES);
      for (const machine of idle) {
        console.log(`Stopping idle machine for user ${machine.user_id} (last active: ${machine.last_active_at})`);
        await stopUserMachine(machine.user_id);
      }
    } catch (err) {
      console.error('Idle monitor error:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startIdleMonitor };
