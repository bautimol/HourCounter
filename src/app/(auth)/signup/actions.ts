"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
import { friendlyError } from "@/lib/errors";

export type SignupState = {
  error: string | null;
  message: string | null;
};

function safeNext(next: string | null): string {
  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  return next;
}

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? "") || null);

  if (!email || !password || !fullName) {
    return {
      error: "Nombre, email y contraseña son obligatorios",
      message: null,
    };
  }

  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres",
      message: null,
    };
  }

  if (fullName.length > 120) {
    return {
      error: "El nombre es demasiado largo (máximo 120 caracteres)",
      message: null,
    };
  }

  const supabase = await createClient();

  const origin = await getOrigin();
  // The confirm route forwards `next` as well, so the final landing is the
  // original destination after the email link is clicked.
  const confirmUrl = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: confirmUrl,
    },
  });

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos crear la cuenta. Probá de nuevo.",
      ),
      message: null,
    };
  }

  // Signing up with an already-registered email answers 200 with an empty
  // identities array (Supabase hides whether the address exists). Without this
  // check we'd promise a confirmation email that never gets sent.
  if (data.user?.identities?.length === 0) {
    return {
      error:
        "Ya existe una cuenta con ese email. Entrá desde «Iniciar sesión» acá abajo.",
      message: null,
    };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    error: null,
    message:
      "Te enviamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.",
  };
}
