/**
 * v4.1 data layer.
 *
 * Four optional files under `data/v4/`:
 *
 *  - `household_size_by_decile.json` — average household size per income decile, per country.
 *    Feeds the per-equivalent-adult line on every band tile via the square-root scale.
 *  - `population_by_year.json` — total resident population 1980–2024, per country. Turns a
 *    band's population *share* into a population *count*.
 *  - `inflation_deflators.json` — US PCE, US CPI-U and per-country HICP index series,
 *    normalised to base year 2023 so they line up with WID's price basis. Feeds the
 *    nominal/real split on every tile.
 *  - `kids_split_expenditure.json` — gross income, tax rate and necessity floor for
 *    households with children under 18 versus households without, at P50/P90/P99, for all
 *    eight countries. Feeds Section 11.
 *
 * Every loader returns `null` on a 404 and falls back to a built-in indicative table that is
 * always flagged `placeholder: true`, so the UI renders structure with an honest badge rather
 * than breaking while the parallel data pipeline is still running. The file shapes are read
 * tolerantly (ISO2 / ISO3 / country name keys, `d1`/`decile_1`/`1` decile keys) for the same
 * reason the v3 loader is: the pipeline's exact spelling is not pinned.
 */
import { GeoId } from './incomeModel';
import { V2Country, V3_COUNTRY_ORDER } from './ppp';
import { asV2Country } from './v3data';

export const V4_AS_OF = '2026-08-03';

function v4Url(file: string): string {
  return new URL(`./data/v4/${file}`, document.baseURI).toString();
}

async function getV4<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(v4Url(file));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

const GEO_TO_V4: Record<GeoId, V2Country | null> = {
  US: 'US', CAN: null, GBR: 'UK', DEU: 'DE', FRA: null, JPN: 'JP', CHE: 'CH', NOR: 'NO', SWE: 'SE', FIN: 'FI',
};

