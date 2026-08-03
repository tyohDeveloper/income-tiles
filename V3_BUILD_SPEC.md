# Income Tiles v3 — Build Spec

## Prerequisites (READ FIRST, IN ORDER)

1. `docs/v3-plan.md` — v3 design decisions (this is authoritative)
2. `docs/v2-plan.md` — v2 conventions (still in effect)
3. `data/v2/README.md` — v2 data conventions
4. `V2_BUILD_SPEC.md` — v2 build patterns to follow
5. Existing code in `client/src/{lib,components/dashboard,pages}/`

## Scope

**Three new sections + a dashboard-wide behavior change (disjoint bands).**

## Phase A — Data (only touch this in the data subagent)

### A.1 — WID pulls for four new countries

Add pretax and posttax national income data for CH (Switzerland), NO (Norway), SE (Sweden), FI (Finland) at the same schema as existing WID files under `data/`. Same source: bulk CSV download from https://wid.world/data/.

Output files (six per country):
- `wid_che.json`, `wid_che_pretax_national.json`, `wid_che_posttax_national.json`
- `wid_nor.json`, `wid_nor_pretax_national.json`, `wid_nor_posttax_national.json`
- `wid_swe.json`, `wid_swe_pretax_national.json`, `wid_swe_posttax_national.json`
- `wid_fin.json`, `wid_fin_pretax_national.json`, `wid_fin_posttax_national.json`

Same schema as `wid_deu.json`. Include the full 1980–2024 series where available, with all percentile thresholds (p10, p20, p40, p50, p60, p80, p90, p95, p99, p99.5, p99.9) and top shares.

### A.2 — WID P99.99 and P99.999 thresholds

Attempt to pull the extended top-tail thresholds (p99.99, p99.999) for all 8 v3 countries (US, DE, UK, NO, SE, FI, CH, JP). WID sometimes publishes these in extended series. If unavailable for a country, document with an explicit "not_published" flag in the JSON.

Save to `data/v3/wid_toptail_thresholds.json` with structure:
```json
{
  "source": "WID",
  "extracted": "2026-08-03",
  "countries": {
    "US": { "years": [{ "year": 2024, "p99_99": ..., "p99_999": ... }, ...] },
    "DE": { "years": [...] },
    ...
  }
}
```

### A.3 — WID top shares for band computation

For the disjoint-band computation, we need top shares at each threshold. Pull for all 8 countries and years 2000–2024 (or as far back as available):
- top10_share, top5_share, top2_share, top1_share, top05_share, top01_share, top001_share, top0001_share

Save to `data/v3/wid_top_shares.json` with the same nested structure as A.2. This may partially duplicate data in existing wid_*.json files — it's fine, we want a single easy-to-query file for the band math.

### A.4 — OECD Taxing Wages effective tax by percentile

For section 8 discretionary computation. Source: OECD Taxing Wages 2024 report + supplementary data at https://www.oecd.org/tax/taxing-wages/. What we need per country: effective tax rate (income tax + employee SSC) at 67%, 100%, 167%, and 250% of average wage. From these four points, interpolate a percentile→tax-rate curve. For US, also cross-check against CBO's post-tax series.

Save to `data/v3/effective_tax_by_percentile.json`.

### A.5 — Forbes top-10 by country (income estimate)

Snapshot from https://www.forbes.com/real-time-billionaires/. Pull top-10 billionaires per country (US, DE, UK, NO, SE, FI, CH, JP). For each: name, current wealth in USD, primary source of wealth. Derive estimated annual income = wealth × 0.04 (4% typical portfolio yield). Add a big honest caveat as a top-level note in the JSON.

Save to `data/v3/forbes_top10.json`:
```json
{
  "source": "Forbes Real-Time Billionaires",
  "snapshot_date": "2026-08-03",
  "yield_assumption": 0.04,
  "notes": "Wealth from Forbes, estimated annual income = wealth * 4%. NOT IRS-reported income; realized income can differ dramatically year-to-year (e.g. Musk 2021 realized $23B).",
  "countries": {
    "US": [
      { "rank": 1, "name": "...", "wealth_usd": ..., "est_annual_income_usd": ..., "source_of_wealth": "..." },
      ...
    ],
    ...
  }
}
```

### A.6 — Non-monetary benefits table

11 categories × 8 countries. Sources per the v3-plan.md table. This is a one-shot informational pull.

