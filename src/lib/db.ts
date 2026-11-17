/**
 * The copy of the data kept on this device (IndexedDB), so screens open instantly and the till works
 * without signal. Google Sheets is the shared master; see sync.ts.
 */
const DB = 'legendary-kits';
const STORE = 'kv';

let dbp: Promise<IDBDatabase> | null = null;
const open = () =>
  (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

export async function get<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await open();
    return await new Promise<T>((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result === undefined ? fallback : (r.result as T));
      r.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage blocked (private window): the session still works, it just isn't kept */
  }
}

export async function clearAll(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
