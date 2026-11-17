import * as db from './db';
import { Conn, connected, fetchImage, uploadImage } from './backend';
import { uid } from './format';

/**
 * Product and patch pictures.
 * - The original is kept at full quality: in Google Drive once connected (until then on this device).
 * - Screens show a small thumbnail: made on this device when the picture is added, otherwise Google
 *   Drive's own thumbnail, loaded lazily as you scroll.
 * - Exports and WhatsApp shares fetch the full-quality original only when you tap the button.
 */
const thumbs = new Map<string, string>();
let loaded = false;

export async function loadThumbs() {
  if (loaded) return;
  const all = await db.get<Record<string, string>>('thumbs', {});
  Object.entries(all).forEach(([k, v]) => thumbs.set(k, v));
  loaded = true;
}
const saveThumbs = () => db.set('thumbs', Object.fromEntries(thumbs));

export const isLocal = (id?: string) => !!id && id.startsWith('local:');

/** Small picture for on-screen use. */
export function thumbUrl(id: string | undefined, width = 240): string | undefined {
  if (!id) return undefined;
  const t = thumbs.get(id);
  if (t) return t;
  if (isLocal(id)) return undefined;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
}

const readAsDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that picture.'));
    img.src = src;
  });

/** A JPEG no wider/taller than `max` px. */
export async function shrink(src: string, max: number, quality = 0.8): Promise<string> {
  const img = await loadImg(src);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/**
 * Adds a picture: makes the thumbnail, keeps the original, and uploads it to Google Drive when connected.
 * Returns the id to store on the product or patch.
 */
export async function addPicture(file: File, conn: Conn): Promise<string> {
  const original = await readAsDataUrl(file);
  const thumb = await shrink(original, 320, 0.75);
  let id = `local:${uid()}`;
  if (connected(conn)) {
    try {
      const res = await uploadImage(conn, file.name || 'picture.jpg', file.type || 'image/jpeg', original.split(',')[1]);
      id = res.id;
    } catch {
      /* offline: kept on this device and uploaded at the next sync */
    }
  }
  if (isLocal(id)) await db.set(`orig:${id}`, original);
  thumbs.set(id, thumb);
  await saveThumbs();
  return id;
}

/** Uploads a picture added while offline; returns its Drive id (or null if still offline). */
export async function uploadPending(id: string, conn: Conn): Promise<string | null> {
  if (!isLocal(id) || !connected(conn)) return null;
  const original = await db.get<string | null>(`orig:${id}`, null);
  if (!original) return null;
  const mime = original.slice(5, original.indexOf(';')) || 'image/jpeg';
  const res = await uploadImage(conn, `${id.slice(6)}.jpg`, mime, original.split(',')[1]);
  const t = thumbs.get(id);
  if (t) {
    thumbs.set(res.id, t);
    await saveThumbs();
  }
  return res.id;
}

const fullCache = new Map<string, string>();
/** Full-quality picture as a data URL (for Excel and WhatsApp). Falls back to the thumbnail. */
export async function fullImage(id: string | undefined, conn: Conn): Promise<string | null> {
  if (!id) return null;
  if (fullCache.has(id)) return fullCache.get(id)!;
  let out: string | null = null;
  if (isLocal(id)) out = await db.get<string | null>(`orig:${id}`, null);
  else if (connected(conn)) {
    try {
      const r = await fetchImage(conn, id);
      out = `data:${r.mime};base64,${r.data}`;
    } catch {
      out = null;
    }
  }
  out ||= thumbs.get(id) || null;
  if (out) fullCache.set(id, out);
  return out;
}
