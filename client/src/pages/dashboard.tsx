import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LogoWordmark } from '@/components/Logo';
import { LorenzChart, PercentileChart, ShareBars } from '@/components/dashboard/Charts';
import { CompareState, ControlPanel, Selection } from '@/components/dashboard/ControlPanel';
import { StatTile, TileCard } from '@/components/dashboard/TileCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/lib/theme';
import {
  DEFAULT_TRIM,
  DerivedView,
  GEOS,
  GeoId,
  INCOME_DEFS,
  SOURCES,
  UNITS,
  buildModel,
  deriveView,
  fmtMoney,
  fmtNum,
  fmtShare,
  loadAll,
  resolveSource,
} from '@/lib/incomeModel';
import { TILE_SECTIONS, computeTile, povertyGuideline } from '@/lib/tiles';

const DEFAULT_SELECTION: Selection = {
  def: 'pretax_national',
  sourceChoice: 'auto',
  unit: 'equal_split_adult',
  geo: 'US',
  year: 2024,
  trim: DEFAULT_TRIM,
  poverty: { size: 1, region: '48_contiguous_states_and_dc' },
};

const DEFAULT_COMPARE: CompareState = { mode: 'off', year: 2000, geo: 'DEU' };

function LoadingState() {
  return (
    <div className="space-y-6 p-5">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { theme, toggle } = useTheme();
  // Only one ControlPanel is mounted at a time so every data-testid stays unique.
  const isMobile = useIsMobile();
  const [sel, setSelState] = useState<Selection>(DEFAULT_SELECTION);
  const [compare, setCompareState] = useState<CompareState>(DEFAULT_COMPARE);

  const setSel = useCallback((patch: Partial<Selection>) => setSelState((s) => ({ ...s, ...patch })), []);
  const setCompare = useCallback((patch: Partial<CompareState>) => setCompareState((s) => ({ ...s, ...patch })), []);

  const { data: store, isLoading, error } = useQuery({
    queryKey: ['income-data'],
    queryFn: loadAll,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const resolved = useMemo(
    () => resolveSource(sel.sourceChoice, sel.def, sel.geo, sel.year),
    [sel.sourceChoice, sel.def, sel.geo, sel.year]
  );

  // Keep the year inside the resolved source's coverage.
  const clampedYear = useMemo(() => {
    if (!resolved) return sel.year;
    return Math.min(Math.max(sel.year, SOURCES[resolved].minYear), SOURCES[resolved].maxYear);
  }, [resolved, sel.year]);

  const model = useMemo(
    () => (store && resolved ? buildModel(store, resolved, sel.def, sel.geo, clampedYear) : null),
    [store, resolved, sel.def, sel.geo, clampedYear]
  );
  const prevModel = useMemo(
    () => (store && resolved ? buildModel(store, resolved, sel.def, sel.geo, clampedYear - 1) : null),
    [store, resolved, sel.def, sel.geo, clampedYear]
  );
  const compareModel = useMemo(() => {
    if (!store || !resolved || compare.mode === 'off') return null;
    if (compare.mode === 'year') {
      const y = Math.min(Math.max(compare.year, SOURCES[resolved].minYear), SOURCES[resolved].maxYear);
      return buildModel(store, resolved, sel.def, sel.geo, y);
    }
    if (resolved !== 'wid') return null;
    return buildModel(store, 'wid', sel.def, compare.geo, clampedYear);
  }, [store, resolved, compare, sel.def, sel.geo, clampedYear]);

  const view = useMemo(() => (model ? deriveView(model, sel.trim) : null), [model, sel.trim]);
  const prevView = useMemo(() => (prevModel ? deriveView(prevModel, sel.trim) : null), [prevModel, sel.trim]);
  const compareView = useMemo(
    () => (compareModel ? deriveView(compareModel, sel.trim) : null),
    [compareModel, sel.trim]
  );

  const povertyValue = useMemo(
    () => (store ? povertyGuideline(store.poverty.guidelines as never, sel.poverty) : NaN),
    [store, sel.poverty]
  );

  const sections = useMemo(() => {
    if (!view) return [];
    return TILE_SECTIONS.map((section) => ({
      ...section,
      computed: section.tiles.map((def) => ({
        tile: computeTile(def, view, povertyValue, prevView, povertyValue),
        compare: compareView ? computeTile(def, compareView, povertyValue) : null,
      })),
    }));
  }, [view, povertyValue, prevView, compareView]);

  const allTiles = useMemo(() => sections.flatMap((s) => s.computed.map((c) => c.tile)), [sections]);

  const compareLabel =
    compare.mode === 'year'
      ? String(Math.min(Math.max(compare.year, SOURCES[resolved ?? 'wid'].minYear), SOURCES[resolved ?? 'wid'].maxYear))
      : compare.mode === 'geo'
        ? GEOS.find((g) => g.id === compare.geo)?.id
        : undefined;

  const activeSource = resolved ? SOURCES[resolved] : null;
  const defLabel = INCOME_DEFS.find((d) => d.id === sel.def)?.label ?? sel.def;
  const unitLabel = activeSource ? UNITS.find((u) => u.id === activeSource.unit)?.label : '—';
  const geoLabel = GEOS.find((g) => g.id === sel.geo)?.label;

  const povertyUnitNote =
    activeSource && activeSource.unit !== 'household'
      ? 'HHS guidelines are per household; this series measures ' + (unitLabel ?? '').toLowerCase() + 's.'
      : sel.geo !== 'US'
        ? 'US guideline shown against a non-US series.'
        : undefined;

  const controls = (
    <ControlPanel
      sel={{ ...sel, year: clampedYear }}
      setSel={setSel}
      resolved={resolved}
      compare={compare}
      setCompare={setCompare}
      onReset={() => {
        setSelState(DEFAULT_SELECTION);
        setCompareState(DEFAULT_COMPARE);
      }}
    />
  );

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[19rem_1fr] md:grid-rows-[auto_1fr]">
      {/* Sidebar — desktop */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar md:block md:row-span-2 scroll-region">
        <div className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar px-4 py-3.5">
          <LogoWordmark />
        </div>
        {!isMobile && controls}
      </aside>

      {/* Header */}
      <header className="z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-5">
        <div className="flex items-center gap-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-open-controls">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Open controls</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-[20rem] overflow-y-auto bg-sidebar p-0">
              <div className="border-b border-sidebar-border px-4 py-3.5">
                <SheetTitle asChild>
                  <div>
                    <LogoWordmark />
                  </div>
                </SheetTitle>
              </div>
              {isMobile && controls}
            </SheetContent>
          </Sheet>
          <LogoWordmark compact />
        </div>

        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 md:flex">
          <Badge variant="secondary" className="gap-1 font-medium" data-testid="badge-selection-def">
            {defLabel}
          </Badge>
          <Badge variant="secondary" className="font-medium" data-testid="badge-selection-source">
            {activeSource?.short ?? '—'}
          </Badge>
          <Badge variant="secondary" className="font-medium">
            {unitLabel}
          </Badge>
          <Badge variant="secondary" className="font-medium">
            {geoLabel}
          </Badge>
          <Badge variant="secondary" className="tnum font-medium" data-testid="badge-selection-year">
            {clampedYear}
          </Badge>
          {activeSource && (
            <Badge variant="outline" className="font-medium text-muted-foreground" data-testid="badge-selection-prices">
              {activeSource.prices}
            </Badge>
          )}
          {view && view.trim.fraction > 0 && (
            <Badge className="tnum bg-chart-4/15 font-medium text-chart-4 hover:bg-chart-4/15" data-testid="badge-trim">
              Trimmed top {(view.trim.fraction * 100).toFixed(view.trim.fraction < 0.001 ? 4 : 2)}%
            </Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeSource && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" data-testid="button-source-notes">
                  Source notes
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-2.5 text-xs leading-relaxed">
                <div className="font-semibold">{activeSource.label}</div>
                <p className="text-muted-foreground">
                  {activeSource.basis}. {activeSource.prices}.
                </p>
                {activeSource.caveat && <p className="text-chart-4">{activeSource.caveat}</p>}
                {model?.modelNotes.map((n, i) => (
                  <p key={i} className="text-muted-foreground">
                    {n}
                  </p>
                ))}
                <a
                  href={activeSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open source page <ExternalLink className="h-3 w-3" />
                </a>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggle} data-testid="button-theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </header>

      {/* Main scroll region */}
      <main className="scroll-region bg-background px-4 py-5 md:px-5">
        {isLoading && <LoadingState />}

        {error && (
          <Alert variant="destructive" className="max-w-xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Data failed to load</AlertTitle>
            <AlertDescription className="text-xs">{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (!resolved || !view || !model) && (
          <Alert className="max-w-xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No series for this combination</AlertTitle>
            <AlertDescription className="text-xs">
              {defLabel} is not published for {geoLabel} in {clampedYear} by any loaded source. Change the definition,
              country or year.
            </AlertDescription>
          </Alert>
        )}

        {view && model && (
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
            {/* headline strip */}
            <Card className="grid grid-cols-2 items-end gap-x-6 gap-y-4 border-card-border p-4 sm:grid-cols-4 md:flex md:flex-wrap md:gap-x-8">
              <div>
                <div className="text-[11px] uppercase tracking-[0.09em] text-muted-foreground">Median</div>
                <div className="tnum text-2xl font-semibold leading-none tracking-tight" data-testid="text-headline-median">
                  {fmtMoney(view.median, sel.geo)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {defLabel} · {unitLabel} · {clampedYear}
                </div>
                {view.trim.fraction > 0 && (
                  <Badge
                    className="tnum mt-2 bg-chart-4/15 font-medium text-chart-4 hover:bg-chart-4/15 md:hidden"
                    data-testid="badge-trim-mobile"
                  >
                    Trimmed top {(view.trim.fraction * 100).toFixed(view.trim.fraction < 0.001 ? 4 : 2)}%
                  </Badge>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.09em] text-muted-foreground">Mean</div>
                <div className="tnum text-lg font-semibold leading-none" data-testid="text-headline-mean">
                  {fmtMoney(model.mean, sel.geo)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {model.mean && view.median ? `${fmtNum(model.mean / view.median, 2)}× the median` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.09em] text-muted-foreground">Robust σ</div>
                <div className="tnum text-lg font-semibold leading-none" data-testid="text-headline-sigma">
                  {fmtMoney(view.sigmaRobust, sel.geo)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  (P75 − P25) / 1.349 — the MAD-equivalent spread
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.09em] text-muted-foreground">Top 1% share</div>
                <div className="tnum text-lg font-semibold leading-none" data-testid="text-headline-top1">
                  {fmtShare(model.topShares.top1)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Bottom 50% takes {fmtShare(view.lorenzTrimmed(0.5))}</div>
              </div>
              <div className="col-span-2 text-[11px] leading-snug text-muted-foreground sm:col-span-4 md:ml-auto md:max-w-[15rem]" data-testid="text-headline-caveat">
                {activeSource?.headline}
              </div>
            </Card>

            {/* tile sections */}
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`h-${section.id}`}>
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 id={`h-${section.id}`} className="text-sm font-semibold tracking-tight">
                    {section.title}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">{section.hint}</p>
                </div>
                <div className="tile-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {section.computed.map(({ tile, compare: cmp }) => (
                    <TileCard
                      key={tile.def.id}
                      tile={tile}
                      compare={cmp}
                      compareLabel={compareLabel}
                      compareGeo={compare.mode === 'geo' ? compare.geo : sel.geo}
                      geo={sel.geo}
                      model={model}
                      unitNote={tile.def.kind === 'poverty' ? povertyUnitNote : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* ancillary */}
            <section aria-labelledby="h-ancillary">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="h-ancillary" className="text-sm font-semibold tracking-tight">
                  Inequality summary
                </h2>
                <p className="text-[11px] text-muted-foreground">Standard dispersion measures for the current selection.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Gini"
                  value={fmtNum(view.gini, 3)}
                  caption={
                    view.trim.fraction > 0
                      ? 'Recomputed on the trimmed population.'
                      : model.giniPublished !== null
                        ? 'Published by the source.'
                        : 'Computed from the published Lorenz points.'
                  }
                  info="0 is perfect equality, 1 is one unit taking everything. Twice the area between the Lorenz curve and the 45° line."
                  testId="text-stat-gini"
                />
                <StatTile
                  label="P90 / P10"
                  value={fmtNum(view.ratios.p90p10, 2)}
                  caption="Top-decile entry over bottom-decile ceiling."
                  info="How many times more the household entering the top 10% receives than one at the top of the bottom 10%."
                  testId="text-stat-p90p10"
                />
                <StatTile
                  label="P90 / P50"
                  value={fmtNum(view.ratios.p90p50, 2)}
                  caption="Top-decile entry over the median."
                  info="Measures stretch in the upper half only — insensitive to what happens at the bottom."
                  testId="text-stat-p90p50"
                />
                <StatTile
                  label="Top 10% / Bottom 50%"
                  value={fmtNum(view.ratios.top10Bottom50, 2)}
                  caption="Income share ratio, not a threshold ratio."
                  info="Share of all income going to the top decile divided by the share going to the bottom half. WID publishes both series directly."
                  testId="text-stat-top10bottom50"
                />
              </div>
            </section>

            {/* charts */}
            <section aria-labelledby="h-charts" className="pb-4">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="h-charts" className="text-sm font-semibold tracking-tight">
                  Curves
                </h2>
                <p className="text-[11px] text-muted-foreground">The same selection, drawn two ways.</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <LorenzChart
                  view={view}
                  compare={compareView}
                  compareLabel={compareLabel}
                  label={`${defLabel}, ${clampedYear}`}
                />
                <PercentileChart view={view} geo={sel.geo} tiles={allTiles} />
                <ShareBars view={view} label={defLabel.toLowerCase()} />
                <Card className="border-card-border p-4 text-xs leading-relaxed text-muted-foreground" data-testid="card-methodology">
                  <h3 className="mb-2 text-sm font-semibold tracking-tight text-foreground">Method and provenance</h3>
                  <ul className="space-y-2">
                    <li>
                      <span className="font-medium text-foreground">Robust σ.</span> Spread is measured as
                      (P75 − P25) / (2 × 0.6745), the IQR estimator that equals 1.4826 × MAD for a Gaussian. Mean ± SD
                      is never used: income is right-skewed, so the mean sits well above the median and SD is dominated
                      by the top tail.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Thresholds.</span> Published cut points are used
                      verbatim. Gaps are interpolated between them in probit / log-dollar space. Where a source
                      publishes no dollar thresholds at all (BEA, CBO) a lognormal is fitted to the published
                      median or mean plus Gini, and every affected tile is badged <em>Modeled</em>.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Lorenz curve.</span> Pinned exactly to each
                      published income share; the shape between anchors follows the integral of the threshold curve.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Price basis.</span> Census and BEA are nominal
                      current-year dollars; CBO is constant 2021 dollars; WID is inflation-adjusted at roughly 2023
                      prices. Never read a year-over-year change across a nominal and a real series as the same
                      quantity — the badge next to the year states which you are looking at.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Comparability.</span> Census, BEA and CBO are US
                      households in USD; WID is per equal-split adult in local currency. Levels are not interchangeable
                      across sources — compare shapes and ratios.
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {(['census', 'bea', 'cbo', 'wid'] as const).map((s) => (
                      <a
                        key={s}
                        href={SOURCES[s].url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {SOURCES[s].short} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                    <a
                      href="https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      HHS <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </Card>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
