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
import { DataTier, V2Store, pensionRate, rowAtPercentile, studentLoanPayment } from './expenditure';
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

export type TaxBasis = 'oecd_effective' | 'dina_posttax';

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
  opts: { studentLoan: number }
): { breakdown: NecessityBreakdown; extrapolated: boolean } | null {
  const exp = v2.expenditure[country];
  if (!exp) return null;

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

  if (p <= topRank + 1e-9) {
    const row = rowAtPercentile(exp.dist, p);
    return { breakdown: computeNecessityFloor(row, exp.dist, exp.hhType, base), extrapolated: false };
  }

  // Two anchors at the top of the published range, then extend their log-log slope.
  const rTop = topRank;
  const rPrev = Math.max(0.05, topRank - (exp.dist.breakdown === 'by_quintile' ? 0.2 : 0.1));
  const top = computeNecessityFloor(rowAtPercentile(exp.dist, rTop), exp.dist, exp.hhType, base);
  const prev = computeNecessityFloor(rowAtPercentile(exp.dist, rPrev), exp.dist, exp.hhType, base);
  const incTop = rowAtPercentile(exp.dist, rTop).avg_income_before_tax;
  const incPrev = rowAtPercentile(exp.dist, rPrev).avg_income_before_tax;

  let elasticity = 0.3;
  if (incTop && incPrev && incTop > incPrev && top.equivalizedTotal > 0 && prev.equivalizedTotal > 0) {
    const e = Math.log(top.equivalizedTotal / prev.equivalizedTotal) / Math.log(incTop / incPrev);
    if (Number.isFinite(e)) elasticity = Math.min(Math.max(e, 0), 0.5);
  }

  // Income ratio between the target percentile and the survey's top group, taken from the
  // survey's own income column so the extrapolation stays inside one data source.
  const incAtP = rowAtPercentile(exp.dist, Math.min(p, 0.999)).avg_income_before_tax;
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
      if (postView) {
        postTax = postView.quantile(p);
      } else if (rate !== null) {
        postTax = gross * (1 - rate);
        basis = 'oecd_effective';
      }
      if (postTax === null || !Number.isFinite(postTax)) return;

      const loan = studentLoanPayment(v2!.studentLoans, country, p);
      const nec = necessityAt(v2!, country, p, params, { studentLoan: loan.amount });
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
