"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error: string | null;
};

/**
 * Restrict ?next= to same-app paths to avoid open-redirect.
 */
function safeNext(next: string | null): string {
  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  return next;
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}
