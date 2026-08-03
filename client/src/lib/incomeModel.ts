/**
 * Source catalog, selection coupling rules, and the distribution model that every tile
 * and chart reads from.
 */
import {
  Anchor,
  IQR_TO_SIGMA,
  giniFromLorenz,
  integrateQuantile,
  invertQuantile,
  makeMonotoneSpline,
  makeQuantile,
  normInv,
  sigmaFromGini,
} from './stats';

/* ------------------------------------------------------------------ types */

export type SourceId = 'census' | 'bea' | 'cbo' | 'wid';
export type SourceChoice = SourceId | 'auto';
export type IncomeDef = 'market' | 'personal' | 'disposable' | 'pretax_national' | 'posttax_national';
export type UnitId = 'household' | 'tax_filer' | 'equal_split_adult';
export type GeoId = 'US' | 'CAN' | 'GBR' | 'DEU' | 'FRA' | 'JPN';

export interface RawYear {
  year: number;
  mean: number | null;
  median: number | null;
  gini: number | null;
  percentiles: Record<string, number | null> | null;
  top_shares: Record<string, number | null> | null;
  quintile_upper_limits?: Record<string, number | null> | null;
  quintile_mean_income?: Record<string, number | null> | null;
  quintile_shares_pct?: Record<string, number | null> | null;
  percentile_ratios?: Record<string, number | null> | null;
  inequality_ratios?: Record<string, number | null> | null;
  decile_income_shares?: Record<string, number | null> | null;
  quintile_averages?: Record<string, number | null> | null;
  top_group_averages?: Record<string, number | null> | null;
  mean_real_2017usd?: number | null;
  median_real_2017usd?: number | null;
}

export interface RawDataset {
  source: string;
  income_definition: IncomeDef;
  unit: string;
  geography: string;
  notes?: string;
  source_url?: string;
  years: RawYear[];
}

export interface RawBundle {
  source: string;
  geography?: string;
  unit?: string;
  source_url?: string;
  notes?: string;
  datasets?: RawDataset[];
  years?: RawYear[];
  income_definition?: IncomeDef;
}

export interface PovertyFile {
  source: string;
  source_url: string;
  notes: string;
  guidelines: Record<
    string,
    {
      geography: string;
      currency: string;
      year: number;
      by_household_size: Record<string, number>;
      additional_person_increment: number;
      note: string;
    }
  >;
}

/* -------------------------------------------------------------- catalog */

export const INCOME_DEFS: { id: IncomeDef; label: string; blurb: string }[] = [
  { id: 'market', label: 'Market income', blurb: 'Pre-tax, pre-transfer cash income (Census "money income", CBO market income).' },
  { id: 'personal', label: 'Personal income', blurb: 'BEA personal income — includes imputed and in-kind items from the national accounts.' },
  { id: 'disposable', label: 'Disposable income', blurb: 'BEA personal income less personal current taxes.' },
  { id: 'pretax_national', label: 'Pre-tax national (DINA)', blurb: 'National income before taxes, after pension/social-insurance operations.' },
  { id: 'posttax_national', label: 'Post-tax national (DINA)', blurb: 'National income after all taxes and transfers.' },
];

export const UNITS: { id: UnitId; label: string }[] = [
  { id: 'household', label: 'Household' },
  { id: 'tax_filer', label: 'Tax filer' },
  { id: 'equal_split_adult', label: 'Equal-split adult' },
];

