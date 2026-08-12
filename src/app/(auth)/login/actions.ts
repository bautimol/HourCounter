"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { safeNext } from "@/lib/safe-next";

export type AuthState = {
  error: string | null;
};

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
    return {
      error: friendlyError(
        error.message,
        "No pudimos iniciar sesión. Probá de nuevo.",
      ),
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}
