# Income Tiles v4.1 — Build Spec

## Prerequisites (READ FIRST)

1. `docs/v4.1-plan.md` — authoritative design (this build spec is the executable version)
2. `docs/v3-plan.md` and `docs/v2-plan.md` — earlier conventions still in effect
3. `data/v3/README.md` and `data/v2/README.md` — data conventions
4. Existing code in `client/src/{lib,components/dashboard,pages}/`
5. `docs/V3_SCAFFOLD_REPORT.md` — v3 handoff, deviations, and known issues

## Scope (v4.1 ONLY)

1. Per-band population + per-equivalent-adult income on every top-tail tile
2. Dual growth (both nominal + real always visible, no toggle)
3. Section 8 gains a Median+2σ (robust) column, inserted between P50 and P90
4. Section 11 (NEW): kids vs no-kids side-by-side table, 8 countries × 3 tiers (P50, P90, P99)

**NOT in v4.1** (deferred to v4.2): tax layer decomposition, Section 12, sales tax exemptions, new tax-related sidebar toggles.

## Phase A — Data

### A.1 — Household size by percentile band

- **US**: Census ASEC Table HINC-04 for 2024 — https://www.census.gov/data/tables/2024/demo/income-poverty/p60-286.html
- **International**: OECD Family Database + Eurostat SILC — https://www.oecd.org/els/family/database.htm
- Extract avg household size by income decile per country
- Fallback: use OECD equivalence-scale composition tables where SILC direct data is scarce

Output: `data/v4/household_size_by_decile.json` with structure:
```json
{
  "as_of": "2026-08-03",
  "countries": {
    "US": {
      "source": "Census ASEC HINC-04 2024",
      "source_url": "...",
      "year": 2024,
      "deciles": {"d1": 1.6, "d2": 1.9, ..., "d10": 3.1}
    },
    "DE": {...},
    ...
  }
}
```

### A.2 — Total population by country per year 1980-2024

- World Bank Indicators API `SP.POP.TOTL` — https://api.worldbank.org/v2/country/{cc}/indicator/SP.POP.TOTL
- 8 countries + total series
- Output: `data/v4/population_by_year.json`

### A.3 — Inflation deflators 1980-2024

Three series, all normalized to base year 2023 for comparability with WID:
- **US PCE**: BEA Table 2.3.4 — https://www.bea.gov/data/personal-consumption-expenditures-price-index
- **US CPI-U**: BLS CUUR0000SA0 — https://www.bls.gov/cpi/
- **OECD HICP** for each of DE, UK, NO, SE, FI, CH, JP — https://data.oecd.org/price/inflation-cpi.htm

Output: `data/v4/inflation_deflators.json`:
```json
{
  "series": {
    "US_PCE": {"source_url": "...", "base_year": 2023, "values": {"1980": 27.5, "1981": 30.0, ..., "2024": 108.1}},
    "US_CPI_U": {...},
    "DE_HICP": {...},
    ...
  }
}
```

### A.4 — Section 8 P25/P75 verification

All 8 countries already have P25 and P75 in the WID data files (verify existence in `wid_us.json`, `wid_deu.json`, etc.). If any are missing, extract from the WID bulk source (already downloaded per v1). No new file needed — this is a data-quality check.

### A.5 — International kids-split expenditure

For each of the 8 countries, extract expenditure by (household with kids under 18) vs (household without kids). Priority order:

- **DE**: Destatis EVS 2023 by household type — mit Kindern / ohne Kinder — extend the v3 `de_evs.json` fix
- **UK**: ONS LCF Table A22 (household composition — with dependent children / other) — extend `uk_lcf_by_hhtype.json`
- **JP**: FIES 2024 by household type (with children / other) — extend `jp_fies.json`
- **CH**: BFS HABE by household composition — extend `ch_habe.json`
- **FI**: StatFin HBS by household type — extend `fi_hbs.json`
- **NO / SE**: use v3 pattern — model from Finland peer applied to their income levels

If direct kids/no-kids data is unavailable for a country, model from the "couple with kids" and "couple no kids" categories that most surveys publish.

Output: `data/v4/kids_split_expenditure.json` with per-country per-tier data:
```json
{
  "as_of": "2026-08-03",
  "countries": {
    "US": {
      "source": "BLS CES 2024",
      "source_url": "...",
      "with_kids": {
        "avg_gross_income": 128000,
        "avg_expenditure": 92000,
        "necessity_share_by_tier": {"p50": 0.72, "p90": 0.58, "p99": 0.35}
      },
      "no_kids": {
        "avg_gross_income": 78000,
        "avg_expenditure": 58000,
        "necessity_share_by_tier": {"p50": 0.60, "p90": 0.48, "p99": 0.25}
      }
    },
    ...
  }
}
```

### A.6 — International gross income by kids status

- OECD Family Database indicators PF1.1 (family income) and PF1.4 (household income by family type) — https://www.oecd.org/els/family/database.htm
- Cross-reference each country's national statistical office for validation

