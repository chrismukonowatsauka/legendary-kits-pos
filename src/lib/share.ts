import type { Conn } from './backend';
import { fullImage, thumbUrl } from './images';
import { lineTotal } from './ledger';
import { fmtDate, money } from './format';
import type { Patch, Product, SalesOrder } from './types';

/**
 * A sales order as a clean phone-sized picture (PNG) or a PDF: shop name, order details, each kit with
 * its picture, version, size, printing, patch picture and price, and the total.
 */
const W = 1080;
const PAD = 48;

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

async function picture(id: string | undefined, conn: Conn) {
  if (!id) return null;
  const full = await fullImage(id, conn);
  if (full) return loadImg(full);
  const t = thumbUrl(id, 600);
  return t ? loadImg(t) : null;
}

function fit(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderOrder(order: SalesOrder, products: Product[], patches: Patch[], shopName: string, conn: Conn): Promise<HTMLCanvasElement> {
  const ROW = 300;
  const height = PAD + 150 + order.lines.length * ROW + 170;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, height);
  const font = (size: number, bold = false) => (g.font = `${bold ? '700 ' : ''}${size}px "IBM Plex Sans", "Segoe UI", Arial, sans-serif`);

  // Header
  g.fillStyle = '#111111';
  g.fillRect(0, 0, W, 120);
  g.fillStyle = '#ffffff';
  font(44, true);
  g.fillText(shopName, PAD, 76);
  font(28);
  g.textAlign = 'right';
  g.fillText(`Order ${order.number}`, W - PAD, 76);
  g.textAlign = 'left';
  g.fillStyle = '#111111';
  font(30, true);
  g.fillText(order.customerName || 'Customer', PAD, 175);
  font(26);
  g.fillStyle = '#555555';
  g.fillText([fmtDate(order.date), order.phone].filter(Boolean).join('  ·  '), PAD, 212);

  let y = 240;
  for (const l of order.lines) {
    const p = products.find((x) => x.id === l.productId);
    const patch = l.patchId ? patches.find((x) => x.id === l.patchId) : undefined;
    g.strokeStyle = '#e5e5e5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(PAD, y);
    g.lineTo(W - PAD, y);
    g.stroke();
    const kit = await picture(p?.imageId, conn);
    g.fillStyle = '#f5f5f5';
    g.fillRect(PAD, y + 20, 260, 260);
    if (kit) fit(g, kit, PAD, y + 20, 260, 260);
    const x = PAD + 290;
    g.fillStyle = '#111111';
    font(32, true);
    g.fillText(p?.name || 'Kit', x, y + 64, W - x - PAD);
    font(26);
    g.fillStyle = '#333333';
    g.fillText(`${l.version}  ·  Size ${l.size || '—'}`, x, y + 106);
    if (l.printName || l.printNumber) g.fillText(`Print: ${[l.printName, l.printNumber].filter(Boolean).join('  #')}`, x, y + 144);
    if (patch) {
      const pi = await picture(patch.imageId, conn);
      if (pi) fit(g, pi, x, y + 160, 70, 70);
      g.fillText(`Patch: ${patch.name} (+${money(l.patchPrice)})`, x + (pi ? 84 : 0), y + 204);
    }
    g.fillStyle = '#111111';
    font(28);
    g.fillText(`${l.qty} × ${money(l.unitPrice + (l.patchId ? l.patchPrice : 0))}`, x, y + 266);
    font(30, true);
    g.textAlign = 'right';
    g.fillText(money(lineTotal(l)), W - PAD, y + 266);
    g.textAlign = 'left';
    y += ROW;
  }
  g.fillStyle = '#111111';
  g.fillRect(PAD, y + 10, W - PAD * 2, 3);
  font(34, true);
  g.fillText('Total', PAD, y + 70);
  g.textAlign = 'right';
  g.fillText(money(order.total), W - PAD, y + 70);
  g.textAlign = 'left';
  font(22);
  g.fillStyle = '#777777';
  g.fillText(`${order.lines.reduce((s, l) => s + l.qty, 0)} item(s)  ·  Thank you for your order`, PAD, y + 120);
  return c;
}

export const canvasToPng = (c: HTMLCanvasElement) => new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));

/** The same picture laid onto A4 pages. */
export async function canvasToPdf(c: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const usableW = pageW - margin * 2;
  const pxPerMm = c.width / usableW;
  const sliceH = Math.floor((pageH - margin * 2) * pxPerMm);
  for (let top = 0, page = 0; top < c.height; top += sliceH, page++) {
    const h = Math.min(sliceH, c.height - top);
    const part = document.createElement('canvas');
    part.width = c.width;
    part.height = h;
    part.getContext('2d')!.drawImage(c, 0, top, c.width, h, 0, 0, c.width, h);
    if (page) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, usableW, h / pxPerMm);
  }
  return pdf.output('blob');
}
