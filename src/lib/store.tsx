import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  AppState,
  CartLine,
  Customer,
  ID,
  InventoryItem,
  LedgerEntry,
  PayMethod,
  ReturnRecord,
  Sale,
  SaleItem,
} from "./types";
import { buildSeedState } from "./seed";
import { round2, uid } from "./format";

const LS_KEY = "amarpharmacy:v1";

type Action =
  | { type: "SWITCH_PHARMACY"; id: ID }
  | { type: "APPLY_SALE"; sale: Sale; customer: Customer | null; ledger: LedgerEntry | null; cashDelta: number }
  | {
      type: "APPLY_RETURN";
      record: ReturnRecord;
      saleId: ID;
      itemId: ID;
      qty: number;
      restockInvId: ID;
      ledger: LedgerEntry | null;
      cashDelta: number;
    }
  | { type: "ADD_INVENTORY"; row: InventoryItem }
  | { type: "UPDATE_INVENTORY"; id: ID; patch: Partial<InventoryItem>; addPieces: number }
  | { type: "REPAY"; entry: LedgerEntry; cashDelta: number }
  | { type: "RESET" };

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "SWITCH_PHARMACY":
      return { ...state, activePharmacyId: a.id };

    case "APPLY_SALE": {
      const pid = state.activePharmacyId;
      const soldQty: Record<string, number> = {};
      a.sale.items.forEach((it) => {
        soldQty[it.inventory_id] = (soldQty[it.inventory_id] ?? 0) + it.qty_pieces;
      });
      return {
        ...state,
        inventory: state.inventory.map((r) =>
          r.pharmacy_id === pid && soldQty[r.id]
            ? { ...r, total_pieces: Math.max(0, r.total_pieces - soldQty[r.id]), updated_at: new Date().toISOString() }
            : r
        ),
        customers: a.customer && !state.customers.some((c) => c.id === a.customer!.id)
          ? [...state.customers, a.customer]
          : state.customers,
        sales: [...state.sales, a.sale],
        ledger: a.ledger ? [...state.ledger, a.ledger] : state.ledger,
        cashDrawer: { ...state.cashDrawer, [pid]: round2((state.cashDrawer[pid] ?? 0) + a.cashDelta) },
        invoiceCounter: { ...state.invoiceCounter, [pid]: (state.invoiceCounter[pid] ?? 1) + 1 },
      };
    }

    case "APPLY_RETURN": {
      const pid = state.activePharmacyId;
      return {
        ...state,
        sales: state.sales.map((s) => {
          if (s.id !== a.saleId) return s;
          const items = s.items.map((it) =>
            it.id === a.itemId ? { ...it, returned_qty: Math.min(it.qty_pieces, it.returned_qty + a.qty) } : it
          );
          const allBack = items.every((it) => it.returned_qty >= it.qty_pieces);
          const someBack = items.some((it) => it.returned_qty > 0);
          const refundedItem = s.items.find((it) => it.id === a.itemId)!;
          const profitLoss = round2(a.qty * (refundedItem.unit_price - refundedItem.buying_price));
          return {
            ...s,
            items,
            status: allBack ? ("Returned" as const) : someBack ? ("Partially_Returned" as const) : s.status,
            profit: round2(s.profit - profitLoss),
          };
        }),
        inventory: state.inventory.map((r) =>
          r.id === a.restockInvId && r.pharmacy_id === pid
            ? { ...r, total_pieces: r.total_pieces + a.qty, updated_at: new Date().toISOString() }
            : r
        ),
        returns: [...state.returns, a.record],
        ledger: a.ledger ? [...state.ledger, a.ledger] : state.ledger,
        cashDrawer: { ...state.cashDrawer, [pid]: round2((state.cashDrawer[pid] ?? 0) + a.cashDelta) },
      };
    }

    case "ADD_INVENTORY":
      return { ...state, inventory: [a.row, ...state.inventory] };

    case "UPDATE_INVENTORY":
      return {
        ...state,
        inventory: state.inventory.map((r) =>
          r.id === a.id && r.pharmacy_id === state.activePharmacyId
            ? {
                ...r,
                ...a.patch,
                total_pieces: Math.max(0, (a.patch.total_pieces ?? r.total_pieces) + a.addPieces),
                updated_at: new Date().toISOString(),
              }
            : r
        ),
      };

    case "REPAY": {
      const pid = state.activePharmacyId;
      return {
        ...state,
        ledger: [...state.ledger, a.entry],
        cashDrawer: { ...state.cashDrawer, [pid]: round2((state.cashDrawer[pid] ?? 0) + a.cashDelta) },
      };
    }

    case "RESET":
      return buildSeedState();

    default:
      return state;
  }
}

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.seededAt && Array.isArray(parsed.sales)) return parsed;
    }
  } catch {
    /* fall through to reseed */
  }
  return buildSeedState();
}

export interface CompleteSalePayload {
  lines: CartLine[];
  discount: number;
  paid: number;
  method: PayMethod;
  customerName: string;
  customerPhone: string;
  cashier: string;
}

