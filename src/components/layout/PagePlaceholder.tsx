import type { LucideIcon } from "lucide-react";

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">{title}</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <Icon size={28} className="text-teal-600" />
        <p className="max-w-sm text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
