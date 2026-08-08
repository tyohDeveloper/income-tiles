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

All code in this repository follows **[`docs/CODING-STANDARDS.md`](docs/CODING-STANDARDS.md)** — the binding rules for layer boundaries, purity, function and file size limits, naming, data externalization, testing, and dependency budgets. Read it before making changes.

Key hard limits: exported function bodies ≤ 20 lines; one export per pure-logic file; pure-core files ≤ 100 lines, other pure/state/controller files ≤ 150, view files ≤ 250 with ≤ 80 lines of markup in the return. §0 of that file maps those layer roles to this repository's actual directories.

The canonical source of truth is the `programming` project knowledge wiki page `concepts/coding-architecture-standards`; the in-repo file is a derived copy. Amend the wiki first, then propagate here.
