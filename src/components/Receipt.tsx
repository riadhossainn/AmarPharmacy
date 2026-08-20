import type { Pharmacy, Sale } from "../lib/types";
import { fmtDateTime, money, tk } from "../lib/format";

function Barcode({ seed }: { seed: string }) {
  const bars = seed.split("").map((ch, i) => ({
    w: (ch.charCodeAt(0) % 3) + 1,
    gap: i % 3 === 0,
  }));
  return (
    <div className="flex items-end justify-center gap-[1.5px] h-[26px] mt-1.5">
      {bars.map((b, i) => (
        <span key={i} style={{ width: `${b.w}px`, marginRight: b.gap ? 2 : 0 }} className="h-full bg-ink-900 inline-block" />
      ))}
    </div>
  );
}

const Dash = () => <div className="border-t border-dashed border-ink-300 my-1.5" />;

export default function Receipt({ sale, pharmacy, width }: { sale: Sale; pharmacy: Pharmacy; width: "58" | "80" }) {
  const w58 = width === "58";
  return (
    <div
      id="receipt-print"
      style={{ "--receipt-width": w58 ? "58mm" : "80mm" } as React.CSSProperties}
      className={`bg-white text-ink-900 font-mono leading-[1.45] px-2 py-2 ${w58 ? "w-[58mm] text-[8.5px]" : "w-[80mm] text-[10.5px]"}`}
    >
      <div className="text-center">
        <div className="font-bold text-[1.25em] tracking-wide">AmarPharmacy</div>
        <div className="font-bn text-[1.05em]">{pharmacy.name_bn}</div>
        <div className="text-[0.9em] text-ink-700">{pharmacy.address}</div>
        <div className="text-[0.9em]">Tel: {pharmacy.phone}</div>
      </div>

      <Dash />

      <div className="grid grid-cols-2 gap-x-2 text-[0.92em]">
        <span>Invoice</span>
        <span className="text-right font-semibold">{sale.invoice_no}</span>
        <span>Date</span>
        <span className="text-right">{fmtDateTime(sale.created_at)}</span>
        <span>Cashier</span>
        <span className="text-right">{sale.cashier}</span>
        <span>Customer</span>
        <span className="text-right truncate pl-2">{sale.customer_name}</span>
        {sale.customer_phone && (
          <>
            <span>Phone</span>
            <span className="text-right">{sale.customer_phone}</span>
          </>
        )}
      </div>

      <Dash />

      <div className={`grid gap-y-0.5 text-[0.92em] ${w58 ? "grid-cols-[1fr_auto]" : "grid-cols-[26px_1fr_44px_52px]"}`}>
        {!w58 && (
          <>
            <span className="font-semibold">Qty</span>
            <span className="font-semibold">Item</span>
            <span className="font-semibold text-right">Price</span>
            <span className="font-semibold text-right">Total</span>
          </>
        )}
        {sale.items.map((it) =>
          w58 ? (
            <div key={it.id} className="col-span-2">
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  {it.medicine_name} {it.strength !== "—" ? it.strength : ""}
                </span>
                <span>{money(it.line_total)}</span>
              </div>
              <div className="text-[0.88em] text-ink-500">
                {it.qty_pieces} pc x {money(it.unit_price)}
              </div>
            </div>
          ) : (
            <div key={it.id} className="col-span-4 grid grid-cols-subgrid">
              <span>{it.qty_pieces}pc</span>
              <span className="truncate">
                {it.medicine_name} {it.strength !== "—" ? it.strength : ""}
              </span>
              <span className="text-right">{money(it.unit_price)}</span>
              <span className="text-right">{money(it.line_total)}</span>
            </div>
          )
        )}
      </div>

      <Dash />

      <div className="grid grid-cols-2 gap-x-2 text-[0.95em]">
        <span>Subtotal</span>
        <span className="text-right">{tk(sale.subtotal)}</span>
        {sale.discount > 0 && (
          <>
            <span>Discount</span>
            <span className="text-right">-{tk(sale.discount)}</span>
          </>
        )}
        <span className="font-bold text-[1.15em]">TOTAL</span>
        <span className="text-right font-bold text-[1.15em]">{tk(sale.total)}</span>
        <span>Paid ({sale.payment_method})</span>
        <span className="text-right">{tk(sale.paid_amount)}</span>
        {sale.payment_method === "Cash" && sale.paid_amount > sale.total && (
          <>
            <span>Change</span>
            <span className="text-right">{tk(sale.paid_amount - sale.total)}</span>
          </>
        )}
        {sale.due_amount > 0 && (
          <>
            <span className="font-bold">DUE (বাকি)</span>
            <span className="text-right font-bold">{tk(sale.due_amount)}</span>
          </>
        )}
      </div>

      <Dash />

      <div className="text-center">
        <div className="font-bn text-[1.05em]">ধন্যবাদ! আবার আসবেন।</div>
        <div className="text-[0.85em] text-ink-500">Medicines are not refundable without invoice.</div>
        <Barcode seed={sale.invoice_no} />
        <div className="text-[0.85em] mt-1">{sale.invoice_no}</div>
        <div className="text-[0.8em] text-ink-400 mt-1.5">Powered by AmarPharmacy SaaS</div>
      </div>
    </div>
  );
}
