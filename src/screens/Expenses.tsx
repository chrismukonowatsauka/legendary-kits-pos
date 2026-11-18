import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { daysAgo, docNo, money, monthStart, round2, today } from '../lib/format';
import type { Expense } from '../lib/types';
import { DateRange, Field, Modal, Numpad, ScreenBar } from '../components/ui';
import { ListTable } from '../components/ListTable';

/** Quick expense posting: amount on the numpad, what it was for, and the account it was paid from. */
export const Expenses: React.FC = () => {
  const { data, save, notify, settings, saveSettings, ensureHistory, remove } = useStore();
  const [newCat, setNewCat] = useState<string | null>(null);
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
  // Descriptions used before, this category's first and most used first, written the way they were first typed.
  const suggestions = (() => {
    const count = new Map<string, { text: string; n: number; same: boolean }>();
    data.expenses.forEach((e) => {
      const t = (e.description || '').trim();
      if (!t || t === e.category) return;
      const k = t.toLowerCase();
      const c = count.get(k) || { text: t, n: 0, same: false };
      c.n++;
      c.same ||= e.category === category;
      count.set(k, c);
    });
    return [...count.values()].sort((a, b) => Number(b.same) - Number(a.same) || b.n - a.n).map((c) => c.text);
  })();

  const post = () => {
    // Match an earlier description's spelling, so "tiktok ads" and "TikTok ads" total together.
    const typed = description.trim();
    const known = suggestions.find((s) => s.toLowerCase() === typed.toLowerCase());
    const e = save('expenses', { number: docNo('E'), date, category, description: known || typed || category, amount: amt, accountId });
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
          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {settings.expenseCategories.map((c) => (
                <button key={c} type="button" className={`btn ${category === c ? 'btn-primary' : ''}`} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
              {newCat === null ? (
                <button type="button" className="btn btn-ghost underline" onClick={() => setNewCat('')}>
                  + New category
                </button>
              ) : (
                <span className="flex gap-1">
                  <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" className="w-[160px]!" />
                  <button
                    type="button"
                    className="btn"
                    disabled={!newCat.trim() || settings.expenseCategories.some((c) => c.toLowerCase() === newCat.trim().toLowerCase())}
                    onClick={() => {
                      const c = newCat.trim();
                      const list = [...settings.expenseCategories];
                      list.splice(Math.max(0, list.indexOf('Other')), 0, c);
                      saveSettings({ expenseCategories: list.includes('Other') ? list : [...settings.expenseCategories, c] });
                      setCategory(c);
                      setNewCat(null);
                    }}
                  >
                    Add
                  </button>
                </span>
              )}
            </div>
          </Field>
          <Field label="Description" hint="Pick a description you've used before so totals group together.">
            <input list="expense-descriptions" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. TikTok ads" autoComplete="off" />
            <datalist id="expense-descriptions">
              {suggestions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
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
