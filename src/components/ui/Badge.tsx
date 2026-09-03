import type { ReactNode } from "react";

type BadgeTone = "teal" | "slate" | "rose" | "amber";

const TONE_CLASSES: Record<BadgeTone, string> = {
  teal: "bg-teal-100 text-teal-700",
  slate: "bg-slate-800 text-white",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
