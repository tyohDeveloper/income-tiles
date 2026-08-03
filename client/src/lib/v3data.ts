/**
 * v3 data layer.
 *
 * Everything here loads from `data/v3/` and is **optional**: the v3 pipeline runs on its own
 * schedule, so each loader returns `null` on a 404 and the UI degrades to a clearly-badged
 * placeholder rather than breaking. Two files (`non_monetary_benefits.json`,
 * `forbes_top10.json`) additionally ship a built-in fallback so Sections 7 and 9 render
 * structure — always flagged `placeholder: true`.
 *
 * The file shapes the pipeline emits are read tolerantly: country keys may arrive as ISO2
 * (`DE`), ISO3 (`DEU`) or a country name, values may be nested under `values` or written
 * flat on the row, and percentile keys may use `p99_99` or `p99.99`. Anything unrecognised
 * is skipped instead of throwing.
 */
import { DataStore, GeoId, GEOS } from './incomeModel';
import { DataTier } from './expenditure';
import { V2Country, V3_COUNTRY_ORDER } from './ppp';

/** The date the v3 data vintage was assembled. Shown as the "as of" date in Section 10. */
export const V3_AS_OF = '2026-08-03';

function v3Url(file: string): string {
  return new URL(`./data/v3/${file}`, document.baseURI).toString();
}

async function getV3<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(v3Url(file));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- country keys */

const ISO2_TO_V2: Record<string, V2Country> = {
  US: 'US', USA: 'US',
  DE: 'DE', DEU: 'DE',
  GB: 'UK', UK: 'UK', GBR: 'UK',
  NO: 'NO', NOR: 'NO',
  SE: 'SE', SWE: 'SE',
  FI: 'FI', FIN: 'FI',
  CH: 'CH', CHE: 'CH',
  JP: 'JP', JPN: 'JP',
};

const NAME_TO_V2: Record<string, V2Country> = {
  'united states': 'US',
  germany: 'DE',
  'united kingdom': 'UK',
  norway: 'NO',
  sweden: 'SE',
  finland: 'FI',
  switzerland: 'CH',
  japan: 'JP',
};

/** Resolve any country spelling the pipeline might emit to a v2 country code. */
export function asV2Country(raw: unknown): V2Country | null {
  if (typeof raw !== 'string' || !raw) return null;
  const up = raw.trim().toUpperCase();
  if (ISO2_TO_V2[up]) return ISO2_TO_V2[up];
  return NAME_TO_V2[raw.trim().toLowerCase()] ?? null;
}

const V2_TO_GEOID: Record<V2Country, GeoId> = {
  US: 'US', DE: 'DEU', UK: 'GBR', NO: 'NOR', SE: 'SWE', FI: 'FIN', CH: 'CHE', JP: 'JPN',
};

function asGeoId(raw: unknown): GeoId | null {
  if (typeof raw !== 'string') return null;
  const up = raw.trim().toUpperCase();
  if (GEOS.some((g) => g.id === up)) return up as GeoId;
  const v2 = asV2Country(raw);
  return v2 ? V2_TO_GEOID[v2] : null;
}

function rowCountry(row: Record<string, unknown>): unknown {
  return row.country ?? row.geo ?? row.country_code ?? row.iso ?? row.iso3 ?? row.country_name ?? row.group;
}

function nOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* ---------------------------------------------------- top-tail merge inputs */

interface GenericFile {
  source?: string;
  source_url?: string;
  data_tier?: DataTier;
  notes?: string | string[];
  as_of?: string;
  extracted?: string;
  snapshot_date?: string;
  vintage?: string;
  yield_assumption?: number;
  rows?: Record<string, unknown>[];
  /** The published files are keyed by country, not flat. See `rowsOf`. */
  countries?: unknown;
  /** The benefits file calls its row array `categories`. */
  categories?: Record<string, unknown>[];
}

/**
 * Normalise every shape the pipeline emits into a flat row list with a `country` field.
 *
 * The published v3 files are keyed by country: `{countries: {US: {years: […]}}}` for the WID
 * extracts, `{countries: {US: […entries]}}` for the Forbes list, and `{countries: {US: {…}}}`
 * for the tax table. A plain `rows` array is also accepted so a future flat export needs no
 * code change.
 */
