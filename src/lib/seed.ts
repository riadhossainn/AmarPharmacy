import type {
  AppState,
  Customer,
  InventoryItem,
  LedgerEntry,
  MasterMedicine,
  PayMethod,
  Pharmacy,
  ReturnRecord,
  Sale,
  SaleItem,
} from "./types";
import { round2 } from "./format";

/* Deterministic RNG so every fresh install tells the same story */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PHARMACIES: Pharmacy[] = [
  {
    id: "ph-dhm",
    code: "DHM",
    name: "AmarPharmacy · Dhanmondi",
    name_bn: "আমার ফার্মেসী, ধানমন্ডি",
    address: "Shop 12, Road 27, Dhanmondi, Dhaka 1209",
    phone: "01711-223344",
  },
  {
    id: "ph-utk",
    code: "UTK",
    name: "AmarPharmacy · Uttara",
    name_bn: "আমার ফার্মেসী, উত্তরা",
    address: "Plot 45, Sector 7, Uttara, Dhaka 1230",
    phone: "01819-556677",
  },
];

/* Shared master list — structural data only, NO prices (pricing-agnostic by design) */
const M = (
  id: string,
  brand_name: string,
  generic_name: string,
  manufacturer: string,
  strength: string,
  form: string,
  rx: boolean,
  category: string
): MasterMedicine => ({ id, brand_name, generic_name, manufacturer, strength, form, rx, category });

