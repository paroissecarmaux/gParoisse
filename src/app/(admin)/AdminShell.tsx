"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import type { SessionUser } from "@/lib/types";

const MOCK_PERSONS_COUNT = 1156;

export function AdminShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar personsCount={MOCK_PERSONS_COUNT} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopHeader user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 pb-20 md:px-6 md:pb-8">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
