"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signInWithGoogleAction } from "./oauth-actions";

/** Official four-colour Google "G". */
function GoogleIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 18 18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
      ) : (
        <GoogleIcon />
      )}
      {pending ? "Conectando con Google…" : label}
    </button>
  );
}

/**
 * Google sign-in. Identical on both screens because OAuth has no separate
 * "register" step — Supabase creates the account on first sign-in.
 *
 * `next` rides along so an invite link still lands on the invitation after
 * the round trip through Google.
 */
export function GoogleButton({
  next,
  label = "Continuar con Google",
}: {
  next?: string;
  label?: string;
}) {
  return (
    <form action={signInWithGoogleAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <GoogleSubmit label={label} />
    </form>
  );
}

/** "o" rule used to separate the Google button from the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">o</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
