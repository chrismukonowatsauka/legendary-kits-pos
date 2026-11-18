import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { ping } from '../lib/backend';
import { fmtWhen } from '../lib/format';
import { Field, ScreenBar } from '../components/ui';

const ListEditor: React.FC<{ label: string; items: string[]; onChange: (v: string[]) => void }> = ({ label, items, onChange }) => {
  const [add, setAdd] = useState('');
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <span key={v} className="btn">
            {v}
            <button type="button" aria-label={`Remove ${v}`} className="text-[#b91c1c] ml-1" onClick={() => onChange(items.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
        <span className="flex gap-1">
          <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add" className="w-[160px]!" />
          <button type="button" className="btn" disabled={!add.trim() || items.includes(add.trim())} onClick={() => (onChange([...items, add.trim()]), setAdd(''))}>
            Add
          </button>
        </span>
      </div>
    </Field>
  );
};

export const SettingsScreen: React.FC = () => {
  const { settings, saveSettings, sync, refresh, notify, resetDevice } = useStore();
  const [url, setUrl] = useState(settings.backendUrl);
  const [key, setKey] = useState(settings.backendKey);
  const [testing, setTesting] = useState(false);

  return (
    <div>
      <ScreenBar title="Settings" />
      <div className="p-3 space-y-6 max-w-3xl">
        <section className="space-y-3">
          <h2 className="font-bold text-[18px]">Google Sheets connection</h2>
          <p className="text-[14px] text-[#555555]">
            Paste the web app address and the key from the setup guide (step 3). Then the phone and the laptop share the same records, and Google keeps a daily backup.
          </p>
          <Field label="Web app address" hint="Starts with https://script.google.com/macros/s/ and ends with /exec">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" />
          </Field>
          <Field label="Key" hint="The key shown when you ran Setup in the Google Sheet.">
            <input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                try {
                  const r = await ping({ url, key });
                  saveSettings({ backendUrl: url.trim(), backendKey: key.trim() });
                  notify(`Connected to "${r.sheet}". Syncing now…`);
                  setTimeout(refresh, 300);
                } catch (e) {
                  notify(e instanceof Error ? e.message : 'Could not connect.', 'error');
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? 'Checking…' : 'Connect'}
            </button>
            {settings.backendUrl && (
              <button className="btn" onClick={() => (saveSettings({ backendUrl: '', backendKey: '' }), setUrl(''), setKey(''), notify('Disconnected. This device keeps its own copy.', 'info'))}>
                Disconnect
              </button>
            )}
          </div>
          <p className="text-[14px]">
            {settings.backendUrl ? 'Connected' : 'Not connected: everything stays on this device.'} · Last synced {fmtWhen(sync.lastSynced)}
            {sync.pending > 0 && ` · ${sync.pending} change(s) waiting to send`}
            {sync.error && <span className="text-[#b91c1c]"> · {sync.error}</span>}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[18px]">Shop</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Shop name (on receipts and orders)">
              <input value={settings.shopName} onChange={(e) => saveSettings({ shopName: e.target.value })} />
            </Field>
            <Field label="Currency symbol">
              <input value={settings.currency} onChange={(e) => saveSettings({ currency: e.target.value })} className="w-[100px]!" />
            </Field>
            <Field label="Your name on this device" hint="Saved on each sale as Sold by.">
              <input value={settings.seller} onChange={(e) => saveSettings({ seller: e.target.value })} />
            </Field>
            <Field label="Usual printing cost per shirt" hint="Filled in when a name or number is added; change it on any line.">
              <input type="number" inputMode="decimal" step="0.01" value={settings.printCost ?? 0} onChange={(e) => saveSettings({ printCost: Math.max(0, Number(e.target.value) || 0) })} className="w-[120px]!" />
            </Field>
          </div>
          <ListEditor label="Kit versions" items={settings.versions} onChange={(versions) => saveSettings({ versions })} />
          <ListEditor label="Expense categories" items={settings.expenseCategories} onChange={(expenseCategories) => saveSettings({ expenseCategories })} />
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-[18px]">This device</h2>
          <p className="text-[14px] text-[#555555]">
            To put the app on your phone's home screen: in Chrome tap ⋮ then <b>Add to Home screen</b>; on iPhone Safari tap Share then <b>Add to Home Screen</b>.
          </p>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (sync.pending > 0 && !confirm(`${sync.pending} change(s) have not reached Google Sheets yet and would be lost. Clear anyway?`)) return;
              if (confirm('Clear the copy of the data on this device? With Google Sheets connected it downloads again; without it, the data is gone.')) resetDevice();
            }}
          >
            Clear this device's copy
          </button>
        </section>
      </div>
    </div>
  );
};
