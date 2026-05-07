@AGENTS.md

# HourCounter — Project context

> Living doc. Update when state changes (new feature shipped, decision
> revisited, schema migrated). Aim for "what would I need if I dropped
> into a fresh session right now?".

## What this is

Multi-employer dashboard to track employee hours and compute pay. The
employer creates a *group*, defines *positions* (job roles like cashier,
cook), invites people via link, employees clock in/out, and at payment
time the system shows accumulated hours × rate + fixed amounts.

User is **Juan** (student, exploring). The codebase is iterative — ship
small slices, don't pre-build features.

## Stack

| Layer        | Choice                                          |
|--------------|-------------------------------------------------|
| Framework    | Next.js 16.2 (App Router, Turbopack, TS strict) |
| UI           | Tailwind v4, lucide-react icons, custom prims   |
| Backend / DB | Supabase (Postgres + Auth + Realtime)           |
| Auth         | Supabase Auth (email + password) via @supabase/ssr |
| Hosting      | Local dev for now; target Vercel + Supabase     |

Notes:
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`**. The function is
  `proxy()` instead of `middleware()`. See `src/proxy.ts`.
- **Always read `node_modules/next/dist/docs/01-app/...`** before
  writing Next.js-specific code (see `AGENTS.md`). Some APIs differ
  from older training data.
- `cookies()`, `params`, `searchParams` are async (`await` them).

## Domain model

```
auth.users (Supabase Auth)
    │
    ├── group_members  (per-group role: employer | employee, status, display_name)
    │       │
    │       ├── member_nicknames  (viewer × target, per-viewer private)
    │       │
    │       └── employee_profiles  (only for role=employee)
    │              │   ├── position_id  (FK, nullable)
    │              │   └── *_override   (NULL = inherit from position)
    │              │
    │              ├── employee_notes        (1:1, employer-shared, hidden from employee)
    │              ├── fixed_amounts         (per-employee, copied from position template)
    │              ├── time_entries          (clock in/out, status open|closed|needs_review)
    │              └── payments
    │                     └── payment_adjustments  (one-shot at payment time)
    │
    └── groups
            │
            ├── positions             (job role templates)
            │      └── position_fixed_amounts
            │
            └── invitations           (code, role, optional position_id, expires_at)
