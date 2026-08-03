# v4.1 Data — README

Summary of all data assembled for `V4_1_BUILD_SPEC.md` Phase A (tasks A.1–A.7). Covers 8 countries: US, DE (Germany), UK, NO (Norway), SE (Sweden), FI (Finland), CH (Switzerland), JP (Japan).

**Nothing in this batch was committed to git.** All files are either new, untracked files under `data/v4/`, or (A.4 only) in-place modifications to the existing `data/wid_*.json` files, with pre-edit backups preserved at `data/v4/backup_pre_p25p75/`.

---

## A.1 — Household size by percentile band, all 8 countries

**File:** `data/v4/household_size_by_decile.json` (built via `data/v4/build_household_size_us.py` + `data/v4/build_household_size_intl.py`)

**US (Tier A, empirical):** Built from Census Bureau CPS ASEC **HINC-01** (income year 2023, published 2024) — [`hinc01_1.xlsx`](https://www2.census.gov/programs-surveys/cps/tables/hinc-01/2024/hinc01_1.xlsx). **Deliberate deviation from the spec's HINC-04 instruction**, documented in the file's `method` field: HINC-04 only cross-tabulates presence-of-children × household type, not household size × income decile; HINC-01 is the table that actually cross-tabulates mean household size against 41 income brackets, so it is the correct source for this specific metric. Method: household-count-weighted mean size per decile via cumulative bracket-share allocation. Result: d1=1.674 … d10=3.19 people.

**International 7 countries (Tier C, modeled):** UK ONS decile-shape anchor (D1=1.3, D10=3.3 people, ratio 2.538×, from [ONS Family Spending 2015 compendium](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/compendium/familyspending/2015/chapter3equivalisedincome)) combined with the US HINC-01 normalized convex curve shape, rescaled per-country so the decile average matches each country's own published national average household size:

| Country | National avg. household size | Source |
|---|---|---|
| DE | 2.0 | [Eurostat `ilc_lvph01`](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ilc_lvph01?format=JSON&lang=en), 2024 |
| UK | 2.35 | [ONS "Families and households in the UK: 2024"](https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/families/bulletins/familiesandhouseholds/2024) — **not** in Eurostat's `ilc_lvph01` post-Brexit |
| NO | 2.0 | Eurostat `ilc_lvph01`, 2024 |
| SE | 2.0 | Eurostat `ilc_lvph01`, 2024 |
| FI | 1.9 | Eurostat `ilc_lvph01`, 2024 |
| CH | 2.2 | Eurostat `ilc_lvph01`, 2024 |
| JP | 2.21 | [nippon.com, MIC/Statistics Bureau](https://www.nippon.com/en/japan-data/h02059/) |

**Data-quality caveat:** 7 of 8 countries are Tier C (shape-modeled from a US/UK anchor, rescaled to each country's national average) rather than direct decile-level household-size survey tables. This is a real gap — OECD Family Database and Eurostat SILC do not publish household size cross-tabulated by income decile at the granularity requested — flagged per-country in the file's `method` field.

---

## A.2 — Total population by country, 1980–2024

**File:** `data/v4/population_by_year.json` (built via `data/v4/build_population.py` + `data/v4/assemble_population.py`)

Source: [World Bank Indicators API, SP.POP.TOTL](https://api.worldbank.org/v2/country/{iso3}/indicator/SP.POP.TOTL). All 8 countries, full 1980–2024 coverage, no gaps.

---

## A.3 — Inflation deflators, 1980–2024, base year 2023 = 100

**File:** `data/v4/inflation_deflators.json` (built via `data/v4/build_inflation_deflators.py`)

9 series, all rebased to **2023 = 100**:

| Series | Source | Native base | Coverage |
|---|---|---|---|
| `US_PCE` | [FRED PCEPI](https://fred.stlouisfed.org/series/PCEPI) (BEA Table 2.3.4), December observations | 2017=100 | 1980–2024 |
| `US_CPI_U` | BLS CPI-U annual average (CUUR0000SA0), via Minneapolis Fed / cpichart.com mirror | 1982-84=100 | 1980–2024 |
| `DE_HICP`, `UK_HICP` | [OECD SDMX API, COICOP1999 dataflow](https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/) | 2015=100 | 1980–2024 |
| `NO_HICP`, `SE_HICP`, `FI_HICP`, `CH_HICP`, `JP_HICP` | [OECD SDMX API, COICOP2018 dataflow](https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES_COICOP2018@DF_PRICES_C2018_ALL,1.0/) | 2015=100 | 1955–2025 (trimmed to 1980–2024) |

**Data-quality caveat — Japan "HICP":** Eurostat's own HICP methodology metadata confirms coverage is "all EU Member States, Iceland, Norway and Switzerland" — **Japan is not in scope for a true HICP**. `JP_HICP` in this file is Japan's OECD national CPI series used as a substitute/proxy, labeled `JP_HICP` only for schema consistency with the other 7 series. Treat any UI copy referencing "HICP" for Japan as needing a footnote.

**Data-quality caveat — dataflow vintage split:** DE and UK were pulled from OECD's older COICOP1999 CPI dataflow; NO, SE, FI, CH, and JP were pulled from the newer COICOP2018 dataflow (the COICOP1999 dataflow did not have full 1980-coverage for all of the second group). Both dataflows report the same underlying national CPI/HICP series and rebase identically to 2023=100, but downstream consumers should be aware the two groups came from different OECD dataflow IDs if debugging discrepancies.

---

## A.4 — P25/P75 verification in WID files

**Report:** `data/v4/p25_p75_verification_report.json`
**Backups (pre-edit):** `data/v4/backup_pre_p25p75/`
**Files modified in place:** `data/wid_us.json`, `wid_deu.json`, `wid_gbr.json`, `wid_jpn.json`, `wid_che.json`, `wid_nor.json`, `wid_swe.json`, `wid_fin.json`

All 8 WID files were missing P25/P75 percentile thresholds in their `percentiles` dict for both `pretax_national` and `posttax_national` series. Extracted from the WID bulk source and added in place, all years, both series, all 8 countries. See the verification report for the per-file/per-year audit trail.

---

## A.5 + A.6 — International kids-split expenditure & gross income by kids status

**File:** `data/v4/kids_split_expenditure.json` (built via `data/v4/build_kids_split_expenditure.py` + `data/v4/build_kids_split_part2.py`)

**Important data-quality note on A.6's source instruction:** the task brief specifies "OECD Family Database indicators PF1.1 and PF1.4" as the source for gross income by kids status. On inspection, **PF1.1 = "Public spending on family benefits" (% of GDP)** and **PF1.4 = "Tax neutrality of family policies"** — neither indicator publishes household gross income cross-tabulated by presence of children. This is a spec/reality mismatch. Gross/net income by kids status is instead folded in per-country from the same national household budget/income survey used for A.5 (see `income_source` field per country below), which is a better-grounded approach than searching further for a nonexistent OECD Family DB table.

Necessity share is computed as `(housing + food_at_home + healthcare_oop + transport_component) / total_expenditure` — same "minimal" strictness definition as `client/src/lib/necessity.ts` and the v3 peer-modeling methodology. Where a survey only publishes a single mean necessity share (p50-equivalent) and not a percentile breakdown, **p90/p99 are extrapolated** by applying the US CES national necessity-share-by-decile curve's own p50→p90→p99 ratio (Engel's-law decline in necessity share as income rises) to that group's mean share — per the spec's explicit instruction to "extrapolate from decile expenditure data if survey doesn't publish direct percentile-level detail."

| Country | Tier | Income source | Expenditure source | Gap / caveat |
|---|---|---|---|---|
| **US** | A | BLS CES 2024, `couple_no_kids` vs weighted avg of `with_kids_under6`+`with_kids_6to17` | Same (BLS CES 2024) | p90/p99 necessity share extrapolated (BLS CES doesn't publish this consumer-unit type by income percentile) |
| **DE** | A | Destatis EVS 2023, "Haushalte ohne Kind" (€53,669 gross) vs "Haushalte mit Kind(ern)" (€90,905 gross), via [BPB Sozialbericht 2024](https://www.bpb.de/system/files/dokument_pdf/05_sozialbericht_24_bf.pdf) | Destatis EVS 2023, "Paare ohne Kind" (€3,372/mo) vs "Paare mit Kind(ern)" (€4,029/mo) | **necessity_share = null** — only total monthly consumption expenditure by household type was available in the source table used; the EVS category-level breakdown (housing/food/healthcare/transport split) for these exact with/without-kids groups was not extracted within budget. Also note the income-group and expenditure-group household-type definitions are closely related but not identical (income group = all no-kids households incl. singles/3+ adults; expenditure group = couples only) |
| **UK** | A (expenditure) / **N/A (income)** | Not available — ONS LCF household-composition tables used do not publish income before/after tax cross-tabulated by household composition at this granularity (income fields are `null` in the underlying `data/v2/uk_lcf_by_hhtype.json` source) | [ONS LCF / Family Spending, FYE 2024](https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook4expenditurebyhouseholdcharacteristic/fye2024/workbook4expenditurebyhouseholdcharacteristics.xlsx), `nonretired_two_adults` (no_kids proxy) vs weighted avg of `one_or_two_adults_with_one_child` + `one_or_two_adults_with_two_or_more_children` | Income by kids status genuinely unavailable in the ONS LCF household-composition workbook used; would require a different ONS release (e.g. Households Below Average Income) to close, not attempted within budget |
| **JP** | B | [MHLW Comprehensive Survey of Living Conditions 2023 income year, Table 38](https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa24/dl/10.pdf) (via e-Stat/ecitizen.jp mirror): 夫婦のみの世帯 (couple only) = ¥5,241,000 vs 夫婦と未婚の子のみの世帯 (couple + unmarried children) = ¥8,239,000 — direct, Tier A-quality figures | Interpolated from Statistics Bureau FIES 2024 by-decile expenditure curve at the matching income level | Expenditure is Tier B (interpolated proxy) because FIES itself is not published with a with/without-kids split; income is a genuine direct national-survey figure |
| **CH** | C (modeled) | Modeled — BFS HABE standard tables [31–33] "couples without children" and [41–43] "couples with children" **exist** per [BFS HBS methodology docs](https://dam-api.bfs.admin.ch/hub/api/dam/assets/29805023/master) but the rendered numeric tables were not retrievable within this session's time budget (only a table-of-contents/methodology PDF was fetchable, no data values) | CH's own HABE quintile expenditure curve (`data/v2/ch_habe.json`), interpolated at the modeled income level | **Documented Tier 3 gap** — a genuine BFS numeric table for with/without-kids exists but wasn't accessed; modeled instead using a DE+JP-averaged kids-income-uplift ratio applied to CH's own quintile curve |
| **FI** | C (modeled) | Modeled — StatFin table **12ec** ("Households' income by number of adults and children, 1987–2023") is the ideal direct source but its PxWeb query-builder page returned only metadata/category names via `fetch_url`, not numeric values, within this session's budget (a PxWeb JSON-stat API POST query would be needed, not completed) | FI's own HBS quintile expenditure curve (`data/v2/fi_hbs.json`), interpolated at the modeled income level | **Documented Tier 3 gap**, same class of issue as CH — modeled using the same DE+JP-averaged ratio |
| **NO**, **SE** | C (peer-modeled from FI) | Modeled — no direct NO/SE national household-income-by-kids-status source found; OECD Family DB PF1.1/PF1.4 don't publish this indicator (see note above). Peer-modeled from Finland's with_kids/no_kids ratio (income, expenditure, and necessity-share ratios all derived from the FI Tier-C figures above), applied to NO/SE's own d5 (median decile) anchor from the existing v3 peer-modeled files (`data/v3/no_expenditure_modeled.json`, `data/v3/se_expenditure_modeled.json`) | Same peer-modeling approach | Per spec instruction: "NO/SE: model from Finland peer using v3 pattern" — this is the intended approach, not a gap, but inherits FI's own modeling uncertainty one layer removed |

**Overall A.5/A.6 tier summary:** 3 of 8 countries (US, DE, UK) are Tier A for at least the expenditure side; DE is Tier A for income but has a necessity-share gap; UK has no income-by-kids-status data at all in the source used; JP is Tier B (direct income, interpolated expenditure); CH and FI are Tier C models with a **documented, real numeric-table access gap** (both national sources do publish exactly this cross-tab, just not reachable within the 60-90 min budget); NO/SE are Tier C peer-models per explicit spec instruction.

---

## File inventory

```
data/v4/
├── README.md                              (this file)
├── household_size_by_decile.json          (A.1)
├── population_by_year.json                (A.2)
├── inflation_deflators.json                (A.3)
├── p25_p75_verification_report.json        (A.4 report)
├── backup_pre_p25p75/                      (A.4 pre-edit backups of data/wid_*.json)
├── kids_split_expenditure.json             (A.5 + A.6)
├── build_household_size_us.py              (A.1 build script, US)
├── build_household_size_intl.py            (A.1 build script, international)
├── assemble_household_size.py              (A.1 assembly)
├── build_population.py                     (A.2 build script)
├── assemble_population.py                  (A.2 assembly)
├── build_inflation_deflators.py            (A.3 build script)
├── extract_p25_p75.py                      (A.4 extraction script)
├── build_kids_split_expenditure.py          (A.5/A.6 build script, part 1: US/DE/UK)
├── build_kids_split_part2.py               (A.5/A.6 build script, part 2: JP/CH/FI/NO/SE)
└── _*_partial*.json                        (intermediate scratch files from the two-part build scripts, kept for auditability)

data/wid_us.json, wid_deu.json, wid_gbr.json, wid_jpn.json,
wid_che.json, wid_nor.json, wid_swe.json, wid_fin.json  (A.4 — modified in place)
```

## Cross-cutting caveats (summary)

1. **Household size (A.1):** 7 of 8 countries are Tier C shape-modeled, not direct decile-level survey data — no OECD/Eurostat source publishes household size by income decile at this granularity.
2. **Inflation deflators (A.3):** Japan's "HICP" is a national-CPI substitute (Eurostat HICP formally excludes Japan). DE/UK used OECD's older COICOP1999 CPI dataflow; NO/SE/FI/CH/JP used the newer COICOP2018 dataflow — both rebase identically to 2023=100 but come from different OECD dataflow IDs.
3. **Kids-split expenditure/income (A.5/A.6):** the task brief's OECD Family DB PF1.1/PF1.4 citation does not match those indicators' actual content (public spending % GDP and tax-neutrality, not income-by-kids-status) — worked around by using national household budget surveys directly. CH and FI have a genuine, documented Tier 3 data-access gap (the right national tables exist but weren't reachable within budget); NO/SE are intentionally peer-modeled from FI per spec instruction.
4. **DE necessity share:** null for both with/without-kids groups — category-level EVS 2023 expenditure breakdown for these exact groups wasn't available within the session's source coverage.
5. **UK income by kids status:** genuinely unavailable in the ONS LCF household-composition workbook used; would need a different ONS release (e.g. Households Below Average Income) to close.

## Not committed

Per task instructions, **none of this batch was committed to git.** All files listed above are new/untracked or in-place edits to existing tracked files (`data/wid_*.json`, A.4 only) with backups preserved. No `git add`/`git commit` was run.
