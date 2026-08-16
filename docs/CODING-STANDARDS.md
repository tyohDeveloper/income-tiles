# Coding & Architecture Standards

**Status:** Normative. **Version:** 2.2 (portable edition). **Owner:** David Hoyt (@tyohDeveloper).

> **Source of truth.** The canonical statement of these standards is the
> **`programming` project knowledge wiki**, page
> `concepts/coding-architecture-standards`, with these companion pages:
> `coding-standards-data-layer`, `coding-standards-localization`,
> `coding-standards-artifact-contract`, `coding-standards-platform-model-remote`,
> `repository-conventions`,
> `architecture-review-lessons`, and the target pages
> `coding-standards-standalone-html5`, `coding-standards-hosted-postgres`,
> `coding-standards-native-wrappers`.
>
> This file is a **derived copy**, committed to every repository so that any
> coding agent — Replit Agent, Claude, GPT, Gemini — reads the same rules from
> inside the checkout without needing wiki access.
>
> **Do not amend this file in isolation.** Amend the wiki page first, then
> propagate. If this file and the wiki disagree, the wiki wins.

This edition is stated against **layer roles** rather than literal paths, so it
applies unchanged to single-file HTML5 apps, Replit-hosted Postgres apps, and
native wrappers. Each repository declares its own path mapping in §0.

---

## 0. Per-repository path mapping

Every repository fills in this table. A rule that names a layer role applies to
whatever paths that repository maps the role to. An unmapped role means the
repository has no such layer, and rules naming it are inert.

| Layer role | This repository's paths |
|---|---|
| **VIEW** | `client/src/components/**`, `client/src/pages/**` |
| **CONTROLLER** | `client/src/hooks/**`, `server/**` |
| **STATE** | *(unmapped — dashboard state is component-local; introduce a store before it outgrows that)* |
| **PURE** | `client/src/lib/**`, `shared/**` |
| **PURE-CORE** | `shared/**` |
| **DATA** | `client/public/data/**`, `data/**` |
| **PLATFORM-PURE** | *(unmapped)* |
| **PLATFORM-AMBIENT** | *(unmapped)* |
| **MODEL** | *(unmapped)* |
| **REMOTE** | *(unmapped)* |

**Target:** hosted app. Default branch is `master` rather than `main` — bring it
in line with §12 at the next convenient point.

---

## 1. The layer model

Exactly these layers, with a strict dependency direction. A layer may import
from layers **below** it. No layer may import from layers above it.

```
VIEW          components / templates — rendering only
CONTROLLER    hooks, effects, dispatch, IO, timers, clipboard, requests
STATE         reducers, action creators, selectors, stores
PURE          side-effect-free domain logic
DATA          JSON, no code
PLATFORM-PURE     mandated deterministic primitives (crypto, IDs) -- importable from PURE
PLATFORM-AMBIENT  mandated entropy/IO primitives (salts, KMS) -- CONTROLLER-only
MODEL / REMOTE    persistent state this app owns (MODEL) or consumes via published contract (REMOTE)
```

**Rule 1.1 — VIEW computes nothing.** Views render state and call
controller-supplied callbacks. They must not compute domain results, parse
domain text, format numbers or dates for locale, or perform domain arithmetic
inline. That work belongs in PURE, invoked through CONTROLLER or STATE.

**Rule 1.2 — CONTROLLER sequences, never calculates.** Controllers may sequence
effects, hold ephemeral DOM refs and timer handles, perform IO, dispatch
actions, and call PURE functions. They must not implement arithmetic, domain
policy, formatting algorithms, or domain-text parsing.

**Rule 1.3 — STATE is pure.** Reducers, action creators, and selectors are
pure. No `setTimeout`, `fetch`, DOM access, `Date.now()`, or `Math.random()` in
any of them.

**Rule 1.4 — PURE is genuinely pure.** PURE files have no UI-framework
imports, no `document`/`window` access, no `Date.now()`, no IO, no
module-level mutable state, and no mutation of their inputs. Given the same
input they return the same output. Clock and randomness are **injected as
parameters**, never read ambiently.

**Rule 1.5 — Data is data.** All domain data — conversion factors, category
groupings, calendar metadata, historical entities, button layouts, UI strings,
locale tables — lives in DATA as JSON. If a table has more than five entries,
or is likely to change independently of code, it is data and belongs in JSON.

