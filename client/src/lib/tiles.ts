import {
  DerivedView,
  DistributionModel,
  GeoId,
  Provenance,
  TileValue,
  dollarTile,
  percentileTile,
} from './incomeModel';
import { BAND_TOOLTIP, BandMode, BandValue, TopListAggregate, computeBand } from './bands';
import { HouseholdSizeCountry, equivalentAdultFactor, householdSizeInBand, splitGrowth } from './v4data';

export type TileKind = 'percentile' | 'sigma' | 'poverty';

export interface TileDef {
  id: string;
  label: string;
  caption: string;
  kind: TileKind;
  /** percentile tiles */
  p?: number;
  /**
   * v3: upper edge of this tile's disjoint band. When set and band mode is on, the tile
   * headline is the mean income of people between `p` and `bandUpper` rather than the `p`
   * threshold. `1` means "up to the very top of the distribution".
   */
  bandUpper?: number;
  /**
   * v3: below-median tiles get the symmetric treatment — their band runs *downward* to
   * `bandLower` — so "P20" reads as the mean of the people between P20 and P40's floor.
   */
  bandLower?: number;
  /** Net a named top-N list out of this tile's band numerator (top band only). */
  subtractTopList?: boolean;
  /** sigma tiles: median + k·σ_robust */
  k?: number;
  /** poverty tiles: multiple of the HHS guideline */
  mult?: number;
  info?: string;
  emphasis?: boolean;
  /** Caption shown when band mode is on, replacing the threshold caption. */
  bandCaption?: string;
}

export interface TileSection {
  id: string;
  title: string;
  hint: string;
  tiles: TileDef[];
}

const SIGMA_INFO =
  'Robust σ from the median: σ = (P75 − P25) / (2 × 0.6745), the IQR-based estimator that equals 1.4826 × MAD for a Gaussian. Used instead of the mean and standard deviation because income is strongly right-skewed and the mean is dragged by the top tail.';

export const TILE_SECTIONS: TileSection[] = [
  {
    id: 'reference',
    title: 'Reference thresholds',
    hint: 'Fixed policy lines and the centre of the distribution.',
    tiles: [
      {
        id: 'poverty',
        label: 'Poverty line',
        caption: 'HHS 2026 guideline',
        kind: 'poverty',
        mult: 1,
        info: 'HHS Federal Poverty Guidelines for 2026 (ASPE). Administrative simplification of the Census poverty thresholds, used for programme eligibility. Same for every household of a given size regardless of age composition.',
      },
      {
        id: 'poverty200',
        label: '200% of poverty',
        caption: 'Near-poor / benefits cliff',
        kind: 'poverty',
        mult: 2,
        info: 'Twice the HHS guideline — the common eligibility ceiling for means-tested programmes and the usual definition of "near poor".',
      },
      {
        id: 'median',
        label: 'Median',
        caption: 'P50 — the middle unit',
        kind: 'percentile',
        p: 0.5,
        bandLower: 0.4,
        bandUpper: 0.6,
        bandCaption: 'P40–P60 band mean',
        emphasis: true,
        info: 'The 50th percentile of the selected source, definition, unit and year.',
      },
    ],
  },
  {
    id: 'below',
    title: 'Below the median',
    hint: 'Robust spread downward, plus the lower quintile cut points.',
    tiles: [
      { id: 'sigma-2', label: 'Median − 2σ', caption: 'Robust σ from median', kind: 'sigma', k: -2, info: SIGMA_INFO },
      { id: 'sigma-1', label: 'Median − 1σ', caption: 'Robust σ from median', kind: 'sigma', k: -1, info: SIGMA_INFO },
      { id: 'p20', label: 'P20', caption: 'Bottom quintile ceiling', kind: 'percentile', p: 0.2, bandLower: 0, bandUpper: 0.2, bandCaption: 'Bottom quintile band mean' },
      { id: 'p40', label: 'P40', caption: 'Second quintile ceiling', kind: 'percentile', p: 0.4, bandLower: 0.2, bandUpper: 0.4, bandCaption: 'P20–P40 band mean' },
    ],
  },
  {
    id: 'above',
    title: 'Above the median',
    hint: 'Upper quintile cut points and robust spread upward.',
    tiles: [
      { id: 'p60', label: 'P60', caption: 'Third quintile ceiling', kind: 'percentile', p: 0.6, bandLower: 0.6, bandUpper: 0.8, bandCaption: 'P60–P80 band mean' },
      { id: 'p80', label: 'P80', caption: 'Top quintile floor', kind: 'percentile', p: 0.8, bandLower: 0.8, bandUpper: 0.9, bandCaption: 'P80–P90 band mean' },
      { id: 'sigma1', label: 'Median + 1σ', caption: 'Robust σ from median', kind: 'sigma', k: 1, info: SIGMA_INFO },
      { id: 'sigma2', label: 'Median + 2σ', caption: 'Robust σ from median', kind: 'sigma', k: 2, info: SIGMA_INFO },
    ],
  },
  {
    id: 'tail',
    title: 'Top tail',
    hint: 'Entry thresholds for each top group, and the income each captures.',
    tiles: [
      { id: 'p90', label: 'Top 10%', caption: 'P90 threshold', kind: 'percentile', p: 0.9, bandUpper: 0.95, bandCaption: 'P90–P95 band mean', emphasis: true },
      { id: 'p95', label: 'Top 5%', caption: 'P95 threshold', kind: 'percentile', p: 0.95, bandUpper: 0.98, bandCaption: 'P95–P98 band mean' },
      { id: 'p98', label: 'Top 2%', caption: 'P98 threshold', kind: 'percentile', p: 0.98, bandUpper: 0.99, bandCaption: 'P98–P99 band mean' },
      { id: 'p99', label: 'Top 1%', caption: 'P99 threshold', kind: 'percentile', p: 0.99, bandUpper: 0.995, bandCaption: 'P99–P99.5 band mean', emphasis: true },
      { id: 'p995', label: 'Top 0.5%', caption: 'P99.5 threshold', kind: 'percentile', p: 0.995, bandUpper: 0.999, bandCaption: 'P99.5–P99.9 band mean' },
      { id: 'p999', label: 'Top 0.1%', caption: 'P99.9 threshold', kind: 'percentile', p: 0.999, bandUpper: 0.9999, bandCaption: 'P99.9–P99.99 band mean' },
    ],
  },
];