function rowsOf(file: GenericFile | null): Record<string, unknown>[] {
  if (!file) return [];
  if (Array.isArray(file.rows)) return file.rows;
  const c = file.countries;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [];
  const out: Record<string, unknown>[] = [];
  for (const [code, val] of Object.entries(c as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      for (const item of val) if (item && typeof item === 'object') out.push({ country: code, ...(item as object) });
      continue;
    }
    if (!val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.years)) {
      for (const y of obj.years) if (y && typeof y === 'object') out.push({ country: code, ...(y as object) });
      continue;
    }
    out.push({ country: code, ...obj });
  }
  return out;
}

/** First non-empty string among a file's date-ish fields. */
function fileAsOf(file: GenericFile): string {
  return file.as_of || file.snapshot_date || file.extracted || file.vintage || V3_AS_OF;
}

/** Canonicalise a percentile key: "p99.99" / "P99_99" / "top0_01_threshold" → "p99_99". */
function canonPercentileKey(k: string): string | null {
  const m = /^p\s*([0-9]+(?:[._][0-9]+)?)/i.exec(k.replace(/_threshold$/i, ''));
  if (!m) return null;
  const digits = m[1].replace('.', '_');
  return `p${digits}`;
}

const TOPTAIL_KEYS = new Set(['p99_99', 'p99_999', 'p99_9999']);
const TOPSHARE_KEYS = new Set([
  'top10_share', 'top5_share', 'top2_share', 'top1_share',
  'top0_5_share', 'top0_1_share', 'top0_01_share', 'top0_001_share',
]);

/**
 * The published `wid_top_shares.json` drops the decimal separator (`top05_share` for the top
 * 0.5%, `top0001_share` for the top 0.001%), which is ambiguous without a lookup.
 */
const SHARE_ALIASES: Record<string, string> = {
  top05_share: 'top0_5_share',
  top01_share: 'top0_1_share',
  top001_share: 'top0_01_share',
  top0001_share: 'top0_001_share',
  top0_5_share: 'top0_5_share',
  top0_1_share: 'top0_1_share',
  top0_01_share: 'top0_01_share',
  top0_001_share: 'top0_001_share',
};

function canonShareKey(k: string): string | null {
  const norm = k.trim().toLowerCase().replace(/[.\s]/g, '_').replace(/_pct$/, '').replace(/^share_/, '');
  const withSuffix = norm.endsWith('_share') ? norm : `${norm}_share`;
  if (SHARE_ALIASES[withSuffix]) return SHARE_ALIASES[withSuffix];
  return TOPSHARE_KEYS.has(withSuffix) ? withSuffix : null;
}

/**
 * Merge v3 top-tail thresholds and top shares into the already-loaded WID bundles, so the
 * existing `buildModel` percentile/Lorenz machinery picks them up with no special-casing.
 * Returns the number of (geo, year) rows touched.
 */
export function mergeTopTail(store: DataStore, thresholds: GenericFile | null, shares: GenericFile | null): number {
  let touched = 0;
  const apply = (file: GenericFile | null, target: 'percentiles' | 'top_shares') => {
    for (const row of rowsOf(file)) {
      const geo = asGeoId(rowCountry(row));
      const year = nOrNull(row.year);
      if (!geo || year === null) continue;
      const bundle = store.wid[geo];
      if (!bundle?.datasets) continue;
      const defWanted = typeof row.income_definition === 'string' ? row.income_definition : 'pretax_national';
      for (const ds of bundle.datasets) {
        if (ds.income_definition !== defWanted) continue;
        const y = ds.years.find((r) => r.year === year);
        if (!y) continue;
        const bucket = (y[target] ??= {} as Record<string, number | null>);
        let wrote = false;
        for (const [k, v] of Object.entries(row)) {
          const val = nOrNull(v);
          if (val === null) continue;
          if (target === 'percentiles') {
            const ck = canonPercentileKey(k);
            if (ck && TOPTAIL_KEYS.has(ck)) {
              bucket[ck] = val;
              wrote = true;
            }
          } else {
            const ck = canonShareKey(k);
            if (ck) {
              bucket[ck] = val;
              wrote = true;
            }
          }
        }
        if (wrote) touched++;
      }
    }
  };
  apply(thresholds, 'percentiles');
  apply(shares, 'top_shares');
  return touched;
}

