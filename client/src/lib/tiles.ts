import {
  DerivedView,
  DistributionModel,
  GeoId,
  Provenance,
  TileValue,
  dollarTile,
  percentileTile,
} from './incomeModel';

export type TileKind = 'percentile' | 'sigma' | 'poverty';

export interface TileDef {
  id: string;
  label: string;
  caption: string;
  kind: TileKind;
  /** percentile tiles */
  p?: number;
  /** sigma tiles: median + k·σ_robust */
  k?: number;
  /** poverty tiles: multiple of the HHS guideline */
  mult?: number;
  info?: string;
  emphasis?: boolean;
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
      { id: 'p20', label: 'P20', caption: 'Bottom quintile ceiling', kind: 'percentile', p: 0.2 },
      { id: 'p40', label: 'P40', caption: 'Second quintile ceiling', kind: 'percentile', p: 0.4 },
    ],
  },
  {
    id: 'above',
    title: 'Above the median',
    hint: 'Upper quintile cut points and robust spread upward.',
    tiles: [
      { id: 'p60', label: 'P60', caption: 'Third quintile ceiling', kind: 'percentile', p: 0.6 },
      { id: 'p80', label: 'P80', caption: 'Top quintile floor', kind: 'percentile', p: 0.8 },
      { id: 'sigma1', label: 'Median + 1σ', caption: 'Robust σ from median', kind: 'sigma', k: 1, info: SIGMA_INFO },
      { id: 'sigma2', label: 'Median + 2σ', caption: 'Robust σ from median', kind: 'sigma', k: 2, info: SIGMA_INFO },
    ],
  },
  {
    id: 'tail',
    title: 'Top tail',
    hint: 'Entry thresholds for each top group, and the income each captures.',
    tiles: [
      { id: 'p90', label: 'Top 10%', caption: 'P90 threshold', kind: 'percentile', p: 0.9, emphasis: true },
      { id: 'p95', label: 'Top 5%', caption: 'P95 threshold', kind: 'percentile', p: 0.95 },
      { id: 'p98', label: 'Top 2%', caption: 'P98 threshold', kind: 'percentile', p: 0.98 },
      { id: 'p99', label: 'Top 1%', caption: 'P99 threshold', kind: 'percentile', p: 0.99, emphasis: true },
      { id: 'p995', label: 'Top 0.5%', caption: 'P99.5 threshold', kind: 'percentile', p: 0.995 },
      { id: 'p999', label: 'Top 0.1%', caption: 'P99.9 threshold', kind: 'percentile', p: 0.999 },
    ],
  },
];

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
}

export function computeTile(
  def: TileDef,
  view: DerivedView,
  povertyValue: number,
  prevView?: DerivedView | null,
  prevPoverty?: number
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
  return { ...cur, def, yoy, note };
}

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
