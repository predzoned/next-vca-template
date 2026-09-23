# Agent instructions

This is a GitHub repository template, so it carries no business logic. Everything here (Node, React, TypeScript, scripts) should stay generic and extensible. The goal is a seamless developer experience for the consumer repo, from first setup to deployment.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## General rules

- **ALWAYS** respond using words/terms that a complete beginner in tech can understand. Only use jargon when the topic warrants it. Keep explanations clear and concise.
- **STRICTLY** prioritize simplicity, security, readability and maintainability.
- **ALWAYS** use the most downloaded npm libraries instead of reinventing your own, unless the library has been stale for more than 6 months or has unresolved high/critical security vulnerabilities.
- Imports: the `@/*` alias from `tsconfig.json` across top-level folders (`app/`, `features/`, `kernel/`) and into another slice; relative paths inside a slice.
- Custom devops scripts live in `scripts/<name>/<name>.mjs` with tests in `scripts/<name>/__tests__/`. Write them in Node (`.mjs`), never bash, so they run on Mac, Linux and Windows. Name scripts `noun:verb` (`env:init`, `pdf:build`).

## Guardrails

Biome (`biome.json`) and the tests in `src/__tests__/` enforce the import graph between layers and slices, file names, identifier casing, `server-only`, the `"use server"` directive and export names. When one fails, its message states the rule. 

## Project conventions

Next.js (App Router, TypeScript, `src/`), vertical-sliced clean architecture.
The browser reaches the server through Server Actions for now. They are kept thin and hidden behind `ui/queries.ts`, so they can be swapped for route handlers or an external API later (see "Moving the API out").

### Structure

Not every folder exists yet; create them when needed.

```
src/
├── app/                      # Next routing only, zero logic
│   ├── (app)/…/page.tsx      # signed-in pages; (app)/layout.tsx = app shell; reads the signed-in user via a slice's server.ts
│   ├── (auth)/…/page.tsx     # sign-in, forgot-password; own minimal layout
│   ├── api/…/route.ts        # re-exports a slice's routes.ts handler; nothing else
│   └── _components/          # app shell; composes slices
├── features/<slice>/         # one slice = one bounded context (users, orders, …); refer to /tactical-ddd skill when deciding
│   ├── contracts/            # zod DTOs; the slice's public shape
│   ├── domain/               # entities, invariants, repository/port interfaces
│   ├── application/          # services (use cases); depend on interfaces only
│   ├── infra/
│   │   ├── <tech>/           # e.g. drizzle/; implements domain interfaces
│   │   ├── in-memory/        # test doubles; application/ tests run against these
│   │   └── *-adapter.ts      # adapters to other slices' ports
│   ├── ui/                   # components, client hooks; queries.ts = the only file that calls the server
│   ├── actions.ts            # "use server"; thin transport over server.ts
│   ├── routes.ts             # HTTP handlers for outside callers (cron, webhooks)
│   ├── server.ts             # composition root
│   ├── index.ts              # server-safe exports for other slices
│   └── ui.ts                 # React exports for other slices
└── kernel/                   # small, generic, knows no slice
    ├── server/{db,auth,http}
    └── ui/                   # shadcn target
```

Every folder has its own `__tests__/` next to the code it tests. Tree-wide convention tests live in `src/__tests__/`.

### Layer rules

- `domain/` and `application/` are pure TypeScript: relative imports and `zod` only. Anything else (database, Node built-ins, other slices) goes behind a port interface in `domain/`, implemented in `infra/`.
- `app/` is routing only. The app shell gets the signed-in user by calling an auth slice's `server.ts`, which does the check itself (Next's data-access-layer guidance: never guard in a layout alone).
- `server.ts` returns parsed `contracts/` types, never raw db rows.
- Server Components call `server.ts` directly (no self-fetch).
- `actions.ts` is a thin transport: parse the arguments with the `contracts/` schema, check auth (once `kernel/server/auth` exists), call `server.ts`, return a `contracts/` type. Actions are public POST endpoints: never trust their arguments, and never rely on a layout's auth guard.
- Invalid input throws in the action (`schema.parse`). The UI validates with the same schema first, so this only happens for tampered calls. Expected business outcomes (e.g. "email taken") are returned as result types, never thrown.
- Client hooks go in their own files in `ui/`; `ui/queries.ts` holds server calls only.

