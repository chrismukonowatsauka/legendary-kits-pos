import type { Conn } from './backend';
import { fullImage, shrink, thumbUrl } from './images';
import { fmtDate, money } from './format';
import type { Patch, Product, Sale, SalesOrder } from './types';
import { lineTotal } from './ledger';

/**
 * Customer receipts as a PDF made of real text (it can be copied and searched), with the kit photos, laid out
 * as one long phone-width page so it reads well in WhatsApp.
 */
export interface ReceiptLine {
  imageId?: string;
  name: string;
  details: string;
  qty: number;
  each: number;
  total: number;
}
export interface ReceiptDoc {
  shopName: string;
  title: string;
  number: string;
  date: string;
  customer?: string;
  phone?: string;
  lines: ReceiptLine[];
  total: number;
  /** Extra lines under the total, e.g. ["Paid (Cash)", "$40.00"]. */
  footer: [string, string][];
  note?: string;
}

const extras = (l: { size?: string; version?: string; printName?: string; printNumber?: string; patchId?: string }, patches: Patch[]) =>
  [l.version, l.size && `Size ${l.size}`, [l.printName, l.printNumber && `#${l.printNumber}`].filter(Boolean).join(' '), l.patchId && `${patches.find((p) => p.id === l.patchId)?.name || 'Patch'} patch`]
    .filter(Boolean)
    .join(' · ');

export function saleReceipt(s: Sale, products: Product[], patches: Patch[], shopName: string, accountName?: string): ReceiptDoc {
  return {
    shopName,
    title: s.status === 'voided' ? 'RECEIPT (VOIDED)' : 'RECEIPT',
    number: s.number,
    date: `${fmtDate(s.date)} ${s.time}`,
    customer: s.customerName,
    lines: s.lines.map((l) => ({ imageId: products.find((p) => p.id === l.productId)?.imageId, name: l.name, details: extras(l, patches), qty: l.qty, each: l.price, total: l.qty * l.price })),
    total: s.total,
    footer: [
      ...(s.paid ? ([[`Paid${accountName ? ` (${accountName})` : ''}`, money(s.paid)]] as [string, string][]) : []),
      ...(s.onAccount ? ([['On account', money(s.onAccount)]] as [string, string][]) : []),
    ],
  };
}

export function orderReceipt(o: SalesOrder, products: Product[], patches: Patch[], shopName: string, paid: number): ReceiptDoc {
  return {
    shopName,
    title: 'ORDER',
    number: o.number,
    date: fmtDate(o.date),
    customer: o.customerName,
    phone: o.phone,
    lines: o.lines.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      const each = l.unitPrice + (l.patchId ? l.patchPrice : 0);
      return { imageId: p?.imageId, name: p?.name || 'Kit', details: extras(l, patches), qty: l.qty, each, total: lineTotal(l) };
    }),
    total: o.total,
    footer: [
      ['Paid', money(paid)],
      ['Balance to pay', money(Math.max(0, o.total - paid))],
    ],
    note: `Status: ${o.status}${o.notes ? ` · ${o.notes}` : ''}`,
  };
}

async function photo(id: string | undefined, conn: Conn): Promise<string | null> {
  if (!id) return null;
  try {
    const full = await fullImage(id, conn);
    if (full) return await shrink(full, 700, 0.85);
    const t = thumbUrl(id, 400);
    return t && t.startsWith('data:') ? t : null;
  } catch {
    return null;
  }
}

export async function receiptPdf(doc: ReceiptDoc, conn: Conn): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const W = 100; // mm: phone-width page
  const M = 6;
  const IMG = 24;
  const lineH = 30;
  const H = 46 + doc.lines.length * lineH + 18 + doc.footer.length * 6 + (doc.note ? 10 : 0) + 16;
  const pdf = new jsPDF({ unit: 'mm', format: [W, Math.max(120, H)] });
  pdf.setProperties({ title: `${doc.title} ${doc.number}`, author: doc.shopName });
  let y = M + 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(doc.shopName, M, y);
  pdf.setFontSize(9);
  pdf.text(doc.title, W - M, y, { align: 'right' });
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`No. ${doc.number}`, M, y);
  pdf.text(doc.date, W - M, y, { align: 'right' });
  y += 6;
  if (doc.customer) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(doc.customer, M, y);
    pdf.setFont('helvetica', 'normal');
    if (doc.phone) pdf.text(doc.phone, W - M, y, { align: 'right' });
    y += 6;
  }
  pdf.setDrawColor(17);
  pdf.setLineWidth(0.4);
  pdf.line(M, y, W - M, y);
  y += 4;

  for (const l of doc.lines) {
    const img = await photo(l.imageId, conn);
    if (img) {
      try {
        pdf.addImage(img, 'JPEG', M, y, IMG, IMG);
      } catch {
        /* picture unreadable: the text still prints */
      }
    }
    const x = M + IMG + 3;
    const textW = W - M - x;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const nameLines = pdf.splitTextToSize(l.name, textW) as string[];
    pdf.text(nameLines.slice(0, 2), x, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const det = pdf.splitTextToSize(l.details, textW) as string[];
    pdf.text(det.slice(0, 2), x, y + 4 + Math.min(2, nameLines.length) * 4.2);
    pdf.setFontSize(9.5);
    pdf.text(`${l.qty} x ${money(l.each)}`, x, y + IMG - 1);
    pdf.setFont('helvetica', 'bold');
    pdf.text(money(l.total), W - M, y + IMG - 1, { align: 'right' });
    y += lineH;
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.2);
    pdf.line(M, y - 3, W - M, y - 3);
  }

  y += 3;
  pdf.setDrawColor(17);
  pdf.setLineWidth(0.4);
  pdf.line(M, y - 4, W - M, y - 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Total', M, y + 2);
  pdf.text(money(doc.total), W - M, y + 2, { align: 'right' });
  y += 9;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  for (const [k, v] of doc.footer) {
    pdf.text(k, M, y);
    pdf.text(v, W - M, y, { align: 'right' });
    y += 6;
  }
  if (doc.note) {
    pdf.setFontSize(8.5);
    pdf.setTextColor(85);
    pdf.text(pdf.splitTextToSize(doc.note, W - 2 * M) as string[], M, y + 2);
    y += 10;
    pdf.setTextColor(0);
  }
  pdf.setFontSize(8.5);
  pdf.setTextColor(120);
  pdf.text('Thank you!', W / 2, y + 6, { align: 'center' });
  return pdf.output('blob');
}
