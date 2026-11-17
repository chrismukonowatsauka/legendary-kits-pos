/** Every record shared with Google Sheets carries these. */
export interface Base {
  id: string;
  /** ISO time of the last change; the newer copy wins when phone and laptop both changed it. */
  updatedAt: string;
  deleted?: boolean;
}

export interface Product extends Base {
  name: string;
  /** Barcode or code typed/scanned at the till. */
  code: string;
  category: string;
  /** Selling price to the customer. */
  price: number;
  /** What the supplier charges (used on supplier orders). */
  cost: number;
  /** Sizes offered, e.g. ["S","M","L","XL"]. */
  sizes: string[];
  /** Google Drive file id of the full-quality picture. */
  imageId?: string;
  active: boolean;
}

export interface Patch extends Base {
  name: string;
  /** Charged to the customer per patch. */
  price: number;
  /** Supplier cost per patch. */
  cost: number;
  imageId?: string;
  active: boolean;
}

export type AccountType = 'cash' | 'bank' | 'mobile' | 'other';
export interface Account extends Base {
  name: string;
  type: AccountType;
  openingBalance: number;
  active: boolean;
}

export interface Customer extends Base {
  name: string;
  phone: string;
  notes?: string;
}

export interface SaleLine {
  productId: string;
  name: string;
  code: string;
  size?: string;
  qty: number;
  price: number;
}
export interface Sale extends Base {
  number: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  lines: SaleLine[];
  total: number;
  /** Paid now, into this account. */
  paid: number;
  accountId?: string;
  /** Left on the customer's account (account sale). */
  onAccount: number;
  customerId?: string;
  customerName?: string;
  status: 'completed' | 'voided';
  voidReason?: string;
  soldBy?: string;
}

/** Money received from a customer: against their account balance or as an order deposit. */
export interface Payment extends Base {
  number: string;
  date: string;
  customerId?: string;
  customerName?: string;
  orderId?: string;
  amount: number;
  accountId: string;
  note?: string;
}

export interface Expense extends Base {
  number: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  accountId: string;
}

export interface Transfer extends Base {
  number: string;
  date: string;
  fromId: string;
  toId: string;
  amount: number;
  note?: string;
}

export type OrderStatus = 'Open' | 'Ordered' | 'Received' | 'Delivered' | 'Cancelled';
export interface OrderLine {
  key: string;
  productId: string;
  version: string;
  size: string;
  printName: string;
  printNumber: string;
  patchId?: string;
  qty: number;
  /** Customer price per shirt, before the patch. */
  unitPrice: number;
  /** Customer price per patch at the time of the order. */
  patchPrice: number;
}
export interface SalesOrder extends Base {
  number: string;
  date: string;
  customerId?: string;
  customerName: string;
  phone: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  supplierOrderId?: string;
  notes?: string;
}

export interface SupplierLine {
  productId: string;
  version: string;
  size: string;
  printName: string;
  printNumber: string;
  patchId?: string;
  qty: number;
  unitCost: number;
  patchCost: number;
}
export interface SupplierOrder extends Base {
  number: string;
  date: string;
  supplier: string;
  orderIds: string[];
  lines: SupplierLine[];
  total: number;
  status: 'Ordered' | 'Received' | 'Cancelled';
}

export interface Tables {
  products: Product;
  patches: Patch;
  accounts: Account;
  customers: Customer;
  sales: Sale;
  payments: Payment;
  expenses: Expense;
  transfers: Transfer;
  salesOrders: SalesOrder;
  supplierOrders: SupplierOrder;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['products', 'patches', 'accounts', 'customers', 'sales', 'payments', 'expenses', 'transfers', 'salesOrders', 'supplierOrders'];
/** Tables that grow every day: only recent records load at first, older ones when you filter for them. */
export const HISTORY_TABLES: TableName[] = ['sales', 'payments', 'expenses', 'transfers'];

export interface Settings {
  shopName: string;
  currency: string;
  /** Apps Script web app address and its key (Setup step 3). Empty = this device only. */
  backendUrl: string;
  backendKey: string;
  versions: string[];
  expenseCategories: string[];
  seller: string;
}
