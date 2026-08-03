/**
 * v3 sections — Outliers (7), cross-country discretionary by tier (8), non-monetary benefits
 * (9) and data sources (10). Kept in one file because they share the section chrome and none
 * of them is large enough to justify its own module.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsUpDown, ExternalLink, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DistributionModel, GeoId } from '@/lib/incomeModel';
import { ComputedTile } from '@/lib/tiles';
import { TileCard } from '@/components/dashboard/TileCard';
import { OUTLIER_FOOTNOTE, ForbesBundle, BenefitsBundle, benefitRanks, forbesFor, V3_AS_OF } from '@/lib/v3data';
import {
  CROSS_COLUMNS,
  CROSS_COLUMN_SLUGS,
  CROSS_PERCENTILE_LABELS,
  CrossCountryResult,
  CrossRow,
  MEDIAN_2SIGMA,
  MEDIAN_2SIGMA_TOOLTIP,
  SortDir,
  sortCrossRows,
} from '@/lib/crossCountry';
import { GEO_TO_V2, V2Country, V3_COUNTRY_ORDER } from '@/lib/ppp';
import { DataTier, tierLabel } from '@/lib/expenditure';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------ shared chrome */

export function SectionHeading({
  id,
  title,
  hint,
  meta,
  right,
}: {
  id: string;
  title: string;
  hint: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={`h-${id}`} className="text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {meta && <p className="text-[11px] text-muted-foreground/80">{meta}</p>}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function TierBadge({ tier, extra }: { tier: DataTier; extra?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider',
            tier === 'A' ? 'bg-primary/12 text-primary' : tier === 'B' ? 'bg-muted text-muted-foreground' : 'bg-chart-4/15 text-chart-4'
          )}
          data-testid={`badge-tier-${tier}`}
        >
          {tier}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1.5 text-xs leading-relaxed">
        <p>{tierLabel(tier)}</p>
        {extra && <p className="text-muted-foreground">{extra}</p>}
      </PopoverContent>
    </Popover>
  );
}

function CaveatCard({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <Card className="mt-3 border-card-border bg-muted/25 p-3.5 text-[11px] leading-relaxed text-muted-foreground" data-testid={testId}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <TriangleAlert className="h-3.5 w-3.5 text-chart-4" />
        {title}
      </div>
      {children}
    </Card>
  );
}

