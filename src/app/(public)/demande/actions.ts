"use server";

import { redirect } from "next/navigation";

export async function submitRequestAction(_formData: FormData) {
  redirect("/demande?sent=1");
}
