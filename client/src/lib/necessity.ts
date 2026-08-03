/**
 * The necessity floor — how much of a household's post-tax income is committed before
 * anything discretionary happens.
 *
 * Three strictness levels (docs/v2-plan.md):
 *   minimal      housing + food at home + healthcare OOP + work transport + childcare + student loans
 *   bls_basic    + moderated food away + communications + personal care
 *   living_wage  + basic apparel + civic engagement + an entertainment floor
 *
 * Everything is per household in the survey's own currency, then divided by the chosen
 * equivalence factor so it can be read against WID's per-equal-split-adult income.
 */
import { CategoryKey, ExpenditureDataset, ExpenditureRow, InterpolatedRow, V2Provenance } from './expenditure';
import { EquivalenceScale, HH_TYPES, HouseholdTypeId, equivalenceFactor, getExpenditureRow, householdTypeAverage } from './householdType';
import { NATIONAL_INDEX, PriceIndex } from './regional';
import { V2Country } from './ppp';

export type Strictness = 'minimal' | 'bls_basic' | 'living_wage';
export type HousingMode = 'cash' | 'rental_equivalent';

export const STRICTNESS_LEVELS: { id: Strictness; label: string; blurb: string }[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    blurb: 'Shelter, food at home, out-of-pocket healthcare, work transport, childcare and student-loan minimums only.',
  },
  {
    id: 'bls_basic',
    label: 'BLS Basic',
    blurb: 'Adds moderated food away from home, phone and broadband, and personal care — the BLS basic bundle.',
  },
  {
    id: 'living_wage',
    label: 'Living Wage',
    blurb: 'Adds basic apparel, civic engagement and a minimum entertainment allowance, following the MIT Living Wage bundle.',
  },
];

export interface NecessityOptions {
  strictness: Strictness;
  housingMode: HousingMode;
  equivalenceScale: EquivalenceScale;
  householdType: HouseholdTypeId;
  /** Annualized minimum student-loan payment for this income position. */
  studentLoanPayment: number;
  /** Sub-national price multipliers; NATIONAL_INDEX for the national view. */
  priceIndex?: PriceIndex;
  country: V2Country;
}

export interface NecessityBreakdown {
  housing: number;
  food: number;
  healthcare: number;
  transport: number;
  childcare: number;
  studentLoans: number;
  communications: number;
  personalCare: number;
  apparel: number;
  civic: number;
  /** Living-wage only: a minimum entertainment allowance. */
  entertainmentFloor: number;
  total: number;
  equivalizedTotal: number;
  equivalenceFactorValue: number;
  provenance: V2Provenance;
  /** Categories that had to be modeled because the survey publishes no figure. */
  modeled: string[];
  notes: string[];
  /** Household-composition multipliers actually applied, for the info popover. */
  compositionSource: 'survey' | 'size_ratio' | 'none';
}

