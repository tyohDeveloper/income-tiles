/**
 * v4.1 sections — Section 11, households with children versus households without.
 *
 * Eight compact country blocks rather than one wide table: the comparison being made is
 * *within* a country (with-kids against no-kids), and a single table with sixteen value columns
 * pushes the reader to compare across countries instead, which is Section 8's job.
 */
import { Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SectionHeading } from '@/components/dashboard/V3Sections';
import { KIDS_SPLIT_SUBTITLE, KidsCell, KidsCountryBlock, KidsSplitResult, KidsTierRow } from '@/lib/kidsSplit';
import { KIDS_TIER_LABELS } from '@/lib/v4data';
import { V2Country } from '@/lib/ppp';
import { cn } from '@/lib/utils';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function money(v: number | null, compact = false): string {
  if (v === null || !Number.isFinite(v)) return '\u2014';
  const neg = v < 0;
  const abs = Math.abs(v);
  const s = compact && abs >= 1_000_000 ? USD_COMPACT.format(abs) : USD.format(abs);
  return (neg ? '\u2212' : '') + s;
}

/**
 * The mid-numbers — post-tax income and the necessity floor — live behind a hover rather than
 * on the face. They are the arithmetic between gross and discretionary, useful when a delta
 * looks surprising, but printing four numbers per cell would make eight blocks unreadable.
 */
function cellTitle(cell: KidsCell, which: string): string {
  const rate = cell.effectiveRate !== null ? `${(cell.effectiveRate * 100).toFixed(0)}%` : '\u2014';
  return [
    `${which}`,
    `gross ${money(cell.grossPPP)}`,
    `\u2212 tax at ${rate} \u2192 post-tax ${money(cell.postTaxPPP)}`,
    `\u2212 necessity floor ${money(cell.necessityPPP)}`,
    `= discretionary ${money(cell.discretionaryPPP)}`,
  ].join('\n');
}

function DeltaChip({ value, testId }: { value: number | null; testId: string }) {
  if (value === null || !Number.isFinite(value))
    return (
      <span className="text-muted-foreground/60" data-testid={testId}>
        —
      </span>
    );
  const flat = Math.abs(value) < 100;
  return (
    <span
      className={cn('tnum font-medium', flat ? 'text-muted-foreground' : value > 0 ? 'text-primary' : 'text-destructive')}
      data-testid={testId}
    >
      {value >= 0 ? '+' : '\u2212'}
      {money(Math.abs(value), true).replace('$', '$')}
    </span>
  );
}

function TierRow({ row, country }: { row: KidsTierRow; country: V2Country }) {
  const tier = KIDS_TIER_LABELS[row.tier];
  return (
    <tr className="border-b border-border/40 last:border-0" data-testid={`row-kids-${country}-${row.tier}`}>
      <th scope="row" className="px-2 py-1.5 text-left font-medium text-muted-foreground">
        {tier}
      </th>
      <td className="px-2 py-1.5 text-right align-top" title={cellTitle(row.withKids, 'With children')}>
        <span className="flex flex-col items-end leading-tight">
          <span className="tnum font-medium" data-testid={`text-kids-${country}-${row.tier}-withkids-gross`}>
            {money(row.withKids.grossPPP, true)}
          </span>
          <span
            className="tnum text-[10px] text-muted-foreground"
            data-testid={`text-kids-${country}-${row.tier}-withkids-disc`}
          >
            {money(row.withKids.discretionaryPPP, true)}
          </span>
        </span>
      </td>
      <td className="px-2 py-1.5 text-right align-top" title={cellTitle(row.noKids, 'No children')}>
        <span className="flex flex-col items-end leading-tight">
          <span className="tnum font-medium" data-testid={`text-kids-${country}-${row.tier}-nokids-gross`}>
            {money(row.noKids.grossPPP, true)}
          </span>
          <span
            className="tnum text-[10px] text-muted-foreground"
            data-testid={`text-kids-${country}-${row.tier}-nokids-disc`}
          >
            {money(row.noKids.discretionaryPPP, true)}
          </span>
        </span>
      </td>
      <td className="px-2 py-1.5 text-right align-top">
        <span className="flex flex-col items-end leading-tight">
          <DeltaChip value={row.grossDeltaPPP} testId={`text-kids-${country}-${row.tier}-delta-gross`} />
          <span className="text-[10px]">
            <DeltaChip value={row.discretionaryDeltaPPP} testId={`text-kids-${country}-${row.tier}-delta-disc`} />
          </span>
        </span>
      </td>
    </tr>
  );
}

