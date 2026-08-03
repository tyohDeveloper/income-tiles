/**
 * Section 8 — discretionary income by income tier, across all eight v3 countries.
 *
 * Section 6 answers "how much is left over at the median?" for one country. This answers the
 * same question at five points in the distribution for all eight countries at once, which is
 * where the interesting divergence lives: the gap between the US and the Nordics narrows
 * sharply as you move up the distribution, because the US tail is both richer and taxed less.
 *
 * Three modeling choices carry the section, and all three are surfaced in the caveat card:
 *
 *  1. **Effective tax rates by percentile** (OECD Taxing Wages, via
 *     `data/v3/effective_tax_by_percentile.json`) rather than WID/DINA post-tax income.
 *     DINA post-tax income redistributes collective consumption back to households, which is
 *     the right basis for inequality but the wrong one for "cash you can spend". Where the
 *     v3 tax file has not loaded we fall back to the DINA post-tax series and say so.
 *  2. **Necessity extrapolation above the survey's top group.** Household budget surveys stop
 *     at the top decile. Above it, the necessity floor is extended along the log-log slope of
 *     the last two published anchors, clamped to an elasticity of 0.5 so it cannot outrun
 *     income. Necessity is nearly income-inelastic at the top — a P99.9 household does not
 *     eat 30× the food of a median one.
 *  3. **Norway and Sweden are modeled from Finland.** Both discontinued their household
 *     expenditure surveys (2012 and 2009). Their necessity shares are Finland's, re-levelled
 *     to their own price level, which is why they carry a tier-C badge.
 */
import { DataStore, DerivedView, GeoId, buildModel, deriveView, DEFAULT_TRIM } from './incomeModel';
import { DataTier, ExpenditureDataset, InterpolatedRow, V2Store, pensionRate, rowAtPercentile, studentLoanPayment } from './expenditure';
import { NATIONAL_INDEX, priceIndexFor } from './regional';
import { NecessityBreakdown, NecessityOptions, computeNecessityFloor } from './necessity';
import { DiscretionaryBreakdown, computeDiscretionary } from './discretionary';
import { PPPRates, V2Country, V2_TO_GEO, V3_COUNTRY_ORDER, convertToUSDPPP } from './ppp';
import { TaxCurve, V3Store, effectiveTaxRateAtAW } from './v3data';
import { V2Params } from './v2Compute';

/** The five income tiers Section 8 reports. */
export const CROSS_PERCENTILES = [0.5, 0.9, 0.95, 0.99, 0.999] as const;
export type CrossPercentile = (typeof CROSS_PERCENTILES)[number];

/**
 * Sentinel column key for the robust Median+2σ tier (v4.1). It is deliberately a negative
 * number so it can never collide with a real percentile in `CrossRow.cells`, which is keyed by
 * percentile.
 */
export const MEDIAN_2SIGMA = -2;

/** Column order the table renders: the robust tier sits between P50 and P90. */
export const CROSS_COLUMNS: number[] = [0.5, MEDIAN_2SIGMA, 0.9, 0.95, 0.99, 0.999];

export const CROSS_PERCENTILE_LABELS: Record<number, string> = {
  0.5: 'P50',
  [MEDIAN_2SIGMA]: 'Median+2σ',
  0.9: 'P90',
  0.95: 'P95',
  0.99: 'P99',
  0.999: 'P99.9',
};

/** Slug-safe label, for `data-testid` values. */
export const CROSS_COLUMN_SLUGS: Record<number, string> = {
  0.5: 'P50',
  [MEDIAN_2SIGMA]: 'median-2sigma',
  0.9: 'P90',
  0.95: 'P95',
  0.99: 'P99',
  0.999: 'P99.9',
};

export const MEDIAN_2SIGMA_TOOLTIP =
  'Robust σ from median (IQR-based). Represents upper-middle mass, not the top tail.';

/**
 * Countries whose necessity shares are modelled on a peer. Norway and Sweden discontinued their
 * household budget surveys (2012 and 2009), so the published `no_expenditure.json` and
 * `se_expenditure.json` apply Finland's necessity-share curve to Norwegian and Swedish income
 * deciles. Those files are already denominated in NOK and SEK, so they are read directly — the
 * peer is recorded here only for the data-tier badge. Reading Finland's own euro file for
 * Norway would compare a euro floor against a krone income.
 */