export interface StoreApi {
  switchPharmacy: (id: ID) => void;
  completeSale: (p: CompleteSalePayload) => Sale | null;
  processReturn: (saleId: ID, itemId: ID, qty: number, mode: "cash" | "baki_offset") => { refund: number; cashPart: number; offsetPart: number } | null;
  addCustomMedicine: (data: Omit<InventoryItem, "id" | "pharmacy_id" | "master_medicine_id" | "is_custom" | "updated_at">, linkMasterId?: ID | null) => InventoryItem;
  updateInventoryRow: (id: ID, patch: Partial<InventoryItem>, addPieces: number) => void;
  recordRepayment: (customerId: ID, amount: number, method: PayMethod, note: string) => void;
  resetDemo: () => void;
}

const StateCtx = createContext<AppState | null>(null);
const ApiCtx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage full / private mode — app still works in-memory */
    }
  }, [state]);

  const api = useMemo<StoreApi>(() => {
    return {
      switchPharmacy(id) {
        dispatch({ type: "SWITCH_PHARMACY", id });
      },

      completeSale(p) {
        const s = ref.current;
        const pid = s.activePharmacyId;
        const rows = p.lines
          .map((l) => ({ line: l, inv: s.inventory.find((r) => r.id === l.inventory_id && r.pharmacy_id === pid) }))
          .filter((x): x is { line: CartLine; inv: InventoryItem } => Boolean(x.inv));
        if (rows.length === 0) return null;

        const saleId = uid();
        const counter = s.invoiceCounter[pid] ?? 1;
        const code = s.pharmacies.find((x) => x.id === pid)?.code ?? "AP";
        let subtotal = 0;
        let profit = 0;
        const items: SaleItem[] = rows.map(({ line, inv }, i) => {
          const qty = Math.min(line.qty, inv.total_pieces);
          const lineTotal = round2(qty * inv.selling_price);
          const pr = round2(qty * (inv.selling_price - inv.buying_price));
          subtotal = round2(subtotal + lineTotal);
          profit = round2(profit + pr);
          return {
            id: `${saleId}-i${i}`,
            sale_id: saleId,
            pharmacy_id: pid,
            inventory_id: inv.id,
            medicine_name: inv.brand_name,
            strength: inv.strength,
            form: inv.form,
            rack: inv.rack,
            qty_pieces: qty,
            unit_price: inv.selling_price,
            buying_price: inv.buying_price,
            line_total: lineTotal,
            profit: pr,
            returned_qty: 0,
          };
        });

        const discount = round2(Math.min(p.discount, subtotal));
        const total = round2(subtotal - discount);
        profit = round2(profit - discount);
        const received = round2(Math.max(0, p.paid)); // actual cash handed over (for change)
        const paid = round2(Math.min(received, total)); // amount applied to the invoice
        const due = round2(total - paid);

        let customer: Customer | null = null;
        if (p.customerPhone.trim()) {
          customer = s.customers.find((c) => c.pharmacy_id === pid && c.phone === p.customerPhone.trim()) ?? null;
          if (!customer) {
            customer = {
              id: uid(),
              pharmacy_id: pid,
              name: p.customerName.trim() || `Customer ·${p.customerPhone.trim().slice(-4)}`,
              phone: p.customerPhone.trim(),
              area: "—",
              created_at: new Date().toISOString(),
            };
          }
        } else if (due > 0) {
          customer = {
            id: uid(),
            pharmacy_id: pid,
            name: p.customerName.trim() || "Walk-in (baki)",
            phone: `01${String(Math.floor(3e8 + Math.random() * 6e8))}`,
            area: "—",
            created_at: new Date().toISOString(),
          };
        }

        let ledger: LedgerEntry | null = null;
        if (due > 0 && customer) {
          ledger = {
            id: uid(),
            pharmacy_id: pid,
            customer_id: customer.id,
            type: "sale_due",
            amount: due,
            sale_id: saleId,
            note: `Baki from invoice AP-${code}-${String(counter).padStart(5, "0")}`,
            created_at: new Date().toISOString(),
          };
        }

        const sale: Sale = {
          id: saleId,
          invoice_no: `AP-${code}-${String(counter).padStart(5, "0")}`,
          pharmacy_id: pid,
          customer_id: customer?.id ?? null,
          customer_name: customer?.name ?? "Walk-in Customer",
          customer_phone: customer?.phone ?? "",
          items,
          subtotal,
          discount,
          total,
          paid_amount: received,
          due_amount: due,
          payment_method: p.method,
          profit,
          status: "Completed",
          cashier: p.cashier,
          created_at: new Date().toISOString(),
        };

        dispatch({
          type: "APPLY_SALE",
          sale,
          customer,
          ledger,
          cashDelta: p.method === "Cash" ? paid : 0,
        });
        return sale;
      },

      processReturn(saleId, itemId, qty, mode) {
        const s = ref.current;
        const pid = s.activePharmacyId;
        const sale = s.sales.find((x) => x.id === saleId && x.pharmacy_id === pid);
        const item = sale?.items.find((i) => i.id === itemId);
        if (!sale || !item) return null;
        const maxQty = item.qty_pieces - item.returned_qty;
        const q = Math.max(1, Math.min(qty, maxQty));
        const refund = round2((item.line_total / item.qty_pieces) * q);

        let cashPart = refund;
        let offsetPart = 0;
        let ledger: LedgerEntry | null = null;
        if (mode === "baki_offset" && sale.customer_id) {
          const dueNow = customerDue(s, sale.customer_id);
          offsetPart = round2(Math.min(refund, dueNow));
          cashPart = round2(refund - offsetPart);
          if (offsetPart > 0) {
            ledger = {
              id: uid(),
              pharmacy_id: pid,
              customer_id: sale.customer_id,
              type: "return_offset",
              amount: offsetPart,
              sale_id: saleId,
              note: `Return on ${sale.invoice_no} adjusted against baki`,
              created_at: new Date().toISOString(),
            };
          }
        }

        const record: ReturnRecord = {
          id: uid(),
          pharmacy_id: pid,
          original_sale_id: saleId,
          invoice_no: sale.invoice_no,
          items: [{ sale_item_id: itemId, medicine_name: item.medicine_name, qty: q, refund }],
          total_refund_amount: refund,
          refund_mode: offsetPart > 0 && cashPart > 0 ? "mixed" : offsetPart > 0 ? "baki_offset" : "cash",
          created_at: new Date().toISOString(),
        };

        dispatch({
          type: "APPLY_RETURN",
          record,
          saleId,
          itemId,
          qty: q,
          restockInvId: item.inventory_id,
          ledger,
          cashDelta: -cashPart,
        });
        return { refund, cashPart, offsetPart };
      },

      addCustomMedicine(data, linkMasterId = null) {
        const pid = ref.current.activePharmacyId;
        const row: InventoryItem = {
          ...data,
          id: uid(),
          pharmacy_id: pid,
          master_medicine_id: linkMasterId,
          is_custom: linkMasterId ? false : true,
          updated_at: new Date().toISOString(),
        };
        dispatch({ type: "ADD_INVENTORY", row });
        return row;
      },

      updateInventoryRow(id, patch, addPieces) {
        dispatch({ type: "UPDATE_INVENTORY", id, patch, addPieces });
      },

      recordRepayment(customerId, amount, method, note) {
        const pid = ref.current.activePharmacyId;
        const entry: LedgerEntry = {
          id: uid(),
          pharmacy_id: pid,
          customer_id: customerId,
          type: "repayment",
          amount: round2(amount),
          sale_id: null,
          note,
          created_at: new Date().toISOString(),
        };
        dispatch({ type: "REPAY", entry, cashDelta: method === "Cash" ? round2(amount) : 0 });
      },

      resetDemo() {
        localStorage.removeItem(LS_KEY);
        dispatch({ type: "RESET" });
      },
    };
  }, []);

  return (
    <StateCtx.Provider value={state}>
      <ApiCtx.Provider value={api}>{children}</ApiCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useStore(): AppState {
  const s = useContext(StateCtx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
export function useApi(): StoreApi {
  const a = useContext(ApiCtx);
  if (!a) throw new Error("StoreProvider missing");
  return a;
}

/* ---------- selectors (all scoped to the active tenant) ---------- */

export const pharmacyInv = (s: AppState) => s.inventory.filter((r) => r.pharmacy_id === s.activePharmacyId);
export const pharmacySales = (s: AppState) => s.sales.filter((x) => x.pharmacy_id === s.activePharmacyId);
export const pharmacyReturns = (s: AppState) => s.returns.filter((x) => x.pharmacy_id === s.activePharmacyId);
export const pharmacyCustomers = (s: AppState) => s.customers.filter((c) => c.pharmacy_id === s.activePharmacyId);

export function customerDue(s: AppState, customerId: ID): number {
  let due = 0;
  s.ledger.forEach((l) => {
    if (l.customer_id !== customerId || l.pharmacy_id !== s.activePharmacyId) return;
    due += l.type === "sale_due" ? l.amount : -l.amount;
  });
  return round2(Math.max(0, due));
}

export const customerLedger = (s: AppState, customerId: ID) =>
  s.ledger
    .filter((l) => l.customer_id === customerId && l.pharmacy_id === s.activePharmacyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

export const expiringItems = (s: AppState, withinDays: number) => {
  const cutoff = Date.now() + withinDays * 86_400_000;
  return pharmacyInv(s)
    .filter((r) => new Date(r.expiry_date).getTime() <= cutoff)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
};

export const lowStockItems = (s: AppState) =>
  pharmacyInv(s)
    .filter((r) => r.total_pieces <= r.reorder_level)
    .sort((a, b) => a.total_pieces / Math.max(1, a.reorder_level) - b.total_pieces / Math.max(1, b.reorder_level));

export const outstandingBaki = (s: AppState): { total: number; debtors: number } => {
  let total = 0;
  let debtors = 0;
  pharmacyCustomers(s).forEach((c) => {
    const d = customerDue(s, c.id);
    if (d > 0) {
      total = round2(total + d);
      debtors++;
    }
  });
  return { total, debtors };
};
