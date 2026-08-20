import { useEffect, useState, type ReactNode } from "react";
import type { InventoryItem } from "../lib/types";
import { Modal, IcAlert, IcCheck } from "./ui";
import { round2 } from "../lib/format";

const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Inhaler", "Cream", "Drops", "Sachet", "Suppository"];

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-caps block mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink-900 outline-none transition-shadow focus:border-cross-500 focus:ring-2 focus:ring-cross-200 placeholder:text-ink-300";

const todayPlus = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/* ============ Custom medicine / stock-new-item form ============ */

export interface MedicineFormData {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  strength: string;
  form: string;
  pieces_per_box: number;
  rack: string;
  row: string;
  batch_no: string;
  expiry_date: string;
  buying_price: number;
  selling_price: number;
  total_pieces: number;
  reorder_level: number;
}

export function MedicineFormModal({
  open,
  onClose,
  heading,
  sub,
  lockIdentity,
  preset,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  sub: string;
  lockIdentity?: boolean;
  preset?: Partial<MedicineFormData>;
  submitLabel: string;
  onSubmit: (d: MedicineFormData) => void;
}) {
  const [d, setD] = useState<MedicineFormData>({
    brand_name: "",
    generic_name: "",
    manufacturer: "",
    strength: "",
    form: "Tablet",
    pieces_per_box: 10,
    rack: "A1",
    row: "1",
    batch_no: `B${new Date().getFullYear()}101`,
    expiry_date: todayPlus(365),
    buying_price: 0,
    selling_price: 0,
    total_pieces: 0,
    reorder_level: 20,
    ...preset,
  });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setErr("");
      setD({
        brand_name: "",
        generic_name: "",
        manufacturer: "",
        strength: "",
        form: "Tablet",
        pieces_per_box: 10,
        rack: "A1",
        row: "1",
        batch_no: `B${new Date().getFullYear()}101`,
        expiry_date: todayPlus(365),
        buying_price: 0,
        selling_price: 0,
        total_pieces: 0,
        reorder_level: 20,
        ...preset,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof MedicineFormData>(k: K, v: MedicineFormData[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const margin =
    d.selling_price > 0 ? Math.round(((d.selling_price - d.buying_price) / d.selling_price) * 100) : 0;

  const submit = () => {
    if (!d.brand_name.trim()) return setErr("Brand name is required.");
    if (d.selling_price <= 0) return setErr("Selling price (MRP) must be greater than zero.");
    if (d.total_pieces < 0) return setErr("Stock cannot be negative.");
    onSubmit(d);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={heading} subtitle={sub} width="max-w-2xl">
      <div className="p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Brand Name *">
            <input className={inputCls} value={d.brand_name} disabled={lockIdentity} onChange={(e) => set("brand_name", e.target.value)} placeholder="e.g. Seclo" />
          </Field>
          <Field label="Generic Name">
            <input className={inputCls} value={d.generic_name} disabled={lockIdentity} onChange={(e) => set("generic_name", e.target.value)} placeholder="e.g. Esomeprazole" />
          </Field>
          <Field label="Manufacturer">
            <input className={inputCls} value={d.manufacturer} disabled={lockIdentity} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Square Pharma" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Strength">
              <input className={inputCls} value={d.strength} disabled={lockIdentity} onChange={(e) => set("strength", e.target.value)} placeholder="20mg" />
            </Field>
            <Field label="Form">
              <select className={inputCls} value={d.form} disabled={lockIdentity} onChange={(e) => set("form", e.target.value)}>
                {FORMS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="col-span-2 border-t border-linesoft pt-3.5 grid grid-cols-4 gap-3">
            <Field label="Buying Price (৳/pc)">
              <input type="number" min={0} step="0.25" className={`${inputCls} num`} value={d.buying_price || ""} onChange={(e) => set("buying_price", num(e.target.value))} />
            </Field>
            <Field label="Selling Price / MRP (৳/pc)">
              <input type="number" min={0} step="0.25" className={`${inputCls} num`} value={d.selling_price || ""} onChange={(e) => set("selling_price", num(e.target.value))} />
            </Field>
            <Field label="Pieces per Box">
              <input type="number" min={1} className={`${inputCls} num`} value={d.pieces_per_box || ""} onChange={(e) => set("pieces_per_box", Math.max(1, Math.round(num(e.target.value))))} />
            </Field>
            <Field label="Opening Stock (pc)">
              <input type="number" min={0} className={`${inputCls} num`} value={d.total_pieces || ""} onChange={(e) => set("total_pieces", Math.max(0, Math.round(num(e.target.value))))} />
            </Field>
          </div>

          <div className="col-span-2 grid grid-cols-4 gap-3">
            <Field label="Rack">
              <input className={inputCls} value={d.rack} onChange={(e) => set("rack", e.target.value)} placeholder="B2" />
            </Field>
            <Field label="Row">
              <input className={inputCls} value={d.row} onChange={(e) => set("row", e.target.value)} placeholder="4" />
            </Field>
            <Field label="Batch No.">
              <input className={inputCls} value={d.batch_no} onChange={(e) => set("batch_no", e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" className={`${inputCls} num`} value={d.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
            </Field>
          </div>

          <Field label="Reorder Level (pc)">
            <input type="number" min={0} className={`${inputCls} num`} value={d.reorder_level || ""} onChange={(e) => set("reorder_level", Math.max(0, Math.round(num(e.target.value))))} />
          </Field>
          <div className="flex items-end pb-1">
            <span className={`text-[12px] font-semibold ${margin >= 15 ? "text-cross-600" : margin >= 0 ? "text-warn-600" : "text-danger-600"}`}>
              Margin {margin}% · profit ৳{money2(d.selling_price - d.buying_price)}/pc
            </span>
          </div>
        </div>

        {!lockIdentity && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-pine-900 text-pine-100 px-3.5 py-3 text-[12px] leading-relaxed">
            <IcCheck size={14} className="mt-0.5 shrink-0 text-cross-400" />
            <span>
              Saved privately to <b className="text-white">your shop's inventory</b> with{" "}
              <code className="num text-cross-400">is_custom = true</code> — the shared master catalogue is never
              touched and other pharmacies cannot see this item.
            </span>
          </div>
        )}

        {err && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 px-3.5 py-2.5 text-[12.5px] font-medium anim-slide-in">
            <IcAlert size={14} /> {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5 border-t border-linesoft pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-semibold text-ink-500 hover:bg-paper transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-md text-[13px] font-semibold bg-cross-600 text-white hover:bg-cross-700 active:scale-[0.98] transition-all shadow-[0_4px_14px_-4px_rgba(14,143,91,0.5)]"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const money2 = (n: number) => round2(n).toFixed(2);

/* ============ Price / Batch override (tenant-scoped UPDATE) ============ */

export function PriceBatchModal({
  item,
  onClose,
  onSubmit,
  pharmacyName,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSubmit: (patch: Partial<InventoryItem>, addPieces: number) => void;
  pharmacyName: string;
}) {
  const [buying, setBuying] = useState(0);
  const [selling, setSelling] = useState(0);
  const [rack, setRack] = useState("A1");
  const [row, setRow] = useState("1");
  const [ppb, setPpb] = useState(10);
  const [reorder, setReorder] = useState(20);
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [addPieces, setAddPieces] = useState(0);

  useEffect(() => {
    if (item) {
      setBuying(item.buying_price);
      setSelling(item.selling_price);
      setRack(item.rack);
      setRow(item.row);
      setPpb(item.pieces_per_box);
      setReorder(item.reorder_level);
      setBatch(item.batch_no);
      setExpiry(item.expiry_date);
      setAddPieces(0);
    }
  }, [item]);

  if (!item) return null;
  const margin = selling > 0 ? Math.round(((selling - buying) / selling) * 100) : 0;
  const oldMargin = item.selling_price > 0 ? Math.round(((item.selling_price - item.buying_price) / item.selling_price) * 100) : 0;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`Update Price / Batch — ${item.brand_name}`}
      subtitle={`${item.generic_name} · ${item.strength} — row-level UPDATE scoped to ${pharmacyName} only`}
      width="max-w-xl"
    >
      <div className="p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Buying Price (৳/pc)">
            <input type="number" min={0} step="0.25" className={`${inputCls} num`} value={buying || ""} onChange={(e) => setBuying(Number(e.target.value))} />
          </Field>
          <Field label="Selling Price / MRP (৳/pc)">
            <input type="number" min={0} step="0.25" className={`${inputCls} num`} value={selling || ""} onChange={(e) => setSelling(Number(e.target.value))} />
          </Field>
          <Field label="Batch No.">
            <input className={`${inputCls} num`} value={batch} onChange={(e) => setBatch(e.target.value)} />
          </Field>
          <Field label="Expiry Date">
            <input type="date" className={`${inputCls} num`} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </Field>
          <Field label="Rack">
            <input className={inputCls} value={rack} onChange={(e) => setRack(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Row">
              <input className={inputCls} value={row} onChange={(e) => setRow(e.target.value)} />
            </Field>
            <Field label="Pcs / Box">
              <input type="number" min={1} className={`${inputCls} num`} value={ppb || ""} onChange={(e) => setPpb(Math.max(1, Math.round(Number(e.target.value))))} />
            </Field>
          </div>
          <Field label="Reorder Level (pc)">
            <input type="number" min={0} className={`${inputCls} num`} value={reorder || ""} onChange={(e) => setReorder(Math.max(0, Math.round(Number(e.target.value))))} />
          </Field>
          <Field label="Receive Stock (+pieces)" hint="Adds into raw piece stock (box splitting safe)">
            <input type="number" min={0} className={`${inputCls} num`} value={addPieces || ""} placeholder="0" onChange={(e) => setAddPieces(Math.max(0, Math.round(Number(e.target.value))))} />
          </Field>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-paper px-3.5 py-3 flex items-center justify-between text-[12.5px]">
          <span className="text-ink-500">
            Margin: <b className="num text-ink-900">{oldMargin}%</b>
            <span className="mx-1.5 text-ink-300">→</span>
            <b className={`num ${margin >= 15 ? "text-cross-600" : margin >= 0 ? "text-warn-600" : "text-danger-600"}`}>{margin}%</b>
          </span>
          <span className="text-ink-500">
            Stock now: <b className="num text-ink-900">{item.total_pieces} pc</b>
            {addPieces > 0 && <span className="text-cross-600 num font-semibold"> + {addPieces}</span>}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-cross-50 border border-cross-200 px-3.5 py-2.5 text-[12px] text-cross-700 leading-relaxed">
          <IcCheck size={14} className="mt-0.5 shrink-0" />
          <span>
            Executes <code className="num">UPDATE pharmacy_inventory SET … WHERE id = row AND pharmacy_id = jwt.tenant</code> — zero
            effect on the global master table or other shops.
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-2.5 border-t border-linesoft pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-semibold text-ink-500 hover:bg-paper transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(
                {
                  buying_price: round2(buying),
                  selling_price: round2(selling),
                  rack,
                  row,
                  pieces_per_box: ppb,
                  reorder_level: reorder,
                  batch_no: batch,
                  expiry_date: expiry,
                },
                addPieces
              );
              onClose();
            }}
            className="px-4 py-2 rounded-md text-[13px] font-semibold bg-cross-600 text-white hover:bg-cross-700 active:scale-[0.98] transition-all shadow-[0_4px_14px_-4px_rgba(14,143,91,0.5)]"
          >
            Save Row Update
          </button>
        </div>
      </div>
    </Modal>
  );
}
