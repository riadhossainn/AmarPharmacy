export const round2 = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number): string =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: Math.abs(n % 1) > 0.004 ? 2 : 0,
    maximumFractionDigits: 2,
  });

export const tk = (n: number): string => `৳${money(n)}`;

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (iso: string): string => `${fmtDate(iso)} · ${fmtTime(iso)}`;

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const daysUntil = (isoDate: string): number => {
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(isoDate)).getTime();
  return Math.round((target - today) / 86_400_000);
};

export const boxSplit = (pieces: number, perBox: number): string => {
  if (perBox <= 1) return `${pieces} pc`;
  const bx = Math.floor(pieces / perBox);
  const rem = pieces % perBox;
  if (bx === 0) return `${rem} pc`;
  if (rem === 0) return `${bx} box`;
  return `${bx} bx + ${rem} pc`;
};

export const uid = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