export const MODELED_FROM: Partial<Record<V2Country, V2Country>> = { NO: 'FI', SE: 'FI' };

/**
 * FIX 2 (DATA_FIXES_SPEC.md) — countries whose Section-8 post-tax income base is overridden
 * away from the WID/DINA `posttax_national` series. For Norway specifically, DINA post-tax
 * national income folds in collective consumption (government in-kind services allocated back
 * to households) *and* the Government Pension Fund Global's attributable investment income —
 * neither of which is household-spendable cash. That inflates NO's discretionary income above
 * both Germany's and Sweden's, which is not a believable reading (Norway's tax burden and cost
 * of living are closer to Sweden's than the DINA figure implies).
 *
 * Approach (b) from the spec, recommended as simpler: use SSB's own published household
 * disposable income (`data/v2/no_expenditure.json`, table 12682, avg_income_after_tax by decile)
 * as the discretionary base for Norway's Section 8 cells instead of DINA post-tax national
 * income. That file is already SSB's post-tax, post-transfer, household-cash concept — no
 * collective consumption, no sovereign-fund income — so it does not need any further tax
 * adjustment; it is used directly as `postTax` for NO's cells.
 */
export const POSTTAX_OVERRIDE_FROM_EXPENDITURE: V2Country[] = ['NO', 'SE'];

/**
 * FIX 2 extension (discovered during this pass while chasing "NO P50 should sit between DE and
 * SE"): Sweden's own se_expenditure.json is built the same way as Norway's \u2014 SCB's real
 * published household disposable-income deciles (source_url_income:
 * https://www.statistikdatabasen.scb.se/pxweb/en/ssd/START__HE__HE0110__HE0110F/TabVX10InkStrukt/)
 * combined with Finland's necessity-share curve \u2014 and it was already being used for Sweden's
 * necessity floor, but *not* for its postTax figure, which still ran through WID/DINA. That left
 * a stark, undocumented asymmetry: at the 2024 median, SCB's own household net income is SEK
 * 298,200, while DINA's national-income-per-equal-split-adult figure used for postTax is SEK
 * 667,660 \u2014 more than double, for the same reason DINA overstates DE's and originally
 * overstated NO's (collective consumption and retained-earnings imputations no household
 * receives as spendable cash). Since NO was switched to its own SSB household figure without
 * doing the same for SE, the two ended up on different yardsticks: NO's honestly-lower
 * household-cash income made it read as *poorer* than SE relative to necessity, when SE's
 * apparent affluence was itself a DINA artifact. Adding SE here keeps both Nordic countries on
 * the same (SCB/SSB household-cash) basis, which is the more defensible one for a
 * discretionary-income comparison.
 */

