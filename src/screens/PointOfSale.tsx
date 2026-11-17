import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, ScanLine, Search, Trash2, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { docNo, money, nowTime, round2, today } from '../lib/format';
import { isTouch } from '../lib/files';
import type { Product, Sale, SaleLine } from '../lib/types';
import { CameraScanner } from '../components/CameraScanner';
import { Field, Modal, Numpad, ScreenBar, Thumb } from '../components/ui';
import { ReceiptShare } from './SaleView';

const CART_KEY = 'lk:cart';

/**
 * Point of Sale.
 * - PC: the cursor stays in the search box, so a USB/Bluetooth scanner (which types the code and Enter)
 *   adds the item straight away. Tap a line to edit its quantity on the on-screen numpad.
 * - Phone: the Scan button opens the camera; the sale opens from the bar at the bottom.
 */
export const PointOfSale: React.FC = () => {
  const { data, save, notify, settings } = useStore();
  const products = data.products.filter((p) => p.active !== false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState<SaleLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [sel, setSel] = useState<number | null>(null);
  const [scan, setScan] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [padFor, setPadFor] = useState<{ i: number; field: 'qty' | 'price'; value: string } | null>(null);
  const [done, setDone] = useState<Sale | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const touch = isTouch();

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);
  // PC: keep the cursor in the search box for the barcode scanner.
  const refocus = () => {
    if (!touch) setTimeout(() => search.current?.focus(), 0);
  };
  useEffect(refocus, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A scan that arrives while the cursor is elsewhere (e.g. after tapping the numpad) still lands in the search box.
  const dialogOpen = scan || paying || cartOpen || !!padFor || !!done;
  useEffect(() => {
    if (touch || dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) {
        e.preventDefault();
        setQ((v) => v + e.key);
        search.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [touch, dialogOpen]);

  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const shown = products.filter((p) => (!cat || p.category === cat) && (!q || `${p.name} ${p.code}`.toLowerCase().includes(q.toLowerCase())));
  const total = round2(cart.reduce((s, l) => s + l.qty * l.price, 0));
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const add = (p: Product, size?: string) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id && (l.size || '') === (size || ''));
      if (i >= 0) {
        setSel(i);
        return c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      }
      setSel(c.length);
      return [...c, { productId: p.id, name: p.name, code: p.code, size, qty: 1, price: p.price }];
    });
    setQ('');
    refocus();
  };
  const byCode = (code: string) => products.find((p) => p.code && p.code.trim().toLowerCase() === code.trim().toLowerCase());
  const scanned = (code: string) => {
    const p = byCode(code);
    if (p) {
      add(p);
      notify(`Added ${p.name}`);
    } else notify(`No product has the code ${code}. Add it under Products.`, 'error');
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !q.trim()) return;
    e.preventDefault();
    const p = byCode(q) || (shown.length === 1 ? shown[0] : undefined);
    if (p) add(p);
    else notify(`Nothing matches "${q}".`, 'error');
  };
  const setLine = (i: number, patch: Partial<SaleLine>) => setCart((c) => c.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => {
    setCart((c) => c.filter((_, j) => j !== i));
    setSel(null);
  };

  const cartPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-[#eeeeee]">
        {cart.length === 0 && <p className="text-[#777777] p-6 text-center">Scan or tap a kit to start a sale.</p>}
        {cart.map((l, i) => {
          const p = products.find((x) => x.id === l.productId);
          return (
            <div key={i} className={`p-3 flex gap-3 items-center ${sel === i ? 'bg-[#f2f2f2]' : ''}`} onClick={() => setSel(i)}>
              <Thumb id={p?.imageId} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{l.name}</div>
                <div className="flex items-center gap-2 text-[13px] text-[#555555]">
                  {p && p.sizes.length > 0 ? (
                    <select value={l.size || ''} onChange={(e) => setLine(i, { size: e.target.value })} className="w-auto! min-h-[32px]! py-0! text-[13px]" aria-label="Size" onClick={(e) => e.stopPropagation()}>
                      <option value="">Size</option>
                      {p.sizes.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  ) : null}
                  <button type="button" className="underline tabular-nums" onClick={(e) => (e.stopPropagation(), setPadFor({ i, field: 'price', value: String(l.price) }))}>
                    {money(l.price)}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="btn px-2!" aria-label="One less" onClick={(e) => (e.stopPropagation(), l.qty > 1 ? setLine(i, { qty: l.qty - 1 }) : removeLine(i))}>
                  <Minus size={16} />
                </button>
                <button type="button" className="btn px-2! min-w-[48px] tabular-nums" aria-label="Quantity" onClick={(e) => (e.stopPropagation(), setPadFor({ i, field: 'qty', value: String(l.qty) }))}>
                  {l.qty}
                </button>
                <button type="button" className="btn px-2!" aria-label="One more" onClick={(e) => (e.stopPropagation(), setLine(i, { qty: l.qty + 1 }))}>
                  <Plus size={16} />
                </button>
              </div>
              <div className="w-[84px] text-right font-bold tabular-nums">{money(l.qty * l.price)}</div>
            </div>
          );
        })}
      </div>
      {/* PC: numpad for the selected line's quantity */}
      {!touch && sel !== null && cart[sel] && (
        <div className="border-t border-[#e5e5e5] p-3 hidden lg:block">
          <div className="flex items-center justify-between text-[13px] mb-2">
            <span>
              Quantity · <b>{cart[sel].name}</b>
            </span>
            <button type="button" className="text-[#b91c1c] flex items-center gap-1" onClick={() => removeLine(sel)}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
          <Numpad
            resetKey={`${sel}-${cart.length}-${cart[sel].productId}`}
            value={String(cart[sel].qty)}
            onChange={(v) => {
              const n = parseInt(v || '0', 10);
              if (n > 0) setLine(sel, { qty: Math.min(n, 9999) });
              else setLine(sel, { qty: 1 });
            }}
          />
        </div>
      )}
      <div className="border-t border-[#e5e5e5] p-3 space-y-2">
        <div className="flex justify-between text-[20px] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(total)}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" disabled={!cart.length} onClick={() => (setCart([]), setSel(null), refocus())}>
            Clear
          </button>
          <button type="button" className="btn btn-primary flex-1 min-h-[52px]!" disabled={!cart.length} onClick={() => setPaying(true)}>
            Pay {money(total)}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <ScreenBar title="Point of Sale">
        <button type="button" className="btn btn-primary" onClick={() => setScan(true)}>
          <ScanLine size={18} /> Scan
        </button>
      </ScreenBar>
      <div className="flex-1 min-h-0 flex">
        {/* Products */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999] pointer-events-none" />
              <input
                ref={search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={touch ? 'Search kits' : 'Scan a barcode or type to search'}
                aria-label="Search or scan"
                className="pl-10!"
                autoComplete="off"
              />
            </div>
            {cats.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['', ...cats].map((c) => (
                  <button key={c || 'all'} type="button" className={`btn shrink-0 ${cat === c ? 'btn-primary' : ''}`} onClick={() => setCat(c)}>
                    {c || 'All'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-24 lg:pb-3">
            {products.length === 0 ? (
              <p className="text-[#777777] py-10 text-center">No kits yet. Add them under Products, with their barcode and picture.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {shown.map((p) => (
                  <ProductTile key={p.id} p={p} onAdd={add} />
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Sale (PC) */}
        <div className="hidden lg:flex w-[420px] border-l border-[#e5e5e5] flex-col">{cartPanel}</div>
      </div>

      {/* Phone: sale bar */}
      <div className="lg:hidden fixed left-0 right-0 bottom-[64px] p-2 z-30">
        <button type="button" className="btn btn-primary w-full min-h-[56px]! justify-between!" onClick={() => setCartOpen(true)}>
          <span>
            {count} item{count === 1 ? '' : 's'}
          </span>
          <span className="tabular-nums text-[18px]">{money(total)}</span>
        </button>
      </div>
      {cartOpen && (
        <Modal title="Sale" onClose={() => setCartOpen(false)}>
          <div className="-m-4">{cartPanel}</div>
        </Modal>
      )}

      {scan && <CameraScanner onCode={scanned} onClose={() => (setScan(false), refocus())} />}

      {padFor && (
        <Modal title={padFor.field === 'qty' ? 'Quantity' : 'Price'} onClose={() => setPadFor(null)}>
          <Numpad
            decimals={padFor.field === 'price'}
            value={padFor.value}
            onChange={(v) => setPadFor({ ...padFor, value: v })}
            onDone={() => {
              const n = parseFloat(padFor.value || '0');
              if (padFor.field === 'qty') n >= 1 ? setLine(padFor.i, { qty: Math.floor(n) }) : removeLine(padFor.i);
              else setLine(padFor.i, { price: round2(Math.max(0, n)) });
              setPadFor(null);
              refocus();
            }}
          />
        </Modal>
      )}

      {paying && (
        <Checkout
          total={total}
          onClose={() => (setPaying(false), refocus())}
          onPaid={(pay) => {
            const sale = save('sales', {
              number: docNo('S'),
              date: today(),
              time: nowTime(),
              lines: cart,
              total,
              ...pay,
              status: 'completed',
              soldBy: settings.seller,
            } as Partial<Sale>);
            setCart([]);
            setSel(null);
            setPaying(false);
            setCartOpen(false);
            setDone(sale);
            notify(`Sale ${sale.number} completed: ${money(total)}${sale.onAccount ? ` (${money(sale.onAccount)} on account)` : ''}.`);
            refocus();
          }}
        />
      )}
      {done && <ReceiptShare sale={done} onClose={() => (setDone(null), refocus())} />}
    </div>
  );
};

const ProductTile: React.FC<{ p: Product; onAdd: (p: Product, size?: string) => void }> = ({ p, onAdd }) => {
  const [pick, setPick] = useState(false);
  return (
    <>
      <button type="button" className="border border-[#e5e5e5] rounded-[8px] p-2 text-left active:bg-[#f2f2f2] hover:border-[#999999] flex flex-col gap-1" onClick={() => (p.sizes.length ? setPick(true) : onAdd(p))}>
        <Thumb id={p.imageId} size={160} className="w-full! h-auto! aspect-square" />
        <span className="font-semibold leading-tight line-clamp-2 text-[14px]">{p.name}</span>
        <span className="tabular-nums text-[14px]">{money(p.price)}</span>
      </button>
      {pick && (
        <Modal title={p.name} onClose={() => setPick(false)}>
          <p className="text-[13px] text-[#555555]">Choose the size</p>
          <div className="grid grid-cols-3 gap-2">
            {p.sizes.map((s) => (
              <button key={s} type="button" className="btn min-h-[56px]! text-[18px]" onClick={() => (onAdd(p, s), setPick(false))}>
                {s}
              </button>
            ))}
            <button type="button" className="btn min-h-[56px]! col-span-3" onClick={() => (onAdd(p), setPick(false))}>
              No size
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

/** Payment: which account the money goes into, how much is paid now, and the rest on a customer's account. */
const Checkout: React.FC<{ total: number; onClose: () => void; onPaid: (p: Pick<Sale, 'paid' | 'accountId' | 'onAccount' | 'customerId' | 'customerName'>) => void }> = ({ total, onClose, onPaid }) => {
  const { data, save, notify } = useStore();
  const accounts = data.accounts.filter((a) => a.active !== false);
  const [accountId, setAccountId] = useState(() => localStorage.getItem('lk:lastAccount') || accounts[0]?.id || '');
  const [tendered, setTendered] = useState(String(total));
  const [customerId, setCustomerId] = useState('');
  const [newCust, setNewCust] = useState<{ name: string; phone: string } | null>(null);
  const tend = parseFloat(tendered || '0') || 0;
  const paid = Math.min(tend, total);
  const change = round2(Math.max(0, tend - total));
  const short = round2(total - paid);
  const customer = data.customers.find((c) => c.id === customerId);
  const canFinish = (short === 0 || !!customer) && (paid === 0 || !!accountId);

  return (
    <Modal
      title={`Pay ${money(total)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Back
          </button>
          <button
            className="btn btn-primary min-h-[52px]! flex-1 sm:flex-none"
            disabled={!canFinish}
            onClick={() => {
              try {
                localStorage.setItem('lk:lastAccount', accountId);
              } catch {
                /* ignore */
              }
              onPaid({ paid: round2(paid), accountId: paid ? accountId : undefined, onAccount: short, customerId: customer?.id, customerName: customer?.name });
            }}
          >
            Complete sale
          </button>
        </>
      }
    >
      <Field label="Paid into">
        <div className="grid grid-cols-2 gap-2">
          {accounts.map((a) => (
            <button key={a.id} type="button" className={`btn min-h-[52px]! ${accountId === a.id ? 'btn-primary' : ''}`} onClick={() => setAccountId(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Amount received">
        <Numpad decimals value={tendered} onChange={setTendered} />
      </Field>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn" onClick={() => setTendered(String(total))}>
          Exact {money(total)}
        </button>
        <button type="button" className="btn" onClick={() => setTendered('0')}>
          Nothing now (account)
        </button>
      </div>
      {change > 0 && <p className="text-[20px] font-bold">Change: {money(change)}</p>}
      {short > 0 && (
        <div className="border border-[#cccccc] rounded-[8px] p-3 space-y-2">
          <p className="font-semibold">{money(short)} goes on the customer's account</p>
          {!newCust ? (
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Customer">
                <option value="">Choose the customer</option>
                {[...data.customers]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone && `(${c.phone})`}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn shrink-0" onClick={() => setNewCust({ name: '', phone: '' })}>
                <Plus size={16} /> New
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              <input placeholder="Customer name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
              <input placeholder="Phone (WhatsApp)" inputMode="tel" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" className="btn" onClick={() => setNewCust(null)}>
                  <X size={16} /> Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newCust.name.trim()}
                  onClick={() => {
                    const c = save('customers', { name: newCust.name.trim(), phone: newCust.phone.trim() });
                    setCustomerId(c.id);
                    setNewCust(null);
                    notify(`${c.name} added.`);
                  }}
                >
                  Save customer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
