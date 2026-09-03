import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "gp_session";

const DEMO_USER: SessionUser = {
  id: "demo-user",
  fullName: "Élodie Moreau",
  email: "elodie.moreau@paroisse-exemple.fr",
  role: "admin",
};

/**
 * Placeholder session reader: only checks for the demo cookie set by the
 * mock login form. Swap the body for a Supabase `auth.getUser()` call once
 * a real project is wired up in `src/lib/supabase/server.ts`.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get(SESSION_COOKIE)?.value === "demo";
  return hasSession ? DEMO_USER : null;
}
