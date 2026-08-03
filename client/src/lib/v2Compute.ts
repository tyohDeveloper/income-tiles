/**
 * One place that turns (income distribution × expenditure survey × user controls) into the
 * numbers the Section 5 and Section 6 tiles render. Used both for the selected country and
 * for every row of the country comparison, so the two can never diverge.
 */
import { DataStore, GeoId, buildModel, deriveView, DEFAULT_TRIM } from './incomeModel';
import { GEO_TO_V2, V2Country } from './ppp';
import { InterpolatedRow, V2Store, pensionRate, rowAtPercentile, studentLoanPayment } from './expenditure';
import { NecessityBreakdown, NecessityOptions, computeNecessityFloor } from './necessity';
import { DiscretionaryBreakdown, computeDiscretionary } from './discretionary';
import { PriceIndex, priceIndexFor } from './regional';
import { EquivalenceScale, HouseholdTypeId } from './householdType';
import { HousingMode, Strictness } from './necessity';

export interface V2Params {
  ppp: boolean;
  housingMode: HousingMode;
  strictness: Strictness;
  equivalenceScale: EquivalenceScale;
  householdType: HouseholdTypeId;
  savingsPct: number;
  region: string;
}

export interface V2Result {
  geo: GeoId;
  country: V2Country;
  /** WID pre-tax national median, local currency. */
  gross: number;
  /** WID post-tax national median, local currency. */
  postTax: number;
  necessity: NecessityBreakdown;
  discretionary: DiscretionaryBreakdown;
  row: InterpolatedRow;
  priceIndex: PriceIndex;
  surveyYear: number;
  surveySource: string;
  dataTier: 'A' | 'B' | 'C';
  placeholder: boolean;
  pensionNote: string;
  studentLoanNote: string;
  /** Percentile the expenditure profile was read at. */
  percentile: number;
}

/** Percentile the v2 layer is evaluated at. The median, per docs/v2-plan.md. */
export const V2_PERCENTILE = 0.5;

export function computeV2ForGeo(
  store: DataStore | undefined,
  v2: V2Store | undefined,
  geo: GeoId,
  year: number,
  params: V2Params,
  opts?: { regionOverride?: string }
): V2Result | null {
  if (!store || !v2) return null;
  const country = GEO_TO_V2[geo];
  if (!country) return null;
  const exp = v2.expenditure[country];
  if (!exp) return null;

  const preModel = buildModel(store, 'wid', 'pretax_national', geo, year);
  const postModel = buildModel(store, 'wid', 'posttax_national', geo, year);
  if (!preModel || !postModel) return null;
  const preView = deriveView(preModel, DEFAULT_TRIM);
  const postView = deriveView(postModel, DEFAULT_TRIM);
  const gross = preView.quantile(V2_PERCENTILE);
  const postTax = postView.quantile(V2_PERCENTILE);
  if (!Number.isFinite(gross) || !Number.isFinite(postTax)) return null;

  const row = rowAtPercentile(exp.dist, V2_PERCENTILE);
  const regionId = opts?.regionOverride ?? params.region;
  const priceIndex = priceIndexFor(regionId, country, v2.rppState, v2.rppMetro, v2.laender);
  const loan = studentLoanPayment(v2.studentLoans, country, V2_PERCENTILE);

  const necessityOpts: NecessityOptions = {
    strictness: params.strictness,
    housingMode: params.housingMode,
    equivalenceScale: params.equivalenceScale,
    householdType: params.householdType,
    studentLoanPayment: loan.amount,
    priceIndex,
    country,
  };
  const necessity = computeNecessityFloor(row, exp.dist, exp.hhType, necessityOpts);
  const pension = pensionRate(v2.pensions, country);
  const discretionary = computeDiscretionary(postTax, necessity, params.savingsPct, pension.pct);

  return {
    geo,
    country,
    gross,
    postTax,
    necessity,
    discretionary,
    row,
    priceIndex,
    surveyYear: exp.dist.year,
    surveySource: exp.dist.source,
    dataTier: exp.dist.data_tier,
    placeholder: !!exp.dist.placeholder,
    pensionNote: pension.note,
    studentLoanNote: loan.note,
    percentile: V2_PERCENTILE,
  };
}

/** Geographies the v2 layer can render, in v1 GeoId terms. */
export function v2Geos(store: DataStore | undefined, v2: V2Store | undefined): GeoId[] {
  const all: GeoId[] = ['US', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN'];
  return all.filter((g) => {
    const c = GEO_TO_V2[g];
    return !!c && !!v2?.expenditure[c] && !!store;
  });
}
