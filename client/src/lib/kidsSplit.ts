/**
 * Section 11 — households with children versus households without, side by side.
 *
 * Sections 6 and 8 both average over household composition, which hides the single largest
 * source of variance in discretionary income inside a country. A household with two children
 * under 18 earns materially more gross income than a childless household at the same
 * percentile — two earners, later career stage — and in most of these countries still ends up
 * with less money left over, because childcare, a larger dwelling and a wider necessity floor
 * more than absorb the premium. The Nordics are the interesting exception, and that contrast is
 * the reason the section exists.
 *
 * The arithmetic is deliberately shallow: gross → post-tax → necessity floor → discretionary,
 * with no savings target and no pension deduction, so the two columns differ *only* by
 * household composition. Layering the v2 savings and pension model on top would make the
 * with/no-kids delta a function of sidebar state, which is not what this section is measuring.
 */
import { PPPRates, V2Country, V3_COUNTRY_ORDER, convertToUSDPPP } from './ppp';
import { KIDS_TIERS, KidsSide, KidsSplitBundle, KidsTier } from './v4data';

export interface KidsCell {
  gross: number | null;
  postTax: number | null;
  effectiveRate: number | null;
  necessity: number | null;
  discretionary: number | null;
  /** Everything above, converted to USD at PPP — what the table prints. */
  grossPPP: number | null;
  postTaxPPP: number | null;
  necessityPPP: number | null;
  discretionaryPPP: number | null;
}

export interface KidsTierRow {
  tier: KidsTier;
  withKids: KidsCell;
  noKids: KidsCell;
  /** with-kids minus no-kids, USD at PPP. Positive = with-kids households are ahead. */
  grossDeltaPPP: number | null;
  discretionaryDeltaPPP: number | null;
}

export interface KidsCountryBlock {
  country: V2Country;
  label: string;
  source: string;
  sourceUrl: string;
  modeledFrom: V2Country | null;
  rows: KidsTierRow[];
  /** Mean discretionary delta across the three tiers — used to rank the closing of the gap. */
  meanDiscretionaryDeltaPPP: number | null;
  unavailable: string | null;
}

export interface KidsSplitResult {
  blocks: KidsCountryBlock[];
  placeholder: boolean;
  asOf: string;
}

export const KIDS_LABEL: Record<V2Country, string> = {
  US: 'United States',
  DE: 'Germany',
  UK: 'United Kingdom',
  NO: 'Norway',
  SE: 'Sweden',
  FI: 'Finland',
  CH: 'Switzerland',
  JP: 'Japan',
};

export const KIDS_SPLIT_SUBTITLE =
  'Households with children have higher gross income at every tier but often less discretionary income due to childcare and expanded necessity floor. Nordic countries close this gap through subsidized childcare and parental leave.';

function cellFor(side: KidsSide, tier: KidsTier, country: V2Country, rates: PPPRates): KidsCell {
  const gross = side.gross[tier];
  const rate = side.taxRate[tier];
  const necessity = side.necessity[tier];
  const postTax = gross !== null && rate !== null ? gross * (1 - rate) : gross;
  const discretionary = postTax !== null && necessity !== null ? postTax - necessity : null;
  const ppp = (v: number | null) => (v === null ? null : convertToUSDPPP(v, country, rates));
  return {
    gross,
    postTax,
    effectiveRate: rate,
    necessity,
    discretionary,
    grossPPP: ppp(gross),
    postTaxPPP: ppp(postTax),
    necessityPPP: ppp(necessity),
    discretionaryPPP: ppp(discretionary),
  };
}

export function computeKidsSplit(bundle: KidsSplitBundle | undefined, rates: PPPRates): KidsSplitResult {
  const blocks: KidsCountryBlock[] = [];
  for (const country of V3_COUNTRY_ORDER) {
    const data = bundle?.byCountry[country];
    if (!data) {
      blocks.push({
        country,
        label: KIDS_LABEL[country],
        source: '—',
        sourceUrl: '',
        modeledFrom: null,
        rows: [],
        meanDiscretionaryDeltaPPP: null,
        unavailable: `No kids-split expenditure file loaded for ${KIDS_LABEL[country]} yet.`,
      });
      continue;
    }
    const rows: KidsTierRow[] = KIDS_TIERS.map((tier) => {
      const withKids = cellFor(data.withKids, tier, country, rates);
      const noKids = cellFor(data.noKids, tier, country, rates);
      return {
        tier,
        withKids,
        noKids,
        grossDeltaPPP:
          withKids.grossPPP !== null && noKids.grossPPP !== null ? withKids.grossPPP - noKids.grossPPP : null,
        discretionaryDeltaPPP:
          withKids.discretionaryPPP !== null && noKids.discretionaryPPP !== null
            ? withKids.discretionaryPPP - noKids.discretionaryPPP
            : null,
      };
    });
    const deltas = rows.map((r) => r.discretionaryDeltaPPP).filter((v): v is number => v !== null);
    blocks.push({
      country,
      label: KIDS_LABEL[country],
      source: data.source,
      sourceUrl: data.sourceUrl,
      modeledFrom: data.modeledFrom,
      rows,
      meanDiscretionaryDeltaPPP: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null,
      unavailable: rows.every((r) => r.withKids.discretionary === null) ? `No comparable figures for ${KIDS_LABEL[country]}.` : null,
    });
  }
  return { blocks, placeholder: bundle?.placeholder ?? true, asOf: bundle?.asOf ?? '' };
}
