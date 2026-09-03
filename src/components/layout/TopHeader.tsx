"use client";

import { Search, LayoutGrid, RotateCcw, Menu, LogOut } from "lucide-react";
import { logoutAction } from "@/app/(admin)/actions";
import type { SessionUser } from "@/lib/types";

export function TopHeader({ user, onMenuClick }: { user: SessionUser; onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 md:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Rechercher (Ctrl+/)"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-600 placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 sm:flex"
          aria-label="Applications"
        >
          <LayoutGrid size={18} />
        </button>

        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex"
        >
          <RotateCcw size={14} />
          2022-2023
        </button>

        <div className="group relative">
          <button type="button" className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
              {user.fullName.charAt(0)}
            </span>
            <span className="hidden text-sm font-medium text-slate-700 lg:inline">{user.fullName}</span>
          </button>

          <div className="invisible absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100">
            <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={15} />
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
