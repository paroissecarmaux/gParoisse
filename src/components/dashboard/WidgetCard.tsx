import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface WidgetCardProps {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function WidgetCard({ title, icon: Icon, subtitle, children, className = "" }: WidgetCardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-start gap-2">
        {Icon && <Icon size={17} className="mt-0.5 shrink-0 text-teal-600" />}
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
