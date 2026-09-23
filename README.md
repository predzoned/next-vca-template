# next-vca-template

A [Next.js](https://nextjs.org) starter organized as **vertical slices**, with **clean architecture** inside each slice. One slice = one bounded context (`users`, `orders`, ...). Each slice owns its contracts, domain rules, use cases, infrastructure and UI. Nothing outside a slice knows how it works inside.

Read [`AGENTS.md`](./AGENTS.md) for the full conventions; this file is the quick tour.

## Getting started

```bash
pnpm install
pnpm env:init   # creates .env from .env.example
pnpm dev        # http://localhost:3000
```

Other scripts:

```bash
pnpm check      # Biome: lint + format, apply safe fixes
pnpm lint       # Biome: check only
pnpm test       # Vitest (every __tests__/ folder)
pnpm typecheck  # next typegen + tsc
pnpm build
pnpm env:sync   # rewrite .env.example from .env (values replaced by placeholders)
pnpm env:check  # fail if .env.example is out of sync
```

## Layout

```
src/
├── app/                      # Next routing only, zero logic
│   ├── (app)/users/page.tsx  # Server Component; calls the slice's server.ts directly
│   └── api/users/route.ts    # parses the request, calls server.ts, returns a response
├── features/users/           # the example slice
│   ├── contracts/            # zod schemas + DTO types; the slice's public shape
│   ├── domain/               # User entity, invariants, IUserRepository, IIdGenerator
│   ├── application/          # UsersService (use cases); depends on interfaces only
│   ├── infra/
│   │   ├── in-memory/        # test doubles; also the placeholder store until a db arrives
│   │   └── crypto/           # CryptoIdGenerator (randomUUID)
│   ├── ui/                   # UserList, CreateUserForm, queries.ts (browser -> /api)
│   ├── server.ts             # composition root; the only entry point for app/
│   ├── index.ts              # server-safe exports for other slices
│   └── ui.ts                 # React exports for other slices and app/
└── kernel/                   # small, generic, knows no slice
    ├── ui/                   # shadcn/ui components (pnpm dlx shadcn@latest add <name>)
    └── api-client.ts         # the only place the browser calls /api
```

Every folder has its own `__tests__/` next to the code it tests. `application/` tests run against `infra/in-memory/`, so no database is needed.

## How a request flows

- **Page** `app/(app)/users/page.tsx` -> `listUsers()` in `features/users/server.ts` -> `UsersService` -> `IUserRepository`.
- **Browser** `CreateUserForm` -> `ui/queries.ts` -> `kernel/api-client` -> `POST /api/users` -> `createUser()` in `server.ts`.
- `server.ts` returns `contracts/` types only, never domain objects or db rows. Domain errors are translated there into result types (see `CreateUserResult`).

## Add a slice

1. Copy the folder shape of `features/users` (`contracts`, `domain`, `application`, `infra/in-memory`, `ui`, `server.ts`, `index.ts`, `ui.ts`).
2. Copy the four `src/features/users/...` override blocks in `biome.json` and rename `users` to the new slice. Biome overrides replace rather than merge, so each block repeats the shared rules.
3. Add pages under `app/(app)/<slice>/` and route handlers under `app/api/<slice>/`; both import only `@/features/<slice>/server`, `contracts` and `ui`.

## Reach another slice

Define what you need as an interface in your own `domain/` (e.g. `orders/domain/IUserLookup.ts`), implement it with an adapter in `orders/infra/` that imports `@/features/users` (its `index.ts`), and wire the adapter in `orders/server.ts`. `orders/domain` and `orders/application` never mention `users`.

## Swap the storage

Add `features/<slice>/infra/<tech>/` (for example a Drizzle repository) and change one line in `server.ts`. The in-memory repository stays for tests.

## Import rules

Enforced by Biome (`noRestrictedImports` in `biome.json`):

| From | May import |
|---|---|
| `kernel/**` | `kernel/**` only |
| `features/X/**` | own slice, `kernel/**`, other slices only via `features/Y` (index) or `features/Y/ui` |
| `features/X/{domain,application}` | own `domain`, `contracts`; no kernel, no React, no Next |
| `features/X/{infra,server.ts}` | no `kernel/ui`, no `api-client`, no `ui/` |
| `features/X/ui` | no `server.ts`, `application/`, `infra/`, `kernel/server` |
| `app/**` | `features/*/{server,contracts,ui}`, `kernel/ui` |

## Agent setup

`AGENTS.md` (and `CLAUDE.md`, which points to it) carries the conventions. `.claude/skills/` has `git-savvy`, `self-documenting-code` and `tactical-ddd`; `.claude/hooks/checks.mjs` runs format, lint, typecheck and tests before an agent finishes.

## License

MIT, see [`LICENSE`](./LICENSE).
