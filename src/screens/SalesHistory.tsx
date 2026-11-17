import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { daysAgo, money, monthStart, today } from '../lib/format';
import type { Sale } from '../lib/types';
import { DateRange, ScreenBar } from '../components/ui';
import { ListTable } from '../components/ListTable';
import { SaleDetail } from './SaleView';

/** Every completed sale, cash and account, filtered by date. Older months load from Google Sheets when chosen. */
export const SalesHistory: React.FC = () => {
  const { data, ensureHistory } = useStore();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [kind, setKind] = useState<'all' | 'account' | 'voided'>('all');
  const [open, setOpen] = useState<Sale | null>(null);
  useEffect(() => {
    ensureHistory(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const rows = data.sales
    .filter((s) => s.date >= from && s.date <= to)
    .filter((s) => (kind === 'voided' ? s.status === 'voided' : s.status === 'completed' && (kind === 'all' || s.onAccount > 0)))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const total = rows.reduce((s, x) => s + x.total, 0);
  const accName = (id?: string) => data.accounts.find((a) => a.id === id)?.name || '';

  return (
    <div>
      <ScreenBar title="Sales History" />
      <div className="p-3 space-y-3">
        <DateRange
          from={from}
          to={to}
          onChange={(f, t) => (setFrom(f), setTo(t))}
          presets={[
            ['Today', today(), today()],
            ['7 days', daysAgo(6), today()],
            ['This month', monthStart(), today()],
            ['90 days', daysAgo(89), today()],
          ]}
        />
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ['all', 'All sales'],
              ['account', 'Account sales'],
              ['voided', 'Voided'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={`btn ${kind === k ? 'btn-primary' : ''}`} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
          <span className="ml-auto self-center font-bold">Total {money(total)}</span>
        </div>
        <ListTable
          rows={rows}
          rowKey={(s) => s.id}
          onOpen={setOpen}
          exportName="sales-history"
          empty="No sales in these dates."
          cols={[
            { header: 'Date', value: (s) => s.date, date: true },
            { header: 'Time', value: (s) => s.time, wide: true },
            { header: 'Sale No.', value: (s) => s.number },
            { header: 'Customer', value: (s) => s.customerName || 'Walk-in' },
            { header: 'Items', value: (s) => s.lines.reduce((n, l) => n + l.qty, 0), num: true, wide: true },
            { header: 'Paid Into', value: (s) => accName(s.accountId), wide: true },
            { header: 'On Account', value: (s) => s.onAccount, money: true, wide: true },
            { header: 'Total', value: (s) => s.total, money: true },
          ]}
        />
      </div>
      {open && <SaleDetail sale={data.sales.find((s) => s.id === open.id) || open} onClose={() => setOpen(null)} />}
    </div>
  );
};