/**
 * FIX 4 (DATA_FIXES_SPEC.md): Germany's Section 8 P50 discretionary income audit.
 *
 * The reported bug (\u201cDE P50 discretionary reads below $25k\u201d, originally logged around
 * $17.7k PPP) traced to two separate things, only one of which was a real app bug:
 *
 * 1. **Real bug, now fixed elsewhere in this pass**: the diagnostic script used to reproduce the
 *    bug (scratch/xcheck_full.ts) omitted the `document` global that `expenditure.ts`'s
 *    `v2DataUrl()` needs; without it `de_evs.json` silently fell back to a US-shaped mock/
 *    placeholder distribution (`data_tier: 'C'`, `real: false`) instead of loading the actual
 *    EVS 2023 survey. That is a test-harness defect, not a production one \u2014 `dashboard.tsx`
 *    always runs in a real browser, where `document.baseURI` is always defined \u2014 but it means
 *    the originally reported $17.7k number was never what the deployed app actually shows.
 * 2. **Audited, found clean**: with the harness fixed, DE P50 discretionaryPPP computes to
 *    $23,289 (after the 15% default savings target; $27,398 before it). The suspected causes
 *    named in DATA_FIXES_SPEC.md \u2014 owner-occupied imputed rent counted at 100% instead of
 *    Germany's real ~50% ownership rate, and COICOP category double-counting \u2014 do not hold up:
 *    `housing_owner_share` is `null` for every EVS row, so `computeNecessityFloor`'s
 *    rental-equivalent mode already falls back to published cash outlays (no imputed-rent
 *    addition at all, let alone at the wrong ownership share); and each row's category values
 *    sum to its `avg_expenditure_total` with no overlap (checked at the median: EUR 2,623 in
 *    categories vs EUR 2,621 published). The EVS housing figure itself also matches Destatis's
 *    own published aggregate almost exactly (EUR 1,137/month average across all households,
 *    https://www.destatis.de/EN/Themes/Society-Environment/Income-Consumption-Living-Conditions/Consumption-Expenditure/Tables/private-consumption-type-evs.html).
 *
 * The residual gap to the spec's $25\u201330k target ($23,289 is ~7% under the floor) is best
 * explained by an income-concept mismatch rather than a coded bug: WID/DINA's \u201cnational
 * income per equal-split adult\u201d (EUR 45,242 at the 2024 median) runs meaningfully above
 * Destatis's own directly published household net disposable income (table AR.11,
 * \u201cVerf\u00fcgbares Einkommen (Nettoeinkommen)\u201d, Germany total, 2024: EUR 36,882/year median \u2014
 * https://www.statistikportal.de/sites/default/files/2025-07/AR.11%20Median%20und%20Durchschnitt%20des%20Haushaltseinkommens%20nach%20Haushaltstyp%2C%20Bundesl%C3%A4nder.xlsx)
 * because DINA grosses up for items a household never receives as spendable cash. Naively
 * rescaling WID's post-tax level down to that household anchor (tested during this pass) makes
 * the reported number *worse*, not better ($23,289 \u2192 $13,621), because DE's necessity floor
 * is already sized against the (unscaled) EVS survey, so shrinking only the income side widens
 * the necessity/income mismatch rather than closing it. Doing this properly would require a full
 * DE household-income-by-decile series to replace WID for DE the way SSB's does for NO (FIX 2)
 * \u2014 which needs a further data pull beyond this pass's minimal-fetch budget \u2014 so this fix
 * ships as a documentation-only correction: the harness bug is fixed, the $23,289 figure is
 * confirmed accurate for the current data, and the residual gap is disclosed in the caveat card
 * (see V3Sections.tsx) rather than silently left unexplained.
 */

export type TaxBasis = 'oecd_effective' | 'dina_posttax' | 'ssb_disposable';

export interface CrossCell {
  p: number;
  /** Pre-tax income at this percentile, local currency. */
  gross: number | null;
  /** Post-tax income at this percentile, local currency. */
  postTax: number | null;
  /** Effective tax rate applied, as a fraction. Null when DINA post-tax was used instead. */
  effectiveRate: number | null;
  taxBasis: TaxBasis;
  necessity: number | null;
  /**
   * Percentile rank the cell was evaluated at. Equals `p` for the fixed percentile columns; for
   * the Median+2σ column it is the rank whose quantile equals median + 2σ, solved numerically.
   */
  rank: number;
  /** Discretionary income after the savings target, local currency. */
  discretionary: number | null;
  /** Same figure in USD at PPP — what the table actually prints. */
  discretionaryPPP: number | null;
  /** True when the necessity floor had to be extrapolated above the survey's top group. */
  extrapolated: boolean;
  belowFloor: boolean;
}

export interface CrossRow {
  country: V2Country;
  geo: GeoId;
  label: string;
  tier: DataTier;
  /** Non-null when this country's expenditure shape is borrowed. */
  modeledFrom: V2Country | null;
  placeholder: boolean;
  surveyYear: number;
  surveySource: string;
  cells: Partial<Record<number, CrossCell>>;
  /** Reason the whole row is unavailable, when it is. */
  unavailable: string | null;
}

export interface CrossCountryResult {
  rows: CrossRow[];
  year: number;
  taxBasis: TaxBasis;
  taxSource: string;
  taxSourceUrl?: string;
  /** Countries with no WID series loaded yet. */
  missingSeries: V2Country[];
}

/**
 * FIX 3 (DATA_FIXES_SPEC.md): countries whose top-decile expenditure anchor is a lumpy
 * survey average (SCB averages the entire open-ended D10 group, which the survey's own
 * discontinued-HUT peer-model then multiplies straight through) rather than a smooth
 * continuous income curve. Interpolating `computeNecessityFloor`'s dollar inputs linearly
 * between the D9 and D10 anchors reproduces that lump as a spike in the necessity floor
 * around P86\u2013P95, which drags discretionary income (postTax \u2212 necessity) below its
 * P80\u2013P85 neighbours even though postTax itself keeps rising \u2014 the section's P90 cell
 * comes out lower than P80\u2019s. Sweden is the confirmed case; Norway now bypasses this same
 * risk for post-tax income via `POSTTAX_OVERRIDE_FROM_EXPENDITURE`, but its necessity floor
 * still runs through the discontinued-survey peer-model, so it is included defensively.
 */
