# v4.1 UI scaffold report

As of 2026-08-03. Scope: Phase B + Phase C of `V4_1_BUILD_SPEC.md` (per-adult income, dual
growth, Section 8 robust σ column, Section 11 kids split). Nothing from v4.2 was built.

Deploy: https://www.perplexity.ai/computer/a/income-tiles-KCRwgJlKTZaE8jqLk9v.HA
Deploy call used (parent must re-issue it so the preview surfaces in chat):

```
deploy_website(project_path="/home/user/workspace/income-tiles/dist/public", site_name="income-tiles", entry_point="index.html", should_validate=false)
```

`should_validate=false` is required, as in v3 — the intentional negative "Median − 2σ" tiles trip
the validator.

## (a) Files created / modified

Created:

| File | Lines | What |
| --- | --- | --- |
| `client/src/lib/v4data.ts` | ~755 | v4.1 data layer: household size by decile (+ band integration and √ equivalence factor), total population by year, PCE / CPI-U / HICP deflator series and the nominal↔real split, kids-split bundle parsing, `loadV4()`, `fmtPeople()`. Every parser falls back to built-in indicative series when a file is absent. |
| `client/src/lib/kidsSplit.ts` | ~140 | Turns the kids bundle into eight country blocks × three tiers, computing post-tax, necessity and discretionary for both sides plus PPP twins and the gross / discretionary deltas. |
| `client/src/components/dashboard/V4Sections.tsx` | ~233 | `KidsSplitSection` — Section 11. |
| `docs/v4.1-qa-screenshots/*.jpg` | — | Phase C evidence (1280 / 1440 / 1600 desktop, 375 mobile, both themes). |
| `docs/V4_1_SCAFFOLD_REPORT.md` | — | This file. |

Modified:

| File | Change |
| --- | --- |
| `client/src/lib/tiles.ts` | `ComputedTile` gains `bandPopulation`, `avgHouseholdSize`, `perEquivalentAdult`, `nominalYoy`, `realYoy`; `TileComputeOptions` gains `totalPopulation`, `householdSize`, `inflation`, `seriesIsReal`. Poverty tiles are forced onto a nominal growth basis (see deviations). |
| `client/src/components/dashboard/TileCard.tsx` | Per-equivalent-adult line under the headline; band population count beside the population-share stat; single YoY row replaced by the always-on `Δ nominal YoY … | Δ real YoY …` cell with a deflator info popover. |
| `client/src/lib/crossCountry.ts` | `MEDIAN_2SIGMA` sentinel column, `CROSS_COLUMNS`, column slugs, tooltip text; per-percentile cell builder refactored into a reusable closure; `invertQuantile()` maps median + 2σ back to a rank so tax / necessity / savings apply at the right point. |
| `client/src/components/dashboard/V3Sections.tsx` | Section 8 header and rows iterate `CROSS_COLUMNS`; robust column tinted with an info popover and its own sort control; Section 10 gains two new source groups (B.6). Fixed a pre-existing literal `\u2014` escape in the Norway/Sweden caveat and updated "five points" → "six points". |
| `client/src/components/dashboard/ControlPanel.tsx` | `V4Selection` / `V4_DEFAULTS`; new **Inflation deflator** section (PCE / CPI-U / HICP) with a note that explains the non-US HICP fallback. |
| `client/src/pages/dashboard.tsx` | `v4-data` query; v4 state + reset; population / household-size / deflator wiring into every `computeTile` call; `deflatorNote` passed to every tile; Section 11 rendered after §9; `alert-v4-pending` banner; four new methodology entries. |
| `script/sync-data.mjs` | Copies `data/v4/*.json` into `client/public/data/v4/`. |

## (b) Shipped vs needs follow-up

Shipped and verified in the browser:

- Per-equivalent-adult line on all 17 main tiles plus both outlier tiles (`text-per-equivalent-adult-*`), with the √household-size divisor in the title attribute.
- Band population count next to the population-share stat (`text-bandpop-*`), exact count in the title.
- Dual growth on every tile, no toggle. Verified in both directions: WID (constant prices) gives nominal +3.7% / real +1.2%; Census (current dollars) gives nominal +4.2% / real +1.6%.
- Inflation-deflator dropdown changes the derived reading: PCE → nominal +3.7%, CPI-U → +4.1%, HICP → +4.1%; returns to +3.7% on reset to PCE.
- Section 8 Median+2σ column renders between P50 and P90, is tinted, sorts (`button-sort-median-2sigma`), and carries the spec tooltip verbatim. US lands at percentile 88.5.
- Section 11 renders eight country blocks, US emphasized with a bold border and tinted background, gross above / discretionary below, colour-coded deltas, per-block mean-gap chip, hover detail (gross → tax rate → post-tax → necessity → discretionary), source footer per block.
- `alert-v4-pending` banner lists the three v4.1 files that have not landed.
- All v3 controls still work: band/threshold toggle, outlier switch and its detail expander, year/country compare, definition switch, PPP, strictness.
- France is absent from every control and from the page text.

