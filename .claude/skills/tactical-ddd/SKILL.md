---
name: tactical-ddd
description: Apply Domain-Driven Design tactical patterns (ubiquitous language, bounded contexts, aggregates, value objects, domain events, repositories) when planning features or writing business logic, using plain function calls instead of event buses, event sourcing, or CQRS frameworks. Use this skill whenever the user is planning a feature, modeling business logic, writing or refactoring code that enforces business rules or invariants, deciding where a rule should live, or drawing boundaries between modules or subsystems, even if they never say "DDD". Especially relevant when work touches more than one business concept or crosses a module boundary. Not needed for pure UI, config, tooling, or read-only reporting queries.
---

# Domain-Driven Design (pragmatic flavor)

Use DDD's vocabulary and structure. Skip DDD's infrastructure. The goal is business rules that live in one obvious place, are named in the domain's own words, and can be tested without a database or HTTP.

Examples below are pseudocode. Adapt to the project's language and conventions.

## Proportionality: how much of this to apply

Match the effort to the change.

| Change                                      | What to do                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bug fix or small tweak to an existing rule  | Name the aggregate and the rule. Keep the fix inside the aggregate. No checklist.                              |
| New method or rule on an existing aggregate | Name it in domain terms, add the invariant check, return an event if other parts care. Short note in the plan. |
| New aggregate or new bounded context        | Run the full planning checklist (below) and write it into the plan before code.                                |

If unsure which row applies, ask the user.

## Vocabulary

### Ubiquitous language

The domain's own words, used consistently in code, plans, and conversation.

- Before naming a type, function, route, or table, check the spec, existing code, and the glossary (see below) for the term already in use.
- If you must introduce a new term, propose it to the user before using it.
- Keep a glossary file in the repo (suggest `docs/glossary.md` if none exists). Add every new domain term there with a one-line meaning. Sessions do not remember; the file does.

### Bounded context

A boundary inside which a term has exactly one meaning.

- When a feature crosses into a different "world" (e.g. estimation vs. inventory vs. dashboard), name each context and the contract between them.
- Do not share types across contexts because they look similar. Translate at the boundary with a small mapping function.
- A context is usually a folder or module. Cross-context calls go through a narrow, named interface.

### Aggregate

A cluster of objects treated as one unit for changes, with one root that guards the rules.

- Ask: what must always be true about this thing? Those rules become methods on the root that change state and refuse illegal changes.
- Callers never set fields from outside. They call `project.approveEstimate(...)` and the aggregate decides if that is allowed.
- **Keep aggregates small.** Hold other aggregates by ID, never by object. If loading one aggregate pulls in a second one, the boundary is wrong.
- One aggregate per transaction. If a use case must change two aggregates, that is a signal to reconsider the boundary, or to use a domain service (see heuristics).
- **Rebuilding from storage:** the repository needs to construct an aggregate from saved data without going through the rule-checking methods. Give the aggregate a dedicated factory for that purpose (e.g. `Project.reconstitute(data)`), separate from the normal creation path (`Project.create(...)`), and keep fields private otherwise.

### Value object

A small immutable type defined by its value, not by an identity.

- Wrap a primitive when it carries units, format rules, or a range: `Money`, `Email`, `Percentage`, `DateRange`.
- Validate in the constructor; an invalid value object cannot exist.
- Equality is by value. No setters; changes return a new instance.
- **Do not over-wrap.** A plain string with no rules stays a string. For identifiers, a typed alias or branded type (`ProjectId`) is enough; no class needed. Reach for a full value object only when there is real validation or real operations (add, compare, format).

### Domain event

A past-tense fact the aggregate produced: `EstimateApproved`, `ProjectArchived`.

- Aggregate methods record events; the caller collects them after the call (e.g. `project.pullEvents()`).
- The caller handles them inline with direct function calls. One handler function with a switch over event types is the default.
- No event bus, no subscriber registry, no dispatcher framework.

```
project = repo.findById(id)
project.approveEstimate(estimateId, approverId)
repo.save(project)
for event in project.pullEvents():
    handleProjectEvent(event)      # single switch over event types
```

**Failure rules for handlers (decide explicitly, do not leave to chance):**

