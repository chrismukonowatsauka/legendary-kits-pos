import { saveFile } from './files';
import type { Conn } from './backend';
import { fullImage } from './images';
import type { Patch, Product, SupplierLine } from './types';
import { supplierLineTotal } from './ledger';
import { today } from './format';

/** The Excel library is large, so it only loads when an export is tapped. */
const lib = () => import('exceljs').then((m) => (m as unknown as { default: typeof import('exceljs') }).default || m);

export interface ExportColumn<T> {
  header: string;
  value: (r: T) => string | number | null | undefined;
  /** Money columns get a number format with 2 decimals. */
  money?: boolean;
  width?: number;
}

/** Any list on screen to Excel: exactly the rows and columns shown. */
export async function exportList<T>(name: string, columns: ExportColumn<T>[], rows: T[]) {
  const ExcelJS = await lib();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width || Math.min(40, Math.max(10, c.header.length + 4)) }));
  rows.forEach((r) => ws.addRow(columns.map((c) => c.value(r) ?? '')));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  columns.forEach((c, i) => c.money && (ws.getColumn(i + 1).numFmt = '#,##0.00'));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  await saveFile(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}-${today()}.xlsx`);
}

/** Pictures go into Excel as JPEG or PNG; anything else (WebP, HEIC…) is converted at full size. */
async function toExcelImage(dataUrl: string): Promise<{ base64: string; extension: 'jpeg' | 'png' }> {
  const m = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,(.*)$/);
  if (m) return { base64: m[2], extension: m[1] === 'png' ? 'png' : 'jpeg' };
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  return { base64: c.toDataURL('image/jpeg', 0.92).split(',')[1], extension: 'jpeg' };
}

/**
 * The supplier sheet: Kit Picture | Kit Name | Patch Picture | Patch Cost | Description (version) | Size |
 * Name | Number | Quantity | Unit Cost | Total Cost, with the full-quality pictures embedded in the cells.
 * Total Cost = Quantity × (Unit Cost + Patch Cost).
 */
export async function exportSupplierSheet(fileName: string, title: string, lines: SupplierLine[], products: Product[], patches: Patch[], conn: Conn, onProgress?: (msg: string) => void) {
  const ExcelJS = await lib();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Supplier order');
  const headers = ['Kit Picture', 'Kit Name', 'Patch Picture', 'Patch Cost', 'Description (version)', 'Size', 'Name', 'Number', 'Quantity', 'Unit Cost', 'Total Cost'];
  const widths = [18, 30, 14, 11, 22, 8, 16, 9, 10, 11, 12];
  ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
  ws.insertRow(1, [title]);
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getRow(1).font = { bold: true, size: 13 };
  const head = ws.getRow(2);
  head.font = { bold: true };
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  const imageIds = new Map<string, number>();
  const picture = async (id?: string) => {
    if (!id) return undefined;
    if (imageIds.has(id)) return imageIds.get(id);
    const data = await fullImage(id, conn);
    if (!data) return undefined;
    const img = await toExcelImage(data);
    const ref = wb.addImage(img);
    imageIds.set(id, ref);
    return ref;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    onProgress?.(`Adding pictures ${i + 1} of ${lines.length}…`);
    const p = products.find((x) => x.id === l.productId);
    const patch = l.patchId ? patches.find((x) => x.id === l.patchId) : undefined;
    const rowNo = i + 3;
    const row = ws.getRow(rowNo);
    row.values = ['', p?.name || '', '', l.patchCost || 0, l.version, l.size, l.printName, l.printNumber, l.qty, l.unitCost, { formula: `I${rowNo}*(J${rowNo}+D${rowNo})`, result: supplierLineTotal(l) }];
    row.height = 90;
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell({ includeEmpty: true }, (c) => (c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }));
    const kitImg = await picture(p?.imageId);
    if (kitImg !== undefined) ws.addImage(kitImg, { tl: { col: 0.08, row: rowNo - 1 + 0.05 }, ext: { width: 110, height: 112 }, editAs: 'oneCell' });
    const patchImg = await picture(patch?.imageId);
    if (patchImg !== undefined) ws.addImage(patchImg, { tl: { col: 2.1, row: rowNo - 1 + 0.2 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
    if (patch) ws.getCell(rowNo, 3).value = patch.name;
    ws.getCell(rowNo, 3).alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
  }
  const totalRow = lines.length + 3;
  ws.getRow(totalRow).values = ['', '', '', '', '', '', '', 'Total', { formula: `SUM(I3:I${totalRow - 1})`, result: lines.reduce((s, l) => s + l.qty, 0) }, '', { formula: `SUM(K3:K${totalRow - 1})`, result: lines.reduce((s, l) => s + supplierLineTotal(l), 0) }];
  ws.getRow(totalRow).font = { bold: true };
  ['D', 'J', 'K'].forEach((c) => (ws.getColumn(c).numFmt = '#,##0.00'));
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  onProgress?.('Saving the Excel file…');
  const buf = await wb.xlsx.writeBuffer();
  await saveFile(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileName}.xlsx`);
}
