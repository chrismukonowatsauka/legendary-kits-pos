import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { daysAgo, docNo, money, monthStart, round2, today } from '../lib/format';
import type { Expense } from '../lib/types';
import { DateRange, Field, Modal, Numpad, ScreenBar } from '../components/ui';
import { ListTable } from '../components/ListTable';

/** Quick expense posting: amount on the numpad, what it was for, and the account it was paid from. */
export const Expenses: React.FC = () => {
  const { data, save, notify, settings, ensureHistory, remove } = useStore();
  const accounts = data.accounts.filter((a) => a.active !== false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(settings.expenseCategories[0] || 'Other');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState<Expense | null>(null);
  useEffect(() => {
    ensureHistory(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);
  const amt = round2(parseFloat(amount || '0') || 0);

  const post = () => {
    const e = save('expenses', { number: docNo('E'), date, category, description: description.trim() || category, amount: amt, accountId });
    notify(`Expense ${e.number} posted: ${money(amt)} from ${accounts.find((a) => a.id === accountId)?.name}.`);
    setAmount('');
    setDescription('');
  };

  const rows = data.expenses.filter((e) => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name || '';

  return (
    <div>
      <ScreenBar title="Expenses" />
      <div className="p-3 grid lg:grid-cols-[360px_1fr] gap-4">
        <section className="space-y-3 border border-[#e5e5e5] rounded-[8px] p-3 self-start">
          <h2 className="font-bold">Post an expense</h2>
          <Numpad decimals value={amount} onChange={setAmount} />
          <Field label="What for">
            <div className="flex flex-wrap gap-2">
              {settings.expenseCategories.map((c) => (
                <button key={c} type="button" className={`btn ${category === c ? 'btn-primary' : ''}`} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Details (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Delivery to Avondale" />
          </Field>
          <Field label="Paid from">
            <div className="grid grid-cols-2 gap-2">
              {accounts.map((a) => (
                <button key={a.id} type="button" className={`btn ${accountId === a.id ? 'btn-primary' : ''}`} onClick={() => setAccountId(a.id)}>
                  {a.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <button type="button" className="btn btn-primary w-full min-h-[52px]!" disabled={!(amt > 0) || !accountId} onClick={post}>
            Post expense {amt > 0 ? money(amt) : ''}
          </button>
        </section>
        <section className="space-y-3 min-w-0">
          <DateRange
            from={from}
            to={to}
            onChange={(f, t) => (setFrom(f), setTo(t))}
            presets={[
              ['Today', today(), today()],
              ['This month', monthStart(), today()],
              ['90 days', daysAgo(89), today()],
            ]}
          />
          <p className="font-bold">Total {money(rows.reduce((s, e) => s + e.amount, 0))}</p>
          <ListTable
            rows={rows}
            rowKey={(e) => e.id}
            onOpen={setOpen}
            exportName="expenses"
            empty="No expenses in these dates."
            cols={[
              { header: 'Date', value: (e) => e.date, date: true },
              { header: 'No.', value: (e) => e.number, wide: true },
              { header: 'Category', value: (e) => e.category },
              { header: 'Details', value: (e) => e.description, wide: true },
              { header: 'Paid From', value: (e) => accName(e.accountId) },
              { header: 'Amount', value: (e) => e.amount, money: true },
            ]}
          />
        </section>
      </div>
      {open && (
        <Modal
          title={`Expense ${open.number}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button
                className="btn btn-danger mr-auto"
                onClick={() => {
                  remove('expenses', open.id);
                  notify(`Expense ${open.number} deleted.`);
                  setOpen(null);
                }}
              >
                Delete
              </button>
              <button className="btn btn-primary" onClick={() => setOpen(null)}>
                Close
              </button>
            </>
          }
        >
          <p>
            {open.category}: {open.description}
          </p>
          <p className="text-[24px] font-bold">{money(open.amount)}</p>
          <p className="text-[#555555]">
            Paid from {accName(open.accountId)} on {open.date}
          </p>
        </Modal>
      )}
    </div>
  );
};
