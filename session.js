/**
 * session.js — IndexedDB Session Manager
 * Persists app state so users can resume where they left off
 */

const SessionDB = (() => {
  const DB_NAME = 'VisitingCardApp';
  const DB_VERSION = 1;
  const STORE = 'session';
  let db = null;

  async function open() {
    if (db) return db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function set(key, value) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.put({ key, value, timestamp: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function get(key) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function remove(key) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function clearSession() {
    await remove('current_city');
    await remove('current_step');
    await remove('pending_photo');
    await remove('pending_card');
    await remove('session_active');
  }

  async function saveState(state) {
    await set('app_state', state);
    await set('session_active', true);
  }

  async function loadState() {
    const state = await get('app_state');
    const active = await get('session_active');
    return active ? state : null;
  }

  async function hasActiveSession() {
    const active = await get('session_active');
    const state = await get('app_state');
    return !!(active && state && state.city);
  }

  return { set, get, remove, clearSession, saveState, loadState, hasActiveSession };
})();

window.SessionDB = SessionDB;