/**
 * Section 7 — the extreme tail. Split out of Section 3 and collapsed by default because
 * these bands are (a) thin enough that WID's own estimates carry real uncertainty and
 * (b) dominated by realized capital gains rather than anything resembling a salary.
 */
export const OUTLIER_SECTION: TileSection = {
  id: 'outliers',
  title: 'Outliers — the extreme tail',
  hint: 'The top hundredth of the top percent, and the ten largest individual incomes.',
  tiles: [
    {
      id: 'p9999',
      label: 'Top 0.01%',
      caption: 'P99.99 threshold',
      kind: 'percentile',
      p: 0.9999,
      bandUpper: 0.99999,
      bandCaption: 'P99.99–P99.999 band mean',
      emphasis: true,
      info: 'About 26,000 adults in the United States. WID extrapolates this cut point from tax-unit data with a Pareto tail, so treat it as an estimate with real uncertainty rather than a published count.',
    },
    {
      id: 'p99999',
      label: 'Top 0.001%',
      caption: 'P99.999 threshold',
      kind: 'percentile',
      p: 0.99999,
      bandUpper: 1,
      subtractTopList: true,
      bandCaption: 'P99.999 to the top, less the named top 10',
      emphasis: true,
      info: 'About 2,600 adults in the United States. In band mode the ten largest individual incomes are removed from this band and reported separately, so the figure is not simply ten people averaged with everyone else.',
    },
  ],
};

export const ALL_TILES: TileDef[] = TILE_SECTIONS.flatMap((s) => s.tiles);

export interface PovertyConfig {
  size: number;
  region: '48_contiguous_states_and_dc' | 'alaska' | 'hawaii';
}

export const POVERTY_REGIONS: { id: PovertyConfig['region']; label: string }[] = [
  { id: '48_contiguous_states_and_dc', label: '48 states' },
  { id: 'alaska', label: 'Alaska' },
  { id: 'hawaii', label: 'Hawaii' },
];

export interface ComputedTile extends TileValue {
  def: TileDef;
  /** % change versus the same tile one year earlier, or null */
  yoy: number | null;
  note?: string;
  /** v3: the disjoint-band reading, when this tile supports one. */
  band?: BandValue | null;
  /** v3: which reading the tile headline is showing. */
  reading: 'threshold' | 'band';
  /** v3: set when band mode was requested but the band could not be formed. */
  bandFellBack?: string;

