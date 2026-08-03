/**
 * Disjoint percentile bands — the v3 default reading of every tile.
 *
 * v1 and v2 tiles reported a **threshold**: the dollar figure you must reach to be *at or
 * above* a percentile. That reading is correct but overlapping — "top 10%" contains "top
 * 1%", which contains the billionaires, so the headline number for the top 10% is dragged
 * around by people who are not in any ordinary sense in the top 10%.
 *
 * v3 reports a **band mean** instead: the average income of the people who sit between one
 * tile's percentile and the next tile up. The bands are non-overlapping and together they
 * partition the population, which is what most readers already assume a tile means.
 *
 *     band_mean = mean_income × (band_income_share / band_population_share)
 *
 * `band_income_share` comes from the pinned Lorenz curve, which is exact at every published
 * top-share anchor (WID publishes 10 / 5 / 1 / 0.1%, and the v3 pipeline adds 2 / 0.5 /
 * 0.01 / 0.001% where WID has them). Between anchors the share follows the integral of the
 * published percentile thresholds, so it never invents curvature the sources don't imply.
 *
 * The very top band is special: a named top-10 list (Forbes) is subtracted out of its
 * numerator, so the band reports the ~2,600 people between P99.999 and the top 10 rather
 * than being dominated by ten individuals. See `V3_BUILD_SPEC.md` §B.2.
 */
import { ADULT_POPULATION, DerivedView, DistributionModel, GeoId, Provenance } from './incomeModel';

/** Whether tiles read as an at-or-above threshold or as a disjoint band mean. */
export type BandMode = 'threshold' | 'band';

/** v3 default. Bands are the headline reading; thresholds stay one click away. */
export const DEFAULT_BAND_MODE: BandMode = 'band';

export const BAND_TOOLTIP =
  'Band mean: mean income of people between this tile\u2019s percentile and the next tile up. Non-overlapping with other tiles.';

export const THRESHOLD_TOOLTIP =
  'Threshold: the income you must reach to be at or above this percentile. Overlapping \u2014 everyone above a higher tile is also counted here.';

export interface TopListAggregate {
  /** How many named individuals the aggregate covers. */
  count: number;
  /** Their combined estimated annual income, in the distribution's local currency. */
  income: number;
  /** Attribution shown in the footnote, e.g. "Forbes Real-Time Billionaires, 2026-08-01". */
  label: string;
}

export interface BandOptions {
  /**
   * Named top-N list subtracted from the numerator of the highest band. Only applied when
   * the band's upper edge is the top of the distribution.
   */
  topList?: TopListAggregate | null;
  /** Adults in the universe; defaults to the built-in estimate for the geography. */
  population?: number;
}

export interface BandValue {
  lowerP: number;
  upperP: number;
  /** Mean income within the band, local currency. Null when it can't be computed. */
  mean: number | null;
  /** Dollar thresholds at the two edges, for the "$X to $Y" caption. */
  lowerThreshold: number | null;
  upperThreshold: number | null;
  /** Fraction of all income accruing to the band. */
  incomeShare: number | null;
  /** Fraction of the population inside the band. */
  popShare: number;
  provenance: Provenance;
  /** True when both edges land on published Lorenz anchors. */
  bothEdgesPublished: boolean;
  /** Set when a named top-N list was removed from this band. */
  subtracted: TopListAggregate | null;
  /** The band sits entirely above the active trim cut. */
  trimmedOut: boolean;
  /** Human-readable explanation, surfaced in the tile tooltip. */
  note: string;
  /** False when the caller must fall back to the threshold reading. */
  ok: boolean;
}

const EPS = 1e-12;

function anchorPublished(model: DistributionModel, p: number): boolean {
  return model.lorenzAnchors.some((a) => a.published && Math.abs(a.p - p) < 1e-9);
}

/**
 * Mean income of the population between `lowerP` and `upperP`.
 *
 * `upperP >= 1` means "up to the very top", which is the only case where a named top-N
 * list is netted out.
 */