Output: fold into `data/v4/kids_split_expenditure.json` under each country's `with_kids.avg_gross_income` and `no_kids.avg_gross_income`.

### A.7 — Write `data/v4/README.md` summarizing everything.

## Phase B — UI

### B.1 — Preserve everything from v3

Every v3 tile, control, chart, and behavior must continue to work. Additive changes only.

### B.2 — Tile face additions (per-band pop, per-adult income, dual growth)

Extend `TileCard` for band-mode tiles:
- Below the existing headline mean, add "**Per equivalent-adult: $X**" line (secondary size)
- Below population-share stat, append "(~10.0M in US 2024)"-style band count
- Replace single "YoY: +1.2%" with **"Δ nominal YoY: +5.2% | Δ real YoY: +2.4%"**
- Real growth uses PCE deflator for US, HICP for international countries
- New sidebar dropdown (advanced settings): "Inflation deflator" — PCE (default US) / CPI-U (US alt) / HICP (international default)

### B.3 — Section 8: add Median+2σ column

- Insert between P50 and P90
- Uses (P75 − P25) / 1.349 from WID or Census data
- Applies the same discretionary transformation (post-tax − necessity) — **does NOT apply v4.2 tax layers yet**
- Column header tooltip: "Robust σ from median (IQR-based). Represents upper-middle mass, not the top tail."
- Sort behavior applies as it does to other columns
- Selected country row highlight unchanged

### B.4 — Section 11: kids vs no-kids side-by-side (NEW)

Format:
- One block per country (8 blocks total)
- Selected country block emphasized (bold border + tinted background)
- Each block header shows country name + flag emoji or ISO code
- Inside each block: a compact table
  ```
              With kids under 18    Without kids       Delta
  P50 gross   $128,000              $78,000            +$50,000
  P50 disc    $19,600               $34,300            −$14,700
  P90 gross   $315,000              $205,000           +$110,000
  P90 disc    ...                   ...                ...
  P99 gross   ...                   ...                ...
  P99 disc    ...                   ...                ...
  ```
- Show gross and discretionary (skip mid-numbers like post-tax and necessity in the compact view; expose them on hover)
- Delta column: color-coded (green for positive, red for negative)
- Section subtitle: "Households with children have higher gross income at every tier but often less discretionary income due to childcare and expanded necessity floor. Nordic countries close this gap through subsidized childcare and parental leave."

### B.5 — Sidebar additions

- **Inflation deflator** dropdown (in an "Advanced" section or existing advanced group): PCE / CPI-U / HICP
- No other sidebar changes in v4.1

### B.6 — Section 10 data sources — add new citations

- Census ASEC (already there? verify)
- World Bank Indicators (new)
- BEA PCE (new)
- BLS CPI-U (new)
- OECD HICP (new)
- OECD Family Database (new)
- ONS LCF Table A22 (verify; new URL if needed)

### B.7 — Methodology card additions

- Explain per-equivalent-adult computation (square-root scale from v2)
- Explain dual growth (which deflator by default per geography)
- Explain Section 8 Median+2σ robust-σ methodology
- Explain Section 11 kids-split methodology

## Phase C — QA

- Playwright screenshots at 1280 / 1440 / 1600 desktop + 375 mobile, both themes
- Verify US 2024 P50 tile shows:
  - Per equivalent-adult income for the P40-P60 band (median household size ~2.5 → sqrt scale factor 1.58 → per-EA income ≈ mean/1.58)
  - Band population count ~65M (US 2024 population × 20% for the P40-P60 band)
  - Nominal YoY vs real YoY (real should be strictly lower for 2020-2024, might be higher for deflationary periods)
- Verify Section 8: Median+2σ column appears between P50 and P90, sorts, has tooltip
- Verify Section 11 renders 8 country blocks; US selected block is emphasized
- Verify US Section 11 shows: with-kids higher gross ($128k vs $78k median), lower discretionary ($19.6k vs $34.3k median) — approximate numbers
- Verify Nordic countries show smaller with-vs-no-kids discretionary gap
- Verify France still not in dropdown
- All v3 tiles and controls still work

## Deploy

```
deploy_website(project_path="/home/user/workspace/income-tiles/dist/public", site_name="income-tiles", should_validate=false)
```

Do NOT commit — parent handles git. Do NOT call publish_website.

## Deliverables

Return summary listing:
- (a) files created / modified
- (b) functional pieces shipped vs. needing follow-up
- (c) deviations from V4_1_BUILD_SPEC.md with reasoning
- (d) deploy URL
- (e) known issues / TODOs for v4.2

## Coordinate with data subagent

The v4.1 data subagent runs in parallel and saves under `data/v4/`. When you reach data-wiring:
1. If `data/v4/README.md` exists — read it to know what's available
2. Copy `data/v4/*.json` into `client/public/data/v4/`
3. Wire real data; keep mock/placeholder fallback for missing files
4. If a data file didn't land, show a subtle "some data pending" indicator on affected tiles but do NOT block build

If data hasn't landed by the time you're ready to deploy, add a "Some v4.1 data pending" banner and return; parent will run a follow-up data-wiring pass.
