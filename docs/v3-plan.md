# Income Tiles v3 — Outliers, Cross-Country Discretionary, Non-Monetary Benefits

**Status:** Planning as of 2026-08-03, following v2 shipment.

## User-confirmed decisions

1. **Add outlier section** after top 0.1%: P99.99, P99.999, and estimated top-10 billionaires (Forbes-derived).
2. **Remove France** from country comparisons and picker (keep data file for backward compat, hide in UI).
3. **Add Switzerland, Norway, Sweden, Finland** to WID country coverage (data pull required).
4. **Add "Discretionary across countries by tier"** section — tiers: **P50, P90, P95, P99, P99.9**.
5. **Add "Non-monetary benefits comparison"** section — informational, static, **comparison table format** with color coding.
6. **Cross-country sections highlight the currently-selected country** in visual treatment, show others as context. (Consistent with v1/v2's country-picker flow.)
7. **Data fixes**: Germany necessity floor (v2 tier-B issues); model NO/SE from Finland peer for discretionary/necessity tiles.
8. **Switch all top-tail tiles from cumulative to disjoint bands** — "Top 5%" now shows the mean of the 5–2% band (not "everyone above P95"). Guarantees each tile represents a distinct, non-overlapping slice of the population.

## Disjoint band architecture (applies dashboard-wide)

**Current behavior:** tiles show the WID-published percentile *threshold* ($X = the income floor to be in the top 5%). Tertiary stats ("income above: 22%") are cumulative and include billionaires — conceptually inconsistent with a "tile per group" reading.

**New behavior:** tiles show the **band mean** — the mean income of the people between this tile's percentile and the next-higher tile's percentile.

### Band definitions (top of curve reads downward)

| Tile | Band | Population share |
|---|---|---|
| Top-10 billionaires | Named list, subtracted from lower bands | ~10 individuals per country |
| P99.999 | P99.999 to top-10 floor | ~0.001% minus 10 |
| P99.99 | P99.99 to P99.999 | ~0.009% |
| Top 0.1% | P99.9 to P99.99 | ~0.09% |
| Top 0.5% | P99.5 to P99.9 | ~0.4% |
| Top 1% | P99 to P99.5 | ~0.5% |
| Top 2% | P98 to P99 | ~1% |
| Top 5% | P95 to P98 | ~3% |
| Top 10% | P90 to P95 | ~5% |
| P80 | P80 to P90 | ~10% |
| P60 | P60 to P80 | ~20% |
| Median (P50) | P40 to P60 | ~20% |
| P40 | P20 to P40 | ~20% |
| P20 | Bottom to P20 | ~20% |

### Label convention

**Keep existing labels ("Top 5%") plus a small "(band)" qualifier and a tooltip explaining the disjoint interpretation.** Do NOT rewrite labels dynamically — stable labels reduce cognitive load.

Tooltip text: "Band mean: the mean income of people between this tile's percentile and the next tile up. Non-overlapping with other tiles. See methodology."

### Robust-σ (±MAD) tiles

Leave as threshold-only per user decision. σ tiles describe spread from the median, not tail extraction, so band interpretation would be redundant. Add a tooltip note clarifying that σ tiles are threshold-only, unlike the tail tiles.

### Computation

Band mean requires income data at multiple percentiles OR the income share held by each band.

- **WID publishes both top shares and percentile thresholds.** Band mean = (income share of band × total national income) / (population share of band).
- For US: WID publishes top10/top5/top1/top0.1 shares directly; band shares derived by subtraction (top5% share − top2% share = 5–2% band share).
- For P99.99 and P99.999: WID's US series has these; other countries partial. Where missing, show "insufficient data" rather than modeling.
- **Top-10 billionaires subtraction:** the aggregate Forbes-derived income for the top 10 is subtracted from the P99.999 band total before computing its mean, so the two tiles are truly disjoint.

### Cumulative-view escape hatch

Add a **tooltip note** on each tile linking to the methodology card that shows both band mean and the cumulative-mean equivalent, so users who want the "traditional" cumulative reading can see it. But cumulative is not the default and does not appear on the tile face.

## New section layout

```
Section 1 — Reference thresholds
Section 2 — Below the median
Section 3 — Above the median
Section 4 — Top tail
Section 5 — Necessity floor (v2)
Section 6 — Discretionary (v2)
[NEW] Section 7 — Outliers (collapsible, off by default)
[NEW] Section 8 — Discretionary income across countries (by tier)
[NEW] Section 9 — Non-monetary benefits comparison (informational)
```

## Section 7 — Outliers (collapsible)

Three tiles:

- **P99.99 floor** (top 0.01% — ~33k US filers) — from WID where available; grayed out for countries without data
- **P99.999 floor** (top 0.001% — ~3.3k US filers) — US-only for most years; other countries show "Not published"
- **Top-10 estimated annual income** — Forbes Real-Time Billionaires wealth × 4% assumed portfolio yield, showing top-10 by country
  - **Named individuals table** with columns: Rank / Name / Nationality / Wealth (Forbes) / Est. annual income
  - Big methodology footnote: "Estimated from Forbes wealth × 4% typical portfolio yield. NOT IRS-reported income. Realized income can be much higher (Musk 2021: $23B) or near zero depending on the year."
  - Data source: [Forbes Real-Time Billionaires](https://www.forbes.com/real-time-billionaires/), refreshed at build time (not live)

**Collapsible with a "Show outliers" toggle** in the sidebar. Off by default because it's methodologically weaker than the rest of the dashboard.

**Interaction with existing outlier trim:** when the v1 Top-N or income-cap trim is active, section 7 tiles show a "Trimmed out" indicator.

## Section 8 — Discretionary across countries by tier

**Tiers shown:** P50, P90, P95, P99, P99.9 (five columns)
**Rows:** 8 countries (US, DE, UK, NO, SE, FI, CH, JP) — France excluded per user

**Each cell shows:**
- Discretionary income $ (PPP-normalized to USD if PPP toggle on)
- Small delta chip vs the currently-selected country ("+18%" green if higher, "−22%" red if lower)
- Data-tier badge (A/B/C) on countries with modeled expenditure structure

**Currently-selected country is highlighted** — bold row, subtle background tint.

### Computation approach (this is the hard part)

Per country and per tier:

1. **Income at tier** = WID pretax income at that percentile → apply country's effective tax at that percentile → post-tax income
   - Effective tax rate by percentile: for US use CBO's post-tax series (already have); for others use OECD Taxing Wages + interpolation
   - Fallback: use WID's own posttax national income at that percentile (already handles taxes/transfers per DINA convention)
2. **Necessity share at tier** = smooth interpolation of `necessity_total / avg_expenditure_total` from the decile expenditure survey (BLS CES, EVS, LCF, FIES, HABE, HBS)
   - Fit a monotone spline to the decile centers (5%, 15%, 25%, …, 95% for centered deciles) — necessity share typically declines with income
   - Extrapolate to tail (P99, P99.9) by holding share constant at d10's necessity share (upper bound) or 10% (lower bound, "true billionaire spending doesn't scale with income")
3. **Discretionary at tier** = post-tax at tier × (1 − necessity share at tier)
4. Apply PPP if toggle on

**NO and SE:** model necessity share from Finland's curve. Badge as "Modeled from FI peer" with tooltip.

**Sortable columns.** Default sort: descending by selected column.

## Section 9 — Non-monetary benefits comparison

**Format:** dense comparison table, countries as columns, categories as rows. Color-coded by "generosity."

### Categories and sources

| Row | Metric | Source |
|---|---|---|
| Paid vacation (statutory min) | Days/year | [OECD](https://data.oecd.org/emp/hours-worked.htm) |
| Paid sick leave | Weeks at ≥70% of wage | [OECD sickness benefits](https://www.oecd.org/els/emp/sickness.htm) |
| Paid parental leave | Weeks + avg replacement rate | [OECD Family Database](https://www.oecd.org/els/family/database.htm) |
| Public healthcare | Universal / employer / mixed + household OOP % of health spend | [OECD Health at a Glance](https://www.oecd.org/health/health-at-a-glance/) |
| Public higher education | Free / income-based / market + avg tuition | [OECD Education at a Glance](https://www.oecd.org/education/education-at-a-glance/) |
| Public childcare | % subsidized + typical net cost as % of avg wage | [OECD Family Database PF3.4](https://www.oecd.org/els/soc/PF3_4_Childcare_support.pdf) |
| Public transit | Coverage % + typical urban monthly pass cost | [UITP](https://www.uitp.org/) |
| Unemployment insurance | Weeks + net replacement rate 6-month unemployment | [OECD Benefits in Unemployment](https://www.oecd.org/social/benefits-and-wages.htm) |
| Public pension replacement rate | Net replacement rate at avg wage | Already have from v2 OECD Pensions |
| Cash family benefits | Annual per-child at 2-child family | [OECD PF1.3](https://www.oecd.org/els/family/database.htm) |
| Statutory retirement age | Age (or current cohort's normal age) | [OECD Pensions at a Glance](https://www.oecd.org/pensions/pensionsataglance.htm) |

**11 rows × 8 country columns.** US is the natural anchor for comparison.

### Presentation

- **Selected country column is highlighted** (bold header, tinted background)
- **Color coding**: green = generous (top quartile of the 8 countries), yellow = middle two quartiles, red = bottom quartile — computed per row
- **Cell content**: value + short qualifier ("28 days min", "50 weeks / 65%", "Free", "$0-3k/yr")
- **Hover tooltip**: full definition + source URL
- **Small text below table**: "Values are statutory or typical; actual benefits vary by employer, region, and cohort."

### No interactivity beyond hover

This section is deliberately **static and informational**. No sliders, no toggles. It exists to illustrate the finance/tax/policy context around the monetary numbers above.

## New data required

1. **WID data for Switzerland, Norway, Sweden, Finland** — same pull as existing WID files
2. **WID P99.99 and P99.999 thresholds** for all 8 countries where available
3. **Forbes top-10 billionaires by country** — one-time snapshot, refreshed at build
4. **OECD Taxing Wages** — effective tax rate by percentile (for section 8 discretionary computation)
5. **OECD Family Database, Education at a Glance, Health at a Glance** — the 11 non-monetary benefit metrics
6. **UITP transit data** — public transit coverage and cost
7. **Germany necessity data fix** — re-pull Destatis EVS 2018 with proper category breakdown; investigate why LWR monthly brackets don't have work-transport split; check if there's a better data source for German household consumption structure

## Data-fix specifics for Germany

The v2 subagent reported Germany necessity reads ~$24k vs expected ~$32k. Diagnosis needed:

- Compare EVS 2018 published category totals to what's currently in `de_evs.json`
- Check if the current file uses LWR monthly brackets (partial coverage) instead of EVS full survey
- Look at BBSR Wohnkostenbericht for verified housing costs per Land
- Verify work-transport is 60% of total transport (BBSR standard); if the file has 0 for work-transport, that's the bug
- If EVS 2018 is stale, consider Destatis "Wirtschaftsrechnungen privater Haushalte" annual data for 2023 or 2024

## NO/SE peer modeling for v3

Currently NO/SE have income data but no expenditure. The plan says fall back to Finland's expenditure structure. In v3:

- Apply Finland's necessity share (necessity / disposable) at each decile to NO/SE income at each decile
- Badge output tiles: **"Modeled from Finland peer (Tier C)"**
- Add a caveat card explaining the assumption: "Norway/Sweden's household budget surveys were discontinued after 2012/2009. Necessity floor here assumes Norwegian/Swedish households allocate spending in similar proportions to Finnish households at the same income level."

## Cross-country selector scope decision

User chose: **selected country highlighted, others shown as context.**

Implementation:
- Section 7 (Outliers): shows the selected country's outlier tiles + a smaller comparison strip showing other countries' equivalent tiles as context bars
- Section 8 (Discretionary across countries): full 8-country table, selected country's row is bolded and tinted
- Section 9 (Non-monetary benefits): full 8-country table, selected country's column is bolded and tinted

Country selector still governs section 1-6 as it does today.

## Build phasing

### Phase A — Data
1. Pull WID for CH, NO, SE, FI
2. Pull WID p99.99 and p99.999 where available
3. Fetch Forbes top-10 by country (one-off snapshot to `data/v3/forbes_top10.json`)
4. Fix German expenditure data (re-pull EVS 2018 or find better)
5. Compile non-monetary benefits table from OECD sources → `data/v3/non_monetary_benefits.json`
6. OECD Taxing Wages by percentile → `data/v3/effective_tax_by_percentile.json`
7. Add NO/SE peer-modeled expenditure with clear Tier C badging

### Phase B — UI
1. Extend WID country list in `incomeModel.ts` (CH, NO, SE, FI added; FR hidden)
2. New Section 7 component with collapse-toggle
3. New Section 8 component (cross-country discretionary table)
4. New Section 9 component (non-monetary benefits table)
5. Highlight-selected-country styling across all three new sections
6. Update methodology card
7. Add "Show outliers" toggle in the sidebar

### Phase C — QA + deploy
1. Playwright screenshots at all breakpoints
2. Verify: US P99.99 ~$3.3M (WID 2024), P99.999 ~$14M, top-10 aggregate ~$14-17B/yr
3. Verify: cross-country discretionary at P50 shows US $19k, DE $20-25k (after data fix), NO/SE modeled
4. Verify: non-monetary table renders with color coding and selected-country highlight
5. Deploy + push to GitHub

## What v3 is NOT

- Not a live billionaire tracker — Forbes data is snapshot at build
- Not a policy simulator — the numbers reflect current-year published data
- Not a personal financial planning tool — still a distributional view

## Change log

- **2026-08-03 (draft):** v3 plan drafted after v2 shipped. Locked outlier section (99.99 + 99.999 + top-10 named), tier list (P50/P90/P95/P99/P99.9), benefits table format, selected-country highlight, France removal, addition of CH/NO/SE/FI to comparisons.
- **2026-08-03 (revised):** All top-tail tiles switched from cumulative to disjoint bands per user request. "Top 5%" now means the mean of the 5–2% band, non-overlapping with other tiles. Labels kept stable with a small "(band)" qualifier and tooltip. Robust-σ tiles remain threshold-only. Top-10 billionaires are explicitly subtracted from the P99.999 band so the two are truly disjoint.