/** v2 country code for a geo, or null where v4 publishes nothing (Canada, France). */
export function v4Country(geo: GeoId): V2Country | null {
  return GEO_TO_V4[geo];
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* ================================================ A.1 household size by decile */

export interface HouseholdSizeCountry {
  source: string;
  sourceUrl: string;
  year: number;
  /** Ten averages, index 0 = bottom decile. */
  deciles: number[];
}

export interface HouseholdSizeBundle {
  placeholder: boolean;
  asOf: string;
  byCountry: Partial<Record<V2Country, HouseholdSizeCountry>>;
}

/**
 * Indicative fallback. US shape follows Census ASEC HINC-04 (households in the bottom decile
 * are disproportionately single-person and elderly; the top decile is disproportionately
 * dual-earner couples with children). International shapes are the same curve re-levelled to
 * each country's published average household size (OECD Family Database SF1.1).
 */
const HH_SIZE_FALLBACK: Record<V2Country, { avg: number; source: string; sourceUrl: string; year: number }> = {
  US: { avg: 2.51, source: 'Census ASEC HINC-04 (indicative)', sourceUrl: 'https://www.census.gov/data/tables/2024/demo/income-poverty/p60-286.html', year: 2024 },
  DE: { avg: 1.99, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  UK: { avg: 2.36, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  NO: { avg: 2.13, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  SE: { avg: 2.20, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  FI: { avg: 2.00, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  CH: { avg: 2.16, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
  JP: { avg: 2.21, source: 'OECD Family Database SF1.1 (indicative)', sourceUrl: 'https://www.oecd.org/els/family/database.htm', year: 2023 },
};

/** Relative decile profile, normalised to mean 1. Bottom deciles are smaller households. */
const HH_SIZE_PROFILE = [0.64, 0.76, 0.86, 0.93, 0.98, 1.05, 1.10, 1.16, 1.22, 1.30];

function fallbackHouseholdSize(): HouseholdSizeBundle {
  const byCountry: Partial<Record<V2Country, HouseholdSizeCountry>> = {};
  for (const c of V3_COUNTRY_ORDER) {
    const f = HH_SIZE_FALLBACK[c];
    byCountry[c] = {
      source: f.source,
      sourceUrl: f.sourceUrl,
      year: f.year,
      deciles: HH_SIZE_PROFILE.map((k) => Math.round(k * f.avg * 100) / 100),
    };
  }
  return { placeholder: true, asOf: V4_AS_OF, byCountry };
}

/** Accepts `d1`..`d10`, `decile_1`..`decile_10`, `1`..`10`, or a bare ten-element array. */
function readDeciles(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    const arr = raw.map(num).filter((v): v is number => v !== null);
    return arr.length >= 10 ? arr.slice(0, 10) : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Json;
  const out: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const v = num(obj[`d${i}`]) ?? num(obj[`decile_${i}`]) ?? num(obj[`decile${i}`]) ?? num(obj[String(i)]);
    if (v === null) return null;
    out.push(v);
  }
  return out;
}

export function parseHouseholdSize(raw: Json | null): HouseholdSizeBundle {
  const countries = (raw?.countries ?? raw?.by_country) as Json | undefined;
  if (!countries || typeof countries !== 'object') return fallbackHouseholdSize();
  const byCountry: Partial<Record<V2Country, HouseholdSizeCountry>> = {};
  for (const [key, value] of Object.entries(countries)) {
    const c = asV2Country(key);
    if (!c || !value || typeof value !== 'object') continue;
    const v = value as Json;
    const deciles = readDeciles(v.deciles ?? v.by_decile ?? v.avg_household_size_by_decile);
    if (!deciles) continue;
    byCountry[c] = {
      source: typeof v.source === 'string' ? v.source : 'v4 pipeline',
      sourceUrl: typeof v.source_url === 'string' ? v.source_url : '',
      year: num(v.year) ?? 0,
      deciles,
    };
  }
  if (Object.keys(byCountry).length === 0) return fallbackHouseholdSize();
  // Fill any country the file omitted from the fallback so no tile goes blank.
  const fb = fallbackHouseholdSize();
  let anyFilled = false;
  for (const c of V3_COUNTRY_ORDER) {
    if (!byCountry[c]) {
      byCountry[c] = fb.byCountry[c];
      anyFilled = true;
    }
  }
  return { placeholder: anyFilled, asOf: typeof raw?.as_of === 'string' ? raw.as_of : V4_AS_OF, byCountry };
}

/**
 * Average household size across a percentile band, integrated over the decile profile.
 * Deciles are treated as step values centred on their mid-rank and interpolated linearly
 * between mid-ranks, which is the same rank-space convention the expenditure layer uses.
 */
export function householdSizeInBand(hh: HouseholdSizeCountry | null | undefined, lowerP: number, upperP: number): number | null {
  if (!hh || hh.deciles.length < 10) return null;
  const at = (p: number): number => {
    const x = Math.min(Math.max(p, 0), 1) * 10 - 0.5; // position in decile-index space
    if (x <= 0) return hh.deciles[0];
    if (x >= 9) return hh.deciles[9];
    const i = Math.floor(x);
    const f = x - i;
    return hh.deciles[i] * (1 - f) + hh.deciles[i + 1] * f;
  };
  const lo = Math.min(Math.max(lowerP, 0), 1);
  const hi = Math.min(Math.max(upperP, lo + 1e-6), 1);
  const N = 24;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += at(lo + ((i + 0.5) / N) * (hi - lo));
  return sum / N;
}

/** Square-root equivalence scale, as used throughout v2. */
export function equivalentAdultFactor(householdSize: number): number {
  return Math.sqrt(Math.max(householdSize, 1));
}

/* ============================================= A.2 total population by year */

export interface PopulationBundle {
  placeholder: boolean;
  /** country → year → total resident population. */
  byCountry: Partial<Record<V2Country, Record<number, number>>>;
  source: string;
  sourceUrl: string;
}

/** World-Bank-style anchors, linearly interpolated between them. Millions. */
const POP_ANCHORS: Record<V2Country, Record<number, number>> = {
  US: { 1980: 227.2, 1990: 249.6, 2000: 282.2, 2010: 309.3, 2020: 331.5, 2024: 340.1 },
  DE: { 1980: 78.3, 1990: 79.4, 2000: 82.2, 2010: 81.8, 2020: 83.2, 2024: 83.5 },
  UK: { 1980: 56.3, 1990: 57.2, 2000: 58.9, 2010: 62.8, 2020: 67.1, 2024: 69.1 },
  NO: { 1980: 4.09, 1990: 4.24, 2000: 4.49, 2010: 4.89, 2020: 5.38, 2024: 5.55 },
  SE: { 1980: 8.31, 1990: 8.56, 2000: 8.87, 2010: 9.38, 2020: 10.35, 2024: 10.59 },
  FI: { 1980: 4.78, 1990: 4.99, 2000: 5.18, 2010: 5.36, 2020: 5.53, 2024: 5.62 },
  CH: { 1980: 6.32, 1990: 6.71, 2000: 7.18, 2010: 7.82, 2020: 8.64, 2024: 8.85 },
  JP: { 1980: 116.8, 1990: 123.5, 2000: 126.8, 2010: 128.1, 2020: 126.3, 2024: 123.8 },
};

function interpAnchors(anchors: Record<number, number>): Record<number, number> {
  const years = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  const out: Record<number, number> = {};
  for (let y = years[0]; y <= years[years.length - 1]; y++) {
    let i = 0;
    while (i < years.length - 2 && years[i + 1] < y) i++;
    const y0 = years[i];
    const y1 = years[i + 1];
    const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    out[y] = (anchors[y0] * (1 - f) + anchors[y1] * f) * 1_000_000;
  }
  return out;
}

function fallbackPopulation(): PopulationBundle {
  const byCountry: Partial<Record<V2Country, Record<number, number>>> = {};
  for (const c of V3_COUNTRY_ORDER) byCountry[c] = interpAnchors(POP_ANCHORS[c]);
  return {
    placeholder: true,
    byCountry,
    source: 'World Bank Indicators SP.POP.TOTL (indicative anchors, interpolated)',
    sourceUrl: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
  };
}

export function parsePopulation(raw: Json | null): PopulationBundle {
  const countries = (raw?.countries ?? raw?.by_country) as Json | undefined;
  if (!countries || typeof countries !== 'object') return fallbackPopulation();
  const byCountry: Partial<Record<V2Country, Record<number, number>>> = {};
  for (const [key, value] of Object.entries(countries)) {
    const c = asV2Country(key);
    if (!c || !value || typeof value !== 'object') continue;
    const v = value as Json;
    const series = (v.population_by_year ?? v.values ?? v.years ?? v.population ?? v) as Json;
    const years: Record<number, number> = {};
    for (const [yk, yv] of Object.entries(series)) {
      const y = Number(yk);
      const n = num(yv);
      if (Number.isFinite(y) && y > 1900 && n !== null && n > 0) years[y] = n;
    }
    if (Object.keys(years).length > 0) byCountry[c] = years;
  }
  if (Object.keys(byCountry).length === 0) return fallbackPopulation();
  const fb = fallbackPopulation();
  let anyFilled = false;
  for (const c of V3_COUNTRY_ORDER) {
    if (!byCountry[c]) {
      byCountry[c] = fb.byCountry[c];
      anyFilled = true;
    }
  }
  return {
    placeholder: anyFilled,
    byCountry,
    source: typeof raw?.source === 'string' ? raw.source : 'World Bank Indicators SP.POP.TOTL',
    sourceUrl: typeof raw?.source_url === 'string' ? raw.source_url : 'https://data.worldbank.org/indicator/SP.POP.TOTL',
  };
}

/** Population of `country` in `year`, nearest available year if that exact one is missing. */
export function populationFor(bundle: PopulationBundle, country: V2Country | null, year: number): number | null {
  if (!country) return null;
  const series = bundle.byCountry[country];
  if (!series) return null;
  if (series[year]) return series[year];
  const years = Object.keys(series).map(Number);
  if (years.length === 0) return null;
  const nearest = years.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a));
  return series[nearest] ?? null;
}

/* ================================================== A.3 inflation deflators */

export type DeflatorId = 'PCE' | 'CPI_U' | 'HICP';

export const DEFLATORS: { id: DeflatorId; label: string; blurb: string }[] = [
  {
    id: 'PCE',
    label: 'PCE (US default)',
    blurb:
      'BEA Personal Consumption Expenditures price index. The Fed\u2019s target measure and the default for US series: it reweights as households substitute between goods, so it runs a few tenths below CPI-U in most years.',
  },
  {
    id: 'CPI_U',
    label: 'CPI-U (US alternative)',
    blurb:
      'BLS Consumer Price Index for All Urban Consumers. Fixed-basket, and the index most benefit formulas and wage contracts are written against, so it is the right deflator if you want to match a legal or contractual definition of real income.',
  },
  {
    id: 'HICP',
    label: 'HICP (international default)',
    blurb:
      'Harmonised Index of Consumer Prices, the Eurostat/OECD definition used for every non-US country. Applied per country \u2014 Swiss and Japanese inflation over this period is nothing like Nordic or UK inflation.',
  },
];

export interface DeflatorSeries {
  /** Index level by year, base year = 100. */
  values: Record<number, number>;
  baseYear: number;
  source: string;
  sourceUrl: string;
}

export interface DeflatorBundle {
  placeholder: boolean;
  /** Series keys are `US_PCE`, `US_CPI_U`, `DE_HICP`, ... */
  series: Record<string, DeflatorSeries>;
}

const US_PCE_RATES: Record<number, number> = {
  1980: 11.3, 1981: 9.4, 1982: 6.0, 1983: 4.0, 1984: 3.6, 1985: 3.4, 1986: 2.4, 1987: 3.4, 1988: 4.0, 1989: 4.4,
  1990: 4.7, 1991: 3.7, 1992: 2.7, 1993: 2.4, 1994: 2.2, 1995: 2.2, 1996: 2.2, 1997: 1.7, 1998: 1.1, 1999: 1.4,
  2000: 2.4, 2001: 2.0, 2002: 1.4, 2003: 1.9, 2004: 2.5, 2005: 2.9, 2006: 2.8, 2007: 2.5, 2008: 3.1, 2009: 0.0,
  2010: 1.6, 2011: 2.4, 2012: 1.9, 2013: 1.3, 2014: 1.4, 2015: 0.2, 2016: 1.0, 2017: 1.8, 2018: 2.1, 2019: 1.5,
  2020: 1.1, 2021: 4.1, 2022: 6.6, 2023: 3.8, 2024: 2.5,
};

const US_CPI_RATES: Record<number, number> = {
  1980: 13.5, 1981: 10.3, 1982: 6.2, 1983: 3.2, 1984: 4.3, 1985: 3.6, 1986: 1.9, 1987: 3.6, 1988: 4.1, 1989: 4.8,
  1990: 5.4, 1991: 4.2, 1992: 3.0, 1993: 3.0, 1994: 2.6, 1995: 2.8, 1996: 3.0, 1997: 2.3, 1998: 1.6, 1999: 2.2,
  2000: 3.4, 2001: 2.8, 2002: 1.6, 2003: 2.3, 2004: 2.7, 2005: 3.4, 2006: 3.2, 2007: 2.9, 2008: 3.8, 2009: -0.4,
  2010: 1.6, 2011: 3.2, 2012: 2.1, 2013: 1.5, 2014: 1.6, 2015: 0.1, 2016: 1.3, 2017: 2.1, 2018: 2.4, 2019: 1.8,
  2020: 1.2, 2021: 4.7, 2022: 8.0, 2023: 4.1, 2024: 2.9,
};

/** Recent HICP annual rates, with a long-run average applied to 1981–2018. */
const HICP_RECENT: Record<V2Country, Record<number, number>> = {
  US: { 2019: 1.8, 2020: 1.2, 2021: 4.7, 2022: 8.0, 2023: 4.1, 2024: 2.9 },
  DE: { 2019: 1.4, 2020: 0.4, 2021: 3.2, 2022: 8.7, 2023: 6.0, 2024: 2.5 },
  UK: { 2019: 1.8, 2020: 0.9, 2021: 2.6, 2022: 9.1, 2023: 7.3, 2024: 2.5 },
  NO: { 2019: 2.2, 2020: 1.3, 2021: 3.5, 2022: 5.8, 2023: 5.5, 2024: 3.1 },
  SE: { 2019: 1.7, 2020: 0.7, 2021: 2.7, 2022: 8.1, 2023: 8.5, 2024: 2.9 },
  FI: { 2019: 1.1, 2020: 0.4, 2021: 2.1, 2022: 7.2, 2023: 6.3, 2024: 1.6 },
  CH: { 2019: 0.4, 2020: -0.7, 2021: 0.6, 2022: 2.8, 2023: 2.1, 2024: 1.1 },
  JP: { 2019: 0.5, 2020: 0.0, 2021: -0.2, 2022: 2.5, 2023: 3.3, 2024: 2.7 },
};

const HICP_LONGRUN: Record<V2Country, number> = {
  US: 3.3, DE: 2.0, UK: 3.4, NO: 3.3, SE: 3.5, FI: 3.2, CH: 1.8, JP: 1.0,
};

const DEFLATOR_BASE_YEAR = 2023;

/** Build an index (base year = 100) from a table of annual percentage changes. */
function indexFromRates(rates: Record<number, number>, minYear = 1980, maxYear = 2024): Record<number, number> {
  const level: Record<number, number> = { [minYear]: 100 };
  for (let y = minYear + 1; y <= maxYear; y++) {
    level[y] = level[y - 1] * (1 + (rates[y] ?? 0) / 100);
  }
  const base = level[DEFLATOR_BASE_YEAR] ?? 100;
  const out: Record<number, number> = {};
  for (const [y, v] of Object.entries(level)) out[Number(y)] = (v / base) * 100;
  return out;
}

function fallbackDeflators(): DeflatorBundle {
  const series: Record<string, DeflatorSeries> = {
    US_PCE: {
      values: indexFromRates(US_PCE_RATES),
      baseYear: DEFLATOR_BASE_YEAR,
      source: 'BEA Table 2.3.4 PCE price index (indicative annual rates)',
      sourceUrl: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index',
    },
    US_CPI_U: {
      values: indexFromRates(US_CPI_RATES),
      baseYear: DEFLATOR_BASE_YEAR,
      source: 'BLS CUUR0000SA0 CPI-U (indicative annual rates)',
      sourceUrl: 'https://www.bls.gov/cpi/',
    },
  };
  for (const c of V3_COUNTRY_ORDER) {
    const rates: Record<number, number> = {};
    for (let y = 1981; y <= 2024; y++) rates[y] = HICP_RECENT[c][y] ?? HICP_LONGRUN[c];
    series[`${c}_HICP`] = {
      values: indexFromRates(rates),
      baseYear: DEFLATOR_BASE_YEAR,
      source: 'OECD / Eurostat HICP (indicative: published recent years, long-run average before 2019)',
      sourceUrl: 'https://data-explorer.oecd.org/vis?tm=inflation',
    };
  }
  return { placeholder: true, series };
}

export function parseDeflators(raw: Json | null): DeflatorBundle {
  const src = (raw?.series ?? raw) as Json | undefined;
  if (!src || typeof src !== 'object') return fallbackDeflators();
  const series: Record<string, DeflatorSeries> = {};
  for (const [key, value] of Object.entries(src)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Json;
    const vals = (v.values ?? v.index ?? v.years) as Json | undefined;
    if (!vals || typeof vals !== 'object') continue;
    const values: Record<number, number> = {};
    for (const [yk, yv] of Object.entries(vals)) {
      const y = Number(yk);
      const n = num(yv);
      if (Number.isFinite(y) && y > 1900 && n !== null && n > 0) values[y] = n;
    }
    if (Object.keys(values).length < 2) continue;
    series[key.toUpperCase().replace(/[^A-Z0-9]/g, '_')] = {
      values,
      baseYear: num(v.base_year) ?? DEFLATOR_BASE_YEAR,
      source: typeof v.source === 'string' ? v.source : 'v4 pipeline',
      sourceUrl: typeof v.source_url === 'string' ? v.source_url : '',
    };
  }
  if (Object.keys(series).length === 0) return fallbackDeflators();
  const fb = fallbackDeflators();
  let anyFilled = false;
  for (const key of Object.keys(fb.series)) {
    if (!series[key]) {
      series[key] = fb.series[key];
      anyFilled = true;
    }
  }
  return { placeholder: anyFilled, series };
}

/**
 * Which series a given country/deflator pair resolves to. PCE and CPI-U only exist for the
 * United States, so a non-US selection always falls back to that country's HICP.
 */
export function deflatorKeyFor(country: V2Country | null, choice: DeflatorId): string | null {
  if (!country) return null;
  if (country === 'US') {
    if (choice === 'PCE') return 'US_PCE';
    if (choice === 'CPI_U') return 'US_CPI_U';
    return 'US_HICP';
  }
  return `${country}_HICP`;
}

export interface DeflatorPair {
  key: string;
  label: string;
  /** Index level in the tile's year and the year before it. */
  thisYear: number | null;
  prevYear: number | null;
  /** Inflation between the two years as a fraction, or null. */
  inflation: number | null;
  source: string;
  sourceUrl: string;
  /** True when the requested deflator does not exist for this country and HICP was used. */
  substituted: boolean;
}

export function deflatorPair(
  bundle: DeflatorBundle,
  country: V2Country | null,
  choice: DeflatorId,
  year: number
): DeflatorPair | null {
  const key = deflatorKeyFor(country, choice);
  if (!key) return null;
  const s = bundle.series[key];
  if (!s) return null;
  const thisYear = s.values[year] ?? null;
  const prevYear = s.values[year - 1] ?? null;
  const inflation = thisYear !== null && prevYear !== null && prevYear > 0 ? thisYear / prevYear - 1 : null;
  const wanted = country === 'US' ? choice : 'HICP';
  return {
    key,
    label: key.replace(/_/g, ' '),
    thisYear,
    prevYear,
    inflation,
    source: s.source,
    sourceUrl: s.sourceUrl,
    substituted: wanted !== choice,
  };
}

/**
 * Split a single measured growth rate into a nominal and a real reading.
 *
 * The dashboard's sources do not share a price basis: Census and BEA publish nominal
 * current-year dollars, CBO constant 2021 dollars, WID roughly 2023 prices. So the *measured*
 * year-on-year change is already nominal for some series and already real for others, and the
 * deflator has to be applied in opposite directions. `seriesIsReal` says which.
 */
export function splitGrowth(
  measuredPct: number | null,
  inflation: number | null,
  seriesIsReal: boolean
): { nominal: number | null; real: number | null } {
  if (measuredPct === null || !Number.isFinite(measuredPct)) return { nominal: null, real: null };
  if (inflation === null || !Number.isFinite(inflation)) {
    return seriesIsReal ? { nominal: null, real: measuredPct } : { nominal: measuredPct, real: null };
  }
  const g = measuredPct / 100;
  if (seriesIsReal) {
    return { nominal: ((1 + g) * (1 + inflation) - 1) * 100, real: measuredPct };
  }
  return { nominal: measuredPct, real: ((1 + g) / (1 + inflation) - 1) * 100 };
}

/* ============================================= A.5/A.6 kids-split expenditure */

export type KidsTier = 'p50' | 'p90' | 'p99';
export const KIDS_TIERS: KidsTier[] = ['p50', 'p90', 'p99'];
export const KIDS_TIER_LABELS: Record<KidsTier, string> = { p50: 'P50', p90: 'P90', p99: 'P99' };

export interface KidsSide {
  gross: Record<KidsTier, number | null>;
  taxRate: Record<KidsTier, number | null>;
  necessity: Record<KidsTier, number | null>;
}

export interface KidsCountry {
  source: string;
  sourceUrl: string;
  /** True when this country's split is borrowed from a peer rather than published. */
  modeledFrom: V2Country | null;
  withKids: KidsSide;
  noKids: KidsSide;
}

export interface KidsSplitBundle {
  placeholder: boolean;
  asOf: string;
  byCountry: Partial<Record<V2Country, KidsCountry>>;
}

interface FallbackSide {
  gross: [number, number, number];
  necessity: [number, number, number];
}

/**
 * Indicative fallback for Section 11, in each country's own currency.
 *
 * The shape encodes the finding the section exists to show: with-kids households earn more
 * gross at every tier, but in the US, UK, Germany and Switzerland the childcare bill and the
 * wider necessity floor more than eat the premium, while in Norway and Sweden subsidised
 * childcare, cash child benefit and paid parental leave leave them slightly ahead.
 */
const KIDS_FALLBACK: Record<
  V2Country,
  { tax: [number, number, number]; withKids: FallbackSide; noKids: FallbackSide; source: string; sourceUrl: string; modeledFrom?: V2Country }
> = {
  US: {
    tax: [0.22, 0.30, 0.36],
    withKids: { gross: [128_000, 315_000, 1_150_000], necessity: [80_240, 148_000, 300_000] },
    noKids: { gross: [78_000, 205_000, 900_000], necessity: [28_880, 62_000, 120_000] },
    source: 'BLS Consumer Expenditure Survey 2024, consumer units by presence of children (indicative)',
    sourceUrl: 'https://www.bls.gov/cex/tables.htm',
  },
  DE: {
    tax: [0.36, 0.42, 0.45],
    withKids: { gross: [78_000, 150_000, 420_000], necessity: [42_000, 68_000, 130_000] },
    noKids: { gross: [54_000, 108_000, 330_000], necessity: [22_000, 38_000, 80_000] },
    source: 'Destatis EVS 2023, Haushalte mit / ohne Kinder (indicative)',
    sourceUrl: 'https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/',
  },
  UK: {
    tax: [0.28, 0.34, 0.40],
    withKids: { gross: [62_000, 120_000, 340_000], necessity: [39_000, 62_000, 115_000] },
    noKids: { gross: [44_000, 88_000, 270_000], necessity: [22_000, 36_000, 72_000] },
    source: 'ONS Living Costs and Food Survey Table A22, households with dependent children (indicative)',
    sourceUrl: 'https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure',
  },
  NO: {
    tax: [0.32, 0.38, 0.42],
    withKids: { gross: [950_000, 1_650_000, 4_200_000], necessity: [520_000, 760_000, 1_300_000] },
    noKids: { gross: [680_000, 1_250_000, 3_400_000], necessity: [340_000, 520_000, 900_000] },
    source: 'Finland StatFin HBS household-type shares applied to Norwegian register income (indicative)',
    sourceUrl: 'https://www.ssb.no/en/statbank/table/12682',
    modeledFrom: 'FI',
  },
  SE: {
    tax: [0.30, 0.36, 0.40],
    withKids: { gross: [640_000, 1_150_000, 3_000_000], necessity: [350_000, 520_000, 900_000] },
    noKids: { gross: [470_000, 880_000, 2_500_000], necessity: [240_000, 370_000, 650_000] },
    source: 'Finland StatFin HBS household-type shares applied to Swedish register income (indicative)',
    sourceUrl: 'https://www.statistikdatabasen.scb.se/',
    modeledFrom: 'FI',
  },
  FI: {
    tax: [0.31, 0.38, 0.42],
    withKids: { gross: [62_000, 108_000, 290_000], necessity: [33_000, 48_000, 86_000] },
    noKids: { gross: [45_000, 82_000, 240_000], necessity: [24_000, 34_000, 62_000] },
    source: 'StatFin Household Budget Survey by household type (indicative)',
    sourceUrl: 'https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/',
  },
  CH: {
    tax: [0.22, 0.27, 0.31],
    withKids: { gross: [145_000, 250_000, 700_000], necessity: [95_000, 140_000, 250_000] },
    noKids: { gross: [105_000, 190_000, 580_000], necessity: [62_000, 92_000, 170_000] },
    source: 'BFS Haushaltsbudgeterhebung by household composition (indicative)',
    sourceUrl: 'https://www.bfs.admin.ch/',
  },
  JP: {
    tax: [0.24, 0.30, 0.35],
    withKids: { gross: [9_000_000, 16_000_000, 42_000_000], necessity: [5_600_000, 8_600_000, 15_000_000] },
    noKids: { gross: [6_200_000, 12_000_000, 34_000_000], necessity: [3_400_000, 5_400_000, 10_000_000] },
    source: 'Statistics Japan FIES 2024 by household type (indicative)',
    sourceUrl: 'https://www.stat.go.jp/english/data/kakei/',
  },
};

function side(f: FallbackSide, tax: [number, number, number]): KidsSide {
  return {
    gross: { p50: f.gross[0], p90: f.gross[1], p99: f.gross[2] },
    taxRate: { p50: tax[0], p90: tax[1], p99: tax[2] },
    necessity: { p50: f.necessity[0], p90: f.necessity[1], p99: f.necessity[2] },
  };
}

function fallbackKidsSplit(): KidsSplitBundle {
  const byCountry: Partial<Record<V2Country, KidsCountry>> = {};
  for (const c of V3_COUNTRY_ORDER) {
    const f = KIDS_FALLBACK[c];
    byCountry[c] = {
      source: f.source,
      sourceUrl: f.sourceUrl,
      modeledFrom: f.modeledFrom ?? null,
      withKids: side(f.withKids, f.tax),
      noKids: side(f.noKids, f.tax),
    };
  }
  return { placeholder: true, asOf: V4_AS_OF, byCountry };
}

function tierMap(raw: unknown, keys: string[]): Record<KidsTier, number | null> {
  const out: Record<KidsTier, number | null> = { p50: null, p90: null, p99: null };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Json;
  for (const t of KIDS_TIERS) {
    for (const k of keys) {
      const holder = k ? (obj[k] as Json | undefined) : obj;
      if (holder && typeof holder === 'object') {
        const v = num(holder[t]) ?? num(holder[t.toUpperCase()]) ?? num(holder[t.replace('p', 'P')]);
        if (v !== null) {
          out[t] = v;
          break;
        }
      }
    }
  }
  return out;
}

function parseSide(raw: unknown, fallback: KidsSide): KidsSide {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Json;
  const gross = tierMap(obj, ['gross_by_tier', 'gross', 'avg_gross_income_by_tier']);
  const tax = tierMap(obj, ['effective_tax_rate_by_tier', 'tax_rate_by_tier', 'effective_tax_rate']);
  const nec = tierMap(obj, ['necessity_by_tier', 'necessity', 'necessity_floor_by_tier']);
  const necShare = tierMap(obj, ['necessity_share_by_tier', 'necessity_share']);

  // A flat `avg_gross_income` plus per-tier shares is the shape the build spec sketches;
  // scale it onto the tiers with the fallback's own tier profile so nothing goes blank.
  const flatGross = num(obj.avg_gross_income);
  const flatExp = num(obj.avg_expenditure);

  const out: KidsSide = { gross: { ...fallback.gross }, taxRate: { ...fallback.taxRate }, necessity: { ...fallback.necessity } };
  for (const t of KIDS_TIERS) {
    if (gross[t] !== null) out.gross[t] = gross[t];
    else if (flatGross !== null && fallback.gross.p50) {
      out.gross[t] = flatGross * ((fallback.gross[t] ?? 0) / (fallback.gross.p50 || 1));
    }
    if (tax[t] !== null) out.taxRate[t] = tax[t];
    if (nec[t] !== null) out.necessity[t] = nec[t];
    else if (necShare[t] !== null) {
      const g = out.gross[t];
      const r = out.taxRate[t] ?? 0;
      const base = flatExp !== null && t === 'p50' ? flatExp : g !== null ? g * (1 - r) : null;
      if (base !== null) out.necessity[t] = base * (necShare[t] as number);
    }
  }
  return out;
}

export function parseKidsSplit(raw: Json | null): KidsSplitBundle {
  const countries = (raw?.countries ?? raw?.by_country) as Json | undefined;
  const fb = fallbackKidsSplit();
  if (!countries || typeof countries !== 'object') return fb;
  const byCountry: Partial<Record<V2Country, KidsCountry>> = {};
  for (const [key, value] of Object.entries(countries)) {
    const c = asV2Country(key);
    if (!c || !value || typeof value !== 'object') continue;
    const v = value as Json;
    const base = fb.byCountry[c]!;
    byCountry[c] = {
      source: typeof v.source === 'string' ? v.source : base.source,
      sourceUrl: typeof v.source_url === 'string' ? v.source_url : base.sourceUrl,
      modeledFrom: asV2Country(v.modeled_from) ?? base.modeledFrom,
      withKids: parseSide(v.with_kids ?? v.withKids, base.withKids),
      noKids: parseSide(v.no_kids ?? v.noKids ?? v.without_kids, base.noKids),
    };
  }
  if (Object.keys(byCountry).length === 0) return fb;
  let anyFilled = false;
  for (const c of V3_COUNTRY_ORDER) {
    if (!byCountry[c]) {
      byCountry[c] = fb.byCountry[c];
      anyFilled = true;
    }
  }
  return { placeholder: anyFilled, asOf: typeof raw?.as_of === 'string' ? raw.as_of : V4_AS_OF, byCountry };
}

/* ---------------------------------------------------------------- the store */

export interface V4Store {
  householdSize: HouseholdSizeBundle;
  population: PopulationBundle;
  deflators: DeflatorBundle;
  kids: KidsSplitBundle;
  /** Files that failed to load, for the "v4.1 data pending" banner. */
  missing: string[];
}

export const V4_FILES = {
  householdSize: 'household_size_by_decile.json',
  population: 'population_by_year.json',
  deflators: 'inflation_deflators.json',
  kids: 'kids_split_expenditure.json',
} as const;

export async function loadV4(): Promise<V4Store> {
  const [hh, pop, defl, kids] = await Promise.all([
    getV4<Json>(V4_FILES.householdSize),
    getV4<Json>(V4_FILES.population),
    getV4<Json>(V4_FILES.deflators),
    getV4<Json>(V4_FILES.kids),
  ]);
  const missing: string[] = [];
  if (!hh) missing.push(V4_FILES.householdSize);
  if (!pop) missing.push(V4_FILES.population);
  if (!defl) missing.push(V4_FILES.deflators);
  if (!kids) missing.push(V4_FILES.kids);
  return {
    householdSize: parseHouseholdSize(hh),
    population: parsePopulation(pop),
    deflators: parseDeflators(defl),
    kids: parseKidsSplit(kids),
    missing,
  };
}

/** Compact population count: "65.0M", "2,600". */
export function fmtPeople(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '\u2014';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}