/* ----------------------------------------------------------------- outliers */

export interface ForbesEntry {
  rank: number;
  name: string;
  country: V2Country | null;
  countryLabel: string;
  wealthUSD: number | null;
  /** Estimated annual income = wealth × yield. */
  incomeUSD: number | null;
  source?: string;
}

export interface ForbesBundle {
  asOf: string;
  yieldPct: number;
  source: string;
  sourceUrl: string;
  entries: ForbesEntry[];
  /** Sum of `incomeUSD` across the list, USD. */
  aggregateIncomeUSD: number;
  placeholder: boolean;
}

/** Typical portfolio yield used to turn a wealth stock into an annual income flow. */
export const OUTLIER_YIELD_PCT = 4;

export const OUTLIER_FOOTNOTE =
  'Estimated annual income = Forbes wealth \u00d7 4% typical portfolio yield. Not IRS-reported. Actual realized income can differ dramatically year-to-year.';

const FORBES_FALLBACK: ForbesBundle = {
  asOf: V3_AS_OF,
  yieldPct: OUTLIER_YIELD_PCT,
  source: 'Placeholder \u2014 awaiting data/v3/forbes_top10.json',
  sourceUrl: 'https://www.forbes.com/real-time-billionaires/',
  entries: [],
  aggregateIncomeUSD: 0,
  placeholder: true,
};

export function parseForbes(file: GenericFile | null): ForbesBundle {
  const rows = rowsOf(file);
  if (!file || rows.length === 0) return FORBES_FALLBACK;
  const rawYield = nOrNull((file as Record<string, unknown>).yield_pct) ?? nOrNull(file.yield_assumption);
  // The published file states the yield as a fraction (0.04); a percent is also accepted.
  const yieldPct = rawYield === null ? OUTLIER_YIELD_PCT : rawYield <= 1 ? rawYield * 100 : rawYield;
  const entries: ForbesEntry[] = rows
    .map((r, i) => {
      const wealth =
        nOrNull(r.wealth_usd) ?? nOrNull(r.net_worth_usd) ?? nOrNull(r.wealth) ?? nOrNull(r.net_worth) ?? null;
      const wealthUSD = wealth !== null && wealth < 10_000 ? wealth * 1e9 : wealth; // billions → dollars
      const income =
        nOrNull(r.est_annual_income_usd) ??
        nOrNull(r.est_income_usd) ??
        nOrNull(r.estimated_annual_income_usd) ??
        nOrNull(r.income_usd) ??
        (wealthUSD !== null ? wealthUSD * (yieldPct / 100) : null);
      const c = asV2Country(rowCountry(r));
      return {
        rank: nOrNull(r.rank) ?? i + 1,
        name: typeof r.name === 'string' ? r.name : `#${i + 1}`,
        country: c,
        countryLabel: typeof r.country_name === 'string' ? r.country_name : (c ?? '\u2014'),
        wealthUSD,
        incomeUSD: income,
        source: typeof r.source_of_wealth === 'string' ? r.source_of_wealth : typeof r.source === 'string' ? r.source : undefined,
      };
    })
    .sort((a, b) => (a.country ?? '').localeCompare(b.country ?? '') || a.rank - b.rank);
  return {
    asOf: fileAsOf(file),
    yieldPct,
    source: file.source ?? 'Forbes Real-Time Billionaires',
    sourceUrl: file.source_url ?? 'https://www.forbes.com/real-time-billionaires/',
    entries,
    aggregateIncomeUSD: entries.reduce((s, e) => s + (e.incomeUSD ?? 0), 0),
    placeholder: false,
  };
}

/**
 * The named list for one country, plus its combined estimated income. The published file
 * carries all eight countries; every consumer wants exactly one of them.
 */
