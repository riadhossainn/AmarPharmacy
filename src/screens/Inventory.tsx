import { useMemo, useState } from "react";
import type { InventoryItem } from "../lib/types";
import { expiringItems, lowStockItems, pharmacyInv, useApi, useStore } from "../lib/store";
import { boxSplit, daysUntil, fmtDate, round2, tk } from "../lib/format";
import { IcAlert, IcBox, IcClock, IcEdit, IcPill, IcPlus, IcSearch, RackChip, useToast } from "../components/ui";
import { MedicineFormModal, PriceBatchModal } from "../components/modals";

type Tab = "all" | "low" | "expiring" | "custom";

export default function Inventory() {
  const state = useStore();
  const api = useApi();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const inv = useMemo(() => pharmacyInv(state), [state]);
  const low = lowStockItems(state);
  const expiring = expiringItems(state, 60);

  const stockValue = round2(inv.reduce((a, r) => a + r.total_pieces * r.buying_price, 0));
  const retailValue = round2(inv.reduce((a, r) => a + r.total_pieces * r.selling_price, 0));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...inv];
    if (tab === "low") list = list.filter((r) => r.total_pieces <= r.reorder_level);
    if (tab === "expiring") list = list.filter((r) => daysUntil(r.expiry_date) <= 60);
    if (tab === "custom") list = list.filter((r) => r.is_custom);
    if (q)
      list = list.filter(
        (r) =>
          r.brand_name.toLowerCase().includes(q) ||
          r.generic_name.toLowerCase().includes(q) ||
          r.manufacturer.toLowerCase().includes(q) ||
          r.batch_no.toLowerCase().includes(q) ||
          r.rack.toLowerCase().includes(q)
      );
    return list.sort((a, b) => a.brand_name.localeCompare(b.brand_name));
  }, [inv, tab, query]);

  const activePh = state.pharmacies.find((p) => p.id === state.activePharmacyId)!;

  const TABS: { id: Tab; label: string; n?: number; warn?: boolean }[] = [
    { id: "all", label: "All Items", n: inv.length },
    { id: "low", label: "Low Stock", n: low.length, warn: low.length > 0 },
    { id: "expiring", label: "Expiring ≤60d", n: expiring.length, warn: expiring.length > 0 },
    { id: "custom", label: "Custom / Private", n: inv.filter((r) => r.is_custom).length },
  ];

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-3.5">
        {[
          { label: "SKUs in shop", value: String(inv.length), icon: <IcBox size={15} />, cls: "text-pine-700" },
          { label: "Stock value (buy)", value: tk(stockValue), icon: <IcPill size={15} />, cls: "text-pine-700" },
          { label: "Retail value (MRP)", value: tk(retailValue), icon: <IcPill size={15} />, cls: "text-cross-600" },
          { label: "Below reorder level", value: String(low.length), icon: <IcAlert size={15} />, cls: "text-warn-600", alert: low.length > 0 },
          { label: "Expiring ≤ 60 days", value: String(expiring.length), icon: <IcClock size={15} />, cls: "text-danger-600", alert: expiring.length > 0 },
        ].map((s, i) => (
          <div key={i} className={`rounded-lg border bg-card px-3 py-2.5 flex items-center gap-2.5 ${s.alert ? "border-warn-200 hazard-stripes" : "border-line"}`}>
            <span className={`shrink-0 ${s.cls}`}>{s.icon}</span>
            <div className="min-w-0 leading-tight">
              <div className="label-caps text-[8.5px]">{s.label}</div>
              <div className={`num text-[15px] font-bold ${s.alert ? s.cls : "text-ink-900"}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                tab === t.id ? "bg-pine-900 text-white shadow" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {t.label}
              <span className={`num text-[10px] px-1.5 rounded ${tab === t.id ? "bg-white/15" : t.warn ? "bg-danger-100 text-danger-600" : "bg-paper text-ink-400"}`}>
                {t.n}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <IcSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, batch, rack…"
            className="w-full rounded-lg border border-line bg-card pl-9 pr-3 py-2 text-[13px] outline-none focus:border-cross-500 focus:ring-2 focus:ring-cross-200 transition-shadow placeholder:text-ink-300"
          />
        </div>

        <button
          onClick={() => setCustomOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-cross-600 text-white px-3.5 py-2 text-[12.5px] font-bold hover:bg-cross-700 active:scale-[0.98] transition-all shadow-[0_6px_16px_-6px_rgba(14,143,91,0.5)]"
        >
          <IcPlus size={14} /> Custom Medicine
        </button>
      </div>

      {/* table */}
      <div className="flex-1 min-h-0 rounded-xl border border-line bg-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto scroll-slim">
          <table className="w-full text-[12.5px] min-w-[900px]">
            <thead className="sticky top-0 bg-paper z-10">
              <tr className="text-left label-caps border-b border-line">
                <th className="px-4 py-2.5 font-semibold">Medicine</th>
                <th className="px-2 py-2.5 font-semibold">Rack / Row</th>
                <th className="px-2 py-2.5 font-semibold">Batch · Expiry</th>
                <th className="px-2 py-2.5 font-semibold text-right">Stock (box split)</th>
                <th className="px-2 py-2.5 font-semibold text-right">Buy / Sell</th>
                <th className="px-2 py-2.5 font-semibold text-right">Margin</th>
                <th className="px-4 py-2.5 font-semibold text-right">Row Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linesoft">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-400">
                    No items match this filter.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const d = daysUntil(r.expiry_date);
                const isLow = r.total_pieces <= r.reorder_level;
                const margin = r.selling_price > 0 ? Math.round(((r.selling_price - r.buying_price) / r.selling_price) * 100) : 0;
                return (
                  <tr key={r.id} className="hover:bg-paper/70 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-900">{r.brand_name}</span>
                        <span className="text-[11px] num text-ink-400">{r.strength}</span>
                        {r.is_custom && (
                          <span className="text-[9px] font-bold tracking-wide text-pine-700 bg-cross-100 border border-cross-200 rounded px-1.5 py-px">
                            CUSTOM · master_id NULL
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-ink-400 truncate">
                        {r.generic_name} · {r.manufacturer} · {r.form} · {r.pieces_per_box} pc/box
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><RackChip rack={r.rack} row={r.row} /></td>
                    <td className="px-2 py-2.5">
                      <div className="num text-[11.5px] text-ink-700">{r.batch_no}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="num text-[10.5px] text-ink-400">{fmtDate(r.expiry_date)}</span>
                        {d <= 30 ? (
                          <span className="text-[9px] font-bold bg-danger-600 text-white rounded px-1.5 py-px num">{d}d</span>
                        ) : d <= 60 ? (
                          <span className="text-[9px] font-bold bg-warn-100 text-warn-700 border border-warn-200 rounded px-1.5 py-px num">{d}d</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <div className={`num font-bold ${isLow ? "text-danger-600" : "text-ink-900"}`}>
                        {boxSplit(r.total_pieces, r.pieces_per_box)}
                      </div>
                      <div className={`text-[10px] num ${isLow ? "text-danger-600 font-semibold" : "text-ink-400"}`}>
                        {r.total_pieces} pc {isLow && `· reorder @ ${r.reorder_level}`}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right num text-[11.5px] text-ink-700">
                      {tk(r.buying_price)} <span className="text-ink-300">/</span> <b className="text-ink-900">{tk(r.selling_price)}</b>
                    </td>
                    <td className={`px-2 py-2.5 text-right num font-bold ${margin >= 15 ? "text-cross-600" : margin >= 0 ? "text-warn-600" : "text-danger-600"}`}>
                      {margin}%
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:border-cross-500 hover:text-cross-600 hover:bg-cross-50 active:scale-95 transition-all opacity-70 group-hover:opacity-100"
                      >
                        <IcEdit size={11} /> Price / Batch
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-linesoft bg-paper/60 text-[10.5px] text-ink-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cross-500 blink-dot" />
          All prices & batches live in <code className="num">pharmacy_inventory</code> — the shared{" "}
          <code className="num">master_medicines</code> table is pricing-agnostic and untouched by this branch.
        </div>
      </div>

      {/* modals */}
      <PriceBatchModal
        item={editing}
        onClose={() => setEditing(null)}
        pharmacyName={activePh.name}
        onSubmit={(patch, addPieces) => {
          api.updateInventoryRow(editing!.id, patch, addPieces);
          toast(
            "success",
            `${editing!.brand_name} row updated — scoped to ${activePh.code}`,
            `Sell ${tk(patch.selling_price!)}/pc · buy ${tk(patch.buying_price!)}/pc${addPieces > 0 ? ` · +${addPieces} pc received` : ""}. Zero effect on other tenants.`
          );
        }}
      />
      <MedicineFormModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        heading="Add Custom Medicine to Your Shop"
        sub="Private inventory row · master_medicine_id = NULL, is_custom = true"
        submitLabel="Save to My Inventory"
        onSubmit={(d) => {
          const row = api.addCustomMedicine(d);
          toast("success", `${row.brand_name} added to your shop`, `Private to ${activePh.name} — rack ${row.rack}, row ${row.row}. Master list untouched.`);
        }}
      />
    </div>
  );
}
