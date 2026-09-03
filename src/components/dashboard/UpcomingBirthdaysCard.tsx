import { Gift } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { Badge } from "@/components/ui/Badge";
import type { UpcomingBirthday } from "@/lib/types";

const MOCK_BIRTHDAYS: UpcomingBirthday[] = [
  { id: "1", fullName: "Arthur Bourliet", age: 2, date: "Aujourd'hui", isToday: true },
  { id: "2", fullName: "Camille Bourliet", age: 2, date: "Aujourd'hui", isToday: true },
  { id: "3", fullName: "Marine Santoni", age: 10, date: "le 07/08", isToday: false },
  { id: "4", fullName: "Childebert Bouarch", age: 29, date: "le 07/08", isToday: false },
  { id: "5", fullName: "Julien Chambaron", age: 35, date: "le 07/08", isToday: false },
  { id: "6", fullName: "Tiphaine Le Carduec", age: 28, date: "le 07/08", isToday: false },
];

export function UpcomingBirthdaysCard() {
  return (
    <WidgetCard title="Prochains anniversaires" icon={Gift}>
      <ul className="max-h-80 space-y-2.5 overflow-y-auto scrollbar-thin">
        {MOCK_BIRTHDAYS.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                {b.fullName.charAt(0)}
              </span>
              <p className="truncate text-sm text-slate-700">{b.fullName}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone="teal">{b.age} ans</Badge>
              <Badge tone={b.isToday ? "amber" : "slate"}>{b.date}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