export function forbesFor(
  bundle: ForbesBundle,
  country: V2Country | null
): { entries: ForbesEntry[]; aggregateIncomeUSD: number } {
  const entries = country ? bundle.entries.filter((e) => e.country === country) : bundle.entries;
  return { entries, aggregateIncomeUSD: entries.reduce((s, e) => s + (e.incomeUSD ?? 0), 0) };
}

/* ------------------------------------------------ effective tax by earnings level */

export interface TaxAnchor {
  /** Earnings as a multiple of the national average wage. 1.0 = the OECD average worker. */
  aw: number;
  /** Effective tax rate as a fraction of gross earnings. */
  rate: number;
  /** True where the pipeline extrapolated the anchor rather than reading it from OECD. */
  extrapolated: boolean;
}

export interface TaxCurve {
  source: string;
  sourceUrl?: string;
  dataTier: DataTier;
  /** country → anchors sorted by average-wage multiple. */
  byCountry: Partial<Record<V2Country, TaxAnchor[]>>;
  placeholder: boolean;
}

const TAX_FALLBACK: TaxCurve = {
  source: 'Placeholder \u2014 awaiting data/v3/effective_tax_by_percentile.json',
  sourceUrl: 'https://www.oecd.org/tax/taxing-wages/',
  dataTier: 'C',
  byCountry: {},
  placeholder: true,
};

/**
 * OECD Taxing Wages is published against **earnings as a percent of the average wage**, not
 * against income percentiles: the columns are 67, 100, 167 and 250% AW. The curve is therefore
 * stored in average-wage space, and the caller converts a percentile to an AW multiple using
 * the country's own mean income before looking a rate up.
 */
export function parseTaxCurve(file: GenericFile | null): TaxCurve {
  const rows = rowsOf(file);
  if (!file || rows.length === 0) return TAX_FALLBACK;
  const byCountry: TaxCurve['byCountry'] = {};
  for (const r of rows) {
    const c = asV2Country(rowCountry(r));
    if (!c) continue;
    const list = (byCountry[c] ??= []);
    const table = (r.effective_tax_pct_of_gross_wage ?? r.effective_tax_pct ?? r.rates) as
      | Record<string, unknown>
      | undefined;
    const flags = (r.extrapolated ?? {}) as Record<string, unknown>;
    if (table && typeof table === 'object') {
      for (const [k, v] of Object.entries(table)) {
        const pct = Number(String(k).replace(/[^0-9.]/g, ''));
        const val = nOrNull(v);
        if (!Number.isFinite(pct) || pct <= 0 || val === null) continue;
        list.push({ aw: pct / 100, rate: val > 1 ? val / 100 : val, extrapolated: flags[k] === true });
      }
      continue;
    }
    // One row per (country, earnings level).
    const awDirect = nOrNull(r.aw_multiple) ?? nOrNull(r.pct_of_average_wage);
    const rateDirect =
      nOrNull(r.effective_rate_pct) ?? nOrNull(r.effective_tax_rate_pct) ?? nOrNull(r.effective_rate) ?? nOrNull(r.rate);
    if (awDirect !== null && rateDirect !== null) {
      list.push({
        aw: awDirect > 10 ? awDirect / 100 : awDirect,
        rate: rateDirect > 1 ? rateDirect / 100 : rateDirect,
        extrapolated: r.extrapolated === true,
      });
    }
  }
  for (const c of Object.keys(byCountry) as V2Country[]) byCountry[c]!.sort((a, b) => a.aw - b.aw);
  return {
    source: file.source ?? 'OECD Taxing Wages',
    sourceUrl: file.source_url ?? 'https://www.oecd.org/tax/taxing-wages/',
    dataTier: file.data_tier ?? 'B',
    byCountry,
    placeholder: false,
  };
}

/**
 * Effective tax rate at a given multiple of the average wage, linearly interpolated between
 * the published anchors and held flat outside them.
 */
