"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import {
  createInvitationAction,
  type CreateInvitationState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Label,
} from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState: CreateInvitationState = { error: null, code: null };

export type PositionOption = { id: string; name: string };

export function CreateInvitationForm({
  groupId,
  origin,
  positions,
}: {
  groupId: string;
  origin: string;
  positions: PositionOption[];
}) {
  const action = createInvitationAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const [role, setRole] = useState<"employee" | "employer">("employee");

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="role">Rol en el grupo</Label>
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "employee" | "employer")
              }
            >
              <option value="employee">Empleado</option>
              <option value="employer">Empleador (co-administrador)</option>
            </Select>
          </Field>

          {role === "employee" && (
            <Field>
              <Label htmlFor="position_id">Rol del empleado</Label>
              <Select
                id="position_id"
                name="position_id"
                defaultValue=""
                disabled={positions.length === 0}
              >
                <option value="">— Sin rol —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {positions.length === 0 ? (
                <Hint>
                  No hay roles creados.{" "}
                  <Link
                    href={`/app/groups/${groupId}/positions/new`}
                    className="underline hover:text-foreground"
                  >
                    Crear uno
                  </Link>
                </Hint>
              ) : (
                <Hint>
                  Si elegís un rol, el perfil del empleado (tarifa, período de
                  pago, montos fijos) se crea automático al aceptar.
                </Hint>
              )}
            </Field>
          )}
        </div>

        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

        <SubmitButton fullWidth={false}>Generar link</SubmitButton>
      </form>

      {state.code && (
        <GeneratedLink link={`${origin}/invite/${state.code}`} />
      )}
    </div>
  );
}

function GeneratedLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  }

  return (
    <div className="rounded-md border border-accent-soft bg-accent-soft p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-accent-soft-foreground">
        Link de invitación
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copy}
          aria-label="Copiar link"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copiar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
