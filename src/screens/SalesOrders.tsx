import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, Share2, Trash2, Truck } from 'lucide-react';
import { useStore } from '../lib/store';
import { docNo, money, round2, today, uid } from '../lib/format';
import { lineTotal, mergeForSupplier, orderMargin, orderPaid, orderTotal, supplierLineTotal, unitCostOf } from '../lib/ledger';
import { exportSupplierSheet } from '../lib/excel';
import { canvasToPng, renderOrder } from '../lib/share';
import { shareFile, shareToWhatsApp } from '../lib/files';
import { orderReceipt, receiptPdf } from '../lib/receipt';
import type { OrderLine, OrderStatus, SalesOrder } from '../lib/types';
import { Field, Modal, ScreenBar, Thumb } from '../components/ui';
import { ListTable } from '../components/ListTable';

export const STATUSES: OrderStatus[] = ['Open', 'Ordered', 'Received', 'Delivered', 'Cancelled'];

/** Sales Orders: customer kit orders, shared on WhatsApp, combined into supplier orders, tracked to delivery. */
export const SalesOrders: React.FC<{ goSupplierOrders: () => void }> = ({ goSupplierOrders }) => {
  const { data, save, saveMany, notify } = useStore();
  const [filter, setFilter] = useState<'active' | OrderStatus | 'all'>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SalesOrder | 'new' | null>(null);
  const [combine, setCombine] = useState(false);
  const [supplier, setSupplier] = useState('');

  const rows = data.salesOrders
    .filter((o) => (filter === 'all' ? true : filter === 'active' ? ['Open', 'Ordered', 'Received'].includes(o.status) : o.status === filter))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const picked = data.salesOrders.filter((o) => selected.has(o.id) && o.status === 'Open');
  const merged = useMemo(() => mergeForSupplier(picked, data.products, data.patches), [picked, data.products, data.patches]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <ScreenBar title="Sales Orders">
        <button className="btn" disabled={!picked.length} onClick={() => setCombine(true)}>
          <Truck size={16} /> Create Supplier Order{picked.length ? ` (${picked.length})` : ''}
        </button>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> New order
        </button>
      </ScreenBar>
      <div className="p-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['active', 'Open', 'Ordered', 'Received', 'Delivered', 'Cancelled', 'all'] as const).map((f) => (
            <button key={f} type="button" className={`btn shrink-0 ${filter === f ? 'btn-primary' : ''}`} onClick={() => setFilter(f)}>
              {f === 'active' ? 'Not yet delivered' : f === 'all' ? 'All' : f} ({data.salesOrders.filter((o) => (f === 'all' ? true : f === 'active' ? ['Open', 'Ordered', 'Received'].includes(o.status) : o.status === f)).length})
            </button>
          ))}
        </div>
        <p className="text-[13px] text-[#555555]">Tick Open orders and tap Create Supplier Order to combine them into one supplier sheet.</p>
        <ListTable
          rows={rows}
          rowKey={(o) => o.id}
          onOpen={(o) => setEditing(o)}
          exportName="sales-orders"
          empty="No orders here."
          selection={{ selected, toggle, can: (o) => o.status === 'Open' }}
          cols={[
            { header: 'Date', value: (o) => o.date, date: true },
            { header: 'Order No.', value: (o) => o.number, wide: true },
            { header: 'Customer', value: (o) => o.customerName },
            { header: 'Items', value: (o) => o.lines.reduce((n, l) => n + l.qty, 0), num: true },
            { header: 'Status', value: (o) => o.status },
            { header: 'Paid', value: (o) => orderPaid(o, data.payments), money: true, wide: true },
            { header: 'Margin', value: (o) => orderMargin(o, data.products), money: true, wide: true },
            { header: 'Total', value: (o) => o.total, money: true },
          ]}
        />
      </div>

      {combine && (
        <Modal
          wide
          title="Create Supplier Order"
          onClose={() => setCombine(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCombine(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!merged.length}
                onClick={() => {
                  const so = save('supplierOrders', {
                    number: docNo('PO'),
                    date: today(),
                    supplier: supplier.trim(),
                    orderIds: picked.map((o) => o.id),
                    lines: merged,
                    total: round2(merged.reduce((s, l) => s + supplierLineTotal(l), 0)),
                    status: 'Ordered',
                  });
                  saveMany(
                    'salesOrders',
                    picked.map((o) => ({ id: o.id, status: 'Ordered' as OrderStatus, supplierOrderId: so.id }))
                  );
                  setSelected(new Set());
                  setCombine(false);
                  notify(`Supplier order ${so.number} created from ${picked.length} order(s). They are now marked Ordered.`);
                  goSupplierOrders();
                }}
              >
                Create
              </button>
            </>
          }
        >
          <p>
            {picked.length} order(s): {picked.map((o) => o.number).join(', ')}
          </p>
          <Field label="Supplier (optional)">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Guangzhou supplier" />
          </Field>
          <p className="text-[13px] text-[#555555]">Identical lines (same kit, version, size, name, number and patch) are added together.</p>
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Kit</th>
                  <th>Version</th>
                  <th>Size</th>
                  <th>Name</th>
                  <th>No.</th>
                  <th>Patch</th>
                  <th className="num">Qty</th>
                  <th className="num">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((l, i) => (
                  <tr key={i}>
                    <td>{data.products.find((p) => p.id === l.productId)?.name}</td>
                    <td>{l.version}</td>
                    <td>{l.size}</td>
                    <td>{l.printName}</td>
                    <td>{l.printNumber}</td>
                    <td>{l.patchId ? data.patches.find((p) => p.id === l.patchId)?.name : ''}</td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{money(supplierLineTotal(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {editing && <OrderEditor order={editing === 'new' ? null : data.salesOrders.find((o) => o.id === editing.id) || editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const blankLine = (): OrderLine => ({ key: uid(), productId: '', version: '', size: '', printName: '', printNumber: '', qty: 1, unitPrice: 0, patchPrice: 0 });

/** One order: customer, kit lines with pictures, status, deposits, WhatsApp share and supplier-format Excel. */
const OrderEditor: React.FC<{ order: SalesOrder | null; onClose: () => void }> = ({ order, onClose }) => {
  const { data, save, notify, settings, conn } = useStore();
  const [o, setO] = useState<SalesOrder>(
    () =>
      order || {
        id: '',
        updatedAt: '',
        number: docNo('SO'),
        date: today(),
        customerName: '',
        phone: '',
        lines: [],
        total: 0,
        status: 'Open',
      }
  );
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [pay, setPay] = useState<{ amount: string; accountId: string } | null>(null);
  const locked = o.status !== 'Open';
  const total = orderTotal(o.lines);
  const paid = order ? orderPaid(order, data.payments) : 0;
  const setLine = (i: number, patch: Partial<OrderLine>) => setO((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  // A name or number typed for the first time fills in the usual printing cost; clearing both removes it.
  const setPrint = (i: number, patch: Partial<OrderLine>) => {
    const l = o.lines[i];
    const had = !!(l.printName || l.printNumber);
    const next = { ...l, ...patch };
    const has = !!(next.printName || next.printNumber);
    setLine(i, { ...patch, ...(!had && has && !l.printCost ? { printCost: settings.printCost || 0 } : {}), ...(had && !has ? { printCost: 0 } : {}) });
  };
  const lineMargin = (l: OrderLine) => round2(lineTotal(l) - l.qty * unitCostOf(l, data.products));
  const orderMarginNow = round2(o.lines.reduce((s, l) => s + lineMargin(l), 0) - (o.packagingCost || 0));
  const valid = o.customerName.trim() && o.lines.length > 0 && o.lines.every((l) => l.productId && l.qty > 0);

  const persist = (patch: Partial<SalesOrder> = {}) => {
    // Customer: link to an existing one by phone or name, or add them.
    let customerId = o.customerId;
    const name = o.customerName.trim();
    if (!customerId && name) {
      const found = data.customers.find((c) => (o.phone.trim() && c.phone.replace(/\D/g, '') === o.phone.replace(/\D/g, '')) || c.name.toLowerCase() === name.toLowerCase());
      customerId = found ? found.id : save('customers', { name, phone: o.phone.trim() }).id;
    }
    const saved = save('salesOrders', { ...o, id: o.id || undefined, customerId, customerName: name, phone: o.phone.trim(), total, ...patch } as Partial<SalesOrder>);
    setO(saved);
    return saved;
  };

  const share = async (kind: 'png' | 'pdf') => {
    const saved = persist();
    setBusy(kind === 'png' ? 'Making the picture…' : 'Making the PDF…');
    try {
      const text = `${settings.shopName}: order ${saved.number} for ${saved.customerName}, total ${money(saved.total)}.`;
      if (kind === 'png') {
        const canvas = await renderOrder(saved, data.products, data.patches, settings.shopName, conn);
        await shareToWhatsApp(await canvasToPng(canvas), `${saved.number}.png`, text, saved.phone);
      } else {
        // Text-based PDF (copyable) with the kit photos, through the share menu.
        const blob = await receiptPdf(orderReceipt(saved, data.products, data.patches, settings.shopName, orderPaid(saved, data.payments)), conn);
        const how = await shareFile(blob, `Order-${saved.number}.pdf`, text);
        if (how === 'downloaded') notify('Order PDF downloaded. Attach it in WhatsApp.');
      }
    } catch {
      notify('The order could not be made into a file.', 'error');
    } finally {
      setBusy('');
    }
  };

  const excel = async () => {
    const saved = persist();
    setBusy('Preparing the Excel file…');
    try {
      const lines = mergeForSupplier([saved], data.products, data.patches);
      await exportSupplierSheet(saved.number, `${settings.shopName} · ${saved.number} · ${saved.customerName}`, lines, data.products, data.patches, conn, setBusy);
      notify('Excel file ready.');
    } catch {
      notify('The Excel file could not be made.', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal
      wide
      title={order ? `Order ${o.number}` : 'New sales order'}
      onClose={onClose}
      footer={
        <>
          {order && (
            <>
              <button className="btn" disabled={!!busy} onClick={() => share('png')}>
                <Share2 size={16} /> WhatsApp picture
              </button>
              <button className="btn" disabled={!!busy} onClick={() => share('pdf')}>
                <Share2 size={16} /> Receipt PDF
              </button>
              <button className="btn" disabled={!!busy} onClick={excel}>
                <FileSpreadsheet size={16} /> Supplier Excel
              </button>
            </>
          )}
          <button
            className="btn btn-primary"
            disabled={!valid || !!busy}
            onClick={() => {
              const s = persist();
              notify(`Order ${s.number} saved: ${money(s.total)}.`);
              if (!order) onClose();
            }}
          >
            Save order
          </button>
        </>
      }
    >
      {busy && <p className="message-bar is-info rounded-[6px]">{busy}</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Customer name">
          <input list="order-customers" value={o.customerName} onChange={(e) => {
            const c = data.customers.find((x) => x.name === e.target.value);
            setO({ ...o, customerName: e.target.value, customerId: c?.id, phone: c ? c.phone : o.phone });
          }} />
          <datalist id="order-customers">
            {data.customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Phone (WhatsApp)">
          <input inputMode="tel" value={o.phone} onChange={(e) => setO({ ...o, phone: e.target.value })} placeholder="263771234567" />
        </Field>
        <Field label="Order date">
          <input type="date" value={o.date} onChange={(e) => setO({ ...o, date: e.target.value })} />
        </Field>
      </div>

      {order && (
        <Field label="Status">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${o.status === s ? 'btn-primary' : ''}`}
                onClick={() => {
                  if (s === o.status) return;
                  if (s === 'Open' && o.supplierOrderId) return notify('This order is on a supplier order. Cancel that supplier order first to reopen it.', 'error');
                  persist({ status: s });
                  notify(`Order ${o.number} is now ${s}.`);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="space-y-2">
        {o.lines.map((l, i) => {
          const p = data.products.find((x) => x.id === l.productId);
          const patch = data.patches.find((x) => x.id === l.patchId);
          return (
            <div key={l.key} className="border border-[#e5e5e5] rounded-[8px] p-3 grid grid-cols-[88px_1fr] gap-3">
              <button type="button" disabled={locked} onClick={() => setPicking(i)} aria-label="Choose the kit">
                <Thumb id={p?.imageId} size={88} />
              </button>
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <button type="button" disabled={locked} className="font-bold text-left flex-1 truncate underline" onClick={() => setPicking(i)}>
                    {p?.name || 'Choose the kit'}
                  </button>
                  {!locked && (
                    <button type="button" className="text-[#b91c1c] p-2" aria-label="Remove line" onClick={() => setO({ ...o, lines: o.lines.filter((_, j) => j !== i) })}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select disabled={locked} value={l.version} onChange={(e) => setLine(i, { version: e.target.value })} aria-label="Version">
                    <option value="">Version</option>
                    {settings.versions.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <select disabled={locked} value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} aria-label="Size">
                    <option value="">Size</option>
                    {(p?.sizes.length ? p.sizes : ['S', 'M', 'L', 'XL', '2XL']).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input disabled={locked} value={l.printName} onChange={(e) => setPrint(i, { printName: e.target.value.toUpperCase() })} placeholder="Name to print (optional)" aria-label="Name to print" />
                  <input disabled={locked} value={l.printNumber} inputMode="numeric" onChange={(e) => setPrint(i, { printNumber: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} placeholder="Number (optional)" aria-label="Number to print" />
                </div>
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr] gap-2 items-center">
                  <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                    {patch && <Thumb id={patch.imageId} size={36} />}
                    <select
                      disabled={locked}
                      value={l.patchId || ''}
                      onChange={(e) => {
                        const pt = data.patches.find((x) => x.id === e.target.value);
                        setLine(i, { patchId: pt?.id, patchPrice: pt?.price || 0, patchCost: pt?.cost || 0 });
                      }}
                      aria-label="Patch"
                    >
                      <option value="">No patch</option>
                      {data.patches
                        .filter((x) => x.active !== false)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} (+{money(x.price)})
                          </option>
                        ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-1 text-[13px]">
                    Qty
                    <input disabled={locked} type="number" inputMode="numeric" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(1, parseInt(e.target.value || '1', 10)) })} className="w-[72px]!" />
                  </label>
                  <label className="flex items-center gap-1 text-[13px]">
                    Price
                    <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: round2(Number(e.target.value) || 0) })} className="w-[96px]!" />
                  </label>
                  {l.patchId && (
                    <label className="flex items-center gap-1 text-[13px] col-span-2 sm:col-span-1 sm:col-start-3">
                      Patch price
                      <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={l.patchPrice} onChange={(e) => setLine(i, { patchPrice: round2(Number(e.target.value) || 0) })} className="w-[96px]!" />
                    </label>
                  )}
                </div>
                {/* Actual costs on this line (cost of sales), so the margin is true whatever the price. */}
                <details className="text-[14px]">
                  <summary className={`cursor-pointer ${lineMargin(l) < 0 ? 'text-[#b91c1c]' : 'text-[#555555]'}`}>
                    Costs &amp; margin: cost {money(unitCostOf(l, data.products))} each · margin <b>{money(lineMargin(l))}</b>
                    {lineTotal(l) ? ` (${Math.round((lineMargin(l) / lineTotal(l)) * 100)}%)` : ''}
                  </summary>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <Field label="Kit cost">
                      <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={l.unitCost ?? p?.cost ?? 0} onChange={(e) => setLine(i, { unitCost: round2(Math.max(0, Number(e.target.value) || 0)) })} />
                    </Field>
                    <Field label="Printing cost">
                      <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={l.printCost ?? 0} onChange={(e) => setLine(i, { printCost: round2(Math.max(0, Number(e.target.value) || 0)) })} />
                    </Field>
                    <Field label="Patch cost">
                      <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={l.patchCost ?? 0} onChange={(e) => setLine(i, { patchCost: round2(Math.max(0, Number(e.target.value) || 0)) })} />
                    </Field>
                  </div>
                </details>
                <div className="text-right font-bold tabular-nums">
                  {l.qty} × {money(l.unitPrice + (l.patchId ? l.patchPrice : 0))} = {money(lineTotal(l))}
                </div>
              </div>
            </div>
          );
        })}
        {!locked && (
          <button type="button" className="btn w-full min-h-[52px]!" onClick={() => (setO({ ...o, lines: [...o.lines, blankLine()] }), setPicking(o.lines.length))}>
            <Plus size={18} /> Add kit
          </button>
        )}
        {locked && <p className="text-[13px] text-[#555555]">Lines are locked once an order is {o.status}. Set it back to Open to change them.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Packaging cost (optional)" className="w-[170px]">
          <input disabled={locked} type="number" inputMode="decimal" step="0.01" value={o.packagingCost ?? ''} onChange={(e) => setO({ ...o, packagingCost: round2(Math.max(0, Number(e.target.value) || 0)) || undefined })} placeholder="0.00" />
        </Field>
        <p className={`pb-2 text-[14px] ${orderMarginNow < 0 ? 'text-[#b91c1c]' : 'text-[#555555]'}`}>
          Cost of sales {money(round2(total - orderMarginNow))} · Margin <b>{money(orderMarginNow)}</b>
          {total ? ` (${Math.round((orderMarginNow / total) * 100)}%)` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[#111111] pt-2">
        <span className="text-[20px] font-bold mr-auto">Order total {money(total)}</span>
        {order && (
          <>
            <span>
              Paid {money(paid)} · Balance <b>{money(round2(total - paid))}</b>
            </span>
            <button className="btn" onClick={() => setPay({ amount: String(Math.max(0, round2(total - paid))), accountId: data.accounts.find((a) => a.active !== false)?.id || '' })}>
              Record payment
            </button>
          </>
        )}
      </div>
      <Field label="Notes">
        <input value={o.notes || ''} onChange={(e) => setO({ ...o, notes: e.target.value })} placeholder="e.g. Needed by Saturday" />
      </Field>

      {picking !== null && (
        <KitPicker
          onPick={(pid) => {
            const p = data.products.find((x) => x.id === pid)!;
            setO((x) => {
              const lines = [...x.lines];
              const cur = lines[picking] || blankLine();
              const same = cur.productId === pid;
              lines[picking] = { ...cur, productId: pid, unitPrice: same ? cur.unitPrice : p.price, unitCost: same ? cur.unitCost : p.cost, version: cur.version || settings.versions[0] || '' };
              return { ...x, lines };
            });
            setPicking(null);
          }}
          onClose={() => {
            setO((x) => ({ ...x, lines: x.lines.filter((l) => l.productId) }));
            setPicking(null);
          }}
        />
      )}

      {pay && order && (
        <Modal
          title={`Payment for ${o.number}`}
          onClose={() => setPay(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPay(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!(Number(pay.amount) > 0) || !pay.accountId}
                onClick={() => {
                  const p = save('payments', { number: docNo('P'), date: today(), customerId: o.customerId, customerName: o.customerName, orderId: o.id, amount: round2(Number(pay.amount)), accountId: pay.accountId, note: `Order ${o.number}` });
                  notify(`Payment ${p.number}: ${money(p.amount)} for order ${o.number}.`);
                  setPay(null);
                }}
              >
                Save payment
              </button>
            </>
          }
        >
          <Field label="Amount">
            <input type="number" inputMode="decimal" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          </Field>
          <Field label="Paid into">
            <div className="grid grid-cols-2 gap-2">
              {data.accounts
                .filter((a) => a.active !== false)
                .map((a) => (
                  <button key={a.id} type="button" className={`btn ${pay.accountId === a.id ? 'btn-primary' : ''}`} onClick={() => setPay({ ...pay, accountId: a.id })}>
                    {a.name}
                  </button>
                ))}
            </div>
          </Field>
        </Modal>
      )}
    </Modal>
  );
};

/** Kit chooser with pictures, so the customer can see the kit. */
const KitPicker: React.FC<{ onPick: (id: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const list = data.products.filter((p) => p.active !== false && (!q || `${p.name} ${p.category} ${p.code}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal wide title="Choose the kit" onClose={onClose}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search kits" autoFocus />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((p) => (
          <button key={p.id} type="button" className="border border-[#e5e5e5] rounded-[8px] p-2 text-left active:bg-[#f2f2f2] hover:border-[#999999]" onClick={() => onPick(p.id)}>
            <Thumb id={p.imageId} size={200} className="w-full! h-auto! aspect-square" />
            <div className="font-semibold leading-tight mt-1">{p.name}</div>
            <div className="text-[14px] tabular-nums">{money(p.price)}</div>
          </button>
        ))}
        {!list.length && <p className="text-[#777777] col-span-full">No kits match. Add kits under Products.</p>}
      </div>
    </Modal>
  );
};
