import { Church } from "lucide-react";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <Church size={32} className="text-teal-600" />
      <h1 className="mt-3 text-xl font-semibold text-slate-800">Connexion</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        Accédez à l&apos;espace de gestion de la paroisse.
      </p>

      <form action={loginAction} className="mt-6 w-full space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />

        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            name="email"
            required
            defaultValue="elodie.moreau@paroisse-exemple.fr"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Mot de passe</label>
          <input
            type="password"
            name="password"
            required
            defaultValue="demo"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Se connecter
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-400">
        Version de démonstration : la connexion accepte n&apos;importe quel identifiant.
      </p>
    </div>
  );
}
