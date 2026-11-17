import type { TableName } from './types';

/**
 * Talks to the Google Apps Script web app that sits on the Google Sheet (backend/Code.gs).
 * Requests are sent as plain text so the browser sends them straight to Google without a pre-check.
 */
export interface Conn {
  url: string;
  key: string;
}

export class BackendError extends Error {}

export const connected = (c: Conn) => /^https:\/\/script\.google(usercontent)?\.com\//.test(c.url.trim()) && !!c.key.trim();

async function call<T>(c: Conn, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!connected(c)) throw new BackendError('Not connected to Google Sheets yet (Settings).');
  let res: Response;
  try {
    res = await fetch(c.url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, key: c.key.trim() }),
      redirect: 'follow',
    });
  } catch {
    throw new BackendError('No connection to Google. Your work is kept on this device and will sync later.');
  }
  let body: { ok?: boolean; error?: string } & T;
  try {
    body = await res.json();
  } catch {
    throw new BackendError('Google sent back something unexpected. Check the web app address in Settings.');
  }
  if (!body.ok) throw new BackendError(body.error || 'Google Sheets refused the request.');
  return body;
}

export type Rows = Partial<Record<TableName, Record<string, unknown>[]>>;

export const ping = (c: Conn) => call<{ sheet: string; serverTime: string }>(c, 'ping');

/** Everything changed since the given times; history tables only from `from` onward on a first load. */
export const pull = (c: Conn, since: Partial<Record<TableName, string>>, from: string) =>
  call<{ tables: Rows; serverTime: string }>(c, 'pull', { since, from });

export const push = (c: Conn, table: TableName, records: unknown[]) => call<{ saved: number }>(c, 'push', { table, records });

/** Older history on demand (e.g. Sales History filtered to last year). */
export const query = (c: Conn, table: TableName, from: string, to: string) => call<{ records: Record<string, unknown>[] }>(c, 'query', { table, from, to });

export const uploadImage = (c: Conn, name: string, mime: string, data: string) => call<{ id: string }>(c, 'uploadImage', { name, mime, data });

/** The full-quality picture, for exports and shares. */
export const fetchImage = (c: Conn, id: string) => call<{ mime: string; data: string }>(c, 'image', { id });
