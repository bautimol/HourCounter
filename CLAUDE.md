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
    ├── group_members  (per-group role: employer | employee, status)
    │       │
    │       └── employee_profiles  (only for role=employee)
    │              │   ├── position_id  (FK, nullable)
    │              │   └── *_override   (NULL = inherit from position)
    │              │
    │              ├── fixed_amounts        (per-employee, copied from position)
    │              ├── time_entries         (clock in/out, status open|closed|needs_review)
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

## Repository layout

```
HourCounter/
├── src/
│   ├── app/
│   │   ├── (auth)/                 route group, no URL segment
│   │   │   ├── login/              login page + form + action
│   │   │   └── signup/             signup page + form + action
│   │   ├── app/                    authenticated area
│   │   │   ├── layout.tsx          header + auth guard
│   │   │   ├── page.tsx            list of user's groups
│   │   │   └── groups/
│   │   │       ├── new/            create group
│   │   │       └── [id]/
│   │   │           ├── page.tsx    group detail
│   │   │           ├── invite/     generate + list invitations
│   │   │           └── positions/
│   │   │               ├── page.tsx        list
│   │   │               ├── new/            create
│   │   │               └── [positionId]/   detail
│   │   │                   └── edit/       edit + delete actions
│   │   ├── auth/
│   │   │   ├── confirm/route.ts    email link verification
│   │   │   └── signout/route.ts    POST signout
│   │   ├── invite/[code]/          public invitation landing
│   │   ├── globals.css             design tokens
│   │   ├── layout.tsx              root: html/body, fonts
│   │   └── page.tsx                redirect to /app or /login
│   ├── components/
│   │   ├── ui/                     reusable primitives
│   │   │   ├── avatar.tsx          initials in colored circle
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx            Card/Header/Title/Body/Footer
│   │   │   ├── input.tsx           Input + Label + Field + Hint + ErrorMessage
│   │   │   └── select.tsx
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
│       └── 0007_position_management.sql   update_position() + delete_position()
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
| Employee profile editor (with overrides UI) | ⏳ pending     |
| Clock in / out                              | ⏳ pending     |
| Verification flow (employer reviews shifts) | ⏳ pending     |
| Payment calculation + recording             | ⏳ pending     |
| Payment adjustments (one-shot)              | ⏳ pending     |
| Push notifications                          | ⏳ pending     |
| QR code for invitations                     | ⏳ nice-to-have |
| Multi-employer per group (UI)               | ⏳ schema OK, UI pending |
| Archive employee                            | ⏳ schema OK, UI pending |
| Generated TypeScript types from schema      | ⏳ pending     |

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
- **Server action redirects**: `redirect()` from `next/navigation`. To
  invalidate caches before redirect: `revalidatePath('/...')`.
- **RLS**: never rely on app-layer auth. Always assume the anon key is
  in the wild and the DB must enforce.
- **Multi-tenant scoping**: every query against group-scoped tables
  filters by `group_id` AND relies on RLS. Don't return `select *` from
  tables the user might not be allowed to see.
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

## Open questions / things to decide later

- **Position editing propagation**: today, editing a position's scalar
  fields immediately changes effective values for every in-sync
  employee (via `effective_employee_profile()` resolution at read
  time). The fixed-amounts list, however, was already snapshotted at
  invitation time and is not updated on edit. Do we want a "propagate
  fixed amounts" affordance later (queue + diff + opt-in apply)?
- **Time-entry verification**: push notification vs email vs in-app
  badge. Probably PWA push first.
- **Currency UX**: today the form accepts free text, validated to 3
  letters. Should we restrict to a known list (ARS, USD, EUR, ...)?
- **Group switcher**: currently /app lists all groups. When count > ~5,
  do we want a dropdown switcher in the header instead?
- **Generated types**: when does the friction of untyped data outweigh
  the friction of running `supabase gen types` after every migration?
- **Position deletion** (decided 2026-05-04): blocked when at least one
  active employee uses the role. Archived employees do not block. No
  soft-delete yet — if we need a "deprecate but keep historical
  payments referencing it" mode, revisit.

## Pointers

- See `AGENTS.md` for the Next.js team's warning about checking docs
  in `node_modules/next/dist/docs/` before writing Next.js-specific code.
- See `README.md` for end-user-facing project description.
