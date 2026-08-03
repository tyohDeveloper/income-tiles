/**
 * Sub-national price adjustment.
 *
 * US: BEA Regional Price Parities, state + top-50 metro
 * (https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area).
 * Germany: BBSR/IW regional price index by Bundesland, baseline 100
 * (data/v2/de_laender_costs.json).
 * Every other v2 country is national-only — the plan is explicit that sub-national price
 * data below the country level is scarce and inconsistent (docs/v2-plan.md).
 */
import { RegionalFile } from './expenditure';
import { V2Country } from './ppp';

export interface RegionOption {
  id: string;
  label: string;
  group: 'National' | 'States' | 'Metros' | 'Bundesländer';
}

/** Multipliers applied to necessity components (1.0 = national average). */
export interface PriceIndex {
  housing: number;
  goods: number;
  utilities: number;
  services: number;
  allItems: number;
  label: string;
  /** true when the index came from a published regional table. */
  published: boolean;
}

export const NATIONAL_INDEX: PriceIndex = {
  housing: 1,
  goods: 1,
  utilities: 1,
  services: 1,
  allItems: 1,
  label: 'National average',
  published: true,
};

export function regionSupported(country: V2Country | null): boolean {
  return country === 'US' || country === 'DE';
}

export function regionOptions(
  country: V2Country | null,
  rppState: RegionalFile | null,
  rppMetro: RegionalFile | null,
  laender: RegionalFile | null
): RegionOption[] {
  const out: RegionOption[] = [{ id: 'national', label: 'National average', group: 'National' }];
  if (country === 'US') {
    for (const r of rppState?.rows ?? []) {
      if (r.geo_name && r.geo_name !== 'United States') out.push({ id: `state:${r.geo_name}`, label: r.geo_name, group: 'States' });
    }
    for (const r of rppMetro?.rows ?? []) {
      if (r.geo_name) out.push({ id: `metro:${r.geo_name}`, label: shortMetro(r.geo_name), group: 'Metros' });
    }
  }
  if (country === 'DE') {
    for (const r of laender?.rows ?? []) {
      const name = r.group ?? r.geo_name;
      if (name && name !== 'Deutschland') out.push({ id: `land:${name}`, label: name.replace(/-/g, '-'), group: 'Bundesländer' });
    }
  }
  return out;
}

function shortMetro(name: string): string {
  return name.replace(/\s*\((Metropolitan|Micropolitan) Statistical Area\)\s*$/, '');
}

export function priceIndexFor(
  regionId: string,
  country: V2Country | null,
  rppState: RegionalFile | null,
  rppMetro: RegionalFile | null,
  laender: RegionalFile | null
): PriceIndex {
  if (!regionId || regionId === 'national' || !regionSupported(country)) return NATIONAL_INDEX;
  const [kind, ...rest] = regionId.split(':');
  const name = rest.join(':');
  if (country === 'US') {
    const file = kind === 'metro' ? rppMetro : rppState;
    const row = file?.rows?.find((r) => r.geo_name === name);
    if (row) {
      const pick = (v: number | null | undefined, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v) ? v / 100 : fallback;
      const all = pick(row.rpp_all_items_2024, 1);
      return {
        housing: pick(row.rpp_services_housing_rents_2024, all),
        goods: pick(row.rpp_goods_2024, all),
        utilities: pick(row.rpp_services_utilities_2024, all),
        services: pick(row.rpp_services_other_2024, all),
        allItems: all,
        label: kind === 'metro' ? shortMetro(name) : name,
        published: true,
      };
    }
  }
  if (country === 'DE') {
    const row = laender?.rows?.find((r) => (r.group ?? r.geo_name) === name);
    const idx = row?.regional_price_index_2022_baseline_100;
    if (typeof idx === 'number' && Number.isFinite(idx)) {
      const f = idx / 100;
      return { housing: f, goods: f, utilities: f, services: f, allItems: f, label: name, published: true };
    }
  }
  return { ...NATIONAL_INDEX, label: name || 'National average', published: false };
}