### Reading data

- Server Components read by calling `server.ts` and pass the data to client components as props.
- When the user changes what to show (search, filter, page, sort), put it in the URL (`?q=ada&page=2`). The page reads `searchParams`, calls `server.ts`, and re-renders. Client code updates the URL with `router.push()` / `router.replace()`, not by fetching.
- After a write, refresh with `router.refresh()` on the client.
- Only if the URL approach truly does not fit (e.g. live autocomplete inside a dialog), add a read action. It follows the same rules as any action and is reached through `queries.ts`.

### Moving the API out

Server Actions are the current transport, not part of the design. Keep them replaceable:

- Action arguments and return values are plain `contracts/` types (JSON-safe objects). No `FormData`, no `useActionState`-shaped `(prevState, formData)` signatures, no class instances.
- Business outcomes are returned as result types (`{ ok: false, error }`), not thrown, so they survive an HTTP hop.
- Next-only calls (`redirect`, `revalidatePath`, `cookies`) belong on the client when possible (`router.refresh()`, `router.push()`), otherwise in `actions.ts`.

To move out: expose each `server.ts` function over HTTP (route handlers or a separate service), reimplement `ui/queries.ts` with `fetch` using the same signatures, and delete `actions.ts`. Components do not change.

### Outside callers and external APIs

- **Incoming** (cron, webhooks): `app/api/…/route.ts` re-exports a handler from the slice's `routes.ts` (`export { purgeSessionsRoute as GET } from "@/features/sessions/routes"`). `routes.ts` follows the `actions.ts` rules and returns a `Response`.
- Every handler checks its own caller; layouts do not guard `route.ts`. Cron: `isAuthorizedBySecret(request, process.env.CRON_SECRET)` from `kernel/server/http`. Webhooks: verify the signature on the raw body (`request.text()`) with the vendor SDK in `infra/<vendor>/`, then parse; skip already-handled event ids.
- **Outgoing** (calling another service): a port in `domain/`, an adapter in `infra/<vendor>/` (official SDK or `fetch`, response parsed with zod), a fake in `infra/in-memory/`. Keys come from env and never leave the server.

### Cross-slice access: ports, not direct calls

The calling slice defines what it needs as an interface in its own `domain/`
(e.g. `orders/domain/IUserLookup.ts`). An adapter in `orders/infra/` implements it
by importing `@/features/users`. `orders/server.ts` wires the adapter in.

### kernel/ui extension

Slices extend kernel components by wrapping or composing
(`features/users/ui/UserSelect.tsx` wraps `kernel/ui/select`).
Never edit a kernel component to add a slice-specific variant; add a generic prop or slot instead.

### Naming

Framework-reserved names win (`page.tsx`, `route.ts`, `layout.tsx`, `(app)`, `_components`, `__tests__`, shadcn-generated files in `kernel/ui`). Otherwise, **STRICTLY**:

- **ALWAYS** kebab-case for folders.
- **ALWAYS** PascalCase for files that export exactly one class, type, interface or component (`UsersService.ts`, `IUserRepository.ts`, `UserList.tsx`). UI hook files take the hook's camelCase name (`useUsers.ts`). Everything else is kebab-case (`user-dto.ts`, `queries.ts`).
- **ALWAYS** snake_case for db columns, meaning the column name string given to the ORM. TypeScript property names stay camelCase.
- **ALWAYS** UPPER_CASE for env config variables and read-only constants.
- Test files mirror the file under test: `UsersService.test.ts`, `user-dto.test.ts`.

### Other Considerations

- `kernel/` is the only folder outside slices, so "shared" cannot grow back.
- Moving the API out of Next is an option, not a plan; `server.ts` is the server-side seam, `ui/queries.ts` the client-side one.