**Rule 1.6 — Pure computation is single-sourced.** Any calculation,
transformation, or formatting operation is one PURE function. Views,
controllers, reducers, and other pure helpers all reach the same result by
calling that function; none reimplement it.

A "computation" includes arithmetic on domain values; symbol or string
composition driven by domain rules; classification or lookup against domain
tables; and structural transforms on domain objects. UI-only structural work —
class-name strings, animation prop bags, ARIA-label assembly, markup
composition — is **not** a computation and stays in VIEW.

When a computation appears in two or more places — across layers, across
siblings in one layer, or across call sites in one file — that is duplication
and must be extracted. When a formula is used exactly once today but would be a
plausible reuse candidate under a near-term change, extraction is still
preferred: the naming discipline of §3.7 is worth more than the one indirection
saved. Skip extraction only when the computation is genuinely view-local and
cannot recur.

Two call sites may *intentionally* implement different formulas for the same
domain concept. In that case the shared portion is still extracted, the
divergence is commented at both sites, and the divergence itself is a §11
exception with an owner and a resolution plan.

**Review test.** "If I fix a bug in this formula, how many files must I
change?" The answer must be **one**.

**Rule 1.7 — Runtime-dependency selection is single-sourced.** When a
third-party library provides a capability with multiple possible
implementations (polyfill vs. native API vs. alternative library), the *choice*
is itself a single-source decision. One PURE file re-exports the chosen binding
under an app-owned import path. Every consumer imports from that file; no
consumer imports the underlying library directly, and no consumer references
the global (`window.<X>`) equivalent. Migration becomes a one-line change.
These source-selection files are the one legitimate re-export permitted under
§3.8 and require an `EXCEPTION [coding-standards §3.8]` comment naming the
migration plan.

**Rule 1.8 -- PLATFORM holds mandated dependencies, split by determinism.**
Hashing for unique keys, password hashing, canonical serialization, and any
org-mandated cross-application primitive live in PLATFORM instead of being
authored per app. PLATFORM-PURE symbols are enumerated on a checked-in
allowlist and importable from PURE; PLATFORM-AMBIENT symbols (salts,
`randomUUID()`, KMS calls) are importable only from CONTROLLER, exactly like
`Date.now()`/`Math.random()`. Full rationale on
`concepts/coding-standards-platform-model-remote`.

**Rule 1.9 -- MODEL and REMOTE are one port, two adapters, not two ranks.**
CONTROLLER depends on a single typed interface for "talk to the true model."
MODEL implements it while this application is the sole schema owner and sole
writer/migrator; REMOTE implements it once a second writer exists and the
schema is owned by another service, against a published contract. The port
never promises atomicity across the boundary. Full split and the
write-authority trigger on `concepts/coding-standards-platform-model-remote`.

---

## 2. Mutable state discipline

State is one of five classes. Each class has exactly one legal home.

| Class | Definition | Legal home |
|---|---|---|
| **Durable domain state** | Anything a test would assert on; survives a mode/tab switch or affects results | STATE |
| **Transient UI state** | Short-lived visual state (< ~1 s) with no domain meaning | STATE, or controller-owned local state documented in the file header |
| **Ephemeral UI mechanics** | Focus targets, blur-suppression flags, committed-text guards, animation-frame IDs | Ref inside the controller or view that owns the widget |
| **Effect resources** | Timer handles, subscriptions, abort controllers | Ref, cleaned up in the effect teardown |
| **Flow-significant memory** | A value the *next* action depends on — pending domain intent | STATE, as a typed field with an action |

**Rule 2.1.** No local component state in a top-level app controller for a
concept that already exists in STATE.

**Rule 2.2.** No ref holding a value that determines a later domain decision.
Such values are STATE, not invisible memory. Timer handles and DOM handles are
the exception.

**Rule 2.3.** Setters in state-adapter hooks dispatch action creators, never
raw action literal objects.

---

## 3. Function and file granularity

These are the rules most often asked for by number. They are hard limits, not
guidelines, and they are enforced by CI (§7).

