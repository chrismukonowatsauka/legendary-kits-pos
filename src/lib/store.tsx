import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db';
import * as api from './backend';
import { isLocal, loadThumbs, uploadPending } from './images';
import { monthStart, setCurrencySymbol, stamp, uid } from './format';
import { HISTORY_TABLES, Settings, TABLES, TableName, Tables } from './types';
import { STARTER } from './starter';

/**
 * The app's data. Every screen reads from the copy on this device (instant, works offline);
 * every save is queued and sent to Google Sheets in the background, and the latest from Sheets is
 * pulled every minute, when the app comes back into view, and when you tap Refresh.
 */
type Data = { [K in TableName]: Tables[K][] };

export interface Message {
  id: string;
  text: string;
  kind: 'success' | 'error' | 'info';
}

interface SyncState {
  lastSynced?: string;
  syncing: boolean;
  pending: number;
  error?: string;
  /** Earliest date of history held on this device. */
  historyFrom: string;
}

interface Store {
  ready: boolean;
  data: Data;
  settings: Settings;
  saveSettings: (s: Partial<Settings>) => void;
  /** Save (add or change) records; they go to Google Sheets in the background. */
  save: <K extends TableName>(table: K, rec: Partial<Tables[K]> & { id?: string }) => Tables[K];
  saveMany: <K extends TableName>(table: K, recs: (Partial<Tables[K]> & { id: string })[]) => void;
  remove: (table: TableName, id: string) => void;
  sync: SyncState;
  refresh: () => Promise<void>;
  /** Make sure history from this date is on the device (fetches older records from Sheets). */
  ensureHistory: (from: string) => Promise<void>;
  conn: api.Conn;
  message: Message | null;
  notify: (text: string, kind?: Message['kind']) => void;
  dismiss: () => void;
  resetDevice: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
};

