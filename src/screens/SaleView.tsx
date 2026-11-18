import React, { useState } from 'react';
import { FileText, Share2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { fmtDate, money } from '../lib/format';
import { saleCost, saleMargin } from '../lib/ledger';
import { receiptPdf, saleReceipt } from '../lib/receipt';
import { shareFile } from '../lib/files';
import type { Sale } from '../lib/types';
import { Field, Modal } from '../components/ui';

export const receiptText = (s: Sale, shop: string, accountName?: string) =>
  [
    `*${shop}*`,
    `Receipt ${s.number} · ${fmtDate(s.date)} ${s.time}`,
    s.customerName ? `Customer: ${s.customerName}` : '',
    '',
    ...s.lines.map((l) => {
      const extra = [l.size, [l.printName, l.printNumber && `#${l.printNumber}`].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      return `${l.qty} × ${l.name}${extra ? ` (${extra})` : ''} @ ${money(l.price)} = ${money(l.qty * l.price)}`;
    }),
    '',
    `*Total: ${money(s.total)}*`,
    s.paid ? `Paid: ${money(s.paid)}${accountName ? ` (${accountName})` : ''}` : '',
    s.onAccount ? `On account: ${money(s.onAccount)}` : '',
    s.status === 'voided' ? '*VOIDED*' : '',
    '',
    'Thank you!',
  ]
    .filter((x, i, a) => x !== '' || a[i - 1] !== '')
    .join('\n');

/** The receipt as a text PDF with kit photos, handed to the share menu (WhatsApp, Save…). */
const useReceiptPdf = () => {
  const { data, settings, conn, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const send = async (sale: Sale) => {
    setBusy(true);
    try {
      const acc = data.accounts.find((a) => a.id === sale.accountId)?.name;
      const blob = await receiptPdf(saleReceipt(sale, data.products, data.patches, settings.shopName, acc), conn);
      const how = await shareFile(blob, `Receipt-${sale.number}.pdf`, `${settings.shopName} receipt ${sale.number}`);
      if (how === 'downloaded') notify('Receipt PDF downloaded. Attach it in WhatsApp.');
    } catch {
      notify('The receipt PDF could not be made.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, send };
};

const waText = (sale: Sale, shop: string, phone: string | undefined, acc?: string) =>
  window.open(`https://wa.me/${(phone || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(receiptText(sale, shop, acc))}`, '_blank');

/** After a sale: share the receipt, or carry on. */
export const ReceiptShare: React.FC<{ sale: Sale; onClose: () => void }> = ({ sale, onClose }) => {
  const { settings, data } = useStore();
  const pdf = useReceiptPdf();
  const customer = data.customers.find((c) => c.id === sale.customerId);
  const acc = data.accounts.find((a) => a.id === sale.accountId)?.name;
  return (
    <Modal
      title={`Sale ${sale.number} done`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" disabled={pdf.busy} onClick={() => pdf.send(sale)}>
            <FileText size={16} /> {pdf.busy ? 'Making PDF…' : 'Receipt PDF'}
          </button>
          <button className="btn" onClick={() => waText(sale, settings.shopName, customer?.phone, acc)}>
            <Share2 size={16} /> WhatsApp text
          </button>
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Next sale
          </button>
        </>
      }
    >
      <p className="text-[28px] font-bold">{money(sale.total)}</p>
      {sale.onAccount > 0 ? <p>{money(sale.onAccount)} on {sale.customerName}'s account.</p> : <p>Paid into {acc}.</p>}
    </Modal>
  );
};

/** One sale, opened from Sales History: lines with customisation, payment, margin, receipt and void. */
export const SaleDetail: React.FC<{ sale: Sale; onClose: () => void }> = ({ sale, onClose }) => {
  const { settings, data, save, notify } = useStore();
  const pdf = useReceiptPdf();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const acc = data.accounts.find((a) => a.id === sale.accountId)?.name;
  const customer = data.customers.find((c) => c.id === sale.customerId);
  const margin = saleMargin(sale, data.products);
  return (
    <Modal
      wide
      title={`Sale ${sale.number}`}
      onClose={onClose}
      footer={
        <>
          {sale.status === 'completed' && (
            <button className="btn btn-danger mr-auto" onClick={() => setVoiding(true)}>
              Void sale
            </button>
          )}
          <button className="btn" disabled={pdf.busy} onClick={() => pdf.send(sale)}>
            <FileText size={16} /> {pdf.busy ? 'Making PDF…' : 'Receipt PDF'}
          </button>
          <button className="btn" onClick={() => waText(sale, settings.shopName, customer?.phone, acc)}>
            <Share2 size={16} /> WhatsApp text
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[14px]">
        <div>
          <dt className="text-[#555555] text-[12px]">Date</dt>
          <dd>
            {fmtDate(sale.date)} {sale.time}
          </dd>
        </div>
        <div>
          <dt className="text-[#555555] text-[12px]">Customer</dt>
          <dd>{sale.customerName || 'Walk-in'}</dd>
        </div>
        <div>
          <dt className="text-[#555555] text-[12px]">Paid</dt>
          <dd>
            {money(sale.paid)} {acc && `· ${acc}`}
          </dd>
        </div>
        <div>
          <dt className="text-[#555555] text-[12px]">On account</dt>
          <dd>{money(sale.onAccount)}</dd>
        </div>
        <div>
          <dt className="text-[#555555] text-[12px]">Cost of sales</dt>
          <dd>{money(saleCost(sale, data.products))}</dd>
        </div>
        <div>
          <dt className="text-[#555555] text-[12px]">Margin</dt>
          <dd className={margin < 0 ? 'text-[#b91c1c]' : ''}>
            {money(margin)} {sale.total ? `(${Math.round((margin / sale.total) * 100)}%)` : ''}
          </dd>
        </div>
      </dl>
      {sale.status === 'voided' && <p className="text-[#b91c1c] font-bold">Voided: {sale.voidReason}</p>}
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l, i) => (
              <tr key={i}>
                <td className="whitespace-normal!">
                  {l.name}
                  <div className="text-[12px] text-[#555555]">
                    {[l.size && `Size ${l.size}`, l.printName, l.printNumber && `#${l.printNumber}`, l.patchId && `${data.patches.find((p) => p.id === l.patchId)?.name || 'Patch'} patch`].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className="num">{l.qty}</td>
                <td className="num">{money(l.price)}</td>
                <td className="num">{money(l.qty * l.price)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td colSpan={3}>Total</td>
              <td className="num">{money(sale.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {voiding && (
        <div className="border border-[#b91c1c] rounded-[8px] p-3 space-y-2">
          <Field label="Why is this sale being voided?">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Rang up twice" />
          </Field>
          <div className="flex gap-2 justify-end">
            <button className="btn" onClick={() => setVoiding(false)}>
              Keep the sale
            </button>
            <button
              className="btn btn-danger"
              disabled={!reason.trim()}
              onClick={() => {
                save('sales', { id: sale.id, status: 'voided', voidReason: reason.trim() });
                notify(`Sale ${sale.number} voided. Its money and account balance are taken out.`);
                onClose();
              }}
            >
              Void sale
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
