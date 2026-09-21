import { useMemo, useState } from "react";
import type { Customer, PayMethod } from "../lib/types";
import { customerDue, customerLedger, pharmacyCustomers, pharmacySales, useApi, useStore } from "../lib/store";
import { fmtDate, fmtDateTime, round2, tk } from "../lib/format";
import { IcCash, IcCheck, IcLedger, IcPhone, IcPlus, IcSearch, Modal, StatusChip, useToast } from "../components/ui";
import { inputCls } from "../components/modals";

export default function Customers() {
  const state = useStore();
  const api = useApi();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("Cash");

  const customers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pharmacyCustomers(state)
      .map((c) => ({ c, due: customerDue(state, c.id) }))
      .filter((x) => !q || x.c.name.toLowerCase().includes(q) || x.c.phone.includes(q))
      .sort((a, b) => b.due - a.due || a.c.name.localeCompare(b.c.name));
  }, [state, query]);

  const selected = customers.find((x) => x.c.id === selectedId) ?? null;
  const ledger = selected ? customerLedger(state, selected.c.id) : [];
  const invoices = selected
    ? pharmacySales(state).filter((s) => s.customer_id === selected.c.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
    : [];

  const openRepay = () => {
    if (!selected) return;
    setAmount(String(selected.due));
    setMethod("Cash");
    setRepayOpen(true);
  };

  const confirmRepay = () => {
    if (!selected) return;
    const amt = round2(Number(amount));
    if (!amt || amt <= 0) {
      toast("danger", "Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    api.recordRepayment(selected.c.id, amt, method, `Baki repayment via ${method}`);
    setRepayOpen(false);
    toast("success", `${tk(amt)} collected from ${selected.c.name}`, `${method === "Cash" ? "Cash drawer credited. " : ""}Ledger balance reduced.`);
  };

  /* running balance for timeline (oldest → newest, then reversed) */
  const timeline = useMemo(() => {
    if (!selected) return [];
    const asc = [...ledger].reverse();
    let run = 0;
    const withRun = asc.map((l) => {
      run = round2(run + (l.type === "sale_due" ? l.amount : -l.amount));
      return { ...l, running: run };
    });
    return withRun.reverse();
  }, [ledger, selected]);

  return (
    <div className="h-full grid grid-cols-[320px_minmax(0,1fr)] gap-4 p-4 overflow-hidden">
      {/* ============ customer list ============ */}
      <section className="min-h-0 flex flex-col">
        <div className="relative">
          <IcSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full rounded-xl border border-line bg-card pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-cross-500 focus:ring-2 focus:ring-cross-200 transition-shadow placeholder:text-ink-300"
          />
        </div>
        <p className="text-[10.5px] text-ink-400 mt-1.5 px-1">
          {customers.filter((x) => x.due > 0).length} of {customers.length} customers hold বাকি — sorted by balance
        </p>
        <div className="mt-2 flex-1 min-h-0 overflow-y-auto scroll-slim space-y-1.5">
          {customers.map(({ c, due }) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all hover:-translate-y-px ${
                selectedId === c.id ? "border-cross-500 bg-cross-50 shadow-sm" : "border-line bg-card hover:border-ink-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-[11px] shrink-0 ${due > 0 ? "bg-warn-100 text-warn-700" : "bg-pine-900 text-cross-400"}`}>
                  {c.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink-900 truncate">{c.name}</span>
                  <span className="block text-[10.5px] num text-ink-400">{c.phone} · {c.area}</span>
                </span>
                <span className={`num text-[13px] font-bold ${due > 0 ? "text-warn-600" : "text-cross-600"}`}>
                  {due > 0 ? tk(due) : "clear"}
                </span>
              </div>
            </button>
          ))}
          {customers.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-card p-6 text-center text-[12.5px] text-ink-400">No customers match.</div>
          )}
        </div>
      </section>

      {/* ============ profile / ledger ============ */}
      <section className="min-h-0 flex flex-col gap-4">
        {!selected ? (
          <div className="flex-1 rounded-xl border border-line bg-card flex flex-col items-center justify-center text-center px-8">
            <span className="w-14 h-14 rounded-2xl bg-pine-900 text-cross-400 flex items-center justify-center mb-3">
              <IcLedger size={26} />
            </span>
            <p className="font-display font-bold text-[15px] text-ink-900">Pick a customer to open their baki ledger</p>
            <p className="text-[12px] text-ink-400 mt-1 max-w-[380px] leading-relaxed">
              Every sale with a due amount appends a timeline row automatically; repayments deduct from the outstanding
              balance and credit the drawer.
            </p>
          </div>
        ) : (
          <>
            {/* profile header */}
            <div className={`shrink-0 rounded-xl border p-4 flex flex-wrap items-center gap-4 ${selected.due > 0 ? "border-warn-200 bg-warn-50/50" : "border-line bg-card"}`}>
              <span className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-[15px] ${selected.due > 0 ? "bg-warn-100 text-warn-700" : "bg-pine-900 text-cross-400"}`}>
                {selected.c.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0">
                <div className="font-display font-bold text-[16px] text-ink-900 flex items-center gap-2">
                  {selected.c.name}
                  {selected.due > 0 ? (
                    <span className="flash-due text-[10px] font-bold bg-warn-100 border border-warn-200 text-warn-700 rounded px-1.5 py-0.5">HAS BAKI</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-cross-50 border border-cross-200 text-cross-700 rounded px-1.5 py-0.5">CLEAR</span>
                  )}
                </div>
                <div className="text-[11.5px] text-ink-400 num flex items-center gap-2 mt-0.5">
                  <IcPhone size={11} /> {selected.c.phone} · {selected.c.area} · since {fmtDate(selected.c.created_at)}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="label-caps">Outstanding due</div>
                <div className={`num text-[26px] font-bold tracking-tight ${selected.due > 0 ? "text-warn-600" : "text-cross-600"}`}>{tk(selected.due)}</div>
              </div>
              <button
                onClick={openRepay}
                disabled={selected.due <= 0}
                className="rounded-lg bg-cross-600 text-white px-4 py-2.5 text-[12.5px] font-bold hover:bg-cross-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-[0_6px_16px_-6px_rgba(14,143,91,0.5)] flex items-center gap-2"
              >
                <IcPlus size={14} /> Receive Payment
              </button>
            </div>

            {/* timeline + invoices */}
            <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_300px] gap-4">
              <div className="min-h-0 rounded-xl border border-line bg-card overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-linesoft flex items-center justify-between">
                  <h3 className="font-display font-bold text-[13px]">Ledger Timeline</h3>
                  <span className="num text-[11px] text-ink-400">{ledger.length} entries</span>
                </div>
                <div className="flex-1 overflow-y-auto scroll-slim px-4 py-3">
                  {timeline.length === 0 && <p className="text-[12px] text-ink-400 text-center py-8">No baki activity recorded.</p>}
                  <ol className="relative border-l-2 border-linesoft ml-2 space-y-3">
                    {timeline.map((l) => {
                      const isDue = l.type === "sale_due";
                      return (
                        <li key={l.id} className="ml-4 relative anim-slide-in">
                          <span className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-card ${isDue ? "bg-warn-500" : "bg-cross-500"}`} />
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`num text-[13px] font-bold ${isDue ? "text-warn-600" : "text-cross-600"}`}>
                              {isDue ? "+" : "−"}{tk(l.amount)}
                            </span>
                            <span className="text-[12px] text-ink-700 font-medium">{l.note}</span>
                            <span className="ml-auto num text-[10.5px] text-ink-400">{fmtDateTime(l.created_at)}</span>
                          </div>
                          <div className="text-[10.5px] text-ink-400 num mt-0.5">
                            balance after: <b className={l.running > 0 ? "text-warn-600" : "text-cross-600"}>{tk(l.running)}</b>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>

              <div className="min-h-0 rounded-xl border border-line bg-card overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-linesoft">
                  <h3 className="font-display font-bold text-[13px]">Recent Invoices</h3>
                </div>
                <div className="flex-1 overflow-y-auto scroll-slim divide-y divide-linesoft">
                  {invoices.length === 0 && <p className="text-[12px] text-ink-400 text-center py-8">No purchases yet.</p>}
                  {invoices.map((s) => (
                    <div key={s.id} className="px-4 py-2.5 hover:bg-paper/70 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="num text-[12px] font-bold text-ink-900">{s.invoice_no}</span>
                        <StatusChip status={s.status} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="num text-[10.5px] text-ink-400">{fmtDateTime(s.created_at)}</span>
                        <span className="num text-[12px] font-bold">{tk(s.total)}</span>
                      </div>
                      {s.due_amount > 0 && (
                        <div className="text-[10px] num text-warn-600 font-semibold mt-0.5">বাকি {tk(s.due_amount)} on this invoice</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ============ repay modal ============ */}
      <Modal
        open={repayOpen}
        onClose={() => setRepayOpen(false)}
        title={`Receive baki payment — ${selected?.c.name ?? ""}`}
        subtitle={`Current outstanding: ${tk(selected?.due ?? 0)}`}
        width="max-w-sm"
      >
        <div className="p-5">
          <label className="label-caps block mb-1.5">Amount (৳)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputCls} num text-[18px] py-2.5 font-bold`}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            {[selected?.due ?? 0, round2((selected?.due ?? 0) / 2)].map((v, i) =>
              v > 0 ? (
                <button key={i} onClick={() => setAmount(String(v))} className="flex-1 rounded-md border border-line bg-paper py-1.5 text-[11.5px] num font-semibold text-ink-700 hover:border-cross-500 hover:text-cross-600 transition-colors">
                  {i === 0 ? "Full due" : "Half"}
                </button>
              ) : null
            )}
          </div>
          <label className="label-caps block mt-4 mb-1.5">Received via</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Cash", "bKash", "Nagad"] as PayMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`rounded-lg border px-2 py-2 text-[12px] font-bold transition-all ${
                  method === m ? "bg-pine-900 text-white border-transparent" : "border-line bg-white text-ink-500 hover:border-ink-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-cross-50 border border-cross-200 px-3 py-2.5 text-[11.5px] text-cross-700 leading-relaxed">
            <IcCash size={13} className="mt-0.5 shrink-0" />
            <span>
              Appends a <b>repayment</b> row to the ledger and deducts from the customer's total due
              {method === "Cash" ? " · cash drawer credited" : ""}.
            </span>
          </div>
          <button
            onClick={confirmRepay}
            className="mt-4 w-full rounded-lg bg-cross-600 text-white py-2.5 text-[13.5px] font-bold font-display hover:bg-cross-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <IcCheck size={15} /> Record Repayment
          </button>
        </div>
      </Modal>

    </div>
  );
}