  /* ------------------------------------------------------------------ v4.1 */

  /**
   * Head-count of people in the band (band reading) or at or above the threshold (threshold
   * reading). Population share × total resident population. Null when no population series
   * is available for the geography.
   */
  bandPopulation: number | null;
  /** Average household size across the band, interpolated from the decile profile. */
  avgHouseholdSize: number | null;
  /** Headline income divided by √(average household size) — the square-root equivalence scale. */
  perEquivalentAdult: number | null;
  /**
   * The two readings of the same growth rate. Exactly one of them is the measured change and
   * the other is derived by applying the selected deflator, depending on whether the underlying
   * series is published in nominal or constant prices.
   */
  nominalYoy: number | null;
  realYoy: number | null;
}

export interface TileComputeOptions {
  mode?: BandMode;
  /** Named top-N list to net out of the highest band. */
  topList?: TopListAggregate | null;
  population?: number;

  /* v4.1 */
  /** Total resident population of the geography in the tile's year. */
  totalPopulation?: number | null;
  /** Average household size by income decile for the geography. */
  householdSize?: HouseholdSizeCountry | null;
  /** Consumer-price inflation between the previous year and the tile's year, as a fraction. */
  inflation?: number | null;
  /** True when the income series is already published in constant prices (CBO, WID). */
  seriesIsReal?: boolean;
}

/** True when this tile definition can produce a disjoint band at all. */
export function supportsBand(def: TileDef): boolean {
  return def.kind === 'percentile' && typeof def.bandUpper === 'number';
}

export function computeTile(
  def: TileDef,
  view: DerivedView,
  povertyValue: number,
  prevView?: DerivedView | null,
  prevPoverty?: number,
  opts: TileComputeOptions = {}
): ComputedTile {
  const one = (v: DerivedView, pov: number): TileValue => {
    if (def.kind === 'percentile') return percentileTile(v, def.p!);
    if (def.kind === 'poverty') return dollarTile(v, pov * (def.mult ?? 1), 'published');
    const dollars = v.median + (def.k ?? 0) * v.sigmaRobust;
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return { p: 0, value: dollars, shareAbove: 1, pctAtOrAbove: 100, trimmedOut: false, provenance: 'interpolated' };
    }
    return dollarTile(v, dollars, 'interpolated');
  };

  const cur = one(view, povertyValue);
  let yoy: number | null = null;
  if (prevView) {
    const prev = one(prevView, prevPoverty ?? povertyValue);
    if (cur.value !== null && prev.value !== null && prev.value > 0 && cur.value > 0) {
      yoy = ((cur.value - prev.value) / prev.value) * 100;
    }
  }

  let note: string | undefined;
  if (def.kind === 'sigma' && cur.value !== null && cur.value <= 0) {
    note = 'Falls below zero — the robust spread exceeds the median at this skew.';
  }

  /* ---- v3: disjoint band reading ---- */
  const mode: BandMode = opts.mode ?? 'threshold';
  let band: BandValue | null = null;
  let bandFellBack: string | undefined;
  if (supportsBand(def)) {
    band = computeBand(view, def.bandLower ?? def.p!, def.bandUpper!, {
      topList: def.subtractTopList ? opts.topList ?? null : null,
      population: opts.population,
    });
    if (!band.ok) {
      bandFellBack = band.note;
      band = null;
    }
  } else if (mode === 'band' && def.kind === 'sigma') {
    bandFellBack =
      'Robust-σ tiles are defined as a dollar distance from the median, not as a percentile range, so they always read as a threshold.';
  } else if (mode === 'band' && def.kind === 'poverty') {
    bandFellBack = 'Policy lines are fixed dollar amounts, so they always read as a threshold.';
  }

  const reading: 'threshold' | 'band' = mode === 'band' && band ? 'band' : 'threshold';

  let bandYoy: number | null = yoy;
  if (reading === 'band' && prevView) {
    const prevBand = computeBand(prevView, def.bandLower ?? def.p!, def.bandUpper!, {
      topList: null,
      population: opts.population,
    });
    bandYoy =
      prevBand.ok && prevBand.mean !== null && prevBand.mean > 0 && band!.mean !== null
        ? ((band!.mean - prevBand.mean) / prevBand.mean) * 100
        : null;
  }

  /* ---- v4.1: population count, per-equivalent-adult income, dual growth ---- */

  const popShare = reading === 'band' ? band!.popShare : cur.shareAbove;
  const bandPopulation =
    opts.totalPopulation != null && popShare != null && Number.isFinite(popShare)
      ? opts.totalPopulation * popShare
      : null;

  // Rank range the tile covers: the band's own edges, or "this rank upward" for a threshold.
  const curRank: number = cur.p ?? def.p ?? 0.5;
  const lowerRank = reading === 'band' ? def.bandLower ?? def.p ?? curRank : curRank;
  const upperRank = (reading === 'band' ? def.bandUpper : 1) ?? 1;
  const avgHouseholdSize = opts.householdSize
    ? householdSizeInBand(opts.householdSize, lowerRank, upperRank)
    : null;

  const headline = reading === 'band' ? band!.mean : cur.value;
  const perEquivalentAdult =
    headline != null && Number.isFinite(headline) && avgHouseholdSize != null
      ? headline / equivalentAdultFactor(avgHouseholdSize)
      : null;

  // HHS poverty guidelines are published in current dollars, so a flat guideline is a flat
  // *nominal* line that loses ground in real terms — never a real-terms constant.
  const growthSeriesIsReal = def.kind === 'poverty' ? false : opts.seriesIsReal ?? false;
  const growth = splitGrowth(bandYoy, opts.inflation ?? null, growthSeriesIsReal);

  return {
    ...cur,
    def,
    yoy: bandYoy,
    note,
    band,
    reading,
    bandFellBack,
    bandPopulation,
    avgHouseholdSize,
    perEquivalentAdult,
    nominalYoy: growth.nominal,
    realYoy: growth.real,
  };
}

