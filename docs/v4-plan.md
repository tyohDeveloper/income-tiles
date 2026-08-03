# Income Tiles v4 — Band Populations, Inflation, Kids-Split, Full Tax Decomposition

**Status:** Planning as of 2026-08-03, following v3 shipment.

## User-confirmed decisions

1. **Add band population size + per-equivalent-adult income** to every top-tail tile (uses v2 square-root equivalence scale).
2. **Show both nominal and real growth simultaneously** on every tile ("YoY: +5.2% nominal, +2.4% real") — no toggle, both visible.
3. **Add a dedicated Section 11**: side-by-side comparison of "with kids under 18" vs. "without kids" at each tier, across all 8 countries. Other sections stay single-view (use existing v2 household-type selector).
4. **Full three-layer tax decomposition** (US + international): direct + consumption + property. Meaningful change to computed discretionary numbers.
5. **Add "Median + 2σ" (robust) column to Section 8** cross-country discretionary table. Symmetric with the σ tiles in Sections 2/3; answers "what does discretionary look like for the upper-middle mass, not the tail?" Uses the same MAD-based robust σ as v1. See Section 8 update below.

## Section 1-6 tile additions (per-band population + per-adult income)

Every band-mode tile shows:

```
Top 5% (band)                                    (existing)
$387,000                                         mean of band (existing)
Per equivalent-adult: $174,000                   NEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Population share: 3.0% (~10.0M in US 2024)       NEW: shows band count
Income share: 15.2%                              (existing)
Δ nominal YoY: +5.2% | Δ real YoY: +2.4%         NEW: dual growth
```

### Data needed

- **Household size by percentile band**: Census ASEC Table HINC-04 (US), OECD Family Database (cross-country). Compute average household size per band → equivalent-adult factor via square-root scale.
- **Total population per country per year**: World Bank / UN.
- **Inflation deflator**: PCE (US default), CPI-U (US alt), OECD HICP (cross-country). Store 1980-2024 series; toggle in advanced settings if user wants CPI instead of PCE.

## Section 8 update — add Median+2σ column

Section 8 (Discretionary across countries by tier) was shipped in v3 with columns P50, P90, P95, P99, P99.9.

**v4 adds a new column: Median+2σ (robust)** — inserted between P50 and P90.

- Uses the same robust σ as v1: (P75 − P25) / 1.349, which equals 1.4826 × MAD for a Gaussian.
- Answers "what does discretionary look like for the upper-middle mass, not the tail?" — P90 is a threshold; Median+2σ is a robust spread measure that better represents the top of the middle-class bulge before the tail dominates.
- New Section 8 tier list: **P50, Median+2σ, P90, P95, P99, P99.9** (six columns).
- Column header tooltip: "Robust σ from median (IQR-based). Represents upper-middle mass, not the top tail."
- Sort behavior applies to this column as it does to all others.
- Selected country row highlight unchanged.

Median+2σ computation on cross-country data:
- For US: use Census ASEC or WID P25/P75 to compute robust σ
- For other countries: use WID P25/P75 (all 8 countries have these)
- Then apply the same discretionary transformation (post-tax − necessity, with all v4 tax layers)

## Section 11 — Kids vs. no-kids side-by-side (NEW)

**Rows:** 8 countries
**Columns per country:** With kids under 18 | Without kids | Delta
**Sub-rows within each country:** P50, P90, P99 (three tiers only — keeping this compact)

**Cells show:** Post-tax income → necessity floor → discretionary. Three-line stack per cell.

**Highlight of the story:** Households with kids typically have HIGHER gross income (dual earners peak-earning years) but LOWER discretionary income (childcare + kid necessities exceed the income premium in most countries — the exception being Nordics where subsidized childcare + parental leave close the gap).

### Data

- **US**: BLS CES already has "husband-and-wife with children" and "husband-and-wife no children" as consumer-unit types — we pulled this in v2 (`us_ces_2024_by_hhtype.json`)
- **Cross-country**: OECD Family Database publishes household expenditure and income by family type; supplement with national statistical office data for each country
- **Fallback**: model kids-adjustment as (base household expenditure × equivalence factor for kids) applied to selected country's decile income

