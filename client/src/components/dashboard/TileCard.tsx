import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DistributionModel, GeoId, fmtMoney, fmtPct, fmtShare } from '@/lib/incomeModel';
import { ComputedTile, provenanceDetail, provenanceLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';

function Delta({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value))
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 tnum text-[11px] font-medium',
        flat ? 'text-muted-foreground' : up ? 'text-primary' : 'text-destructive'
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface Props {
  tile: ComputedTile;
  compare?: ComputedTile | null;
  compareLabel?: string;
  geo: GeoId;
  compareGeo?: GeoId;
  model: DistributionModel;
  unitNote?: string;
}

export function TileCard({ tile, compare, compareLabel, geo, compareGeo, model, unitNote }: Props) {
  const { def } = tile;
  const pctChange =
    compare && compare.value !== null && tile.value !== null && compare.value > 0
      ? ((tile.value - compare.value) / compare.value) * 100
      : null;

  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-2 border-card-border p-3.5 transition-shadow duration-150',
        'hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_8px_24px_-12px_hsl(var(--primary)/0.35)]',
        def.emphasis && 'bg-gradient-to-b from-primary/[0.07] to-transparent',
        tile.trimmedOut && 'opacity-55'
      )}
      data-testid={`card-tile-${def.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold tracking-tight truncate">{def.label}</span>
            {def.info && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
                    aria-label={`About ${def.label}`}
                    data-testid={`button-info-${def.id}`}
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
                  {def.info}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 min-h-[1.9rem] text-[11px] leading-snug text-muted-foreground">
            {def.caption}
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors',
                tile.provenance === 'published'
                  ? 'bg-primary/12 text-primary'
                  : tile.provenance === 'interpolated'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-chart-4/15 text-chart-4'
              )}
              data-testid={`badge-provenance-${def.id}`}
            >
              {provenanceLabel(tile.provenance)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 text-xs leading-relaxed">
            {provenanceDetail(tile.provenance, model, geo)}
          </PopoverContent>
        </Popover>
      </div>

      <div>
        {tile.trimmedOut ? (
          <div className="text-base font-semibold text-muted-foreground" data-testid={`text-value-${def.id}`}>
            Trimmed out
          </div>
        ) : (
          <div
            className="tnum text-xl font-semibold leading-none tracking-tight"
            data-testid={`text-value-${def.id}`}
          >
            {tile.value !== null && tile.value <= 0 ? (
              <span className="text-muted-foreground">{fmtMoney(tile.value, geo)}</span>
            ) : (
              fmtMoney(tile.value, geo)
            )}
          </div>
        )}
        {tile.note && <div className="mt-1 text-[10px] leading-snug text-chart-4">{tile.note}</div>}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">At or above</dt>
          <dd className="tnum font-medium" data-testid={`text-popshare-${def.id}`}>
            {tile.trimmedOut ? '—' : fmtPct(tile.pctAtOrAbove, tile.pctAtOrAbove !== null && tile.pctAtOrAbove < 1 ? 2 : 1)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Income above</dt>
          <dd className="tnum font-medium" data-testid={`text-incshare-${def.id}`}>
            {tile.trimmedOut ? '—' : fmtShare(tile.shareAbove)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Year on year</dt>
          <dd data-testid={`text-yoy-${def.id}`}>
            <Delta value={tile.trimmedOut ? null : tile.yoy} />
          </dd>
        </div>
        {compare && (
          <div>
            <dt className="text-muted-foreground truncate">vs {compareLabel}</dt>
            <dd className="flex items-center gap-1.5">
              <span className="tnum font-medium text-[11px]" data-testid={`text-compare-${def.id}`}>
                {compare.trimmedOut ? '—' : fmtMoney(compare.value, compareGeo ?? geo, { compact: true })}
              </span>
              <Delta value={pctChange} />
            </dd>
          </div>
        )}
      </dl>

      {unitNote && <div className="text-[10px] leading-snug text-muted-foreground/80">{unitNote}</div>}
    </Card>
  );
}

export function StatTile({
  label,
  value,
  caption,
  info,
  testId,
}: {
  label: string;
  value: string;
  caption?: string;
  info?: string;
  testId: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 border-card-border p-3.5 transition-shadow duration-150 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground truncate">{label}</span>
        {info && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-foreground" aria-label={`About ${label}`}>
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
              {info}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="tnum text-lg font-semibold leading-none tracking-tight" data-testid={testId}>
        {value}
      </div>
      {caption && <div className="text-[11px] text-muted-foreground leading-snug">{caption}</div>}
    </Card>
  );
}