**Rule 3.1 — Function length: ≤ 20 lines.** Every exported function body is
**≤ 20 lines**, excluding the signature line and the closing brace. When a
natural function is longer, refactor by extracting a helper first. Only if the
helper has no external reuse may it remain in the same file as a purely-local
function.

**Rule 3.2 — One export per file (PURE).** A PURE file exports **at most one**
function, or one const that is a function or a function-producing factory. The
filename matches the exported function name in camelCase. Exceptions require a
comment citing this section and giving a reason.

**Rule 3.3 — File length by layer role.**

| Layer role | Hard limit |
|---|---|
| **PURE-CORE** | **100 lines** |
| **PURE** (elsewhere) | **150 lines** |
| **STATE** | **150 lines** |
| **CONTROLLER** | **150 lines** |
| **PLATFORM-PURE** | **100 lines** |
| **PLATFORM-AMBIENT / MODEL / REMOTE** | **150 lines** |
| **VIEW** | **250 lines** |

A CONTROLLER file over its limit is either doing pure work (extract to PURE) or
coordinating too many domains (split by domain). Import and export lines count
toward the limit; comment-only lines do not.

**Coverage.** These limits apply to the **entire application**, not to the
subset that already complies. A checker scoped around the messy part of the
codebase is decoration — see §16.1.

**Rule 3.4 — The VIEW carve-out.** Inside a VIEW file, event handlers, effects,
IIFEs, and named callbacks still obey Rule 3.1 (20 lines). A **declarative
markup render body** is the only function body permitted to exceed 20 lines,
and only up to **80 lines** of markup in the return statement. This is a
deliberate carve-out, not a hole. A component whose markup exceeds 80 lines is
split into child components.

**Rule 3.5 — No duplication.** Any logic used in more than one file is
extracted into its own PURE file. This applies to data too: a value appearing
in multiple JSON files belongs in the base file only, resolved by cascade
(§5.4).

**Rule 3.6 — No dead code.** Unused functions, exports, JSON keys, dead
branches, identical `if`/`else` arms, and unreachable defaults are removed on
sight. Enforced by a dead-code scan in the build.

**Rule 3.7 — Exception rationale.** Every file excluded from any rule above
carries a comment explaining *why* and citing the section that permits it:

```ts
// EXCEPTION [coding-standards §3.2]: type-and-function co-location.
// Owner:    @tyohDeveloper
// Approved: 2026-08-08
// Expires:  2027-02-08
// Renewal:  removable once the discriminated union moves to its own module.
```

**Rule 3.8 — Name for responsibility, not shape.** A reader must be able to
guess from the filename alone whether a change belongs in that file.

1. **Domain names over shape names.** `parseDirectEntry`, `computeConversion`,
   `applyPushValue`, `useRpnXEditField` all name what they own.
   `helpers`, `utils`, `misc`, `common`, `shared`, `handlers`, `setters`,
   `getters`, `stuff`, `things`, `lib`, `index`, `types`, `useHelpers`,
   `useHandlers`, `useSetters` name a *shape* and are prohibited by default —
   including as leaf names inside an otherwise well-named directory.
2. **Directories name domains, not layers.** A `formatting/` directory contains
   formatters. If it accumulates parsers, sanitizers, or IO glue it has
   drifted: rename it, split it, or move the outliers. The check — given a bug
   report like "the DMS parser drops the sign when seconds is empty", does a
   new contributor know where to look?

**`client`, `stub`, `connector`, `gateway` are reserved and prohibited** for the
shared-state adapter role, in favor of REMOTE -- rationale and citations
(ADR-0001) on `concepts/coding-standards-platform-model-remote`.

When an extraction produces a file that fits no existing directory, add a new
directory rather than dropping it in the closest-looking one. When splitting a
large controller or view, split along responsibilities that already exist in
the code ("these callbacks all touch the clipboard"), not along technical
predicates ("everything that dispatches"). Technical groupings require an
`EXCEPTION [coding-standards §3.8]` comment naming why the domain grouping was
unavailable.

**Rule 3.9 — No barrel files.** A file consisting only of re-exports is
prohibited, and so is any single re-export statement inside an otherwise
substantive file — including `export * from`, `export type { X } from`, and
`export { X };` where `X` arrived via an import in the same file. Consumers
import the specific file that owns each symbol.