const MASTER: MasterMedicine[] = [
  M("m01", "Napa", "Paracetamol", "Beximco Pharma", "500mg", "Tablet", false, "Analgesic"),
  M("m02", "Napa Extra", "Paracetamol + Caffeine", "Beximco Pharma", "500mg+65mg", "Tablet", false, "Analgesic"),
  M("m03", "Napa Extend", "Paracetamol ER", "Beximco Pharma", "665mg", "Tablet", false, "Analgesic"),
  M("m04", "Napa Syrup", "Paracetamol", "Beximco Pharma", "120mg/5ml", "Syrup", false, "Analgesic"),
  M("m05", "Renofen", "Ibuprofen", "Renata", "400mg", "Tablet", false, "Analgesic"),
  M("m06", "Mefnac", "Mefenamic Acid", "Square Pharma", "500mg", "Tablet", false, "Analgesic"),
  M("m07", "Disprin", "Aspirin", "Reckitt Healthcare", "300mg", "Tablet", false, "Analgesic"),
  M("m08", "Seclo", "Esomeprazole", "Square Pharma", "20mg", "Capsule", true, "Gastro"),
  M("m09", "Seclo 40", "Esomeprazole", "Square Pharma", "40mg", "Capsule", true, "Gastro"),
  M("m10", "Maxpro", "Esomeprazole", "Renata", "20mg", "Tablet", true, "Gastro"),
  M("m11", "Risek", "Omeprazole", "Square Pharma", "20mg", "Capsule", true, "Gastro"),
  M("m12", "Pantosec", "Pantoprazole", "Square Pharma", "40mg", "Tablet", true, "Gastro"),
  M("m13", "Rabonik", "Rabeprazole", "Incepta Pharma", "20mg", "Tablet", true, "Gastro"),
  M("m14", "Motidom", "Domperidone", "Square Pharma", "10mg", "Tablet", true, "Gastro"),
  M("m15", "Flagyl", "Metronidazole", "Sanofi-Aventis BD", "400mg", "Tablet", true, "Antibiotic"),
  M("m16", "Azomax", "Azithromycin", "Incepta Pharma", "500mg", "Tablet", true, "Antibiotic"),
  M("m17", "Azithral", "Azithromycin", "Alembic Pharma", "250mg", "Capsule", true, "Antibiotic"),
  M("m18", "Augmentin", "Amoxicillin+Clavulanate", "GSK Bangladesh", "625mg", "Tablet", true, "Antibiotic"),
  M("m19", "Denim", "Cefixime", "Renata", "400mg", "Tablet", true, "Antibiotic"),
  M("m20", "Trixon", "Ceftriaxone", "Incepta Pharma", "1g", "Injection", true, "Antibiotic"),
  M("m21", "Doxy-A", "Doxycycline", "Square Pharma", "100mg", "Capsule", true, "Antibiotic"),
  M("m22", "Cinoflox", "Ciprofloxacin", "Incepta Pharma", "500mg", "Tablet", true, "Antibiotic"),
  M("m23", "Fenadine", "Fexofenadine", "Opsonin Pharma", "120mg", "Tablet", false, "Antihistamine"),
  M("m24", "Cetriz", "Cetirizine", "Square Pharma", "10mg", "Tablet", false, "Antihistamine"),
  M("m25", "Monluk", "Montelukast", "Square Pharma", "10mg", "Tablet", true, "Respiratory"),
  M("m26", "Ventolin Inhaler", "Salbutamol", "GSK Bangladesh", "100mcg", "Inhaler", true, "Respiratory"),
  M("m27", "Tusnil", "Diphenhydramine", "Square Pharma", "100ml", "Syrup", false, "Respiratory"),
  M("m28", "Acard", "Amlodipine", "Square Pharma", "5mg", "Tablet", true, "Cardiac"),
  M("m29", "Telmik", "Telmisartan", "Square Pharma", "40mg", "Tablet", true, "Cardiac"),
  M("m30", "Glucophage", "Metformin", "Merck (BD)", "500mg", "Tablet", true, "Diabetes"),
  M("m31", "Daonil", "Glibenclamide", "Sanofi-Aventis BD", "5mg", "Tablet", true, "Diabetes"),
  M("m32", "Surbex-Z", "Multivitamin + Zinc", "Abbott BD", "—", "Tablet", false, "Vitamins"),
  M("m33", "Neurobion", "Vitamin B1+B6+B12", "P&G Health BD", "—", "Tablet", false, "Vitamins"),
  M("m34", "Zincat", "Zinc Sulphate", "Square Pharma", "20mg", "Tablet", false, "Vitamins"),
  M("m35", "Oraline", "ORS (WHO formula)", "Square Pharma", "10.4g sachet", "Sachet", false, "ORS"),
  M("m36", "Orosal-N", "ORS + Zinc", "Opsonin Pharma", "10.4g sachet", "Sachet", false, "ORS"),
  M("m37", "Zentel", "Albendazole", "GSK Bangladesh", "400mg", "Tablet", false, "Anthelmintic"),
  M("m38", "Coartem", "Artemether+Lumefantrine", "Novartis BD", "20mg+120mg", "Tablet", true, "Antimalarial"),
  M("m39", "Esita", "Escitalopram", "Square Pharma", "10mg", "Tablet", true, "CNS"),
  M("m40", "Setron", "Ondansetron", "Square Pharma", "4mg", "Tablet", true, "Gastro"),
  M("m41", "Gaviscon", "Alginate+Antacid", "Reckitt BD", "200ml", "Syrup", false, "Gastro"),
  M("m42", "Dicon", "Diclofenac Sodium", "Square Pharma", "50mg", "Tablet", true, "Analgesic"),
];

const FIRST = ["Abdul", "Rahim", "Salma", "Kamal", "Nasrin", "Jashim", "Farida", "Mizan", "Rina", "Habib", "Shafiq", "Taslima", "Arif", "Nusrat", "Bappy", "Dulal", "Sathi", "Imran"];
const LAST = ["Karim", "Begum", "Mia", "Khatun", "Hossain", "Akter", "Rahman", "Sikder", "Molla", "Sheikh"];
const AREAS = ["Dhanmondi", "Kalabagan", "Lalmatia", "Mohammadpur", "Uttara", "Banasree", "Mirpur", "Badda"];

const CUSTOM_ITEMS = [
  { brand_name: "HerboCough", generic_name: "Tulsi & Honey Extract", manufacturer: "Kusum Herbal", strength: "100ml", form: "Syrup" },
  { brand_name: "Orsalin-Z Kid", generic_name: "ORS Paediatric", manufacturer: "Local Compounding", strength: "5.2g sachet", form: "Sachet" },
  { brand_name: "Pudin Hara", generic_name: "Menthol Carminative", manufacturer: "Dabur (import)", strength: "10ml", form: "Drops" },
];

const RACKS = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2", "E1", "F1"];
const CASHIERS = ["Rafiq Hasan", "Sumi Akter", "Jamil Uddin"];

