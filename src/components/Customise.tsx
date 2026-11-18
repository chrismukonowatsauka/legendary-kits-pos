import React from 'react';
import { useStore } from '../lib/store';
import { marginPct } from '../lib/ledger';
import { money, round2 } from '../lib/format';
import { Field, Thumb } from './ui';

export interface CustomFields {
  printName?: string;
  printNumber?: string;
  patchId?: string;
  unitCost?: number;
  printCost?: number;
  patchCost?: number;
}

/**
 * Optional customisation on a line (name, number, patch) and what it really cost. The costs are kept on the
 * line, so the margin shown is true whatever the shirt sold for. Printing and patches are cost of sales here,
 * never expenses, so they aren't counted twice.
 */
export const CustomiseFields: React.FC<{
  value: CustomFields;
  onChange: (patch: CustomFields) => void;
  /** Selling price per shirt, everything included, for the margin line. */
  sellEach: number;
  qty: number;
  disabled?: boolean;
}> = ({ value, onChange, sellEach, qty, disabled }) => {
  const { data, settings } = useStore();
  const patch = data.patches.find((p) => p.id === value.patchId);
  const num = (v: string) => round2(Math.max(0, Number(v) || 0));
  const costEach = round2((value.unitCost || 0) + (value.printCost || 0) + (value.patchCost || 0));
  const margin = round2((sellEach - costEach) * qty);

  // Typing a name or number for the first time fills in the usual printing cost (Settings).
  const setPrint = (p: CustomFields) => {
    const had = !!(value.printName || value.printNumber);
    const has = !!(p.printName ?? value.printName) || !!(p.printNumber ?? value.printNumber);
    onChange({ ...p, ...(!had && has && !value.printCost ? { printCost: settings.printCost || 0 } : {}), ...(had && !has ? { printCost: 0 } : {}) });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Field label="Name to print">
          <input disabled={disabled} value={value.printName || ''} onChange={(e) => setPrint({ printName: e.target.value.toUpperCase() })} placeholder="e.g. SAKA" />
        </Field>
        <Field label="Number">
          <input disabled={disabled} inputMode="numeric" value={value.printNumber || ''} onChange={(e) => setPrint({ printNumber: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} placeholder="7" />
        </Field>
      </div>
      <Field label="Patch">
        <div className="flex items-center gap-2">
          {patch && <Thumb id={patch.imageId} size={40} />}
          <select
            disabled={disabled}
            value={value.patchId || ''}
            onChange={(e) => {
              const p = data.patches.find((x) => x.id === e.target.value);
              onChange({ patchId: p?.id, patchCost: p ? p.cost : 0 });
            }}
          >
            <option value="">No patch</option>
            {data.patches
              .filter((p) => p.active !== false || p.id === value.patchId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </Field>
      <fieldset className="border border-[#e5e5e5] rounded-[8px] p-3 space-y-2">
        <legend className="px-1 text-[13px] font-semibold">Actual cost per shirt (cost of sales)</legend>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Kit">
            <input disabled={disabled} type="number" inputMode="decimal" step="0.01" value={value.unitCost ?? ''} onChange={(e) => onChange({ unitCost: num(e.target.value) })} />
          </Field>
          <Field label="Printing">
            <input disabled={disabled} type="number" inputMode="decimal" step="0.01" value={value.printCost ?? ''} onChange={(e) => onChange({ printCost: num(e.target.value) })} />
          </Field>
          <Field label="Patch">
            <input disabled={disabled} type="number" inputMode="decimal" step="0.01" value={value.patchCost ?? ''} onChange={(e) => onChange({ patchCost: num(e.target.value) })} />
          </Field>
        </div>
        <p className={`text-[14px] ${margin < 0 ? 'text-[#b91c1c]' : ''}`}>
          Cost {money(costEach)} each · sells at {money(sellEach)} · margin <b>{money(margin)}</b> {marginPct(margin, sellEach * qty) && `(${marginPct(margin, sellEach * qty)})`}
        </p>
      </fieldset>
    </div>
  );
};