```

Key idea: **positions are live-link templates with per-employee
overrides**. An employee_profile's `hourly_rate` (and other scalar
fields) is `NULL` when "inherits from position", or has a value when
overridden. Effective values come from `effective_employee_profile()`
SQL function.

Fixed amounts are *not* live-linked — copied from position template
when the employee is created, then independent.

**Naming visibility**:
- `group_members.display_name` is the canonical name; only the user
  themselves can change it (via `/app/me`, calling
  `update_my_display_name` which propagates to all their memberships).
- `member_nicknames(viewer_user_id, target_member_id, nickname)` is a
  private label set by any viewer on any member they can see; only the
  viewer reads/writes their own rows.
- UI shows nickname when present, falls back to display_name.

**Notes** (`employee_notes`) are one row per employee_profile, shared
across employers of the group, and **never** visible to the employee
themselves. Separate table so we can scope SELECT to
`is_group_employer` without touching the existing employee_profiles
read policy (which lets every member see profile scalars).

## Design decisions

1. **One Supabase project, RLS-first**. Every table has RLS enabled.
   Helper functions `is_group_member(group_id)`, `is_group_employer(...)`
   are `SECURITY DEFINER` to avoid recursion in policies.
2. **Atomic operations via SQL functions**. Anything that touches >1
   table (create_group_with_owner, accept_invitation, etc.) goes through
   a `SECURITY DEFINER` function so we get atomicity + bypass per-table
   RLS gymnastics. Functions internally validate `auth.uid()`.
3. **Invitations**: code is the access token. Listing invitations is
   restricted; the `get_invitation_by_code(code)` function is the only
   public read path (for the landing page).
4. **Per-group role naming**:
   - `member_role` enum (`employer`/`employee`) = workspace permission.
   - `position` = job role template (cashier, cook). Code says
     `position`, UI says "rol".
5. **Payment period** = enum (`weekly`/`biweekly`/`monthly`/`custom_days`).
   Calculation uses "everything since last payment", regardless of
   exact dates — period is just metadata for reminders / display.
6. **Currency** is per-position/per-employee (3-letter ISO, default
   `ARS`). No multi-currency totals.
7. **Server actions everywhere** for mutations. Form components use
   `useActionState` + `<SubmitButton>` (which uses `useFormStatus`).
8. **Removed employees are archived**, not deleted. `group_members.status
   = 'archived'`. Pay history is kept.
9. **Style**: zinc neutrals + emerald accent + `Geist` sans, with
   light/dark via `prefers-color-scheme`. Tokens in `globals.css`.
10. **Proxy** (`src/proxy.ts`): refreshes Supabase session on every
    request, redirects unauthenticated users to `/login?next=...`,
    public paths are `/`, `/login`, `/signup`, `/auth/*`, `/invite/*`.
11. **Time tracking is lazy-close**. Open shifts past their declared
    `expected_minutes` are closed by `auto_close_expired_shifts()`,
    invoked at the top of any read that cares about shift state and
    inside `clock_in` / `clock_out`. Avoids needing pg_cron and keeps
    state self-healing without scheduled jobs.
12. **Empty employee_profiles are valid**. The position-or-complete
    check was removed in 0009 so a member without a configured profile
    can clock in immediately. `clock_in` auto-creates the profile on
    first call. Effective rate stays NULL until configured; payment
    calc must handle this.

## Repository layout

```
HourCounter/
├── src/
│   ├── app/
│   │   ├── (auth)/                 route group, no URL segment
│   │   │   ├── login/              login page + form + action
│   │   │   └── signup/             signup page + form + action
│   │   ├── app/                    authenticated area
│   │   │   ├── layout.tsx          header + auth guard, links avatar to /me
│   │   │   ├── page.tsx            list of user's groups (SpotlightCard)
│   │   │   ├── me/                 display name editor + avatar uploader
│   │   │   └── groups/
│   │   │       ├── new/            create group
│   │   │       └── [id]/
│   │   │           ├── page.tsx    group detail (members list resolves nicknames)
│   │   │           ├── invite/     generate + list invitations
│   │   │           ├── members/[memberId]/
│   │   │           │   ├── page.tsx              detail (nickname, notes, effective values)
│   │   │           │   └── edit/                 form + RPC update_member_full
│   │   │           ├── clock/                    employee-only clock card + recent shifts (used by group page)
│   │   │           ├── settings/                 employer-only group settings (avatar uploader)
│   │   │           ├── shifts/[shiftId]/edit/    self-edit a shift before verification
│   │   │           └── positions/
│   │   │               ├── page.tsx              list
│   │   │               ├── _form-parsing.ts      shared FormData parser
│   │   │               ├── position-form.tsx     create/edit form (generic)
│   │   │               ├── new/                  create
│   │   │               └── [positionId]/
│   │   │                   ├── page.tsx          detail + Editar/Eliminar
│   │   │                   ├── delete-position-button.tsx  confirm() + RPC delete_position
│   │   │                   └── edit/             edit page + RPC update_position
│   │   ├── auth/
│   │   │   ├── confirm/route.ts    email link verification
│   │   │   └── signout/route.ts    POST signout
│   │   ├── invite/[code]/          public invitation landing
│   │   ├── globals.css             design tokens
│   │   ├── layout.tsx              root: html/body, fonts
│   │   └── page.tsx                marketing landing for non-logged users
│   │                                (logged-in users get redirect → /app)
│   ├── components/
│   │   ├── ui/                     reusable primitives
│   │   │   ├── avatar.tsx          image-or-initials, deterministic palette
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx            Card/Header/Title/Body/Footer
│   │   │   ├── copy-button.tsx     copy-to-clipboard with "Copiado" feedback
│   │   │   ├── input.tsx           Input + Label + Field + Hint + ErrorMessage
│   │   │   ├── live-badge.tsx      pill with pulsing dot ("Trabajando")
│   │   │   ├── select.tsx
│   │   │   └── spotlight-card.tsx  card with cursor-tracking glow on hover
│   │   ├── landing/                marketing landing pieces
│   │   │   ├── landing-navbar.tsx  transparent morph-on-scroll nav
│   │   │   ├── marquee-3d.tsx      tilted 3D marquee of mock UI cards
│   │   │   ├── mock-cards.tsx      static product UI snippets used in marquee
│   │   │   └── features-grid.tsx   in-view animated feature grid
│   │   ├── navbar.tsx              authenticated app navbar (resizable)
│   │   ├── page-header.tsx         breadcrumbs + title + actions
│   │   ├── motion-list.tsx         staggered fade-in list
│   │   └── submit-button.tsx       form-aware button (useFormStatus)
│   ├── lib/
│   │   ├── cn.ts                   clsx + tailwind-merge
│   │   ├── format.ts               domain display helpers (period, currency, frequency)
│   │   └── supabase/
│   │       ├── client.ts           browser client
│   │       ├── server.ts           server client (RSC, actions)
│   │       └── proxy.ts            session refresh + redirect logic
│   └── proxy.ts                    Next.js 16 proxy (formerly middleware)
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql        all base tables + RLS
│       ├── 0002_group_helpers.sql         create_group_with_owner()
│       ├── 0003_member_display_name.sql   default display_name from auth.users
│       ├── 0004_invitations.sql           create/get/accept invitation fns
│       ├── 0005_positions.sql             positions + position_fixed_amounts + override fields on employee_profiles
│       ├── 0006_fixed_amount_custom_days.sql  every_n_days frequency
│       ├── 0007_position_management.sql   update_position() + delete_position()
│       ├── 0008_member_extras.sql         employee_notes, member_nicknames, update_member_full(), update_my_display_name()
│       ├── 0009_time_tracking.sql         drops profile-completeness check, adds time_entries.expected_minutes + one-open-shift unique index, RPCs clock_in/clock_out/auto_close_expired_shifts/update_my_time_entry
│       ├── 0010_avatars.sql               group_members.avatar_url + update_my_avatar(); manual setup notes for the public `avatars` Storage bucket
│       └── 0011_group_avatars.sql         groups.avatar_url + update_group_avatar() (employer-gated); reuses the same `avatars` bucket under groups/<groupId>/...
├── .env.local                      Supabase URL + anon key (gitignored)
├── .env.local.example              template
├── package.json
└── README.md
```

## Features status

| Feature                                     | Status         |
|---------------------------------------------|----------------|
| Email/password signup + login               | ✅ done        |
| Email confirmation flow                     | ✅ done        |
| Signout                                     | ✅ done        |
| Create / list groups                        | ✅ done        |
| Group detail + members                      | ✅ done        |
| Invitations (link, role, optional position) | ✅ done        |
| Public invite landing                       | ✅ done        |
| Positions: list + create + view             | ✅ done        |
| Positions: edit                             | ✅ done        |
| Positions: delete (blocked while in use)    | ✅ done        |
| Employee profile editor (overrides + fixed amounts) | ✅ done |
| Per-viewer member nicknames                 | ✅ done        |
| Employer-shared notes per employee          | ✅ done        |
| Self-service display name (/app/me)         | ✅ done        |
| Profile picture upload (`avatars` bucket)   | ✅ done        |
| Group avatar (employer-only)                | ✅ done        |
| Clock in / out (employee side)              | ✅ done        |
| Auto-close after expected_minutes (lazy)    | ✅ done        |
| Self-edit unverified shifts                 | ✅ done        |
| Today's worked hours (live)                 | ✅ done        |
| "Trabajando" indicator on members list      | ✅ done        |
| Global clock-out banner on /app             | ⏳ pending     |
| Verification flow (employer reviews shifts) | ⏳ pending     |
| Payment calculation + recording             | ⏳ pending     |
| Payment adjustments (one-shot)              | ⏳ pending     |
| Push notifications                          | ⏳ pending     |
| QR code for invitations                     | ⏳ nice-to-have |
| Multi-employer per group (UI)               | ⏳ schema OK, UI pending |
| Archive employee                            | ⏳ schema OK, UI pending |
| Generated TypeScript types from schema      | ⏳ pending     |
| Marketing landing at `/` (3D marquee, hero, features) | ✅ done |

## Conventions

- **TypeScript everywhere**, strict mode (default from create-next-app).
- **Server components by default**. Add `"use client"` only when needed
  (forms with state, dynamic UI). Server actions in `actions.ts` next
  to the page that uses them.
- **No DB types generated yet**. RPC and table queries return loosely
  typed data; cast at boundaries (`as unknown as ...`). When this gets
  painful, run `npx supabase gen types typescript`.
- **Forms**: `useActionState` for state, `<SubmitButton>` for the
  submit button (handles pending state). Hidden inputs (`<input
  type="hidden" name="next" value={next}>`) for passing extra context.
  Avoid `placeholder="ej. ..."` examples — labels and `<Hint>` are the
  documentation, placeholders should be empty or strictly functional.
- **Buttons**: three sizes (`sm`/`md`/`lg`). Use `lg` for prominent
  CTAs (clock in/out style). Add `rounded-xl shadow-lg shadow-<color>/20`
  via className for the "premium" feel reserved for hero actions.
- **Server action redirects**: `redirect()` from `next/navigation`. To
  invalidate caches before redirect: `revalidatePath('/...')`.
- **RLS**: never rely on app-layer auth. Always assume the anon key is
  in the wild and the DB must enforce.
- **Multi-tenant scoping**: every query against group-scoped tables
  filters by `group_id` AND relies on RLS. Don't return `select *` from
  tables the user might not be allowed to see.
- **"My membership" queries**: the `group_members` SELECT policy lets
  any active member see *every* row in their group (needed for the
  members list). When you want "what is MY role here", you must filter
  by `user_id = (await supabase.auth.getUser()).data.user.id` and use
  `.maybeSingle()`. Calling `.single()` without that filter returns
  multiple rows as soon as a second member exists and silently makes
  the page fail open. Same trap with `.eq('group_id', id).single()`
  anywhere else.
- **Error handling in server actions**: return `{ error: string }` to
  the client (shown via `<ErrorMessage>`), don't throw unless something
  is genuinely broken.
- **CSS**: use the design tokens (`bg-surface`, `text-foreground`,
  `border-border`, `text-accent-soft-foreground`, etc.) — don't reach
  for raw zinc/emerald classes unless you have a reason. Avatar
  palettes are an exception (deterministic per-name color).
- **i18n**: Spanish (Argentina) in UI, English in code/comments. Date
  formatting uses `es-AR` locale.
- **Migrations**: SQL files under `supabase/migrations/NNNN_name.sql`,
  numbered sequentially. Apply manually via Supabase SQL Editor (no
  Supabase CLI configured yet). After each migration, verify with the
  user before relying on it.

## Setup for a fresh checkout

```bash
cp .env.local.example .env.local       # then fill values
npm install
npm run dev                            # http://localhost:3000
```

Supabase config required:
- Auth → URL Configuration:
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/confirm`
- (Optional for dev) Auth → Providers → Email: disable "Confirm email".

## Things to know about Next.js 16 in this repo

- `middleware.ts` does not exist — use `proxy.ts` (root or `src/`).
- `params` is a `Promise<...>` in pages: `await params`.
- `searchParams` is a `Promise<...>` in pages: `await searchParams`.
- `cookies()` is async: `const c = await cookies()`.
- Route groups `(name)` work the same as before.

## Próximo en la agenda

The natural progression from what's already shipped (clock in/out
employee side complete) is the employer-side workflow at the end of a
period. In order:

1. **Verification flow (employer side)** — list of pending shifts
   per group, "approve / edit / reject" actions, mark `verified_by` +
   `verified_at`. Schema is already there. Probably needs a new
   `/app/groups/[id]/shifts` page for the employer that defaults to
   "needs review" + a section on the group detail page showing
   `needs_review` count.
2. **Payment calculation** — for a given employee + period, sum
   verified hours × effective rate + applicable fixed amounts (taking
   into account `frequency` per amount). Produce a draft `payments`
   row the employer can review.
3. **Payment adjustments UI** — schema already has
   `payment_adjustments`; we need the inline editor on the payment
   draft to add/remove line items (anticipos, premios, descuentos)
   before locking it in.
4. **Global clock-out banner on `/app`** — when any of the user's
   memberships has an open shift, banner at the top of the groups
   list with quick-close. Small but high impact.
5. **PWA + push notifications** — install prompt + service worker +
   FCM (or Web Push). First use cases: verification reminder for the
   employer, "olvidaste de cerrar el turno" for the employee.

After 1-3 ship, we have the end-to-end loop: invite → clock → verify
→ pay. Everything past that is polish/scale.

## Posibles mejoras (backlog de ideas)

Things mentioned in passing or surfaced during research. Not committed
to, kept here so they don't get lost.

### Inspirado en Hubstaff / mercado argentino informal

(See research notes from Hubstaff competitive analysis. Hubstaff
itself is a different segment — formal teams, surveillance-heavy —
but a few of their features map cleanly onto ours.)

- **Reportes mínimos**: "cuánto le pagué a X este mes/año", "horas
  totales del local", "comparativa mes a mes". Out-of-the-box
  Hubstaff has 20+; we'd start with 3 or 4 useful ones.
- **Scheduling**: planificar turnos con anticipación (lunes 9-17,
  martes 14-22, etc.). Alertas si el empleado no fichó a horario.
  Útil para informal/gastronomía donde los turnos son variables.
- **Time off / vacaciones / días libres**: marcar ausencias justas
  para que no rompan el cálculo de pago.
- **PDF de liquidación descargable**: los dueños chicos viven
  imprimiendo recibos; un PDF por período por empleado con horas,
  fixed amounts y total resuelve un problema real.
- **Ajustes one-shot UI**: el schema ya tiene `payment_adjustments`,
  falta el editor inline (parte del paso 3 de la agenda).
- **Soporte de feriados argentinos**: mapeo automático de horas
  trabajadas en feriado nacional con un multiplicador opcional por
  rol.

### Sin decidir todavía

- **Position editing propagation**: today scalar field changes hit
  every in-sync employee at read time. Fixed-amounts list is
  snapshotted at invitation time and NOT updated on position edit.
  Do we want a "apply new fixed amount to all current employees in
  this rol" button later? (queue + diff + opt-in apply)
- **Time-entry verification surface**: push notification vs email
  vs in-app badge. Probably PWA push first.
- **Currency UX**: today free text validated to 3 letters. Restrict
  to a known list (ARS, USD, EUR, …)?
- **Group switcher**: `/app` lists all groups. When count > ~5, do
  we want a dropdown switcher in the header instead?
- **Generated types**: at what point does the friction of untyped
  data outweigh the friction of running `supabase gen types` after
  every migration?
- **QR code for invitations**: low priority, link works fine, but a
  QR is nice for sharing in person without typing.
- **Onboarding state for empty profiles**: the moment after an
  employee is invited without a position and clocks in, their
  profile exists but is empty. We should surface that to the
  employer ("Empleado X fichó pero no tiene perfil — configurarlo")
  somewhere prominent.

### Decided

- **Position deletion** (2026-05-04): blocked when at least one
  active employee uses the role. Archived employees do NOT block.
  No soft-delete yet.
- **Live link vs snapshot for fixed amounts** (2026-05-05): scalar
  fields are live-link, fixed-amounts list is snapshot. Bulk
  propagation is opt-in and TBD.

### Out of scope (won't build)

These were considered but explicitly excluded:

- **Surveillance**: screenshots, % de actividad, app/URL tracking,
  GPS forzado. Wrong fit for the informal-cash market and a legal /
  cultural mismatch in AR.
- **Project-based billing / invoicing tipo agencia**: the typical
  customer is a kiosco / local, not an agency. Out of scope.
- **Heavy integrations** (Slack, Jira, Salesforce, etc.): not where
  this market lives.
- **Apps nativas iOS/Android**: PWA covers it. Maintaining two
  native codebases is not justified for the audience.

## Pointers

- See `AGENTS.md` for the Next.js team's warning about checking docs
  in `node_modules/next/dist/docs/` before writing Next.js-specific code.
- See `README.md` for end-user-facing project description.
