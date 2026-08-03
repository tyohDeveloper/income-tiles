# Income Tiles — Design Notes

## Confirmed decisions (from user)

1. **Income definitions**: All four toggleable — market, personal, disposable, plus source-native (BEA, CBO, DINA/WID).
2. **Unit of analysis**: Toggle between tax filer, household, equal-split adult (DINA convention). Default: equal-split adult (DINA).
3. **Format**: Interactive React/TypeScript web app.
4. **Geography + time**: Toggle between US historical (1979–present) and multi-country DINA (WID).
5. **SD tiles**: **Median ± k·MAD** (robust σ from median, scaled by 1.4826 to be Gaussian-comparable). NOT mean ± SD, which breaks on right-skewed distributions.

## Tile layout

### Reference thresholds (horizontal reference lines on charts)
- Federal poverty line (HHS 2026, household-size adjusted)
- 200% of poverty (near-poor threshold)
- Median

### Distribution tiles
- Median − 2 MAD (robust σ)
- Median − 1 MAD
- 20th, 40th, 60th, 80th percentiles (quintile cut points)
- Median + 1 MAD
- Median + 2 MAD
- Top 10, 5, 2, 1, 0.5, 0.1

### Each tile shows
- $ threshold at that cut point
- % of population at/above
- Share of total income captured above that point

### Outlier trim (per tile / global)
- Top-N exclusion (default off; slider 0 → 10,000)
- Income cap exclusion (default off; input field)
- Show recomputed median, MAD, tiles with trim applied

### Global toggles
- Income definition: Market / Personal / Disposable / DINA pre-tax / DINA post-tax
- Data source: BEA DPI / CBO / WID-DINA / Census ASEC
- Unit: Tax filer / Household / Equal-split adult
- Geography: US national / US state / Country (G7 via WID)
- Year: slider (availability varies)

## Future enhancement — discretionary income layers

**User request from 2026-08-03:** After taxes/Medicare/SS, toggle out necessities to show "spendable without budgeting."

### Layer waterfall
1. Gross income (BEA/CBO)
2. Minus federal income tax + FICA (SS 6.2% + Medicare 1.45%) + state income tax
3. Minus necessities: housing (shelter + utilities), food-at-home, healthcare OOP, transportation-for-work/commute
4. Discretionary — WITHOUT voluntary savings (401k, IRA, HSA, disability)
5. Discretionary — INCLUDING voluntary savings deducted

### Data sources needed
- BLS Consumer Expenditure Survey (CES) by decile/quintile
- Tax Foundation / IRS SOI for effective tax rates by percentile
- Vanguard How America Saves + BLS NCS for savings participation & rates

### Schema hooks (add now, populate later)
Add optional fields to each year record:
```json
{
  "expenditure_shares_by_decile": {
    "d1": {"housing": 0.32, "food_home": 0.14, "healthcare_oop": 0.09, "transport_work": 0.11, "voluntary_savings": 0.01},
    ...
  },
  "effective_tax_rates_by_percentile": {
    "p50": 0.18,
    "p90": 0.24,
    "p99": 0.31,
    ...
  }
}
```

UI toggle: "Discretionary layer: off / necessities-out / necessities+voluntary-savings-out"
Disable in v1 with tooltip "Coming soon — BLS CES integration"

## Future enhancement — GitHub repository

**User request from 2026-08-03:** Save the program code to a GitHub repository once v1 is stable.

- Target account: tyohdeveloper (user's personal GitHub, per knowledge wiki)
- Suggested repo name: `income-tiles` or `income-distribution-board`
- Include: source, /data JSON files, README with source citations & methodology, LICENSE (user preference TBD)
- Do NOT commit until user confirms v1 is stable and gives the go-ahead
- Use the github_mcp_direct connector to create the repo and push

---

## v1 build notes (added during implementation)

### Price-basis correction (important)
`data/README.md` describes the WID series as "local-currency **current-price**". That is wrong for the
files we hold. Evidence: WID US pretax mean for 1980 in the file is $51,208 per equal-split adult, while
nominal US national income per adult in 1980 was roughly $13.5k–13.9k. The ratio (~3.7×) equals the
1980→2023 CPI-U ratio, so the series is inflation-adjusted at roughly 2023 prices. The app therefore
labels WID as "Real, constant ≈ 2023 prices" and states the inference in the source-notes popover.

Price basis per source, as surfaced in the UI:

| Source | Price basis |
| --- | --- |
| Census ASEC | Nominal (current-year USD) |
| BEA | Nominal (current-year USD) |
| CBO | Real, constant 2021 USD |
| WID / DINA | Real, constant ≈ 2023 prices (inferred) |

### WID latest-year uprating
WID's 2024 values are a uniform uprating of 2023: median, P90, P99 and P99.9 all move by exactly
+1.167% and the Gini is identical. Every tile therefore shows the same year-over-year figure for
2024. This is a property of the source, not a bug; it is called out in the WID caveat.

### Coupling decision changed during build
The spec said to disable options that are invalid for the current source. Geography turned out to be
the exception: locking non-US countries made them unreachable from a Census or BEA selection (a
dead end). Geography is therefore never locked — picking a non-US country auto-switches the source to
WID and, if needed, the definition to pre-tax national. Definition, source and unit are still locked
where the loaded data genuinely cannot serve them.

### Not implemented in v1
- "Deduct necessities" / "Deduct voluntary savings" — rendered as disabled switches with a
  "Coming soon — needs BLS Consumer Expenditure Survey integration" tooltip.
- `tax_filer` unit — no loaded source publishes it; shown permanently locked.
- Country comparison is limited to WID selections (the only multi-country source).
- No URL state serialisation; no CSV export.