Rationale: barrels launder the domain boundaries §3.8 exists to force people to
draw; they double refactor cost and silently keep stale paths working; the
demand for them is usually a signal that a consumer coordinates too many
domains and should be split; and any barrel with a side-effecting import drags
its whole graph into the bundle.

Permitted exceptions, each requiring an `EXCEPTION [coding-standards §3.8]`
comment: a **single**-symbol compatibility shim during an actively-in-progress
migration, with a removal date; a **single**-symbol runtime-dependency
source-selection shim per §1.7, whose removal is contingent on external support
rather than a date; and the published entry point of an npm package, where one
exists.

---

## 4. UI-object identifiers

**Rule 4.1 — Coverage.** Every interactive primitive in the shipped artifact
carries a stable, unique identifier. An interactive primitive is any element
with a click, change, value-change, checked-change, or submit handler, any
element with `role="button"`, and any rendered input, select, switch,
checkbox, slider, toggle, button, or tab primitive. Read-only displays a test
must assert on — result readouts, computed factors, stack registers — also
carry an identifier.

**Rule 4.2 — Identifier grammar.** IDs are set via `data-testid` and follow:

```
{role}-{area}-{name}[-{key}]
```

- **role** — `button`, `select`, `input`, `display`, `text`, `switch`,
  `checkbox`, `slider`, `panel`, `backdrop`, `tab`.
- **area** — the pane or region. Omit only when the widget is truly app-wide.
- **name** — the widget's specific purpose.
- **key** — **required** whenever the widget is generated in a list or map.
  Use the underlying domain key, **never** the array index.

**Rule 4.3 — Uniqueness.** Every `data-testid` in a rendered tree is unique.
A rendered-DOM test asserts no duplicates per pane and per full app render, and
the build verifier fails if any value appears more than once in the artifact.

**Rule 4.4 — Production retention.** Identifiers are part of the deliverable's
testability contract. The build must **not** strip `data-testid` from the
production artifact, and minifiers offering attribute-stripping must have it
disabled. Bundle cost is measured, not estimated.

**Rule 4.5 — Domain metadata coexists.** `data-*` attributes carrying domain
metadata are permitted and encouraged alongside `data-testid`. They answer
different questions — *which instance am I* vs. *what role do I play in the
harness* — and tests may query by either.

**Rule 4.6 — Additive-only, with a rename process.** New IDs are additive;
existing IDs are never silently renamed. Corrective renames go through a
"rename manifest" PR whose body lists every old → new mapping and updates every
consumer — tests, docs, external harnesses — in the same change. A rename PR
leaving a consumer un-updated fails CI.

---

## 5. Data-external rule

**Rule 5.1.** No table of domain values may live as a literal in a code file
outside DATA.

**Rule 5.2.** DATA JSON is schema-validated at build time. New categories or
entity kinds require the schema update in the same PR.

**Rule 5.3.** One source of truth per fact. If the same table appears in two
files, one is deleted and the other imported.

**Rule 5.4 — Cascade for variants, delta only.** Locale files, label configs,
and regional variants contain **only** the keys that differ from their base;
everything else falls through. The merge is performed by **one** shared
cascade-resolve function reused by every variant layer. Storing duplicate
values in a variant file is a defect.

**Rule 5.5 — Declared taxonomies over hardcoded lists.** Behavior is expressed
as JSON metadata (`family`, `primaryCategory`, dimensional-alias fields) rather
than hardcoded exclusion lists, ghost categories, or duplicate dimension maps.
Adding a category or entity must not require scattered filter edits.

**Rule 5.6 — Nothing user-visible is a code literal.** All user-visible text is
resolved by key from DATA. No display string is hardcoded in a code file.

---

### Data referencing code

Some domain values cannot be expressed as a factor or a literal — they need a
function. The pattern:

**Rule 5.7 — Data names a function; a validated registry resolves it.** A data
entry declares a named function; one code-side registry maps names to
implementations. Schema validation at load rejects unknown names outright. Data
never contains code, and code never contains the table of which entries use
which function.

**Rule 5.8 — Redundant representations are proven equal, not assumed equal.**
Where an entry carries both a factor and a function, a test asserts the factor
exactly equals the function evaluated at unity. Factor-consuming call sites use
the factor directly, so silent drift produces wrong results with no error.

