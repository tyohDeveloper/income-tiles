# Income Tiles v2 — Discretionary Income Layer

**Status:** Planning as of 2026-08-03.

## Confirmed design decisions

### Starting point
- **All calculations begin from post-tax income**, per user (2026-08-03).
- Definition: post-tax national income per equal-split adult (WID/DINA) *or* Census-equivalent post-tax where WID doesn't have subnational data.
- Currency normalization: **OECD PPP for private consumption** applied automatically. Add a PPP toggle in the UI so users can switch to market FX for sanity-checking. Base year: 2023 (matches WID's real-price base).

### Housing treatment
- **Show both as toggles** (per user):
  - "Cash outlays" = mortgage P&I + property tax + insurance + utilities (renters: rent + utilities)
  - "Rental equivalent" = imputed rent for owners + utilities (renters unchanged)
- Default: rental equivalent (matches national accounts and is more comparable across countries).

### Necessity strictness
- **Slider with three levels** (per user):
  - **Minimal** — housing + food-at-home + healthcare OOP + work transport + childcare only
  - **BLS Basic** — the above + basic clothing + basic communications (phone, broadband) + personal care
  - **MIT Living Wage** — the BLS Basic bundle + civic engagement + minimal apparel + entertainment floor
- Default: BLS Basic.
- Each level derived from the same underlying category data; the slider just changes which categories count as "necessity."

### Regional price variation
- **US: BEA Regional Price Parities (state + metro)** — [BEA RPP dataset](https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area)
- **Germany: Länder-level** — Destatis regional price indices where available; some Länder have separate cost-of-living data via BBSR
- Other countries: national only for v2 (data is scarce and inconsistent below the country level)
- Add "Region" selector in the sidebar when a country with sub-national data is picked

### Country coverage (v2)
User chose (2026-08-03): **US, DE, UK, Norway, Sweden, Finland, Switzerland, JP** — France dropped due to stale 2017 EVS data (2022 release still pending).

Data sources per country:

| Country | Expenditure survey | Frequency | Latest year |
|---|---|---|---|
| US | BLS Consumer Expenditure Survey (CES) | Annual | 2024 |
| Germany | Destatis EVS + LWR (Laufende Wirtschaftsrechnungen) | 5-year EVS + annual LWR | LWR 2024 |
| UK | ONS Living Costs and Food Survey (LCF) | Annual | 2023 |
| Norway | SSB Forbruksundersøkelsen (halted post-2012, replaced by tax-register-based estimates) | See notes | 2012+register imputation |
| Sweden | SCB Household Budget Survey (HUT) | Discontinued 2009; use register + partial surveys | Modeled |
| Finland | Statistics Finland Household Budget Survey | 5-year | 2022 |
| Switzerland | BFS Haushaltsbudgeterhebung (HABE) | Annual | 2022 |
| Japan | Statistics Japan Family Income and Expenditure Survey (FIES) | Annual | 2024 |

**Data quality tiers** to badge in the UI:
- **Tier A** (recent annual survey): US, UK, Japan, Switzerland, Finland
- **Tier B** (recent 5-year survey, interpolated): Germany
- **Tier C** (modeled from register data + partial surveys): Norway, Sweden

## Additional decisions — CONFIRMED 2026-08-03

### 1. Household equivalence scale
- **Default: square-root scale** (needs = √ household size). Smoother and more intuitive than OECD-modified.
- **Toggle: OECD-modified** (first adult=1.0, additional adult=0.5, child under 14=0.3) for users wanting to match published DINA/LIS numbers exactly.
- Scale factor shown in sidebar so users know it's being applied.
- Applies to necessity costs, not to income (income is already per equal-split adult in WID).

### 2. Student loan servicing as necessity
- **Count minimum required payments as a separate necessity line-item.**
- Data: Fed SCF (Survey of Consumer Finances) for US student loan burden by income decile.
- European countries: near-zero automatically (tuition-free higher ed).
- Tooltip: "In countries with tuition-free higher education (Norway, Sweden, Finland, Germany), this line is near zero — this is a real feature of the cross-country comparison, not a data gap."

### 3. Childcare presentation
- **Solved by household-type selector (see #5).** When user picks "With kids under 12", full childcare cost is applied. When "All households", childcare is amortized across all households (understates it 4× for affected households — warning tooltip).

### 4. Voluntary savings target
- **Default: 15% of gross income** (matches Fidelity/Vanguard/T. Rowe Price current guidance).
- **Slider: 0–25%** with three visible reference marks: **10%** (legacy rule), **15%** (mainstream, default), **20%** (FIRE / aggressive).
- **Cross-country adjustment:** subtract mandatory pension contribution first (already excluded from DINA post-tax income), then apply target rate to what's left. Show "Mandatory pension: X% (already excluded)" per country in a small info line so users understand why a 5%-saving German has comparable retirement security to a 15%-saving American.

### 5. Life-stage / household-type selector
- **Add a "Household type" selector with 7 categories.** Data comes from BLS CES "consumer unit type" tables plus equivalents in each foreign survey.
  - All households (default)
  - Working-age single (25–64, no kids)
  - Working-age couple (25–64, no kids)
  - Household with kids under 12
  - Household with kids 12–18
  - Empty nesters (55+, no dependents)
  - Retirees (65+, no employment income)
- This selector replaces the standalone "child-household toggle" in the original v2 plan.
- Each category has its own necessity profile from the underlying survey.

### 6. Healthcare OOP (open question, deferred)
- BLS CES undercounts healthcare OOP by ~20% vs BEA PCE.
- Decision: **use BLS CES as-is with a footnote.** Within-country distributional comparisons are what matter; the level bias is disclosed.
- Revisit if the level bias distorts US-vs-country comparisons more than expected during QA.

## Tile changes for v2

Add new sections below the current v1 tiles:

### Section 5 — Necessity floor tiles
- **Necessity floor at current selection** — total $ per year at chosen strictness
- **Housing floor** (largest single component)
- **Healthcare OOP floor**
- **Food + basics floor**

### Section 6 — Discretionary tiles
- **Discretionary (before voluntary savings)** — at median, P20, P40, P60, P80
- **Discretionary (after voluntary savings @ target rate)** — same percentiles

### New global controls (add to sidebar)
- **PPP toggle**: On (default, PPP-normalized) / Off (local currency)
- **Housing mode**: Cash outlays / Rental equivalent
- **Necessity strictness slider**: Minimal → BLS Basic → Living Wage
- **Equivalence scale toggle**: Square-root (default) / OECD-modified
- **Region selector** (when country supports it): US states + top metros, DE Länder
- **Voluntary savings target slider** (0–25%, default 15%, reference marks at 10 / 15 / 20)
- **Household type selector** (7 categories, default All households)
- **Student loan visibility**: Auto (default — show line only when >0)

### Comparison mode expansion
- Add "Compare countries at same percentile" — pick a percentile, see discretionary income across all 8 countries side-by-side, with bars for gross → post-tax → post-necessity → post-savings

## Data acquisition plan

Fetch in this priority order:

1. **BLS Consumer Expenditure Survey 2024** — by decile AND by consumer-unit type. [bls.gov/cex/tables](https://www.bls.gov/cex/tables.htm). Anchor dataset.
2. **BEA Regional Price Parities** — county, metro, state — [bea.gov/data/prices-inflation/regional-price-parities](https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area)
3. **OECD PPP** for all 8 countries — [OECD PPP dataset](https://data.oecd.org/conversion/purchasing-power-parities-ppp.htm)
4. **Fed SCF student loan burden by decile** — [federalreserve.gov/econres/scfindex](https://www.federalreserve.gov/econres/scfindex.htm)
5. **Destatis EVS + LWR** for Germany, with Länder-level regional cost indices from BBSR
6. **ONS LCF** for UK by household type — [ons.gov.uk family spending](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure)
7. **Japan FIES** by household type — [Statistics Bureau](https://www.stat.go.jp/english/data/kakei/)
8. **Switzerland HABE** — [BFS](https://www.bfs.admin.ch/)
9. **Finland Household Budget Survey** — Statistics Finland
10. **Norway + Sweden** register-based imputation (hardest — best-effort with Tier C badge)
11. **Mandatory pension contribution rates** per country (for the cross-country voluntary-savings normalization) — OECD Pensions at a Glance

## Effective tax rates (need for the tax step)

Post-tax income in WID already handles taxes, so we don't need a separate effective-tax-rate table for the country-level v2 view. BUT — for the US regional view, we'll need state income tax + FICA + federal effective rates by percentile:

- **Tax Foundation** or **ITEP** state-by-state effective rates
- **IRS SOI** federal effective rates by AGI percentile
- **CBO** for the post-tax federal breakdown

## Deliverables

1. Extended data pipeline: `/data/expenditure/*.json` + `/data/ppp/*.json` + `/data/regional/*.json`
2. New client modules: `client/src/lib/necessity.ts`, `client/src/lib/ppp.ts`, `client/src/lib/regional.ts`
3. New UI components: `NecessitySlider`, `HousingModeToggle`, `RegionSelector`, `PPPBadge`, discretionary tile components
4. Extended methodology card explaining every choice above with links to primary sources
5. QA: verify BLS CES median matches published; verify PPP conversion round-trips; verify a known scenario (US median household with 2 kids in Ohio should have ~$X discretionary after BLS Basic necessities — cross-check against MIT Living Wage)

## What v2 is NOT

- Not a personal budget tool. It's a distributional view of what people at each percentile CAN spend after mandatory outlays.
- Not a policy proposal. It shows the current-year picture using published data.
- Not a real-time tool. Data lags 6-18 months depending on country.

## Change log

- **2026-08-03 (initial):** v2 plan created — 9 countries, single child-household toggle, life-stage deferred to v2.1.
- **2026-08-03 (revised):** France dropped (stale 2017 data, 2022 release pending). Confirmed decisions on equivalence scale (square-root default), student loans (separate necessity line), childcare (via household-type selector), savings target (15% default with 10/15/20 reference marks), and household-type selector (7 categories) folded in. Country count: 8.
