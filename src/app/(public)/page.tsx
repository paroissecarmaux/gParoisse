import Link from "next/link";
import { CalendarDays, FileText, Church } from "lucide-react";

export default function PublicHomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-14 text-center text-white">
        <Church size={36} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold sm:text-3xl">Paroisse Saint Roch de Mazargues</h1>
        <p className="mx-auto mt-3 max-w-xl text-teal-50">
          Retrouvez les informations de la paroisse, les événements à venir et faites vos demandes en ligne.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/evenements"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md"
        >
          <CalendarDays size={22} className="text-teal-600" />
          <h2 className="mt-3 text-lg font-semibold text-slate-800">Événements</h2>
          <p className="mt-1 text-sm text-slate-500">Messes, célébrations et temps forts de la paroisse.</p>
        </Link>

        <Link
          href="/demande"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md"
        >
          <FileText size={22} className="text-teal-600" />
          <h2 className="mt-3 text-lg font-semibold text-slate-800">Faire une demande</h2>
          <p className="mt-1 text-sm text-slate-500">Certificat, inscription à un sacrement, contact direct.</p>
        </Link>
      </section>
    </div>
  );
}
