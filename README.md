# HourCounter

Dashboard multi-empleador para tracking de horas trabajadas y cálculo automático de pagos. Cada *grupo* es un espacio de trabajo donde uno o más **empleadores** definen *roles* (cajero, cocinero, etc.) e invitan **empleados** por link. Los empleados fichan entrada/salida; al momento de pagar, el sistema suma horas × tarifa + montos fijos del período.

> Proyecto en construcción iterativa. Lo que está marcado como ✅ funciona end-to-end. El resto está pendiente.

## Modelo de producto

- **Grupos** — cada grupo tiene 1+ empleadores y N empleados. Una persona puede ser empleado en un grupo y empleador en otro.
- **Roles** (positions) — plantilla de empleado (tarifa por hora, período de pago, montos fijos). Los empleados heredan los valores del rol salvo que el empleador los sobrescriba caso a caso.
- **Clock in / out** — el empleado abre y cierra turnos desde la página del grupo, con timer en vivo. Opcional: declarar cuántas horas va a trabajar y el sistema cierra el turno solo al cumplirse el tiempo. Mientras el empleador no verifique, el empleado puede editar su turno (clock_out + notas).
- **Membresías** — la relación usuario ↔ grupo define el rol (empleador / empleado) y un `display_name` que el propio usuario controla.
- **Apodos** — cada empleador puede ponerle un apodo privado a cualquier miembro; solo lo ve quien lo escribió.
- **Notas** — los empleadores comparten notas sobre cada empleado (no las ve el empleado).
- **Cálculo de pago** *(pendiente)* — al pagar, suma horas × tarifa + montos fijos del período + ajustes one-shot.
- **Empleado retirado** — se archiva (no se borra), el historial se conserva.

## Estado

| Área | Estado |
|------|--------|
| Auth (signup, login, signout, confirmación por email) | ✅ |
| Crear y listar grupos | ✅ |
| Invitaciones por link (rol opcional) | ✅ |
| Roles: crear / editar / eliminar (bloqueado si está en uso) | ✅ |
| Editor de empleado: rol, overrides, montos fijos | ✅ |
| Apodos privados + notas compartidas entre empleadores | ✅ |
| Edición del propio nombre desde `/app/me` | ✅ |
| Foto de perfil (subida a Supabase Storage) | ✅ |
| Clock in / out (lado empleado, con timer en vivo y autocierre opcional) | ✅ |
| Editar un turno propio antes de la verificación | ✅ |
| Indicador "Trabajando" en vivo en la lista de miembros | ✅ |
| Verificación de turnos | ⏳ |
| Cálculo y registro de pagos | ⏳ |
| Notificaciones push (PWA) | ⏳ |
| Multi-empleador en la UI | ⏳ (schema listo) |
| Archivar empleado en la UI | ⏳ (schema listo) |

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript estricto)
- **Tailwind v4** + íconos `lucide-react` + primitivos UI propios
- **Supabase** (Postgres + Auth + Realtime), RLS-first
- Auth por email/password vía `@supabase/ssr`

## Desarrollo

```bash
cp .env.local.example .env.local       # completar con tu URL y anon key de Supabase
npm install
npm run dev                            # http://localhost:3000
```

Las migraciones están en `supabase/migrations/NNNN_*.sql` y se aplican manualmente por ahora desde el SQL Editor de Supabase, en orden numérico.

Configuración mínima en Supabase:
- Auth → URL Configuration → Site URL: `http://localhost:3000`
- Auth → URL Configuration → Redirect URLs: agregar `http://localhost:3000/auth/confirm`
- (Opcional para dev local) Auth → Providers → Email → desactivar "Confirm email".

## Estructura

```
src/app/
├── (auth)/                    login, signup
├── app/                       área autenticada (layout con auth guard)
│   ├── me/                    edición del propio display_name
│   └── groups/[id]/
│       ├── invite/            generar invitaciones
│       ├── members/[id]/      detalle + editor de empleado
│       ├── positions/[id]/    detalle + editor de rol
│       ├── clock/             clock card (in/out + cronómetro vivo)
│       └── shifts/[id]/edit/  editar un turno propio antes de verificarse
├── auth/                      callbacks (confirm, signout)
└── invite/[code]/             landing pública de invitación

supabase/migrations/           SQL incremental (RLS, RPCs, schema)
```

Más contexto técnico, decisiones de diseño y guía para colaboradores está en [`CLAUDE.md`](./CLAUDE.md).
