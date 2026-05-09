"use client";

import { useActionState, useState } from "react";
import { Crosshair, MapPin, Save } from "lucide-react";
import {
  updateGeofenceAction,
  type GeofenceState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";

const initialState: GeofenceState = { error: null, ok: false };

export function GeofenceSection({
  groupId,
  initialEnabled,
  initialLat,
  initialLng,
  initialRadius,
}: {
  groupId: string;
  initialEnabled: boolean;
  initialLat: number | null;
  initialLng: number | null;
  initialRadius: number | null;
}) {
  const action = updateGeofenceAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [lat, setLat] = useState(initialLat?.toString() ?? "");
  const [lng, setLng] = useState(initialLng?.toString() ?? "");
  const [radius, setRadius] = useState(initialRadius?.toString() ?? "100");
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  function pickCurrentLocation() {
    setPickError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPickError("Tu navegador no soporta geolocalización.");
      return;
    }
    setPicking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setPicking(false);
      },
      (err) => {
        setPickError(`No se pudo obtener tu ubicación: ${err.message}`);
        setPicking(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          Geofencing del local
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 pt-0">
        <p className="text-sm text-muted-foreground">
          Cuando está activado, al fichar el empleado le pedimos su ubicación.
          Si está fuera del radio, marcamos el turno para que vos lo revises
          (no lo bloqueamos). Si el empleado niega permiso, también queda
          marcado.
        </p>

        <form action={formAction} className="space-y-4">
          <input
            type="hidden"
            name="enabled"
            value={enabled ? "1" : "0"}
          />
          <input type="hidden" name="lat" value={lat} />
          <input type="hidden" name="lng" value={lng} />
          <input type="hidden" name="radius_m" value={radius} />

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium">
              Activar geofencing en este grupo
            </span>
          </label>

          {enabled && (
            <div className="space-y-4 rounded-lg border border-border bg-surface-muted/40 p-4">
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={pickCurrentLocation}
                  disabled={picking}
                >
                  <Crosshair className="h-3.5 w-3.5" aria-hidden />
                  {picking
                    ? "Obteniendo ubicación…"
                    : "Usar mi ubicación actual"}
                </Button>
                {pickError && (
                  <p className="mt-2 text-xs text-danger">{pickError}</p>
                )}
                <Hint>
                  Apretá esto parado en el local. Toma la lat/lng del
                  dispositivo y la usa como centro del radio.
                </Hint>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="lat-display">Latitud</Label>
                  <Input
                    id="lat-display"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="-34.603722"
                    inputMode="decimal"
                  />
                </Field>
                <Field>
                  <Label htmlFor="lng-display">Longitud</Label>
                  <Input
                    id="lng-display"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="-58.381592"
                    inputMode="decimal"
                  />
                </Field>
              </div>

              <Field>
                <Label htmlFor="radius-display">Radio (metros)</Label>
                <Input
                  id="radius-display"
                  type="number"
                  min="10"
                  max="100000"
                  step="10"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                />
                <Hint>
                  Entre 10 m (un mostrador) y 100 km (cobertura amplia). Para
                  un local típico, 50-150 m alcanza.
                </Hint>
              </Field>
            </div>
          )}

          {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
          {state.ok && (
            <p className="text-sm text-accent-soft-foreground">
              Cambios guardados.
            </p>
          )}

          <div className="flex justify-end">
            <SubmitButton fullWidth={false}>
              <Save className="h-4 w-4" aria-hidden />
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
