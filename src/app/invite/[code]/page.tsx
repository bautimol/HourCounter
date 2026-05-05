import Link from "next/link";
import { AlertCircle, Clock3, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptInvitationButton } from "./accept-button";

type Invitation = {
  id: string;
  group_id: string;
  group_name: string;
  role: "employer" | "employee";
  expires_at: string | null;
  used_at: string | null;
  is_member: boolean;
};

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("get_invitation_by_code", {
    invite_code: code,
  });

  const inv = (data?.[0] ?? null) as Invitation | null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Backdrop: gradient + grid pattern + color blobs (matches auth pages) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50 via-emerald-50 to-cyan-50 dark:from-emerald-950 dark:via-zinc-950 dark:to-emerald-950"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 text-emerald-900/15 dark:text-emerald-300/10"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-600/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 -z-10 h-96 w-96 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-600/20"
      />

      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-foreground"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground shadow-md shadow-emerald-700/30">
            <Clock3 className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">
            HourCounter
          </span>
        </Link>

        {error || !inv ? (
          <InvalidInviteCard message={error?.message} />
        ) : (
          <ValidInviteCard invitation={inv} code={code} loggedIn={!!user} />
        )}
      </div>
    </div>
  );
}

function InvalidInviteCard({ message }: { message?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-danger" aria-hidden />
          Invitación inválida
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 text-sm text-muted-foreground">
        <p>
          No encontramos esta invitación. Puede que el link esté mal escrito,
          haya sido cancelada o no exista.
        </p>
        {message && (
          <p className="rounded-md bg-surface-muted px-3 py-2 font-mono text-xs">
            {message}
          </p>
        )}
        <Link href="/app">
          <Button variant="secondary">Ir a la app</Button>
        </Link>
      </CardBody>
    </Card>
  );
}

function ValidInviteCard({
  invitation,
  code,
  loggedIn,
}: {
  invitation: Invitation;
  code: string;
  loggedIn: boolean;
}) {
  const used = invitation.used_at != null;
  const expired =
    invitation.expires_at != null &&
    new Date(invitation.expires_at) < new Date();

  if (used) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitación ya usada</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-muted-foreground">
          <p>Esta invitación ya fue aceptada por alguien.</p>
          <Link href="/app">
            <Button variant="secondary">Ir a la app</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitación expirada</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-muted-foreground">
          <p>El link venció. Pedile al empleador que te genere uno nuevo.</p>
          <Link href="/app">
            <Button variant="secondary">Ir a la app</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (invitation.is_member) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ya formás parte de este grupo</CardTitle>
        </CardHeader>
        <CardBody>
          <Link href={`/app/groups/${invitation.group_id}`}>
            <Button>Ir al grupo</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const next = `/invite/${code}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const signupHref = `/signup?next=${encodeURIComponent(next)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Te invitaron a un grupo</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={invitation.group_name} size="lg" />
          <div>
            <p className="text-base font-medium">{invitation.group_name}</p>
            <Badge
              variant={invitation.role === "employer" ? "accent" : "muted"}
              className="mt-1"
            >
              Te suman como {invitation.role === "employer" ? "empleador" : "empleado"}
            </Badge>
          </div>
        </div>

        {loggedIn ? (
          <AcceptInvitationButton code={code} />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Necesitás una cuenta para aceptar la invitación.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={signupHref} className="sm:flex-1">
                <Button className="w-full">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Crear cuenta
                </Button>
              </Link>
              <Link href={loginHref} className="sm:flex-1">
                <Button variant="secondary" className="w-full">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
