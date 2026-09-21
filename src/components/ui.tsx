import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";

/* ================= custom inline icon set ================= */

type IP = SVGProps<SVGSVGElement> & { size?: number };
const base = (p: IP) => {
  const { size = 18, ...rest } = p;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
};

export const IcLogo = (p: IP) => (
  <svg {...base(p)} strokeWidth={2}>
    <rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" stroke="none" opacity="0.16" />
    <path d="M10 5.5h4V10h4.5v4H14v4.5h-4V14H5.5v-4H10z" fill="currentColor" stroke="none" />
  </svg>
);
export const IcDash = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 13.5 12 4l8 9.5" />
    <path d="M6 12v8h4.5v-5h3v5H18v-8" />
  </svg>
);
export const IcScan = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
    <path d="M7 9v6M10.5 9v6M13.5 9v6M17 9v6" />
  </svg>
);
export const IcReturn = (p: IP) => (
  <svg {...base(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const IcShelf = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 4v16M20 4v16M4 9h16M4 15h16" />
    <path d="M8 9V6.5h3V9M13 15v-3.5h3V15" />
  </svg>
);
export const IcLedger = (p: IP) => (
  <svg {...base(p)}>
    <path d="M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
    <path d="M8 3.5v17M12 8h4M12 12h4M12 16h2.5" />
  </svg>
);
export const IcSearch = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IcPlus = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IcMinus = (p: IP) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IcX = (p: IP) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IcAlert = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 4 2.8 19.5h18.4Z" />
    <path d="M12 10v4.2M12 16.8v.2" />
  </svg>
);
export const IcClock = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IcPrint = (p: IP) => (
  <svg {...base(p)}>
    <path d="M7 8V3.5h10V8" />
    <rect x="4" y="8" width="16" height="8" rx="1.5" />
    <path d="M7 13.5h10v7H7z" fill="var(--color-card)" />
    <path d="M17 11h.5" />
  </svg>
);
export const IcCash = (p: IP) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="11" rx="1.5" />
    <circle cx="12" cy="12.5" r="2.6" />
    <path d="M6 10h.01M18 15h.01" />
  </svg>
);
export const IcPill = (p: IP) => (
  <svg {...base(p)}>
    <rect x="3.2" y="9" width="17.6" height="7" rx="3.5" transform="rotate(-38 12 12.5)" />
    <path d="m9.2 8.3 5.6 7.4" />
  </svg>
);
export const IcEdit = (p: IP) => (
  <svg {...base(p)}>
    <path d="m14.5 5.5 4 4L8 20H4v-4Z" />
    <path d="m12.5 7.5 4 4" />
  </svg>
);
export const IcCheck = (p: IP) => (
  <svg {...base(p)}>
    <path d="m5 13 4.5 4.5L19 7" />
  </svg>
);
export const IcChevR = (p: IP) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const IcKeyboard = (p: IP) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 14h11" />
  </svg>
);
export const IcBox = (p: IP) => (
  <svg {...base(p)}>
    <path d="m12 3 8 4v10l-8 4-8-4V7Z" />
    <path d="m4 7 8 4 8-4M12 11v10" />
  </svg>
);
export const IcTrendUp = (p: IP) => (
  <svg {...base(p)}>
    <path d="m4 16 5-5 3.5 3.5L19 8" />
    <path d="M14.5 8H19v4.5" />
  </svg>
);
export const IcTrendDown = (p: IP) => (
  <svg {...base(p)}>
    <path d="m4 8 5 5 3.5-3.5L19 16" />
    <path d="M14.5 16H19v-4.5" />
  </svg>
);
export const IcUser = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c1.3-3.2 3.8-4.8 7-4.8s5.7 1.6 7 4.8" />
  </svg>
);
export const IcPhone = (p: IP) => (
  <svg {...base(p)}>
    <path d="M6.5 4h3l1.2 3.8-1.9 1.4a12 12 0 0 0 6 6l1.4-1.9L20 14.5v3A2.5 2.5 0 0 1 17.5 20 13.5 13.5 0 0 1 4 6.5 2.5 2.5 0 0 1 6.5 4Z" />
  </svg>
);
export const IcRefresh = (p: IP) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3.5V8h-4.5" />
  </svg>
);
export const IcFlame = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 3.5c.5 3-1.4 4.6-2.9 6.3A6.5 6.5 0 0 0 12 20.5a6.5 6.5 0 0 0 6.3-6.8c0-3.4-2.2-5.2-3.1-7.7-1.6.6-2 2.3-1.9 3.8-.9-1-1.7-3.3-1.3-6.3Z" />
  </svg>
);
export const IcTrash = (p: IP) => (
  <svg {...base(p)}>
    <path d="M5 7h14M10 7V5h4v2M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </svg>
);
export const IcStore = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.6 2.6 0 0 0 5.3 0 2.65 2.65 0 0 0 5.4 0 2.6 2.6 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-5h4v5" />
  </svg>
);
export const IcSwap = (p: IP) => (
  <svg {...base(p)}>
    <path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" />
  </svg>
);
export const IcReceipt = (p: IP) => (
  <svg {...base(p)}>
    <path d="M6 3.5h12V20l-2.4-1.6L13.2 20l-2.4-1.6L8.4 20 6 18.4Z" />
    <path d="M9 8h6M9 11.5h6M9 15h3.5" />
  </svg>
);

