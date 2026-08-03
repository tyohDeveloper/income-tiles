# Income Tiles v3 — UI scaffold + real-data wiring report

Subagent report, 2026-08-03. Scope: Phase B of `V3_BUILD_SPEC.md` (v3 UI sections plus the
dashboard-wide disjoint-band change), followed by wiring the sections to the v3 data files the
parallel data subagent landed under `data/v3/`.

## (a) Files created / modified

### Created
| File | What |
| --- | --- |
| `client/src/lib/bands.ts` | Disjoint-band maths: `BandMode`, `computeBand`, top-list subtraction, band labels. |
| `client/src/lib/v3data.ts` | v3 loader and parsers: `rowsOf` shape normaliser, `mergeTopTail`, `parseForbes` + `forbesFor`, `parseTaxCurve` + `effectiveTaxRateAtAW`, `parseBenefits` + `benefitRanks`, `loadV3`. |
| `client/src/lib/crossCountry.ts` | Section 8 computation: five percentiles × eight countries, necessity extrapolation above the top published group, sorting. |
| `client/src/components/dashboard/V3Sections.tsx` | `OutlierSection` (§7), `CrossCountrySection` (§8), `BenefitsSection` (§9), `SourcesSection` (§10), plus `SectionHeading` / `TierBadge` / `CaveatCard`. |
| `script/sync-data.mjs` | Copies `data/`, `data/v2/`, `data/v3/` into `client/public/data/`; normalises the `*_modeled` field names in the Norwegian and Swedish expenditure files. |
| `scratch/bandcheck.ts`, `scratch/v3check.ts`, `scratch/xcheck.ts`, `scratch/secheck.ts` | Node-side numeric verification of bands, parsers and the Nordic rows. |
| `docs/v3-qa-screenshots/*.jpg` | QA captures: 1600 dark (top, §7, §8, §9, §10), 1280 dark + light, 375 dark (§9, §10). |

### Modified
- `client/src/lib/incomeModel.ts` — added CHE/NOR/SWE/FIN geos and WID files with soft-404 handling; hid FRA via `HIDDEN_GEOS`/`visibleGeos()`; added `ADULT_POPULATION`; added `p99_99`/`p99_999` percentile keys and the extra top-share keys.
- `client/src/lib/ppp.ts` — new geo↔country maps, `V3_COUNTRY_ORDER`, locale/currency entries for CHF/NOK/SEK.
- `client/src/lib/tiles.ts` — disjoint band partition, `OUTLIER_SECTION`, band-aware `computeTile`, headline/caption helpers.
- `client/src/lib/v2Compute.ts` — the four new geos flow through the v2 layer.
- `client/src/components/dashboard/TileCard.tsx` — band headline, band-range sub-caption, reading badge, subtracted-top-10 note.
- `client/src/components/dashboard/ControlPanel.tsx` — France removed from both selects, four countries added, "Percentile reading" toggle (bands / thresholds), "Outlier detail" switch.
- `client/src/pages/dashboard.tsx` — v3 query, `topList` wiring, §7–§10 rendering, pending-data banner, methodology card additions, reading-mode badge.

## (b) Shipped vs needing follow-up

**Shipped and verified against real data**
- Disjoint bands as the default reading across every tile, with a threshold mode toggle (badge switches between "Disjoint bands" and "Thresholds"; 27 tiles render in both).
- §7 Outliers — collapsed by default, expands to the P99.99 and P99.999 band tiles plus the named top-10 card; the ten named individuals are subtracted from the top band (US top band $212.5M unsubtracted → $173.7M subtracted).
- §8 Cross-country discretionary income — eight countries × five percentiles, sortable, selected row tinted, delta chips, tier badges, caveat card.
- §9 Non-monetary benefits — all 11 published categories × 8 countries, hover notes, direction-aware colouring, compound cells ("6 wk @ 100%") ranked on full-pay-equivalent weeks.
- §10 Data sources and citations — five source groups with every URL from the brief, methodology paragraph, MIT/licence note. No "source" or "link" anchor text; every anchor is the publication name or the URL itself.
- Country selector: France removed (its `wid_fra.json` still loads without error), Switzerland/Norway/Sweden/Finland added and computing through §1–6.
- Data pending banner exists and is currently not shown, because all five v3 files loaded.

**Needing follow-up (parent)**
- Bundle size: 940 kB / 279 kB gzip, single chunk. No code splitting.
- Git: nothing committed, per instructions.
- Deploy validation was skipped (`should_validate=false`) because the intentional negative "Median − 2σ" tiles trip the validator.

## (c) Deviations from V3_BUILD_SPEC.md