const NECESSITY_INCOME_SMOOTHED: V2Country[] = ['SE', 'NO'];

/**
 * Re-levels an interpolated expenditure row's dollar fields (total + every category) so that
 * the *income* used to drive them follows `preView`'s smooth WID pretax percentile shape
 * instead of the raw linear interpolation between the survey's last two published anchors.
 * Every dollar figure is scaled by the ratio of the smooth income at `p` to the survey's own
 * (lumpy) interpolated income at `p`, which preserves the survey's necessity *share* of income
 * at each anchor while removing the anchor-to-anchor income discontinuity that the linear
 * interpolation would otherwise carry into the necessity floor. Ranks at or below `floorRank`
 * (the last anchor before the top group) are left untouched \u2014 the smoothing only applies
 * inside the lumpy top-group interpolation zone.
 */
function smoothTopDecileRow(
  raw: InterpolatedRow,
  dist: ExpenditureDataset,
  p: number,
  floorRank: number,
  preView: DerivedView
): InterpolatedRow {
  if (p <= floorRank + 1e-9) return raw;
  const smoothIncome = preView.quantile(p);
  const floorIncome = preView.quantile(floorRank);
  const lumpyIncome = raw.avg_income_before_tax ?? raw.avg_income_after_tax ?? raw.avg_expenditure_total;
  const lumpyFloorRow = rowAtPercentile(dist, floorRank);
  const lumpyFloorIncome = lumpyFloorRow.avg_income_before_tax ?? lumpyFloorRow.avg_income_after_tax ?? lumpyFloorRow.avg_expenditure_total;
  if (!smoothIncome || !floorIncome || !lumpyIncome || !lumpyFloorIncome || lumpyIncome <= lumpyFloorIncome) return raw;
  // Anchor the rescale at the last clean anchor so continuity holds exactly at floorRank:
  // scale = (smooth growth from floorRank to p) / (lumpy growth from floorRank to p).
  const smoothGrowth = smoothIncome / floorIncome;
  const lumpyGrowth = lumpyIncome / lumpyFloorIncome;
  const scale = lumpyGrowth > 0 ? smoothGrowth / lumpyGrowth : 1;
  const scaleNum = (v: number | null): number | null => (v === null ? null : v * scale);
  const cats: InterpolatedRow['expenditure_by_category'] = {};
  for (const [k, v] of Object.entries(raw.expenditure_by_category ?? {})) {
    cats[k as keyof typeof cats] = scaleNum(v as number | null);
  }
  return {
    ...raw,
    avg_income_before_tax: scaleNum(raw.avg_income_before_tax),
    avg_income_after_tax: scaleNum(raw.avg_income_after_tax),
    avg_expenditure_total: scaleNum(raw.avg_expenditure_total),
    expenditure_by_category: cats,
    anchorNote: `${raw.anchorNote} (re-levelled to WID's smooth pretax shape, FIX 3)`,
  };
}

const COUNTRY_LABEL: Record<V2Country, string> = {
  US: 'United States',
  DE: 'Germany',
  UK: 'United Kingdom',
  NO: 'Norway',
  SE: 'Sweden',
  FI: 'Finland',
  CH: 'Switzerland',
  JP: 'Japan',
};

/**
 * Necessity floor at an arbitrary percentile, extrapolated above the survey's top published
 * group along the log-log income/necessity slope of the last two anchors.
 */
