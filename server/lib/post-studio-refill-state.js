/**
 * Persist Post Studio refill progress — survives Render restarts during heavy compose.
 */
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'data', 'x', 'post-studio-refill-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { running: false, lastResult: null, updatedAt: null };
  }
}

function writeState(patch) {
  const doc = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function setRunning(running) {
  return writeState({ running: !!running });
}

function setLastResult(lastResult) {
  return writeState({ running: false, lastResult: lastResult || null });
}

function getStatus() {
  const doc = readState();
  return {
    running: !!doc.running,
    lastResult: doc.lastResult || null,
    updatedAt: doc.updatedAt || null
  };
}

module.exports = { STATE_PATH, getStatus, setRunning, setLastResult, readState };
