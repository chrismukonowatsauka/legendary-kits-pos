import React, { useState } from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import { accountBalance, accountMoves } from '../lib/ledger';
import { docNo, money, round2, today } from '../lib/format';
import type { Account, AccountType } from '../lib/types';
import { Field, Modal, ScreenBar } from '../components/ui';
import { ListTable } from '../components/ListTable';

const TYPES: [AccountType, string][] = [
  ['cash', 'Cash'],
  ['bank', 'Bank'],
  ['mobile', 'Mobile money'],
  ['other', 'Other'],
];

/** Money accounts (Cash, Bank, EcoCash…): balances, statements, add/edit, and moving money between them. */
export const Accounts: React.FC = () => {
  const { data, save, notify } = useStore();
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [view, setView] = useState<Account | null>(null);
  const [move, setMove] = useState<{ fromId: string; toId: string; amount: string; note: string; date: string } | null>(null);
  const active = data.accounts.filter((a) => a.active !== false);

  return (
    <div>
      <ScreenBar title="Accounts">
        <button className="btn" onClick={() => setMove({ fromId: active[0]?.id || '', toId: active[1]?.id || '', amount: '', note: '', date: today() })}>
          <ArrowLeftRight size={16} /> Transfer
        </button>
        <button className="btn btn-primary" onClick={() => setEdit({ name: '', type: 'mobile', openingBalance: 0, active: true })}>
          <Plus size={16} /> New account
        </button>
      </ScreenBar>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {data.accounts.map((a) => (
            <button key={a.id} type="button" className="border border-[#e5e5e5] rounded-[8px] p-3 text-left active:bg-[#f2f2f2]" onClick={() => setView(a)}>
              <div className="text-[13px] text-[#555555]">
                {a.name} {a.active === false && '(inactive)'}
              </div>
              <div className="text-[20px] font-bold tabular-nums">{money(accountBalance(a, data))}</div>
            </button>
          ))}
        </div>
        <ListTable
          rows={data.accounts}
          rowKey={(a) => a.id}
          onOpen={setView}
          exportName="accounts"
          cols={[
            { header: 'Account', value: (a) => a.name },
            { header: 'Type', value: (a) => TYPES.find(([k]) => k === a.type)?.[1] },
            { header: 'Active', value: (a) => (a.active === false ? 'No' : 'Yes'), wide: true },
            { header: 'Balance', value: (a) => accountBalance(a, data), money: true },
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
                Edit account
              </button>
              <button className="btn btn-primary" onClick={() => setView(null)}>
                Close
              </button>
            </>
          }
        >
          <p className="text-[24px] font-bold">{money(accountBalance(view, data))}</p>
          <ListTable
            rows={accountMoves(view, data).reverse()}
            rowKey={(m) => m.id}
            exportName={`account-${view.name}`}
            empty="No money in or out yet."
            cols={[
              { header: 'Date', value: (m) => m.date, date: true },
              { header: 'Type', value: (m) => m.kind },
              { header: 'Ref', value: (m) => m.ref, wide: true },
              { header: 'Details', value: (m) => m.detail, wide: true },
              { header: 'In', value: (m) => (m.amount > 0 ? m.amount : null), render: (m) => (m.amount > 0 ? money(m.amount) : ''), num: true },
              { header: 'Out', value: (m) => (m.amount < 0 ? -m.amount : null), render: (m) => (m.amount < 0 ? money(-m.amount) : ''), num: true },
            ]}
          />
        </Modal>
      )}

      {edit && (
        <Modal
          title={edit.id ? `Edit ${edit.name}` : 'New account'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!edit.name?.trim() || data.accounts.some((a) => a.id !== edit.id && a.name.toLowerCase() === edit.name!.trim().toLowerCase())}
                onClick={() => {
                  const a = save('accounts', { ...edit, name: edit.name!.trim(), openingBalance: round2(Number(edit.openingBalance) || 0) });
                  notify(`${a.name} saved.`);
                  setEdit(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <Field label="Name">
            <input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. InnBucks, CABS Bank" />
          </Field>
          <Field label="Type">
            <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as AccountType })}>
              {TYPES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Opening balance" hint="What the account held when you started using this app.">
            <input type="number" inputMode="decimal" step="0.01" value={edit.openingBalance ?? 0} onChange={(e) => setEdit({ ...edit, openingBalance: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            Active (offered when taking payments and posting expenses)
          </label>
        </Modal>
      )}

      {move && (
        <Modal
          title="Transfer between accounts"
          onClose={() => setMove(null)}
          footer={
            <>
              <button className="btn" onClick={() => setMove(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!(Number(move.amount) > 0) || !move.fromId || !move.toId || move.fromId === move.toId}
                onClick={() => {
                  const t = save('transfers', { number: docNo('T'), date: move.date, fromId: move.fromId, toId: move.toId, amount: round2(Number(move.amount)), note: move.note.trim() });
                  notify(`Transfer ${t.number}: ${money(t.amount)} moved.`);
                  setMove(null);
                }}
              >
                Transfer
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <select value={move.fromId} onChange={(e) => setMove({ ...move, fromId: e.target.value })}>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(accountBalance(a, data))})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select value={move.toId} onChange={(e) => setMove({ ...move, toId: e.target.value })}>
                {active
                  .filter((a) => a.id !== move.fromId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amount">
              <input type="number" inputMode="decimal" step="0.01" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <input type="date" value={move.date} max={today()} onChange={(e) => setMove({ ...move, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder="e.g. Cash banked" />
          </Field>
        </Modal>
      )}
    </div>
  );
};