function piecesPerBox(form: string, rnd: () => number): number {
  if (form === "Tablet" || form === "Capsule") return [10, 20, 30, 50, 100][Math.floor(rnd() * 5)];
  if (form === "Sachet" || form === "Suppository") return [5, 10][Math.floor(rnd() * 2)];
  return 1;
}

function buildInventory(pharmacyId: string, masters: MasterMedicine[], seed: number): InventoryItem[] {
  const rnd = mulberry32(seed);
  const shuffled = [...masters].sort(() => rnd() - 0.5);
  const picked = shuffled.slice(0, pharmacyId === "ph-dhm" ? 32 : 28);
  const now = Date.now();
  const rows: InventoryItem[] = [];

  picked.forEach((m, i) => {
    const ppb = piecesPerBox(m.form, rnd);
    const base = m.form === "Injection" ? 40 + rnd() * 120 : m.form === "Inhaler" ? 180 + rnd() * 140 : m.category === "Antibiotic" ? 4 + rnd() * 26 : 0.8 + rnd() * 18;
    const buying = round2(Math.max(0.8, base));
    const selling = round2(buying * (1.14 + rnd() * 0.3));
    const reorder = 30 + Math.floor(rnd() * 90);
    let stock = 25 + Math.floor(rnd() * 480);
    if (i < 5) stock = Math.max(4, reorder - 5 - Math.floor(rnd() * 22)); // guaranteed low-stock rows
    let expiryDays: number;
    if (i < 4) expiryDays = 12 + Math.floor(rnd() * 42); // expiring within 60d
    else if (i < 7) expiryDays = 61 + Math.floor(rnd() * 50);
    else expiryDays = 150 + Math.floor(rnd() * 700);
    const exp = new Date(now + expiryDays * 86_400_000);

    rows.push({
      id: `inv-${pharmacyId}-${i + 1}`,
      pharmacy_id: pharmacyId,
      master_medicine_id: m.id,
      is_custom: false,
      brand_name: m.brand_name,
      generic_name: m.generic_name,
      manufacturer: m.manufacturer,
      strength: m.strength,
      form: m.form,
      rack: RACKS[Math.floor(rnd() * RACKS.length)],
      row: String(1 + Math.floor(rnd() * 6)),
      pieces_per_box: ppb,
      total_pieces: stock,
      reorder_level: reorder,
      buying_price: buying,
      selling_price: selling,
      batch_no: `B${exp.getFullYear()}${String(100 + Math.floor(rnd() * 900))}`,
      expiry_date: exp.toISOString().slice(0, 10),
      updated_at: new Date(now - Math.floor(rnd() * 20) * 86_400_000).toISOString(),
    });
  });

  // tenant-private custom rows (master_medicine_id = null)
  const customPick = CUSTOM_ITEMS.slice(0, pharmacyId === "ph-dhm" ? 3 : 2);
  customPick.forEach((c, i) => {
    const ppb = piecesPerBox(c.form, rnd);
    const buying = round2(20 + rnd() * 60);
    rows.push({
      id: `inv-${pharmacyId}-c${i + 1}`,
      pharmacy_id: pharmacyId,
      master_medicine_id: null,
      is_custom: true,
      ...c,
      rack: RACKS[Math.floor(rnd() * RACKS.length)],
      row: String(1 + Math.floor(rnd() * 6)),
      pieces_per_box: ppb,
      total_pieces: 12 + Math.floor(rnd() * 60),
      reorder_level: 12,
      buying_price: buying,
      selling_price: round2(buying * 1.3),
      batch_no: `C${2025}${100 + i}`,
      expiry_date: new Date(now + (200 + Math.floor(rnd() * 300)) * 86_400_000).toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
  });

  return rows;
}

function buildCustomers(pharmacyId: string, seed: number): Customer[] {
  const rnd = mulberry32(seed);
  const n = pharmacyId === "ph-dhm" ? 14 : 11;
  const out: Customer[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `cus-${pharmacyId}-${i + 1}`,
      pharmacy_id: pharmacyId,
      name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`,
      phone: `01${["7", "8", "9", "6", "3"][Math.floor(rnd() * 5)]}${String(Math.floor(rnd() * 1e8)).padStart(8, "0")}`,
      area: AREAS[Math.floor(rnd() * AREAS.length)],
      created_at: new Date(Date.now() - Math.floor(rnd() * 300) * 86_400_000).toISOString(),
    });
  }
  return out;
}

interface GenResult {
  sales: Sale[];
  returns: ReturnRecord[];
  ledger: LedgerEntry[];
  restock: Record<string, number>;
  cashNet: number;
  repayEvents: { customerId: string; amount: number; at: string; method: PayMethod }[];
}

function generateHistory(pharmacyId: string, inventory: InventoryItem[], customers: Customer[], seed: number): GenResult {
  const rnd = mulberry32(seed);
  const now = new Date();
  const sales: Sale[] = [];
  const returns: ReturnRecord[] = [];
  const ledger: LedgerEntry[] = [];
  const restock: Record<string, number> = {};
  let cashNet = 0;
  let seq = 0;

  for (let day = 29; day >= 0; day--) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - day);
    const dow = dayDate.getDay();
    const busy = dow === 4 || dow === 5 || dow === 6 ? 4 : 0; // Thu–Sat rush
    const count = 6 + busy + Math.floor(rnd() * 8) - (day === 0 ? 3 : 0);

    for (let s = 0; s < count; s++) {
      seq++;
      const at = new Date(dayDate);
      at.setHours(8 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0);
      if (at > now) at.setTime(now.getTime() - Math.floor(rnd() * 3 * 3_600_000));

      const itemCount = 1 + Math.floor(rnd() * 4);
      const chosen = new Set<number>();
      while (chosen.size < itemCount) chosen.add(Math.floor(rnd() * inventory.length));

      const saleId = `sal-${pharmacyId}-${seq}`;
      const items: SaleItem[] = [];
      let subtotal = 0;
      let profit = 0;

      [...chosen].forEach((idx, k) => {
        const inv = inventory[idx];
        const qty = inv.pieces_per_box === 1 ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 22);
        const line = round2(qty * inv.selling_price);
        const prf = round2(qty * (inv.selling_price - inv.buying_price));
        subtotal = round2(subtotal + line);
        profit = round2(profit + prf);
        items.push({
          id: `${saleId}-i${k}`,
          sale_id: saleId,
          pharmacy_id: pharmacyId,
          inventory_id: inv.id,
          medicine_name: inv.brand_name,
          strength: inv.strength,
          form: inv.form,
          rack: inv.rack,
          qty_pieces: qty,
          unit_price: inv.selling_price,
          buying_price: inv.buying_price,
          line_total: line,
          profit: prf,
          returned_qty: 0,
        });
      });

      const discount = rnd() < 0.12 ? round2(subtotal * (0.02 + rnd() * 0.03)) : 0;
      const total = round2(subtotal - discount);
      profit = round2(profit - discount);

      let customer: Customer | null = null;
      if (rnd() < 0.5) customer = customers[Math.floor(rnd() * customers.length)];

      const method: PayMethod =
        rnd() < 0.58 ? "Cash" : rnd() < 0.6 ? "bKash" : rnd() < 0.4 ? "Nagad" : "Card";
      const hasDue = customer !== null && rnd() < 0.4;
      const paid = hasDue ? round2(total * (0.3 + rnd() * 0.5)) : total;
      const due = round2(Math.max(0, total - paid));

      const sale: Sale = {
        id: saleId,
        invoice_no: `AP-${pharmacyId === "ph-dhm" ? "DHM" : "UTK"}-${String(seq).padStart(5, "0")}`,
        pharmacy_id: pharmacyId,
        customer_id: customer?.id ?? null,
        customer_name: customer?.name ?? "Walk-in Customer",
        customer_phone: customer?.phone ?? "",
        items,
        subtotal,
        discount,
        total,
        paid_amount: paid,
        due_amount: due,
        payment_method: method,
        profit,
        status: "Completed",
        cashier: CASHIERS[Math.floor(rnd() * CASHIERS.length)],
        created_at: at.toISOString(),
      };

      if (due > 0 && customer) {
        ledger.push({
          id: `led-${saleId}`,
          pharmacy_id: pharmacyId,
          customer_id: customer.id,
          type: "sale_due",
          amount: due,
          sale_id: saleId,
          note: `Baki from invoice ${sale.invoice_no}`,
          created_at: at.toISOString(),
        });
      }
      if (method === "Cash") cashNet += paid;

      // sprinkle some historical returns (restock + cash out)
      if (day >= 2 && day <= 26 && rnd() < 0.05) {
        const item = items[Math.floor(rnd() * items.length)];
        const full = rnd() < 0.35;
        const rq = full ? item.qty_pieces : Math.max(1, Math.floor(item.qty_pieces / 2));
        const refund = round2((item.line_total / item.qty_pieces) * rq);
        item.returned_qty = rq;
        sale.status = full && items.length === 1 ? "Returned" : "Partially_Returned";
        sale.profit = round2(sale.profit - rq * (item.unit_price - item.buying_price));
        restock[item.inventory_id] = (restock[item.inventory_id] ?? 0) + rq;
        const rAt = new Date(at.getTime() + (4 + rnd() * 40) * 3_600_000);
        returns.push({
          id: `ret-${saleId}`,
          pharmacy_id: pharmacyId,
          original_sale_id: saleId,
          invoice_no: sale.invoice_no,
          items: [{ sale_item_id: item.id, medicine_name: item.medicine_name, qty: rq, refund }],
          total_refund_amount: refund,
          refund_mode: "cash",
          created_at: rAt.toISOString(),
        });
        cashNet -= refund;
      }

      sales.push(sale);
    }
  }

  // baki repayments across the month
  const repayEvents: GenResult["repayEvents"] = [];
  const duesByCustomer = new Map<string, number>();
  ledger.forEach((l) => duesByCustomer.set(l.customer_id, (duesByCustomer.get(l.customer_id) ?? 0) + l.amount));
  const debtors = [...duesByCustomer.entries()].filter(([, v]) => v > 0);
  debtors.slice(0, 6).forEach(([cid, dueAmt], i) => {
    const amt = round2(Math.min(dueAmt, 100 + rnd() * dueAmt));
    const at = new Date(now.getTime() - Math.floor(rnd() * 12 + i) * 86_400_000);
    const method: PayMethod = rnd() < 0.7 ? "Cash" : "bKash";
    repayEvents.push({ customerId: cid, amount: amt, at: at.toISOString(), method });
    if (method === "Cash") cashNet += amt;
  });

  return { sales, returns, ledger, restock, cashNet, repayEvents };
}

export function buildSeedState(): AppState {
  const inventory: InventoryItem[] = [];
  const customers: Customer[] = [];
  const sales: Sale[] = [];
  const returns: ReturnRecord[] = [];
  const ledger: LedgerEntry[] = [];
  const cashDrawer: Record<string, number> = {};
  const invoiceCounter: Record<string, number> = {};

  PHARMACIES.forEach((ph, pi) => {
    const inv = buildInventory(ph.id, MASTER, 400 + pi * 977);
    const cus = buildCustomers(ph.id, 900 + pi * 313);
    const hist = generateHistory(ph.id, inv, cus, 5000 + pi * 1031);

    // apply restocks from historical returns
    Object.entries(hist.restock).forEach(([invId, qty]) => {
      const row = inv.find((r) => r.id === invId);
      if (row) row.total_pieces += qty;
    });

    hist.repayEvents.forEach((r, i) => {
      ledger.push({
        id: `led-repay-${ph.id}-${i}`,
        pharmacy_id: ph.id,
        customer_id: r.customerId,
        type: "repayment",
        amount: r.amount,
        sale_id: null,
        note: `Baki repayment via ${r.method}`,
        created_at: r.at,
      });
    });

    inventory.push(...inv);
    customers.push(...cus);
    sales.push(...hist.sales);
    returns.push(...hist.returns);
    ledger.push(...hist.ledger);
    cashDrawer[ph.id] = round2(18_000 + hist.cashNet);
    invoiceCounter[ph.id] = hist.sales.length + 1;
  });

  return {
    pharmacies: PHARMACIES,
    activePharmacyId: PHARMACIES[0].id,
    masterMedicines: MASTER,
    inventory,
    customers,
    sales,
    returns,
    ledger,
    cashDrawer,
    invoiceCounter,
    seededAt: new Date().toISOString(),
  };
}
