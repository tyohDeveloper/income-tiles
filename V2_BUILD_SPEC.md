# Income Tiles v2 — Build Spec

## What we're building

Extending the v1 dashboard with a **discretionary income layer** below post-tax. See `docs/v2-plan.md` for the full design decisions; this document is the actionable build spec.

## Prerequisites (READ THESE)

1. `docs/v2-plan.md` — every design decision confirmed by the user
2. `data/README.md` — v1 data conventions
3. `data/v2/README.md` — v2 data conventions (may not exist yet — data subagent is still running)
4. `client/src/lib/incomeModel.ts` — v1 model; extend, don't duplicate
5. `client/src/lib/tiles.ts` — v1 tile definitions; add new sections

## Phase 1 — SCAFFOLD (do this even before data arrives)

Build against a **mock expenditure data module** so UI is functional and testable. When real data lands under `data/v2/*.json`, only the data loader needs to swap.

### New library modules

1. **`client/src/lib/ppp.ts`**
   - Types: `PPPRates { [countryCode]: { lcu_per_usd_ppp: number, year: number } }`
   - Loader: `loadPPP()` — fetches `data/v2/oecd_ppp.json`
   - Converter: `convertToUSDPPP(amount, currency, ppp)` and `convertFromUSDPPP(...)`
   - Fallback rates hardcoded for the 8 countries (in case the file is missing during dev): US=1.0, DE=0.75, UK=0.71, NO=10.5, SE=9.8, FI=0.90, CH=1.15, JP=100.
   - Rates are LCU per USD-PPP at 2023 base per WID convention. Add comments citing source.

2. **`client/src/lib/expenditure.ts`**
   - Types matching the schema in `docs/v2-plan.md`:
     ```ts
     type ExpenditureRow = {
       group: string;                   // "d1"..."d10" or household-type slug
       avg_income_before_tax: number;
       avg_income_after_tax: number;
       avg_expenditure_total: number;
       expenditure_by_category: Record<CategoryKey, number>;
       housing_owner_share: number;
       housing_owner_imputed_rent_estimate: number | null;
     };
     type ExpenditureDataset = {
       source: string; country: string; year: number; unit: string;
       price_basis: string; data_tier: "A"|"B"|"C";
       breakdown: "by_decile"|"by_household_type"|"by_quintile";
       rows: ExpenditureRow[];
       source_url: string; notes: string;
     };
     type CategoryKey = "housing"|"food_at_home"|"food_away"|"healthcare_oop"|"transport_work"|"transport_total"|"apparel"|"communications"|"personal_care"|"education"|"childcare"|"voluntary_savings"|"entertainment"|"other";
     ```
   - Loader: `loadExpenditure(country)` — fetches `data/v2/{cc}_*.json` (index it via a manifest object)
   - Manifest of country → file mapping: US → us_ces_2024, DE → de_evs, UK → uk_lcf, JP → jp_fies, CH → ch_habe, FI → fi_hbs, NO → no_expenditure, SE → se_expenditure
   - Also load `us_scf_studentloans.json` and `oecd_pensions.json` at same time — separate cached queries
   - MOCK: while data doesn't exist, ship a `mockExpenditure(country)` function returning reasonable placeholder rows so UI renders. Placeholder US CES 2024 decile data from published aggregates: median household expenditure ~$77k, housing ~33%, transport ~17%, food ~13%, healthcare ~8%, etc. Cite BLS 2023 CES published tables as source for the placeholders.

3. **`client/src/lib/necessity.ts`**
   - `computeNecessityFloor(row: ExpenditureRow, opts: NecessityOptions): NecessityBreakdown`
   - `NecessityOptions`:
     ```ts
     type NecessityOptions = {
       strictness: "minimal"|"bls_basic"|"living_wage";
       housingMode: "cash"|"rental_equivalent";
       equivalenceScale: "sqrt"|"oecd_modified";
       householdSize: number;
       studentLoanPayment: number;  // annualized, from SCF lookup
       childcareIncluded: boolean;  // computed from householdType
     }
     ```
   - Returns:
     ```ts
     type NecessityBreakdown = {
       housing: number;
       food: number;
       healthcare: number;
       transport: number;
       childcare: number;
       studentLoans: number;
       communications: number;    // BLS basic + higher
       personalCare: number;      // BLS basic + higher
       apparel: number;           // living wage only
       civic: number;             // living wage only
       total: number;
       equivalizedTotal: number;  // total / equivalence_factor
     };
     ```
   - Strictness levels (which categories are included in `total`):
     - `minimal`: housing + food_at_home + healthcare + transport_work + childcare + student_loans
     - `bls_basic`: minimal + food_away (moderated) + communications + personal_care
     - `living_wage`: bls_basic + apparel + civic + entertainment_floor
   - Equivalence factor: sqrt → √hh_size, oecd_modified → 1.0 + 0.5*(adults-1) + 0.3*children

4. **`client/src/lib/discretionary.ts`**
   - `computeDiscretionary(postTaxIncome, necessity, savingsTargetPct, mandatoryPensionPct): DiscretionaryBreakdown`
   - Returns `{ post_tax, necessity_total, before_savings, voluntary_savings_amount, after_savings }`
   - Cross-country savings normalization: `voluntary_amount = (post_tax - necessity_total) * savingsTargetPct` — the mandatory pension is already excluded from post_tax in WID, so we don't double-subtract, we just note it in the UI