export const GEOS: { id: GeoId; label: string; currency: string; locale: string }[] = [
  { id: 'US', label: 'United States', currency: 'USD', locale: 'en-US' },
  { id: 'CAN', label: 'Canada', currency: 'CAD', locale: 'en-CA' },
  { id: 'GBR', label: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { id: 'DEU', label: 'Germany', currency: 'EUR', locale: 'de-DE' },
  { id: 'FRA', label: 'France', currency: 'EUR', locale: 'fr-FR' },
  { id: 'JPN', label: 'Japan', currency: 'JPY', locale: 'ja-JP' },
];

export interface SourceMeta {
  id: SourceId;
  label: string;
  short: string;
  defs: IncomeDef[];
  geos: GeoId[];
  unit: UnitId;
  minYear: number;
  maxYear: number;
  url: string;
  basis: string;
  /** Price basis, shown alongside the year so nominal and real series are never confused. */
  prices: string;
  caveat?: string;
  /** One-line version of the caveat, shown in the headline strip. */
  headline: string;
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  census: {
    id: 'census',
    label: 'Census ASEC',
    short: 'Census',
    defs: ['market'],
    geos: ['US'],
    unit: 'household',
    minYear: 2000,
    maxYear: 2024,
    url: 'https://www.census.gov/library/publications/2025/demo/p60-286.html',
    headline: 'P10 and P90 are published for 2023\u20132024 only; earlier years are interpolated from quintile limits.',
    basis: 'Household money income',
    prices: 'Nominal (current-year USD)',
    caveat: 'P10/P90 and quintile shares published only for 2023–2024; earlier years interpolate from quintile limits.',
  },
  bea: {
    id: 'bea',
    label: 'BEA Personal Income',
    short: 'BEA',
    defs: ['personal', 'disposable'],
    geos: ['US'],
    unit: 'household',
    minYear: 2000,
    maxYear: 2024,
    url: 'https://www.bea.gov/data/special-topics/distribution-of-personal-income',
    headline: 'BEA publishes shares, not dollar thresholds \u2014 every threshold here is modeled.',
    basis: 'Equivalized household personal income',
    prices: 'Nominal (current-year USD)',
    caveat: 'BEA publishes no dollar percentile thresholds — thresholds here are modeled from published median + Gini.',
  },
  cbo: {
    id: 'cbo',
    label: 'CBO Household Income',
    short: 'CBO',
    defs: ['market', 'pretax_national', 'posttax_national'],
    geos: ['US'],
    unit: 'household',
    minYear: 1979,
    maxYear: 2021,
    url: 'https://www.cbo.gov/publication/60341',
    headline: '2021-vintage report in constant 2021 dollars; thresholds are modeled from group averages.',
    basis: 'Household income',
    prices: 'Real, constant 2021 USD',
    caveat: '2021-vintage report (1979–2021). Publishes group averages, not thresholds — thresholds are modeled from the published Lorenz points.',
  },
  wid: {
    id: 'wid',
    label: 'WID / DINA',
    short: 'WID',
    defs: ['pretax_national', 'posttax_national'],
    geos: ['US', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN'],
    unit: 'equal_split_adult',
    minYear: 1980,
    maxYear: 2024,
    url: 'https://wid.world/data/',
    headline: 'Inflation-adjusted local currency per equal-split adult \u2014 levels are not comparable across countries.',
    basis: 'Per equal-split adult, local currency',
    prices: 'Real, constant ≈ 2023 prices',
    caveat: 'Not household-equivalized and not currency-converted — cross-country levels are not directly comparable. The series is inflation-adjusted: 1980 US mean income here is ~3.7× the nominal national-accounts figure for that year, matching the 1980→2023 CPI ratio, so the bulk-file “current prices” note is treated as incorrect. The latest year is often a uniform uprating of the prior year, so every threshold can move by the identical percentage.',
  },
};

export const SOURCE_ORDER: SourceId[] = ['census', 'bea', 'cbo', 'wid'];

/* --------------------------------------------------------- file loading */

export function dataUrl(file: string): string {
  return new URL(`./data/${file}`, document.baseURI).toString();
}

const WID_FILES: Record<GeoId, string> = {
  US: 'wid_us.json',
  CAN: 'wid_can.json',
  GBR: 'wid_gbr.json',
  DEU: 'wid_deu.json',
  FRA: 'wid_fra.json',
  JPN: 'wid_jpn.json',
};

export const DATA_FILES = [
  'census_asec.json',
  'bea_national.json',
  'cbo_us.json',
  'poverty_2026.json',
  ...Object.values(WID_FILES),
];

export interface DataStore {
  census: RawBundle;
  bea: RawBundle;
  cbo: RawBundle;
  poverty: PovertyFile;
  wid: Record<GeoId, RawBundle>;
}

export async function loadAll(): Promise<DataStore> {
  const get = async (f: string) => {
    const res = await fetch(dataUrl(f));
    if (!res.ok) throw new Error(`Failed to load ${f} (${res.status})`);
    return res.json();
  };
  const [census, bea, cbo, poverty, ...wids] = await Promise.all([
    get('census_asec.json'),
    get('bea_national.json'),
    get('cbo_us.json'),
    get('poverty_2026.json'),
    ...(Object.keys(WID_FILES) as GeoId[]).map((g) => get(WID_FILES[g])),
  ]);
  const wid = {} as Record<GeoId, RawBundle>;
  (Object.keys(WID_FILES) as GeoId[]).forEach((g, i) => {
    wid[g] = wids[i];
  });
  return { census, bea, cbo, poverty, wid };
}

function datasetsOf(bundle: RawBundle | undefined): RawDataset[] {
  if (!bundle) return [];
  if (bundle.datasets) return bundle.datasets;
  if (bundle.years)
    return [
      {
        source: bundle.source,
        income_definition: bundle.income_definition as IncomeDef,
        unit: bundle.unit || 'household',
        geography: bundle.geography || 'US',
        source_url: bundle.source_url,
        notes: bundle.notes,
        years: bundle.years,
      },
    ];
  return [];
}

export function pickDataset(store: DataStore, source: SourceId, def: IncomeDef, geo: GeoId): RawDataset | undefined {
  const bundle = source === 'wid' ? store.wid[geo] : (store as any)[source];
  return datasetsOf(bundle).find((d) => d.income_definition === def);
}

/* --------------------------------------------------- coupling / validity */

export function sourceSupports(source: SourceId, def: IncomeDef, geo: GeoId, year?: number): boolean {
  const m = SOURCES[source];
  if (!m.defs.includes(def)) return false;
  if (!m.geos.includes(geo)) return false;
  if (year !== undefined && (year < m.minYear || year > m.maxYear)) return false;
  return true;
}

/** Auto-source priority: prefer the source that publishes real thresholds for the request. */
const AUTO_PRIORITY: Record<IncomeDef, SourceId[]> = {
  market: ['census', 'cbo'],
  personal: ['bea'],
  disposable: ['bea'],
  pretax_national: ['wid', 'cbo'],
  posttax_national: ['wid', 'cbo'],
};

export function resolveSource(choice: SourceChoice, def: IncomeDef, geo: GeoId, year: number): SourceId | null {
  if (choice !== 'auto') return sourceSupports(choice, def, geo, year) ? choice : null;
  const order = [...AUTO_PRIORITY[def], ...SOURCE_ORDER];
  for (const s of order) if (sourceSupports(s, def, geo, year)) return s;
  for (const s of order) if (sourceSupports(s, def, geo)) return s;
  return null;
}

export function yearRangeFor(source: SourceId): [number, number] {
  return [SOURCES[source].minYear, SOURCES[source].maxYear];
}

/* ------------------------------------------------------ distribution model */

const P_KEYS: { key: string; p: number }[] = [
  { key: 'p10', p: 0.1 },
  { key: 'p20', p: 0.2 },
  { key: 'p40', p: 0.4 },
  { key: 'p50', p: 0.5 },
  { key: 'p60', p: 0.6 },
  { key: 'p80', p: 0.8 },
  { key: 'p90', p: 0.9 },
  { key: 'p95', p: 0.95 },
  { key: 'p98', p: 0.98 },
  { key: 'p99', p: 0.99 },
  { key: 'p99_5', p: 0.995 },
  { key: 'p99_9', p: 0.999 },
];

export type Provenance = 'published' | 'interpolated' | 'modeled';

export interface LorenzPoint {
  p: number;
  cum: number;
  published: boolean;
}

export interface DistributionModel {
  source: SourceId;
  def: IncomeDef;
  geo: GeoId;
  year: number;
  unit: UnitId;
  mean: number | null;
  medianPublished: number | null;
  giniPublished: number | null;
  giniComputed: number;
  /** p-values whose dollar thresholds come straight from the publisher. */
  publishedPs: number[];
  thresholdProvenance: Provenance;
  lorenzProvenance: Provenance;
  quantile: (p: number) => number;
  lorenz: (p: number) => number;
  lorenzAnchors: LorenzPoint[];
  topShares: { top10: number | null; top5: number | null; top1: number | null; top01: number | null };
  bottom50Share: number;
  modelNotes: string[];
  raw: RawYear;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Some sources store shares as fractions (0.207) and others as percent (20.7). Normalise. */
function share(v: unknown): number | null {
  const n = num(v);
  if (n === null || n <= 0) return null;
  const f = n > 1 ? n / 100 : n;
  return f > 0 && f < 1 ? f : null;
}

/**
 * Lorenz curve pinned to every published anchor, with the shape *inside* each segment
 * taken from the integral of the quantile function. This keeps published shares exact
 * while giving the tail a realistic (not spline-smoothed) curvature.
 */
function pinnedLorenz(anchors: LorenzPoint[], q: (p: number) => number): (p: number) => number {
  const ps = new Set<number>([0, 1]);
  const N = 2000;
  for (let i = 0; i <= N; i++) ps.add(i / N);
  for (let i = 0; i <= 200; i++) ps.add(0.99 + (i / 200) * 0.01);
  anchors.forEach((a) => ps.add(a.p));
  const grid = Array.from(ps).sort((a, b) => a - b);

  const I: number[] = [0];
  let acc = 0;
  let prevP = grid[0];
  let prevQ = q(Math.max(prevP, 1e-6));
  for (let i = 1; i < grid.length; i++) {
    const p = grid[i];
    const cur = q(Math.min(Math.max(p, 1e-6), 1 - 1e-7));
    acc += ((prevQ + cur) / 2) * (p - prevP);
    prevP = p;
    prevQ = cur;
    I.push(acc);
  }
  const idxOf = new Map<number, number>();
  grid.forEach((p, i) => idxOf.set(p, i));

  const cum: number[] = new Array(grid.length).fill(0);
  for (let a = 0; a < anchors.length - 1; a++) {
    const a0 = anchors[a];
    const a1 = anchors[a + 1];
    const i0 = idxOf.get(a0.p)!;
    const i1 = idxOf.get(a1.p)!;
    const span = I[i1] - I[i0];
    for (let i = i0; i <= i1; i++) {
      const t = span > 0 ? (I[i] - I[i0]) / span : (grid[i] - a0.p) / (a1.p - a0.p || 1);
      cum[i] = a0.cum + (a1.cum - a0.cum) * Math.min(Math.max(t, 0), 1);
    }
  }
  for (let i = 1; i < cum.length; i++) if (cum[i] < cum[i - 1]) cum[i] = cum[i - 1];
  return makeMonotoneSpline(grid, cum);
}

/** Lorenz anchors from whichever income-share table a source publishes. */
function lorenzAnchorsFor(source: SourceId, y: RawYear): { anchors: LorenzPoint[]; provenance: Provenance; note?: string } {
  const anchors: LorenzPoint[] = [{ p: 0, cum: 0, published: false }];
  const push = (p: number, cum: number, published = true) => {
    if (Number.isFinite(cum) && cum >= 0 && cum <= 1) anchors.push({ p, cum, published });
  };

  const ts = y.top_shares || {};
  const addTop = (p: number, v: unknown) => {
    const s = share(v);
    if (s !== null) push(p, 1 - s);
  };

  let provenance: Provenance = 'published';
  let note: string | undefined;

  if (source === 'bea' && y.decile_income_shares) {
    const d = y.decile_income_shares;
    const order = ['0-10%', '10-20%', '20-30%', '30-40%', '40-50%', '50-60%', '60-70%', '70-80%', '80-90%'];
    let acc = 0;
    order.forEach((k, i) => {
      const s = share(d[k]);
      if (s !== null) {
        acc += s;
        push((i + 1) / 10, Math.min(acc, 1));
      }
    });
    note = 'Lorenz pinned to BEA published decile income shares.';
  } else if (source === 'cbo') {
    const qs = y.quintile_shares_pct;
    const qa = y.quintile_averages;
    if (qs && share(qs.q1) !== null) {
      let acc = 0;
      (['q1', 'q2', 'q3', 'q4'] as const).forEach((k, i) => {
        const s = share(qs[k]);
        if (s !== null) {
          acc += s;
          push((i + 1) / 5, Math.min(acc, 1));
        }
      });
      addTop(0.99, ts.top1_share);
      note = 'Lorenz pinned to CBO published quintile income shares plus the top-1% share.';
    } else if (qa) {
      const groups: [string, number][] = [
        ['q1', 0.2], ['q2', 0.2], ['q3', 0.2], ['q4', 0.2],
        ['p81_90', 0.1], ['p91_95', 0.05], ['p96_99', 0.04], ['top1', 0.01],
      ];
      let total = 0;
      groups.forEach(([k, w]) => {
        const v = num(qa[k]);
        if (v !== null) total += v * w;
      });
      if (total > 0) {
        let accP = 0;
        let accS = 0;
        groups.forEach(([k, w], i) => {
          const v = num(qa[k]);
          if (v !== null) {
            accP += w;
            accS += (v * w) / total;
            if (i < groups.length - 1) push(Math.min(accP, 1), Math.min(accS, 1));
          }
        });
        note = 'Lorenz pinned to CBO quintile and percentile-band average incomes.';
      }
    }
  } else if (source === 'census') {
    const qs = y.quintile_shares_pct;
    const qm = y.quintile_mean_income;
    if (qs && share(qs.q1) !== null) {
      let acc = 0;
      (['q1', 'q2', 'q3', 'q4'] as const).forEach((k, i) => {
        const s = share(qs[k]);
        if (s !== null) {
          acc += s;
          push((i + 1) / 5, Math.min(acc, 1));
        }
      });
      const t5 = share(qs.top5);
      if (t5 !== null) push(0.95, 1 - t5);
      note = 'Lorenz pinned to Census published quintile income shares and the top-5% share.';
    } else if (qm && num(qm.q1) !== null) {
      const keys = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;
      let total = 0;
      keys.forEach((k) => {
        const v = num(qm[k]);
        if (v !== null) total += v * 0.2;
      });
      if (total > 0) {
        let acc = 0;
        keys.forEach((k, i) => {
          const v = num(qm[k]);
          if (v !== null) {
            acc += (v * 0.2) / total;
            if (i < 4) push((i + 1) / 5, Math.min(acc, 1));
          }
        });
        const t5 = num(qm.top5);
        if (t5 !== null) push(0.95, Math.min(1 - (t5 * 0.05) / total, 1));
        note = 'Lorenz pinned to Census quintile mean incomes (shares not published for this year).';
        provenance = 'interpolated';
      }
    }
  } else {
    addTop(0.9, ts.top10_share);
    addTop(0.95, ts.top5_share);
    addTop(0.99, ts.top1_share);
    addTop(0.999, ts.top0_1_share);
    note = 'Lorenz pinned to WID published top 10 / 5 / 1 / 0.1% shares; the rest follows the published percentile thresholds.';
  }

  if (anchors.length <= 1) {
    provenance = 'modeled';
    note = 'No published income shares for this source-year — the Lorenz curve follows the modeled percentile thresholds.';
  } else if (anchors.length <= 3) {
    provenance = 'interpolated';
  }

  return { anchors: dedupe(anchors), provenance, note };
}

function dedupe(pts: LorenzPoint[]): LorenzPoint[] {
  const sorted = [...pts].sort((a, b) => a.p - b.p);
  const out: LorenzPoint[] = [];
  for (const pt of sorted) {
    if (!Number.isFinite(pt.cum)) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.p - pt.p) < 1e-9) {
      if (pt.published) out[out.length - 1] = pt;
      continue;
    }
    if (last && pt.cum < last.cum) pt.cum = last.cum;
    out.push(pt);
  }
  if (out.length === 0 || out[out.length - 1].p < 1) out.push({ p: 1, cum: 1, published: false });
  else out[out.length - 1] = { p: 1, cum: 1, published: out[out.length - 1].published };
  return out;
}

export function buildModel(
  store: DataStore,
  source: SourceId,
  def: IncomeDef,
  geo: GeoId,
  year: number
): DistributionModel | null {
  const ds = pickDataset(store, source, def, geo);
  if (!ds) return null;
  const y = ds.years.find((r) => r.year === year);
  if (!y) return null;

  const notes: string[] = [];
  const anchors: Anchor[] = [];
  const publishedPs: number[] = [];

  if (y.percentiles) {
    for (const { key, p } of P_KEYS) {
      const v = num(y.percentiles[key]);
      if (v !== null && v > 0) {
        anchors.push({ p, x: v });
        publishedPs.push(p);
      }
    }
  }
  if (anchors.length < 3 && y.quintile_upper_limits) {
    for (const [key, p] of [['p20', 0.2], ['p40', 0.4], ['p60', 0.6], ['p80', 0.8], ['p95', 0.95]] as [string, number][]) {
      const v = num(y.quintile_upper_limits[key]);
      if (v !== null && !publishedPs.includes(p)) {
        anchors.push({ p, x: v });
        publishedPs.push(p);
      }
    }
  }
  const medianPublished = num(y.median);
  if (medianPublished !== null && !publishedPs.includes(0.5)) {
    anchors.push({ p: 0.5, x: medianPublished });
    publishedPs.push(0.5);
  }

  let thresholdProvenance: Provenance = 'published';
  if (anchors.length < 3) {
    // No usable dollar thresholds — fit a lognormal.
    const gini = num(y.gini);
    const mean = num(y.mean);
    let sigma: number;
    let mu: number;
    if (gini !== null) {
      sigma = sigmaFromGini(gini);
      mu = medianPublished !== null ? Math.log(medianPublished) : Math.log(mean!) - (sigma * sigma) / 2;
      notes.push(
        medianPublished !== null
          ? 'Dollar thresholds modeled: lognormal fitted to the published median and Gini.'
          : 'Dollar thresholds modeled: lognormal fitted to the published mean and Gini.'
      );
    } else {
      // Derive a Gini from the published group averages, then fit.
      const tmp = lorenzAnchorsFor(source, y);
      const L = makeMonotoneSpline(tmp.anchors.map((a) => a.p), tmp.anchors.map((a) => a.cum));
      const gEst = giniFromLorenz(L);
      sigma = sigmaFromGini(gEst);
      mu = Math.log(mean ?? 1) - (sigma * sigma) / 2;
      notes.push('Dollar thresholds modeled: lognormal fitted to the published mean and a Gini derived from published group averages.');
    }
    anchors.length = 0;
    publishedPs.length = 0;
    for (const { p } of P_KEYS) anchors.push({ p, x: Math.exp(mu + sigma * normInv(p)) });
    thresholdProvenance = 'modeled';
  } else if (publishedPs.length < 8) {
    thresholdProvenance = 'interpolated';
    notes.push('Some percentiles are not published for this source-year; they are interpolated in probit / log-dollar space between published cut points.');
  }

  const quantile = makeQuantile(anchors);
  const { anchors: lAnchors, provenance: lorenzProvenance, note } = lorenzAnchorsFor(source, y);
  if (note) notes.push(note);
  const lorenz = pinnedLorenz(lAnchors, quantile);
  const giniComputed = giniFromLorenz(lorenz);

  const ts = y.top_shares || {};
  const topShares = {
    top10: share(ts.top10_share) ?? 1 - lorenz(0.9),
    top5: share(ts.top5_share) ?? 1 - lorenz(0.95),
    top1: share(ts.top1_share) ?? 1 - lorenz(0.99),
    top01: share(ts.top0_1_share) ?? 1 - lorenz(0.999),
  };

  return {
    source,
    def,
    geo,
    year,
    unit: SOURCES[source].unit,
    mean: num(y.mean),
    medianPublished,
    giniPublished: num(y.gini),
    giniComputed,
    publishedPs: Array.from(new Set(publishedPs)).sort((a, b) => a - b),
    thresholdProvenance,
    lorenzProvenance,
    quantile,
    lorenz,
    lorenzAnchors: lAnchors,
    topShares,
    bottom50Share: lorenz(0.5),
    modelNotes: notes,
    raw: y,
  };
}

/* ------------------------------------------------------------ trimming */

export type TrimMode = 'off' | 'topn' | 'cap';

export interface TrimConfig {
  mode: TrimMode;
  topN: number;
  universe: number;
  cap: number;
}

export const DEFAULT_TRIM: TrimConfig = { mode: 'off', topN: 0, universe: 132200000, cap: 1000000 };

export interface TrimResult {
  fraction: number;
  keep: number;
  capValue: number | null;
}

export function computeTrim(model: DistributionModel, trim: TrimConfig): TrimResult {
  if (trim.mode === 'off') return { fraction: 0, keep: 1, capValue: null };
  if (trim.mode === 'topn') {
    const f = trim.universe > 0 ? Math.min(trim.topN / trim.universe, 0.2) : 0;
    return { fraction: f, keep: 1 - f, capValue: f > 0 ? model.quantile(1 - f) : null };
  }
  const p = invertQuantile(model.quantile, trim.cap);
  const f = Math.max(0, Math.min(1 - p, 0.999));
  return { fraction: f, keep: 1 - f, capValue: trim.cap };
}

/* ----------------------------------------------------------- derived view */

export interface TileValue {
  /** Percentile of the *untrimmed* distribution this tile sits at (null for $-defined tiles). */
  p: number | null;
  value: number | null;
  shareAbove: number | null;
  pctAtOrAbove: number | null;
  trimmedOut: boolean;
  provenance: Provenance;
}

export interface DerivedView {
  model: DistributionModel;
  trim: TrimResult;
  median: number;
  sigmaRobust: number;
  p25: number;
  p75: number;
  quantile: (p: number) => number;
  /** cumulative income share below p, renormalised to the retained population */
  lorenzTrimmed: (p: number) => number;
  gini: number;
  ratios: { p90p10: number | null; p90p50: number | null; top10Bottom50: number | null };
}

export function deriveView(model: DistributionModel, trim: TrimConfig): DerivedView {
  const t = computeTrim(model, trim);
  const keep = t.keep;
  const q = (p: number) => model.quantile(Math.min(p * keep, 1 - 1e-7));
  const totalKept = model.lorenz(keep);
  const lorenzTrimmed = (p: number) => (totalKept > 0 ? Math.min(1, model.lorenz(Math.min(p * keep, 1)) / totalKept) : model.lorenz(p));
  const median = q(0.5);
  const p25 = q(0.25);
  const p75 = q(0.75);
  const sigmaRobust = (p75 - p25) * IQR_TO_SIGMA;
  const gini = t.fraction > 0 ? giniFromLorenz(lorenzTrimmed) : model.giniPublished ?? model.giniComputed;
  const p10 = q(0.1);
  const p90 = q(0.9);
  const top10 = 1 - lorenzTrimmed(0.9);
  const bottom50 = lorenzTrimmed(0.5);
  return {
    model,
    trim: t,
    median,
    sigmaRobust,
    p25,
    p75,
    quantile: q,
    lorenzTrimmed,
    gini,
    ratios: {
      p90p10: p10 > 0 ? p90 / p10 : null,
      p90p50: median > 0 ? p90 / median : null,
      top10Bottom50: bottom50 > 0 ? top10 / bottom50 : null,
    },
  };
}

/**
 * A tile defined by a percentile. Under a trim, the percentile is re-read against the
 * retained population; percentile groups that the trim removed entirely are flagged.
 */
export function percentileTile(view: DerivedView, p: number): TileValue {
  const { trim, model } = view;
  if (trim.fraction > 0 && p >= trim.keep - 1e-12) {
    return { p, value: null, shareAbove: null, pctAtOrAbove: null, trimmedOut: true, provenance: model.thresholdProvenance };
  }
  const value = view.quantile(p);
  const isPublished =
    trim.fraction === 0 &&
    model.thresholdProvenance !== 'modeled' &&
    model.publishedPs.some((x) => Math.abs(x - p) < 1e-9);
  return {
    p,
    value,
    shareAbove: 1 - view.lorenzTrimmed(p),
    pctAtOrAbove: (1 - p) * 100,
    trimmedOut: false,
    provenance: isPublished ? 'published' : model.thresholdProvenance === 'modeled' ? 'modeled' : 'interpolated',
  };
}

/** A tile defined by a dollar amount (poverty line, median ± k·σ, custom income). */
export function dollarTile(view: DerivedView, dollars: number, provenance: Provenance = 'published'): TileValue {
  const { trim } = view;
  if (trim.capValue !== null && dollars > trim.capValue) {
    return { p: null, value: dollars, shareAbove: null, pctAtOrAbove: null, trimmedOut: true, provenance };
  }
  const p = invertQuantile(view.quantile, dollars);
  return {
    p,
    value: dollars,
    shareAbove: 1 - view.lorenzTrimmed(p),
    pctAtOrAbove: (1 - p) * 100,
    trimmedOut: false,
    provenance,
  };
}

/* ------------------------------------------------------------ formatting */

export function currencyFor(geo: GeoId): { currency: string; locale: string } {
  const g = GEOS.find((x) => x.id === geo)!;
  return { currency: g.currency, locale: g.locale };
}

export function fmtMoney(v: number | null | undefined, geo: GeoId, opts?: { compact?: boolean }): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const { currency, locale } = currencyFor(geo);
  const negative = v < 0;
  const abs = Math.abs(v);
  const nf = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: opts?.compact && abs >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  });
  return (negative ? '−' : '') + nf.format(abs);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

export function fmtShare(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
