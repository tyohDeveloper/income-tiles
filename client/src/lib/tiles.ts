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
