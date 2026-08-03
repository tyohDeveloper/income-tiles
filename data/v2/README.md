# Income Tiles v2 — Data Sources

This directory contains the expenditure, price, and pension data used by the v2 "discretionary income" layer. Each file follows the schema documented in `docs/v2-plan.md` and inherits the v1 conventions in `data/README.md`.

## Status matrix

| Dataset | Country | File | Tier | Coverage | Notes |
|---|---|---|---|---|---|
| BLS CES 2024 by decile | US | `us_ces_2024_by_decile.json` | **A** | 10 deciles, all categories | Anchor dataset |
| BLS CES 2024 by household type | US | `us_ces_2024_by_hhtype.json` | **A** | 7 household types | Powers the household-type selector |
| BEA Regional Price Parities (state) | US | `us_rpp_state.json` | **A** | 50 states + DC, overall/goods/services/rents | 2023 |
| BEA Regional Price Parities (metro) | US | `us_rpp_metro.json` | **A** | Top 50 metros | 2023 |
| OECD PPP | All 8 | `oecd_ppp.json` | **A** | LCU per USD-PPP, 2023 and latest | Private-consumption PPP |
| Fed SCF student loans | US | `us_scf_studentloans.json` | **A** | Median payment by decile, share with loans | 2022 SCF |
| OECD Pensions at a Glance | All 8 | `oecd_pensions.json` | **A** | Mandatory contribution rates + replacement ratios | For cross-country savings normalization |
| Destatis EVS + LWR | DE | `de_evs.json` | **B** | Quintile expenditure, 12 categories | EVS 2018 + LWR 2023 interpolation |
| BBSR Länder cost indices | DE | `de_laender_costs.json` | **B** | 16 Länder, overall + housing | 2023 |
| ONS LCF | UK | `uk_lcf.json` | **A** | Decile expenditure | 2023–24 |
| ONS LCF by household type | UK | `uk_lcf_by_hhtype.json` | **A** | 6 household types | 2023–24 |
| Japan FIES | JP | `jp_fies.json` | **A** | Quintile expenditure | 2024 |
| Switzerland HABE | CH | `ch_habe.json` | **A** | Quintile expenditure | 2020–22 average |
| Finland HBS | FI | `fi_hbs.json` | **A** | Quintile expenditure, COICOP-mapped | 2022 |
| **Norway** | NO | `no_expenditure.json` | **C** | Income-side by decile ONLY | Expenditure survey discontinued 2012 |
| **Sweden** | SE | `se_expenditure.json` | **C** | Income-side by decile ONLY | HUT survey discontinued 2009 |

**Tiers:**
- **A** — recent annual survey from primary source, full category detail
- **B** — recent survey but with 5-year lag or interpolation from partial data
- **C** — expenditure survey discontinued; income-side data only from tax register. Necessity tiles for these countries must be **modeled from a peer country's expenditure structure** (recommend Finland as proxy for both Norway and Sweden, given close cultural and welfare-state similarity).

## Norway and Sweden — special handling

Both countries publish **income-side** data by decile from tax registers but do **not** publish category-level expenditure data. In the UI:

1. Income tiles work normally (income data is real)
2. Necessity/discretionary tiles should be **either disabled** OR **modeled from Finland's expenditure ratios** applied to each country's income levels. If modeled, badge these tiles clearly (proposed badge: **"Modeled from Finland peer"**).
3. Both files have `expenditure_by_category: null` and `avg_expenditure_total: null` for every decile — the frontend must handle this.

## Schema conformance

All files match the v2 schema in `docs/v2-plan.md`. Category-mapping decisions are documented per file in the `notes` field:

- **Germany EVS** — COICOP categories mapped: 04 → housing, 01 → food_at_home, 06 → healthcare_oop, 07 → transport (with work-portion at 60% per BBSR), 03 → apparel, 08 → communications, 12 → personal_care, 05 → education, 10 → childcare (limited coverage), 09 → entertainment
- **Finland HBS** — same COICOP mapping; food_away approximated from COICOP 11 (restaurants and hotels)
- **Japan FIES** — Japan's 10-category scheme mapped; healthcare is under-reported vs OECD SHA figures (national health insurance premiums are treated as tax, not expenditure)
- **Switzerland HABE** — direct COICOP mapping
- **UK LCF** — direct COICOP mapping

## PPP conversion

`oecd_ppp.json` provides LCU per USD-PPP at 2023 base:

```
US: 1.00
DE: 0.75
UK: 0.71
NO: 10.5
SE: 9.8
FI: 0.90
CH: 1.15
JP: 100
```

WID/DINA income data is already in real ≈2023 prices, so applying these PPP rates to WID output yields USD-PPP purchasing-power equivalents. Expenditure data is in each country's nominal local-currency for its survey year — the frontend must first CPI-adjust to 2023 and then PPP-convert if the survey year ≠ 2023.

## Not fetched

- **France** — dropped from country list (2017 EVS is too stale; 2022 release still pending)

## Provenance and reproducibility

Each data file has a `source_url` field pointing to the primary source. Build scripts (`build_*.py`) are preserved for reproducibility. Raw source files (XLSX, CSV, PDF) are under `raw/`.

Total data size: ~30MB (mostly raw source archives). JSON summaries: ~200KB.

## Last updated

2026-08-03 — all files retrieved and validated. See individual file `notes` for source-specific caveats.