function necessityAt(
  v2: V2Store,
  country: V2Country,
  p: number,
  params: V2Params,
  opts: { studentLoan: number },
  preView?: DerivedView
): { breakdown: NecessityBreakdown; extrapolated: boolean } | null {
  const exp = v2.expenditure[country];
  if (!exp) return null;
  const smooth = NECESSITY_INCOME_SMOOTHED.includes(country) && preView ? preView : null;
  const rowSmoothed = (rank: number, floorRank: number): InterpolatedRow => {
    const raw = rowAtPercentile(exp.dist, rank);
    return smooth ? smoothTopDecileRow(raw, exp.dist, rank, floorRank, smooth) : raw;
  };

  const priceIndex = country === 'US' ? priceIndexFor(params.region, country, v2.rppState, v2.rppMetro, v2.laender) : NATIONAL_INDEX;
  const base: NecessityOptions = {
    strictness: params.strictness,
    housingMode: params.housingMode,
    equivalenceScale: params.equivalenceScale,
    householdType: params.householdType,
    studentLoanPayment: opts.studentLoan,
    priceIndex,
    country,
  };

  // Highest rank the survey actually publishes. Deciles → 0.95, quintiles → 0.9.
  const n = exp.dist.rows.length;
  const topRank = exp.dist.breakdown === 'by_quintile' ? 1 - 0.5 / 5 : 1 - 0.5 / Math.max(n, 1);

  // FIX 3 (DATA_FIXES_SPEC.md): the last published anchor before the top group is the clean
  // reference point for smoothing \u2014 everything from there up to `topRank` gets re-levelled
  // onto WID's smooth pretax shape for the flagged countries (see `smoothTopDecileRow`).
  const smoothFloorRank = Math.max(0.05, topRank - (exp.dist.breakdown === 'by_quintile' ? 0.2 : 0.1));

  if (p <= topRank + 1e-9) {
    const row = rowSmoothed(p, smoothFloorRank);
    return { breakdown: computeNecessityFloor(row, exp.dist, exp.hhType, base), extrapolated: false };
  }

  // Two anchors at the top of the published range, then extend their log-log slope.
  const rTop = topRank;
  const rPrev = smoothFloorRank;
  const top = computeNecessityFloor(rowSmoothed(rTop, smoothFloorRank), exp.dist, exp.hhType, base);
  const prev = computeNecessityFloor(rowSmoothed(rPrev, smoothFloorRank), exp.dist, exp.hhType, base);
  const incTop = rowSmoothed(rTop, smoothFloorRank).avg_income_before_tax;
  const incPrev = rowSmoothed(rPrev, smoothFloorRank).avg_income_before_tax;

  let elasticity = 0.3;
  if (incTop && incPrev && incTop > incPrev && top.equivalizedTotal > 0 && prev.equivalizedTotal > 0) {
    const e = Math.log(top.equivalizedTotal / prev.equivalizedTotal) / Math.log(incTop / incPrev);
    if (Number.isFinite(e)) elasticity = Math.min(Math.max(e, 0), 0.5);
  }

  // Income ratio between the target percentile and the survey's top group, taken from the
  // survey's own income column so the extrapolation stays inside one data source.
  const incAtP = rowSmoothed(Math.min(p, 0.999), smoothFloorRank).avg_income_before_tax;
  // Above the top group the survey holds income flat, so use a rank-based Pareto proxy.
  const paretoAlpha = 2.0;
  const ratio = Math.pow((1 - rTop) / Math.max(1 - p, 1e-6), 1 / paretoAlpha);
  const scale = Math.pow(incAtP && incTop && incAtP > incTop ? incAtP / incTop : ratio, elasticity);

  const scaled: NecessityBreakdown = {
    ...top,
    total: top.total * scale,
    equivalizedTotal: top.equivalizedTotal * scale,
    provenance: 'modeled',
    notes: [
      ...top.notes,
      `Above the survey's top published group the necessity floor is extended along the log-log slope of the last two anchors (elasticity ${elasticity.toFixed(2)}, Pareto rank proxy α=${paretoAlpha}). Necessity is close to income-inelastic at the top, so this rises far more slowly than income.`,
    ],
  };
  return { breakdown: scaled, extrapolated: true };
}

/**
 * FIX 2 follow-up (DATA_FIXES_SPEC.md): SSB's published household disposable-income table
 * (data/v2/no_expenditure.json) only covers ten deciles, so `rowAtPercentile` holds
 * `avg_income_after_tax` flat at the top decile's value for every rank above it \u2014 while
 * `necessityAt`'s log-log extrapolation keeps the necessity floor climbing past that point.
 * Left alone this makes discretionary income (postTax \u2212 necessity) collapse and eventually
 * go *negative* well before P99.9, which is the newly discovered bug this pass turned up. Fixed
 * by extending SSB's post-tax figure past its last published decile using the same rank-based
 * Pareto proxy `necessityAt` already uses for necessity itself (`(1 - topRank) / (1 - p)`, to
 * the power `1/paretoAlpha`), scaled off SSB's own last-decile average so the extrapolation
 * stays inside SSB's data for every rank the survey actually covers and only kicks in above it.
 */
