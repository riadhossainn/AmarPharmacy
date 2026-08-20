import { useMemo, useState } from "react";
import type { Sale, SaleItem } from "../lib/types";
import { customerDue, pharmacyReturns, pharmacySales, useApi, useStore } from "../lib/store";
import { fmtDate, fmtDateTime, fmtTime, tk } from "../lib/format";
import { IcAlert, IcCheck, IcMinus, IcPlus, IcReturn, IcSearch, Modal, RackChip, StatusChip, useToast } from "../components/ui";

interface PendingReturn {
  sale: Sale;
  item: SaleItem;
}

export default function Returns() {
  const state = useStore();
  const api = useApi();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReturn | null>(null);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"cash" | "baki_offset">("cash");

  const sales = useMemo(() => pharmacySales(state), [state]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...sales].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!q) return list.slice(0, 9);
    return list
      .filter(
        (s) =>
          s.invoice_no.toLowerCase().includes(q) ||
          (s.customer_phone && s.customer_phone.includes(q)) ||
          s.customer_name.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [sales, query]);

  const selected = sales.find((s) => s.id === selectedId) ?? null;
  const returns = useMemo(
    () => [...pharmacyReturns(state)].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [state]
  );

  const openReturn = (sale: Sale, item: SaleItem) => {
    setPending({ sale, item });
    setQty(1);
    setMode(sale.customer_id && customerDue(state, sale.customer_id) > 0 ? "baki_offset" : "cash");
  };

  const maxQty = pending ? pending.item.qty_pieces - pending.item.returned_qty : 0;
  const unitNet = pending ? pending.item.line_total / pending.item.qty_pieces : 0;
  const refund = pending ? Math.round(unitNet * qty * 100) / 100 : 0;
  const dueOfPendingCustomer =
    pending?.sale.customer_id ? customerDue(state, pending.sale.customer_id) : 0;
  const restockRow = pending ? state.inventory.find((r) => r.id === pending.item.inventory_id) : null;

  const confirmReturn = () => {
    if (!pending) return;
    const res = api.processReturn(pending.sale.id, pending.item.id, qty, mode);
    if (!res) return;
    toast(
      "success",
      `Return processed — ${tk(res.refund)} refunded`,
      `${qty} pc of ${pending.item.medicine_name} restocked to rack ${pending.item.rack}.` +
        (res.offsetPart > 0 ? ` ${tk(res.offsetPart)} adjusted against customer baki.` : "") +
        (res.cashPart > 0 ? ` Cash drawer −${tk(res.cashPart)}.` : "")
    );
    setPending(null);
  };

  return (
    <div className="h-full grid grid-cols-[340px_minmax(0,1fr)] gap-4 p-4 overflow-hidden">
      {/* ============ lookup column ============ */}
      <section className="min-h-0 flex flex-col">
        <div className="relative">
          <IcSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Invoice no. or customer phone…"
            className="w-full rounded-xl border border-line bg-card pl-9 pr-3 py-2.5 text-[13.5px] font-medium outline-none focus:border-cross-500 focus:ring-2 focus:ring-cross-200 transition-shadow placeholder:text-ink-300"
          />
        </div>
        <p className="text-[10.5px] text-ink-400 mt-1.5 px-1">
          {query ? `${results.length} invoice(s) matched` : "Showing latest invoices — search by phone or invoice ID"}
        </p>

        <div className="mt-2 flex-1 min-h-0 overflow-y-auto scroll-slim space-y-1.5 pr-0.5">
          {results.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-card p-6 text-center text-[12.5px] text-ink-400">
              No invoices match “{query}” for this branch.
            </div>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all hover:-translate-y-px ${
                selectedId === s.id ? "border-cross-500 bg-cross-50 shadow-sm" : "border-line bg-card hover:border-ink-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num text-[12.5px] font-bold text-ink-900">{s.invoice_no}</span>
                <StatusChip status={s.status} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-ink-400">
                <span className="truncate">{s.customer_name}{s.customer_phone ? ` · ${s.customer_phone}` : ""}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10.5px] num text-ink-400">{fmtDateTime(s.created_at)}</span>
                <span className="num text-[12px] font-bold text-ink-700">{tk(s.total)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ============ detail column ============ */}
      <section className="min-h-0 flex flex-col gap-4">
        <div className="flex-1 min-h-0 rounded-xl border border-line bg-card overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <span className="w-14 h-14 rounded-2xl bg-pine-900 text-cross-400 flex items-center justify-center mb-3">
                <IcReturn size={26} />
              </span>
              <p className="font-display font-bold text-[15px] text-ink-900">Select an invoice to process a return</p>
              <p className="text-[12px] text-ink-400 mt-1 max-w-[360px] leading-relaxed">
                Refunds are deducted from the cash drawer and the returned pieces are added straight back into raw piece
                stock — box/piece split stays consistent.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-linesoft bg-paper/50 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>
                  <div className="num text-[14px] font-bold text-ink-900">{selected.invoice_no}</div>
                  <div className="text-[10.5px] text-ink-400 num">{fmtDateTime(selected.created_at)} · {selected.cashier}</div>
                </div>
                <div className="text-[12px] text-ink-700">
                  <b>{selected.customer_name}</b>
                  {selected.customer_phone && <span className="num text-ink-400"> · {selected.customer_phone}</span>}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {selected.due_amount > 0 && (
                    <span className="text-[11px] font-bold text-warn-700 bg-warn-100 border border-warn-200 rounded-md px-2 py-1 num">
                      বাকি on sale: {tk(selected.due_amount)}
                    </span>
                  )}
                  <StatusChip status={selected.status} />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-slim">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left label-caps border-b border-linesoft">
                      <th className="px-4 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 font-semibold">Rack</th>
                      <th className="px-2 py-2 font-semibold text-right">Qty</th>
                      <th className="px-2 py-2 font-semibold text-right">Unit</th>
                      <th className="px-2 py-2 font-semibold text-right">Line</th>
                      <th className="px-4 py-2 font-semibold text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linesoft">
                    {selected.items.map((it) => {
                      const remaining = it.qty_pieces - it.returned_qty;
                      return (
                        <tr key={it.id} className="hover:bg-paper/70 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-ink-900">{it.medicine_name}</span>{" "}
                            <span className="text-ink-400 num text-[11px]">{it.strength}</span>
                            {it.returned_qty > 0 && (
                              <span className="ml-2 text-[10px] font-bold text-danger-600 bg-danger-50 border border-danger-100 rounded px-1.5 py-px num">
                                −{it.returned_qty} returned
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5"><RackChip rack={it.rack} /></td>
                          <td className="px-2 py-2.5 text-right num">{it.qty_pieces} pc</td>
                          <td className="px-2 py-2.5 text-right num">{tk(it.unit_price)}</td>
                          <td className="px-2 py-2.5 text-right num font-bold">{tk(it.line_total)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {remaining > 0 ? (
                              <button
                                onClick={() => openReturn(selected, it)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-danger-700 active:scale-95 transition-all"
                              >
                                <IcReturn size={11} /> Return
                              </button>
                            ) : (
                              <span className="text-[10.5px] font-semibold text-ink-300">fully returned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-line bg-paper/50 flex items-center gap-5 text-[12px]">
                <span className="text-ink-500">Subtotal <b className="num text-ink-900">{tk(selected.subtotal)}</b></span>
                {selected.discount > 0 && <span className="text-ink-500">Discount <b className="num text-danger-600">−{tk(selected.discount)}</b></span>}
                <span className="text-ink-500">Paid ({selected.payment_method}) <b className="num text-ink-900">{tk(selected.paid_amount)}</b></span>
                <span className="ml-auto font-display font-bold text-[15px] text-ink-900">Total {tk(selected.total)}</span>
              </div>
            </>
          )}
        </div>

        {/* recent returns */}
        <div className="h-[168px] shrink-0 rounded-xl border border-line bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-linesoft flex items-center justify-between">
            <h3 className="font-display font-bold text-[13px]">Recent Returns — this branch</h3>
            <span className="num text-[11px] text-ink-400">{returns.length} records</span>
          </div>
          <div className="flex-1 overflow-y-auto scroll-slim divide-y divide-linesoft">
            {returns.length === 0 && <p className="text-[12px] text-ink-400 text-center py-5">No returns processed yet.</p>}
            {returns.slice(0, 8).map((r) => (
              <div key={r.id} className="px-4 py-2 flex items-center gap-3 text-[12px] hover:bg-paper/70 transition-colors">
                <span className="w-6 h-6 rounded-md bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><IcReturn size={12} /></span>
                <span className="num font-bold text-ink-900">{r.invoice_no}</span>
                <span className="truncate text-ink-500 flex-1">
                  {r.items.map((i) => `${i.medicine_name} ×${i.qty}`).join(", ")}
                </span>
                <span className={`text-[9.5px] font-bold rounded px-1.5 py-px border ${r.refund_mode === "cash" ? "text-cross-700 bg-cross-50 border-cross-200" : "text-warn-700 bg-warn-100 border-warn-200"}`}>
                  {r.refund_mode === "cash" ? "CASH" : r.refund_mode === "baki_offset" ? "BAKI ADJ" : "MIXED"}
                </span>
                <span className="num font-bold text-danger-600">−{tk(r.total_refund_amount)}</span>
                <span className="num text-[10.5px] text-ink-400 w-[86px] text-right">{fmtDate(r.created_at)} {fmtTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ return qty modal ============ */}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={`Return — ${pending?.item.medicine_name ?? ""}`}
        subtitle={`Invoice ${pending?.sale.invoice_no} · sold at ${tk(unitNet)}/pc after discount`}
        width="max-w-md"
      >
        {pending && (
          <div className="p-5">
            <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3">
              <div>
                <div className="label-caps">Return quantity (max {maxQty})</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-md border border-line bg-white hover:border-cross-500 hover:text-cross-600 flex items-center justify-center active:scale-90 transition-all"><IcMinus size={14} /></button>
                  <input
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
                    className="w-[64px] text-center num text-[16px] font-bold rounded-md border border-line bg-white py-1 outline-none focus:border-cross-500"
                  />
                  <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="w-8 h-8 rounded-md border border-line bg-white hover:border-cross-500 hover:text-cross-600 flex items-center justify-center active:scale-90 transition-all"><IcPlus size={14} /></button>
                  <button onClick={() => setQty(maxQty)} className="ml-1 text-[11px] font-bold text-cross-600 hover:underline">All {maxQty}</button>
                </div>
              </div>
              <div className="text-right">
                <div className="label-caps">Refund</div>
                <div className="num text-[22px] font-bold text-danger-600 tracking-tight">{tk(refund)}</div>
              </div>
            </div>

            <div className="label-caps mt-4 mb-1.5">Refund method</div>
            <div className="space-y-2">
              <button
                onClick={() => setMode("cash")}
                className={`w-full flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-all ${mode === "cash" ? "border-cross-500 bg-cross-50" : "border-line bg-white hover:border-ink-300"}`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === "cash" ? "border-cross-600" : "border-ink-300"}`}>
                  {mode === "cash" && <span className="w-2 h-2 rounded-full bg-cross-600" />}
                </span>
                <span className="text-[12.5px] font-semibold text-ink-900">Cash refund from drawer</span>
                <span className="ml-auto num text-[12px] font-bold text-ink-700">−{tk(refund)}</span>
              </button>
              <button
                onClick={() => dueOfPendingCustomer > 0 && setMode("baki_offset")}
                disabled={dueOfPendingCustomer <= 0}
                className={`w-full flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-all disabled:opacity-45 disabled:cursor-not-allowed ${mode === "baki_offset" ? "border-warn-500 bg-warn-50" : "border-line bg-white hover:border-ink-300"}`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === "baki_offset" ? "border-warn-600" : "border-ink-300"}`}>
                  {mode === "baki_offset" && <span className="w-2 h-2 rounded-full bg-warn-600" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink-900">Adjust against customer's বাকি</span>
                  <span className="block text-[10.5px] text-ink-400">
                    {dueOfPendingCustomer > 0 ? `Customer owes ${tk(dueOfPendingCustomer)} — ${tk(Math.min(refund, dueOfPendingCustomer))} cleared from ledger` : "No outstanding baki on this customer"}
                  </span>
                </span>
              </button>
            </div>

            <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-pine-900 text-pine-100 px-3.5 py-2.5 text-[11.5px] leading-relaxed sidebar-texture">
              <IcCheck size={13} className="mt-0.5 shrink-0 text-cross-400" />
              <span>
                DB trigger restocks <b className="num text-white">{qty} pc</b> into{" "}
                <code className="num text-cross-400">pharmacy_inventory.total_pieces</code>
                {restockRow ? ` (rack ${restockRow.rack} · now ${restockRow.total_pieces} pc)` : ""} — fractional box split stays consistent.
              </span>
            </div>

            <button
              onClick={confirmReturn}
              className="mt-4 w-full rounded-lg bg-danger-600 text-white py-2.5 text-[13.5px] font-bold font-display hover:bg-danger-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <IcReturn size={15} /> Confirm Return · {tk(refund)}
            </button>
            {mode === "baki_offset" && dueOfPendingCustomer > 0 && refund > dueOfPendingCustomer && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warn-700 font-medium anim-slide-in">
                <IcAlert size={12} /> Excess {tk(Math.round((refund - dueOfPendingCustomer) * 100) / 100)} will be paid in cash.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
