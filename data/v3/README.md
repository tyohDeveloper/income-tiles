# v3 Data — README

Summary of all data assembled for V3_BUILD_SPEC.md Phase A (tasks A.1–A.9). Covers 8 countries: US, DE (Germany), UK, NO (Norway), SE (Sweden), FI (Finland), CH (Switzerland), JP (Japan).

**Nothing in this batch was committed to git.** All files are either untracked or (in the single case of `data/v2/de_evs.json`) a working-tree modification with the prior version explicitly preserved alongside it.

---

## A.1 — WID pulls for Switzerland, Norway, Sweden, Finland

**Files (12, at `data/` root, matching the existing `wid_deu.json` pattern):**
- `data/wid_che.json`, `data/wid_che_pretax_national.json`, `data/wid_che_posttax_national.json`
- `data/wid_nor.json`, `data/wid_nor_pretax_national.json`, `data/wid_nor_posttax_national.json`
- `data/wid_swe.json`, `data/wid_swe_pretax_national.json`, `data/wid_swe_posttax_national.json`
- `data/wid_fin.json`, `data/wid_fin_pretax_national.json`, `data/wid_fin_posttax_national.json`

**Source:** [World Inequality Database bulk download](https://wid.world/bulk_download/wid_all_data.zip) (`wid_all_data.zip`, ~882MB). Extracted with `data/extract_wid_v3.py`.

**Coverage:** 1980–2024 (45 years each), all standard percentile thresholds and top shares, pretax national income (`ptinc`) and posttax/disposable national income (`diinc`), equal-split-adults population (`j992`). Schema validated to match `wid_deu.json` exactly (same field names, same percentile-code conventions).

**Data-quality note:** WID interpolates/extrapolates for years without direct survey/tax-record coverage in some countries; this is WID's own published methodology, not something introduced by this extraction.

---

## A.2 — WID top-tail thresholds (P99.99, P99.999)

**File:** `data/v3/wid_toptail_thresholds.json`

P99.99 and P99.999 percentile thresholds, all 8 countries, 1980–2024 where WID publishes the extended tail (some countries/years lack P99.999 coverage — documented as `null` in the file rather than omitted, so downstream code can distinguish "not available" from "not queried"). Source: same WID bulk download as A.1.

---

## A.3 — WID top shares, 2000–2024

**File:** `data/v3/wid_top_shares.json`

Top10 / top5 / top2 / top1 / top05 / top01 / top001 / top0001 income shares, 2000–2024, all 8 countries. Built for one-stop "band math" queries — deliberately duplicates content already present in the per-country `wid_*.json` files from A.1 (and pre-existing `wid_deu.json`, `wid_usa.json`, etc.), per the spec's explicit instruction that this duplication is acceptable.

---

## A.4 — OECD Taxing Wages effective tax rates

**File:** `data/v3/effective_tax_by_percentile.json` (built via `data/v3/build_effective_tax.py`)

Effective tax rate (income tax + employee social security contributions, net of cash benefits) at 67%, 100%, and 167% of the Average Wage (AW), per country, **official OECD figures** for tax year 2024. Source: [OECD Taxing Wages 2025 — Effective tax rates on labour income in 2024](https://www.oecd.org/en/publications/2025/04/taxing-wages-2025_20d1a01d/full-report/effective-tax-rates-on-labour-income-in-2024_878e20ff.html).

**Known gap:** the spec also requested 250% AW. OECD Taxing Wages does not publish an official 250% AW figure in its standard tables (67/100/167% AW are the three standard reference points). The 250% AW value in this file is **linearly extrapolated** from the 100% and 167% AW rates and explicitly flagged `"extrapolated": true` per row — do not present it to end users as an official OECD statistic without that caveat visible.

---

## A.5 — Forbes top-10 billionaires per country

**File:** `data/v3/forbes_top10.json` (built via `data/v3/build_forbes_top10.py`)

Name, net worth, source of wealth, and estimated annual income (wealth × 4%, a standard endowment-style draw-rate proxy, not an actual reported income figure) for the top 10 billionaires in each of US, DE, UK, NO, SE, FI, CH, JP. Snapshot date: 2026-08-03.

**Sourcing caveat:** Forbes' own website serves its per-country billionaire list via client-side JavaScript filtering that was not reliably fetchable in this environment. The US list was pulled directly from Forbes. The other 7 countries' lists were compiled from secondary sources that mirror/aggregate current Forbes Real-Time Billionaires data (e.g., financial news aggregators, Wikipedia billionaire-by-country lists cross-checked against multiple mirrors). Treat non-US entries as **directionally accurate but not verbatim Forbes-sourced** — recommend spot-checking against forbes.com/billionaires directly before using in any published/user-facing context that claims direct Forbes attribution.

**Known gap:** Finland has only 7 billionaires meeting the Forbes threshold at snapshot time, not 10 — this is documented in the file rather than padded with non-qualifying entries.

---

## A.6 — Non-monetary benefits table

**File:** `data/v3/non_monetary_benefits.json` (built via `data/v3/build_non_monetary_benefits.py`)

11 categories × 8 countries:

| # | Category | Unit | Primary source |
|---|---|---|---|
| 1 | `paid_vacation` | days/year | [Wikipedia: List of minimum annual leave by country](https://en.wikipedia.org/wiki/List_of_minimum_annual_leave_by_country) |
| 2 | `paid_sick_leave` | weeks + replacement rate | [OECD: Paid sick leave to protect income, health and jobs through the COVID-19 crisis](https://www.oecd.org/content/dam/oecd/en/publications/reports/2020/07/paid-sick-leave-to-protect-income-health-and-jobs-through-the-covid-19-crisis_4ff5fe3c/a9e1a154-en.pdf) |
| 3 | `paid_parental_leave` | weeks + avg payment rate | [OECD Family Database, PF2.1 Parental leave systems](https://webfs.oecd.org/els-com/Family_Database/PF2_1_Parental_leave_systems.pdf) |
| 4 | `public_healthcare` | % publicly financed + model type | [OECD Health at a Glance 2023 — Public funding of health spending](https://www.oecd.org/en/publications/2023/11/health-at-a-glance-2023_e04f8239/full-report/public-funding-of-health-spending_712db152.html) |
| 5 | `public_higher_education` | typical annual tuition, USD | [OECD Education at a Glance 2024](https://www.oecd.org/en/publications/2024/09/education-at-a-glance-2024_5ea68448/full-report/how-much-do-tertiary-students-pay-and-what-public-support-do-they-receive_a48eab74.html) |
| 6 | `public_childcare` | net cost, % of household income | [OECD Net childcare costs indicator](https://www.oecd.org/en/data/indicators/net-childcare-costs.html) |
| 7 | `public_transit` | % of fares publicly subsidized (100 − farebox recovery ratio) | [UITP Fare Affordability Policy Brief, Aug 2025](https://www.uitp.org/wp-content/uploads/sites/7/2025/08/20250822_Fare-Affordability_Policy-Brief_WEB.pdf) |
| 8 | `unemployment_insurance` | net replacement rate, initial phase, 100% AW | [OECD Society at a Glance 2024 — Unemployment and social safety net benefits](https://www.oecd.org/en/publications/society-at-a-glance-2024_918d8db3-en/full-report/unemployment-and-social-safety-net-benefits_ddfedfa8.html) |
| 9 | `pension_replacement_rate` | net replacement rate, 100% AW, mandatory schemes | reused directly from `data/v2/oecd_pensions.json` |
| 10 | `family_cash_benefits` | monthly child benefit, first child, USD | [Wikipedia: Child benefit](https://en.wikipedia.org/wiki/Child_benefit) |
| 11 | `statutory_retirement_age` | years | [World Population Review: Retirement Age by Country](https://worldpopulationreview.com/country-rankings/retirement-age-by-country) |

**Known gaps/approximations** (all flagged in-file via each category's `value_notes`):
- `public_transit`: farebox recovery ratios for DE, UK, NO, SE, CH are approximate (UITP's brief does not report every country in this batch with equal precision; some are triangulated from secondary transit-agency reporting).
- `pension_replacement_rate`: CH and JP are `null` — not present in the source `oecd_pensions.json` file this category reuses. Not fabricated; left as an explicit gap.

---

## A.7 — Germany necessity-data fix

**Files:**
- `data/v2/de_evs.json` — **overwritten** with corrected data (backup preserved, see below)
- `data/v2/de_evs.v2.json` — **exact copy of the pre-fix file**, preserved per spec instruction before any changes were made

### What was wrong

The prior `de_evs.json` used Destatis's **LWR 2023** ("Laufende Wirtschaftsrechnungen," a lighter annual household survey) broken into **8 unequal-width income brackets** (`under_1000` … `5000_plus`). Running the app's `computeNecessityFloor()` (`client/src/lib/necessity.ts`, "minimal" strictness: `housing + food_at_home + healthcare_oop + transport_work-or-0.6×transport_total`) against that file's top bracket yielded **~€33.8k/yr**, which — after the app's currency conversion and further decile-interpolation blending across a wide open-ended bracket — surfaced as the reported **~$24k**, well under the ~$32k expected for upper-income German households.

The root cause: LWR's `5000_plus` bracket pools *all* households earning ≥€5,000/month into one average, diluting genuinely high earners toward the bracket's lower edge. It is not a real decile.

### The fix

Replaced the source with Destatis's **EVS 2023** ("Einkommens- und Verbrauchsstichprobe" — the full quinquennial household budget survey, higher quality than LWR), using its **true decile breakdown** ([source table](https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/Tabellen/privater-konsum-EVS-dezil-eur.html)) — 10 equal-population groups (10% of households each), each with a full COICOP-based expenditure breakdown (12 categories, same schema field names as before). Data tier upgraded from **B → A** (per `data/v2/README.md`'s own tier definitions: recent + primary + full detail + proper survey structure, vs. B's "recent but coarser/bracket-based").

Recomputing the same minimal-necessity formula against the new decile file:

| Decile | Necessity floor (EUR/yr) | Necessity floor (USD/yr, @1.08) |
|---|---|---|
| D8 | 28,944 | 31,260 |
| D9 | 32,772 | 35,394 |
| D10 | 39,775 | 42,957 |

D8–D9 now land squarely in the ~$31k–35k range, consistent with the spec's ~$32k expectation — confirming the fix.

### Remaining documented gaps (see file's own `notes` field for full detail)
- `avg_income_before_tax` / `avg_income_after_tax` remain `null`. EVS's decile expenditure release does not publish the matching net-household-income figure per expenditure-decile in the same table. Destatis's income-decile tables (Mikrozensus/EU-SILC) report **net-equivalized per-person** income deciles, a different denominator than EVS's **net household** income deciles — substituting one for the other would introduce an unflagged modeling assumption, so as a non-authoritative cross-check only, each row carries a `context_equivalized_income_upper_bound_eur_year_mikrozensus2023` field (source: Destatis Mikrozensus 2023). This should **not** be treated as `avg_income_after_tax` by app code.
- `housing_owner_share` / `housing_owner_imputed_rent_estimate` remain `null` (not published at decile granularity).
- No explicit `transport_work` split exists; the app's existing 60%-of-`transport_total` fallback (already implemented in `necessity.ts`) remains the operative mechanism.
- No distinct German civic/charitable-giving expenditure line exists at decile granularity; `necessity.ts`'s own percentage-of-total fallback for `civic` continues to apply.

---

## A.8 — Norway/Sweden expenditure modeled from Finland peer

**Files:**
- `data/v3/no_expenditure_modeled.json`
- `data/v3/se_expenditure_modeled.json`

Both carry a top-level `"modeled_from": "FI"` field plus a `methodology` field with full detail, per spec.

### Method

1. Computed Finland's necessity share (`necessity_total / avg_expenditure_total`, "minimal" strictness) at each of Finland's 5 income quintiles from `data/v2/fi_hbs.json` (Statistics Finland Household Budget Survey 2022, Tier A):

   | Quintile | Necessity share |
   |---|---|
   | Q1 | 0.6504 |
   | Q2 | 0.6182 |
   | Q3 | 0.5914 |
   | Q4 | 0.5782 |
   | Q5 | 0.5502 |

2. Fit a monotone piecewise-linear interpolation of this necessity-share curve across quintile centers (mapped to decile positions 1.5/3.5/5.5/7.5/9.5), holding the share constant beyond the curve's anchors (Q1's share below, Q5's share above) — per `docs/v3-plan.md`'s stated extrapolation rule. Also interpolated Finland's **full category-share vector** (all 14 expenditure categories as a % of total spend) the same way, for richer downstream detail beyond just the necessity/discretionary split.
3. Applied the resulting decile-indexed necessity-share curve (and full category-share vectors) to Norway's (`data/v2/no_expenditure.json`, SSB table 12682) and Sweden's (`data/v2/se_expenditure.json`, SCB HE0110F/TabVX10InkStrukt) own published income-decile disposable-income figures.

### Simplifying assumption (flagged)

Norway and Sweden publish income but not expenditure totals (both surveys were discontinued — Norway's Forbruksundersokelsen after 2012, Sweden's HUT after 2009). Because no independent expenditure-total figure exists, **total household expenditure is assumed to equal disposable income at each decile** (i.e., a 0% net saving rate) purely to allocate the necessity/discretionary split. This will understate true expenditure wherever households actually save a positive share of income — true almost everywhere, especially at high deciles. `necessity_total_modeled` should therefore be read as a **conservative necessity-floor estimate**, not a literal expenditure prediction.

### Frontend guidance (per v3-plan.md)

Badge this data "Modeled from FI peer (Tier C)" with caveat text:

> "\[Norway's/Sweden's] household budget survey was discontinued after \[2012/2009]. Necessity floor here assumes \[Norwegian/Swedish] households allocate spending in similar proportions to Finnish households at the same income level."

---

## File inventory

```
data/
├── wid_che.json, wid_che_pretax_national.json, wid_che_posttax_national.json     (A.1)
├── wid_nor.json, wid_nor_pretax_national.json, wid_nor_posttax_national.json     (A.1)
├── wid_swe.json, wid_swe_pretax_national.json, wid_swe_posttax_national.json     (A.1)
├── wid_fin.json, wid_fin_pretax_national.json, wid_fin_posttax_national.json     (A.1)
├── extract_wid_v3.py                                                             (A.1 script)
├── v2/
│   ├── de_evs.json          <- OVERWRITTEN, now EVS-2023 decile-based            (A.7)
│   └── de_evs.v2.json       <- backup of pre-fix LWR-2023 bracket-based version  (A.7)
└── v3/
    ├── wid_toptail_thresholds.json                                              (A.2)
    ├── wid_top_shares.json                                                      (A.3)
    ├── effective_tax_by_percentile.json + build_effective_tax.py                (A.4)
    ├── forbes_top10.json + build_forbes_top10.py                                (A.5)
    ├── non_monetary_benefits.json + build_non_monetary_benefits.py              (A.6)
    ├── build_de_evs_fix.py                                                      (A.7 script)
    ├── no_expenditure_modeled.json                                              (A.8)
    ├── se_expenditure_modeled.json                                              (A.8)
    ├── build_no_se_modeled.py                                                   (A.8 script)
    └── README.md            <- this file                                       (A.9)
```

## Cross-cutting caveats summary

- **A.4:** 250% AW tax rate is linearly extrapolated, not an official OECD figure — flagged per-row.
- **A.5:** Only the US billionaire list is directly Forbes-sourced; other 7 countries compiled from mirror sources. Finland has 7 qualifying billionaires, not 10.
- **A.6:** Several `public_transit` farebox-recovery values (DE, UK, NO, SE, CH) are approximate/triangulated. `pension_replacement_rate` is `null` for CH and JP (gap in the underlying `oecd_pensions.json`, not newly introduced).
- **A.7:** Germany's income-per-decile fields remain `null` (EVS doesn't publish this alongside the expenditure decile table); a non-authoritative equivalized-income cross-reference field is provided instead. `housing_owner_share`/imputed-rent fields remain `null`.
- **A.8:** Norway/Sweden modeled expenditure assumes 0% net saving (expenditure ≈ disposable income) as the only way to allocate a necessity/discretionary split without an independent expenditure-total source — genuinely a lower-bound/conservative necessity estimate, not a forecast.

## Not committed

All files listed above were saved to the workspace only. No `git add` / `git commit` was performed as part of this task, per explicit instruction.