- The aggregate save is the transaction. Handlers run after it commits. A handler failure must not roll back the save.
- Handlers must be safe to run twice (idempotent), because retries will happen.
- A handler that needs slow or unreliable work (email, external API) should enqueue a job and return, not do the work inline. The dispatch loop stays fast and simple.
- Log handler failures with the event and aggregate ID so they can be replayed by hand.

### Repository

An interface that loads and saves whole aggregates.

```
interface ProjectRepository:
    findById(id: ProjectId) -> Project | null
    save(project: Project)
```

- One repository per aggregate root, not per table.
- Methods deal in aggregates, never rows. `findById` returns a full `Project`.
- New queries get a named method that says what it is for (`findActiveProjectsForManager`). No generic `findWhere(sql)` escape hatch.
- The interface lives with the domain; the database implementation lives at the edge.
- Read-only screens (dashboards, lists, reports) do not go through the repository. Query the database directly for a projection. Do not apologize for this.

## Who orchestrates a use case

A write operation always runs the same steps: load the aggregate, call its method, save it, handle its events.

**In this project the `application/` service of the slice runs these steps.** The Server Action (the slice's `actions.ts`) only parses its arguments, calls a function exported from the slice's `server.ts`, and returns the result. `server.ts` wires the service to its infrastructure and maps domain objects to `contracts/` types. Keep the service method short; it should read like the pseudocode above.

## What we deliberately do not do

Skip these unless the user asks or a concrete trigger (below) appears:

- **Event sourcing**: store current state, not an event log.
- **Event bus, message broker, in-memory dispatcher**: a switch statement does the job.
- **CQRS as two separate stacks**: reading projections directly is fine; two parallel codebases is not.
- **Anti-corruption layer as a full module**: a translation function at the boundary is enough at this scale.

## Planning checklist (new aggregate or new context only)

Write the answers into the plan before any code. This is how the user verifies the design.

1. **Ubiquitous language:** list the nouns and verbs the spec uses. Flag any conflicts with the glossary.
2. **Bounded context:** new context or existing one? If it touches another context, what is the contract?
3. **Aggregates:** which entity owns the rules? What methods does the root expose? What does it hold by ID rather than by object?
4. **Value objects:** which primitives hide units, ranges, or formats? Which can stay as branded IDs?
5. **Domain events:** which past-tense facts do other parts of the system care about? Who handles each, and is that handler idempotent?
6. **Repository methods:** named by intent. Which reads bypass the repository as projections?
7. **Code layout:** aggregate, value objects, and repository interface in the domain folder; database implementation in `infra/`; the `application/` service orchestrates; `server.ts` wires them.
8. **Tests:** which invariants get a direct unit test against the aggregate, with no database?

## During implementation

- **Name first.** If a function's domain name feels awkward, the design is probably wrong.
- **Push rules into the aggregate.** A service checking `if project.status != 'draft'` is a rule that belongs on `project.approveEstimate()`.
- **Parse at the boundary.** Turn incoming arguments into `contracts/` types in the Server Action and into value objects in the service. Inside the domain, no bare primitives for money, dates with rules, emails, etc.
- **Test the aggregate directly.** Every invariant gets a unit test that constructs the aggregate, calls the method, and asserts the outcome or the rejection. No database, no HTTP.
- **Keep the repository honest.** No methods that return half an aggregate; no direct writes that bypass it.
- **Dispatch inline, after save, idempotently.** See the failure rules above.
- **Read paths stay flat.** Projections for read-only screens.

## Heuristics: when to add more

Mention these to the user when the trigger appears. Do not introduce them on your own.

| Pattern                                    | Trigger                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Real event dispatcher                      | More than about 3 contexts react to the same event and the switch becomes a fan-out problem.                                       |
| Event sourcing                             | The history itself is the product (ledger, audit trail with legal weight).                                                         |
| Separate read models / denormalized tables | Read queries are measurably slow and caching does not fix it.                                                                      |
| Domain service                             | A use case must change two aggregates and no boundary change fixes it. Stateless function; coordinates, holds no rules of its own. |

In every case: name the trigger, tell the user, then add the pattern. Never slip it in.