/** The number a tile card should print, given the active reading. */
export function tileHeadline(t: ComputedTile): number | null {
  return t.reading === 'band' ? t.band?.mean ?? null : t.value;
}

export function tileCaption(t: ComputedTile): string {
  return t.reading === 'band' ? t.def.bandCaption ?? 'Band mean' : t.def.caption;
}

export const BAND_QUALIFIER_TOOLTIP = BAND_TOOLTIP;

export function povertyGuideline(
  guidelines: Record<string, { by_household_size: Record<string, number>; additional_person_increment: number }>,
  cfg: PovertyConfig
): number {
  const g = guidelines[cfg.region];
  if (!g) return NaN;
  const direct = g.by_household_size[String(cfg.size)];
  if (direct) return direct;
  const base = g.by_household_size['8'];
  return base + (cfg.size - 8) * g.additional_person_increment;
}

export function provenanceLabel(p: Provenance): string {
  if (p === 'published') return 'Published';
  if (p === 'interpolated') return 'Interpolated';
  return 'Modeled';
}

export function provenanceDetail(p: Provenance, model: DistributionModel, geo: GeoId): string {
  if (p === 'published') return 'Taken directly from the publisher\u2019s own table.';
  if (p === 'interpolated')
    return 'Not published at this exact cut point — interpolated between published thresholds in probit / log-dollar space.';
  return model.modelNotes[0] ?? 'Reconstructed from published summary statistics.';
}

/* ==================================================================== v2 tiles

   Section 5 (necessity floor) and Section 6 (discretionary) sit below the v1 sections.
   Both read from the expenditure/necessity/discretionary modules rather than from the
   income distribution, so they carry their own computed-tile shape.
   ==================================================================== */

import { DiscretionaryBreakdown } from './discretionary';
import { V2Provenance } from './expenditure';
import { HH_TYPES, HouseholdTypeId } from './householdType';
import { NecessityBreakdown, Strictness } from './necessity';

export type V2TileKind = 'necessity_total' | 'necessity_component' | 'discretionary' | 'ratio' | 'savings';

export interface V2TileDef {
  id: string;
  label: string;
  caption: string;
  kind: V2TileKind;
  /** For necessity_component tiles: which keys of the breakdown to sum. */
  parts?: (keyof NecessityBreakdown)[];
  format: 'money' | 'percent';
  info?: string;
  emphasis?: boolean;
}