Save to `data/v3/non_monetary_benefits.json`:
```json
{
  "as_of": "2026-08-03",
  "countries": ["US", "DE", "UK", "NO", "SE", "FI", "CH", "JP"],
  "categories": [
    {
      "id": "paid_vacation",
      "label": "Paid vacation (statutory minimum)",
      "unit": "days per year",
      "source_url": "...",
      "values": { "US": 0, "DE": 20, "UK": 28, "NO": 25, "SE": 25, "FI": 30, "CH": 20, "JP": 10 },
      "value_notes": { "US": "No federal statutory minimum; typical employer offers 10-15 days", ... }
    },
    { "id": "paid_sick_leave", ... },
    { "id": "paid_parental_leave", ... },
    { "id": "public_healthcare", ... },
    { "id": "public_higher_education", ... },
    { "id": "public_childcare", ... },
    { "id": "public_transit", ... },
    { "id": "unemployment_insurance", ... },
    { "id": "pension_replacement_rate", ... },
    { "id": "family_cash_benefits", ... },
    { "id": "statutory_retirement_age", ... }
  ]
}
```

For categorical fields (like "public healthcare model: universal/employer/mixed"), use a short string. For numerical fields (days, weeks, %), use numbers. Always include a `value_notes` object with a one-line qualifier per country.

### A.7 — Germany necessity data fix

Diagnosis: v2 subagent reported DE necessity ~$24k vs expected ~$32k. Likely causes:
- LWR monthly brackets used instead of full EVS breakdown
- No work-transport split
- Thin healthcare line

Re-fetch Destatis EVS 2018 with the full COICOP category breakdown. If EVS 2018 remains too stale, supplement with Destatis LWR 2023 annual figures normalized to EVS category structure. Verify housing (COICOP 04) matches BBSR published housing costs (avg ~€1,000/mo in 2023).

Save updated file as `data/v2/de_evs.json` (replace existing). Preserve the old file first as `data/v2/de_evs.v2.json` for reference.

### A.8 — NO/SE peer modeling from Finland

Compute a "necessity share by decile" curve from Finland's HBS data (`data/v2/fi_hbs.json`). Apply that curve to Norway's and Sweden's decile income (from `no_expenditure.json` and `se_expenditure.json`) to synthesize expenditure_by_category values.

Save as `data/v3/no_expenditure_modeled.json` and `data/v3/se_expenditure_modeled.json`. Do NOT overwrite the raw v2 income-only files. Include a top-level `"modeled_from": "FI"` field and a clear note.

### A.9 — README

Write `data/v3/README.md` summarizing everything added in v3.

## Phase B — UI (only touch this in the UI subagent)

### B.1 — Preserve everything from v2

Every v2 tile, control, chart, and behavior must continue to work. Additive changes only.

### B.2 — Disjoint bands (dashboard-wide behavior change)

Refactor how top-tail tiles compute values:

1. Add `bandMode: "threshold" | "band"` to the incomeModel view. Default: **"band"** (per v3-plan.md decision).
2. In `tiles.ts`, extend each tile definition with a `bandUpper` field pointing to the next-higher tile:
   ```ts
   { id: 'p95', label: 'Top 5%', bandUpper: 'p98', ... }
   { id: 'p98', label: 'Top 2%', bandUpper: 'p99', ... }
   { id: 'p99', label: 'Top 1%', bandUpper: 'p995', ... }
   { id: 'p995', label: 'Top 0.5%', bandUpper: 'p999', ... }
   { id: 'p999', label: 'Top 0.1%', bandUpper: 'p9999', ... }
   { id: 'p9999', label: 'Top 0.01%', bandUpper: 'p99999', ... }  // NEW
   { id: 'p99999', label: 'Top 0.001%', bandUpper: 'top10', ... }  // NEW
   { id: 'top10', label: 'Top 10 individuals', ... }  // NEW
   ```
3. Band mean computation:
   - `band_share = top_share_at_this_percentile − top_share_at_bandUpper_percentile`
   - `band_population_share = (100 − this_percentile)/100 − (100 − bandUpper_percentile)/100`
   - `band_mean = (band_share × total_national_income) / (band_population_share × total_population)`
   - Which reduces to: `band_mean = mean_income × (band_share / band_population_share)`
4. **Top-10 subtraction from P99.999 band:** if `top10` data is present for the current country, subtract the aggregate top-10 income from the P99.999 band's numerator before computing its mean.
5. Below-median tiles (P20, P40, P50, P60, P80): treat them symmetrically as **bottom-percentile bands** (P0-P20, P20-P40, etc.). Similar computation using bottom shares if available, otherwise reconstruct from top shares (100% − sum of top shares).
6. Robust σ tiles stay threshold-only (per plan). Add a small clarifying tooltip.
7. Small "(band)" qualifier on all band-mode tiles, with tooltip: "Band mean: mean income of people between this tile's percentile and the next tile up. Non-overlapping with other tiles."
8. When band data is unavailable for a tile, gracefully fall back to threshold with a "threshold-only" badge.

### B.3 — Section 7: Outliers (collapsible)

New section below Discretionary (v2). Collapsed by default with a "Show outliers" toggle in the sidebar under a new "Outlier detail" heading.