function CountryBlock({ block, isSelected }: { block: KidsCountryBlock; isSelected: boolean }) {
  const gap = block.meanDiscretionaryDeltaPPP;
  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden p-0 transition-shadow duration-150',
        isSelected
          ? 'border-2 border-primary bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
          : 'border border-card-border'
      )}
      data-testid={`card-kids-${block.country}`}
    >
      <div className="flex items-baseline justify-between gap-2 px-2.5 pb-1.5 pt-2">
        <span className={cn('text-xs tracking-tight', isSelected ? 'font-bold' : 'font-semibold')}>{block.label}</span>
        {gap !== null && (
          <span
            className={cn('tnum text-[10px] font-medium', gap >= 0 ? 'text-primary' : 'text-destructive')}
            title="Mean with-kids minus no-kids discretionary income across the three tiers."
            data-testid={`text-kids-gap-${block.country}`}
          >
            {gap >= 0 ? '+' : '\u2212'}
            {money(Math.abs(gap), true)} mean gap
          </span>
        )}
      </div>

      {block.unavailable ? (
        <p className="px-2.5 pb-2.5 text-[11px] text-muted-foreground" data-testid={`text-kids-unavailable-${block.country}`}>
          {block.unavailable}
        </p>
      ) : (
        <table className="w-full text-[11px]">
          <caption className="sr-only">
            {block.label}: gross and discretionary income for households with and without children, USD at PPP
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Tier
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                With kids
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                No kids
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                &Delta;
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <TierRow key={r.tier} row={r} country={block.country} />
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-auto px-2.5 pb-2 pt-1.5 text-[10px] leading-snug text-muted-foreground/80">
        {block.modeledFrom ? `Household-type shares modeled from ${block.modeledFrom}. ` : ''}
        {block.sourceUrl ? (
          <a href={block.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
            {block.source}
          </a>
        ) : (
          block.source
        )}
      </p>
    </Card>
  );
}

export function KidsSplitSection({ result, selected }: { result: KidsSplitResult; selected: V2Country | null }) {
  return (
    <section aria-labelledby="h-kids" data-testid="section-kids-split">
      <SectionHeading
        id="kids"
        title="With children, without children"
        hint="Gross income on top, discretionary income underneath — at three tiers, in eight countries."
        meta={`USD at PPP${result.placeholder ? ' \u00b7 indicative values \u2014 v4.1 kids-split file pending' : ''}`}
        right={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground hover:text-foreground"
                data-testid="button-info-kids-split"
              >
                <Info className="h-3 w-3" /> How to read this
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-2 text-[11px] leading-relaxed" data-testid="popover-kids-split">
              <p>
                Each block shows one country. Rows are income tiers; the top number in a cell is gross income, the
                smaller number underneath is what is left after tax and the necessity floor.
              </p>
              <p>
                The &Delta; column is with-kids minus no-kids: green means households with children come out ahead, red
                means they do not. Hover any cell for the post-tax and necessity mid-numbers.
              </p>
              <p className="text-muted-foreground">
                No savings target and no pension deduction are applied here, so the two columns differ only by household
                composition rather than by sidebar state.
              </p>
            </PopoverContent>
          </Popover>
        }
      />

      <p className="mb-2.5 max-w-[95ch] text-[11px] leading-relaxed text-muted-foreground">{KIDS_SPLIT_SUBTITLE}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="grid-kids-split">
        {result.blocks.map((b) => (
          <CountryBlock key={b.country} block={b} isSelected={b.country === selected} />
        ))}
      </div>
    </section>
  );
}