export interface NecessityComponent {
  key: keyof NecessityBreakdown;
  label: string;
  amount: number;
  /** Included at the current strictness level. */
  included: boolean;
  info: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function cat(row: ExpenditureRow, c: CategoryKey): number | null {
  return num(row.expenditure_by_category?.[c]);
}

/**
 * Net childcare cost per child, as a fraction of the country's average total household
 * expenditure. Calibrated so the US lands near $11.5k/child/year (Child Care Aware national
 * average for centre-based care) and scaled down by each country's public subsidy using
 * OECD "Net childcare costs" (https://www.oecd.org/en/data/indicators/net-childcare-costs.html).
 * Modeled, not surveyed — every childcare figure is badged Modeled.
 */
const CHILDCARE_NET_FACTOR: Record<V2Country, number> = {
  US: 1.0,
  CH: 1.0,
  UK: 0.8,
  JP: 0.35,
  DE: 0.25,
  FI: 0.2,
  NO: 0.2,
  SE: 0.15,
};
const CHILDCARE_BASE_SHARE = 0.15;

/**
 * Household-composition multipliers per category, derived from the survey's own
 * by-household-type table when one exists. Falls back to a square-root size ratio.
 */
function compositionMultipliers(
  hhDataset: ExpenditureDataset | null,
  hh: HouseholdTypeId
): { mult: Partial<Record<CategoryKey, number>>; source: 'survey' | 'size_ratio' | 'none' } {
  if (hh === 'all') return { mult: {}, source: 'none' };
  const row = getExpenditureRow(hhDataset, hh);
  const avg = householdTypeAverage(hhDataset);
  if (row && avg) {
    const mult: Partial<Record<CategoryKey, number>> = {};
    for (const key of Object.keys(row.expenditure_by_category ?? {}) as CategoryKey[]) {
      const a = cat(row, key);
      const b = cat(avg, key);
      if (a !== null && b !== null && b > 0) mult[key] = Math.min(Math.max(a / b, 0.25), 4);
    }
    return { mult, source: 'survey' };
  }
  // No comparable published row: scale the size-elastic categories by the square-root ratio.
  const ratio = Math.sqrt(HH_TYPES[hh].size) / Math.sqrt(HH_TYPES.all.size);
  const mult: Partial<Record<CategoryKey, number>> = {
    housing: 1 + (ratio - 1) * 0.6,
    food_at_home: ratio,
    food_away: ratio,
    apparel: ratio,
    personal_care: ratio,
    healthcare_oop: 1 + (ratio - 1) * 0.7,
    transport_work: 1 + (ratio - 1) * 0.5,
    transport_total: 1 + (ratio - 1) * 0.5,
    communications: 1 + (ratio - 1) * 0.3,
    entertainment: ratio,
  };
  return { mult, source: 'size_ratio' };
}

export function computeNecessityFloor(
  row: InterpolatedRow,
  dist: ExpenditureDataset,
  hhDataset: ExpenditureDataset | null,
  opts: NecessityOptions
): NecessityBreakdown {
  const px = opts.priceIndex ?? NATIONAL_INDEX;
  const meta = HH_TYPES[opts.householdType];
  const total = num(row.avg_expenditure_total) ?? 0;
  const modeled: string[] = [];
  const notes: string[] = [];
  const { mult, source: compositionSource } = compositionMultipliers(hhDataset, opts.householdType);
  const m = (c: CategoryKey) => mult[c] ?? 1;

  /* housing ------------------------------------------------------------- */
  const housingPublished = cat(row, 'housing') ?? 0.33 * total;
  if (cat(row, 'housing') === null) modeled.push('housing');
  const ownerShare = num(row.housing_owner_share);
  const imputed = num(row.housing_owner_imputed_rent_estimate);
  let housing = housingPublished;
  if (opts.housingMode === 'rental_equivalent') {
    if (ownerShare !== null && imputed !== null) {
      housing = (1 - ownerShare) * housingPublished + ownerShare * imputed;
      notes.push(
        `Rental equivalent: owners (${(ownerShare * 100).toFixed(0)}% of this group) are charged imputed rent instead of cash mortgage outlays; renters unchanged.`
      );
    } else {
      modeled.push('housing (rental equivalent)');
      notes.push('This survey publishes no owner share or imputed rent for this group — housing falls back to published cash outlays.');
    }
  } else {
    notes.push('Cash outlays: shelter as the survey reports it (mortgage or rent, plus utilities and insurance).');
  }
  housing = housing * m('housing') * px.housing;

  /* food ---------------------------------------------------------------- */
  const foodHome = (cat(row, 'food_at_home') ?? 0.078 * total) * m('food_at_home');
  if (cat(row, 'food_at_home') === null) modeled.push('food at home');
  const foodAway = (cat(row, 'food_away') ?? 0.05 * total) * m('food_away');
  const foodAwayShare = opts.strictness === 'minimal' ? 0 : opts.strictness === 'bls_basic' ? 0.5 : 1;
  const food = (foodHome + foodAway * foodAwayShare) * px.goods;

  /* healthcare ---------------------------------------------------------- */
  const hcPublished = cat(row, 'healthcare_oop');
  if (hcPublished === null) modeled.push('out-of-pocket healthcare');
  const healthcare = (hcPublished ?? 0.05 * total) * m('healthcare_oop') * px.services;

  /* transport ----------------------------------------------------------- */
  const tWork = cat(row, 'transport_work');
  const tTotal = cat(row, 'transport_total');
  let transportBase: number;
  if (tWork !== null) transportBase = tWork;
  else if (tTotal !== null) {
    transportBase = tTotal * 0.6;
    modeled.push('work transport (60% of total transport)');
  } else {
    transportBase = 0.115 * total;
    modeled.push('work transport');
  }
  if (!meta.working) {
    transportBase *= 0.55;
    notes.push('Retiree profile: work transport reduced to a mobility floor (55% of the commuting figure).');
  }
  const transport = transportBase * m('transport_work') * px.goods;

  /* childcare ----------------------------------------------------------- */
  const publishedChildcare = cat(row, 'childcare');
  let childcare = 0;
  if (meta.childrenInCare > 0 || opts.householdType === 'all') {
    if (publishedChildcare !== null && publishedChildcare > 0) {
      childcare = publishedChildcare * (meta.childrenInCare / Math.max(HH_TYPES.all.childrenInCare, 0.01));
    } else {
      childcare = meta.childrenInCare * CHILDCARE_BASE_SHARE * total * (CHILDCARE_NET_FACTOR[opts.country] ?? 1);
      modeled.push('childcare');
    }
    childcare *= px.services;
  }
  if (opts.householdType === 'all' && childcare > 0) {
    notes.push(
      'All-households view amortizes childcare across every household, including those with no children — it understates the cost for affected households by roughly 4×. Pick a with-children household type to see the real figure.'
    );
  }

  /* the smaller lines --------------------------------------------------- */
  const communications = ((cat(row, 'communications') ?? 0.021 * total) * m('communications')) * px.services;
  if (cat(row, 'communications') === null) modeled.push('communications');
  const personalCare = ((cat(row, 'personal_care') ?? 0.012 * total) * m('personal_care')) * px.goods;
  if (cat(row, 'personal_care') === null) modeled.push('personal care');
  const apparel = ((cat(row, 'apparel') ?? 0.026 * total) * m('apparel')) * px.goods * 0.7;
  if (cat(row, 'apparel') === null) modeled.push('apparel');
  const civicBase = cat(row, 'cash_contributions');
  const civic = (civicBase ?? 0.01 * total) * 0.5 * px.services;
  if (civicBase === null) modeled.push('civic engagement');
  const entertainmentFloor = (cat(row, 'entertainment') ?? 0.048 * total) * 0.3 * px.services;

  const studentLoans = Math.max(opts.studentLoanPayment, 0);

  /* strictness roll-up -------------------------------------------------- */
  let sum = housing + food + healthcare + transport + childcare + studentLoans;
  if (opts.strictness !== 'minimal') sum += communications + personalCare;
  if (opts.strictness === 'living_wage') sum += apparel + civic + entertainmentFloor;

  /*
   * Unit bridge (docs/v2-plan.md §3). Income is per equal-split adult; expenditure is per
   * household. The necessity floor is therefore expressed *relative to the average
   * household*, whose per-equal-split-adult income is exactly what the median threshold
   * measures: divide by the ratio of the selected household's equivalence factor to the
   * average household's. A four-person household has roughly twice the equal-split adults
   * of a one-person household, so its raw floor is deflated accordingly — while the
   * composition multipliers above still raise the raw floor for the extra people.
   * At the "All households" default the ratio is exactly 1, so the floor is read directly
   * against post-tax income with no adjustment.
   */
  const ef = equivalenceFactor(opts.equivalenceScale, meta) / equivalenceFactor(opts.equivalenceScale, HH_TYPES.all);

  let provenance: V2Provenance = row.provenance;
  if (provenance !== 'placeholder' && modeled.length > 0) provenance = 'modeled';
  if (provenance === 'published' && compositionSource === 'size_ratio') provenance = 'modeled';

  return {
    housing,
    food,
    healthcare,
    transport,
    childcare,
    studentLoans,
    communications,
    personalCare,
    apparel,
    civic,
    entertainmentFloor,
    total: sum,
    equivalizedTotal: sum / ef,
    equivalenceFactorValue: ef,
    provenance,
    modeled,
    notes,
    compositionSource,
  };
}

export function necessityComponents(b: NecessityBreakdown, strictness: Strictness): NecessityComponent[] {
  const basic = strictness !== 'minimal';
  const living = strictness === 'living_wage';
  return [
    { key: 'housing', label: 'Housing', amount: b.housing, included: true, info: 'Shelter plus utilities, at the selected housing mode and regional price level.' },
    { key: 'food', label: 'Food', amount: b.food, included: true, info: 'Food at home always; food away from home enters at half weight in BLS Basic and full weight in Living Wage.' },
    { key: 'healthcare', label: 'Healthcare OOP', amount: b.healthcare, included: true, info: 'Out-of-pocket healthcare as the survey reports it. BLS CES undercounts OOP healthcare by roughly 20% against BEA PCE — the level bias is disclosed rather than corrected (docs/v2-plan.md §6).' },
    { key: 'transport', label: 'Work transport', amount: b.transport, included: true, info: 'Commuting and work-related vehicle costs. Where a survey publishes only total transport, 60% of it is treated as work-related.' },
    { key: 'childcare', label: 'Childcare', amount: b.childcare, included: true, info: 'Modeled from the country\u2019s net childcare cost (OECD) applied to the number of children needing paid care in the selected household type.' },
    { key: 'studentLoans', label: 'Student loans', amount: b.studentLoans, included: true, info: 'Minimum required payment, amortized from the Fed SCF mean balance. Near zero in the tuition-free countries — a real result, not a gap.' },
    { key: 'communications', label: 'Communications', amount: b.communications, included: basic, info: 'Phone and broadband. Enters at BLS Basic and above.' },
    { key: 'personalCare', label: 'Personal care', amount: b.personalCare, included: basic, info: 'Personal-care goods and services. Enters at BLS Basic and above.' },
    { key: 'apparel', label: 'Basic apparel', amount: b.apparel, included: living, info: '70% of published apparel spending, following the MIT Living Wage basic-clothing allowance. Living Wage only.' },
    { key: 'civic', label: 'Civic engagement', amount: b.civic, included: living, info: 'Half of published cash contributions, following the MIT Living Wage civic line. Living Wage only.' },
    { key: 'entertainmentFloor', label: 'Entertainment floor', amount: b.entertainmentFloor, included: living, info: '30% of published entertainment spending as a minimum social-participation allowance. Living Wage only.' },
  ];
}