Three tiles:
- **P99.99 band** (Top 0.01%): band mean from `wid_toptail_thresholds.json` + `wid_top_shares.json`
- **P99.999 band** (Top 0.001%): band mean, with top-10 subtraction applied
- **Top 10 individuals**: aggregate mean from Forbes data for the currently-selected country; expandable card showing named list

Named-list card format:
```
Rank | Name              | Wealth (Forbes) | Est. income (4% yield)
1    | Elon Musk         | $420B           | $16.8B
2    | Larry Ellison     | $280B           | $11.2B
...
```

Big footnote on the card: "Estimated annual income = Forbes wealth × 4% typical portfolio yield. Not IRS-reported. Actual realized income can differ dramatically year-to-year."

If the selected country has no Forbes top-10 data (unlikely for all 8), show "Top-10 data not available for this country."

### B.4 — Section 8: Discretionary across countries by tier

Table format:
- **Rows:** 8 countries (US, DE, UK, NO, SE, FI, CH, JP). France excluded.
- **Columns:** P50, P90, P95, P99, P99.9 (five tiers).
- **Cells:** discretionary income (post-tax − necessity) at that tier, PPP-normalized if PPP toggle on.

Per cell:
- Large $ value
- Small delta chip vs currently-selected country's row: "+18%" green / "−22%" red
- Data-tier badge on countries with modeled or interpolated data

**Selected country's row is bolded and has a tinted background.**

**Sortable columns** — click a column header to sort descending by that tier.

Below the table, add a caveat card explaining:
- Effective tax rate at each percentile from OECD Taxing Wages
- Necessity share extrapolated to tail from decile expenditure surveys (monotone spline)
- NO/SE modeled from Finland peer

### B.5 — Section 9: Non-monetary benefits comparison

Static comparison table:
- **Rows:** 11 categories from `non_monetary_benefits.json`
- **Columns:** 8 countries
- **Cells:** value (with unit) + on-hover: `value_notes[country]` tooltip

**Color coding per row:**
- Compute quartiles of the 8 country values for that row
- Top quartile (2 countries) → subtle green tint
- Middle two quartiles (4 countries) → neutral
- Bottom quartile (2 countries) → subtle red tint
- For categorical fields, define a "generosity ranking" mapping (e.g., "universal healthcare" = green, "mixed" = neutral, "employer-only" = red)

**Selected country's column is bolded and has a tinted background** (same treatment as section 8).

Small caveat text at bottom: "Values are statutory or typical. Actual benefits vary by employer, region, cohort, and specific circumstance. Sources cited per row (hover)."

No interactivity beyond hover. No sliders. No toggles. Deliberately informational.

### B.6 — Country selector changes

- Remove France from the country dropdown. Keep the data file.
- Add Switzerland, Norway, Sweden, Finland to the dropdown.
- Update the geography → source coupling: all four new countries route to WID for section 1-6 tiles.

### B.7 — Sidebar additions

Add under existing controls:
- "Show outliers" toggle (default OFF) — controls section 7 visibility

### B.8 — Methodology card

Extend the existing methodology card with:
- Explanation of disjoint bands
- Explanation of top-10 subtraction
- Section 8 computation details
- Section 9 sources with URLs
- Data-tier legend (A/B/C explained)

## Phase C — QA

- Playwright screenshots at 1280, 1440, 1600 desktop + 375 mobile, both themes
- Verify US 2024 disjoint bands (WID):
  - Top 10% band (P90-P95): ~$220k
  - Top 5% band (P95-P98): ~$310k
  - Top 1% band (P99-P99.5): ~$700k
  - Top 0.1% band (P99.9-P99.99): ~$5M
  - Top 0.01% band (P99.99-P99.999): ~$40M
  - Top 0.001% band (P99.999-top10): ~$300M+ (approximate)
  - Top 10 individuals: ~$14-17B/yr aggregate
- Verify Section 8: US P50 discretionary ~$19k, DE P50 discretionary ~$25-30k PPP (after data fix), NO/SE modeled
- Verify Section 9: 11 rows render, color coding correct, selected-country highlight works
- Verify France is not in dropdown, but existing wid_fra.json still loads without error
- Verify Switzerland, Norway, Sweden, Finland now appear in dropdown and all section 1-6 tiles compute
- Verify collapsible outlier section: collapsed by default, expands on toggle, tiles render
- Verify all v2 tiles and controls still work

## Deploy

```
deploy_website(project_path="/home/user/workspace/income-tiles/dist/public", site_name="income-tiles", should_validate=false)
```

Do NOT commit — parent agent handles git. Do NOT call publish_website.

## Deliverables

Return summary listing:
- (a) files created / modified
- (b) which functional pieces shipped vs need follow-up
- (c) deviations from V3_BUILD_SPEC.md with reasoning
- (d) deploy URL
- (e) known issues / TODOs
