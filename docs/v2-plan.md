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
User chose: **US, DE, UK, FR, Norway, Sweden, Finland, Switzerland, JP**

Data sources per country:

| Country | Expenditure survey | Frequency | Latest year |
|---|---|---|---|
| US | BLS Consumer Expenditure Survey (CES) | Annual | 2024 |
| Germany | Destatis EVS + LWR (Laufende Wirtschaftsrechnungen) | 5-year EVS + annual LWR | LWR 2024 |
| UK | ONS Living Costs and Food Survey (LCF) | Annual | 2023 |
| France | INSEE Budget de Famille (BdF) | 5-year | 2017 (2022 pending) |
| Norway | SSB Forbruksundersøkelsen (halted post-2012, replaced by tax-register-based estimates) | See notes | 2012+register imputation |
| Sweden | SCB Household Budget Survey (HUT) | Discontinued 2009; use register + partial surveys | Modeled |
| Finland | Statistics Finland Household Budget Survey | 5-year | 2022 |
| Switzerland | BFS Haushaltsbudgeterhebung (HABE) | Annual | 2022 |
| Japan | Statistics Japan Family Income and Expenditure Survey (FIES) | Annual | 2024 |

**Data quality tiers** to badge in the UI:
- **Tier A** (recent annual survey): US, UK, Japan, Switzerland, Finland
- **Tier B** (recent 5-year survey, interpolated): Germany, France
- **Tier C** (modeled from register data + partial surveys): Norway, Sweden

## Additional decisions needed as we go

These don't block starting the plan — I'll surface each one when it becomes relevant during the build:

1. **Household size adjustment** — do we equivalize necessity costs by OECD equivalence scale (adult = 1.0, additional adult = 0.5, child = 0.3)? Or per-adult? Or per-capita? Different scales change the P20/median ratio for necessities by ~15%.
2. **Debt service** — student loans dominate US at P20-P60 but not in Norway/Sweden (where higher ed is free). Should minimum student loan payments count as necessity? Recommend: **yes**, and flag it prominently for cross-country.
3. **Childcare** — need to decide whether the necessity applies only to households with children under 12, or is amortized across all households. Recommend: **applies only to affected households**, and show two views: "households with kids" and "all households."
4. **Healthcare OOP for the US specifically** — BLS CES undercounts by ~20% vs BEA PCE for healthcare. Should we scale up? Recommend: **use BLS CES as-is with a footnote**, since we're comparing within-country distributions and CES is the only source with distributional data.
5. **Voluntary savings floor** — is 10% of gross a "recommended" line to show on the discretionary-after-savings tile? Recommend: **yes, with a toggle and adjustable target** (default 15% per most retirement planning guidance).
6. **Age-adjusted necessities** — retirees have very different expenditure patterns. Should we show working-age vs retiree-age views? Recommend: **v2.1** — do all-ages first, then add life-stage filter.

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
- **Region selector** (when country supports it): US states + top metros, DE Länder
- **Voluntary savings target** (0% to 25%, default 15%)
- **Child-household toggle**: All households / With children under 12 / Without children

### Comparison mode expansion
- Add "Compare countries at same percentile" — pick a percentile, see discretionary income across all 9 countries side-by-side, with bars for gross → post-tax → post-necessity → post-savings

## Data acquisition plan

Fetch in this priority order:

1. **BLS Consumer Expenditure Survey 2024** by decile — [bls.gov/cex/tables](https://www.bls.gov/cex/tables.htm). This is the anchor dataset.
2. **BEA Regional Price Parities** — county, metro, state — [bea.gov/data/prices-inflation/regional-price-parities](https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area)
3. **OECD PPP** for all 9 countries — [OECD PPP dataset](https://data.oecd.org/conversion/purchasing-power-parities-ppp.htm)
4. **Destatis EVS + LWR** for Germany
5. **ONS LCF** for UK — [ons.gov.uk family spending](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure)
6. **Japan FIES** — [Statistics Bureau](https://www.stat.go.jp/english/data/kakei/)
7. **Switzerland HABE** — [BFS](https://www.bfs.admin.ch/)
8. **Finland Household Budget Survey** — Statistics Finland
9. **France Budget de Famille** — INSEE
10. **Norway + Sweden** register-based imputation (hardest — will require best-effort modeling)

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
