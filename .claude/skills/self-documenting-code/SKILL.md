---
name: self-documenting-code
description: Write self-documenting TypeScript through clear naming, small focused functions, and explicit types. Use whenever you are about to write or modify any TypeScript code — .ts or .tsx files, type definitions, React components, API routes, utilities, hooks, anything. Applies to new code and edits to existing code. Governs how identifiers are named, how functions are sized, what gets typed, and — crucially — when a comment is allowed to exist at all. If you catch yourself writing a comment, a JSDoc block, or a vague name like `data`/`handle`/`process`, this skill applies.
---

# Self-Documenting Code

The code itself is the documentation. Names, types, and structure carry the meaning. Comments are reserved for the rare cases where the code genuinely cannot express _why_.

## The four rules

### 1. Names carry the meaning

Pick names so specific that the reader doesn't need a comment to know what something is.

- Variables and parameters describe the thing, with units or domain where relevant: `timeoutMs`, `priceCents`, `userIdsToInvite`, not `t`, `price`, `arr`.
- Functions are verbs that describe the effect or return value: `fetchActiveSession`, `isExpired`, `buildAuthRedirectUrl`, not `handle`, `process`, `doWork`.
- Booleans read as predicates: `isAuthenticated`, `hasPendingPayment`, `shouldRetry`.
- Avoid generic suffixes (`-Data`, `-Info`, `-Manager`, `-Helper`) unless they truly add meaning. `userData` is rarely better than `user`.
- If a name needs a comment to be understood, rename it.

### 2. Functions stay small and do one thing

A function whose body fits on one screen and whose name accurately describes its behavior usually doesn't need explanation. When a function grows past that, the reader has to hold too much state; extract the inner step into a named function and the name becomes the comment.

- Prefer composition of small named functions over long procedural blocks with section-header comments. The section header _is_ a function name waiting to happen.
- Early returns over nested conditionals — flat code reads top-to-bottom.
- One level of abstraction per function. Mixing high-level orchestration with low-level byte-fiddling forces comments to bridge the gap.

### 3. Types are explicit at boundaries

TypeScript's type system is part of the documentation. Use it deliberately.

- Annotate exported function signatures and public APIs explicitly. Don't rely on inference for things other modules depend on — the signature is the contract.
- Inside a function, inference is fine for local variables when the right-hand side is obvious.
- Prefer named types and discriminated unions over inline structural types when the shape has meaning: `type SessionState = { kind: 'anonymous' } | { kind: 'authenticated'; userId: UserId }` beats a sprawling inline object.
- Use branded/nominal types for values that are easy to mix up (`UserId` vs `OrgId`, `Cents` vs `Dollars`). The type stops the bug; no comment required.
- Avoid `any`. Prefer `unknown` at boundaries and narrow. If you must use `any`, that's exactly the kind of non-obvious choice that warrants a comment explaining _why_.

### 4. Comments explain _why_, never _what_

Before writing a comment, ask: "Could a clearer name, a smaller function, or a better type make this comment unnecessary?" If yes, do that instead. If no, the comment is justified.

**Allowed comments** explain things the code cannot:

- Business rules with external context: `// Stripe requires amounts in the smallest currency unit`
- Non-obvious trade-offs: `// Using setTimeout(0) to defer past the current microtask queue so the Supabase listener fires first`
- Workarounds with a link or reason: `// Next.js 15 cookies() is async — see github.com/vercel/next.js/issues/XXXXX`
- Invariants the type system can't express: `// Caller must hold the row lock before invoking`
- Warnings about subtle behavior: `// Order matters: revoke before issuing, or the new token gets invalidated`

**Forbidden comments** restate what the code already says:

- `// increment counter` above `counter++`
- `// returns the user` above `return user`
- JSDoc on a function whose name, parameters, and return type already convey its purpose
- Section-divider comments inside a function (`// --- validation ---`) — extract a function instead
- `TODO` without an owner, date, or ticket
- Commented-out code (delete it; git remembers)

### JSDoc specifically

Omit JSDoc when the signature speaks for itself:

```ts
// Bad — adds nothing
/**
 * Returns the user by ID.
 * @param userId The user ID
 * @returns The user
 */
export function getUserById(userId: UserId): Promise<User | null> { ... }

// Good — no JSDoc needed; the signature is the doc
export function getUserById(userId: UserId): Promise<User | null> { ... }
```

Keep JSDoc when it adds something the signature can't: a non-obvious precondition, a link to a spec, an example for a tricky generic, behavior under unusual inputs. Even then, keep it short — one or two lines.

## Examples

### Renaming over commenting

```ts
// Bad
// number of milliseconds to wait before retrying
const t = 500;

// Good
const retryDelayMs = 500;
```

```ts
// Bad
// check if user can access this resource
function check(u: User, r: Resource): boolean { ... }

// Good
function canUserAccessResource(user: User, resource: Resource): boolean { ... }
```

### Extracting over section headers

```ts
// Bad
function processOrder(order: Order) {
  // validate
  if (!order.items.length) throw new Error("empty");
  if (order.total <= 0) throw new Error("invalid total");

  // apply discounts
  const discount = order.coupon ? lookupDiscount(order.coupon) : 0;
  const discountedTotal = order.total - discount;

  // charge
  return stripe.charge(discountedTotal);
}

// Good
function processOrder(order: Order) {
  assertOrderIsValid(order);
  const total = applyDiscounts(order);
  return stripe.charge(total);
}
```

### Comment that earns its place

```ts
// Stripe rejects amounts below 50 cents for USD with `amount_too_small`;
// we bundle micro-charges into a daily batch instead.
if (amountCents < MINIMUM_STRIPE_CHARGE_CENTS) {
  return queueForDailyBatch(amountCents);
}
```

The comment isn't restating the code — it's explaining _why_ the threshold exists and what the alternative path does. The reader would have to dig through Stripe docs to recover that context otherwise.

### Types replacing comments

```ts
// Bad
// userId here is the auth user's id, not the profile id
function loadProfile(userId: string) { ... }

// Good
type AuthUserId = string & { readonly __brand: 'AuthUserId' };
function loadProfile(authUserId: AuthUserId) { ... }
```

## How to apply during a task

1. **Before writing**: think about names. A few seconds of naming saves a comment forever.
2. **While writing**: if you reach for a comment, pause. Try a rename, an extraction, or a type first. If none of those work, write the comment and make sure it answers _why_.
3. **Before finishing**: scan your diff for comments. For each one, ask "does the code already say this?" If yes, delete the comment. Also scan for JSDoc blocks on functions whose signatures are self-explanatory; delete those too.
4. **When editing existing code**: don't preserve comments that the surrounding code now says clearly. Don't add `// removed X` markers — git is the changelog.

## Red flags that mean you've drifted

- You're writing a JSDoc `@param` line that just says the parameter name in English.
- Your function has a `// --- step 1 ---` style divider in it.
- You're naming a variable `data`, `result`, `obj`, `item`, `temp`, or `tmp` outside the tiniest of scopes.
- You're typing `any` because the real type is annoying to write.
- You added a comment so that "people understand what this does." That's what the code is for.

When you notice any of these, fix the code — don't add more comments to compensate.
