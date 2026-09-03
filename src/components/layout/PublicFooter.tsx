export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">
        <p className="font-medium text-slate-700">Paroisse Saint Roch de Mazargues</p>
        <p className="mt-1">contact@paroisse-exemple.fr · 04 00 00 00 00</p>
        <p className="mt-4 text-xs text-slate-400">© {new Date().getFullYear()} gParoisse — Gestion paroissiale</p>
      </div>
    </footer>
  );
}
