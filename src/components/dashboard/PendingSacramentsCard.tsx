import { Cross, Check, X } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { PendingSacrament } from "@/lib/types";

const MOCK_SACRAMENTS: PendingSacrament[] = [
  { id: "1", type: "Mariage", label: "Mariage : M. Patrick & Mme Marion", date: "01/07/2023", validated: false },
  { id: "2", type: "Mariage", label: "Mariage : Mme Marie Géraldine & M. Ivaldo", date: "02/07/2023", validated: false },
  { id: "3", type: "Baptême", label: "Baptême : Iris", date: "02/07/2023", validated: false },
  { id: "4", type: "Mariage", label: "Mariage : Mlle Juliette & M. Nicolas", date: "06/07/2023", validated: false },
  { id: "5", type: "Baptême", label: "Baptême : Marilou", date: "10/07/2023", validated: false },
];

export function PendingSacramentsCard() {
  return (
    <WidgetCard title="Sacrements en attente de validation" icon={Cross}>
      <ul className="max-h-72 space-y-2.5 overflow-y-auto scrollbar-thin">
        {MOCK_SACRAMENTS.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-700">{s.label}</p>
              <p className="text-xs text-slate-400">({s.date})</p>
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
