let symbol = '$';
export const setCurrencySymbol = (s: string) => (symbol = s || '$');

export const money = (n: number) => {
  const neg = n < 0;
  const [i, d] = Math.abs(Math.round(n * 100) / 100)
    .toFixed(2)
    .split('.');
  return `${neg ? '-' : ''}${symbol}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${d}`;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const monthStart = () => today().slice(0, 8) + '01';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
};
export const fmtWhen = (iso?: string) => {
  if (!iso) return 'never';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${fmtDate(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Short ids and document numbers that stay unique across phone and laptop without asking the server. */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const docNo = (prefix: string) => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
};
export const stamp = () => new Date().toISOString();
