import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useStore } from '../lib/store';
import { money } from '../lib/format';
import { supplierLineTotal } from '../lib/ledger';
import { exportSupplierSheet } from '../lib/excel';
import type { OrderStatus, SupplierOrder } from '../lib/types';
import { Modal, ScreenBar, Thumb } from '../components/ui';
import { ListTable } from '../components/ListTable';

/** Supplier orders made by combining customer orders: export the supplier sheet, then mark Received. */
export const SupplierOrders: React.FC = () => {
  const { data } = useStore();
  const [open, setOpen] = useState<SupplierOrder | null>(null);
  const rows = [...data.supplierOrders].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  return (
    <div>
      <ScreenBar title="Supplier Orders" />
      <div className="p-3">
        <ListTable
          rows={rows}
          rowKey={(s) => s.id}
          onOpen={setOpen}
          exportName="supplier-orders"
          empty="None yet. On Sales Orders, tick Open orders and tap Create Supplier Order."
          cols={[
            { header: 'Date', value: (s) => s.date, date: true },
            { header: 'No.', value: (s) => s.number },
            { header: 'Supplier', value: (s) => s.supplier, wide: true },
            { header: 'Customer Orders', value: (s) => s.orderIds.length, num: true, wide: true },
            { header: 'Shirts', value: (s) => s.lines.reduce((n, l) => n + l.qty, 0), num: true },
            { header: 'Status', value: (s) => s.status },
            { header: 'Total Cost', value: (s) => s.total, money: true },
          ]}
        />
      </div>
      {open && <SupplierOrderView so={data.supplierOrders.find((s) => s.id === open.id) || open} onClose={() => setOpen(null)} />}
    </div>
  );
};

const SupplierOrderView: React.FC<{ so: SupplierOrder; onClose: () => void }> = ({ so, onClose }) => {
  const { data, save, saveMany, notify, settings, conn } = useStore();
  const [busy, setBusy] = useState('');
  const orders = data.salesOrders.filter((o) => so.orderIds.includes(o.id));
  const setStatus = (status: SupplierOrder['status']) => {
    save('supplierOrders', { id: so.id, status });
    // The customer orders follow: Received when the stock arrives; back to Open if the supplier order is cancelled.
    const next: Partial<Record<SupplierOrder['status'], OrderStatus>> = { Received: 'Received', Cancelled: 'Open', Ordered: 'Ordered' };
    saveMany(
      'salesOrders',
      orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').map((o) => ({ id: o.id, status: next[status]!, supplierOrderId: status === 'Cancelled' ? undefined : so.id }))
    );
    notify(`Supplier order ${so.number} is now ${status}. Its ${orders.length} customer order(s) were updated.`);
  };
  return (
    <Modal
      wide
      title={`Supplier order ${so.number}`}
      onClose={onClose}
      footer={
        <>
          {so.status === 'Ordered' && (
            <button className="btn btn-danger mr-auto" onClick={() => setStatus('Cancelled')}>
              Cancel order
            </button>
          )}
          <button
            className="btn"
            disabled={!!busy}
            onClick={async () => {
              setBusy('Preparing the Excel file…');
              try {
                await exportSupplierSheet(so.number, `${settings.shopName} · Supplier order ${so.number}${so.supplier ? ` · ${so.supplier}` : ''}`, so.lines, data.products, data.patches, conn, setBusy);
                notify('Excel file ready.');
              } catch {
                notify('The Excel file could not be made.', 'error');
              } finally {
                setBusy('');
              }
            }}
          >
            <FileSpreadsheet size={16} /> Export to Excel
          </button>
          {so.status === 'Ordered' && (
            <button className="btn btn-primary" onClick={() => setStatus('Received')}>
              Mark Received
            </button>
          )}
        </>
      }
    >
      {busy && <p className="message-bar is-info rounded-[6px]">{busy}</p>}
      <p>
        Status <b>{so.status}</b> · Customer orders: {orders.map((o) => `${o.number} (${o.customerName}, ${o.status})`).join('; ')}
      </p>
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Kit</th>
              <th>Kit Name</th>
              <th>Patch</th>
              <th className="num">Patch Cost</th>
              <th>Version</th>
              <th>Size</th>
              <th>Name</th>
              <th>No.</th>
              <th className="num">Qty</th>
              <th className="num">Unit Cost</th>
              <th className="num">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {so.lines.map((l, i) => {
              const p = data.products.find((x) => x.id === l.productId);
              const pt = data.patches.find((x) => x.id === l.patchId);
              return (
                <tr key={i}>
                  <td>
                    <Thumb id={p?.imageId} size={40} />
                  </td>
                  <td>{p?.name}</td>
                  <td>{pt ? <Thumb id={pt.imageId} size={32} /> : ''}</td>
                  <td className="num">{money(l.patchCost)}</td>
                  <td>{l.version}</td>
                  <td>{l.size}</td>
                  <td>{l.printName}</td>
                  <td>{l.printNumber}</td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{money(l.unitCost)}</td>
                  <td className="num">{money(supplierLineTotal(l))}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td colSpan={8}>Total</td>
              <td className="num">{so.lines.reduce((n, l) => n + l.qty, 0)}</td>
              <td />
              <td className="num">{money(so.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