5. **`client/src/lib/householdType.ts`**
   - Household type enum + display names + assumed sizes/composition:
     ```ts
     const HH_TYPES = {
       all: { label: "All households", size: 2.5, adults: 1.7, children: 0.8 },
       single_working: { label: "Working-age single (25-64)", size: 1, adults: 1, children: 0 },
       couple_working: { label: "Working-age couple (25-64)", size: 2, adults: 2, children: 0 },
       kids_under12: { label: "Household with kids under 12", size: 4, adults: 2, children: 2 },
       kids_teens: { label: "Household with kids 12-18", size: 4, adults: 2, children: 2 },
       empty_nesters: { label: "Empty nesters (55+)", size: 2, adults: 2, children: 0 },
       retiree: { label: "Retiree (65+, no employment income)", size: 1.5, adults: 1.5, children: 0 },
     }
     ```
   - Function `getExpenditureRow(dataset, hhType)` — pick the closest matching row from a `by_household_type` dataset, or approximate from decile data

### New tiles (extend `client/src/lib/tiles.ts`)

Add two new sections to `TILE_SECTIONS`:

**Section 5 — Necessity Floor**
Each tile shows floor dollar amount at the current selection's chosen percentile:
- Necessity total (headline tile — larger)
- Housing floor
- Healthcare floor
- Food + basics floor
- Transport floor
- Student loan floor (hidden when zero unless `studentLoanVisibility="always"`)
- Childcare floor (only when household type includes children)

**Section 6 — Discretionary**
- Discretionary before voluntary savings (headline)
- Discretionary after voluntary savings at target rate
- Discretionary as % of post-tax income (ratio tile)
- Median voluntary savings amount at target rate

Provenance badges per v1: Published (survey published this directly) / Interpolated / Modeled / Placeholder (while using mock data).

### New sidebar controls (extend `ControlPanel.tsx`)

Add these below the existing "Discretionary layers" section (which currently has disabled toggles):

- **PPP toggle** — Switch. Default ON. Label: "Normalize with PPP".
- **Housing mode** — Radio (Cash / Rental equivalent). Default: Rental equivalent.
- **Necessity strictness** — Slider or 3-position segmented control (Minimal / BLS Basic / Living Wage). Default: BLS Basic.
- **Equivalence scale** — Radio (Square-root / OECD-modified). Default: Square-root. Include tooltip explaining.
- **Household type** — Select with 7 options from HH_TYPES. Default: All households.
- **Voluntary savings target** — Slider 0–25%, default 15%, with reference marks at 10 / 15 / 20 (visible ticks).
- **Region** — Select. Only enabled when country supports sub-national data (US → state + metros, DE → Länder). Default: None (national).

Remove the "Coming soon" disabled toggle group from v1 — it's now real.

### Header changes

- Add PPP indicator badge next to price-basis badge: "PPP-normalized (2023 base)" or "Local currency"
- When household type ≠ "all", show a chip: "View: Working-age couple" etc.

### Charts

Add a fourth chart panel: **"Discretionary waterfall"** — horizontal bar showing gross → post-tax → post-necessity → post-savings for the current selection. Reuse recharts' `BarChart` with a stacked layout.

Also, in **cross-country compare mode**: extend the existing Country compare so it shows the four bars (gross, post-tax, post-necessity, post-savings) side-by-side across selected countries at a fixed percentile.

## Phase 2 — DATA WIRING (do this once data subagent finishes)

The data subagent saves files under `data/v2/`. When those files exist:

1. Copy `data/v2/*.json` into `client/public/data/v2/` at build time (see how v1 does this)
2. Update `expenditure.ts` loader to point to real files instead of the mock function
3. Update `ppp.ts` to fetch `oecd_ppp.json` instead of hardcoded fallback rates
4. Read `data/v2/README.md` to check what's actually available and gracefully disable tiles/countries for missing data
5. Add data-tier badges (A/B/C) to the source-notes card per country

## Phase 3 — QA

Follow the same rigor as v1:

- Playwright screenshots at 1280×800, 1440×900, 1600×1000 desktop + 375×812 mobile
- Both dark and light themes
- Verify **US median 2024**: post-tax ~$67k → necessity (BLS Basic) ~$45k → discretionary ~$22k → after 15% savings ~$12k (rough ballpark from BLS CES aggregates)
- Verify **Germany median 2024 PPP**: post-tax ~$60k PPP → necessity (BLS Basic) ~$32k PPP → discretionary ~$28k PPP → after savings ~$19k PPP (rough — actual will depend on EVS data)
- Verify **all combinations of controls** don't produce impossible values (e.g., negative necessity, negative discretionary should render with an explicit "Below necessity floor" note, similar to how v1 handles negative σ tiles)
- Verify **household-type selector** actually changes the necessity numbers meaningfully (single-worker vs kids-under-12 should differ 2× or more in childcare + healthcare)
- Verify **PPP toggle** flip changes non-US numbers but not US numbers
- Verify **country compare** works with 2-4 countries selected

## Deploy

After QA, deploy same as v1:
```
deploy_website(project_path="/home/user/workspace/income-tiles/dist/public", site_name="income-tiles")
```

Do NOT commit to git — the parent agent will commit and push after reviewing.

## Constraints

- Preserve v1: every existing tile, chart, control, and behavior must continue to work
- No breaking changes to v1 URL state (there is no URL state yet, but any added URL state should be additive)
- Do not remove the "Coming soon" tooltip until real data is wired in — replace the whole disabled section only after Phase 2
- Keep the single-page, full-viewport, one-scroll-region layout from v1
- Tabular numerals for all $ values
- Dark mode first-class

## Deliverables

- All new modules and components under `client/src/lib/` and `client/src/components/dashboard/`
- Extended `dashboard.tsx` with new sections
- QA screenshots saved to `docs/v2-qa-screenshots/`
- Return a summary at completion listing what shipped, what was mocked, and what needs data-wiring in Phase 2
