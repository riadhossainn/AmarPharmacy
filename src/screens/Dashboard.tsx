import { useMemo, useState, type ReactNode } from "react";
import {
  customerDue,
  expiringItems,
  lowStockItems,
  outstandingBaki,
  pharmacyCustomers,
  pharmacySales,
  useStore,
} from "../lib/store";
import { boxSplit, daysUntil, fmtDate, money, round2, startOfDay, tk } from "../lib/format";
import { IcAlert, IcClock, IcFlame, IcTrendDown, IcTrendUp, IcUser, RackChip } from "../components/ui";
import type { Sale } from "../lib/types";

type Frame = "today" | "7d" | "30d";
const FRAMES: { id: Frame; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

function windowFor(f: Frame): { start: Date; end: Date; prevStart: Date } {
  const now = new Date();
  if (f === "today") return { start: startOfDay(now), end: now, prevStart: new Date(startOfDay(now).getTime() - 86_400_000) };
  const days = f === "7d" ? 7 : 30;
  const start = new Date(startOfDay(now).getTime() - (days - 1) * 86_400_000);
  return { start, end: now, prevStart: new Date(start.getTime() - days * 86_400_000) };
}

const inWin = (s: Sale, start: Date, end: Date) => {
  const t = new Date(s.created_at).getTime();
  return t >= start.getTime() && t <= end.getTime();
};

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return <span className="text-[10.5px] text-ink-400 num">new window</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold num ${up ? "text-cross-600" : "text-danger-600"}`}>
      {up ? <IcTrendUp size={12} /> : <IcTrendDown size={12} />}
      {up ? "+" : ""}
      {pct}% vs prev
    </span>
  );
}

function StatCard({ label, value, sub, delta, accent }: { label: string; value: string; sub: ReactNode; delta?: ReactNode; accent?: "green" | "amber" }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-card p-4 transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(5,29,22,0.25)] ${accent === "amber" ? "border-warn-200" : "border-line"}`}>
      {accent === "amber" && <span className="absolute inset-x-0 top-0 h-[3px] bg-warn-500" />}
      {accent === "green" && <span className="absolute inset-x-0 top-0 h-[3px] bg-cross-500" />}
      <div className="label-caps">{label}</div>
      <div className="num text-[26px] font-bold text-ink-900 leading-tight mt-1.5 tracking-tight">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-400">{sub}</span>
        {delta}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const state = useStore();
  const [frame, setFrame] = useState<Frame>("7d");

  const data = useMemo(() => {
    const sales = pharmacySales(state);
    const { start, end, prevStart } = windowFor(frame);
    const cur = sales.filter((s) => inWin(s, start, end));
    const prev = sales.filter((s) => inWin(s, prevStart, start));

    const sum = (arr: Sale[], f: (s: Sale) => number) => round2(arr.reduce((a, s) => a + f(s), 0));

    // fast movers
    const agg = new Map<string, { name: string; strength: string; qty: number; rev: number; invId: string }>();
    cur.forEach((s) =>
      s.items.forEach((it) => {
        const eff = it.qty_pieces - it.returned_qty;
        if (eff <= 0) return;
        const e = agg.get(it.medicine_name) ?? { name: it.medicine_name, strength: it.strength, qty: 0, rev: 0, invId: it.inventory_id };
        e.qty += eff;
        e.rev = round2(e.rev + (it.line_total * eff) / it.qty_pieces);
        agg.set(it.medicine_name, e);
      })
    );
    const movers = [...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

    // chart series
    let buckets: { label: string; value: number }[] = [];
    if (frame === "today") {
      for (let h = 8; h <= 22; h++) buckets.push({ label: h <= 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`, value: 0 });
      cur.forEach((s) => {
        const h = new Date(s.created_at).getHours();
        const idx = h - 8;
        if (idx >= 0 && idx < buckets.length) buckets[idx].value = round2(buckets[idx].value + s.total);
      });
    } else {
      const days = frame === "7d" ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 86_400_000);
        buckets.push({ label: String(d.getDate()), value: 0 });
      }
      cur.forEach((s) => {
        const d = startOfDay(new Date(s.created_at));
        const idx = Math.round((d.getTime() - startOfDay(start).getTime()) / 86_400_000);
        if (idx >= 0 && idx < buckets.length) buckets[idx].value = round2(buckets[idx].value + s.total);
      });
    }

    const baki = outstandingBaki(state);
    const repaid = state.ledger
      .filter((l) => l.pharmacy_id === state.activePharmacyId && l.type === "repayment" && inWin({ created_at: l.created_at } as Sale, start, end))
      .reduce((a, l) => a + l.amount, 0);

    return {
      revenue: sum(cur, (s) => s.total),
      prevRevenue: sum(prev, (s) => s.total),
      profit: sum(cur, (s) => s.profit),
      prevProfit: sum(prev, (s) => s.profit),
      count: cur.length,
      prevCount: prev.length,
      avg: cur.length ? round2(sum(cur, (s) => s.total) / cur.length) : 0,
      duesGranted: round2(sum(cur, (s) => s.due_amount)),
      repaid: round2(repaid),
      baki,
      movers,
      buckets,
    };
  }, [state, frame]);

  const expiring = expiringItems(state, 60);
  const low = lowStockItems(state);
  const debtors = pharmacyCustomers(state)
    .map((c) => ({ c, due: customerDue(state, c.id) }))
    .filter((x) => x.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 4);

  const maxBar = Math.max(1, ...data.buckets.map((b) => b.value));
  const maxMover = Math.max(1, ...data.movers.map((m) => m.qty));

  return (
    <div className="h-full overflow-y-auto scroll-slim p-5">
      {/* timeframe toggle */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-line bg-card p-1 shadow-sm">
          {FRAMES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFrame(f.id)}
              className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all ${
                frame === f.id ? "bg-pine-900 text-white shadow" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-ink-400">
          <span className="num font-semibold text-ink-700">{data.count}</span> invoices · avg ticket{" "}
          <span className="num font-semibold text-ink-700">{tk(data.avg)}</span> · baki granted this window{" "}
          <span className="num font-semibold text-warn-600">{tk(data.duesGranted)}</span>
        </div>
      </div>

      {/* financial cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        <StatCard
          label="Total Revenue"
          value={tk(data.revenue)}
          sub={`${data.count} sales`}
          delta={<Delta cur={data.revenue} prev={data.prevRevenue} />}
          accent="green"
        />
        <StatCard
          label="Net Profit"
          value={tk(data.profit)}
          sub={data.revenue > 0 ? `${Math.round((data.profit / data.revenue) * 100)}% of revenue` : "—"}
          delta={<Delta cur={data.profit} prev={data.prevProfit} />}
        />
        <StatCard label="Outstanding Baki (বাকি)" value={tk(data.baki.total)} sub={`${data.baki.debtors} customers owe`} accent="amber"
          delta={<span className="text-[10.5px] num text-cross-600 font-bold">+{tk(data.repaid)} repaid</span>} />
        <StatCard label="Transactions" value={money(data.count)} sub={`avg ${tk(data.avg)} / invoice`}
          delta={<Delta cur={data.count} prev={data.prevCount} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* left column */}
        <div className="min-w-0 space-y-4">
          {/* revenue chart */}
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display font-bold text-[14px] text-ink-900">Revenue — {FRAMES.find((f) => f.id === frame)?.label}</h2>
              <span className="label-caps">৳ taka</span>
            </div>
            <div className="flex items-end gap-[3px] h-[150px]">
              {data.buckets.map((b, i) => (
                <div key={`${frame}-${i}`} className="flex-1 flex flex-col items-center gap-1 group min-w-0" title={`${b.label}: ${tk(b.value)}`}>
                  <span className="num text-[9px] text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity">{money(b.value)}</span>
                  <div
                    className={`w-full rounded-t-[3px] anim-grow transition-colors ${
                      b.value === maxBar && b.value > 0 ? "bg-cross-500" : "bg-pine-900/80 group-hover:bg-cross-600"
                    }`}
                    style={{ height: `${Math.max(2, (b.value / maxBar) * 108)}px`, animationDelay: `${i * 14}ms` }}
                  />
                  <span className={`text-[9px] num truncate max-w-full ${frame === "30d" && i % 5 !== 0 ? "opacity-0" : "text-ink-400"}`}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* fast movers */}
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-[14px] text-ink-900 flex items-center gap-2">
                <IcFlame size={16} className="text-warn-600" /> Fast-Moving Products — Top 10
              </h2>
              <span className="text-[11px] text-ink-400">what to re-order next</span>
            </div>
            {data.movers.length === 0 ? (
              <p className="text-[12.5px] text-ink-400 py-6 text-center">No sales recorded in this window yet.</p>
            ) : (
              <div className="space-y-1">
                {data.movers.map((m, i) => {
                  const inv = state.inventory.find((r) => r.id === m.invId);
                  const reorder = inv && inv.total_pieces <= inv.reorder_level;
                  return (
                    <div key={m.name} className="grid grid-cols-[26px_minmax(0,1fr)_150px_88px_74px] items-center gap-3 rounded-lg px-2 py-[7px] hover:bg-paper transition-colors anim-slide-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <span className={`num text-[11px] font-bold w-6 h-6 rounded-md flex items-center justify-center ${i < 3 ? "bg-pine-900 text-cross-400" : "bg-paper text-ink-400"}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate flex items-center gap-2">
                          {m.name}
                          <span className="text-[10.5px] font-normal text-ink-400">{m.strength}</span>
                          {reorder && (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-danger-600 bg-danger-50 border border-danger-100 rounded px-1.5 py-px">
                              <IcAlert size={9} /> REORDER
                            </span>
                          )}
                        </div>
                        <div className="h-[5px] rounded-full bg-paper overflow-hidden mt-1">
                          <div className="h-full rounded-full bg-cross-500/80 transition-all duration-500" style={{ width: `${(m.qty / maxMover) * 100}%` }} />
                        </div>
                      </div>
                      <span className="num text-[12px] text-ink-700 text-right">{m.qty} pc sold</span>
                      <span className="num text-[12px] font-bold text-ink-900 text-right">{tk(m.rev)}</span>
                      <span className="num text-[10.5px] text-ink-400 text-right">{inv ? boxSplit(inv.total_pieces, inv.pieces_per_box) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4">
          {/* expirations */}
          <div className="rounded-xl border border-danger-100 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-danger-50/60 border-b border-danger-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-[13px] text-ink-900 flex items-center gap-2">
                <IcClock size={15} className="text-danger-600" /> Expiring ≤ 60 days
              </h3>
              <span className="num text-[11px] font-bold text-danger-600">{expiring.length} batches</span>
            </div>
            <div className="divide-y divide-linesoft max-h-[240px] overflow-y-auto scroll-slim">
              {expiring.length === 0 && <p className="text-[12px] text-ink-400 px-4 py-5 text-center">No batches expiring soon.</p>}
              {expiring.map((r) => {
                const d = daysUntil(r.expiry_date);
                return (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-paper transition-colors">
                    <span className={`num text-[10px] font-bold px-1.5 py-1 rounded-md min-w-[46px] text-center ${d <= 30 ? "bg-danger-600 text-white" : "bg-warn-100 text-warn-700"}`}>
                      {d}d left
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink-900 truncate">{r.brand_name} <span className="font-normal text-ink-400 text-[10.5px]">{r.strength}</span></div>
                      <div className="text-[10.5px] text-ink-400 num">batch {r.batch_no} · {fmtDate(r.expiry_date)} · {r.total_pieces} pc</div>
                    </div>
                    <RackChip rack={r.rack} row={r.row} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* low stock */}
          <div className="rounded-xl border border-warn-200 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-warn-50/60 border-b border-warn-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-[13px] text-ink-900 flex items-center gap-2">
                <IcAlert size={15} className="text-warn-600" /> Below Reorder Level
              </h3>
              <span className="num text-[11px] font-bold text-warn-600">{low.length} items</span>
            </div>
            <div className="divide-y divide-linesoft max-h-[210px] overflow-y-auto scroll-slim">
              {low.slice(0, 8).map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-paper transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-ink-900 truncate">{r.brand_name}</div>
                    <div className="text-[10.5px] text-ink-400 num">
                      {r.total_pieces} pc left · reorder at {r.reorder_level}
                    </div>
                  </div>
                  <div className="w-[74px]">
                    <div className="h-[6px] rounded-full bg-paper overflow-hidden">
                      <div className={`h-full rounded-full ${r.total_pieces / Math.max(1, r.reorder_level) < 0.4 ? "bg-danger-600" : "bg-warn-500"}`}
                        style={{ width: `${Math.min(100, (r.total_pieces / Math.max(1, r.reorder_level)) * 100)}%` }} />
                    </div>
                    <div className="num text-[9.5px] text-ink-400 text-right mt-0.5">{Math.round((r.total_pieces / Math.max(1, r.reorder_level)) * 100)}%</div>
                  </div>
                  <RackChip rack={r.rack} />
                </div>
              ))}
              {low.length === 0 && <p className="text-[12px] text-ink-400 px-4 py-5 text-center">All items above reorder level.</p>}
            </div>
          </div>

          {/* top debtors */}
          <div className="rounded-xl border border-line bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-linesoft flex items-center justify-between">
              <h3 className="font-display font-bold text-[13px] text-ink-900 flex items-center gap-2">
                <IcUser size={15} className="text-pine-700" /> Largest Baki Balances
              </h3>
            </div>
            <div className="divide-y divide-linesoft">
              {debtors.length === 0 && <p className="text-[12px] text-ink-400 px-4 py-5 text-center">No outstanding dues. Alhamdulillah!</p>}
              {debtors.map(({ c, due }) => (
                <div key={c.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-paper transition-colors">
                  <span className="w-7 h-7 rounded-full bg-pine-900 text-cross-400 font-display font-bold text-[10px] flex items-center justify-center shrink-0">
                    {c.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-ink-900 truncate">{c.name}</div>
                    <div className="text-[10.5px] text-ink-400 num">{c.phone}</div>
                  </div>
                  <span className="num text-[13px] font-bold text-warn-600">{tk(due)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
