/**
 * Saving and sharing files. On a phone, Share hands the file to WhatsApp (or anything else) directly;
 * otherwise the file downloads.
 */
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Excel and other files: on a phone offer the share sheet (Save to Files, Drive, WhatsApp…); on a PC download. */
export async function saveFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (isTouch() && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  download(blob, name);
}

/** Open the device's share menu with the file (WhatsApp, Save to Files, email…); where there is none, download it. */
export async function shareFile(blob: Blob, name: string, text?: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], ...(text ? { text } : {}) });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'downloaded';
}

/** WhatsApp: share the file straight into WhatsApp on a phone; on a PC download it and open WhatsApp with the text. */
export async function shareToWhatsApp(blob: Blob, name: string, text: string, phone?: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  const num = (phone || '').replace(/[^\d]/g, '');
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text + '\n(The picture/PDF has been downloaded: attach it in WhatsApp.)')}`, '_blank');
  return 'downloaded';
}