1. **§8 post-tax basis is WID/DINA, not the OECD effective-rate curve** (spec A.4/B.4 asked for the OECD curve to drive the computation). Reason: OECD Taxing Wages publishes rates against *wage earnings* for a single childless worker, while every income figure in this dashboard is *pre-tax national income per equal-split adult* — a broader base including retained corporate earnings and imputed rent. Netting the wage rate off that base produced a **negative** median US discretionary income (−$7,570) and $923 for Germany, against the spec's own QA targets of ~$19k and $25–30k. Using the DINA post-tax series gives US $15,856 and Germany $23,289. The OECD rates are still parsed, still computed per cell (`CrossCell.effectiveRate`), and still cited in §10; the caveat card states plainly which basis is used and why the other was rejected. **Parent should decide whether to keep this or restore the OECD deduction with a wage-base correction factor.**
2. **The tax curve is stored in average-wage space, not percentile space** (`TaxAnchor{aw, rate, extrapolated}` with `effectiveTaxRateAtAW`). The published file is keyed by 67/100/167/250% of the average wage, so a percentile→rate curve cannot be built without an income→AW mapping. The consumer converts using the country's own mean income. The 250% anchor is flagged `extrapolated` by the pipeline and that flag propagates.
3. **Norway and Sweden read their own expenditure files, not Finland's.** `MODELED_FROM` is now a badge-only annotation. The published `no_expenditure.json` / `se_expenditure.json` already apply Finland's necessity-share curve to Norwegian and Swedish register incomes and are denominated in NOK and SEK. Reading Finland's euro file directly (the original code path) compared a euro floor against a krone income and inflated Norway's P50 discretionary income to $89k.
4. **The transit subsidy row in §9 is deliberately uncoloured.** A high public subsidy share is not unambiguously better — the US leads it only because farebox recovery collapsed after 2020, and Japan is negative because its private railways run at a profit. Colouring it would have implied the opposite of the truth.
5. **§9 direction map lives in code, not data.** The published file states no polarity, so `BENEFIT_DIRECTIONS` marks the inverted rows (tuition, net childcare cost, statutory pension age) and everything else defaults to higher-is-better.
6. **Sources section uses CSS columns rather than a two-column grid**, so the short "United States" group does not leave a tall gap beside the long international group.

## (d) Deploy

Deployed with:

```
deploy_website(project_path="/home/user/workspace/income-tiles/dist/public",
               site_name="income-tiles", entry_point="index.html", should_validate=false)
```

URL: https://www.perplexity.ai/computer/a/income-tiles-KCRwgJlKTZaE8jqLk9v.HA
(The parent must re-run the same call for the preview to surface as a component in the main thread.)

## (e) Known issues / TODOs

1. **Norway's §8 row reads high** ($57,037 discretionary at P50). Arithmetically consistent — WID DINA post-tax national income per Norwegian adult is NOK 1,032,574 and the modelled necessity floor at d5 is NOK 310,429 — but DINA includes imputed collective consumption and Norway's sovereign-fund income, so the level flatters Norway. Tier-C badged and caveated, not fixed.
2. **Sweden's §8 row is non-monotone** (P50 $43,024 → P90 $43,304 → P95 $42,513). SCB's published top decile averages roughly twice the ninth, so the interpolated necessity floor steps up sharply around P90. Documented in the §8 caveat card as an artefact of decile-average anchoring; a proper fix needs within-decile interpolation on the Swedish and Norwegian income anchors.
3. **US top band is still below the ~$300M target** in the earlier band verification: $212.5M unsubtracted, $173.7M after removing the named top 10, versus the P99.999 threshold of $133.1M. Driven by the published `top0001_share` of 2.23%; worth re-checking against WID directly.
4. **Germany's P50 ($23,289) is just under the spec's $25–30k window.** Close but not inside it; depends on `de_evs.json`, the equivalence scale and the 15% savings default.
5. **Effective tax rates are computed but never displayed per cell.** `CrossCell.effectiveRate` is populated; a tooltip or an optional column would surface it.
6. **Forbes list for Finland has only 7 entries**, so its "top 10" card is a top 7. The label is generic ("Top N individuals" logic) but the aggregate footer says "Aggregate" without restating the count.
7. Bundle is a single 940 kB chunk; the JSON data files are fetched at runtime and are not in it.

## QA coverage

Playwright, Chromium, dev server on port 5000. Console and page errors were captured throughout and stayed empty across every interaction below.

- Country dropdown: nine options, France absent, Switzerland/Norway/Sweden/Finland present. Norway selected → 27 tiles render in NOK ("435 562 kr"), no errors.
- Reading mode: band → threshold → band, badge and tile headlines change each way.
- Outlier switch off → §7 absent; on → §7 present, collapsed; "Show detail" → two band tiles + top-10 card; "Show the list" → named table with aggregate footer.
- §8: all eight rows populated, tier badges on Norway and Sweden, delta chips against the selected US row.
- §9: 11 rows × 8 columns, compound cells formatted, transit row uncoloured, US column tinted.
- §10: all five groups render with live links.
- Viewports: 1600, 1280 and 375 px; light and dark at 1280.
- Defects checked for and not found: console/page errors, missing data banner, text overflow at 1280, off-token colours, broken links, `—` placeholder cells in §8 or §9.
- Defects found and fixed during QA: the aggregate footer printed `$103,236,000,000` instead of `$103.2B`; the §9 row labels were truncated at 375 px with every data column pushed off-screen; the §9 caveat described a categorical generosity scale and an "annual hours worked" row that the published data does not contain; the §10 Taxing Wages caption still claimed it drove §8.
