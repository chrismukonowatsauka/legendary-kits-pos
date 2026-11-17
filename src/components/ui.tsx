import React, { useEffect, useState } from 'react';
import { Delete, ImageOff, RefreshCw, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { thumbUrl } from '../lib/images';
import { fmtWhen } from '../lib/format';

/** Screen title band with the refresh icon and "last synced" time, plus the screen's own buttons. */
export const ScreenBar: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => {
  const { sync, refresh } = useStore();
  return (
    <div className="band px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-[18px] lg:text-[16px] font-bold mr-auto">{title}</h1>
      <div className="flex items-center gap-2 justify-end flex-wrap">{children}</div>
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1.5 text-[12px] text-[#555555] min-h-[44px] lg:min-h-0 px-1"
        title="Get the latest from Google Sheets"
        aria-label="Refresh"
      >
        <RefreshCw size={16} className={sync.syncing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">
          {sync.error ? 'Not synced' : `Synced ${fmtWhen(sync.lastSynced)}`}
          {sync.pending > 0 && ` · ${sync.pending} to send`}
        </span>
      </button>
    </div>
  );
};

export const MessageBar: React.FC = () => {
  const { message, dismiss } = useStore();
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className={`message-bar is-${message.kind}`}>
      <span className="flex-1">
        {message.kind === 'success' ? '✓ ' : message.kind === 'error' ? '! ' : ''}
        {message.text}
      </span>
      <button type="button" onClick={dismiss} aria-label="Dismiss message" className="px-2">
        ×
      </button>
    </div>
  );
};

/** A dialog: a sheet sliding up from the bottom on a phone, a centred box on a PC. */
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, footer, wide }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] flex flex-col rounded-t-[12px] sm:rounded-[8px]`}>
        <div className="band flex items-center px-4 py-2 rounded-t-[12px] sm:rounded-t-[8px]">
          <h2 className="font-bold flex-1">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] lg:min-h-[32px] px-2">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-[#e5e5e5] p-3 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string; hint?: string }> = ({ label, children, className = '', hint }) => (
  <label className={`block ${className}`}>
    <span className="block text-[13px] text-[#555555] mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[12px] text-[#777777] mt-1">{hint}</span>}
  </label>
);

/** Product or patch picture: small thumbnail, loaded only when it scrolls into view. */
export const Thumb: React.FC<{ id?: string; size?: number; className?: string; alt?: string }> = ({ id, size = 56, className = '', alt = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = thumbUrl(id, size > 120 ? 480 : 240);
  if (!src || failed)
    return (
      <div className={`thumb flex items-center justify-center text-[#aaaaaa] shrink-0 ${className}`} style={{ width: size, height: size }}>
        <ImageOff size={Math.max(14, size / 3)} />
      </div>
    );
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`thumb shrink-0 ${className}`} style={{ width: size, height: size }} />;
};

/** On-screen number pad (quantities, amounts). */
export const Numpad: React.FC<{ value: string; onChange: (v: string) => void; onDone?: () => void; decimals?: boolean; resetKey?: unknown }> = ({ value, onChange, onDone, decimals, resetKey }) => {
  // The first key replaces the number shown (tap 5 → 5, not 15); later keys add digits.
  const fresh = React.useRef(true);
  useEffect(() => {
    fresh.current = true;
  }, [resetKey]);
  // Very fast taps can arrive before the screen redraws, so work from the last value sent.
  const latest = React.useRef(value);
  latest.current = value;
  const send = (v: string) => {
    latest.current = v;
    onChange(v);
  };
  const press = (k: string) => {
    const first = fresh.current;
    fresh.current = false;
    const cur = latest.current;
    if (k === 'del') return send(first ? '' : cur.slice(0, -1));
    if (k === 'C') return send('');
    if (k === '.' && (!decimals || (!first && cur.includes('.')))) return;
    if (first) return send(k === '.' ? '0.' : k);
    send(cur === '0' && k !== '.' ? k : cur + k);
  };
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', decimals ? '.' : 'C', '0', 'del'];
  return (
    <div className="space-y-2">
      <div className="text-right text-[28px] font-bold tabular-nums border border-[#cccccc] rounded-[6px] px-3 py-1 min-h-[52px]">{value || '0'}</div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button key={k} type="button" className="btn text-[20px] min-h-[56px]! lg:min-h-[48px]!" onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>
            {k === 'del' ? <Delete size={20} /> : k}
          </button>
        ))}
      </div>
      {onDone && (
        <button type="button" className="btn btn-primary w-full min-h-[52px]!" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
};

/** Simple date range picker with quick choices. */
export const DateRange: React.FC<{ from: string; to: string; onChange: (from: string, to: string) => void; presets: [string, string, string][] }> = ({ from, to, onChange, presets }) => (
  <div className="flex flex-wrap items-end gap-2">
    <div className="flex gap-1 flex-wrap">
      {presets.map(([label, f, t]) => (
        <button key={label} type="button" className={`btn ${f === from && t === to ? 'btn-primary' : ''}`} onClick={() => onChange(f, t)}>
          {label}
        </button>
      ))}
    </div>
    <label className="flex items-center gap-1 text-[13px]">
      From
      <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="w-[150px]!" />
    </label>
    <label className="flex items-center gap-1 text-[13px]">
      To
      <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="w-[150px]!" />
    </label>
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-[#777777] py-8 text-center">{children}</p>;
