import { CalendarDays } from "lucide-react";

const MOCK_EVENTS = [
  { id: "1", title: "Messe dominicale", date: "Chaque dimanche, 10h30" },
  { id: "2", title: "Catéchisme enfants", date: "Mercredi 17h00" },
  { id: "3", title: "Adoration eucharistique", date: "Premier vendredi du mois, 20h00" },
];

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-800">Événements</h1>
      <p className="mt-1 text-sm text-slate-500">Les prochains rendez-vous de la paroisse.</p>

      <ul className="mt-6 space-y-3">
        {MOCK_EVENTS.map((event) => (
          <li key={event.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <CalendarDays size={20} className="mt-0.5 shrink-0 text-teal-600" />
            <div>
              <p className="font-medium text-slate-800">{event.title}</p>
              <p className="text-sm text-slate-500">{event.date}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