export function computeBand(view: DerivedView, lowerP: number, upperP: number, opts: BandOptions = {}): BandValue {
  const { model, trim } = view;
  const hi = Math.min(upperP, 1);
  const popShareRaw = hi - lowerP;
  const base: BandValue = {
    lowerP,
    upperP: hi,
    mean: null,
    lowerThreshold: null,
    upperThreshold: null,
    incomeShare: null,
    popShare: popShareRaw,
    provenance: model.lorenzProvenance,
    bothEdgesPublished: false,
    subtracted: null,
    trimmedOut: false,
    note: '',
    ok: false,
  };

  if (!(popShareRaw > EPS)) {
    return { ...base, note: 'Band has no width \u2014 falling back to the threshold reading.' };
  }
  const mean = model.mean;
  if (mean === null || !(mean > 0)) {
    return { ...base, note: 'This source-year publishes no mean income, so a band mean cannot be formed.' };
  }
  if (trim.fraction > 0 && lowerP >= trim.keep - EPS) {
    return { ...base, trimmedOut: true, note: 'The whole band sits above the active trim cut.' };
  }

  const lowerThreshold = lorenzSafe(model.quantile, lowerP);
  const upperThreshold = hi >= 1 - EPS ? null : lorenzSafe(model.quantile, hi);

  let incomeShare = model.lorenz(hi) - model.lorenz(lowerP);
  let popShare = popShareRaw;
  let subtracted: TopListAggregate | null = null;
  const notes: string[] = [];

  const isTopBand = hi >= 1 - EPS;
  if (isTopBand && opts.topList && opts.topList.count > 0 && opts.topList.income > 0) {
    const population = opts.population ?? ADULT_POPULATION[model.geo as GeoId] ?? 0;
    const totalIncome = mean * population;
    if (population > 0 && totalIncome > 0) {
      const listPopShare = opts.topList.count / population;
      const listIncomeShare = opts.topList.income / totalIncome;
      if (listIncomeShare < incomeShare && listPopShare < popShare) {
        incomeShare -= listIncomeShare;
        popShare -= listPopShare;
        subtracted = opts.topList;
        notes.push(
          `The ${opts.topList.count} largest individual incomes (${opts.topList.label}) are removed from this band and reported separately, so the figure describes the rest of the band rather than ten people.`
        );
      } else {
        notes.push(
          `The named top-${opts.topList.count} list is larger than this band's modeled income share, so no subtraction was applied \u2014 read the band as an upper bound.`
        );
      }
    }
  }

  if (!(incomeShare > 0) || !(popShare > EPS)) {
    return { ...base, note: 'The published shares imply a non-positive band income \u2014 falling back to the threshold reading.' };
  }

  const bandMean = mean * (incomeShare / popShare);
  const bothEdgesPublished = anchorPublished(model, lowerP) && (isTopBand || anchorPublished(model, hi));
  const provenance: Provenance = bothEdgesPublished
    ? model.lorenzProvenance === 'published'
      ? 'published'
      : model.lorenzProvenance
    : model.lorenzProvenance === 'modeled'
      ? 'modeled'
      : 'interpolated';

  notes.unshift(
    `Band mean over ${fmtP(lowerP)}\u2013${fmtP(hi)} (${(popShare * 100).toPrecision(3)}% of adults, ${(incomeShare * 100).toPrecision(3)}% of income).`
  );
  if (!bothEdgesPublished) {
    notes.push('At least one band edge is not a published income-share anchor, so its share is interpolated along the published percentile thresholds.');
  }

  return {
    lowerP,
    upperP: hi,
    mean: bandMean,
    lowerThreshold,
    upperThreshold,
    incomeShare,
    popShare,
    provenance,
    bothEdgesPublished,
    subtracted,
    trimmedOut: trim.fraction > 0 && hi > trim.keep + EPS,
    note: notes.join(' '),
    ok: true,
  };
}

function lorenzSafe(q: (p: number) => number, p: number): number | null {
  const v = q(Math.min(Math.max(p, 1e-6), 1 - 1e-7));
  return Number.isFinite(v) ? v : null;
}

export function fmtP(p: number): string {
  if (p >= 1 - EPS) return 'top';
  const pct = p * 100;
  const s = pct.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  return `P${s}`;
}

/** "Top 0.001%" style label for the share of people above a percentile. */
export function topLabel(p: number): string {
  const pct = (1 - p) * 100;
  const s = pct < 0.001 ? pct.toExponential(0) : String(Number(pct.toFixed(4)));
  return `Top ${s}%`;
}
