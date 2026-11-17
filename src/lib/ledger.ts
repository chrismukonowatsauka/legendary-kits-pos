import type { Account, Customer, OrderLine, Patch, Payment, Product, Sale, SalesOrder, SupplierLine, Tables } from './types';
import { round2 } from './format';

type Data = { [K in keyof Tables]: Tables[K][] };

/** One line of an account's statement: + money in, − money out. */
export interface AccountMove {
  id: string;
  date: string;
  kind: 'Opening balance' | 'Sale' | 'Payment received' | 'Expense' | 'Transfer in' | 'Transfer out';
  ref: string;
  detail: string;
  amount: number;
}

export function accountMoves(a: Account, d: Data): AccountMove[] {
  const out: AccountMove[] = [];
  if (a.openingBalance) out.push({ id: `${a.id}-open`, date: '', kind: 'Opening balance', ref: '', detail: '', amount: a.openingBalance });
  d.sales.forEach((s) => s.status === 'completed' && s.accountId === a.id && s.paid && out.push({ id: s.id, date: s.date, kind: 'Sale', ref: s.number, detail: s.customerName || 'Walk-in', amount: s.paid }));
  d.payments.forEach((p) => p.accountId === a.id && out.push({ id: p.id, date: p.date, kind: 'Payment received', ref: p.number, detail: p.customerName || '', amount: p.amount }));
  d.expenses.forEach((e) => e.accountId === a.id && out.push({ id: e.id, date: e.date, kind: 'Expense', ref: e.number, detail: `${e.category}: ${e.description}`, amount: -e.amount }));
  d.transfers.forEach((t) => {
    if (t.toId === a.id) out.push({ id: t.id + '-in', date: t.date, kind: 'Transfer in', ref: t.number, detail: t.note || '', amount: t.amount });
    if (t.fromId === a.id) out.push({ id: t.id + '-out', date: t.date, kind: 'Transfer out', ref: t.number, detail: t.note || '', amount: -t.amount });
  });
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

export const accountBalance = (a: Account, d: Data) => round2(accountMoves(a, d).reduce((s, m) => s + m.amount, 0));

/** What a customer owes: account sales not yet paid, less payments against the account (not order deposits). */
export function customerBalance(c: Customer, sales: Sale[], payments: Payment[]) {
  const owed = sales.filter((s) => s.status === 'completed' && s.customerId === c.id).reduce((s, x) => s + x.onAccount, 0);
  const paid = payments.filter((p) => p.customerId === c.id && !p.orderId).reduce((s, p) => s + p.amount, 0);
  return round2(owed - paid);
}

/* ---------- Sales orders ---------- */

export const lineTotal = (l: OrderLine) => round2(l.qty * (l.unitPrice + (l.patchId ? l.patchPrice : 0)));
export const orderTotal = (lines: OrderLine[]) => round2(lines.reduce((s, l) => s + lineTotal(l), 0));
export const orderPaid = (o: SalesOrder, payments: Payment[]) => round2(payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0));

/** Supplier sheet total per line: Quantity × (Unit Cost + Patch Cost). */
export const supplierLineTotal = (l: SupplierLine) => round2(l.qty * (l.unitCost + l.patchCost));

/**
 * Merges the lines of several customer orders into one supplier order. Identical lines (same kit, version,
 * size, name, number and patch) are added together.
 */
export function mergeForSupplier(orders: SalesOrder[], products: Product[], patches: Patch[]): SupplierLine[] {
  const map = new Map<string, SupplierLine>();
  for (const o of orders)
    for (const l of o.lines) {
      const key = [l.productId, l.version, l.size, l.printName.trim().toUpperCase(), l.printNumber.trim(), l.patchId || ''].join('|');
      const found = map.get(key);
      if (found) found.qty += l.qty;
      else
        map.set(key, {
          productId: l.productId,
          version: l.version,
          size: l.size,
          printName: l.printName.trim().toUpperCase(),
          printNumber: l.printNumber.trim(),
          patchId: l.patchId,
          qty: l.qty,
          unitCost: products.find((p) => p.id === l.productId)?.cost || 0,
          patchCost: l.patchId ? patches.find((p) => p.id === l.patchId)?.cost || 0 : 0,
        });
    }
  return [...map.values()].sort((a, b) => a.productId.localeCompare(b.productId) || a.size.localeCompare(b.size));
}