export interface V2TileSection {
  id: string;
  title: string;
  hint: string;
  tiles: V2TileDef[];
}

const EQUIV_INFO =
  'Shown relative to the average household: the household figure divided by the ratio of the selected household type\u2019s equivalence factor to the average household\u2019s, so it can be read directly against the WID/DINA per-equal-split-adult thresholds above. At the All households default the ratio is 1.';

export const V2_TILE_SECTIONS: V2TileSection[] = [
  {
    id: 'necessity',
    title: 'Necessity floor',
    hint: 'What the selected household must spend before anything is discretionary.',
    tiles: [
      {
        id: 'necessity-total',
        label: 'Necessity floor',
        caption: 'Total committed spending',
        kind: 'necessity_total',
        format: 'money',
        emphasis: true,
        info: `Sum of every category included at the current strictness level. ${EQUIV_INFO}`,
      },
      {
        id: 'necessity-housing',
        label: 'Housing floor',
        caption: 'Largest single component',
        kind: 'necessity_component',
        parts: ['housing'],
        format: 'money',
        info: `Shelter and utilities at the selected housing mode. ${EQUIV_INFO}`,
      },
      {
        id: 'necessity-healthcare',
        label: 'Healthcare floor',
        caption: 'Out-of-pocket only',
        kind: 'necessity_component',
        parts: ['healthcare'],
        format: 'money',
        info:
          'Out-of-pocket healthcare as published by the survey. BLS CES undercounts OOP healthcare by roughly 20% against BEA PCE; the bias is disclosed, not corrected.',
      },
      {
        id: 'necessity-food',
        label: 'Food + basics floor',
        caption: 'Food, communications, personal care',
        kind: 'necessity_component',
        parts: ['food', 'communications', 'personalCare'],
        format: 'money',
        info: `Food at home plus the food-away share allowed at this strictness, phone and broadband, and personal care. ${EQUIV_INFO}`,
      },
      {
        id: 'necessity-transport',
        label: 'Transport floor',
        caption: 'Work and essential travel',
        kind: 'necessity_component',
        parts: ['transport'],
        format: 'money',
        info: `Commuting and work-related vehicle costs. ${EQUIV_INFO}`,
      },
      {
        id: 'necessity-studentloans',
        label: 'Student loan floor',
        caption: 'Minimum required payment',
        kind: 'necessity_component',
        parts: ['studentLoans'],
        format: 'money',
        info:
          'In countries with tuition-free higher education (Norway, Sweden, Finland, Germany) this line is near zero — that is a real feature of the cross-country comparison, not a data gap.',
      },
      {
        id: 'necessity-childcare',
        label: 'Childcare floor',
        caption: 'Paid care for children under 12',
        kind: 'necessity_component',
        parts: ['childcare'],
        format: 'money',
        info:
          'Modeled from the country\u2019s net childcare cost (OECD) and the number of children needing paid care in the selected household type. In the all-households view it is amortized across households with no children.',
      },
    ],
  },
  {
    id: 'discretionary',
    title: 'Discretionary',
    hint: 'What is left after tax, after the necessity floor, and after the savings target.',
    tiles: [
      {
        id: 'disc-before',
        label: 'Discretionary income',
        caption: 'Before voluntary savings',
        kind: 'discretionary',
        format: 'money',
        emphasis: true,
        info: 'Post-tax income minus the equivalized necessity floor.',
      },
      {
        id: 'disc-after',
        label: 'After savings target',
        caption: 'Net of the voluntary savings rate',
        kind: 'savings',
        format: 'money',
        emphasis: true,
        info:
          'The savings target is applied to what is left after necessities. Mandatory pension contributions are already excluded from DINA post-tax income and are never subtracted twice.',
      },
      {
        id: 'disc-share',
        label: 'Discretionary share',
        caption: 'Percent of post-tax income',
        kind: 'ratio',
        format: 'percent',
        info: 'Discretionary income before voluntary savings, divided by post-tax income at the same percentile.',
      },
      {
        id: 'disc-savings',
        label: 'Voluntary savings',
        caption: 'Amount set aside at target rate',
        kind: 'discretionary',
        format: 'money',
        info: 'The dollar amount the savings-target slider removes at this income position.',
      },
    ],
  },
];

