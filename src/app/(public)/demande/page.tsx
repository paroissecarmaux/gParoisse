import { CheckCircle2 } from "lucide-react";
import { submitRequestAction } from "./actions";

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-800">Faire une demande</h1>
      <p className="mt-1 text-sm text-slate-500">
        Certificat de baptême, inscription à un sacrement, ou toute autre demande auprès de la paroisse.
      </p>

      {sent === "1" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          Votre demande a bien été envoyée. Nous vous répondrons prochainement.
        </div>
      )}

      <form action={submitRequestAction} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Prénom</label>
            <input
              name="firstName"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Nom</label>
            <input
              name="lastName"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Type de demande</label>
          <select
            name="requestType"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          >
            <option>Certificat de baptême</option>
            <option>Inscription à un sacrement</option>
            <option>Demande de funérailles</option>
            <option>Autre</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Message</label>
          <textarea
            name="message"
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Envoyer la demande
        </button>
      </form>
    </div>
  );
}