**Rule 5.9 — Entries that break an assumption are marked, not just omitted.**
Genuinely non-linear entries carry an explicit marker so a predicate can exclude
them from every consumer that assumes linearity. The absence of a flag is not a
sufficient signal.

**Rule 5.10 — Ordering invariants are declared and independently tested.** Where
array order is semantic (base entry first, then ascending magnitude), a test
computes the expected order from the data itself rather than trusting the
committed order, with a short explicit exemption list. New entries are inserted
in sorted position, never appended.

---

## 6. Counting and indexing

**Rule 6.1 — Everything is 0-indexed.** All positional references — rows, keys
within a row, stack levels, registers, panes, and any other ordered sequence —
are 0-indexed in code, in JSON data files, and in task descriptions.

**Rule 6.2 — Cross-check rule.** Whenever a task description or comment
identifies something by both numeric position *and* name, both must agree under
0-based counting before the description is finalized.

---

## 7. Build-time gating and enforcement

**Rule 7.1 — Every rule here is enforced by a script or a test that runs on
`npm run build`.** If a rule is not enforceable, it does not belong in this
document.

**Rule 7.2 — Required build sequence.** Typecheck → lint (size, naming,
barrels, testids) → unit tests → bundle → verify artifact, failing on the first
error. E2E is a separate release gate so bundler iteration stays fast.

**Rule 7.3 — CI runs the same build.** A workflow in `.github/workflows/` runs
`npm ci && npm run build` on every PR and on `main`, then E2E as a separate job.
Both must be green to merge. Local, CI, and hosted-publish outputs must be
equivalent.

**Rule 7.4 — Prefer AST parsing over regex parsing.** Any linter or codemod
inspecting code files uses the language AST. Regex or brace-count parsers are
permitted only for JSON, Markdown, and the built artifact.

**Rule 7.5 — No rule is enforced only by convention.** If a checker cannot
express a rule today, the rule is captured as a named lint-rule plan, a
`TODO(coding-standards §N)` marker, or a targeted failing test.

**Rule 7.6 — Baseline updates require review.** The artifact verifier enforces
gzip ≤ `baseline × 1.05`. Committed size and gzip baselines are updated by an
ordinary reviewed PR that records a note identifying what caused the shift,
never by an automated bump.

**Rule 7.8 — The checker and this document cite each other.** Lint and verifier
failure messages name the section number they enforce, and each enforcing
script's header links back to this file. A developer hitting a failure reaches
the rationale in one hop.

**Rule 7.7 — Linters are devDependencies only.** They are not imported by
application code, are not in the bundler's dependency graph, and add zero bytes
to the shipped artifact.

---

## 8. Testing

**Rule 8.1.** Every exported PURE function has at least one unit test. Coverage
is verified by scanning PURE for exports and asserting a matching test exists.

**Rule 8.2.** Every reducer has transition tests for every action type.

**Rule 8.3.** Every user-visible flow has an end-to-end test, run against the
built artifact rather than the dev server.

**Rule 8.4.** Tests are part of the build (§7.2), and run in CI, not just
locally.

---

## 9. Libraries vs. home-built code

**Rule 9.1 — Prefer a known-good library over hand-rolled code**, subject to
§9.2. "Known-good" means actively maintained (release within 12 months),
broadly adopted (>100k weekly downloads or clearly canonical in its niche), and
permissively licensed (MIT/BSD/Apache-2.0/ISC).

**Rule 9.2 — Size and complexity budget.**

| Where it runs | Shipped gzip cost |
|---|---|
| **Dev / build only** — linters, test runners, bundlers, minifiers, typecheckers | **0 bytes — hard rule** |
| **Runtime application code** | **≤ +5 kB gzip** per new library; **≤ +20 kB gzip** cumulative per release |

Exceeding either ceiling requires a §3.7 exception with measured before/after
gzip numbers.

**Rule 9.3 — Ecosystem-standard presumption.** A library that is the
*canonical* implementation in its category is presumed compliant with §9.1.
Canonical is a high bar: popular is not enough; the rest of the ecosystem's
tools must assume you use it.

**Rule 9.4 — Prefer libraries that shrink existing code.** Between two
candidates, prefer the one whose adoption lets you delete more application
code.

