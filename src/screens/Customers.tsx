import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import { customerBalance } from '../lib/ledger';
import { docNo, money, round2, today } from '../lib/format';
import type { Customer } from '../lib/types';
import { Field, Modal, ScreenBar } from '../components/ui';
import { ListTable } from '../components/ListTable';

/** Customers: who owes what from account sales, and receiving their payments into an account. */
export const Customers: React.FC = () => {
  const { data, save, notify } = useStore();
  const [edit, setEdit] = useState<Partial<Customer> | null>(null);
  const [view, setView] = useState<Customer | null>(null);
  const [pay, setPay] = useState<{ amount: string; accountId: string; date: string; note: string } | null>(null);
  const bal = (c: Customer) => customerBalance(c, data.sales, data.payments);
  const rows = [...data.customers].sort((a, b) => bal(b) - bal(a) || a.name.localeCompare(b.name));
  const accounts = data.accounts.filter((a) => a.active !== false);

  return (
    <div>
      <ScreenBar title="Customers">
        <button className="btn btn-primary" onClick={() => setEdit({ name: '', phone: '' })}>
          <Plus size={16} /> New customer
        </button>
      </ScreenBar>
      <div className="p-3">
        <p className="font-bold mb-2">Owed to you: {money(rows.reduce((s, c) => s + Math.max(0, bal(c)), 0))}</p>
        <ListTable
          rows={rows}
          rowKey={(c) => c.id}
          onOpen={setView}
          exportName="customers"
          empty="No customers yet. They are added at the till (account sales) or on a sales order."
          cols={[
            { header: 'Name', value: (c) => c.name },
            { header: 'Phone', value: (c) => c.phone },
            { header: 'Notes', value: (c) => c.notes || '', wide: true },
            { header: 'Balance', value: (c) => bal(c), money: true },
          ]}
        />
      </div>

      {view && (
        <Modal
          wide
          title={view.name}
          onClose={() => setView(null)}
          footer={
            <>
              <button className="btn mr-auto" onClick={() => (setEdit(view), setView(null))}>
                Edit
              </button>
              <button className="btn btn-primary" onClick={() => setPay({ amount: String(Math.max(0, bal(view))), accountId: accounts[0]?.id || '', date: today(), note: '' })}>
                Receive payment
              </button>
            </>
          }
        >
          <p>
            {view.phone} · Balance <b>{money(bal(view))}</b>
          </p>
          <ListTable
            rows={[
              ...data.sales.filter((s) => s.customerId === view.id && s.status === 'completed' && s.onAccount > 0).map((s) => ({ id: s.id, date: s.date, what: `Sale ${s.number}`, debit: s.onAccount, credit: 0 })),
              ...data.payments.filter((p) => p.customerId === view.id && !p.orderId).map((p) => ({ id: p.id, date: p.date, what: `Payment ${p.number}`, debit: 0, credit: p.amount })),
            ].sort((a, b) => b.date.localeCompare(a.date))}
            rowKey={(r) => r.id}
            exportName={`customer-${view.name}`}
            empty="No account sales or payments."
            cols={[
              { header: 'Date', value: (r) => r.date, date: true },
              { header: 'Item', value: (r) => r.what },
              { header: 'Owed', value: (r) => r.debit || null, render: (r) => (r.debit ? money(r.debit) : ''), num: true },
              { header: 'Paid', value: (r) => r.credit || null, render: (r) => (r.credit ? money(r.credit) : ''), num: true },
            ]}
          />
        </Modal>
      )}

      {view && pay && (
        <Modal
          title={`Payment from ${view.name}`}
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
                  const p = save('payments', { number: docNo('P'), date: pay.date, customerId: view.id, customerName: view.name, amount: round2(Number(pay.amount)), accountId: pay.accountId, note: pay.note.trim() });
                  notify(`Payment ${p.number}: ${money(p.amount)} received from ${view.name}.`);
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
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`btn ${pay.accountId === a.id ? 'btn-primary' : ''}`} onClick={() => setPay({ ...pay, accountId: a.id })}>
                  {a.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date">
            <input type="date" value={pay.date} max={today()} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
          </Field>
          <Field label="Note">
            <input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
          </Field>
        </Modal>
      )}

      {edit && (
        <Modal
          title={edit.id ? `Edit ${edit.name}` : 'New customer'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!edit.name?.trim()}
                onClick={() => {
                  const c = save('customers', { ...edit, name: edit.name!.trim(), phone: (edit.phone || '').trim() });
                  notify(`${c.name} saved.`);
                  setEdit(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <Field label="Name">
            <input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <Field label="Phone (WhatsApp)" hint="With country code, e.g. 263771234567, so WhatsApp opens the right chat.">
            <input inputMode="tel" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </div>
  );
};