Needs follow-up (data, not UI):

- Only `population_by_year.json` landed from the data subagent. `household_size_by_decile.json`, `inflation_deflators.json` and `kids_split_expenditure.json` are still served from built-in indicative fallbacks. The wiring, parsers, tolerant key handling and sync step are all in place, so a follow-up pass is: drop the files into `data/v4/`, run `node script/sync-data.mjs`, rebuild. `parsePopulation` was extended to read the pipeline's `population_by_year` key, so use that same nesting convention for the others where possible.
- `OutlierSection` renders its two tiles without a `deflatorNote`, so those two tiles show dual growth but no deflator info popover. Cosmetic.

## (c) Deviations from `V4_1_BUILD_SPEC.md`

1. **US band population is 68.0M, not ~65M.** The spec's Phase C check said "US pop × 20% ≈ 65M". The landed World Bank series puts US 2024 population at 340,003,797, so a P40–P60 band is 68.0M. The formula is as specified; the anchor in the spec was based on an older population figure.
2. **US no-kids P50 discretionary reads $31,960, not ≈$34,300.** With the fallback kids data the chain is gross 78,000 → 22% tax → post-tax 60,840 → necessity 28,880 → 31,960. Reaching 34,300 needs a lower effective rate or a smaller no-kids basket; the real `kids_split_expenditure.json` will settle it. With-kids P50 gross ($128,000) and discretionary ($19,600) match the spec exactly, and the sign and rough magnitude of the gap are right.
3. **Poverty tiles are read as a nominal series regardless of the selected income source.** HHS guidelines are published in current dollars, so treating a flat guideline as real-terms-flat produced a spurious "+2.5% nominal" reading. They now show 0.0% nominal / −2.4% real, which is the honest statement about a guideline held constant across years in this app.
4. **Section 8 subtitle wording changed** from "at five points in each distribution" to "at six points", since the robust column is a sixth column.
5. **No savings target and no pension deduction in Section 11.** Deliberate, and documented in the methodology card: the two columns must differ only by household composition, otherwise the childcare story is confounded.
6. **Section 10 gained two groups rather than one.** The B.6 citations split naturally into "Household size, population and prices" and "Households with and without children"; putting all seven in one group buried the kids-split sources.

## (d) Deploy URL

https://www.perplexity.ai/computer/a/income-tiles-KCRwgJlKTZaE8jqLk9v.HA

## (e) Known issues / TODOs for v4.2

- Three v4.1 data files still pending; the banner will disappear on its own once they land.
- Bundle is still a single chunk (976 kB raw / 290 kB gzip), up from 940 kB. Code splitting is still deferred.
- All v3 data caveats persist: Norway §8 P50 reads high, Sweden §8 is non-monotone, US top band is $212.5M against a ~$300M target, Germany P50 is $23,289, the Finland Forbes list has 7 entries.
- Median+2σ for Norway and Sweden inherits their §8 problems — Norway's robust cell is the largest in the column, which is a data artefact rather than a real reading.
- Outlier tiles need the `deflatorNote` prop threaded through `OutlierSection`.
- v4.2 scope untouched by design: tax-layer decomposition, Section 12, sales-tax exemptions and the tax sidebar toggles.

## Sources cited inside the app (added in this pass)

- Census ASEC — https://www.census.gov/data/tables/2024/demo/income-poverty/p60-286.html
- World Bank SP.POP.TOTL — https://data.worldbank.org/indicator/SP.POP.TOTL
- BEA PCE price index — https://www.bea.gov/data/personal-consumption-expenditures-price-index
- BLS CPI-U — https://www.bls.gov/cpi/
- OECD HICP — https://data-explorer.oecd.org/vis?tm=inflation
- OECD Family Database SF1.1 — https://www.oecd.org/els/family/database.htm
- ONS Living Costs and Food Survey Table A22 — https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure
