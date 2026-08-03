import { Info, Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  GEOS,
  GeoId,
  INCOME_DEFS,
  IncomeDef,
  SOURCES,
  SOURCE_ORDER,
  SourceChoice,
  SourceId,
  TrimConfig,
  UNITS,
  UnitId,
  fmtMoney,
  sourceSupports,
} from '@/lib/incomeModel';
import { POVERTY_REGIONS, PovertyConfig } from '@/lib/tiles';
import { V2Country } from '@/lib/ppp';
import { EquivalenceScale, HH_TYPES, HH_TYPE_ORDER, HouseholdTypeId } from '@/lib/householdType';
import { HousingMode, STRICTNESS_LEVELS, Strictness } from '@/lib/necessity';
import { SAVINGS_MARKS } from '@/lib/discretionary';
import { RegionOption } from '@/lib/regional';

export interface Selection {
  def: IncomeDef;
  sourceChoice: SourceChoice;
  unit: UnitId;
  geo: GeoId;
  year: number;
  trim: TrimConfig;
  poverty: PovertyConfig;
}

export interface CompareState {
  mode: 'off' | 'year' | 'geo';
  year: number;
  geo: GeoId;
}

interface Props {
  sel: Selection;
  v2: V2Selection;
  setV2: (patch: Partial<V2Selection>) => void;
  v2Country: V2Country | null;
  regions: RegionOption[];
  regionsSupported: boolean;
  v2Placeholder: boolean;
  setSel: (patch: Partial<Selection>) => void;
  resolved: SourceId | null;
  compare: CompareState;
  setCompare: (patch: Partial<CompareState>) => void;
  onReset: () => void;
}

