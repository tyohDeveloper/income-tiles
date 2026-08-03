/**
 * Life-stage / household-type selector (docs/v2-plan.md §5, confirmed 2026-08-03).
 *
 * Sizes and compositions are the assumed profiles used for the equivalence scale and the
 * childcare model. They are deliberately round numbers: the underlying surveys publish
 * category spending by household *type*, not by exact size, so a single representative
 * composition per type is the honest simplification.
 *
 * "All households" size 2.5 / 1.7 adults / 0.8 children is the US CES average consumer
 * unit (BLS CES 2024, Table 1101: 2.5 persons, 1.3 earners, 0.7 children under 18) rounded
 * to the OECD-typical composition used across the eight v2 countries.
 */
import { V2Country } from './ppp';
import { ExpenditureDataset, ExpenditureRow } from './expenditure';

export type HouseholdTypeId =
  | 'all'
  | 'single_working'
  | 'couple_working'
  | 'kids_under12'
  | 'kids_teens'
  | 'empty_nesters'
  | 'retiree';

export interface HouseholdTypeMeta {
  id: HouseholdTypeId;
  label: string;
  short: string;
  size: number;
  adults: number;
  children: number;
  /** Children needing paid care (under ~12). Drives the childcare necessity line. */
  childrenInCare: number;
  /** Retirees have no commute, so work transport collapses to a floor share. */
  working: boolean;
}

export const HH_TYPES: Record<HouseholdTypeId, HouseholdTypeMeta> = {
  all: { id: 'all', label: 'All households', short: 'All', size: 2.5, adults: 1.7, children: 0.8, childrenInCare: 0.35, working: true },
  single_working: { id: 'single_working', label: 'Working-age single (25–64)', short: 'Single', size: 1, adults: 1, children: 0, childrenInCare: 0, working: true },
  couple_working: { id: 'couple_working', label: 'Working-age couple (25–64)', short: 'Couple', size: 2, adults: 2, children: 0, childrenInCare: 0, working: true },
  kids_under12: { id: 'kids_under12', label: 'Household with kids under 12', short: 'Kids <12', size: 4, adults: 2, children: 2, childrenInCare: 2, working: true },
  kids_teens: { id: 'kids_teens', label: 'Household with kids 12–18', short: 'Kids 12–18', size: 4, adults: 2, children: 2, childrenInCare: 0, working: true },
  empty_nesters: { id: 'empty_nesters', label: 'Empty nesters (55+)', short: 'Empty nesters', size: 2, adults: 2, children: 0, childrenInCare: 0, working: true },
  retiree: { id: 'retiree', label: 'Retiree (65+, no employment income)', short: 'Retiree', size: 1.5, adults: 1.5, children: 0, childrenInCare: 0, working: false },
};

export const HH_TYPE_ORDER: HouseholdTypeId[] = [
  'all',
  'single_working',
  'couple_working',
  'kids_under12',
  'kids_teens',
  'empty_nesters',
  'retiree',
];

export type EquivalenceScale = 'per_capita' | 'sqrt' | 'oecd_modified';

export function equivalenceFactor(scale: EquivalenceScale, meta: { size: number; adults: number; children: number }): number {
  if (scale === 'per_capita') return Math.max(meta.size, 1);
  if (scale === 'sqrt') return Math.sqrt(Math.max(meta.size, 1));
  return 1 + 0.5 * Math.max(meta.adults - 1, 0) + 0.3 * Math.max(meta.children, 0);
}

/**
 * Household-type row slugs differ per survey. These maps point each of the seven UI
 * categories at the closest published row in each country's by-household-type table.
 * `null` = the survey has no comparable row, so the composition adjustment falls back to
 * the modeled size-ratio path in necessity.ts.
 */
const ROW_MAP: Partial<Record<V2Country, Partial<Record<HouseholdTypeId, string[]>>>> = {
  US: {
    single_working: ['single_working_age'],
    couple_working: ['couple_no_kids'],
    kids_under12: ['with_kids_under6', 'with_kids_under18'],
    kids_teens: ['with_kids_6to17', 'with_kids_under18'],
    empty_nesters: ['couple_no_kids', 'age_55_64'],
    retiree: ['retirees_65plus', 'age_65plus'],
  },
  UK: {
    single_working: ['nonretired_one_person'],
    couple_working: ['nonretired_two_adults'],
    kids_under12: ['two_adults_with_one_or_more_children', 'one_or_two_adults_with_two_or_more_children'],
    kids_teens: ['one_or_two_adults_with_one_child', 'two_adults_with_one_or_more_children'],
    empty_nesters: ['nonretired_two_adults'],
    retiree: ['retired_state_pension_two_adults', 'retired_state_pension_one_person'],
  },
};

/** Population weight of a household-type row, when the survey publishes one. */
function rowWeight(row: ExpenditureRow): number {
  const r = row as unknown as Record<string, unknown>;
  const w = r.n_consumer_units_thousands ?? r.weighted_households_thousands;
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1;
}

/** Pick the closest matching row from a by_household_type dataset. */
export function getExpenditureRow(dataset: ExpenditureDataset | null, hh: HouseholdTypeId): ExpenditureRow | null {
  if (!dataset || dataset.breakdown !== 'by_household_type') return null;
  const country = dataset.country as V2Country;
  const candidates = ROW_MAP[country]?.[hh] ?? [];
  for (const slug of candidates) {
    const hit = dataset.rows.find((r) => r.group === slug);
    if (hit) return hit;
  }
  return null;
}

/** Population-weighted average of a by_household_type dataset — the denominator for ratios. */
export function householdTypeAverage(dataset: ExpenditureDataset | null): ExpenditureRow | null {
  if (!dataset || dataset.rows.length === 0) return null;
  let wSum = 0;
  const cats: Record<string, number> = {};
  let total = 0;
  for (const row of dataset.rows) {
    const w = rowWeight(row);
    wSum += w;
    total += (row.avg_expenditure_total ?? 0) * w;
    for (const [k, v] of Object.entries(row.expenditure_by_category ?? {})) {
      if (typeof v === 'number' && Number.isFinite(v)) cats[k] = (cats[k] ?? 0) + v * w;
    }
  }
  if (wSum <= 0) return null;
  const scaled: Record<string, number> = {};
  for (const [k, v] of Object.entries(cats)) scaled[k] = v / wSum;
  return {
    group: '__weighted_average__',
    avg_income_before_tax: null,
    avg_income_after_tax: null,
    avg_expenditure_total: total / wSum,
    expenditure_by_category: scaled as ExpenditureRow['expenditure_by_category'],
    housing_owner_share: null,
    housing_owner_imputed_rent_estimate: null,
  };
}
