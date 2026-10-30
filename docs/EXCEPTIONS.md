# Standards Exceptions

Policy: `tyohDeveloper/engineering-standards` release 1.0.1.1. Rule C-27: every departure has a rule, reason, owner and review date. Review dates are checked at each architecture review; an expired entry is a finding.

| ID | Rule | Gap | Reason | Owner | Review by |
|---|---|---|---|---|---|
| E-1 | C-19 build gating | No composed build gate and no CI workflow; `build`/`typecheck` run by hand | Replit-era scaffold; add a composed `npm run build` (check, lint, tests, verify) and a GitHub Actions workflow on a pinned runner | David Hoyt | 2027-04-30 |
| E-2 | C-20 dead code; C-1 role mapping | Replit scaffold persistence (`server/storage.ts`, Drizzle `users` table, `drizzle.config.ts`) is unused by any route | Remove with the `pg`/`drizzle` dependencies, or map when a store is actually needed | David Hoyt | 2027-04-30 |
| E-3 | C-22 tests | No automated tests exist | Add Vitest for `shared/**` and the data loaders when the build gate exists | David Hoyt | 2027-04-30 |
| E-4 | C-1, C-6, C-11, C-12 structural checks | No standards checker; role mapping, export and size limits are review-only | Port `check-standards.mjs` from Unicode-Explorer when the build gate exists | David Hoyt | 2027-04-30 |
| E-5 | C-20 dead code | No dead-code tool runs | Add knip (or equivalent) once a build gate exists | David Hoyt | 2027-04-30 |
| E-6 | C-26 license inventory | No generated third-party license inventory | Generate from the shippable dependency tree when the build gate exists | David Hoyt | 2027-04-30 |
| E-7 | C-31 no secrets | No secret scanner | Add secretlint (or equivalent) when the build gate exists | David Hoyt | 2027-04-30 |

## Existing carve-outs

No pre-existing lint overrides, per-file exclusions, skipped tests or disabled rules were found at adoption.

## Closed

| ID | Rule | Closed by |
|---|---|---|