function FieldLabel({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground">{children}</Label>
      {info && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/70 hover:text-foreground transition-colors"
              aria-label="More information"
              data-testid={`info-${String(children).toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-72 text-xs leading-relaxed">
            {info}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function DisabledNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/80">{children}</p>;
}

export function ControlPanel({
  sel,
  setSel,
  resolved,
  compare,
  setCompare,
  onReset,
  v2,
  setV2,
  v2Country,
  regions,
  regionsSupported,
  v2Placeholder,
}: Props) {
  const active = resolved ? SOURCES[resolved] : null;
  const yearMin = active?.minYear ?? 1979;
  const yearMax = active?.maxYear ?? 2024;

  /** Which definitions the currently resolved source can serve. */
  const defEnabled = (d: IncomeDef) => {
    if (sel.sourceChoice === 'auto') return SOURCE_ORDER.some((s) => sourceSupports(s, d, sel.geo));
    return SOURCES[sel.sourceChoice].defs.includes(d) && SOURCES[sel.sourceChoice].geos.includes(sel.geo);
  };
  /**
   * Geography is never locked: picking a country outside the US automatically moves the
   * selection onto WID, the only loaded source with international coverage. Locking it
   * would leave non-US countries unreachable from a Census or BEA selection.
   */
  const geoNeedsSwitch = (g: GeoId) => g !== 'US' && !(resolved === 'wid' && SOURCES.wid.defs.includes(sel.def));
  const sourceEnabled = (s: SourceId) => sourceSupports(s, sel.def, sel.geo);
  const unitEnabled = (u: UnitId) => (resolved ? SOURCES[resolved].unit === u : false);

  /** Changing a definition may require moving to a source that supports it. */
  const onDefChange = (d: IncomeDef) => {
    const patch: Partial<Selection> = { def: d };
    if (sel.sourceChoice !== 'auto' && !SOURCES[sel.sourceChoice].defs.includes(d)) patch.sourceChoice = 'auto';
    setSel(patch);
  };
  const onGeoChange = (g: GeoId) => {
    const patch: Partial<Selection> = { geo: g };
    if (g !== 'US') {
      patch.sourceChoice = 'wid';
      if (!SOURCES.wid.defs.includes(sel.def)) patch.def = 'pretax_national';
      patch.year = Math.min(Math.max(sel.year, SOURCES.wid.minYear), SOURCES.wid.maxYear);
    }
    setSel(patch);
  };
  const onSourceChange = (value: string) => {
    const s = value as SourceChoice;
    const patch: Partial<Selection> = { sourceChoice: s };
    if (s !== 'auto') {
      const m = SOURCES[s];
      if (!m.defs.includes(sel.def)) patch.def = m.defs[0];
      if (!m.geos.includes(sel.geo)) patch.geo = m.geos[0];
      patch.year = Math.min(Math.max(sel.year, m.minYear), m.maxYear);
    }
    setSel(patch);
  };

  const trimSummaryUnits = sel.trim.mode === 'topn' ? sel.trim.topN.toLocaleString('en-US') : null;

  return (
    <div className="flex flex-col gap-5 p-4 pb-10">
      <section>
        <FieldLabel info="Which income concept the tiles measure. Definitions are not interchangeable: BEA personal income includes imputed and in-kind national-accounts items, Census money income is pre-tax cash only, and DINA concepts allocate the whole of national income.">
          Income definition
        </FieldLabel>
        <Select value={sel.def} onValueChange={(v) => onDefChange(v as IncomeDef)}>
          <SelectTrigger data-testid="select-definition" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCOME_DEFS.map((d) => (
              <SelectItem key={d.id} value={d.id} disabled={!defEnabled(d.id)} className="text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{d.label}</span>
                  {!defEnabled(d.id) && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DisabledNote>{INCOME_DEFS.find((d) => d.id === sel.def)?.blurb}</DisabledNote>
      </section>

      <section>
        <FieldLabel info="Auto picks the source that publishes real dollar thresholds for your request. Locked entries do not cover the current definition or country.">
          Data source
        </FieldLabel>
        <Select value={sel.sourceChoice} onValueChange={onSourceChange}>
          <SelectTrigger data-testid="select-source" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="text-sm">
              Auto — best available
            </SelectItem>
            {SOURCE_ORDER.map((s) => (
              <SelectItem key={s} value={s} disabled={!sourceEnabled(s)} className="text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{SOURCES[s].label}</span>
                  {!sourceEnabled(s) && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active && (
          <DisabledNote>
            {sel.sourceChoice === 'auto' ? `Resolved to ${active.label}. ` : ''}
            {active.basis}. {active.prices}. {active.minYear}–{active.maxYear}.
          </DisabledNote>
        )}
      </section>

      <section>
        <FieldLabel info="The unit of analysis is fixed by the source: Census, BEA and CBO report households; WID reports equal-split adults. No tax-filer series is loaded in v1.">
          Unit of analysis
        </FieldLabel>
        <Select value={resolved ? SOURCES[resolved].unit : sel.unit} onValueChange={(v) => setSel({ unit: v as UnitId })}>
          <SelectTrigger data-testid="select-unit" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u.id} value={u.id} disabled={!unitEnabled(u.id)} className="text-sm">
                <span className="flex items-center gap-2">
                  {u.label}
                  {!unitEnabled(u.id) && <Lock className="h-3 w-3 opacity-50" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DisabledNote>Determined by the source. Tax-filer series are not loaded in v1.</DisabledNote>
      </section>

      <section>
        <FieldLabel info="Only WID covers countries other than the United States. Values stay in local currency at current prices, so cross-country dollar levels are not directly comparable.">
          Geography
        </FieldLabel>
        <Select value={sel.geo} onValueChange={(v) => onGeoChange(v as GeoId)}>
          <SelectTrigger data-testid="select-geography" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GEOS.map((g) => (
              <SelectItem key={g.id} value={g.id} className="text-sm">
                <span className="flex items-center gap-2">
                  {g.label}
                  <span className="text-muted-foreground text-xs">{g.currency}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {GEOS.some((g) => geoNeedsSwitch(g.id)) && sel.geo === 'US' && (
          <DisabledNote>Choosing another country switches the source to WID / DINA — the only loaded series with international coverage.</DisabledNote>
        )}
        {sel.geo !== 'US' && <DisabledNote>{GEOS.find((g) => g.id === sel.geo)?.currency} at current prices, per equal-split adult.</DisabledNote>}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground">Year</Label>
          <span className="tnum text-sm font-semibold" data-testid="text-year">
            {sel.year}
          </span>
        </div>
        <Slider
          value={[sel.year]}
          min={yearMin}
          max={yearMax}
          step={1}
          onValueChange={([v]) => setSel({ year: v })}
          data-testid="slider-year"
          aria-label="Year"
        />
        <div className="mt-1.5 flex justify-between tnum text-[11px] text-muted-foreground">
          <span>{yearMin}</span>
          <span>{yearMax}</span>
        </div>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Poverty tiles use the HHS 2026 guidelines. They are US dollar amounts defined per household, so they are only directly meaningful against a US household-income series.">
          Poverty guideline
        </FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <Select value={sel.poverty.region} onValueChange={(v) => setSel({ poverty: { ...sel.poverty, region: v as PovertyConfig['region'] } })}>
            <SelectTrigger data-testid="select-poverty-region" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POVERTY_REGIONS.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-sm">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(sel.poverty.size)} onValueChange={(v) => setSel({ poverty: { ...sel.poverty, size: Number(v) } })}>
            <SelectTrigger data-testid="select-poverty-size" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-sm">
                  {n} {n === 1 ? 'person' : 'people'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Trimming removes the very top of the distribution and recomputes the median, robust σ and every tile on the retained population. Percentile groups that the trim removes entirely are marked “trimmed out”.">
          Outlier trim
        </FieldLabel>
        <ToggleGroup
          type="single"
          value={sel.trim.mode}
          onValueChange={(v) => v && setSel({ trim: { ...sel.trim, mode: v as TrimConfig['mode'] } })}
          className="grid grid-cols-3 gap-1"
        >
          <ToggleGroupItem value="off" className="h-8 text-xs" data-testid="button-trim-off">
            Off
          </ToggleGroupItem>
          <ToggleGroupItem value="topn" className="h-8 text-xs" data-testid="button-trim-topn">
            Top-N
          </ToggleGroupItem>
          <ToggleGroupItem value="cap" className="h-8 text-xs" data-testid="button-trim-cap">
            Cap
          </ToggleGroupItem>
        </ToggleGroup>

        {sel.trim.mode === 'topn' && (
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Units excluded</span>
                <span className="tnum text-sm font-semibold" data-testid="text-trim-n">
                  {trimSummaryUnits}
                </span>
              </div>
              <Slider
                value={[sel.trim.topN]}
                min={0}
                max={10000}
                step={50}
                onValueChange={([v]) => setSel({ trim: { ...sel.trim, topN: v } })}
                data-testid="slider-trim-n"
                aria-label="Top-N units excluded"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground" htmlFor="universe">
                Universe size (approximate)
              </Label>
              <Input
                id="universe"
                type="number"
                className="h-8 mt-1 tnum text-sm"
                value={sel.trim.universe}
                min={1000}
                step={1000000}
                onChange={(e) => setSel({ trim: { ...sel.trim, universe: Math.max(1000, Number(e.target.value) || 0) } })}
                data-testid="input-universe"
              />
              <DisabledNote>
                Excluding N units only bites if you say how many units exist. Edit this to match your unit — no population counts ship with the source files.
              </DisabledNote>
            </div>
          </div>
        )}

        {sel.trim.mode === 'cap' && (
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground" htmlFor="cap">
              Exclude income above
            </Label>
            <Input
              id="cap"
              type="number"
              className="h-8 mt-1 tnum text-sm"
              value={sel.trim.cap}
              min={1000}
              step={50000}
              onChange={(e) => setSel({ trim: { ...sel.trim, cap: Math.max(1000, Number(e.target.value) || 0) } })}
              data-testid="input-cap"
            />
            <DisabledNote>Currently {fmtMoney(sel.trim.cap, sel.geo)}.</DisabledNote>
          </div>
        )}
      </section>

      <Separator />

      <section>
        <FieldLabel info="Pick a second data point and every tile gains a comparison figure with the percent change.">
          Compare
        </FieldLabel>
        <ToggleGroup
          type="single"
          value={compare.mode}
          onValueChange={(v) => v && setCompare({ mode: v as CompareState['mode'] })}
          className="grid grid-cols-3 gap-1"
        >
          <ToggleGroupItem value="off" className="h-8 text-xs" data-testid="button-compare-off">
            Off
          </ToggleGroupItem>
          <ToggleGroupItem value="year" className="h-8 text-xs" data-testid="button-compare-year">
            Year
          </ToggleGroupItem>
          <ToggleGroupItem value="geo" className="h-8 text-xs" disabled={sel.sourceChoice !== 'wid' && sel.geo === 'US' && resolved !== 'wid'} data-testid="button-compare-geo">
            Country
          </ToggleGroupItem>
        </ToggleGroup>
        {compare.mode === 'year' && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Baseline year</span>
              <span className="tnum text-sm font-semibold" data-testid="text-compare-year">
                {Math.min(Math.max(compare.year, yearMin), yearMax)}
              </span>
            </div>
            <Slider
              value={[Math.min(Math.max(compare.year, yearMin), yearMax)]}
              min={yearMin}
              max={yearMax}
              step={1}
              onValueChange={([v]) => setCompare({ year: v })}
              data-testid="slider-compare-year"
              aria-label="Comparison year"
            />
          </div>
        )}
        {compare.mode === 'geo' && (
          <div className="mt-3">
            <Select value={compare.geo} onValueChange={(v) => setCompare({ geo: v as GeoId })}>
              <SelectTrigger data-testid="select-compare-geo" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEOS.filter((g) => SOURCES.wid.geos.includes(g.id)).map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-sm">
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DisabledNote>Different currencies — read the percent change, not the level.</DisabledNote>
          </div>
        )}
        {compare.mode === 'geo' && resolved !== 'wid' && (
          <DisabledNote>Country comparison needs a WID selection.</DisabledNote>
        )}
      </section>

      <Separator />

      <V2Controls v2={v2} setV2={setV2} country={v2Country} regions={regions} regionsSupported={regionsSupported} placeholder={v2Placeholder} />

      <Button variant="outline" size="sm" className="mt-1 gap-2" onClick={onReset} data-testid="button-reset">
        <RotateCcw className="h-3.5 w-3.5" />
        Reset controls
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------- v2 controls */

export interface V2Selection {
  /** Convert every money figure to USD at OECD PPP for private consumption. */
  ppp: boolean;
  housingMode: HousingMode;
  strictness: Strictness;
  equivalenceScale: EquivalenceScale;
  householdType: HouseholdTypeId;
  /** Voluntary savings target, percent of post-necessity income. */
  savingsPct: number;
  /** Region id from `regionOptions()`, or 'national'. */
  region: string;
}

export const V2_DEFAULTS: V2Selection = {
  ppp: true,
  housingMode: 'rental_equivalent',
  strictness: 'bls_basic',
  equivalenceScale: 'sqrt',
  householdType: 'all',
  savingsPct: 15,
  region: 'national',
};

const SCALES: { id: EquivalenceScale; label: string; info: string }[] = [
  { id: 'per_capita', label: 'Per capita', info: 'Divide by household size. No economies of scale — overstates the burden of large households.' },
  { id: 'sqrt', label: 'Square root', info: 'Divide by the square root of household size. The OECD default and the v2 baseline.' },
  { id: 'oecd_modified', label: 'OECD-modified', info: 'First adult 1.0, each additional adult 0.5, each child 0.3. Used for EU-SILC poverty statistics.' },
];

function V2Controls({
  v2,
  setV2,
  country,
  regions,
  regionsSupported,
  placeholder,
}: {
  v2: V2Selection;
  setV2: (patch: Partial<V2Selection>) => void;
  country: V2Country | null;
  regions: RegionOption[];
  regionsSupported: boolean;
  placeholder: boolean;
}) {
  const strictness = STRICTNESS_LEVELS.find((s) => s.id === v2.strictness);
  const scale = SCALES.find((s) => s.id === v2.equivalenceScale);
  const hh = HH_TYPES[v2.householdType];
  const grouped: { group: string; items: RegionOption[] }[] = [];
  for (const r of regions) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === r.group) last.items.push(r);
    else grouped.push({ group: r.group, items: [r] });
  }

  return (
    <>
      <section data-testid="section-v2-controls">
        <FieldLabel info="The v2 discretionary layer subtracts a necessity floor built from household expenditure surveys, then a voluntary savings target, from post-tax income at the selected percentile.">
          Discretionary layer
        </FieldLabel>
        {!country && (
          <DisabledNote>
            No expenditure survey is loaded for this country, so the necessity floor and discretionary tiles are hidden.
            Switch to the United States, Germany, the United Kingdom or Japan.
          </DisabledNote>
        )}
        {country && placeholder && (
          <DisabledNote>
            {country} is running on placeholder expenditure numbers — every derived tile is badged Placeholder.
          </DisabledNote>
        )}

        <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-medium">PPP-adjusted (USD)</div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              OECD purchasing power parities for private consumption, 2023 base
            </div>
          </div>
          <Switch
            checked={v2.ppp}
            onCheckedChange={(c) => setV2({ ppp: c })}
            aria-label="PPP-adjusted USD"
            data-testid="switch-ppp"
          />
        </div>
      </section>

      <Separator />

      <section>
        <FieldLabel info={strictness?.blurb}>Necessity strictness</FieldLabel>
        <ToggleGroup
          type="single"
          value={v2.strictness}
          onValueChange={(val) => val && setV2({ strictness: val as Strictness })}
          className="grid grid-cols-3 gap-1"
        >
          {STRICTNESS_LEVELS.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id} className="h-8 px-1 text-[11px]" data-testid={`button-strictness-${s.id}`}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <DisabledNote>{strictness?.blurb}</DisabledNote>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Cash outlays count shelter as the survey reports it — mortgage principal and interest for owners. Rental equivalent replaces owner outlays with imputed rent, which is what the national accounts do and what makes owners and renters comparable.">
          Housing basis
        </FieldLabel>
        <ToggleGroup
          type="single"
          value={v2.housingMode}
          onValueChange={(val) => val && setV2({ housingMode: val as HousingMode })}
          className="grid grid-cols-2 gap-1"
        >
          <ToggleGroupItem value="cash" className="h-8 text-xs" data-testid="button-housing-cash">
            Cash outlays
          </ToggleGroupItem>
          <ToggleGroupItem value="rental_equivalent" className="h-8 text-xs" data-testid="button-housing-rental">
            Rental equiv.
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Income comes per equal-split adult; expenditure comes per household. The equivalence scale bridges the two.">
          Equivalence scale
        </FieldLabel>
        <Select value={v2.equivalenceScale} onValueChange={(val) => setV2({ equivalenceScale: val as EquivalenceScale })}>
          <SelectTrigger className="h-9 text-sm" data-testid="select-equivalence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCALES.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-sm">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DisabledNote>{scale?.info}</DisabledNote>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Household composition drives childcare, healthcare and food. Where the survey publishes a matching household-type table the adjustment is measured; otherwise it is modeled from a square-root size ratio.">
          Household type
        </FieldLabel>
        <Select value={v2.householdType} onValueChange={(val) => setV2({ householdType: val as HouseholdTypeId })}>
          <SelectTrigger className="h-9 text-sm" data-testid="select-household-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HH_TYPE_ORDER.map((id) => (
              <SelectItem key={id} value={id} className="text-sm">
                {HH_TYPES[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DisabledNote>
          {hh.size.toFixed(hh.size % 1 === 0 ? 0 : 1)} people · {hh.childrenInCare > 0 ? `${hh.childrenInCare} in paid care` : 'no paid childcare'} ·{' '}
          {hh.working ? 'working' : 'retired'}
        </DisabledNote>
      </section>

      <Separator />

      <section>
        <FieldLabel info="Applied to income remaining after the necessity floor. Mandatory pension contributions are already excluded from DINA post-tax income and are never subtracted twice.">
          Voluntary savings target
        </FieldLabel>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Percent of post-necessity income</span>
          <span className="tnum text-sm font-semibold" data-testid="text-savings-pct">
            {v2.savingsPct}%
          </span>
        </div>
        <Slider
          value={[v2.savingsPct]}
          min={0}
          max={25}
          step={1}
          onValueChange={([val]) => setV2({ savingsPct: val })}
          aria-label="Voluntary savings target"
          data-testid="slider-savings"
        />
        <div className="mt-2 flex gap-1">
          {SAVINGS_MARKS.map((m) => (
            <Tooltip key={m.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setV2({ savingsPct: m.value })}
                  className={
                    'flex-1 rounded border px-1 py-0.5 text-[10px] font-medium transition-colors ' +
                    (v2.savingsPct === m.value
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground')
                  }
                  data-testid={`button-savings-${m.value}`}
                >
                  {m.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56 text-xs">
                {m.blurb}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <FieldLabel info="US: BEA Regional Price Parities by state and metro, applied component-wise (housing rents, goods, utilities, other services). Germany: BBSR regional price index by Bundesland, applied uniformly. No other country publishes comparable sub-national price data.">
          Region
        </FieldLabel>
        <Select value={v2.region} onValueChange={(val) => setV2({ region: val })} disabled={!regionsSupported}>
          <SelectTrigger className="h-9 text-sm" data-testid="select-region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {grouped.map((g) => (
              <div key={g.group}>
                {g.group !== 'National' && (
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>
                )}
                {g.items.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">
                    {r.label}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        {!regionsSupported && (
          <DisabledNote>
            Sub-national price adjustment is available for the United States and Germany only.
            {country === 'DE' ? '' : ''}
          </DisabledNote>
        )}
        {regionsSupported && v2.region !== 'national' && (
          <DisabledNote>Necessity components are rescaled by the regional price level; income is not re-estimated.</DisabledNote>
        )}
      </section>
    </>
  );
}
