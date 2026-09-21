import { useEffect, useState, type ReactNode } from "react";
import type { Screen } from "../lib/types";
import { lowStockItems, outstandingBaki, pharmacyCustomers, useApi, useStore } from "../lib/store";
import { fmtTime, tk } from "../lib/format";
import {
  IcDash,
  IcScan,
  IcReturn,
  IcShelf,
  IcLedger,
  IcLogo,
  IcSwap,
  IcRefresh,
  IcCheck,
  IcCash,
  IcStore,
  Kbd,
  Modal,
  useToast,
} from "./ui";

const NAV: { id: Screen; label: string; icon: (p: { size?: number }) => ReactNode; hint: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: (p) => <IcDash {...p} />, hint: "Analytics" },
  { id: "pos", label: "POS Counter", icon: (p) => <IcScan {...p} />, hint: "Sell · F2" },
  { id: "returns", label: "Sales Returns", icon: (p) => <IcReturn {...p} />, hint: "Restock + refund" },
  { id: "inventory", label: "Inventory", icon: (p) => <IcShelf {...p} />, hint: "Price / Batch" },
  { id: "customers", label: "Baki Ledgers", icon: (p) => <IcLedger {...p} />, hint: "Customer dues" },
];

const TITLES: Record<Screen, { title: string; sub: string }> = {
  dashboard: { title: "Owner Dashboard", sub: "Revenue, profit and fast movers for this branch" },
  pos: { title: "POS Counter", sub: "Keyboard-first checkout — F2 search, Enter to take payment" },
  returns: { title: "Sales Returns", sub: "Look up by invoice or phone · refunds restock inventory automatically" },
  inventory: { title: "Inventory & Pricing", sub: "Tenant-private stock — prices never touch the master catalogue" },
  customers: { title: "Customer Baki Ledgers", sub: "Due histories and repayments per customer" },
};