/* ================================================== Section 7 — Outliers */

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function OutlierSection({
  tiles,
  forbes,
  geo,
  model,
  compareLabel,
  compareGeo,
  trimActive,
}: {
  tiles: { tile: ComputedTile; compare: ComputedTile | null }[];
  forbes: ForbesBundle;
  geo: GeoId;
  model: DistributionModel;
  compareLabel?: string;
  compareGeo?: GeoId;
  trimActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // The published list covers all eight countries; show only the selected one.
  const { entries: list, aggregateIncomeUSD: aggregate } = useMemo(
    () => forbesFor(forbes, GEO_TO_V2[geo] ?? null),
    [forbes, geo]
  );

  return (
    <section aria-labelledby="h-outliers" data-testid="section-outliers">
      <SectionHeading
        id="outliers"
        title="Outliers — the extreme tail"
        hint="The top hundredth of the top percent, and the ten largest individual incomes."
        meta={forbes.placeholder ? 'Named list pending — placeholder values' : `Named list as of ${forbes.asOf}`}
        right={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            data-testid="button-toggle-outliers"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {open ? 'Hide detail' : 'Show detail'}
          </Button>
        }
      />

      {!open && (
        <p className="text-[11px] leading-relaxed text-muted-foreground" data-testid="text-outliers-collapsed">
          Collapsed by default. These bands cover roughly 26,000 and 2,600 adults respectively, are extrapolated from tax
          data with a Pareto tail, and are dominated by realized capital gains rather than earnings — so they move very
          differently from every tile above.
        </p>
      )}

      {open && (
        <>
          <div className="tile-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map(({ tile, compare }) => (
              <TileCard
                key={tile.def.id}
                tile={tile}
                compare={compare}
                compareLabel={compareLabel}
                compareGeo={compareGeo}
                geo={geo}
                model={model}
              />
            ))}

            {/* Top-10 individuals */}
            <Card className="flex flex-col gap-2 border-card-border bg-gradient-to-b from-chart-4/[0.07] to-transparent p-3.5" data-testid="card-tile-top10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-tight">Top {list.length || 10} individuals</div>
                  <div className="mt-0.5 min-h-[1.9rem] text-[11px] leading-snug text-muted-foreground">
                    Named list, wealth × {forbes.yieldPct}% yield
                  </div>
                </div>
                <span className="shrink-0 rounded bg-chart-4/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-chart-4">
                  {forbes.placeholder ? 'placeholder' : 'estimated'}
                </span>
              </div>
              <div className="tnum text-xl font-semibold leading-none tracking-tight" data-testid="text-value-top10">
                {aggregate > 0 ? USD_COMPACT.format(aggregate) : '—'}
              </div>
              <div className="text-[10px] leading-snug text-muted-foreground">
                Combined estimated annual income, USD{trimActive ? ' · trimmed out of the tiles above' : ''}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-auto h-7 justify-start gap-1 px-0 text-[11px] text-primary hover:bg-transparent hover:underline"
                onClick={() => setListOpen((o) => !o)}
                aria-expanded={listOpen}
                data-testid="button-toggle-top10-list"
                disabled={list.length === 0}
              >
                {listOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {list.length === 0 ? 'List not loaded yet' : listOpen ? 'Hide the list' : 'Show the list'}
              </Button>
            </Card>
          </div>

          {listOpen && list.length > 0 && (
            <Card className="mt-3 overflow-hidden border-card-border" data-testid="card-top10-list">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <caption className="sr-only">The ten largest individual incomes, estimated from Forbes wealth</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th scope="col" className="px-3 py-2 font-medium">Rank</th>
                      <th scope="col" className="px-3 py-2 font-medium">Name</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Wealth (Forbes)</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Est. income ({forbes.yieldPct}% yield)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={`${e.rank}-${e.name}`} className="border-b border-border/50 last:border-0" data-testid={`row-top10-${e.rank}`}>
                        <td className="tnum px-3 py-1.5 text-muted-foreground">{e.rank}</td>
                        <td className="px-3 py-1.5 font-medium">{e.name}</td>
                        <td className="tnum px-3 py-1.5 text-right">{e.wealthUSD !== null ? USD_COMPACT.format(e.wealthUSD) : '—'}</td>
                        <td className="tnum px-3 py-1.5 text-right">{e.incomeUSD !== null ? USD_COMPACT.format(e.incomeUSD) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Aggregate
                      </td>
                      <td className="tnum px-3 py-2 text-right">
                        {USD_COMPACT.format(list.reduce((s, e) => s + (e.wealthUSD ?? 0), 0))}
                      </td>
                      <td className="tnum px-3 py-2 text-right">{USD_COMPACT.format(aggregate)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          <CaveatCard title="How to read the outlier tiles" testId="card-outlier-caveat">
            <ul className="space-y-1.5">
              <li>{OUTLIER_FOOTNOTE}</li>
              <li>
                In band mode the ten named individuals are subtracted from the P99.999 band, so that band describes the
                roughly 2,600 people below them rather than being pulled up by ten fortunes.
              </li>
              <li>
                WID extrapolates above the top 0.1% with a Pareto tail fitted to tax data. Treat the P99.99 and P99.999
                cut points as estimates with real uncertainty, not counts.
              </li>
              {trimActive && (
                <li className="text-chart-4">
                  A trim is active, so these bands are reported as <em>Trimmed out</em> in the tiles above and shown here
                  for reference only.
                </li>
              )}
              <li>
                Named list:{' '}
                <a href={forbes.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {forbes.source} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </CaveatCard>
        </>
      )}
    </section>
  );
}

/* ============================ Section 8 — cross-country by income tier */

export function CrossCountrySection({
  result,
  selected,
  fmtPPP,
}: {
  result: CrossCountryResult;
  selected: V2Country | null;
  fmtPPP: (v: number | null) => string;
}) {
  const [sortBy, setSortBy] = useState<number | 'country'>('country');
  const [dir, setDir] = useState<SortDir>('asc');

  const rows = useMemo(() => sortCrossRows(result.rows, sortBy, dir), [result.rows, sortBy, dir]);
  const selectedRow = result.rows.find((r) => r.country === selected) ?? null;

  const toggleSort = (key: number | 'country') => {
    if (sortBy === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setDir(key === 'country' ? 'asc' : 'desc');
    }
  };

  return (
    <section aria-labelledby="h-cross" data-testid="section-cross-country">
      <SectionHeading
        id="cross"
        title="Discretionary income by tier, across countries"
        hint="What is left after tax, necessities and the savings target — at six points in each distribution."
        meta={`${result.year} · USD at PPP · ${
          result.taxBasis === 'oecd_effective' ? 'OECD effective tax rates' : 'WID/DINA post-tax national income'
        }`}
      />

      <Card className="overflow-hidden border-card-border" data-testid="card-cross-table">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <caption className="sr-only">Discretionary income in USD at PPP by country and percentile</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('country')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    data-testid="button-sort-country"
                  >
                    Country <ChevronsUpDown className="h-3 w-3" />
                  </button>
                </th>
                {CROSS_COLUMNS.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className={cn(
                      'px-3 py-2 text-right font-medium',
                      p === MEDIAN_2SIGMA && 'bg-muted/40 text-foreground'
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSort(p)}
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', sortBy === p && 'text-foreground')}
                        data-testid={`button-sort-${CROSS_COLUMN_SLUGS[p]}`}
                      >
                        {CROSS_PERCENTILE_LABELS[p]} <ChevronsUpDown className="h-3 w-3" />
                      </button>
                      {p === MEDIAN_2SIGMA && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              aria-label="About the Median+2σ column"
                              data-testid="button-info-median-2sigma"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 text-[11px] leading-relaxed" data-testid="popover-median-2sigma">
                            <p className="font-medium text-foreground">Median + 2σ (robust)</p>
                            <p className="mt-1 text-muted-foreground">{MEDIAN_2SIGMA_TOOLTIP}</p>
                            <p className="mt-1.5 text-muted-foreground">
                              σ is (P75 − P25) / 1.349, the interquartile estimate of the standard deviation. The ordinary second
                              moment is not usable here: with a Pareto tail it depends almost entirely on where the series is
                              truncated. The level is inverted back to a percentile rank so the tax rate and necessity floor
                              applied are the ones that hold at that income.
                            </p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CrossTableRow
                  key={row.country}
                  row={row}
                  baseline={selectedRow}
                  isSelected={row.country === selected}
                  fmtPPP={fmtPPP}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CaveatCard title="What this table does and does not do" testId="card-cross-caveat">
        <ul className="space-y-1.5">
          <li>
            <span className="font-medium text-foreground">Taxes.</span>{' '}
            {result.taxBasis === 'oecd_effective' ? (
              <>
                No DINA post-tax series is available for these countries, so post-tax income is estimated by netting OECD
                effective tax rates off pre-tax income.
              </>
            ) : (
              <>
                Post-tax income is the WID/DINA post-tax national series, which keeps this table on the same basis as the
                rest of the dashboard. The OECD Taxing Wages effective rates are read alongside it as a reference, but they
                are published against wage earnings for a single childless worker, while every figure here is national
                income per equal-split adult — a broader base that includes retained corporate earnings and imputed rent.
                Netting wage tax rates off that base pushes median discretionary income below zero, so it is not used as
                the deduction. Note that DINA in turn includes imputed collective consumption, which flatters the lower
                percentiles relative to genuine take-home pay.
              </>
            )}{' '}
            {result.taxSourceUrl && (
              <a href={result.taxSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                {result.taxSource} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
          <li>
            <span className="font-medium text-foreground">Necessities above the top decile.</span> Household budget surveys
            stop at their top published group. Above it the necessity floor is extended along the log-log slope of the last
            two anchors, clamped to an elasticity of 0.5, with a Pareto rank proxy for income. Cells that rely on this are
            marked with a dotted underline.
          </li>
          <li>
            <span className="font-medium text-foreground">Norway and Sweden.</span> Both discontinued their household
            expenditure surveys (2012 and 2009). Their necessity shares are Finland's, applied to their own register
            income deciles in kroner, which is why both rows carry a tier-C badge. Their published top decile averages
            roughly twice the ninth, so the necessity floor steps up sharply around P90 and their P90–P95 cells can read
            flat or slightly lower than P50 — an artefact of decile-average anchoring, not a real cliff.
          </li>
          <li>
            <span className="font-medium text-foreground">Delta chips</span> compare each cell to the selected country at
            the same percentile, not to the row above.
          </li>
          {result.missingSeries.length > 0 && (
            <li className="text-chart-4">
              No WID series loaded yet for: {result.missingSeries.join(', ')}. Those rows will populate when the v3 data
              pipeline lands.
            </li>
          )}
        </ul>
      </CaveatCard>
    </section>
  );
}

function CrossTableRow({
  row,
  baseline,
  isSelected,
  fmtPPP,
}: {
  row: CrossRow;
  baseline: CrossRow | null;
  isSelected: boolean;
  fmtPPP: (v: number | null) => string;
}) {
  return (
    <tr
      className={cn('border-b border-border/50 last:border-0', isSelected && 'bg-primary/[0.06] font-semibold')}
      data-testid={`row-cross-${row.country}`}
    >
      <th scope="row" className={cn('sticky left-0 z-10 px-3 py-1.5 text-left font-medium', isSelected ? 'bg-primary/[0.06]' : 'bg-card')}>
        <span className="flex items-center gap-1.5">
          {row.label}
          <TierBadge
            tier={row.tier}
            extra={
              row.modeledFrom
                ? `Expenditure shape modeled from ${row.modeledFrom} — this country's own survey was discontinued.`
                : `${row.surveySource} (${row.surveyYear || '—'}).`
            }
          />
        </span>
      </th>
      {CROSS_COLUMNS.map((p) => {
        const cell = row.cells[p];
        const base = baseline?.cells[p];
        const delta =
          cell?.discretionaryPPP != null && base?.discretionaryPPP != null && !isSelected
            ? cell.discretionaryPPP - base.discretionaryPPP
            : null;
        return (
          <td
            key={p}
            className={cn('px-3 py-1.5 text-right align-top', p === MEDIAN_2SIGMA && 'bg-muted/30')}
            title={
              p === MEDIAN_2SIGMA && cell
                ? `Median + 2\u03c3 lands at percentile ${(cell.rank * 100).toFixed(1)} in ${row.label}.`
                : undefined
            }
            data-testid={`cell-cross-${row.country}-${CROSS_COLUMN_SLUGS[p]}`}
          >
            {!cell ? (
              <span className="text-muted-foreground/60">—</span>
            ) : (
              <span className="inline-flex flex-col items-end gap-0.5">
                <span
                  className={cn(
                    'tnum',
                    cell.belowFloor && 'text-destructive',
                    cell.extrapolated && 'underline decoration-dotted decoration-muted-foreground/60 underline-offset-2'
                  )}
                  title={cell.extrapolated ? 'Necessity floor extrapolated above the survey\u2019s top published group.' : undefined}
                >
                  {fmtPPP(cell.discretionaryPPP)}
                </span>
                {delta !== null && (
                  <span className={cn('tnum text-[10px] font-medium', delta >= 0 ? 'text-primary' : 'text-destructive')}>
                    {delta >= 0 ? '+' : '\u2212'}
                    {fmtPPP(Math.abs(delta))}
                  </span>
                )}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/* ==================== Section 9 — non-monetary benefits */

export function BenefitsSection({ bundle, selected }: { bundle: BenefitsBundle; selected: V2Country | null }) {
  return (
    <section aria-labelledby="h-benefits" data-testid="section-benefits">
      <SectionHeading
        id="benefits"
        title="What money does not buy"
        hint="Benefits delivered in kind rather than in cash — the part of the comparison that discretionary income cannot see."
        meta={bundle.placeholder ? 'Placeholder values — v3 benefits file pending' : bundle.source}
      />

      <TooltipProvider delayDuration={150}>
        <Card className="overflow-hidden border-card-border" data-testid="card-benefits-table">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <caption className="sr-only">Non-monetary benefits by country</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                    Benefit
                  </th>
                  {V3_COUNTRY_ORDER.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn('px-2.5 py-2 text-right font-medium', c === selected && 'bg-primary/[0.06] text-foreground')}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bundle.rows.map((row) => {
                  const ranks = benefitRanks(row);
                  return (
                    <tr key={row.id} className="border-b border-border/50 last:border-0" data-testid={`row-benefit-${row.id}`}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 w-[42%] min-w-[9.5rem] bg-card px-3 py-1.5 text-left font-medium sm:w-auto sm:min-w-[14rem]"
                      >
                        <span className="flex items-start gap-1.5">
                          <span className="min-w-0">
                            <span className="block">{row.label}</span>
                            <span className="block text-[10px] font-normal text-muted-foreground">{row.unit}</span>
                          </span>
                          {row.sourceUrl && (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 shrink-0 text-muted-foreground/60 hover:text-primary"
                              aria-label={`${row.source} — source for ${row.label}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </span>
                      </th>
                      {V3_COUNTRY_ORDER.map((c) => {
                        const raw = row.values[c];
                        const rank = ranks[c];
                        const display =
                          raw === null || raw === undefined
                            ? '—'
                            : typeof raw === 'number'
                              ? new Intl.NumberFormat('en-US', { maximumFractionDigits: raw < 10 ? 1 : 0 }).format(raw)
                              : String(raw);
                        const note = row.notes[c];
                        const body = (
                          <span
                            className={cn(
                              'tnum',
                              rank === 'good' && 'text-primary',
                              rank === 'bad' && 'text-destructive',
                              note && 'cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2'
                            )}
                          >
                            {display}
                          </span>
                        );
                        return (
                          <td
                            key={c}
                            className={cn('px-2.5 py-1.5 text-right', c === selected && 'bg-primary/[0.06] font-semibold')}
                            data-testid={`cell-benefit-${row.id}-${c}`}
                          >
                            {note ? (
                              <Tooltip>
                                <TooltipTrigger asChild>{body}</TooltipTrigger>
                                <TooltipContent className="max-w-64 text-xs leading-relaxed">{note}</TooltipContent>
                              </Tooltip>
                            ) : (
                              body
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </TooltipProvider>

      <CaveatCard title="Reading the benefits table" testId="card-benefits-caveat">
        <ul className="space-y-1.5">
          <li>
            Colour is <em>within a row only</em>: the two most generous countries read green, the two least generous red,
            the middle four neutral. It never compares one row to another — weeks of leave and dollars of tuition are not
            the same kind of quantity.
          </li>
          <li>
            Rows are direction-aware. On university tuition, net childcare cost and the statutory pension age a lower
            number is the better outcome for the household, and the colouring inverts accordingly.
          </li>
          <li>
            Where a cell pairs a duration with a payment rate — "6 wk @ 100%" — the ranking uses full-pay-equivalent
            weeks, duration times rate, because 52 weeks at 17% is not 52 weeks of income.
          </li>
          <li>
            The transit subsidy row is deliberately left uncoloured. The US tops it only because farebox recovery
            collapsed after 2020, and Japan reads negative because its private railways run at a profit, so "more" is
            not "better" in either direction.
          </li>
          <li>
            None of these values is netted out of Section 6 or Section 8. A German household's discretionary income does
            not include the value of free university; that is the point of showing both.
          </li>
          {bundle.placeholder && (
            <li className="text-chart-4">
              These are indicative placeholder levels pending <code>data/v3/non_monetary_benefits.json</code>. Read the
              structure, not the numbers.
            </li>
          )}
        </ul>
      </CaveatCard>
    </section>
  );
}

/* ==================== Section 10 — data sources and citations */

interface SourceEntry {
  name: string;
  url: string;
  what: string;
  vintage?: string;
}
interface SourceGroup {
  id: string;
  title: string;
  sections: string;
  entries: SourceEntry[];
  note?: string;
}

const SOURCE_GROUPS: SourceGroup[] = [
  {
    id: 'income',
    title: 'Income distribution',
    sections: 'Sections 1–4, 7',
    entries: [
      {
        name: 'Census Current Population Survey / ASEC',
        url: 'https://www.census.gov/topics/income-poverty/income/data/tables/cps.html',
        what: 'Household money-income percentiles, quintile shares and Gini for the United States.',
        vintage: '2000–2024',
      },
      {
        name: 'BEA Distribution of Personal Income',
        url: 'https://www.bea.gov/data/special-topics/distribution-of-personal-income',
        what: 'Decile income shares reconciled to the national accounts, including imputed non-cash income.',
        vintage: '2000–2024',
      },
      {
        name: 'CBO Distribution of Household Income',
        url: 'https://www.cbo.gov/topics/income-distribution',
        what: 'Market, before-tax and after-tax household income by quintile and top percentile band.',
        vintage: '2021 vintage, constant 2021 dollars',
      },
      {
        name: 'World Inequality Database (WID)',
        url: 'https://wid.world/data/',
        what: 'DINA pre-tax and post-tax national income per equal-split adult, thresholds and top shares, for all eight countries.',
        vintage: '1980–2024',
      },
      {
        name: 'HHS Federal Poverty Guidelines',
        url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
        what: 'The poverty line and 200%-of-poverty reference tiles, by household size and state group.',
        vintage: '2026',
      },
    ],
  },
  {
    id: 'expenditure',
    title: 'Expenditure and necessity',
    sections: 'Sections 5–6, 8',
    entries: [
      {
        name: 'BLS Consumer Expenditure Survey',
        url: 'https://www.bls.gov/cex/tables.htm',
        what: 'US household spending by category, by income decile and by household type — the base of the necessity floor.',
        vintage: '2024',
      },
      {
        name: 'BEA Regional Price Parities',
        url: 'https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area',
        what: 'State and metro price levels used to re-cost the US necessity floor sub-nationally.',
        vintage: '2023',
      },
      {
        name: 'Federal Reserve Survey of Consumer Finances',
        url: 'https://www.federalreserve.gov/econres/scfindex.htm',
        what: 'Student-loan balances by income position, amortized into a minimum annual payment.',
        vintage: '2022',
      },
      {
        name: 'Destatis EVS / Laufende Wirtschaftsrechnungen',
        url: 'https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/',
        what: 'German household consumption by income bracket, published monthly and annualized here.',
      },
      {
        name: 'BBSR regional cost indices',
        url: 'https://www.bbsr.bund.de/',
        what: 'German Länder price levels, the BEA-RPP equivalent for the German necessity floor.',
      },
      {
        name: 'ONS Living Costs and Food Survey',
        url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure',
        what: 'UK household spending by decile and household composition.',
        vintage: '2023–24',
      },
      {
        name: 'Statistics Japan Family Income and Expenditure Survey',
        url: 'https://www.stat.go.jp/english/data/kakei/',
        what: 'Japanese household spending by category and income quintile.',
        vintage: '2024',
      },
      {
        name: 'BFS Haushaltsbudgeterhebung',
        url: 'https://www.bfs.admin.ch/',
        what: 'Swiss household budget survey — spending by category and income group.',
      },
      {
        name: 'StatFin Household Budget Survey',
        url: 'https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/',
        what: 'Finnish household spending, and the donor shape for the modeled Norwegian and Swedish floors.',
        vintage: '2022',
      },
      {
        name: 'Statistics Norway table 12682',
        url: 'https://www.ssb.no/en/statbank/table/12682',
        what: 'Norwegian register income by decile — the income side of a country with no current expenditure survey.',
      },
      {
        name: 'Statistics Sweden HE0110F',
        url: 'https://www.statistikdatabasen.scb.se/',
        what: 'Swedish register income by decile, used the same way as the Norwegian table.',
      },
    ],
  },
  {
    id: 'normalization',
    title: 'Cross-country normalization',
    sections: 'Sections 6, 8',
    entries: [
      {
        name: 'OECD Purchasing Power Parities',
        url: 'https://data.oecd.org/conversion/purchasing-power-parities-ppp.htm',
        what: 'Private-consumption PPP rates, local currency per USD, used for every PPP-normalized figure.',
        vintage: '2023 base',
      },
      {
        name: 'OECD Taxing Wages',
        url: 'https://www.oecd.org/tax/taxing-wages/',
        what: 'Effective tax and social-contribution rates by earnings level, read as a reference alongside Section 8.',
        vintage: '2024',
      },
      {
        name: 'OECD Pensions at a Glance',
        url: 'https://www.oecd.org/pensions/pensionsataglance.htm',
        what: 'Mandatory pension contribution rates and net replacement rates, so savings targets are comparable.',
      },
    ],
  },
  {
    id: 'outliers',
    title: 'Outliers',
    sections: 'Section 7',
    entries: [
      {
        name: 'Forbes Real-Time Billionaires',
        url: 'https://www.forbes.com/real-time-billionaires/',
        what: 'The named top-10 wealth list, converted to an income flow and subtracted from the P99.999 band.',
        vintage: `Snapshot ${V3_AS_OF}`,
      },
    ],
    note:
      'Methodology note: estimated annual income is wealth × 4% typical portfolio yield, not IRS-reported income. Realized income for these individuals can differ from the estimate by an order of magnitude in either direction in any given year.',
  },
  {
    id: 'benefits',
    title: 'Non-monetary benefits',
    sections: 'Section 9',
    entries: [
      {
        name: 'OECD Family Database',
        url: 'https://www.oecd.org/els/family/database.htm',
        what: 'Paid parental leave entitlements and net childcare costs.',
      },
      {
        name: 'OECD Health at a Glance',
        url: 'https://www.oecd.org/health/health-at-a-glance/',
        what: 'Out-of-pocket share of total health spending.',
      },
      {
        name: 'OECD Education at a Glance',
        url: 'https://www.oecd.org/education/education-at-a-glance/',
        what: 'Public-university tuition levels.',
      },
      {
        name: 'OECD Benefits in Unemployment',
        url: 'https://www.oecd.org/social/benefits-and-wages.htm',
        what: 'Unemployment net replacement rates and sick-pay generosity.',
      },
      {
        name: 'ILO Working Time Database',
        url: 'https://www.ilo.org/global/statistics-and-databases/',
        what: 'Statutory paid annual leave, paid public holidays and average annual hours worked.',
      },
      {
        name: 'UITP (International Association of Public Transport)',
        url: 'https://www.uitp.org/',
        what: 'Monthly urban transit pass prices.',
      },
    ],
  },
  {
    id: 'household-and-prices',
    title: 'Household size, population and prices',
    sections: 'Sections 1\u20134, 7, 11',
    entries: [
      {
        name: 'Census ASEC — Income and Poverty in the United States',
        url: 'https://www.census.gov/data/tables/2024/demo/income-poverty/p60-286.html',
        what: 'Average household size by income decile and the household counts behind the per-equivalent-adult line.',
        vintage: '2024 report (2023 income year)',
      },
      {
        name: 'World Bank World Development Indicators — SP.POP.TOTL',
        url: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
        what: 'Total resident population by country and year, used to turn a band population share into a headcount.',
        vintage: '1980\u20132024',
      },
      {
        name: 'BEA Personal Consumption Expenditures Price Index',
        url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index',
        what: 'Default US deflator behind the real growth reading on every tile.',
        vintage: '1980\u20132024',
      },
      {
        name: 'BLS Consumer Price Index (CPI-U)',
        url: 'https://www.bls.gov/cpi/',
        what: 'Alternative US deflator, selectable in the sidebar.',
        vintage: '1980\u20132024',
      },
      {
        name: 'OECD Harmonised Index of Consumer Prices (HICP)',
        url: 'https://data-explorer.oecd.org/vis?tm=inflation',
        what: 'Deflator for every non-US geography; PCE and CPI-U are US-only, so non-US selections fall back to this.',
        vintage: '1996\u20132024',
      },
    ],
    note:
      'Household size is integrated across decile mid-ranks so a band that straddles two deciles gets a weighted average rather than a single decile value.',
  },
  {
    id: 'kids-split',
    title: 'Households with and without children',
    sections: 'Section 11',
    entries: [
      {
        name: 'OECD Family Database — SF1.1 Family size and composition',
        url: 'https://www.oecd.org/els/family/database.htm',
        what: 'Household composition shares and the child-related expenditure and childcare-cost anchors behind the kids split.',
      },
      {
        name: 'ONS Living Costs and Food Survey — Table A22',
        url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure',
        what: 'UK household expenditure by household composition, giving the with-children and no-children necessity baskets.',
      },
      {
        name: 'Census ASEC — Income and Poverty in the United States',
        url: 'https://www.census.gov/data/tables/2024/demo/income-poverty/p60-286.html',
        what: 'US gross income by presence of related children under 18, at each of the three tiers.',
        vintage: '2024 report (2023 income year)',
      },
    ],
    note:
      'Countries with no published child / no-child breakdown are modeled from a donor country with a comparable transfer system and labelled with the donor on the block.',
  },
];

export function SourcesSection() {
  return (
    <section aria-labelledby="h-sources" className="pb-6" data-testid="section-sources">
      <SectionHeading
        id="sources"
        title="Data sources and citations"
        hint="Every series behind every tile, with the page it came from."
        meta={`As of ${V3_AS_OF}`}
      />

      <Card className="border-card-border p-4" data-testid="card-sources">
        <div className="mb-4 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Methodology in one paragraph.</span> All monetary values are in
            the selected country's local currency unless the PPP toggle is on, in which case they are USD at{' '}
            2023-base private-consumption purchasing power parity. Percentile tiles are <em>disjoint bands</em> by default
            — each tile reports the mean income of the people between its own percentile and the next tile up, not an
            at-or-above threshold; see the band tooltip on any tile for the exact range. Tier badges A, B and C indicate
            data recency and completeness: A is a recent annual survey, B is interpolated from a multi-year survey, C is
            modeled from register data or a donor country.
          </p>
        </div>

        {/* CSS columns rather than a grid, so a short group does not leave a tall gap beside a long one. */}
        <div className="gap-x-8 md:columns-2">
          {SOURCE_GROUPS.map((group) => (
            <div key={group.id} className="mb-5 break-inside-avoid" data-testid={`sources-group-${group.id}`}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-border/60 pb-1.5">
                <h3 className="text-xs font-semibold tracking-tight">{group.title}</h3>
                <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{group.sections}</span>
              </div>
              <ul className="space-y-2.5">
                {group.entries.map((e) => (
                  <li key={e.url + e.name} className="text-[11px] leading-relaxed">
                    <div className="font-semibold text-foreground">{e.name}</div>
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                    >
                      {e.url.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <div className="text-muted-foreground">{e.what}</div>
                    {e.vintage && <div className="tnum text-[10px] text-muted-foreground/80">Vintage: {e.vintage}</div>}
                  </li>
                ))}
              </ul>
              {group.note && <p className="mt-2 text-[10px] leading-relaxed text-chart-4">{group.note}</p>}
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-muted-foreground">
          This dashboard is MIT-licensed. Source at{' '}
          <a
            href="https://github.com/tyohDeveloper/income-tiles"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            github.com/tyohDeveloper/income-tiles <ExternalLink className="h-3 w-3" />
          </a>
          .
        </div>
      </Card>
    </section>
  );
}
