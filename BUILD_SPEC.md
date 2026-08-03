# Income Tiles Dashboard — Build Spec

## What we're building

An interactive React/TypeScript dashboard that decomposes US (and international) income distribution into "tiles" — cut points on the income curve — so a user can see where any income level sits relative to poverty, the median, and the top of the distribution. The goal: connect production/GDP-side aggregates to what actual people receive.

## Data source hierarchy

The user gets to toggle between three complementary sources with different tradeoffs:

- **Census ASEC** — household "money income" (pre-tax), 2000–2024, US-only, full percentiles for 2023–2024. Best for "typical household" framing.
- **BEA Distribution of Personal Income** — personal and disposable personal income, 2000–2024, US-only, deciles + Gini + inequality ratios (no dollar thresholds — reconstruct via mean/median/Gini if needed).
- **WID / DINA** — pre-tax and post-tax national income per equal-split adult, 1980–2024, US + Canada + UK + Germany + France + Japan. Full percentile thresholds p10 through p99.9 plus top shares. Best for time series and cross-country comparison.
- **CBO** — market / pre-tax / post-tax household income by quintile, 1979–2021, US-only. Best for tax/transfer analysis.

All data files live in `/home/user/workspace/income-tiles/data/`. Full README with source URLs and quirks: `data/README.md`.

## The tile layout (each tile is a card in the dashboard)

### Section 1: Reference thresholds (top row)
- **Poverty line** — HHS 2026, defaults to household size 1 ($15,960), toggleable to 2/3/4-person household, and Alaska/Hawaii variants
- **200% of poverty** — near-poor / benefits-eligibility threshold
- **Median** — from currently selected source

### Section 2: Distribution below median
- **Median − 2 MAD** (robust σ)
- **Median − 1 MAD**
- **P20 (bottom quintile ceiling)**
- **P40**

### Section 3: Distribution above median
- **P60**
- **P80 (top quintile floor)**
- **Median + 1 MAD**
- **Median + 2 MAD**

### Section 4: Top tail
- **Top 10% (P90)**
- **Top 5% (P95)**
- **Top 2% (P98)**
- **Top 1% (P99)**
- **Top 0.5% (P99.5)**
- **Top 0.1% (P99.9)**

Each tile shows:
1. **Dollar threshold** at that cut point (large, prominent)
2. **What % of the population is at/above this line** (secondary)
3. **Share of total income captured above this line** (tertiary, when available)
4. **Delta vs. previous year** (small, colored arrow)

## Global controls (top bar / sidebar)

1. **Income definition** dropdown: Market / Personal / Disposable / Pre-tax national (DINA) / Post-tax national (DINA)
2. **Data source** dropdown: Auto (best available) / Census ASEC / BEA / CBO / WID
3. **Unit of analysis** dropdown: Household / Tax filer / Equal-split adult
4. **Geography** dropdown: US / Canada / UK / Germany / France / Japan
5. **Year** slider: constrained by source availability (Census: 2000–2024, BEA: 2000–2024, CBO: 1979–2021, WID: 1980–2024)
6. **Outlier trim** panel:
   - Toggle: Off / Top-N exclusion / Income cap
   - Slider: N from 0 to 10,000 (when Top-N mode)
   - Input: max income $ (when Income cap mode)
   - Notes: Trim recomputes median/MAD/tiles below the trimmed threshold. Above-threshold tiles are marked "trimmed out."

## Robust SD from median (KEY IMPLEMENTATION NOTE)

Use **Median Absolute Deviation (MAD) scaled by 1.4826** to be comparable to Gaussian σ:
```
mad = median(|x_i - median(x)|) * 1.4826
```
Since we only have percentile thresholds (not microdata), approximate MAD from percentiles:
```
mad_approx = (p75 - p25) / 2 / 0.6745   // IQR-based robust σ, equivalent to MAD for Gaussian
```
Or use the closer available percentiles: for WID we have p40, p50, p60, p80 — use (p60 − p40) / 2 / (norm.ppf(0.6) − 0.5) as the σ estimate. Provide a small info tooltip on the σ-tiles explaining "robust σ from median (IQR-based)."

## Comparison view (secondary)

A "compare years" or "compare countries" mode: pick two data points (e.g., US-2000 vs. US-2024, or US-2024 vs. Germany-2024) and see each tile side-by-side with % change.

## Chart

Below the tiles: a **Lorenz curve** for the current selection (cumulative income share vs. cumulative population share), with the current selection's Gini annotated. And a **percentile-to-dollar curve** — X-axis is percentile 0–100, Y-axis is dollar threshold (log scale toggle). Reference lines for poverty, median, and each tile threshold overlaid.

## Ancillary tiles (below main tiles)

- **Gini coefficient** for the current view
- **P90/P10 ratio**
- **P90/P50 ratio**
- **Top 10% / Bottom 50% ratio** (WID publishes both)

## Placeholders for v2 (do NOT implement, but leave hooks in the schema)

Add disabled toggles with "Coming soon" tooltip:
- **"Deduct necessities"** — future: subtract housing, food, healthcare OOP, work transport from disposable income
- **"Deduct voluntary savings"** — future: subtract 401(k)/IRA/HSA contributions

## Design language

- Dashboard aesthetic (see `skills/website-building/webapp/dashboards.md`) — full-viewport, no body scroll, one primary scroll region
- Sans-serif everywhere. Tabular-nums for all dollar values.
- Cool, precise palette — muted slate + one accent for CTAs. This is a finance/data tool, not a marketing site.
- Dark mode as first-class (matches user preference for data work).
- Each tile is a Card with elevation on hover.
- Prominent, large dollar figures. De-emphasize secondary numbers.
- Include a small info button on the σ tiles and other jargon tiles that opens a popover explaining the concept.

## Data loading pattern

All source JSON files are in `data/`. Copy them to `client/public/data/` at build so they're served as static JSON. Frontend fetches them via `apiRequest` / react-query on load, caches indefinitely (they don't change during a session), and slices client-side.

Backend can be trivially thin — no server logic needed for v1. Static asset serving is fine. But keep the Express server running so we can add BLS CES fetching later.

## Testing

- Screenshot desktop + mobile via Playwright before deploying
- Manually verify: US-2024 median tile should show ~$83,730 (Census) or ~$52,807 (WID equal-split-adult)
- Verify: US-2024 P90 should show ~$251k (Census) or ~$174k (WID equal-split-adult)
- Verify: US-2024 poverty tile (household size 1) should show $15,960
- Verify: switching Census → WID with US-2024 selected causes ALL tiles to update

## Deploy

After Playwright QA passes, call `deploy_website(project_path="/home/user/workspace/income-tiles/dist/public", site_name="income-tiles")`. Do NOT call `publish_website` — the user will decide when to promote to pplx.app.