export function effectiveTaxRateAtAW(
  curve: TaxCurve,
  country: V2Country,
  aw: number
): { rate: number; extrapolated: boolean } | null {
  const anchors = curve.byCountry[country];
  if (!anchors || anchors.length === 0 || !Number.isFinite(aw)) return null;
  if (aw <= anchors[0].aw) return { rate: anchors[0].rate, extrapolated: anchors[0].extrapolated || aw < anchors[0].aw };
  const last = anchors[anchors.length - 1];
  if (aw >= last.aw) return { rate: last.rate, extrapolated: true };
  let hi = 1;
  while (hi < anchors.length && anchors[hi].aw < aw) hi++;
  const a = anchors[hi - 1];
  const b = anchors[hi];
  const t = (aw - a.aw) / (b.aw - a.aw || 1);
  return { rate: a.rate + (b.rate - a.rate) * t, extrapolated: a.extrapolated || b.extrapolated };
}

/* ------------------------------------------------- non-monetary benefits */

export type BenefitDirection = 'higher_better' | 'lower_better';

export interface BenefitRow {
  id: string;
  label: string;
  unit: string;
  direction: BenefitDirection;
  /** What the cell shows. Composite rows render a short compound string. */
  values: Partial<Record<V2Country, number | string | null>>;
  /** What the cell is ranked on, where the display value is not a bare number. */
  scores: Partial<Record<V2Country, number | null>>;
  notes: Partial<Record<V2Country, string>>;
  source: string;
  sourceUrl: string;
  vintage?: string;
}

export interface BenefitsBundle {
  rows: BenefitRow[];
  placeholder: boolean;
  source: string;
}

/**
 * Categorical generosity levels, used when a row's value is a word rather than a number
 * (e.g. "universal", "means-tested"). Higher = more generous.
 */
export const GENEROSITY_SCALE: Record<string, number> = {
  none: 0,
  minimal: 1,
  limited: 1,
  'means-tested': 2,
  means_tested: 2,
  partial: 2,
  moderate: 3,
  broad: 4,
  comprehensive: 4,
  universal: 5,
  'universal free': 5,
};

export function generosityValue(v: number | string | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const key = v.trim().toLowerCase();
    if (key in GENEROSITY_SCALE) return GENEROSITY_SCALE[key];
    const num = Number(key.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(num) && key.match(/[0-9]/) ? num : null;
  }
  return null;
}

/**
 * Built-in fallback so Section 9 renders its structure before the pipeline lands. Levels are
 * indicative only and the section is badged **Placeholder** whenever this is in use.
 */