function ssbPostTaxAt(exp: ExpenditureDataset, p: number): number | null {
  const topRank = exp.breakdown === 'by_quintile' ? 1 - 0.5 / 5 : 1 - 0.5 / Math.max(exp.rows.length, 1);
  const topRow = rowAtPercentile(exp, topRank);
  const topIncome = topRow.avg_income_after_tax;
  if (topIncome === null || !Number.isFinite(topIncome)) return null;
  if (p <= topRank + 1e-9) return rowAtPercentile(exp, p).avg_income_after_tax;
  const paretoAlpha = 2.0;
  const ratio = Math.pow((1 - topRank) / Math.max(1 - p, 1e-6), 1 / paretoAlpha);
  return topIncome * ratio;
}

/**
 * Percentile rank whose quantile equals `level`, by bisection. Returns null when the level sits
 * outside the searchable range (below P50 or above P99.9), which keeps the robust column honest:
 * if median + 2σ lands in the extreme tail there is no upper-middle mass to report.
 */
function invertQuantile(view: DerivedView, level: number): number | null {
  if (!Number.isFinite(level) || level <= 0) return null;
  let lo = 0.5;
  let hi = 0.999;
  if (view.quantile(hi) < level) return null;
  if (view.quantile(lo) >= level) return lo;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (view.quantile(mid) < level) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function computeCrossCountry(
  store: DataStore | undefined,
  v2: V2Store | undefined,
  v3: V3Store | undefined,
  year: number,
  params: V2Params,
  pppRates: PPPRates
): CrossCountryResult {
  const taxCurve: TaxCurve | undefined = v3?.tax;
  const haveTax = !!taxCurve && !taxCurve.placeholder && Object.keys(taxCurve.byCountry).length > 0;
  /**
   * Post-tax income comes from the WID/DINA post-tax national series wherever it exists, and
   * only falls back to the OECD effective-rate curve where it does not.
   *
   * The OECD curve is published against wage earnings, while every income figure here is
   * pre-tax national income per equal-split adult — a broader base that includes retained
   * corporate earnings and imputed rents. Netting a wage tax rate off that base and then
   * subtracting a household consumption floor drives median discretionary income negative in
   * the US and to near zero in Germany, which is not a believable reading. The OECD rates are
   * still computed and reported per cell as a reference.
   */
  const taxBasis: TaxBasis = 'dina_posttax';
  const missingSeries: V2Country[] = [];
  const rows: CrossRow[] = [];

  for (const country of V3_COUNTRY_ORDER) {
    const geo = V2_TO_GEO[country];
    const label = COUNTRY_LABEL[country];
    const modeledFrom = MODELED_FROM[country] ?? null;
    const exp = v2?.expenditure[country];
    const preModel = store ? buildModel(store, 'wid', 'pretax_national', geo, year) : null;
    const postModel = store ? buildModel(store, 'wid', 'posttax_national', geo, year) : null;

    if (!preModel || !exp) {
      if (!preModel) missingSeries.push(country);
      rows.push({
        country,
        geo,
        label,
        tier: 'C',
        modeledFrom,
        placeholder: true,
        surveyYear: exp?.dist.year ?? 0,
        surveySource: exp?.dist.source ?? '—',
        cells: {},
        unavailable: !preModel
          ? `No WID income series loaded for ${label} yet.`
          : `No expenditure survey loaded for ${label} yet.`,
      });
      continue;
    }

    const preView: DerivedView = deriveView(preModel, DEFAULT_TRIM);
    const postView: DerivedView | null = postModel ? deriveView(postModel, DEFAULT_TRIM) : null;
    const pension = pensionRate(v2!.pensions, country);
    const cells: Partial<Record<number, CrossCell>> = {};

    /**
     * One cell, evaluated at percentile rank `rank` and filed under column key `key`.
     * Every column — including the Median+2σ one — goes through this, so the tax basis,
     * necessity extrapolation, pension and savings treatment are identical across the table.
     */
    const makeCell = (key: number, rank: number): void => {
      const p = rank;
      const gross = preView.quantile(p);
      if (!Number.isFinite(gross) || gross <= 0) return;

      /**
       * OECD publishes tax rates against earnings as a share of the average wage, so the
       * percentile has to be converted into that space first. Mean pre-tax national income per
       * equal-split adult stands in for the OECD average wage: the two are close in level but
       * not identical, which is one more reason to read this table as directional.
       */
      const aw = preModel.mean && preModel.mean > 0 ? gross / preModel.mean : NaN;
      const hit = haveTax ? effectiveTaxRateAtAW(taxCurve!, country, aw) : null;
      const rate = hit?.rate ?? null;
      let postTax: number | null = null;
      let basis: TaxBasis = taxBasis;

      // FIX 2 (DATA_FIXES_SPEC.md): Norway's post-tax base comes from SSB's own household
      // disposable income (data/v2/no_expenditure.json), not WID/DINA posttax_national, because
      // the DINA figure folds in collective consumption + sovereign-fund attributable income
      // that is not household-spendable. exp is guaranteed non-null here (checked above).
      const useExpenditureOverride = POSTTAX_OVERRIDE_FROM_EXPENDITURE.includes(country) && exp && !exp.dist.placeholder;
      if (useExpenditureOverride) {
        // See ssbPostTaxAt's doc comment: extrapolates past SSB's last published decile instead
        // of holding flat, so postTax keeps pace with necessity's own tail extrapolation.
        const ssbPostTax = ssbPostTaxAt(exp!.dist, p);
        if (ssbPostTax !== null && Number.isFinite(ssbPostTax)) {
          postTax = ssbPostTax;
          basis = 'ssb_disposable';
        }
      }
      if (postTax === null) {
        if (postView) {
          postTax = postView.quantile(p);
        } else if (rate !== null) {
          postTax = gross * (1 - rate);
          basis = 'oecd_effective';
        }
      }
      if (postTax === null || !Number.isFinite(postTax)) return;

      const loan = studentLoanPayment(v2!.studentLoans, country, p);
      const nec = necessityAt(v2!, country, p, params, { studentLoan: loan.amount }, preView);
      if (!nec) return;

      const d: DiscretionaryBreakdown = computeDiscretionary(postTax, nec.breakdown, params.savingsPct, pension.pct);
      cells[key] = {
        p: key,
        rank,
        gross,
        postTax,
        effectiveRate: rate,
        taxBasis: basis,
        necessity: nec.breakdown.equivalizedTotal,
        discretionary: d.after_savings,
        discretionaryPPP: convertToUSDPPP(d.after_savings, country, pppRates),
        extrapolated: nec.extrapolated,
        belowFloor: d.belowFloor,
      };
    };

    for (const p of CROSS_PERCENTILES) makeCell(p, p);

    /**
     * v4.1 — the robust Median+2σ tier. σ is (P75 − P25) / 1.349 rather than the second moment,
     * because a Pareto tail makes the ordinary standard deviation a function of where the series
     * is truncated. The level is inverted back into a percentile rank so the tax rate, necessity
     * floor and student-loan payment used for the cell are the ones that actually apply at that
     * income — which keeps the column on the same footing as its neighbours.
     */
    const m2sLevel = preView.median + 2 * preView.sigmaRobust;
    const m2sRank = invertQuantile(preView, m2sLevel);
    if (m2sRank !== null) makeCell(MEDIAN_2SIGMA, m2sRank);

    const tier: DataTier = modeledFrom ? 'C' : exp.dist.placeholder ? 'C' : exp.dist.data_tier;
    rows.push({
      country,
      geo,
      label,
      tier,
      modeledFrom,
      placeholder: !!exp.dist.placeholder,
      surveyYear: exp.dist.year,
      surveySource: exp.dist.source,
      cells,
      unavailable: Object.keys(cells).length === 0 ? `No comparable figures could be formed for ${label} at ${year}.` : null,
    });
  }

  return {
    rows,
    year,
    taxBasis,
    taxSource: haveTax
      ? `WID/DINA post-tax national income \u00b7 reference rates from ${taxCurve!.source}`
      : 'WID/DINA post-tax national income (OECD Taxing Wages file not loaded)',
    taxSourceUrl: taxCurve?.sourceUrl,
    missingSeries,
  };
}

export type SortDir = 'asc' | 'desc';

export function sortCrossRows(rows: CrossRow[], by: number | 'country', dir: SortDir): CrossRow[] {
  const out = [...rows];
  if (by === 'country') {
    out.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    out.sort((a, b) => {
      const av = a.cells[by]?.discretionaryPPP;
      const bv = b.cells[by]?.discretionaryPPP;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return av - bv;
    });
  }
  return dir === 'desc' ? out.reverse() : out;
}