## Full tax decomposition (Layer 1 + 2 + 3, US + international)

### Layer 1 — Direct taxes (already in DINA/WID post-tax)

- Federal income + FICA + state income
- For US regional view (state selector): use ITEP effective rate by decile per state
- For international: WID post-tax national income already handles this at the national average

### Layer 2 — Consumption taxes (NEW, meaningful impact)

**US:**
- **State + local sales tax** by state × income decile, from [ITEP Who Pays 2024](https://itep.org/whopays/)
- **Federal + state excise taxes** (fuel, alcohol, tobacco) from ITEP
- Apply to non-necessity consumption (necessities in many states are exempt from sales tax — food, clothing, medicine — track this)

**International:**
- **VAT rates + exemptions**: Eurostat + OECD Consumption Tax Trends
  - DE: 19% standard / 7% reduced (food, books)
  - UK: 20% standard / 5% reduced (energy) / 0% (food, children's clothing, books)
  - NO: 25% / 15% (food) / 12% (transport, culture)
  - SE: 25% / 12% (food) / 6% (books, transport)
  - FI: 25.5% / 14% (food) / 10% (books, transport)
  - CH: 8.1% / 2.6% (food, books)
  - JP: 10% / 8% (food)
- Effective VAT rate at each decile = expenditure_by_category × applicable VAT rate

**Computation:**
```
Layer2_burden = Σ (expenditure_i × effective_tax_rate_i)
```

Where `i` ranges over consumption categories, and each category has its own tax rate (0% for food in many jurisdictions, standard rate for entertainment, etc.).

### Layer 3 — Property + corporate + tariffs

**Property tax:**
- US: state-by-state effective property tax rate × housing value at each decile
- Attribution: homeowners pay directly; renters pay ~80% of property tax burden via rent per BLS incidence studies
- International: OECD Revenue Statistics — property tax as % of GDP + household surveys for allocation

**Corporate income tax:**
- Standard incidence assumption: 50% shareholders / 30% workers / 20% consumers (per CBO)
- Applied to WID capital income shares and labor income shares
- Note: this is somewhat double-counting because DINA post-tax already accounts for corporate tax at the aggregate. Rather than layer on top, use it to REALLOCATE incidence: shift some corporate tax burden away from national average toward top-decile shareholders (progressive) and away from workers proportionally.

**Tariffs:**
- Current US: [PIIE tariff burden by decile 2025](https://www.piie.com/publications/policy-briefs/2024/who-pays-tariffs)
- International: WTO tariff data + input-output tables to trace tariff pass-through
- Regressive — bottom deciles bear a higher effective rate on tariff-hit consumption

### Total effective tax rate view (NEW visualization)

Add a **"Tax burden decomposition"** chart per tile:
- Stacked bar: Direct tax / Consumption tax / Property tax / Corporate incidence / Tariffs
- Per income decile
- Compare across countries: shows why "post-tax income" is misleading when comparing high-VAT low-income-tax vs. low-VAT high-income-tax regimes

### Sales-tax exclusion detail (US)

Small info panel in Section 12 (new): map + table showing which states exclude which categories from sales tax:
- **Food (groceries)**: exempt in ~30 states (varies)
- **Clothing**: exempt in some states, capped in others
- **Prescription medicine**: exempt in most states
- **Non-prescription medicine**: mixed
- Cite state-by-state via [Tax Foundation State Sales Tax breakdown](https://taxfoundation.org/data/all/state/state-and-local-sales-tax-rates-2024/)

## Section 12 (NEW) — Tax composition comparison

Static informational section, similar format to Section 9 but focused on tax structure:

**Rows** (per country column):
- Top federal income tax rate
- State/regional variation (US only — range across states)
- Top capital gains rate
- Corporate tax rate
- Payroll/social insurance rate (employee + employer)
- Standard VAT/sales rate
- Reduced VAT/sales rates for food/basics
- Effective property tax rate (median)
- Wealth/inheritance tax rate
- Total tax revenue as % of GDP

**Color-coded** by "tax burden as % of GDP" (higher = green if progressive, red if regressive, per row).

## Sidebar additions

- **Inflation deflator** dropdown (advanced): PCE (default) / CPI-U / OECD HICP
- **Tax decomposition detail** toggle: "Show tax layers" (default off, adds stacked breakdowns to tiles)
- **Sales tax exclusions** toggle (US only): "Apply state-specific food/clothing exemptions" (default on when a US state is selected)
- **Incidence model** dropdown (advanced): Economic (default) / Cash-flow / Legal

## Impact estimates

Rough estimates of what v4 changes vs. v3 numbers:

- **US P50 discretionary**: v3 shows ~$19k. v4 with sales tax layer: -$1.5k (California, 8.4% effective on necessities+non-necessities). v4 with property tax: -$3k for homeowner in a median-property-tax state. **New v4 P50 discretionary: ~$14-15k for typical US household.**
- **Germany P50 discretionary**: v3 shows ~$23k. v4 with VAT layer (19% on ~50% of non-necessity spending): -$4k. **New v4 P50: ~$19k.**
- **Denmark equivalent (if we added it)**: v3 would show high discretionary; v4 with 25% VAT on almost everything: much lower.

**The v4 numbers will be significantly lower across the board** and will change the country rankings meaningfully. This is the point.

## Data acquisition plan

### Phase A — v4 data

1. **Household size by percentile** — Census ASEC HINC-04 (US), OECD/Eurostat family data (international)
2. **Total population** by country/year — World Bank
3. **Inflation deflators** — BEA PCE, BLS CPI-U, OECD HICP for all 8 countries + Eurozone
4. **ITEP Who Pays 2024** — US effective sales+excise+property rates by state × decile
5. **OECD Consumption Tax Trends 2024** — VAT rates and exemptions per country
6. **Eurostat VAT rates database** — reduced rates by product category
7. **Tax Foundation state sales tax exemptions** — food, clothing, medicine by state
8. **PIIE tariff burden by decile** — current US tariff regime
9. **OECD Revenue Statistics** — property tax as % of GDP + household allocation
10. **BLS CES + national HBS by family type (with-kids / without-kids)** — for Section 11

### Phase B — UI

1. Extend tile computation to include population + per-adult income + dual growth
2. Add Section 11 (kids-split comparison table)
3. Add Section 12 (tax composition table)
4. Extend discretionary calc with Layer 2 + Layer 3 tax burdens
5. Add tax-decomposition stacked bar visualization
6. Extend sidebar with new toggles
7. Update methodology card and Section 10 data sources

### Phase C — QA + Deploy

- Verify v4 US P50 discretionary lands in $14-15k range (vs. v3 $19k)
- Verify Germany P50 lands in $18-20k range (vs. v3 $23k)
- Verify high-VAT countries (NO, SE, FI) show significantly lower discretionary than v3
- Section 11: verify US "with kids" discretionary is lower than "without kids" despite higher gross income
- Section 12: verify tax composition table renders with correct color coding
- Playwright screenshots at all breakpoints

## Estimated scope

v4 is the largest single expansion yet:
- ~10 new datasets
- 2 new sections (11 and 12)
- Discretionary calc changes affect every existing tile
- New chart type (tax-decomposition stacked bar)
- Substantial methodology card updates

Expect subagent build time in the 90-120 minute range for data + 60-90 for UI. Recommend running data and UI subagents in parallel as we did for v2 and v3.

## What v4 is NOT

- Not a personal tax calculator (uses average incidence, not individual filings)
- Not a policy proposal
- Not authoritative on tariff burden — recent US tariff changes make this a fast-moving target

## Change log

- **2026-08-03 (draft):** v4 plan drafted after v3 shipped. User-confirmed: per-equivalent-adult income, dual growth (nominal + real always visible), Section 11 dedicated to kids-split (§1-9 stay single-view via v2 selector), full three-layer tax decomposition (US + international) plus a Section 12 tax-composition comparison table.
- **2026-08-03 (revised):** Added Median+2σ (robust) column to Section 8 cross-country discretionary. Symmetric with the σ tiles in Sections 2/3. Uses the same MAD-based robust σ as v1. Section 8 tier list now: P50, Median+2σ, P90, P95, P99, P99.9.
