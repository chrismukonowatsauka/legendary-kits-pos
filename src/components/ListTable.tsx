import React, { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { exportList } from '../lib/excel';
import { useStore } from '../lib/store';
import { fmtDate, money } from '../lib/format';

export interface Col<T> {
  header: string;
  value: (r: T) => string | number | null | undefined;
  /** What the cell shows (defaults to the value). */
  render?: (r: T) => React.ReactNode;
  money?: boolean;
  date?: boolean;
  num?: boolean;
  /** Left out on a phone screen to keep rows on one line (still in the Excel file). */
  wide?: boolean;
}

/**
 * Every list screen: a search box, the row count, Export to Excel (exactly the rows shown), and a compact
 * table where a tap opens the record.
 */
export function ListTable<T>({
  rows,
  cols,
  rowKey,
  onOpen,
  exportName,
  empty = 'Nothing here yet.',
  selection,
  footer,
}: {
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  onOpen?: (r: T) => void;
  exportName: string;
  empty?: React.ReactNode;
  selection?: { selected: Set<string>; toggle: (id: string) => void; can?: (r: T) => boolean };
  footer?: React.ReactNode;
}) {
  const { notify } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => cols.some((c) => String(c.value(r) ?? '').toLowerCase().includes(needle))) : rows;
  const show = (c: Col<T>, r: T) => {
    if (c.render) return c.render(r);
    const v = c.value(r);
    if (c.money) return money(Number(v || 0));
    if (c.date) return fmtDate(String(v || ''));
    return v ?? '';
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999] pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the list" className="pl-9!" />
        </div>
        <span className="text-[13px] text-[#555555]">
          {shown.length} {shown.length === 1 ? 'row' : 'rows'}
        </span>
        <button
          type="button"
          className="btn ml-auto"
          disabled={!shown.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await exportList(
                exportName,
                cols.map((c) => ({ header: c.header, value: (r: T) => c.value(r), money: c.money })),
                shown
              );
              notify('Excel file ready.');
            } catch {
              notify('The Excel file could not be made.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} /> {busy ? 'Preparing…' : 'Export to Excel'}
        </button>
      </div>
      <div className="overflow-x-auto border-y border-[#dddddd]">
        <table className="grid-table">
          <thead>
            <tr>
              {selection && <th className="w-8" />}
              {cols.map((c) => (
                <th key={c.header} className={`${c.money || c.num ? 'num' : ''} ${c.wide ? 'hidden md:table-cell' : ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} className={onOpen ? 'clickable' : ''} onClick={onOpen ? () => onOpen(r) : undefined}>
                  {selection && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {(selection.can?.(r) ?? true) && <input type="checkbox" checked={selection.selected.has(k)} onChange={() => selection.toggle(k)} aria-label="Select" />}
                    </td>
                  )}
                  {cols.map((c) => (
                    <td key={c.header} className={`${c.money || c.num ? 'num' : ''} ${c.wide ? 'hidden md:table-cell' : ''}`}>
                      {show(c, r)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={cols.length + (selection ? 1 : 0)} className="text-center text-[#777777] py-8! whitespace-normal!">
                  {rows.length ? 'Nothing matches the search.' : empty}
                </td>
              </tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
    </div>
  );
}