const BENEFITS_FALLBACK_ROWS: BenefitRow[] = [
  {
    id: 'paid_parental_leave',
    label: 'Paid parental leave',
    unit: 'weeks (paid, both parents)',
    direction: 'higher_better',
    scores: {},
    values: { US: 0, DE: 58, UK: 39, NO: 91, SE: 68, FI: 51, CH: 16, JP: 88 },
    notes: {},
    source: 'OECD Family Database',
    sourceUrl: 'https://www.oecd.org/els/family/database.htm',
    vintage: '2024',
  },
  {
    id: 'health_oop_share',
    label: 'Out-of-pocket health spending',
    unit: '% of total health spending',
    direction: 'lower_better',
    scores: {},
    values: { US: 11, DE: 12, UK: 17, NO: 14, SE: 14, FI: 18, CH: 22, JP: 13 },
    notes: {},
    source: 'OECD Health at a Glance',
    sourceUrl: 'https://www.oecd.org/health/health-at-a-glance/',
    vintage: '2023',
  },
  {
    id: 'tuition_public',
    label: 'Public university tuition',
    unit: 'USD-PPP per year',
    direction: 'lower_better',
    scores: {},
    values: { US: 9750, DE: 150, UK: 12000, NO: 0, SE: 0, FI: 0, CH: 1200, JP: 5100 },
    notes: {},
    source: 'OECD Education at a Glance',
    sourceUrl: 'https://www.oecd.org/education/education-at-a-glance/',
    vintage: '2024',
  },
  {
    id: 'childcare_net_cost',
    label: 'Net childcare cost, couple on average wages',
    unit: '% of net household income',
    direction: 'lower_better',
    scores: {},
    values: { US: 19, DE: 1, UK: 25, NO: 8, SE: 5, FI: 12, CH: 30, JP: 12 },
    notes: {},
    source: 'OECD Family Database',
    sourceUrl: 'https://www.oecd.org/els/family/database.htm',
    vintage: '2024',
  },
  {
    id: 'unemployment_replacement',
    label: 'Unemployment net replacement rate, first year',
    unit: '% of previous net earnings',
    direction: 'higher_better',
    scores: {},
    values: { US: 43, DE: 59, UK: 26, NO: 65, SE: 55, FI: 57, CH: 71, JP: 45 },
    notes: {},
    source: 'OECD Benefits in Unemployment',
    sourceUrl: 'https://www.oecd.org/social/benefits-and-wages.htm',
    vintage: '2024',
  },
  {
    id: 'statutory_paid_leave',
    label: 'Statutory paid annual leave',
    unit: 'days',
    direction: 'higher_better',
    scores: {},
    values: { US: 0, DE: 20, UK: 28, NO: 21, SE: 25, FI: 24, CH: 20, JP: 10 },
    notes: {},
    source: 'ILO Working Time Database',
    sourceUrl: 'https://www.ilo.org/global/statistics-and-databases/',
    vintage: '2024',
  },
  {
    id: 'paid_public_holidays',
    label: 'Paid public holidays',
    unit: 'days',
    direction: 'higher_better',
    scores: {},
    values: { US: 0, DE: 10, UK: 8, NO: 10, SE: 11, FI: 11, CH: 9, JP: 16 },
    notes: {},
    source: 'ILO Working Time Database',
    sourceUrl: 'https://www.ilo.org/global/statistics-and-databases/',
    vintage: '2024',
  },
  {
    id: 'sick_pay',
    label: 'Employer/state sick pay',
    unit: 'generosity',
    direction: 'higher_better',
    scores: {},
    values: { US: 'limited', DE: 'comprehensive', UK: 'minimal', NO: 'universal', SE: 'comprehensive', FI: 'comprehensive', CH: 'moderate', JP: 'moderate' },
    notes: {},
    source: 'OECD Benefits in Unemployment',
    sourceUrl: 'https://www.oecd.org/social/benefits-and-wages.htm',
    vintage: '2024',
  },
  {
    id: 'annual_hours',
    label: 'Average annual hours worked',
    unit: 'hours per worker',
    direction: 'lower_better',
    scores: {},
    values: { US: 1799, DE: 1343, UK: 1524, NO: 1425, SE: 1440, FI: 1531, CH: 1528, JP: 1611 },
    notes: {},
    source: 'ILO Working Time Database',
    sourceUrl: 'https://www.ilo.org/global/statistics-and-databases/',
    vintage: '2024',
  },
  {
    id: 'transit_pass',
    label: 'Monthly urban transit pass',
    unit: 'USD-PPP',
    direction: 'lower_better',
    scores: {},
    values: { US: 100, DE: 53, UK: 180, NO: 85, SE: 90, FI: 75, CH: 90, JP: 105 },
    notes: {},
    source: 'UITP (International Association of Public Transport)',
    sourceUrl: 'https://www.uitp.org/',
    vintage: '2024',
  },
  {
    id: 'pension_replacement',
    label: 'Mandatory pension net replacement rate',
    unit: '% of average wage',
    direction: 'higher_better',
    scores: {},
    values: { US: 51, DE: 55, UK: 54, NO: 60, SE: 55, FI: 65, CH: 47, JP: 39 },
    notes: {},
    source: 'OECD Pensions at a Glance',
    sourceUrl: 'https://www.oecd.org/pensions/pensionsataglance.htm',
    vintage: '2023',
  },
];

/**
 * Three rows in the published file carry compound values — a duration paired with a
 * replacement rate, or a financing share paired with a model description. Each needs a short
 * cell string and a single number to rank on; "full-pay-equivalent weeks" (duration × rate) is
 * the standard way to compare leave entitlements across countries.
 */
const COMPOSITE_ROWS: Record<
  string,
  { display: (v: Record<string, unknown>) => string | null; score: (v: Record<string, unknown>) => number | null; note?: (v: Record<string, unknown>) => string | null }
