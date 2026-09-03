"use client";

import Link from "next/link";
import { useState } from "react";
import { Church, Menu, X } from "lucide-react";

const LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Événements", href: "/evenements" },
  { label: "Faire une demande", href: "/demande" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-teal-700">
          <Church size={24} strokeWidth={2.2} />
          <span className="text-lg font-bold tracking-tight">gParoisse</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-teal-700">
              {link.label}
            </Link>
          ))}
          <Link
            href="/connexion"
            className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Connexion
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ouvrir le menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/connexion"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-lg bg-teal-600 px-2 py-2 text-center text-sm font-medium text-white"
          >
            Connexion
          </Link>
        </nav>
      )}
    </header>
  );
}