export interface ComputedV2Tile {
  def: V2TileDef;
  value: number | null;
  provenance: V2Provenance;
  /** Rendered as a small definition list under the headline value. */
  secondary: { label: string; value: string }[];
  note?: string;
  hidden?: boolean;
}

export interface V2TileContext {
  necessity: NecessityBreakdown;
  discretionary: DiscretionaryBreakdown;
  strictness: Strictness;
  householdType: HouseholdTypeId;
  studentLoanVisibility: 'auto' | 'always';
  fmt: (v: number | null) => string;
  fmtPercent: (v: number | null) => string;
}

export function computeV2Tile(def: V2TileDef, ctx: V2TileContext): ComputedV2Tile {
  const { necessity: n, discretionary: d } = ctx;
  const ef = n.equivalenceFactorValue || 1;
  const included = (key: keyof NecessityBreakdown): boolean => {
    if (ctx.strictness === 'minimal') return !['communications', 'personalCare', 'apparel', 'civic', 'entertainmentFloor'].includes(key as string);
    if (ctx.strictness === 'bls_basic') return !['apparel', 'civic', 'entertainmentFloor'].includes(key as string);
    return true;
  };

  let value: number | null = null;
  let hidden = false;
  let note: string | undefined;
  const secondary: { label: string; value: string }[] = [];

  if (def.kind === 'necessity_total') {
    value = n.equivalizedTotal;
    secondary.push({ label: 'Per household', value: ctx.fmt(n.total) });
    secondary.push({ label: 'Equivalence ratio', value: `÷ ${ef.toFixed(2)}` });
    secondary.push({ label: 'Share of post-tax', value: d.post_tax > 0 ? ctx.fmtPercent((n.equivalizedTotal / d.post_tax) * 100) : '—' });
  } else if (def.kind === 'necessity_component') {
    const parts = def.parts ?? [];
    const raw = parts.reduce((acc, k) => acc + (included(k) ? ((n[k] as number) ?? 0) : 0), 0);
    value = raw / ef;
    secondary.push({ label: 'Per household', value: ctx.fmt(raw) });
    secondary.push({
      label: 'Share of floor',
      value: n.total > 0 ? ctx.fmtPercent((raw / n.total) * 100) : '—',
    });
    if (def.id === 'necessity-studentloans' && raw <= 0.5) {
      hidden = ctx.studentLoanVisibility === 'auto';
      note = 'No measurable student-loan burden for this selection.';
    }
    if (def.id === 'necessity-childcare') {
      const meta = HH_TYPES[ctx.householdType];
      if (meta.childrenInCare <= 0) {
        hidden = true;
      } else if (ctx.householdType === 'all') {
        note = 'Amortized across all households — understates the cost for households with children by roughly 4×.';
      }
    }
  } else if (def.kind === 'ratio') {
    value = d.share_of_post_tax * 100;
    secondary.push({ label: 'Post-tax', value: ctx.fmt(d.post_tax) });
    secondary.push({ label: 'Necessity floor', value: ctx.fmt(d.necessity_total) });
  } else if (def.kind === 'savings') {
    value = d.after_savings;
    secondary.push({ label: 'Savings removed', value: ctx.fmt(d.voluntary_savings_amount) });
    secondary.push({
      label: 'Mandatory pension',
      value: d.mandatoryPensionPct === null ? '—' : `${d.mandatoryPensionPct.toFixed(1)}%`,
    });
  } else {
    value = def.id === 'disc-savings' ? d.voluntary_savings_amount : d.before_savings;
    if (def.id === 'disc-before') {
      secondary.push({ label: 'Post-tax', value: ctx.fmt(d.post_tax) });
      secondary.push({ label: 'Necessity floor', value: ctx.fmt(d.necessity_total) });
    } else {
      secondary.push({ label: 'Left after savings', value: ctx.fmt(d.after_savings) });
    }
  }

  if (d.belowFloor && (def.kind === 'discretionary' || def.kind === 'savings' || def.kind === 'ratio')) {
    note = 'Below the necessity floor — post-tax income at this percentile does not cover committed spending at this strictness.';
  }

  return { def, value, provenance: n.provenance, secondary, note, hidden };
}

export function v2ProvenanceLabel(p: V2Provenance): string {
  if (p === 'published') return 'Published';
  if (p === 'interpolated') return 'Interpolated';
  if (p === 'modeled') return 'Modeled';
  return 'Placeholder';
}
