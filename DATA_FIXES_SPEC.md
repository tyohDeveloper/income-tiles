# Data Fixes Spec — v3/v4.1 known issues

## Priority list

### FIX 1 — Census growth calculation (Nominal vs Real confusion) — CRITICAL

**Bug:** Census ASEC values are already published in current-year real dollars (2024 report inflates all history to 2024 dollars). The dashboard's dual-growth calc then applies a deflator on top, producing wrong Real YoY numbers.

**Evidence:**
- Census 2023 median (in 2024 dollars) = $82,690
- Census 2024 median (in 2024 dollars) = $83,730
- Correct Real YoY = +1.26% (matches Census's own reported +1.3%)
- Current dashboard likely shows +1.6% or similar because it treats the values as nominal

**Fix approach:**
- Mark `census_asec.json` `price_basis: "real_2024"` (or the report's current-year base)
- Store the nominal-dollar series separately, sourced from historical Census reports
- Update the dual-growth calc: if source is Census, the "real" number is the direct YoY; the "nominal" number = real × cumulative inflation from base
- Test target: US 2024 P50 should show approximately "nominal +3.9% | real +1.3%"

### FIX 2 — Norway Section 8 P50 discretionary too high

**Bug:** NO Section 8 P50 discretionary appears artificially high because WID/DINA post-tax national income for Norway includes collective consumption + sovereign wealth fund attributable income (which is not household-spendable).

**Fix approach:**
- Subtract Norway's "collective consumption" share from the DINA post-tax figure
- Sources: [Norges Bank](https://www.norges-bank.no/) sovereign fund reports for the fund income component; OECD Government at a Glance for collective consumption
- Alternative simpler fix: use Norway's SSB household disposable income data (already in `no_expenditure.json`) as the discretionary base for Section 8, overriding WID for this country only
- Test target: NO P50 discretionary should land between DE and SE, not above them

### FIX 3 — Sweden Section 8 P90 non-monotone

**Bug:** SCB's top-decile averaging quirk causes SE P90 discretionary to appear below P80's implied discretionary — a mathematical impossibility.

**Fix approach:**
- SCB publishes decile disposable income; the top decile average is heavily skewed by the top 1%
- Interpolate a smooth monotone-increasing curve from P50 → P90 → P99 using WID's pretax percentile shape as a template
- Apply Sweden-specific tax rates to that curve
- Test target: SE P50 < SE P90 < SE P99 (strict monotonicity)

### FIX 4 — Germany P50 discretionary too low

**Bug:** DE P50 discretionary reads below $25k despite v3 EVS 2023 fix. Likely cause: OECD VAT (already partially incorporated in WID posttax) is being double-counted, or necessity floor is too high due to housing category miscategorization.

**Fix approach:**
- Audit `de_evs.json` categories: verify Wohnen (COICOP 04) housing isn't inflated by including inputted rent for owners at 100% (should be ~65% given ownership rate)
- Cross-check against Eurostat published median household disposable income for DE 2023: €26,846 (~$28,000 at 2023 PPP)
- Test target: DE P50 discretionary should land in $25-30k range

### FIX 5 — US top 0.001% band mean too low

**Bug:** US P99.999 band mean shows ~$173M vs earlier ~$300M estimate. Root cause: WID's published `top0001_share` is 2.23% which drives the band, but Forbes-derived top-10 subtraction pushes it below the intuitive range.

**Fix approach:**
- Verify the top-10 aggregate income is being subtracted correctly (should be ~$14-17B/yr for top 10)
- Cross-check with IRS SOI top-400 statistics (2018 filing year, most recent available)
- If numbers are actually correct, add a small explainer note: "P99.99 to top-10 band is ~10k US households (top 0.001% minus top 10); mean is dragged down by everyone below the billionaires."
- Also consider: the "top 10" list is only 10 people; the "P99.999 band" is ~3,300 US filers. Subtracting 10 from 3300 doesn't change the mean much. The confusion might be with the P99.99 band (~33k people).

### FIX 6 — Finland Forbes list only 7 entries

**Bug:** FI has only 7 Forbes billionaires, less than the 10 expected.

**Fix approach:**
- Not really a bug — Finland genuinely has fewer billionaires than most large economies
- UI change: relabel the tile as "Top N individuals" where N is min(10, actual_count), and note it in the tile subtitle
- Or: extend the FI list with the top 7 billionaires + 3 top earners from published sources (Finnish tax data is public; top earners are named publicly by the tax authority)
- Recommend the UI-label fix as simpler and more honest

## Approach

Do all 6 in one data subagent, one UI adjustment pass.

Data files to touch:
- `data/census_asec.json` (add proper nominal series or mark real_2024)
- `data/v4/inflation_deflators.json` (already exists, may need re-normalization)
- New `data/v3/norway_collective_consumption.json` (for FIX 2)
- New `data/v3/sweden_monotone_correction.json` (for FIX 3)
- `data/v2/de_evs.json` (audit + fix)
- Verify FIX 5 with computation only — likely no data change needed
- FIX 6 is UI-only

Code files to touch:
- `client/src/lib/incomeModel.ts` (growth-basis handling per source)
- `client/src/lib/crossCountry.ts` (NO override, SE monotone smoothing)
- `client/src/lib/v2Compute.ts` (DE necessity audit if needed)
- Tile label logic for FI Forbes count

## Test targets after fixes

- US 2024 P50: nominal +3.9%, real +1.3% (matches Census's reported +1.3%)
- NO P50 discretionary in Section 8: between DE and SE (not above)
- SE P50 < P90 < P99 (strict monotonicity)
- DE P50 discretionary in $25-30k PPP range
- US top-10 individuals tile: label reflects actual count, explainer footnote clean
- FI Forbes list: shows "Top 7" label with note

## Deliverables

- Committed data fixes with per-fix commit messages
- QA screenshots showing before/after for the four numerical fixes
- Return summary with what changed and any surprises
