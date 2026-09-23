---
name: git-savvy
description: Enforces this project's git conventions — Conventional Commits for commit messages, Summary/Problem-Solution format for PR descriptions, and merge-commit-only integration (no squash, no rebase merges). Use whenever the user runs or asks about any git operation, including `git commit`, `git merge`, `git rebase`, `git push`, `gh pr create`, drafting a commit message, writing a PR description, integrating a branch, or resolving how to bring changes from one branch into another — even if the user doesn't explicitly mention these conventions.
---

# git-savvy

Project conventions for git work. These override defaults — apply them whenever you touch git, commits, PRs, or branch integration.

## Commit messages — Conventional Commits

Every commit message starts with one of these prefixes:

- `feat:` — a new user-facing feature
- `fix:` — a bug fix
- `chore:` — tooling, deps, config, housekeeping
- `refactor:` — code restructuring with no behavior change
- `docs:` — documentation only
- `test:` — adding or adjusting tests
- `style:` — formatting, whitespace, semicolons (no logic)
- `perf:` — performance improvement
- `ci:` — CI pipeline changes
- `build:` — build system or external dependencies

Rules for the subject line:

- Imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- Lowercase after the prefix
- Concise — aim for under ~72 chars on the subject line
- No trailing period
- A scope is optional but useful: `feat(auth): ...`, `fix(api): ...`

**Why imperative + lowercase:** matches how git itself describes commits ("Merge branch...", "Revert..."), and keeps the log scannable.

**Picking the prefix — the common confusions:**

- Adding a test for existing code → `test:`. Adding a feature _with_ its tests → `feat:`.
- Bumping a dependency for security → `fix:` if it patches a vulnerability that affects users, otherwise `chore:`.
- Renaming a variable, extracting a function → `refactor:`. Reformatting only → `style:`.
- Editing the README → `docs:`. Editing a JSDoc that ships in a published type → still `docs:`.

**Examples:**

Input: Added Supabase magic-link sign-in to the login page
Output: `feat(auth): add magic-link sign-in`

Input: Theme toggle was flashing the wrong icon on first render
Output: `fix(theme): prevent icon flash on initial mount`

Input: Pulled the cookie helpers out of session.ts into their own file
Output: `refactor(auth): extract cookie helpers into dedicated module`

Input: Bumped next from 15.0.1 to 15.0.3
Output: `chore(deps): bump next to 15.0.3`

## PR descriptions — Summary / Problem / Solution

Use this exact template for every PR body:

```markdown
## Summary

<1–3 sentences describing what this PR delivers, from the reader's perspective>

## Problem

<What was wrong, missing, or needed. Link issues if relevant. Explain the user/business impact, not just the code symptom.>

## Solution

<How this PR addresses the problem. Call out the key design choices, anything reviewers should look at carefully, and any trade-offs.>
```

Keep the title short (under ~70 chars) and let the body carry detail. The title itself should still read like a Conventional Commit subject (e.g., `feat(dashboard): add usage charts`) since it usually becomes the merge commit subject.

**Why this structure:** Summary is for the reviewer skimming a list of PRs. Problem forces you to articulate _why_ the change exists — which is what makes the diff understandable in six months. Solution explains the approach so review can focus on the interesting decisions.

If a section is genuinely empty (e.g., a pure docs PR with no "problem"), still include the heading and write one line — don't delete the section, because the consistent shape is what makes PRs scannable.

## Integrating branches — `git merge --no-ff` only

When bringing a branch's work into another branch (typically feature → `preview`), **always** use:

```bash
git merge --no-ff <branch>
```

**Never** use:

- `git merge --squash`
- `git rebase` to integrate (rebasing your own local branch _before_ merging is fine; using a rebase-merge to integrate is not)
- GitHub's "Squash and merge" or "Rebase and merge" buttons — only "Create a merge commit"

**Why:** `--no-ff` always creates a merge commit, even when a fast-forward is possible. That merge commit is the durable record that a unit of work landed — it groups the branch's commits together in `git log --graph`, preserves the individual commit history with their original SHAs, and gives you a single revert target if the feature needs to come back out. Squash throws away the granular history; rebase rewrites SHAs and loses the "this is where feature X landed" boundary.

**Practical guidance:**

- On the CLI, integrate with `git checkout preview && git merge --no-ff <branch>`.
- On GitHub, if the repo settings allow multiple merge styles, pick **"Create a merge commit"**. If "Squash and merge" is the only option enabled, flag it to the user before clicking — the repo settings need to change, that's not something to silently work around.
- The merge commit message should follow Conventional Commits too — typically the same subject as the PR title.

## When the user asks for help with a git command

Apply these rules proactively. If the user says "commit this" or "open a PR", produce output that already follows the conventions above — don't ask them to confirm each rule. If they ask for something that conflicts with these rules (e.g., "squash-merge this branch"), surface the conflict, explain briefly _why_ the convention exists, and ask before going against it.