/* ================= kbd chip ================= */

export const Kbd = ({ children, light }: { children: ReactNode; light?: boolean }) => (
  <span className={`kbd ${light ? "kbd-light" : ""}`}>{children}</span>
);

/* ================= modal ================= */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-pine-950/55 anim-fade" onClick={onClose} />
      <div
        className={`relative w-full ${width} max-h-[92vh] overflow-hidden rounded-xl bg-card border border-line shadow-[0_24px_70px_-18px_rgba(5,29,22,0.5)] anim-pop flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-linesoft">
          <div>
            <h3 className="font-display font-700 font-bold text-[15px] text-ink-900">{title}</h3>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-paper transition-colors"
            aria-label="Close"
          >
            <IcX size={16} />
          </button>
        </div>
        <div className="overflow-y-auto scroll-slim">{children}</div>
      </div>
    </div>
  );
}

/* ================= toasts ================= */

export type ToastKind = "success" | "warn" | "danger" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const ToastCtx = createContext<(kind: ToastKind, title: string, body?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const KIND_STYLE: Record<ToastKind, { bar: string; icon: ReactNode }> = {
  success: { bar: "bg-cross-500", icon: <IcCheck size={15} className="text-cross-600" /> },
  warn: { bar: "bg-warn-500", icon: <IcAlert size={15} className="text-warn-600" /> },
  danger: { bar: "bg-danger-600", icon: <IcAlert size={15} className="text-danger-600" /> },
  info: { bar: "bg-pine-700", icon: <IcCash size={15} className="text-pine-700" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nid = useRef(1);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = nid.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[320px] no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-toast relative overflow-hidden rounded-lg border border-line bg-card shadow-[0_10px_30px_-10px_rgba(5,29,22,0.35)] px-3.5 py-3 flex gap-2.5"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${KIND_STYLE[t.kind].bar}`} />
            <span className="mt-0.5 shrink-0">{KIND_STYLE[t.kind].icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-900 leading-snug">{t.title}</p>
              {t.body && <p className="text-xs text-ink-500 mt-0.5 leading-snug">{t.body}</p>}
            </div>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="ml-auto self-start text-ink-300 hover:text-ink-700 transition-colors"
            >
              <IcX size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ================= small bits ================= */

export const StatusChip = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    Completed: "bg-cross-50 text-cross-700 border-cross-200",
    Partially_Returned: "bg-warn-50 text-warn-700 border-warn-200",
    Returned: "bg-danger-50 text-danger-700 border-danger-100",
  };
  const label: Record<string, string> = {
    Completed: "Completed",
    Partially_Returned: "Partial Return",
    Returned: "Returned",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold tracking-wide ${map[status] ?? ""}`}>
      {label[status] ?? status}
    </span>
  );
};

export const RackChip = ({ rack, row }: { rack: string; row?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-pine-900 text-pine-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
    <IcShelf size={11} />
    {rack}
    {row ? <span className="opacity-60">·R{row}</span> : null}
  </span>
);