export default function Shell({
  screen,
  setScreen,
  children,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  children: ReactNode;
}) {
  const state = useStore();
  const api = useApi();
  const toast = useToast();
  const [now, setNow] = useState(new Date());
  const [confirmReset, setConfirmReset] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  const cash = state.cashDrawer[state.activePharmacyId] ?? 0;
  const lowCount = lowStockItems(state).length;
  const debtors = outstandingBaki(state).debtors;
  const custCount = pharmacyCustomers(state).length;
  const active = state.pharmacies.find((p) => p.id === state.activePharmacyId)!;

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setScreen("pos");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setScreen]);

  const badge = (id: Screen): number => (id === "inventory" ? lowCount : id === "customers" ? debtors : 0);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ============ sidebar ============ */}
      <aside className="w-[228px] shrink-0 bg-pine-900 sidebar-texture text-pine-100 flex flex-col no-print">
        <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
          <span className="text-cross-400">
            <IcLogo size={30} />
          </span>
          <div className="leading-tight">
            <div className="font-display font-bold text-[15px] text-white tracking-tight">
              Amar<span className="text-cross-400">Pharmacy</span>
            </div>
            <div className="font-bn text-[10.5px] text-pine-200 -mt-0.5">আমার ফার্মেসী · POS SaaS</div>
          </div>
        </div>

        {/* branch switcher — tenant isolation */}
        <div className="px-3 relative">
          <button
            onClick={() => setBranchOpen((v) => !v)}
            className="w-full flex items-center gap-2 rounded-lg bg-pine-850 border border-white/10 hover:border-cross-500/50 px-2.5 py-2 transition-colors group"
          >
            <span className="w-7 h-7 rounded-md bg-cross-600/25 text-cross-400 flex items-center justify-center shrink-0">
              <IcStore size={15} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block label-caps text-pine-200/70 text-[9px]">Active branch</span>
              <span className="block text-[12px] font-semibold text-white truncate">
                {active.name.replace("AmarPharmacy · ", "")}
              </span>
            </span>
            <IcSwap size={14} className="text-pine-200 group-hover:text-cross-400 transition-colors shrink-0" />
          </button>
          {branchOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-40 rounded-lg bg-pine-850 border border-white/12 shadow-xl overflow-hidden anim-pop">
              {state.pharmacies.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    api.switchPharmacy(p.id);
                    setBranchOpen(false);
                    toast("info", `Switched to ${p.name}`, "Row-Level Security scoped every query to this pharmacy_id.");
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12.5px] transition-colors ${
                    p.id === state.activePharmacyId ? "bg-cross-600/15 text-white" : "text-pine-100 hover:bg-white/5"
                  }`}
                >
                  <span className="num text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cross-400 font-bold">{p.code}</span>
                  <span className="flex-1 truncate font-medium">{p.name.replace("AmarPharmacy · ", "")}</span>
                  {p.id === state.activePharmacyId && <IcCheck size={13} className="text-cross-400" />}
                </button>
              ))}
              <div className="px-3 py-2 text-[10px] text-pine-200/70 border-t border-white/8 leading-relaxed">
                RLS policy: <span className="num">pharmacy_id = jwt.tenant</span> — branches never see each other.
              </div>
            </div>
          )}
        </div>

        <nav className="mt-4 px-3 flex-1">
          {NAV.map((n) => {
            const activeItem = screen === n.id;
            const b = badge(n.id);
            return (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] mb-0.5 text-left transition-all group ${
                  activeItem ? "bg-cross-600 text-white shadow-[0_6px_18px_-6px_rgba(20,165,104,0.55)]" : "text-pine-100 hover:bg-white/6 hover:text-white"
                }`}
              >
                {activeItem && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-cross-400" />}
                <span className={activeItem ? "text-white" : "text-pine-200 group-hover:text-cross-400 transition-colors"}>{n.icon({ size: 17 })}</span>
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">{n.label}</span>
                  <span className={`block text-[10px] leading-tight ${activeItem ? "text-cross-100" : "text-pine-200/60"}`}>{n.hint}</span>
                </span>
                {b > 0 && (
                  <span className={`num text-[10px] font-bold px-1.5 py-0.5 rounded-md ${activeItem ? "bg-white/20 text-white" : "bg-warn-500/20 text-warn-500"}`}>
                    {b}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-3">
          <div className="rounded-lg bg-white/4 border border-white/8 px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-cross-600/25 text-cross-400 font-display font-bold text-[12px] flex items-center justify-center">
              RH
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12px] font-semibold text-white truncate">Rafiq Hasan</div>
              <div className="text-[10px] text-pine-200/70">Owner · {active.code} branch</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-cross-400 blink-dot" title="Online" />
          </div>
          <button
            onClick={() => setConfirmReset(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-pine-200/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <IcRefresh size={12} /> Reset demo data
          </button>
        </div>
      </aside>

      {/* ============ main ============ */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[58px] shrink-0 bg-card/80 backdrop-blur border-b border-line flex items-center gap-4 px-5 no-print">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-[16px] text-ink-900 leading-tight tracking-tight">
              {TITLES[screen].title}
            </h1>
            <p className="text-[11px] text-ink-400 leading-tight truncate">{TITLES[screen].sub}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-ink-400">
              <Kbd light>F2</Kbd> <span>search</span>
              <span className="mx-1 text-line">|</span>
              <Kbd light>Enter</Kbd> <span>payment</span>
              <span className="mx-1 text-line">|</span>
              <Kbd light>Esc</Kbd> <span>close</span>
            </div>

            <div key={cash} className="drawer-pulse flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5">
              <IcCash size={15} className="text-cross-600" />
              <div className="leading-tight">
                <div className="label-caps text-[8.5px]">Cash drawer</div>
                <div className="num text-[13px] font-bold text-ink-900">{tk(cash)}</div>
              </div>
            </div>

            <div className="hidden md:block text-right leading-tight">
              <div className="num text-[13px] font-semibold text-ink-900">{fmtTime(now.toISOString())}</div>
              <div className="text-[10px] text-ink-400">
                {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                <span className="text-cross-600 font-semibold">{custCount} customers</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0">{children}</main>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?" width="max-w-sm"
        subtitle="Regenerates 30 days of seeded history for both branches.">
        <div className="p-5 flex justify-end gap-2.5">
          <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded-md text-[13px] font-semibold text-ink-500 hover:bg-paper transition-colors">
            Keep my data
          </button>
          <button
            onClick={() => {
              api.resetDemo();
              setConfirmReset(false);
              toast("warn", "Demo data regenerated", "Fresh 30-day history seeded for both branches.");
            }}
            className="px-4 py-2 rounded-md text-[13px] font-semibold bg-danger-600 text-white hover:bg-danger-700 transition-colors"
          >
            Reset everything
          </button>
        </div>
      </Modal>
    </div>
  );
}
