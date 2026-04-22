# Creatigen

Multitenant voice-agent platform. Draft an agent in plain language, ground it
in your knowledge, put it on a real phone number, and review every call.

## Stack

- **Next.js 16** (App Router, `proxy.ts` replaces `middleware.ts`)
- **React 19** with Server Components and Server Actions
- **TypeScript** · strict mode
- **Tailwind CSS v4** with a warm-monochrome design system
- **Clerk** — source of truth for identity, sessions, organizations, memberships
- **Clerk Organizations** — multitenancy backbone
- **NeonDB** (Postgres, serverless driver) — source of truth for business data
- **Prisma 7** (with `@prisma/adapter-neon` + `prisma.config.ts`) — ORM
- **Zod** — schema validation at system boundaries

## What's in Phase 1

- Marketing landing page (`/`) with editorial design
- Clerk-hosted sign-in / sign-up (`/sign-in`, `/sign-up`) with our theme
- Organization onboarding via `OrganizationList` at `/select-org`
- Org-scoped routes under `/orgs/[slug]/…`:
  - `dashboard` — stats, recent activity feed, next steps
  - `team` — members table, pending invitations, invite form (server action)
  - `settings` — identity, roadmap, danger zone
- `OrganizationSwitcher` and `UserButton` in the app shell
- `requireTenant()` helper that redirects unauth'd users and ensures every
  server query filters by the active organization
- Prisma schema where every org-scoped model indexes `organizationId`
- Seed script for local data

## What's explicitly _not_ in Phase 1

- No Ultravox, calls, telephony, webhooks, or transcripts
- No RAG / knowledge base
- No billing or subscription logic
- No voice agents or testing tools

These land in Phase 2, which will dock into the existing shell.

---

## Local setup

### 1. Prerequisites

- Node.js **20.9+** (Clerk requires it)
- A free Neon project
- A free Clerk application with **Organizations enabled**

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and
`DATABASE_URL`.

> **Clerk:** in the dashboard, go to **Organizations** and enable them. Turn
> on "Allow users to create organizations" so the `OrganizationList`
> component can let users spin up their first workspace. Optionally disable
> personal accounts so every signed-in user must belong to an org.
>
> **Neon:** create a project, copy the pooled connection string (the one
> ending in `-pooler`) and paste it into `DATABASE_URL`.

### 4. Push the Prisma schema

Prisma 7 reads connection settings from `prisma.config.ts`, which loads
`DATABASE_URL` from `.env.local` via `dotenv/config`.

```bash
npx prisma generate
npx prisma db push
```

(Use `prisma migrate dev` once you have a working migration flow set up.)

### 5. Optional: seed dev data

The seed script inserts a placeholder project and a couple of activity log
entries for a local organization. Pass your Clerk org's ID so the seeded
rows line up with the org you're signed in as:

```bash
npx tsx prisma/seed.ts --clerk-id=org_xxxxxxxxxxxx --org-slug=acme
```

### 6. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The flow:

1. Click **Start a workspace** on the landing page
2. Sign up via Clerk
3. You'll be redirected to `/select-org` — create your first org
4. Land on `/orgs/<slug>/dashboard`
5. Visit `/orgs/<slug>/team` to invite teammates

### 7. Build, typecheck, lint

```bash
npm run build
npx tsc --noEmit
npm run lint
```

---

## Architecture

### Separation of concerns

- **Clerk** owns: users, sessions, organizations, memberships, invitations.
- **Neon/Postgres** owns: business data scoped per organization.
- **Prisma** enforces: every model related to an org carries `organizationId`
  and is indexed on it. There is no cross-tenant query path.

### The `requireTenant()` helper

Every org-scoped page or server action calls:

```ts
const tenant = await requireTenant(slug);
```

This:
1. Reads `auth()` from Clerk (async in Next.js 16).
2. Redirects to `/sign-in` if there's no user.
3. Redirects to `/select-org` if there's no active org.
4. Redirects back to the user's real org if the URL slug does not match
   their active org (prevents tampering with `/orgs/other-org/...`).
5. Upserts a local `Organization` row keyed by Clerk's `orgId` and returns
   its **internal** `organizationId` (a cuid) to use in Prisma queries.

Memoized with React `cache()` so a single render only hits the database once.

### Routing

```
app/
├── layout.tsx                    — root layout, fonts, ClerkProvider
├── page.tsx                      — marketing landing
├── (auth)/
│   ├── layout.tsx                — split-pane auth shell
│   ├── sign-in/[[...rest]]/      — Clerk <SignIn /> catch-all
│   ├── sign-up/[[...rest]]/      — Clerk <SignUp /> catch-all
│   └── select-org/               — OrganizationList, then redirect
└── orgs/
    └── [slug]/
        ├── layout.tsx            — app shell (nav, sidebar, switcher)
        ├── page.tsx              — redirects to /dashboard
        ├── dashboard/            — home
        ├── team/                 — members + invitations
        │   └── actions.ts        — inviteMember, revokeInvitation
        └── settings/             — identity + roadmap + danger zone
```

### `proxy.ts` (Next.js 16)

Next.js 16 renames `middleware.ts` → `proxy.ts`. The `clerkMiddleware()`
function still returns a `NextMiddleware` handler, which is identical in
signature to the proxy function, so it works unchanged inside `proxy.ts`.

Rules:
- `/`, `/sign-in/*`, `/sign-up/*` — public
- `/orgs/*` and `/select-org/*` — require an authenticated Clerk session
  (`auth.protect()`)

### Design system

All color, font, radius, and shadow tokens live in `app/globals.css` under
`@theme inline`. Tailwind picks them up automatically (e.g. `bg-canvas`,
`text-ink`, `border-rule`). The palette is warm-monochrome — no purple
gradients or glassmorphism — with `Geist Sans` for UI and `Newsreader` for
editorial headings. UI primitives live in `components/ui/`.

---

## Extending into Phase 2

To add the Ultravox module later:

1. Add new Prisma models (e.g. `Agent`, `Call`, `Transcript`) — **every
   model must include `organizationId String` and `@@index([organizationId])`.**
2. Add routes under `app/orgs/[slug]/agents/`, `/calls/`, etc.
3. In every new server component or server action, call `requireTenant(slug)`
   and filter all Prisma queries by `tenant.organizationId`.
4. Add new navigation entries to `components/app/app-sidebar.tsx`.
5. Webhooks can live under `app/api/webhooks/…` — protect them with a shared
   secret or Clerk webhook verification.

The foundation is deliberately small so that Phase 2 adds modules rather than
rewriting anything.
