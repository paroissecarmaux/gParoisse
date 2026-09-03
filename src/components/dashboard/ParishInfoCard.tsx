import Link from "next/link";
import { UserPlus, Users, CalendarPlus, LifeBuoy } from "lucide-react";
import type { SessionUser } from "@/lib/types";

const QUICK_ACCESS = [
  { label: "Créer une personne", href: "/personnes/nouveau", icon: UserPlus },
  { label: "Tous les foyers", href: "/personnes/foyers", icon: Users },
  { label: "Sacrements", href: "/vie-chretienne/sacrements", icon: CalendarPlus },
];

export function ParishInfoCard({ user }: { user: SessionUser }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="font-serif text-lg italic text-slate-700">Paroisse</p>
        <p className="font-serif text-2xl italic text-teal-700">Saint Roch</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">
          Église de Mazargues
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 pt-4">
          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-teal-50 hover:text-teal-600"
              >
                <Icon size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connecté en tant que</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
            {user.fullName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{user.fullName}</p>
            <Link href="/profil" className="text-xs text-teal-600 hover:underline">
              Mon profil
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <LifeBuoy size={17} className="mt-0.5 shrink-0 text-teal-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Besoin d&apos;aide ?</p>
            <p className="mt-0.5 text-xs text-slate-400">Contactez votre administrateur paroissial.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
