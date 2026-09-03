import { UserCheck, Check, X } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

const MOCK_PERSONS = [
  { id: "1", name: "Mlle Catherine Chambrion Domanski" },
];

export function PendingPersonsCard() {
  return (
    <WidgetCard
      title="Personnes en attente de validation"
      icon={UserCheck}
      subtitle="NB : l'action sur une personne est répercutée sur tous les membres du foyer"
    >
      <ul className="space-y-2.5">
        {MOCK_PERSONS.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                {p.name.charAt(0)}
              </span>
              <p className="truncate text-sm text-slate-700">{p.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Valider"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                aria-label="Refuser"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-400 text-white hover:bg-rose-500"
              >
                <X size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
