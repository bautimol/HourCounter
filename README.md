# HourCounter

Dashboard multi-empleador para tracking de horas trabajadas y cálculo automático de pagos.

## Modelo de producto

- **Grupos** — cada grupo tiene uno o más empleadores y N empleados. Una persona puede ser empleado en un grupo y empleador en otro.
- **Membresías** — la relación usuario ↔ grupo define el rol (empleador / empleado).
- **Clock in / out** — los empleados registran sus horas. Turnos sin cerrar quedan marcados para revisión, no se autocierran.
- **Perfil de empleado** — tarifa por hora + lista de montos fijos configurables (descripción, monto, frecuencia).
- **Cálculo de pago** — al momento de pagar, suma horas × tarifa + montos fijos del período + ajustes one-shot.
- **Empleado retirado** — se archiva, el historial se conserva.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Realtime)
- PWA + Web Push para notificaciones

## Desarrollo

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar.
