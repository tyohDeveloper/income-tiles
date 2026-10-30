# income-tiles

Interactive income distribution dashboard with tiles for poverty, median, robust sigma from median (MAD), quintiles, and top percentiles. Built on WID, Census, BEA, and CBO data.

## Quickstart

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Other targets: `npm run check` (typecheck), `npm run start` (production server), `npm run db:push` (apply schema).

## License

MIT — see [LICENSE](LICENSE).

## Coding & architecture standards

Policy: `tyohDeveloper/engineering-standards` release 1.0.1.1 (tag `standards-1.0.1.1`). [`docs/CODING-STANDARDS.md`](docs/CODING-STANDARDS.md) records the adopted release, delivery profile (`none / hosted-web / none / none / required / interactive`, no localization scope), role mapping, enforcement matrix and local extensions; the rule text is retrieved from the hub at that tag. [`STANDARDS-ADOPTION.json`](STANDARDS-ADOPTION.json) is the machine-readable record; [`docs/EXCEPTIONS.md`](docs/EXCEPTIONS.md) lists open exceptions (C-27). [`AGENTS.md`](AGENTS.md) is the agent contract. [`docs/standards/portable-v2.2.md`](docs/standards/portable-v2.2.md) is the superseded predecessor, kept for history.

Key hard limits (C-11, C-12, C-6): exported function bodies ≤ 20 lines; one export per PURE file; PURE-CORE files ≤ 100 lines, other PURE/STATE/CONTROLLER files ≤ 150, VIEW files ≤ 250.

Proposals to change a rule go to the hub, not to this repository.
