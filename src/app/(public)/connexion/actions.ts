"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const redirectTo = formData.get("redirectTo")?.toString() || "/dashboard";

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "demo", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(redirectTo);
}