**Rule 9.5 — Reject libraries duplicating a stack primitive.** If the language,
framework, or bundler already provides the capability, do not add a library for
it. This is the rule that catches utility-library sprawl.

**Rule 9.6 — Dev tools are not free at 0 bytes shipped.** New devDeps cost
install time, disk, and CI cache. They must justify themselves against those
costs and against the checker or capability they enable.

**Rule 9.7 — Document adoptions.** A PR adding a library records the measured
gzip cost against the current baseline, the code it replaces or capability it
enables, and which enforcement rule it participates in.

---

## 10. Licensing

**Rule 10.1 — MIT, always.** Every repository carries a correctly formatted
`LICENSE` at the root (current year, `David Hoyt`) as the first or second
commit. This is the standing choice.

**Rule 10.2 — Compatibility screening.** GPL and AGPL dependencies are
incompatible and must be flagged before adoption, not after.

**Rule 10.3 — Attribution.** When non-trivial third-party code ships in the
built artifact, maintain `THIRD_PARTY_LICENSES.md` with attributions.

---

## 11. Exceptions

When a rule genuinely cannot be met, capture the exception at the top of the
file using the §3.7 template. Exceptions **expire**: each has an owner and an
expiry date, after which CI fails until the exception is renewed or removed.
Repository-wide exceptions live in a machine-checkable
`.architecture-exceptions.json` carrying owner, section, and expiry.

An exception that outlives the condition that produced it is dead code and is
removed.

---

## 12. Repository conventions

