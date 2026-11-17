import React, { useState } from 'react';
import { Camera, Plus, ScanLine } from 'lucide-react';
import { useStore } from '../lib/store';
import { addPicture } from '../lib/images';
import { money, round2 } from '../lib/format';
import type { Patch, Product } from '../lib/types';
import { Field, Modal, ScreenBar, Thumb } from '../components/ui';
import { ListTable } from '../components/ListTable';
import { CameraScanner } from '../components/CameraScanner';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Kids 4-5', 'Kids 6-7', 'Kids 8-9', 'Kids 10-11', 'Kids 12-13'];

/** Picture picker: take a photo or choose one. The original is kept at full quality; screens use a thumbnail. */
export const PictureInput: React.FC<{ value?: string; onChange: (id: string) => void; label?: string }> = ({ value, onChange, label = 'Picture' }) => {
  const { conn, notify } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <Thumb id={value} size={96} />
        <label className={`btn ${busy ? 'opacity-50' : ''}`}>
          <Camera size={16} /> {busy ? 'Saving picture…' : value ? 'Change picture' : 'Add picture'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              try {
                onChange(await addPicture(f, conn));
              } catch (err) {
                notify(err instanceof Error ? err.message : 'That picture could not be added.', 'error');
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
    </Field>
  );
};

export const Products: React.FC = () => {
  const { data, save, notify } = useStore();
  const [tab, setTab] = useState<'kits' | 'patches'>('kits');
  const [kit, setKit] = useState<Partial<Product> | null>(null);
  const [patch, setPatch] = useState<Partial<Patch> | null>(null);
  const [scanFor, setScanFor] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const cats = [...new Set(data.products.map((p) => p.category).filter(Boolean))];

  return (
    <div>
      <ScreenBar title="Products">
        <button
          className="btn btn-primary"
          onClick={() => (tab === 'kits' ? setKit({ name: '', code: '', category: '', price: 0, cost: 0, sizes: ['S', 'M', 'L', 'XL', '2XL'], active: true }) : setPatch({ name: '', price: 0, cost: 0, active: true }))}
        >
          <Plus size={16} /> {tab === 'kits' ? 'New kit' : 'New patch'}
        </button>
      </ScreenBar>
      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          {(
            [
              ['kits', `Kits (${data.products.length})`],
              ['patches', `Patches (${data.patches.length})`],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'kits' ? (
          <ListTable
            rows={[...data.products].sort((a, b) => a.name.localeCompare(b.name))}
            rowKey={(p) => p.id}
            onOpen={(p) => setKit(p)}
            exportName="kits"
            empty="No kits yet. Tap New kit."
            cols={[
              { header: 'Picture', value: () => '', render: (p) => <Thumb id={p.imageId} size={40} /> },
              { header: 'Kit', value: (p) => p.name },
              { header: 'Code', value: (p) => p.code, wide: true },
              { header: 'Category', value: (p) => p.category, wide: true },
              { header: 'Sizes', value: (p) => p.sizes.join(' '), wide: true },
              { header: 'Cost', value: (p) => p.cost, money: true, wide: true },
              { header: 'Price', value: (p) => p.price, money: true },
            ]}
          />
        ) : (
          <ListTable
            rows={[...data.patches].sort((a, b) => a.name.localeCompare(b.name))}
            rowKey={(p) => p.id}
            onOpen={(p) => setPatch(p)}
            exportName="patches"
            empty="No patches yet. Tap New patch."
            cols={[
              { header: 'Picture', value: () => '', render: (p) => <Thumb id={p.imageId} size={40} /> },
              { header: 'Patch', value: (p) => p.name },
              { header: 'Cost', value: (p) => p.cost, money: true },
              { header: 'Price', value: (p) => p.price, money: true },
            ]}
          />
        )}
      </div>

      {kit && (
        <Modal
          wide
          title={kit.id ? kit.name || 'Kit' : 'New kit'}
          onClose={() => setKit(null)}
          footer={
            <>
              {kit.id && (
                <button className="btn mr-auto" onClick={() => (save('products', { id: kit.id, active: kit.active === false }), notify(kit.active === false ? 'Kit shown at the till again.' : 'Kit hidden from the till.'), setKit(null))}>
                  {kit.active === false ? 'Show at the till' : 'Hide from the till'}
                </button>
              )}
              <button className="btn" onClick={() => setKit(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!kit.name?.trim() || (!!kit.code?.trim() && data.products.some((p) => p.id !== kit.id && p.code.trim().toLowerCase() === kit.code!.trim().toLowerCase()))}
                onClick={() => {
                  const p = save('products', { ...kit, name: kit.name!.trim(), code: (kit.code || '').trim(), category: (kit.category || '').trim(), price: round2(Number(kit.price) || 0), cost: round2(Number(kit.cost) || 0), sizes: kit.sizes || [] });
                  notify(`${p.name} saved.`);
                  setKit(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <PictureInput value={kit.imageId} onChange={(id) => setKit((k) => ({ ...k, imageId: id }))} label="Kit picture" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kit name">
              <input value={kit.name || ''} onChange={(e) => setKit({ ...kit, name: e.target.value })} placeholder="e.g. Arsenal Home 25/26" />
            </Field>
            <Field label="Barcode / code" hint={kit.code && data.products.some((p) => p.id !== kit.id && p.code.trim().toLowerCase() === kit.code!.trim().toLowerCase()) ? 'Another kit already has this code.' : 'Scan it or type it.'}>
              <div className="flex gap-2">
                <input value={kit.code || ''} onChange={(e) => setKit({ ...kit, code: e.target.value })} />
                <button type="button" className="btn shrink-0" onClick={() => setScanFor(true)} aria-label="Scan the barcode">
                  <ScanLine size={18} />
                </button>
              </div>
            </Field>
            <Field label="Category">
              <input list="kit-cats" value={kit.category || ''} onChange={(e) => setKit({ ...kit, category: e.target.value })} placeholder="e.g. Premier League" />
              <datalist id="kit-cats">
                {cats.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price">
                <input type="number" inputMode="decimal" step="0.01" value={kit.price ?? ''} onChange={(e) => setKit({ ...kit, price: Number(e.target.value) })} />
              </Field>
              <Field label="Supplier cost">
                <input type="number" inputMode="decimal" step="0.01" value={kit.cost ?? ''} onChange={(e) => setKit({ ...kit, cost: Number(e.target.value) })} />
              </Field>
            </div>
          </div>
          <Field label="Sizes offered">
            <div className="flex flex-wrap gap-2">
              {[...new Set([...SIZES, ...(kit.sizes || [])])].map((s) => {
                const on = (kit.sizes || []).includes(s);
                return (
                  <button key={s} type="button" className={`btn ${on ? 'btn-primary' : ''}`} onClick={() => setKit({ ...kit, sizes: on ? kit.sizes!.filter((x) => x !== s) : [...(kit.sizes || []), s] })}>
                    {s}
                  </button>
                );
              })}
              <span className="flex gap-1">
                <input value={customSize} onChange={(e) => setCustomSize(e.target.value)} placeholder="Other size" className="w-[110px]!" />
                <button type="button" className="btn" disabled={!customSize.trim()} onClick={() => (setKit({ ...kit, sizes: [...(kit.sizes || []), customSize.trim()] }), setCustomSize(''))}>
                  Add
                </button>
              </span>
            </div>
          </Field>
          {scanFor && <CameraScanner onCode={(c) => (setKit((k) => ({ ...k, code: c })), setScanFor(false))} onClose={() => setScanFor(false)} />}
        </Modal>
      )}

      {patch && (
        <Modal
          title={patch.id ? patch.name || 'Patch' : 'New patch'}
          onClose={() => setPatch(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPatch(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!patch.name?.trim()}
                onClick={() => {
                  const p = save('patches', { ...patch, name: patch.name!.trim(), price: round2(Number(patch.price) || 0), cost: round2(Number(patch.cost) || 0) });
                  notify(`${p.name} saved.`);
                  setPatch(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <PictureInput value={patch.imageId} onChange={(id) => setPatch((p) => ({ ...p, imageId: id }))} label="Patch picture" />
          <Field label="Patch name">
            <input value={patch.name || ''} onChange={(e) => setPatch({ ...patch, name: e.target.value })} placeholder="e.g. Premier League + No Room for Racism" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price to customer">
              <input type="number" inputMode="decimal" step="0.01" value={patch.price ?? ''} onChange={(e) => setPatch({ ...patch, price: Number(e.target.value) })} />
            </Field>
            <Field label="Supplier cost">
              <input type="number" inputMode="decimal" step="0.01" value={patch.cost ?? ''} onChange={(e) => setPatch({ ...patch, cost: Number(e.target.value) })} />
            </Field>
          </div>
          <p className="text-[13px] text-[#555555]">Shown with its picture on sales orders; the supplier sheet uses the supplier cost. Current price {money(Number(patch.price) || 0)}.</p>
        </Modal>
      )}
    </div>
  );
};
