// Solmar Bay — save / load through localStorage.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    const data = {
      cash: Math.round(state.cash),
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      health: Math.round(state.health),
      pos: [Math.round(state.pos.x), Math.round(state.pos.z)],
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

// True when a save exists, so the title screen can offer "Continue".
export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}
