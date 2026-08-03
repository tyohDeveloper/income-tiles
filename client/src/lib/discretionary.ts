/**
 * Discretionary income = post-tax income − necessity floor − voluntary savings target.
 *
 * Savings normalization (docs/v2-plan.md §4): mandatory pension contributions are already
 * excluded from WID/DINA post-tax income, so they are never subtracted again here. The
 * voluntary target is applied to what is left *after* necessities, and the country's
 * mandatory rate is surfaced in the UI so a 5%-saving German and a 15%-saving American can
 * be read against comparable retirement security.
 */
import { NecessityBreakdown } from './necessity';

export interface DiscretionaryBreakdown {
  post_tax: number;
  necessity_total: number;
  before_savings: number;
  voluntary_savings_amount: number;
  after_savings: number;
  /** Discretionary before savings as a share of post-tax income. */
  share_of_post_tax: number;
  /** true when necessities exceed post-tax income entirely. */
  belowFloor: boolean;
  mandatoryPensionPct: number | null;
}

export function computeDiscretionary(
  postTaxIncome: number,
  necessity: NecessityBreakdown,
  savingsTargetPct: number,
  mandatoryPensionPct: number | null
): DiscretionaryBreakdown {
  const necessityTotal = necessity.equivalizedTotal;
  const before = postTaxIncome - necessityTotal;
  const rate = Math.min(Math.max(savingsTargetPct, 0), 100) / 100;
  const savings = before > 0 ? before * rate : 0;
  return {
    post_tax: postTaxIncome,
    necessity_total: necessityTotal,
    before_savings: before,
    voluntary_savings_amount: savings,
    after_savings: before - savings,
    share_of_post_tax: postTaxIncome > 0 ? before / postTaxIncome : 0,
    belowFloor: before <= 0,
    mandatoryPensionPct,
  };
}

export const SAVINGS_MARKS: { value: number; label: string; blurb: string }[] = [
  { value: 10, label: '10%', blurb: 'The legacy rule of thumb.' },
  { value: 15, label: '15%', blurb: 'Current mainstream guidance (Fidelity, Vanguard, T. Rowe Price).' },
  { value: 20, label: '20%', blurb: 'Aggressive / FIRE.' },
];

export interface WaterfallStep {
  key: string;
  label: string;
  value: number;
  /** Amount removed to reach this step from the previous one. */
  delta: number | null;
  tone: 'gross' | 'tax' | 'necessity' | 'savings';
}

export function waterfallSteps(gross: number, d: DiscretionaryBreakdown): WaterfallStep[] {
  return [
    { key: 'gross', label: 'Pre-tax', value: gross, delta: null, tone: 'gross' },
    { key: 'post_tax', label: 'Post-tax', value: d.post_tax, delta: d.post_tax - gross, tone: 'tax' },
    { key: 'post_necessity', label: 'After necessities', value: d.before_savings, delta: -d.necessity_total, tone: 'necessity' },
    { key: 'post_savings', label: 'After savings target', value: d.after_savings, delta: -d.voluntary_savings_amount, tone: 'savings' },
  ];
}
