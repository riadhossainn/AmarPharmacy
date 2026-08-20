import { useEffect, useMemo, useRef, useState } from "react";
import type { CartLine, InventoryItem, MasterMedicine, PayMethod, Sale } from "../lib/types";
import { customerDue, pharmacyInv, pharmacySales, useApi, useStore } from "../lib/store";
import { boxSplit, money, round2, tk } from "../lib/format";
import {
  IcAlert,
  IcBox,
  IcCheck,
  IcMinus,
  IcPill,
  IcPlus,
  IcPrint,
  IcSearch,
  IcTrash,
  Kbd,
  Modal,
  RackChip,
  useToast,
} from "../components/ui";
import { MedicineFormModal, inputCls, type MedicineFormData } from "../components/modals";
import Receipt from "../components/Receipt";

interface Hit {
  key: string;
  inv: InventoryItem | null;
  master: MasterMedicine | null;
}

const PAY_METHODS: { id: PayMethod; cls: string }[] = [
  { id: "Cash", cls: "bg-cross-600" },
  { id: "bKash", cls: "bg-bkash" },
  { id: "Nagad", cls: "bg-nagad" },
  { id: "Card", cls: "bg-pine-700" },
];

export default function POS() {
  const state = useStore();
  const api = useApi();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [phone, setPhone] = useState("");
  const [custName, setCustName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [stockMaster, setStockMaster] = useState<MasterMedicine | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [rcptWidth, setRcptWidth] = useState<"58" | "80">("80");

  const searchRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* tenant switch ⇒ cart belongs to the other branch; wipe it (RLS isolation) */
  useEffect(() => {
    setCart([]);
    setPhone("");
    setCustName("");
    setDiscount(0);
    setQuery("");
    setReceipt(null);
  }, [state.activePharmacyId]);

  /* ---------- search across master + tenant inventory (measured) ---------- */
  const { hits, ms } = useMemo(() => {
    const t0 = performance.now();
    const q = query.trim().toLowerCase();
    let out: Hit[] = [];
    if (q) {
      const inv = pharmacyInv(state);
      const invMasters = new Set(inv.map((i) => i.master_medicine_id).filter(Boolean));
      const match = (s: string) => s.toLowerCase().includes(q);
      out = inv
        .filter((i) => match(i.brand_name) || match(i.generic_name) || match(i.manufacturer) || match(i.strength))
        .map((i) => ({ key: i.id, inv: i, master: null }));
      state.masterMedicines.forEach((m) => {
        if (!invMasters.has(m.id) && (match(m.brand_name) || match(m.generic_name) || match(m.manufacturer) || match(m.strength)))
          out.push({ key: m.id, inv: null, master: m });
      });
      out = out.slice(0, 40);
    }
    return { hits: out, ms: Math.max(0.4, performance.now() - t0) };
  }, [query, state]);

  useEffect(() => setHi(0), [query]);

  /* ---------- frequent sellers (empty-state quick add) ---------- */
  const frequent = useMemo(() => {
    const week = Date.now() - 7 * 86_400_000;
    const count = new Map<string, number>();
    pharmacySales(state).forEach((s) => {
      if (new Date(s.created_at).getTime() < week) return;
      s.items.forEach((it) => count.set(it.inventory_id, (count.get(it.inventory_id) ?? 0) + 1));
    });
    const inv = pharmacyInv(state);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => inv.find((r) => r.id === id))
      .filter(Boolean) as InventoryItem[];
  }, [state]);

  /* ---------- customer + baki lookup ---------- */
  const customer = useMemo(
    () => state.customers.find((c) => c.pharmacy_id === state.activePharmacyId && c.phone === phone.trim()) ?? null,
    [state, phone]
  );
  const dueNow = customer ? customerDue(state, customer.id) : 0;

  /* ---------- cart math ---------- */
  const cartRows = cart
    .map((l) => ({ line: l, inv: state.inventory.find((r) => r.id === l.inventory_id)! }))
    .filter((r) => r.inv && r.inv.pharmacy_id === state.activePharmacyId);
  const subtotal = round2(cartRows.reduce((a, r) => a + r.line.qty * r.inv.selling_price, 0));
  const total = round2(Math.max(0, subtotal - discount));
  const inCartQty = (invId: string) => cart.find((l) => l.inventory_id === invId)?.qty ?? 0;

  const addToCart = (inv: InventoryItem) => {
    if (inv.total_pieces <= 0) return toast("danger", `${inv.brand_name} is out of stock`, "Receive stock from the Inventory screen first.");
    if (inCartQty(inv.id) >= inv.total_pieces)
      return toast("warn", "No more stock available", `Only ${inv.total_pieces} pc of ${inv.brand_name} left in rack ${inv.rack}.`);
    setCart((c) => {
      const ex = c.find((l) => l.inventory_id === inv.id);
      return ex ? c.map((l) => (l.inventory_id === inv.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { inventory_id: inv.id, qty: 1 }];
    });
  };

  const addHit = (h: Hit) => {
    if (h.inv) addToCart(h.inv);
    else if (h.master) setStockMaster(h.master);
  };

  const setQty = (invId: string, qty: number) => {
    const inv = state.inventory.find((r) => r.id === invId)!;
    const q = Math.max(1, Math.min(qty || 1, inv.total_pieces));
    setCart((c) => c.map((l) => (l.inventory_id === invId ? { ...l, qty: q } : l)));
  };

  /* ---------- global keyboard: F2 focus, Enter → payment ---------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key !== "Enter") return;
      if (paymentOpen || receipt || customOpen || stockMaster) return;
      if (document.activeElement === searchRef.current || document.activeElement === searchBtnRef.current) return;
      if (cart.length > 0) {
        e.preventDefault();
        setPaymentOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paymentOpen, receipt, customOpen, stockMaster, cart]);

  const onCustomCreated = (d: MedicineFormData, masterId: string | null) => {
    const row = api.addCustomMedicine(d, masterId);
    if (masterId) {
      toast("success", `${row.brand_name} stocked in your shop`, `Prices saved privately — master catalogue untouched. Find it at rack ${row.rack}.`);
    } else {
      setCart((c) => [...c, { inventory_id: row.id, qty: Math.min(1, Math.max(1, row.total_pieces)) }]);
      toast("success", "Custom medicine added to your shop", `${row.brand_name} saved privately (is_custom) and dropped into the cart.`);
      searchRef.current?.focus();
    }
  };

  /* ================= payment state ================= */
  const [method, setMethod] = useState<PayMethod>("Cash");
  const [paidStr, setPaidStr] = useState("");
  const [payErr, setPayErr] = useState("");
  const paid = paidStr === "" ? total : Number(paidStr);
  const change = method === "Cash" ? round2(Math.max(0, paid - total)) : 0;
  const newDue = round2(Math.max(0, total - paid));

  const openPayment = () => {
    setPayErr("");
    setPaidStr("");
    setMethod("Cash");
    setPaymentOpen(true);
  };

  const confirmPayment = () => {
    if (cart.length === 0) return;
    if (newDue > 0 && !phone.trim()) {
      setPayErr("A customer phone number is required to record বাকি (due). Enter it in the customer field, then retry.");
      return;
    }
    if (Number.isNaN(paid) || paid < 0) {
      setPayErr("Paid amount is invalid.");
      return;
    }
    const sale = api.completeSale({
      lines: cart,
      discount,
      paid,
      method,
      customerName: customer?.name ?? custName,
      customerPhone: customer?.phone ?? phone,
      cashier: "Rafiq Hasan",
    });
    if (!sale) return;
    setPaymentOpen(false);
    setCart([]);
    setDiscount(0);
    setPhone("");
    setCustName("");
    setQuery("");
    setReceipt(sale);
    toast(
      "success",
      `Sale ${sale.invoice_no} completed — ${tk(sale.total)}`,
      sale.due_amount > 0 ? `${tk(sale.due_amount)} বাকি appended to the customer ledger.` : `Paid via ${sale.payment_method}. Receipt ready to print.`
    );
  };

  useEffect(() => {
    if (!paymentOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "BUTTON") return; // let the focused button's own click handle it
        e.preventDefault();
        confirmPayment();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOpen, cart, discount, paid, method, phone, customer, custName]);

  const activePh = state.pharmacies.find((p) => p.id === state.activePharmacyId)!;

  /* ================================================= render ================================================= */
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_400px] gap-4 p-4 overflow-hidden">
      {/* ================= left: search & catalogue ================= */}
      <section className="min-w-0 flex flex-col">
        <div className="relative">
          <IcSearch size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(hits.length - 1, h + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              } else if (e.key === "Enter" && hits.length > 0) {
                e.preventDefault();
                addHit(hits[Math.min(hi, hits.length - 1)]);
              }
            }}
            placeholder="Search brand, generic, manufacturer or strength…"
            className="w-full rounded-xl border-2 border-pine-900 bg-card pl-10 pr-4 py-3 text-[15px] font-medium text-ink-900 outline-none transition-shadow focus:border-cross-500 focus:shadow-[0_0_0_4px_rgba(47,190,131,0.15)] placeholder:text-ink-300"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <Kbd light>F2</Kbd>
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2 px-1 text-[10.5px] text-ink-400">
          <span className="num">
            {query ? `${hits.length} matches` : "21,438 master records"} · GIN text-search index ·{" "}
            <b className={ms < 100 ? "text-cross-600" : "text-danger-600"}>{ms.toFixed(1)}ms</b>
          </span>
          <span className="mx-1 text-line">|</span>
          <span className="flex items-center gap-1"><Kbd light>↑↓</Kbd> select</span>
          <span className="flex items-center gap-1"><Kbd light>Enter</Kbd> add to cart</span>
        </div>

        <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto scroll-slim rounded-xl border border-line bg-card">
          {query.trim() === "" && (
            <div className="p-4">
              <div className="label-caps mb-2.5">Frequent this week — tap or search to add</div>
              <div className="grid grid-cols-2 gap-2">
                {frequent.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => addToCart(inv)}
                    disabled={inv.total_pieces <= 0}
                    className="group flex items-center gap-2.5 rounded-lg border border-line bg-paper/60 px-3 py-2.5 text-left hover:border-cross-500 hover:bg-cross-50 active:scale-[0.98] transition-all disabled:opacity-45"
                  >
                    <span className="w-8 h-8 rounded-lg bg-pine-900 text-cross-400 flex items-center justify-center shrink-0 group-hover:bg-cross-600 group-hover:text-white transition-colors">
                      <IcPill size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink-900 truncate">{inv.brand_name}</span>
                      <span className="block text-[10.5px] text-ink-400 num">
                        {tk(inv.selling_price)}/pc · {inv.total_pieces} pc left
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() !== "" && hits.length === 0 && (
            <div className="p-8 text-center anim-slide-in">
              <div className="mx-auto w-12 h-12 rounded-xl bg-danger-50 text-danger-600 flex items-center justify-center mb-3">
                <IcAlert size={22} />
              </div>
              <p className="text-[14px] font-semibold text-ink-900">
                0 results for “{query}” in the master catalogue
              </p>
              <p className="text-[12px] text-ink-400 mt-1 max-w-[380px] mx-auto">
                This medicine isn't in the shared 21,438-record reference list. Add it as a private item for your shop —
                it stays visible only to <b>{activePh.name}</b>.
              </p>
              <button
                ref={searchBtnRef}
                onClick={() => setCustomOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-pine-900 text-white px-4 py-2.5 text-[13px] font-semibold hover:bg-pine-800 active:scale-[0.98] transition-all shadow-[0_8px_20px_-8px_rgba(10,43,33,0.6)]"
              >
                <IcPlus size={15} className="text-cross-400" /> Add Custom Medicine to Your Shop
              </button>
            </div>
          )}

          {hits.length > 0 && (
            <ul className="divide-y divide-linesoft">
              {hits.map((h, i) => {
                const name = h.inv?.brand_name ?? h.master!.brand_name;
                const generic = h.inv?.generic_name ?? h.master!.generic_name;
                const mfr = h.inv?.manufacturer ?? h.master!.manufacturer;
                const strength = h.inv?.strength ?? h.master!.strength;
                const active = i === hi;
                const out = h.inv !== null && h.inv.total_pieces <= 0;
                return (
                  <li key={h.key}>
                    <button
                      onMouseEnter={() => setHi(i)}
                      onClick={() => addHit(h)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                        active ? "bg-cross-50 shadow-[inset_3px_0_0_0_var(--color-cross-500)]" : "hover:bg-paper"
                      } ${out ? "opacity-55" : ""}`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${h.inv ? "bg-pine-900 text-cross-400" : "bg-paper text-ink-400 border border-line"}`}>
                        <IcPill size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-ink-900 truncate">{name}</span>
                          <span className="text-[11px] text-ink-400 num">{strength}</span>
                          {h.inv?.is_custom && (
                            <span className="text-[9px] font-bold tracking-wide text-pine-700 bg-cross-100 rounded px-1.5 py-px">CUSTOM · PRIVATE</span>
                          )}
                        </span>
                        <span className="block text-[11px] text-ink-400 truncate">
                          {generic} · {mfr} · {h.inv?.form ?? h.master!.form}
                        </span>
                      </span>
                      {h.inv ? (
                        <>
                          <span className="text-right shrink-0">
                            <span className="block num text-[13px] font-bold text-ink-900">{tk(h.inv.selling_price)}</span>
                            <span className={`block text-[10px] num ${out ? "text-danger-600 font-semibold" : "text-ink-400"}`}>
                              {out ? "out of stock" : `${boxSplit(h.inv.total_pieces, h.inv.pieces_per_box)} left`}
                            </span>
                          </span>
                          <RackChip rack={h.inv.rack} row={h.inv.row} />
                        </>
                      ) : (
                        <span className="shrink-0 text-[10.5px] font-semibold text-warn-700 bg-warn-100 border border-warn-200 rounded-md px-2 py-1">
                          In master · not in your stock
                        </span>
                      )}
                      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${active ? "bg-cross-600 text-white" : "bg-paper text-ink-400 border border-line"}`}>
                        {h.inv ? <IcPlus size={14} /> : <IcBox size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ================= right: cart ================= */}
      <section className="min-w-0 flex flex-col rounded-xl border border-line bg-card overflow-hidden">
        {/* customer + baki alert */}
        <div className="px-3.5 pt-3.5 pb-3 border-b border-linesoft bg-paper/50">
          <div className="label-caps mb-1.5">Customer · baki check</div>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone — e.g. 01712345678"
              className={`${inputCls} num flex-1`}
            />
            <input
              value={customer?.name ?? custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder={customer ? "" : "Name (optional)"}
              disabled={!!customer}
              className={`${inputCls} w-[120px] disabled:bg-paper disabled:text-ink-400`}
            />
          </div>
          {customer && (
            <div className="mt-2 flex items-center gap-2 anim-slide-in">
              <span className="text-[12px] text-ink-700">
                <b>{customer.name}</b> · {customer.area}
              </span>
              {dueNow > 0 ? (
                <span className="flash-due inline-flex items-center gap-1.5 rounded-md bg-warn-100 border border-warn-200 px-2 py-1 text-[11px] font-bold text-warn-700">
                  <IcAlert size={12} /> বাকি DUE {tk(dueNow)} — previous baki on this number!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-cross-50 border border-cross-200 px-2 py-1 text-[11px] font-semibold text-cross-700">
                  <IcCheck size={12} /> clear — no pending due
                </span>
              )}
            </div>
          )}
          {!customer && phone.trim().length >= 11 && (
            <p className="mt-1.5 text-[11px] text-ink-400 anim-slide-in">New customer — profile will be created on sale.</p>
          )}
        </div>

        {/* cart lines */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-slim">
          {cartRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 border-2 border-dashed border-line rounded-lg m-3">
              <IcSearch size={26} className="text-ink-300 mb-2" />
              <p className="text-[13px] font-semibold text-ink-500">Cart is empty</p>
              <p className="text-[11.5px] text-ink-400 mt-1 leading-relaxed">
                Press <Kbd light>F2</Kbd> and type a medicine name.<br />Rack locations appear here for fast picking.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-linesoft">
              {cartRows.map(({ line, inv }, i) => (
                <li key={inv.id} className="px-3.5 py-2.5 anim-slide-in" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink-900 truncate">{inv.brand_name}</span>
                        <span className="text-[10.5px] num text-ink-400">{inv.strength}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <RackChip rack={inv.rack} row={inv.row} />
                        <span className="text-[10px] num text-ink-400">
                          {tk(inv.selling_price)}/pc · {inv.pieces_per_box > 1 ? `${inv.pieces_per_box} pc/box` : "single unit"}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setCart((c) => c.filter((l) => l.inventory_id !== inv.id))} className="p-1 rounded text-ink-300 hover:text-danger-600 hover:bg-danger-50 transition-colors" aria-label="Remove">
                      <IcTrash size={14} />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(inv.id, line.qty - 1)} className="w-6 h-6 rounded-md border border-line bg-paper text-ink-500 hover:border-cross-500 hover:text-cross-600 flex items-center justify-center active:scale-90 transition-all">
                        <IcMinus size={12} />
                      </button>
                      <input
                        value={line.qty}
                        onChange={(e) => setQty(inv.id, Number(e.target.value))}
                        className="w-[52px] text-center num text-[13px] font-bold rounded-md border border-line bg-white py-0.5 outline-none focus:border-cross-500"
                      />
                      <button onClick={() => setQty(inv.id, line.qty + 1)} className="w-6 h-6 rounded-md border border-line bg-paper text-ink-500 hover:border-cross-500 hover:text-cross-600 flex items-center justify-center active:scale-90 transition-all">
                        <IcPlus size={12} />
                      </button>
                      <span className="ml-1.5 text-[10.5px] text-ink-400 num">
                        pc {inv.pieces_per_box > 1 && line.qty >= inv.pieces_per_box && <span className="text-cross-600 font-semibold">= {boxSplit(line.qty, inv.pieces_per_box)}</span>}
                      </span>
                    </div>
                    <span className="num text-[13.5px] font-bold text-ink-900">{tk(round2(line.qty * inv.selling_price))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* totals */}
        <div className="border-t border-line px-3.5 py-3 bg-paper/50">
          <div className="flex justify-between text-[12.5px] text-ink-500">
            <span>Subtotal</span>
            <span className="num">{tk(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-[12.5px] text-ink-500 mt-1">
            <span className="flex items-center gap-2">
              Discount
              <input
                type="number"
                min={0}
                value={discount || ""}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-[70px] num text-[12px] rounded-md border border-line bg-white px-2 py-0.5 outline-none focus:border-cross-500"
              />
            </span>
            <span className="num text-danger-600">-{tk(discount)}</span>
          </div>
          <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-dashed border-line">
            <span className="font-display font-bold text-[14px]">Total</span>
            <span className="num text-[22px] font-bold text-ink-900 tracking-tight">{tk(total)}</span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className="mt-3 w-full rounded-lg bg-cross-600 text-white py-3 text-[14px] font-bold font-display tracking-wide hover:bg-cross-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-[0_10px_24px_-8px_rgba(14,143,91,0.55)] flex items-center justify-center gap-2"
          >
            Take Payment <Kbd>Enter</Kbd>
          </button>
        </div>
      </section>

      {/* ================= payment modal ================= */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Take Payment"
        subtitle={`${cart.length} item lines · ${cartRows.reduce((a, r) => a + r.line.qty, 0)} pieces total`}
        width="max-w-md"
      >
        <div className="p-5">
          <div className="rounded-xl bg-pine-900 text-white px-4 py-3.5 flex items-baseline justify-between sidebar-texture">
            <span className="text-[12px] text-pine-100 font-medium">Amount due now</span>
            <span className="num text-[28px] font-bold tracking-tight">{tk(total)}</span>
          </div>

          <div className="label-caps mt-4 mb-1.5">Payment method</div>
          <div className="grid grid-cols-4 gap-2">
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`rounded-lg border px-2 py-2.5 text-[12px] font-bold transition-all ${
                  method === m.id ? `${m.cls} text-white border-transparent shadow-md scale-[1.03]` : "border-line bg-white text-ink-500 hover:border-ink-300"
                }`}
              >
                {m.id}
              </button>
            ))}
          </div>

          <div className="label-caps mt-4 mb-1.5">Received amount (৳)</div>
          <input
            type="number"
            min={0}
            value={paidStr}
            placeholder={String(total)}
            onChange={(e) => setPaidStr(e.target.value)}
            className={`${inputCls} num text-[18px] py-2.5 font-bold`}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            {[total, 100, 500, 1000].map((v, i) => (
              <button key={i} onClick={() => setPaidStr(String(i === 0 ? total : v))} className="flex-1 rounded-md border border-line bg-paper py-1.5 text-[11.5px] num font-semibold text-ink-700 hover:border-cross-500 hover:text-cross-600 transition-colors">
                {i === 0 ? "Exact" : tk(v)}
              </button>
            ))}
          </div>

          <div className="mt-3.5 space-y-1.5 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[12.5px]">
            {change > 0 && (
              <div className="flex justify-between text-cross-700 font-semibold">
                <span>Change to return</span>
                <span className="num">{tk(change)}</span>
              </div>
            )}
            {newDue > 0 && (
              <div className="flex justify-between text-warn-700 font-bold">
                <span className="flex items-center gap-1.5"><IcAlert size={13} /> Goes to বাকি (customer ledger)</span>
                <span className="num">{tk(newDue)}</span>
              </div>
            )}
            {newDue === 0 && change === 0 && (
              <div className="flex justify-between text-ink-500">
                <span>Settled in full</span>
                <IcCheck size={14} className="text-cross-600" />
              </div>
            )}
          </div>

          {payErr && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 px-3 py-2.5 text-[12px] font-medium anim-slide-in">
              <IcAlert size={14} className="mt-px shrink-0" /> {payErr}
            </div>
          )}

          <button
            onClick={confirmPayment}
            className="mt-4 w-full rounded-lg bg-cross-600 text-white py-2.5 text-[13.5px] font-bold font-display hover:bg-cross-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            Complete Sale & Print <Kbd>Enter</Kbd>
          </button>
        </div>
      </Modal>

      {/* ================= receipt modal ================= */}
      <Modal
        open={!!receipt}
        onClose={() => {
          setReceipt(null);
          searchRef.current?.focus();
        }}
        title={receipt ? `Receipt — ${receipt.invoice_no}` : ""}
        subtitle="Thermal-roll preview · system print dialog outputs only the receipt"
        width="max-w-[420px]"
      >
        {receipt && (
          <div className="p-5">
            <div className="flex items-center justify-center gap-2 mb-4 no-print">
              {(["58", "80"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setRcptWidth(w)}
                  className={`rounded-md px-3 py-1.5 text-[12px] num font-bold border transition-all ${
                    rcptWidth === w ? "bg-pine-900 text-white border-transparent" : "border-line bg-white text-ink-500 hover:border-ink-300"
                  }`}
                >
                  {w}mm roll
                </button>
              ))}
            </div>
            <div className="flex justify-center rounded-lg bg-ink-900/6 p-4 hazard-stripes">
              <div className="shadow-[0_14px_34px_-12px_rgba(5,29,22,0.55)]">
                <Receipt sale={receipt} pharmacy={activePh} width={rcptWidth} />
              </div>
            </div>
            <div className="mt-4 flex gap-2.5 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-lg bg-pine-900 text-white py-2.5 text-[13px] font-bold font-display hover:bg-pine-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <IcPrint size={16} className="text-cross-400" /> Print Receipt
              </button>
              <button
                onClick={() => {
                  setReceipt(null);
                  searchRef.current?.focus();
                }}
                className="flex-1 rounded-lg border border-line bg-white py-2.5 text-[13px] font-bold text-ink-700 hover:border-cross-500 hover:text-cross-600 transition-colors"
              >
                Next Customer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= custom medicine / stock modals ================= */}
      <MedicineFormModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        heading="Add Custom Medicine to Your Shop"
        sub="0 master matches — this creates a private inventory row (master_medicine_id = NULL, is_custom = true)"
        submitLabel="Save & Add to Cart"
        onSubmit={(d) => onCustomCreated(d, null)}
      />
      <MedicineFormModal
        open={!!stockMaster}
        onClose={() => setStockMaster(null)}
        heading={`Stock item — ${stockMaster?.brand_name ?? ""}`}
        sub="Master data linked · prices & batch stay private to this pharmacy"
        lockIdentity
        preset={
          stockMaster
            ? {
                brand_name: stockMaster.brand_name,
                generic_name: stockMaster.generic_name,
                manufacturer: stockMaster.manufacturer,
                strength: stockMaster.strength,
                form: stockMaster.form,
                pieces_per_box: stockMaster.form === "Tablet" || stockMaster.form === "Capsule" ? 30 : 1,
              }
            : undefined
        }
        submitLabel="Add to My Inventory"
        onSubmit={(d) => stockMaster && onCustomCreated(d, stockMaster.id)}
      />

    </div>
  );
}
