# Agent contract

Instructions for any coding agent working in this repository.

## Read first

1. [README.md](README.md)
2. [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md): the adopted standards release (engineering-standards 1.0.1.1, tag `standards-1.0.1.1`), delivery profile, role mapping and enforcement matrix. The rule text is retrieved from the hub at that tag. [docs/standards/portable-v2.2.md](docs/standards/portable-v2.2.md) is the superseded predecessor.
3. [STANDARDS-ADOPTION.json](STANDARDS-ADOPTION.json) and [docs/EXCEPTIONS.md](docs/EXCEPTIONS.md).

Inspect the code before choosing tools or patterns; do not import conventions from other repositories. Checkpoint substantial plans before build phases; use terse, decomposed commits; run the actual repository checks.

## Delivery profile directives

- Profile: state `none`, packaging `hosted-web`, store `none`, identity `none`, network `required`, compute `interactive`; localization scope none. Rules bound to these values are in `standards/profiles.md` §3 of the hub; apply them without re-deriving.
- Ports used: none. PURE, STATE and DATA modules import none of them; CONTROLLER mediates. Do not change a port implementation without updating the adoption record.
- Bindings: `typescript:application`. Follow `standards/bindings/<language>.md`; the class column in `coding-core.md` sets which rules are mandatory.
- `network = required` is for same-origin dataset files only; no third-party calls at run time.

## Commands

| Command | Purpose |
|---|---|
| `npm run check` | TypeScript check |
| `npm run build` | Production build (`script/build.ts`) |
| `npm run dev` | Development server |

## Rules that are easy to break

- Domain computation lives in PURE files, one exported function per file, named for the function. Views compute nothing; controllers sequence and never calculate.
- Every function body is at most 20 lines; file limits are per role (PURE-CORE 100, PURE/STATE/CONTROLLER 150, VIEW 250).
- No shape names (`utils`, `helpers`, `types`, `index` and the rest of TS-7), no barrels, no re-exports.
- Every departure from a rule is an entry in `docs/EXCEPTIONS.md` with owner and review date (C-27). Reviews do not authorize remediation.
- Do not silently change the standards version, data meaning, architecture ownership or exceptions. Proposals to change a rule go to the hub.
