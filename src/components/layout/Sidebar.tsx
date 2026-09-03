"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Church, ChevronLeft, Search, X } from "lucide-react";
import { useState } from "react";
import { ADMIN_NAV_SECTIONS } from "@/lib/nav-config";
import { Badge } from "@/components/ui/Badge";

interface SidebarProps {
  personsCount: number;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ personsCount, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          collapsed ? "md:w-20" : "md:w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-5">
          <Link href="/dashboard" className="flex items-center gap-2 text-teal-700">
            <Church size={26} strokeWidth={2.2} />
            {!collapsed && <span className="text-xl font-bold tracking-tight">gParoisse</span>}
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 md:flex"
              aria-label="Réduire le menu"
            >
              <ChevronLeft size={14} className={collapsed ? "rotate-180" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 md:hidden"
              aria-label="Fermer le menu"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="mx-4 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
            Paroisse Saint Roch de Mazargues
          </div>
        )}

        {!collapsed && (
          <div className="relative mx-4 mt-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Globale"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-600 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
        )}

        <nav className="scrollbar-thin mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {ADMIN_NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </p>
              )}
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-teal-50 text-teal-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon size={18} className={active ? "text-teal-600" : "text-slate-400"} />
                        {!collapsed && <span className="flex-1">{item.label}</span>}
                        {!collapsed && item.badgeKey === "personsCount" && (
                          <Badge tone="slate">{personsCount}</Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