const DEFAULT_SETTINGS: Settings = {
  shopName: 'SynFlow',
  currency: '$',
  backendUrl: '',
  backendKey: '',
  versions: ['Fan Version', 'Player Version', 'Retro', 'Kids'],
  // A short list keeps reports consistent. Printing and packaging are cost of sales on orders, not expenses.
  expenseCategories: ['Transport', 'Courier & shipping', 'Data & airtime', 'Advertising', 'Other'],
  seller: '',
  printCost: 0,
};
const SETTINGS_KEY = 'lk:settings';
const readSettings = (): Settings => {
  try {
    const s: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    // Devices set up before the change list: new name, and the expense list without Rent/Printing/Packaging.
    if (s.shopName === 'Legendary Kits ZW') s.shopName = 'SynFlow';
    const dropped = ['Rent', 'Printing', 'Packaging'];
    if (s.expenseCategories.some((c) => dropped.includes(c))) {
      s.expenseCategories = s.expenseCategories.filter((c) => !dropped.includes(c));
      if (!s.expenseCategories.includes('Advertising')) s.expenseCategories.splice(Math.max(0, s.expenseCategories.indexOf('Other')), 0, 'Advertising');
    }
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

type Outbox = { table: TableName; rec: Record<string, unknown> }[];
const emptyData = () => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Data;

/** Newer copy wins. */
function merge<T extends { id: string; updatedAt: string }>(list: T[], incoming: T[]): T[] {
  if (!incoming.length) return list;
  const map = new Map(list.map((r) => [r.id, r]));
  for (const r of incoming) {
    const old = map.get(r.id);
    if (!old || String(r.updatedAt) >= String(old.updatedAt)) map.set(r.id, r);
  }
  return [...map.values()];
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Data>(emptyData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [settings, setSettings] = useState<Settings>(readSettings);
  const conn = useMemo(() => ({ url: settings.backendUrl, key: settings.backendKey }), [settings.backendUrl, settings.backendKey]);
  const connRef = useRef(conn);
  connRef.current = conn;
  const outbox = useRef<Outbox>([]);
  const cursors = useRef<Partial<Record<TableName, string>>>({});
  const [sync, setSync] = useState<SyncState>({ syncing: false, pending: 0, historyFrom: monthStart() });
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string, kind: Message['kind'] = 'success') => {
    const id = uid();
    setMessage({ id, text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), kind === 'error' ? 8000 : 5000);
  }, []);

  useEffect(() => {
    setCurrencySymbol(settings.currency);
  }, [settings.currency]);
  // Keep any fix-ups made while reading the settings (new name, new expense list).
  useEffect(() => {
    try {
      if (localStorage.getItem(SETTINGS_KEY)) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Load what this device holds ---------- */
  useEffect(() => {
    (async () => {
      await loadThumbs();
      const started = await db.get<boolean>('started', false);
      const loadedData = emptyData();
      for (const t of TABLES) (loadedData as Record<string, unknown[]>)[t] = await db.get(`t:${t}`, started ? [] : ((STARTER as Record<string, unknown[]>)[t] || []));
      outbox.current = await db.get<Outbox>('outbox', []);
      if (!started) {
        for (const t of TABLES) await db.set(`t:${t}`, (loadedData as Record<string, unknown[]>)[t]);
        // The starter accounts go to Google Sheets too (the same ids on every device, so no doubles).
        Object.entries(STARTER).forEach(([t, list]) => list.forEach((rec) => outbox.current.push({ table: t as TableName, rec: rec as unknown as Record<string, unknown> })));
        await db.set('outbox', outbox.current);
        await db.set('started', true);
      }
      cursors.current = await db.get('cursors', {});
      const meta = await db.get<{ lastSynced?: string; historyFrom?: string }>('meta', {});
      setData(loadedData);
      setSync((s) => ({ ...s, pending: outbox.current.length, lastSynced: meta.lastSynced, historyFrom: meta.historyFrom || monthStart() }));
      setReady(true);
    })();
  }, []);

  const persist = useCallback((table: TableName, list: unknown[]) => db.set(`t:${table}`, list), []);
  const saveOutbox = () => {
    db.set('outbox', outbox.current);
    setSync((s) => ({ ...s, pending: outbox.current.length }));
  };

  /* ---------- Sending and receiving ---------- */
  const busy = useRef(false);
  const flushAndPull = useCallback(
    async (manual: boolean) => {
      const c = connRef.current;
      if (!api.connected(c)) {
        if (manual) notify('Working on this device only. Connect Google Sheets in Settings to share data between phone and laptop.', 'info');
        return;
      }
      if (busy.current) return;
      busy.current = true;
      setSync((s) => ({ ...s, syncing: true }));
      try {
        // 1. Pictures added while offline go up first, so records point at Drive.
        for (const t of ['products', 'patches'] as const) {
          for (const rec of dataRef.current[t]) {
            if (isLocal(rec.imageId)) {
              const id = await uploadPending(rec.imageId!, c);
              if (id) saveRecord(t, { ...rec, imageId: id });
            }
          }
        }
        // 2. Changes made here.
        const queued = [...outbox.current];
        const byTable = new Map<TableName, Map<string, Record<string, unknown>>>();
        queued.forEach((q) => {
          if (!byTable.has(q.table)) byTable.set(q.table, new Map());
          byTable.get(q.table)!.set(String(q.rec.id), q.rec);
        });
        for (const [table, recs] of byTable) {
          const list = [...recs.values()];
          for (let i = 0; i < list.length; i += 200) await api.push(c, table, list.slice(i, i + 200));
        }
        outbox.current = outbox.current.slice(queued.length);
        saveOutbox();
        // 3. Everything changed elsewhere since the last pull.
        const res = await api.pull(c, cursors.current, sync.historyFrom);
        const next = { ...dataRef.current };
        for (const t of TABLES) {
          const rows = (res.tables[t] || []) as unknown as Tables[typeof t][];
          if (rows.length) {
            (next as Record<string, unknown>)[t] = merge(next[t] as never[], rows as never[]);
            persist(t, next[t]);
          }
          cursors.current[t] = res.serverTime;
        }
        db.set('cursors', cursors.current);
        setData(next);
        const lastSynced = new Date().toISOString();
        db.set('meta', { lastSynced, historyFrom: sync.historyFrom });
        setSync((s) => ({ ...s, lastSynced, error: undefined }));
        if (manual) notify('Up to date with Google Sheets.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sync failed.';
        setSync((s) => ({ ...s, error: msg }));
        if (manual) notify(msg, 'error');
      } finally {
        busy.current = false;
        setSync((s) => ({ ...s, syncing: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, persist, sync.historyFrom]
  );

  // Background sync: soon after a change, every minute, when the app comes back into view or online.
  const soon = useRef<number | undefined>(undefined);
  const scheduleFlush = () => {
    window.clearTimeout(soon.current);
    soon.current = window.setTimeout(() => flushAndPull(false), 1500);
  };
  useEffect(() => {
    if (!ready) return;
    flushAndPull(false);
    const every = window.setInterval(() => flushAndPull(false), 60000);
    const wake = () => document.visibilityState === 'visible' && flushAndPull(false);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, conn.url, conn.key]);

  /* ---------- Saving ---------- */
  const saveRecord = <K extends TableName>(table: K, rec: Partial<Tables[K]> & { id?: string }): Tables[K] => {
    const full = { ...rec, id: rec.id || uid(), updatedAt: stamp() } as Tables[K];
    setData((prev) => {
      const list = prev[table] as Tables[K][];
      const i = list.findIndex((r) => r.id === full.id);
      const nextList = i >= 0 ? list.map((r, j) => (j === i ? { ...r, ...full } : r)) : [...list, full];
      persist(table, nextList);
      return { ...prev, [table]: nextList };
    });
    outbox.current.push({ table, rec: full as unknown as Record<string, unknown> });
    saveOutbox();
    scheduleFlush();
    return full;
  };
  const save: Store['save'] = (table, rec) => {
    const existing = rec.id ? (dataRef.current[table] as { id: string }[]).find((r) => r.id === rec.id) : undefined;
    return saveRecord(table, { ...(existing || {}), ...rec } as never);
  };
  const saveMany: Store['saveMany'] = (table, recs) => recs.forEach((r) => save(table, r));
  const remove = (table: TableName, id: string) => save(table, { id, deleted: true } as never);

  const saveSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });
  };

  const ensureHistory = async (from: string) => {
    if (!from || from >= sync.historyFrom) return;
    const c = connRef.current;
    if (!api.connected(c)) return;
    setSync((s) => ({ ...s, syncing: true }));
    try {
      const to = sync.historyFrom;
      const next = { ...dataRef.current };
      for (const t of HISTORY_TABLES) {
        const res = await api.query(c, t, from, to);
        (next as Record<string, unknown>)[t] = merge(next[t] as never[], res.records as never[]);
        persist(t, next[t]);
      }
      setData(next);
      setSync((s) => ({ ...s, historyFrom: from }));
      db.set('meta', { lastSynced: sync.lastSynced, historyFrom: from });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load older records.', 'error');
    } finally {
      setSync((s) => ({ ...s, syncing: false }));
    }
  };

  const resetDevice = async () => {
    await db.clearAll();
    location.reload();
  };

  // Hide deleted records from every screen.
  const visible = useMemo(() => {
    const out = {} as Data;
    for (const t of TABLES) (out as Record<string, unknown>)[t] = (data[t] as { deleted?: boolean }[]).filter((r) => !r.deleted);
    return out;
  }, [data]);

  return (
    <Ctx.Provider
      value={{
        ready,
        data: visible,
        settings,
        saveSettings,
        save,
        saveMany,
        remove,
        sync,
        refresh: () => flushAndPull(true),
        ensureHistory,
        conn,
        message,
        notify,
        dismiss: () => setMessage(null),
        resetDevice,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
