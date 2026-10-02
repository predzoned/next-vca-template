# Security

## Reporting a vulnerability

Please do not open a public issue. Use **Security → Report a vulnerability** on this repository's GitHub page, which sends a private report to the maintainers. If that button is missing, private reporting is switched off (see the next section); contact the maintainers listed in the README instead.

## Turn these on in GitHub

A file in the repo cannot switch these on. For each new repository, open **Settings → Advanced Security** (called **Code security** on some accounts) and enable:

- **Dependabot alerts**: GitHub warns you when a package you use has a known vulnerability.
- **Dependabot security updates**: GitHub opens a pull request that upgrades the vulnerable package.
- **Private vulnerability reporting**: enables the button described above.
- **Secret scanning and push protection**: blocks commits that contain API keys or passwords.

All four are free for public repositories. Dependabot is also free for private ones.

## What is already in place

| Guard | Where | What it stops |
|---|---|---|
| Install scripts blocked | `allowBuilds` in `pnpm-workspace.yaml` | A package running code on your machine during `pnpm install`, which is how most npm supply-chain attacks start. Only packages listed with `true` may run scripts. |
| 24-hour cooldown | `minimumReleaseAge` in `pnpm-workspace.yaml` | Installing a version published less than a day ago. Hijacked releases are usually found and removed within hours. |
| Trust downgrade check | `trustPolicy` in `pnpm-workspace.yaml` | Installing a version published with weaker proof of origin than an earlier one, a common sign that a publish token was stolen. |
| Locked versions | `pnpm-lock.yaml` | Different machines silently getting different package versions. |
| Vulnerability check | `pnpm audit --audit-level=high` | Shipping a package with a known high or critical vulnerability. Run it after adding or upgrading a dependency. |
| CI | `.github/workflows/ci.yml` | Merging a pull request that fails lint, type checks, tests, the build, the guards above or the vulnerability check. Its actions are pinned to exact commits. |
| Weekly upgrades | `.github/dependabot.yml` | Falling behind on patches. Dependabot proposes upgrades once a week, after a 3-day wait. |
| Server-side code rules | `AGENTS.md`, Biome, `src/__tests__/` | Trusting input from Server Actions, leaking server code to the browser, and similar mistakes. |

## When a Next.js or React advisory comes out

Watch [Next.js security advisories](https://github.com/vercel/next.js/security/advisories), the [Next.js blog](https://nextjs.org/blog) and your Dependabot alerts.

1. Check whether you are affected: `pnpm audit`. The advisory lists the affected versions.
2. Upgrade to the patched version: `pnpm add next@<patched-version>` (and `react@<version> react-dom@<version>` if the advisory names React).
3. If pnpm refuses because the patch is less than 24 hours old, let that one version through by adding it to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (`pnpm audit --fix` can add it for you):
   ```yaml
   minimumReleaseAgeExclude:
     - next@16.3.6 # security patch for GHSA-xxxx-xxxx-xxxx, remove after it is a day old
   ```
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, then deploy.
5. Remove the exclusion once the version is older than a day.

## When an install fails a supply-chain check

Do not switch the guard off to make the error go away.

- **`ERR_PNPM_TRUST_DOWNGRADE`**: check the flagged version's publish date and its maintainers with `npm view <package>@<version>`. An old release on a maintenance line (for example `6.x` published after `7.x` started signing its releases) is a common false alarm. Only then add that exact version to `trustPolicyExclude` with a comment saying why. A version published in the last few days is a red flag: do not install it, and check the package's GitHub issues.
- **A build script was blocked**: add the package to `allowBuilds` with `true` only if you know why it needs to run code at install time, such as a native image or database driver.

## Before adding a dependency

- Prefer widely used, actively maintained packages (see `AGENTS.md`).
- Run `pnpm audit --audit-level=high` after installing.
- Read the diff of `pnpm-lock.yaml` in the pull request. A small change should not pull in dozens of new packages.
