# Agent instructions

This is a GitHub repository template, so it carries no business logic. Everything here (Node, React, TypeScript, scripts) should stay generic and extensible. The goal is a seamless developer experience for the consumer repo, from first setup to deployment.

<!-- BEGIN:nextjs-agent-rules -->

> **This is NOT the Next.js you know**.  
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.  

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## General rules

- **ALWAYS** respond using words/terms that a complete beginner in tech can understand. Only use jargon when the topic warrants it. Keep explanations clear and concise.
- **STRICTLY** prioritize simplicity, security, readability and maintainability.
- **ALWAYS** use the most downloaded npm libraries instead of reinventing your own, unless the library has been stale for more than 6 months or has unresolved high/critical security vulnerabilities.
- **ALWAYS** use the `@/*` path alias from `tsconfig.json` when importing across folders; relative imports are fine inside a slice.
- Custom devops scripts live in `scripts/<name>/<name>.mjs` with tests in `scripts/<name>/__tests__/`. Write them in Node (`.mjs`), never bash, so they run on Mac, Linux and Windows. Name scripts `noun:verb` (`env:init`, `pdf:build`).

# Project conventions

Next.js (App Router, TypeScript, `src/`), vertical-sliced clean architecture.
API is exposed through route handlers, never server actions, so it can be moved out later.

## Structure

Not every folder exists yet; create them when needed.

```
src/
├── app/                      # Next routing only, zero logic
│   ├── (app)/…/page.tsx      # signed-in pages; (app)/layout.tsx = app shell + auth guard
│   ├── (auth)/…/page.tsx     # sign-in, forgot-password; own minimal layout
│   ├── api/…/route.ts
│   └── _components/          # app shell; composes slices
├── features/<slice>/         # one slice = one bounded context (users, orders, …); refer to /tactical-ddd skill when deciding
│   ├── contracts/            # zod DTOs; the slice's public shape
│   ├── domain/               # entities, invariants, repository/port interfaces
│   ├── application/          # services (use cases); depend on interfaces only
│   ├── infra/
│   │   ├── <tech>/           # e.g. drizzle/; implements domain interfaces
│   │   ├── in-memory/        # test doubles; application/ tests run against these
│   │   └── *-adapter.ts      # adapters to other slices' ports
│   ├── ui/                   # components, client hooks (queries.ts)
│   ├── server.ts             # composition root
│   ├── index.ts              # server-safe exports for other slices
│   └── ui.ts                 # React exports for other slices
└── kernel/                   # small, generic, knows no slice
    ├── server/{db,auth}
    ├── ui/                   # shadcn target
    └── api-client.ts         # the only place the browser calls /api
```

Every folder has its own `__tests__/` next to the code it tests.

## Layer rules

- `domain/` and `application/` are pure TypeScript: no db, no React, no `kernel/server`.
- `infra/` and `server.ts` carry `import 'server-only'`.
- `server.ts` returns parsed `contracts/` types, never raw db rows.
- Server Components call `server.ts` directly (no self-fetch). Client code uses `ui/queries.ts` -> `kernel/api-client`.
- Route handlers (`app/api`) only parse the request, call a service, return a response.

## Cross-slice access: ports, not direct calls

The calling slice defines what it needs as an interface in its own `domain/`
(e.g. `orders/domain/IUserLookup.ts`). An adapter in `orders/infra/` implements it
by importing `@/features/users`. `orders/server.ts` wires the adapter in.
`orders/domain` and `orders/application` never mention `users`.

## kernel/ui extension

Slices extend kernel components by wrapping or composing
(`features/users/ui/UserSelect.tsx` wraps `kernel/ui/select`).
Never edit a kernel component to add a slice-specific variant; add a generic prop or slot instead.
`kernel/ui` never imports `features/`.

## Naming

Framework-reserved names win (`page.tsx`, `route.ts`, `layout.tsx`, `(app)`, `_components`, `__tests__`, shadcn-generated files in `kernel/ui`). Otherwise, **STRICTLY**:

- **ALWAYS** kebab-case for folders.
- **ALWAYS** PascalCase for files that export exactly one class, type or interface (`UsersService.ts`, `IUserRepository.ts`). Multiple exports -> kebab-case (`user-dto.ts`, `queries.ts`).
- **ALWAYS** PascalCase for classes, types, interfaces.
- **ALWAYS** camelCase for variables, functions, client model properties.
- **ALWAYS** snake_case for db columns.
- **ALWAYS** UPPER_CASE for env config variables and read-only constants.
- Test files mirror the file under test: `UsersService.test.ts`, `user-dto.test.ts`.

## Other Considerations

- `kernel/` is the only folder outside slices, so "shared" cannot grow back.
- Moving the API out of Next is an option, not a plan; `server.ts` is the seam.