> = {
  paid_sick_leave: {
    display: (v) => (nOrNull(v.weeks) === null ? null : `${nOrNull(v.weeks)} wk @ ${nOrNull(v.replacement_rate_pct) ?? 0}%`),
    score: (v) => (nOrNull(v.weeks) === null ? null : nOrNull(v.weeks)! * ((nOrNull(v.replacement_rate_pct) ?? 0) / 100)),
  },
  paid_parental_leave: {
    display: (v) => (nOrNull(v.weeks) === null ? null : `${nOrNull(v.weeks)} wk @ ${nOrNull(v.avg_payment_rate_pct) ?? 0}%`),
    score: (v) => (nOrNull(v.weeks) === null ? null : nOrNull(v.weeks)! * ((nOrNull(v.avg_payment_rate_pct) ?? 0) / 100)),
  },
  public_healthcare: {
    display: (v) => (nOrNull(v.public_financing_share_pct) === null ? null : `${nOrNull(v.public_financing_share_pct)}% public`),
    score: (v) => nOrNull(v.public_financing_share_pct),
    note: (v) => (typeof v.model === 'string' ? v.model : null),
  },
};

/**
 * The published benefits file states no polarity, because for most of these rows "more" is
 * obviously better. These are the exceptions and the near-exceptions, kept explicit so a new
 * row added upstream defaults to higher-is-better rather than silently inverting.
 */
const BENEFIT_DIRECTIONS: Record<string, BenefitDirection> = {
  health_oop_share: 'lower_better',
  out_of_pocket_health: 'lower_better',
  tuition_public: 'lower_better',
  public_higher_education: 'lower_better',
  childcare_net_cost: 'lower_better',
  public_childcare: 'lower_better',
  annual_hours_worked: 'lower_better',
  hours_worked: 'lower_better',
  statutory_retirement_age: 'lower_better',
  transit_pass_cost: 'lower_better',
};

export function parseBenefits(file: GenericFile | null): BenefitsBundle {
  const rows = file?.categories?.length ? file.categories : (file?.rows ?? []);
  if (!file || rows.length === 0) {
    return { rows: BENEFITS_FALLBACK_ROWS, placeholder: true, source: 'Placeholder \u2014 awaiting data/v3/non_monetary_benefits.json' };
  }
  const parsed: BenefitRow[] = rows.map((r, i) => {
    const values: BenefitRow['values'] = {};
    const scores: BenefitRow['scores'] = {};
    const notes: BenefitRow['notes'] = {};
    const rowId = String(r.id ?? r.metric ?? r.benefit ?? `row_${i}`);
    const composite = COMPOSITE_ROWS[rowId];
    const nested = (r.values ?? r.by_country) as Record<string, unknown> | undefined;
    if (nested && typeof nested === 'object') {
      for (const [k, v] of Object.entries(nested)) {
        const c = asV2Country(k);
        if (!c) continue;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const obj = v as Record<string, unknown>;
          if (composite) {
            values[c] = composite.display(obj);
            scores[c] = composite.score(obj);
            const extra = composite.note?.(obj);
            if (extra) notes[c] = extra;
          } else {
            // Unknown compound shape: rank and show its first numeric member.
            const first = Object.values(obj).map(nOrNull).find((n) => n !== null) ?? null;
            values[c] = first;
            scores[c] = first;
          }
          continue;
        }
        values[c] = typeof v === 'number' || typeof v === 'string' ? v : null;
      }
    } else {
      for (const [k, v] of Object.entries(r)) {
        const c = asV2Country(k);
        if (c && (typeof v === 'number' || typeof v === 'string')) values[c] = v;
      }
    }
    const nestedNotes = (r.value_notes ?? r.notes_by_country) as Record<string, unknown> | undefined;
    if (nestedNotes && typeof nestedNotes === 'object') {
      for (const [k, v] of Object.entries(nestedNotes)) {
        const c = asV2Country(k);
        if (!c || typeof v !== 'string') continue;
        notes[c] = notes[c] ? `${notes[c]} \u2014 ${v}` : v;
      }
    }
    const id = String(r.id ?? r.metric ?? r.benefit ?? `row_${i}`);
    const dir = String(r.direction ?? r.polarity ?? BENEFIT_DIRECTIONS[id] ?? 'higher_better').toLowerCase();
    return {
      id,
      label: String(r.label ?? r.metric_label ?? r.benefit ?? r.metric ?? `Row ${i + 1}`),
      unit: String(r.unit ?? ''),
      direction: dir.includes('lower') ? 'lower_better' : 'higher_better',
      values,
      scores,
      notes,
      source: String(r.source ?? file.source ?? 'OECD / ILO / UITP compilation'),
      sourceUrl: String(r.source_url ?? file.source_url ?? ''),
      vintage: typeof r.vintage === 'string' ? r.vintage : typeof r.year === 'number' ? String(r.year) : undefined,
    };
  });
  return {
    rows: parsed,
    placeholder: false,
    source: `${file.source ?? 'OECD / ILO / UITP compilation'} \u00b7 as of ${fileAsOf(file)}`,
  };
}

