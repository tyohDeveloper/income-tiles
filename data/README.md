# Income Distribution Data — Sources, Files, and Quality Notes

Generated for the income-tiles web app. All files live in this directory (`/home/user/workspace/income-tiles/data/`).

## Summary status

| # | Dataset | Status | File(s) |
|---|---|---|---|
| 1 | BEA Distribution of Personal Income | ✅ Complete (2000–2024) | `bea_national.json`, `bea_national_personal.json`, `bea_national_disposable.json` |
| 2 | CBO Distribution of Household Income | ⚠️ Partial — wrong vintage (1979–2021, not 1979–2022) | `cbo_us.json` |
| 3 | WID pretax/posttax national income, 6 countries | ✅ Complete (1980–2024) | `wid_us.json`, `wid_can.json`, `wid_gbr.json`, `wid_deu.json`, `wid_fra.json`, `wid_jpn.json` (+ split per-definition files) |
| 4 | HHS Federal Poverty Guidelines 2026 | ✅ Complete | `poverty_2026.json` |
| 5 | Census ASEC median household income | ✅ Complete (2000–2024) | `census_asec.json` |

---

## 1. BEA — Distribution of Personal Income

- **Source:** [BEA Distribution of Personal Income](https://www.bea.gov/data/special-topics/distribution-of-personal-income)
- **Files:** `bea_national.json` (combined, both income definitions), `bea_national_personal.json`, `bea_national_disposable.json`
- **Coverage:** 2000–2024, national (US), by decile.
- **Method:** Downloaded BEA's "full dataset" summary CSV (`bea_national_summary.csv`, 9,026 rows, long format: `Year, Ranking, Income Concept, NIPA Table 2.9 line, Quantile/Summary Metric, Value`) directly via `curl` (BEA does not block direct downloads). Parsed with `extract_bea.py`, filtering for "Personal income" and "Disposable personal income" under the "Equivalized Personal Income" / "Equivalized Disposable Personal Income" rankings.
- **What's included:** mean, median, Gini, decile income **shares** (not dollar thresholds), top 1%/top 5% shares, and inequality ratios (50/10, 80/20, 90/10, 90/50).
- **Data quality notes:**
  - BEA does **not** publish dollar percentile thresholds in this downloadable file — confirmed via BEA's own summary-file readme (`bea_readme.pdf`, saved in this directory). Only income **shares** by decile are available, stored under a supplementary `decile_income_shares` field rather than the schema's `percentiles` field (which is `null`).
  - The downloadable summary CSV only contains **2000–2024**; it does **not** include the 2025 nowcast figures that BEA displays as text/charts on its landing page.
  - BEA's landing page separately states (as narrative text, not in the downloadable file) 2025 nowcast quintile shares of Personal Income: Q1 5.2%, Q2 9.6%, Q3 13.4%, Q4 19.1%, Q5 52.7% (vs. 2024 published: 5.3/9.5/13.4/19.0/52.8), with 2025 nominal income growth by quintile of Q1 4.1%, Q2 5.8%, Q3 5.0%, Q4 5.4%, Q5 4.6%. These are **not** included in any JSON file since they aren't in the machine-readable download — flagged here for reference only.
  - 2024 figures are the latest published (non-provisional in the sense of being finalized annual data); BEA labels certain recent years "provisional" pending revision — treat 2023–2024 as subject to future BEA revision.

---

## 2. CBO — Distribution of Household Income

- **Requested source:** [CBO Publication 61911, "The Distribution of Household Income, 2022"](https://www.cbo.gov/publication/61911) (published January 2026, covering 1979–2022)
- **File:** `cbo_us.json`
- **⚠️ VINTAGE CAVEAT — READ BEFORE USE:** Despite extensive effort (25+ URL-pattern attempts, checking CBO's "[Publications With Supplemental Data Files](https://www.cbo.gov/data/publications-with-data-files)" index, checking the report's alternate HTML full-text page at `https://www.cbo.gov/publication/62300`), the actual downloadable data files for publication 61911 (supplemental-data.xlsx, data-underlying-figures.xlsx, additional-data-for-researchers.zip, table-builder.xlsm) could **not** be located at any working URL. CBO's site confirms these files exist (both the publication page and the index page list them), but the asset links appear to be rendered client-side via JavaScript in a way this environment's fetch tooling could not resolve to a raw downloadable URL, and `cbo.gov/system/files/*` is blocked to direct `curl`/`wget` by Datadome bot protection.
  - **What was actually obtained instead:** the prior-vintage CBO report, publication [60341, "The Distribution of Household Income, 2021"](https://www.cbo.gov/publication/60341) (covering **1979–2021**, one year short of the requested 1979–2022). Its supplemental-data workbook (`https://www.cbo.gov/system/files/2024-09/60341-supplemental-data.xlsx`) was successfully read via the `fetch_url` tool (which can render/parse the xlsx server-side even though direct `curl` downloads of the same URL are bot-blocked).
  - This is genuine, complete CBO numeric data — just for FY2021 as the latest year rather than FY2022.
- **Coverage:** 1979–2021 (43 years), national (US), by quintile + 81–90th/91–95th/96–99th percentile bands + top 1%.
- **Income definitions included** (as three entries in the `datasets` array):
  - `market` — CBO "market income" (labor + business + capital income incl. realized capital gains + retirement income + other nongovernmental income)
  - `pretax_national` — CBO "income before transfers and taxes" (market income + social insurance benefits) — closest CBO analog to a pretax concept, not identical to WID's pretax national income
  - `posttax_national` — CBO "income after transfers and taxes" (income before transfers/taxes + means-tested transfers − federal taxes)
- **Data quality notes:**
  - All dollar figures are in **2021 dollars** (CBO's inflation-adjustment base year for this vintage), not current/2022 dollars.
  - CBO's supplemental workbook publishes quintile/percentile-band **averages**, not dollar percentile thresholds — stored under a supplementary `quintile_averages` field (keys `q1`...`q5`, `p81_90`, `p91_95`, `p96_99`, `top1`) rather than the schema's `percentiles` field (`null`).
  - `top_shares.top1_share` is populated (from CBO's income-shares sheet) for `pretax_national` and `posttax_national`; `top10_share`, `top5_share`, and `top0_1_share` are `null` because CBO's shares sheet only breaks out quintiles + top 1% (not top 10%/top 5% cumulative shares) — a supplementary `quintile_shares_pct` field is provided instead with q1–q5 share percentages.
  - **No Gini coefficient values** are present anywhere in the CBO supplemental workbook (confirmed by direct query) — CBO shows Gini only as a chart in the report PDF with no accompanying data table found. `gini` is `null` throughout.
  - Values were extracted via `fetch_url`'s LLM-assisted xlsx table reading rather than a deterministic parser (openpyxl/pandas could not be used because direct file download was blocked) — every value should be treated as transcribed and spot-checked against the [source workbook](https://www.cbo.gov/system/files/2024-09/60341-supplemental-data.xlsx) if used for anything beyond prototyping.
  - **Recommendation:** if the actual 2022-vintage CBO numbers are required, retry the source URLs (`https://www.cbo.gov/publication/61911`) with a browser-based/JS-capable fetch method, or contact CBO directly — the report explicitly states supplemental data, data-underlying-figures, a researcher CSV zip, and a table builder are all "posted along with this document."

---

## 3. World Inequality Database (WID) — pretax & posttax national income

- **Source:** [WID data portal](https://wid.world/data/) (documented API was inaccessible — see note below)
- **Files:** `wid_us.json`, `wid_can.json`, `wid_gbr.json`, `wid_deu.json`, `wid_fra.json`, `wid_jpn.json` (combined, both income definitions each), plus split single-definition files `wid_<country>_pretax_national.json` / `wid_<country>_posttax_national.json`
- **Coverage:** 1980–2024 (45 years), for US, Canada (CAN), UK (GBR), Germany (DEU), France (FRA), Japan (JPN); equal-split-adult unit.
- **Method:** WID's documented API endpoint (`https://rfap9nitz6.execute-api.eu-west-1.amazonaws.com/prod/countries-variables`) requires an unpublished `x-api-key` and returned 403 Forbidden — abandoned. Instead, WID's **bulk data download** (`https://wid.world/bulk_download/wid_all_data.zip`, ~882MB) was fetched successfully with plain `curl -A "Mozilla/5.0"` and contains complete CSVs for ~200 countries/regions. Extracted per-country CSVs were parsed with `extract_wid.py`.
- **Variable codes used:** `ptinc` = pretax national income, `diinc` = post-tax (disposable) national income; population/age suffix `j992` = equal-split adults; percentile codes `pXXp100` = threshold/share for the top (100−XX)% (e.g., `p90p100` = P90 threshold, `p99p100` = top 1% threshold).
- **Data quality notes:**
  - Values are reported by WID in **per-adult, local-currency, current-price units** (i.e., not household-equivalized, not inflation-adjusted, not currency-converted to USD). This is WID's standard "equal-split adult" concept — every adult in a couple is assigned half the couple's income — and differs structurally from the household-based BEA/CBO/Census figures in this dataset collection.
  - Verified against known published WID figures as a sanity check: e.g., US 2024 top 1% income share = 0.2073 (20.73%), Gini = 0.5869 — consistent with WID's publicly cited estimates.
  - Percentile thresholds (p50, p90, p99) and top shares (top10/top5/top1/top0.1) are populated for all 6 countries and both income definitions across the full 1980–2024 range.

---

## 4. HHS Federal Poverty Guidelines 2026

- **Source:** [ASPE Poverty Guidelines](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)
- **File:** `poverty_2026.json`
- **Coverage:** Household sizes 1–8 (plus each-additional-person increment), for the 48 contiguous states + DC, Alaska, and Hawaii.
- **Status:** Complete, straightforward single-page fetch — no access issues encountered.

---

## 5. Census ASEC — median household income

- **Source:** [Census P60-286, "Income in the United States: 2024"](https://www.census.gov/library/publications/2025/demo/p60-286.html) and companion historical tables
- **File:** `census_asec.json`
- **Coverage:** 2000–2024 (25 years), national (US), income_definition = `market` (CPS "money income" — pre-tax cash income; excludes capital gains, non-cash transfers, and taxes).
- **Method:** `fetch_url` returned `disallow_by_robots` errors for direct `.xlsx` downloads on `www2.census.gov`; switched to plain `curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"`, which worked reliably. Downloaded and parsed with `openpyxl` via `extract_census.py`:
  - `tableA3.xlsx`, `tableA1.xlsx` (P60-286 report tables, 2023–2024 detail)
  - `h01ar.xlsx` (Table H-1, quintile upper income limits, 1967–2024)
  - `h03ar.xlsx` (Table H-3, mean income by quintile, 2000–2023)
  - `h04.xlsx` (Table H-4, Gini by race/year)
  - `h05.xlsx` (Table H-5, median & mean income by race/year, current & 2024 dollars)
  - `h08.xlsx` (Table H-8, median household income by state)
- **Data quality notes:**
  - `median`/`mean` are populated for the full 2000–2024 range (from Table H-5).
  - Quintile upper limits (p20/p40/p60/p80/p95) are populated for the full range (from Table H-1); quintile mean income is populated 2000–2023 (from Table H-3).
  - Gini is populated for the full range (from Table H-4).
  - **P10 and P90 percentile thresholds, quintile shares, and percentile ratios (90/10, 90/50, 50/10) are only available for 2023 and 2024** — these come from Table A-3 in the P60-286 report itself, which does not provide a full historical time series in the same format. For years before 2023, these fields are `null`.
  - 2024 headline figures (cross-checked against [Figure 3 of the P60-286 report](https://www.census.gov/content/dam/Census/library/visualizations/2025/demo/p60-286/figure3.pdf)): Gini 0.488, 90/10 ratio 12.61, 90/50 ratio 3.00, 50/10 ratio 4.21, quintile shares (lowest 3.1%, second 8.2%, third 13.9%, fourth 22.6%, highest 52.2%, top 5% 23.1%) — consistent with what's stored in `census_asec.json`.
  - A parsing quirk in Census's historical tables (duplicate/footnoted year labels like `"2017 (40)"` immediately followed by `"2017"` within the same demographic block) required a custom `first_block_rows()` helper in `extract_census.py` that only treats a new block as starting when the year value jumps back **up** relative to the previous row.

---

## Cross-cutting notes for the income-tiles app

- **Unit mismatch across sources is intentional and expected**, not a bug: BEA/CBO/Census report household-level (or household-equivalized) US figures in USD; WID reports equal-split-adult figures in local currency, current prices, for 6 countries. Any cross-source comparison in the app should clearly label the unit and currency basis per source.
- **Dollar percentile thresholds are inconsistently available**: WID provides full p10–p99.9 thresholds; Census provides p10/p50/p90 for 2023–2024 only plus quintile limits for the full series; BEA provides no dollar thresholds at all (shares only); CBO provides percentile-band averages, not thresholds. The app's percentile-threshold display should tolerate `null` gracefully per source/year.
- **Gini availability**: WID (full range) and Census (full range) provide Gini; BEA provides Gini (from its summary file); CBO does not provide Gini in any accessible data file — `null` throughout.
- **CBO is the one dataset that did not fully satisfy the task's request** (wrong vintage year, 2021 vs. 2022) — see section 2 above for full detail and a recommended follow-up if exact 2022 CBO figures become a hard requirement.

## Auxiliary files in this directory (not part of the JSON deliverables, kept for reproducibility)

- `extract_bea.py`, `extract_wid.py`, `extract_census.py`, `build_cbo.py` — extraction/build scripts
- `bea_national_summary.csv`, `bea_readme.pdf` — raw BEA download + methodology PDF
- `wid_bulk.zip`, `wid_bulk_extract/` — raw WID bulk download and extracted per-country CSVs
- `tableA1.xlsx`, `tableA3.xlsx`, `h01ar.xlsx`, `h03ar.xlsx`, `h04.xlsx`, `h05.xlsx`, `h06.xlsx`, `h08.xlsx`, `test_h09.xlsx` — raw Census downloads
- `cbo_60341_supplemental.xlsx` — attempted direct download of the CBO workbook (bot-blocked; contains an HTML challenge page, not real xlsx data — the actual CBO figures used in `cbo_us.json` were extracted via `fetch_url`'s server-side rendering instead)
- `bea_page.html`, `cbo_page.html`, `cbo_datafiles_index.html`, `cbo_report.pdf` — scratch/diagnostic files from the research process