- **Host and branch** — GitHub under [tyohDeveloper](https://github.com/tyohDeveloper); default branch `main`.
- **Standards live in the repo** — this file, so every coding agent reads the same source of truth from the checkout.
- **Terse commit messages, decomposed commits** — large changes split into small commits with short subject lines.
- **Author attribution** — agent-authored commits use `50533494+tyohDeveloper@users.noreply.github.com`, matching GitHub's web UI, so attribution resolves correctly under email privacy.
- **Implementation plans checkpointed in GitHub** before large build phases, so the plan is durable and reviewable outside the coding-agent session.
- **README as a contract** — minimum: one-line description, quickstart, build command, license line, link to the deployed instance if any.
- **`.gitignore` from the first commit** — `node_modules/`, build outputs, coverage, editor files, OS junk, and secrets (`.env*` except `.env.example`).
- **CHANGELOG discipline** — Keep-a-Changelog style, adopted at the first tagged release rather than retrofitted.
- **Semantic versioning** for anything tagged and released.
- **Repo topics** — a small set per repo (`tyoh-app`, deployment target, primary language) for discoverability.

---

## 13. Documentation style

**Rule 13.1 — Reference specs, not directive documents.** Reference material
presents math and rules in exact symbolic form, without prescriptive phrasing
("do not hard-code decimals") that a downstream consumer could misread as a
universal directive rather than a project-local style rule.

**Rule 13.2 — Cite primary sources.** Reference documents carry a
primary-source citation list so commits can point at specific authorities.
Prefer primary sources (standards bodies, government gazettes, national laws)
over aggregators. When a primary source is unreachable, cite the aggregator and
record the blocked primary for later revisit. Never cite a primary source that
contradicts the value it is attached to.

**Rule 13.3 -- Architecture decisions get a numbered, immutable record.** `docs/adr/NNNN-*.md`, one file per decision, with a required "alternatives rejected and why" section. ADR-0001 (REMOTE chosen over Client/Stub/Connector/Gateway; PLATFORM reinstated as a layer split by determinism) is recorded on the wiki page `concepts/coding-standards-platform-model-remote`.

---

## 14. Change process

- Amend the **wiki page first** (`concepts/coding-architecture-standards`), then propagate to this file in every repository.
- When a standard changes, the enforcing checker changes in the same PR. A standard is not adopted until the checker fails on a violation.
- This document supersedes the normative statements in earlier per-repo standards files, without deleting them — they remain the record of how the codebase got here.

### Superseded predecessors

| Location | Superseded content |
|---|---|
| `OmniUnitConverter-Calculator:docs/perplexity/architecture-standards.md` v1.7 | Retained as the OmniUnit-specific elaboration (§4 testid grammar, §8 polyglot XHTML, §14 minimization, §15 locale data). Its §3 is restated here verbatim in limits. |
| `multiCalc:artifacts/rpn-calc/CONVENTIONS.md` | The ≤ 25-line function limit is superseded by §3.1 (≤ 20). |
| `Book-Converter:Cleanup.txt` | The < 200-line file and ≤ 30-line function limits are superseded by §3.1 and §3.3. |

---

## 15. Localization and locale data

Applies to any app shipping translated text or locale-sensitive number, date, or
layout treatment. Full detail, including enforcement mapping, on the wiki page
`concepts/coding-standards-localization`.

**Rule 15.1 — One fallback locale, one chain.** The chain is
`requested locale → base locale → raw key`, and nothing further. Every string
any code path can reach exists as a key in the base locale file.

**Rule 15.2 — Adding a language is an all-files change.** The locale code joins
the canonical supported-languages list and every translation domain gains a file
with full key coverage. Removing a language removes all of them in the same PR.
A code in the list without matching files silently degrades with no error.

**Rule 15.3 — Variants carry only the delta**, merged by the single shared
cascade-resolve function of §5.4. Duplicate values in a variant file are a
defect.

**Rule 15.4 — Key sets are shape-identical across locales** before any build-time
pruning. An added or omitted key relative to the base is a bug caught by an
integrity test.

**Rule 15.5 — Exactly two translation domains** — interface strings, and display
names of domain entities. A third requires amending the standard first.

**Rule 15.6 — Symbols are never translated.** Unit symbols, element symbols, and
other international or SI notation stay canonical in every locale. Only display
names translate.

**Rule 15.7 — Display-name keys are global.** The same key resolves identically
everywhere, so **two entities in different categories must not share a base-language
display name.** Collisions are disambiguated with a parenthetical qualifier that
is part of the name and translates as a whole.

**Rule 15.8 — Dead-key guard.** Every key in a display-name locale file must
correspond to a current entity name in the data, a title-cased base value, a key
literally referenced by code through the translate functions, or a
prefix-generated name. Enforced against a committed allowlist. This exists
because renames silently left ~120 orphaned keys duplicated across 12 locale
files. When auditing, note that lowercase strings in code and tests are usually
entity IDs or symbols, not translation keys.

**Rule 15.9 — Renames and removals are same-PR, all-locale.**

**Rule 15.10 — Source files stay complete; the bundle gets pruned.** A build-only
step drops entries that would resolve identically through fallback. Dev and test
always see full files. Pruning is coupled to the fallback chain: if a translate
function loses its fallback, pruning breaks display, and the two change together.

**Rule 15.11 — Numeral system is decoupled from locale.** Locale controls
translated text; an independent preference controls the numeral system. New
locales default to Western Arabic; overrides live in the formatting layer, not in
locale data.

**Rule 15.12 — RTL treatment.** Layout stays LTR by default; only text runs
honor natural direction. Compound displays (feet-inches, degrees-minutes-seconds)
preserve canonical order regardless of direction. Numbers inside RTL runs render
in Latin numerals unless the user opts in otherwise. The RTL locale set lives in
one place; adding a locale extends that set rather than adding direction checks
across components.

**Rule 15.13 — Notation conventions in reference text.** `⋅` for multiplication.
Unicode superscripts only for single-character exponents (`10ˣ`, `e²ˣ`,
`10⁻¹⁹`). Fractional and compound exponents stay in caret form — `10^(x/10)`,
`10^(x/20)`. Superscript-parenthesized fractions were explicitly rejected as
unreadable and must not be reintroduced by a later cleanup. `×` is reserved for
physical dimensions (`210 mm × 297 mm`), never scalar multiplication.

---

## 16. Lessons from the architecture pass

Meta-rules from the model-council review that produced these standards. They
generalize better than any individual limit.

Full detail on the wiki page `concepts/architecture-review-lessons`.

**16.1 — Enforcement that covers only the compliant layer is not enforcement.**
The review's central finding: the size linter governed exactly the directory that
already passed, while a 1,211-line view file holding arithmetic, parsing, and
formatting was invisible to it. Coverage must be widest where violation is most
likely — views and controllers — not where compliance is easiest to demonstrate.

**16.2 — Extract misplaced logic before splitting large files.** Splitting a file
that is large *because* it holds logic belonging elsewhere only redistributes the
violation, and the split reflects line counts rather than responsibilities.

**16.3 — A compliant decomposition must be actively protected.** Fine-grained
one-function-per-file decomposition looks like overhead to a reader encountering
it cold. What not to change is as much a part of the standard as what to change.

**16.4 — Duplication drifts before anyone tries to change it.** The two
implementations of the same operations had already diverged: differing field
defaults, and in the executed copy, silent rounding of odd exponents and
dimension preservation where dimensionless input was required. The compliant copy
was correct and unused; the violating copy was wrong and running. This is why
§1.6 is a defect rule, not a style rule.

**16.5 — Purity is about reviewability, not just testability.** A policy buried in
a 30-case switch cannot be reviewed. As a named pure function, a reviewer or test
can ask "what should this return for √(m³)?" and get an unambiguous answer.

**16.6 — Dead code is a diagnostic, not just debris.** An `if`/`else` with
identical branches accumulated in the one file no linter or test inspected.
Finding that class of defect is evidence of a coverage blind spot; fix the
coverage, not only the line.

**16.7 — Platform workarounds relocate with their comments verbatim.** WebView
focus and blur handling is non-obvious, load-bearing, and expensive to
rediscover. Tidying those comments during a move is how the knowledge gets lost.

**16.8 — Refactor history is worth keeping.** Phase-by-phase task records are
superseded as normative statements but retained as the record of how the codebase
reached its shape. New standards cite that history rather than deleting it.

---

## 17. Target-specific standards

These layer on top of this document and live on their own wiki pages:

- **Standalone HTML5** (`concepts/coding-standards-standalone-html5`) — single-file artifact, no network, no persisted user data, URL fragment as the only opt-in state.
- **Artifact contract** (`concepts/coding-standards-artifact-contract`) — the polyglot markup contract (void self-closing, no boolean shorthand, CDATA wrapping, no comments in script/style), the five artifact-verification assertions, and the mandatory minimization pass with acceptance criteria, minifier configuration, and benchmark cadence.
- **Hosted Postgres** (`concepts/coding-standards-hosted-postgres`) — one migration per commit, never edit an applied migration, environment separation with distinct databases and secret sets.
- **Native wrappers** (`concepts/coding-standards-native-wrappers`) — minimal native shell hosting a WebView over the bundled HTML build; platform storage guidance and signing.
- **Localization** (`concepts/coding-standards-localization`) — the full elaboration of §15, including enforcement mapping and source-citation rules.
- **Data layer** (`concepts/coding-standards-data-layer`) — the full elaboration of §5.
- **Repository conventions** (`concepts/repository-conventions`) — the full elaboration of §12.
- **PLATFORM, MODEL, REMOTE** (`concepts/coding-standards-platform-model-remote`) — mandated-dependency and shared/remote-persistent-state roles, plus the Authority and change control rules of §18. Reserved; unmappable on the standalone-HTML5 target.

---

## 18. Authority and change control

Full detail on the wiki page `concepts/coding-standards-platform-model-remote`.

**Rule 18.1 — Authority is orthogonal to layer.** A layer answers where code
lives and what may import it. Authority answers who may change a mandated
binding (crypto/ID primitives, vendor-pinned numeric or hardware libraries,
migrations, RLS policies) and whether the build matches policy. Both are
required; neither substitutes for the other.

**Rule 18.2 — Mandated bindings are a manifest entry, not a comment.**
`.architecture-bindings.json` records: binding id -> authority
(`team-editable` | `org-mandated`) -> approved module specifier and integrity
hash **per deployment target** -> policy reference -> review date. CI
resolves each mandated binding in the built artifact and fails the build if it
does not match the manifest entry for that target.

**Rule 18.3 — Standing policy bindings review; they don't expire.** An org
mandate is not a violation with a countdown. Record it with an owner, a
policy reference, and an annual review date, in a manifest separate from
`.architecture-exceptions.json`, so §11's "exceptions expire" stays literally
true for actual exceptions.

**Rule 18.4 — Target-conditional binding resolves at build time.** CI builds
and tests every mandated target, not only the portable dev default. No test
may assert exact equality on a value derived from a target-conditional
numeric binding (e.g. vendor BLAS vs. reference BLAS); compare against a
shared conformance-vector suite with a declared tolerance.