/**
 * Per-row quartile colouring: the two best countries read green, the two worst red, the
 * middle four neutral. Direction-aware, so "lower is better" rows invert.
 */
/**
 * Rows where a higher number is not plainly better, so colouring would mislead. The transit
 * subsidy share is the clear case: the US tops it only because farebox recovery collapsed,
 * while Japan reads negative because its private railways run at a profit.
 */
const UNRANKED_ROWS = new Set(['public_transit']);

export function benefitRanks(row: BenefitRow, countries: V2Country[] = V3_COUNTRY_ORDER): Partial<Record<V2Country, 'good' | 'neutral' | 'bad'>> {
  if (UNRANKED_ROWS.has(row.id)) return {};
  const scored = countries
    .map((c) => ({ c, v: row.scores[c] ?? generosityValue(row.values[c]) }))
    .filter((x): x is { c: V2Country; v: number } => x.v !== null);
  if (scored.length < 4) return {};
  scored.sort((a, b) => (row.direction === 'higher_better' ? b.v - a.v : a.v - b.v));
  const out: Partial<Record<V2Country, 'good' | 'neutral' | 'bad'>> = {};
  const top = Math.max(1, Math.round(scored.length / 4));
  scored.forEach((x, i) => {
    out[x.c] = i < top ? 'good' : i >= scored.length - top ? 'bad' : 'neutral';
  });
  return out;
}

/* ---------------------------------------------------------------- the store */

export interface V3Store {
  forbes: ForbesBundle;
  tax: TaxCurve;
  benefits: BenefitsBundle;
  /** (geo, year) rows into which v3 top-tail values were merged. */
  topTailMerged: number;
  /** Files that failed to load, for the "data pending" banner. */
  missing: string[];
  readme: string | null;
}

const V3_FILES = {
  thresholds: 'wid_toptail_thresholds.json',
  shares: 'wid_top_shares.json',
  tax: 'effective_tax_by_percentile.json',
  forbes: 'forbes_top10.json',
  benefits: 'non_monetary_benefits.json',
} as const;

/**
 * Load the v3 bundle. `store` is mutated in place with the merged top-tail thresholds and
 * shares, so it must be the same object the tiles read from.
 */
export async function loadV3(store: DataStore | undefined): Promise<V3Store> {
  const [thresholds, shares, tax, forbes, benefits] = await Promise.all([
    getV3<GenericFile>(V3_FILES.thresholds),
    getV3<GenericFile>(V3_FILES.shares),
    getV3<GenericFile>(V3_FILES.tax),
    getV3<GenericFile>(V3_FILES.forbes),
    getV3<GenericFile>(V3_FILES.benefits),
  ]);
  const missing: string[] = [];
  if (!thresholds) missing.push(V3_FILES.thresholds);
  if (!shares) missing.push(V3_FILES.shares);
  if (!tax) missing.push(V3_FILES.tax);
  if (!forbes) missing.push(V3_FILES.forbes);
  if (!benefits) missing.push(V3_FILES.benefits);

  const topTailMerged = store ? mergeTopTail(store, thresholds, shares) : 0;
  return {
    forbes: parseForbes(forbes),
    tax: parseTaxCurve(tax),
    benefits: parseBenefits(benefits),
    topTailMerged,
    missing,
    readme: null,
  };
}
