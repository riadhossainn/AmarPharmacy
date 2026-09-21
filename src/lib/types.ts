export type ID = string;

export interface Pharmacy {
  id: ID;
  code: string;
  name: string;
  name_bn: string;
  address: string;
  phone: string;
}

/** Global reference table — pricing-agnostic, shared across all tenants. */
export interface MasterMedicine {
  id: ID;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  strength: string;
  form: string;
  rx: boolean;
  category: string;
}

/** Tenant-private inventory row. ALL pricing lives here, never in master. */
export interface InventoryItem {
  id: ID;
  pharmacy_id: ID;
  master_medicine_id: ID | null; // null ⇒ custom medicine, private to this pharmacy
  is_custom: boolean;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  strength: string;
  form: string;
  rack: string;
  row: string;
  pieces_per_box: number;
  total_pieces: number; // raw piece count — fractional box splitting works on this
  reorder_level: number;
  buying_price: number; // per piece
  selling_price: number; // per piece (MRP)
  batch_no: string;
  expiry_date: string; // ISO date
  updated_at: string;
}

export interface Customer {
  id: ID;
  pharmacy_id: ID;
  name: string;
  phone: string;
  area: string;
  created_at: string;
}

export type LedgerType = "sale_due" | "repayment" | "return_offset";

export interface LedgerEntry {
  id: ID;
  pharmacy_id: ID;
  customer_id: ID;
  type: LedgerType;
  amount: number; // sale_due adds, repayment / return_offset subtract
  sale_id: ID | null;
  note: string;
  created_at: string;
}

export interface SaleItem {
  id: ID;
  sale_id: ID;
  pharmacy_id: ID;
  inventory_id: ID;
  medicine_name: string;
  strength: string;
  form: string;
  rack: string;
  qty_pieces: number;
  unit_price: number;
  buying_price: number;
  line_total: number;
  profit: number;
  returned_qty: number;
}

export type SaleStatus = "Completed" | "Returned" | "Partially_Returned";
export type PayMethod = "Cash" | "bKash" | "Nagad" | "Card";

export interface Sale {
  id: ID;
  invoice_no: string;
  pharmacy_id: ID;
  customer_id: ID | null;
  customer_name: string;
  customer_phone: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  payment_method: PayMethod;
  profit: number;
  status: SaleStatus;
  cashier: string;
  created_at: string;
}

export interface ReturnItem {
  sale_item_id: ID;
  medicine_name: string;
  qty: number;
  refund: number;
}

export interface ReturnRecord {
  id: ID;
  pharmacy_id: ID;
  original_sale_id: ID;
  invoice_no: string;
  items: ReturnItem[];
  total_refund_amount: number;
  refund_mode: "cash" | "baki_offset" | "mixed";
  created_at: string;
}

export interface AppState {
  pharmacies: Pharmacy[];
  activePharmacyId: ID;
  masterMedicines: MasterMedicine[];
  inventory: InventoryItem[];
  customers: Customer[];
  sales: Sale[];
  returns: ReturnRecord[];
  ledger: LedgerEntry[];
  cashDrawer: Record<ID, number>;
  invoiceCounter: Record<ID, number>;
  seededAt: string;
}

export type Screen = "dashboard" | "pos" | "returns" | "inventory" | "customers";

export interface CartLine {
  inventory_id: ID;
  qty: number;
}
