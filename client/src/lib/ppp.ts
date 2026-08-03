/**
 * Purchasing-power-parity conversion for the v2 discretionary layer.
 *
 * Rates are **local currency units per USD-PPP for private (household final) consumption**,
 * 2023 base — the same price base WID/DINA uses for its real series, so a WID real-2023
 * local-currency figure divided by the 2023 PPP is a comparable USD-PPP figure.
 *
 * Source: OECD Annual National Accounts, "Purchasing power parities and exchange rates"
 * (Table 4) — https://data-explorer.oecd.org/ ; local copy at data/v2/oecd_ppp.json.
 */
import { GeoId } from './incomeModel';

/** The eight countries the v2 layer is scoped to (v2-plan.md, 2026-08-03). */
export type V2Country = 'US' | 'DE' | 'UK' | 'NO' | 'SE' | 'FI' | 'CH' | 'JP';

export const V2_COUNTRIES: { id: V2Country; label: string; currency: string; locale: string }[] = [
  { id: 'US', label: 'United States', currency: 'USD', locale: 'en-US' },
  { id: 'DE', label: 'Germany', currency: 'EUR', locale: 'de-DE' },
  { id: 'UK', label: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { id: 'NO', label: 'Norway', currency: 'NOK', locale: 'nb-NO' },
  { id: 'SE', label: 'Sweden', currency: 'SEK', locale: 'sv-SE' },
  { id: 'FI', label: 'Finland', currency: 'EUR', locale: 'fi-FI' },
  { id: 'CH', label: 'Switzerland', currency: 'CHF', locale: 'de-CH' },
  { id: 'JP', label: 'Japan', currency: 'JPY', locale: 'ja-JP' },
];

/**
 * v1 geographies are WID ISO3-ish codes. Only four of them overlap the v2 expenditure
 * countries; Canada and France have income series but no loaded expenditure survey
 * (France was dropped from v2 — stale 2017 EVS, see docs/v2-plan.md).
 */
export const GEO_TO_V2: Record<GeoId, V2Country | null> = {
  US: 'US',
  CAN: null,
  GBR: 'UK',
  DEU: 'DE',
  FRA: null,
  JPN: 'JP',
};

export interface PPPRate {
  lcu_per_usd_ppp: number;
  year: number;
}
export type PPPRates = Record<string, PPPRate>;

/**
 * Fallback rates (OECD 2023, private consumption) used only if data/v2/oecd_ppp.json
 * fails to load. Kept deliberately close to the published values.
 */
export const PPP_FALLBACK: PPPRates = {
  US: { lcu_per_usd_ppp: 1.0, year: 2023 },
  DE: { lcu_per_usd_ppp: 0.735, year: 2023 },
  UK: { lcu_per_usd_ppp: 0.71, year: 2023 },
  NO: { lcu_per_usd_ppp: 9.9, year: 2023 },
  SE: { lcu_per_usd_ppp: 9.8, year: 2023 },
  FI: { lcu_per_usd_ppp: 0.834, year: 2023 },
  CH: { lcu_per_usd_ppp: 1.134, year: 2023 },
  JP: { lcu_per_usd_ppp: 104.84, year: 2023 },
};

export const PPP_BASE_YEAR = 2023;

interface PPPFileRow {
  country: string;
  [k: string]: unknown;
}
interface PPPFile {
  source: string;
  source_url?: string;
  data_tier?: string;
  rows: PPPFileRow[];
}

export interface PPPBundle {
  rates: PPPRates;
  source: string;
  sourceUrl?: string;
  live: boolean;
}

function v2DataUrl(file: string): string {
  return new URL(`./data/v2/${file}`, document.baseURI).toString();
}

export async function loadPPP(): Promise<PPPBundle> {
  try {
    const res = await fetch(v2DataUrl('oecd_ppp.json'));
    if (!res.ok) throw new Error(String(res.status));
    const file = (await res.json()) as PPPFile;
    const rates: PPPRates = {};
    for (const row of file.rows ?? []) {
      const v = row[`ppp_private_consumption_${PPP_BASE_YEAR}`];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        rates[row.country] = { lcu_per_usd_ppp: v, year: PPP_BASE_YEAR };
      }
    }
    if (Object.keys(rates).length === 0) throw new Error('no usable rows');
    return { rates: { ...PPP_FALLBACK, ...rates }, source: file.source, sourceUrl: file.source_url, live: true };
  } catch {
    return {
      rates: PPP_FALLBACK,
      source: 'OECD PPP (built-in fallback rates — data/v2/oecd_ppp.json not loaded)',
      live: false,
    };
  }
}

export function pppRate(rates: PPPRates, country: V2Country | null): number {
  if (!country) return 1;
  return rates[country]?.lcu_per_usd_ppp ?? PPP_FALLBACK[country]?.lcu_per_usd_ppp ?? 1;
}

/** Local currency → USD at PPP. */
export function convertToUSDPPP(amount: number, country: V2Country | null, rates: PPPRates): number {
  const r = pppRate(rates, country);
  return r > 0 ? amount / r : amount;
}

/** USD at PPP → local currency. */
export function convertFromUSDPPP(amount: number, country: V2Country | null, rates: PPPRates): number {
  return amount * pppRate(rates, country);
}

/* --------------------------------------------------------------- formatting */

export interface MoneyBasis {
  /** null when the selected geography has no v2 country mapping. */
  country: V2Country | null;
  ppp: boolean;
  rates: PPPRates;
  /** v1 geography, used for the local-currency label. */
  geo: GeoId;
}

const LOCALE_FOR: Record<GeoId, { currency: string; locale: string }> = {
  US: { currency: 'USD', locale: 'en-US' },
  CAN: { currency: 'CAD', locale: 'en-CA' },
  GBR: { currency: 'GBP', locale: 'en-GB' },
  DEU: { currency: 'EUR', locale: 'de-DE' },
  FRA: { currency: 'EUR', locale: 'fr-FR' },
  JPN: { currency: 'JPY', locale: 'ja-JP' },
};

/** Convert a local-currency amount into the currently displayed basis. */
export function toBasis(amount: number | null, basis: MoneyBasis): number | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  return basis.ppp ? convertToUSDPPP(amount, basis.country, basis.rates) : amount;
}

export function fmtBasisMoney(
  amount: number | null | undefined,
  basis: MoneyBasis,
  opts?: { compact?: boolean }
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const { currency, locale } = basis.ppp ? { currency: 'USD', locale: 'en-US' } : LOCALE_FOR[basis.geo];
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const nf = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: opts?.compact && abs >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  });
  return (negative ? '\u2212' : '') + nf.format(abs);
}

export function basisLabel(basis: MoneyBasis): string {
  if (basis.ppp) return `PPP-normalized (USD, ${PPP_BASE_YEAR} base)`;
  return `Local currency (${LOCALE_FOR[basis.geo].currency})`;
}
