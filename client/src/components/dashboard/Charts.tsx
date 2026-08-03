import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DerivedView, GeoId, fmtMoney, fmtNum, fmtShare } from '@/lib/incomeModel';
import { ComputedTile } from '@/lib/tiles';

const AXIS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 10,
  tickLine: false as const,
};

function ChartFrame({
  title,
  subtitle,
  children,
  right,
  testId,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="border-card-border p-4" data-testid={testId}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground max-w-prose">{subtitle}</p>
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function LorenzChart({
  view,
  compare,
  compareLabel,
  label,
}: {
  view: DerivedView;
  compare?: DerivedView | null;
  compareLabel?: string;
  label: string;
}) {
  const data = useMemo(() => {
    const rows: { p: number; equality: number; lorenz: number; compare?: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      rows.push({
        p: i,
        equality: p * 100,
        lorenz: view.lorenzTrimmed(p) * 100,
        ...(compare ? { compare: compare.lorenzTrimmed(p) * 100 } : {}),
      });
    }
    return rows;
  }, [view, compare]);

  const anchors = useMemo(
    () =>
      view.model.lorenzAnchors
        .filter((a) => a.published && a.p > 0 && a.p < 1)
        .map((a) => ({ p: a.p * 100, cum: view.lorenzTrimmed(a.p) * 100 })),
    [view]
  );

  return (
    <ChartFrame
      title="Lorenz curve"
      subtitle={`Cumulative income share against cumulative population share. Dots mark the shares the publisher states directly. Gini ${fmtNum(view.gini, 3)}.`}
      testId="chart-lorenz"
      right={
        <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px]">
          <span className="text-muted-foreground">Gini</span>{' '}
          <span className="tnum font-semibold" data-testid="text-chart-gini">
            {fmtNum(view.gini, 3)}
          </span>
        </div>
      }
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 18, left: 4 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="p"
              type="number"
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              {...AXIS}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'Population (poorest → richest)', position: 'insideBottom', offset: -12, fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              {...AXIS}
              tickFormatter={(v) => `${v}%`}
              width={38}
            />
            <RTooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--popover-border))',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(v) => `Bottom ${v}% of the population`}
              formatter={(value: number, name) => [`${value.toFixed(1)}% of income`, name === 'lorenz' ? label : name === 'compare' ? compareLabel : 'Perfect equality']}
            />
            <Area
              dataKey="lorenz"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="hsl(var(--primary))"
              fillOpacity={0.12}
              dot={false}
              name="lorenz"
              isAnimationActive={false}
            />
            {compare && (
              <Line
                dataKey="compare"
                stroke="hsl(var(--chart-3))"
                strokeWidth={1.75}
                strokeDasharray="4 3"
                dot={false}
                name="compare"
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="equality"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="3 4"
              dot={false}
              name="equality"
              isAnimationActive={false}
            />
            <Scatter data={anchors} dataKey="cum" fill="hsl(var(--primary))" shape="circle" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function PercentileChart({
  view,
  geo,
  tiles,
}: {
  view: DerivedView;
  geo: GeoId;
  tiles: ComputedTile[];
}) {
  const [logScale, setLogScale] = useState(true);

  const data = useMemo(() => {
    const rows: { p: number; value: number }[] = [];
    for (let i = 1; i <= 990; i++) {
      const p = i / 1000;
      const v = view.quantile(p);
      if (Number.isFinite(v) && v > 0) rows.push({ p: p * 100, value: v });
    }
    for (const p of [0.992, 0.994, 0.996, 0.998, 0.999]) {
      const v = view.quantile(p);
      if (Number.isFinite(v) && v > 0) rows.push({ p: p * 100, value: v });
    }
    return rows;
  }, [view]);

  const refs = tiles
    .filter((t) => !t.trimmedOut && t.value !== null && t.value > 0)
    .map((t) => ({ id: t.def.id, label: t.def.label, value: t.value as number, emphasis: !!t.def.emphasis }));

  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  return (
    <ChartFrame
      title="Percentile to income"
      subtitle="Every percentile mapped to its income threshold. Reference lines mark the tiles above; a log axis is the honest way to see both ends at once."
      testId="chart-percentile"
      right={
        <div className="flex items-center gap-2">
          <Label htmlFor="log-scale" className="text-[11px] text-muted-foreground">
            Log scale
          </Label>
          <Switch id="log-scale" checked={logScale} onCheckedChange={setLogScale} data-testid="switch-log-scale" />
        </div>
      }
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 18, left: 4 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="p"
              type="number"
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 90, 100]}
              {...AXIS}
              tickFormatter={(v) => `P${v}`}
              label={{ value: 'Percentile', position: 'insideBottom', offset: -12, fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <YAxis
              scale={logScale ? 'log' : 'linear'}
              domain={logScale ? [Math.max(lo * 0.8, 1), hi * 1.25] : [0, hi * 1.05]}
              allowDataOverflow
              {...AXIS}
              width={62}
              tickFormatter={(v) => fmtMoney(v, geo, { compact: true })}
            />
            <RTooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--popover-border))',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(v) => `Percentile ${Number(v).toFixed(1)}`}
              formatter={(value: number) => [fmtMoney(value, geo), 'Threshold']}
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.id}
                y={r.value}
                stroke={r.emphasis ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                strokeOpacity={r.emphasis ? 0.75 : 0.3}
                strokeDasharray="3 3"
                ifOverflow="hidden"
              />
            ))}
            <Line
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Dashed lines: every tile threshold in the current selection. Solid teal lines mark the median and the top-10% / top-1% entry points.
      </p>
    </ChartFrame>
  );
}

export function ShareBars({ view, label }: { view: DerivedView; label: string }) {
  const groups = useMemo(() => {
    const cuts = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 0.99, 1];
    const names = ['Q1', 'Q2', 'Q3', 'Q4', 'P81–90', 'P91–95', 'P96–99', 'Top 1%'];
    return cuts.slice(0, -1).map((c, i) => ({
      name: names[i],
      share: (view.lorenzTrimmed(cuts[i + 1]) - view.lorenzTrimmed(c)) * 100,
      pop: (cuts[i + 1] - c) * 100,
    }));
  }, [view]);

  return (
    <ChartFrame
      title="Who gets the income"
      subtitle={`Share of all ${label} income received by each slice of the population.`}
      testId="chart-shares"
    >
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{g.name}</span>
            <span className="tnum w-10 shrink-0 text-[11px] text-muted-foreground">{g.pop.toFixed(0)}%</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${Math.min(100, (g.share / Math.max(...groups.map((x) => x.share))) * 100)}%` }}
              />
            </div>
            <span className="tnum w-12 shrink-0 text-right text-[11px] font-medium" data-testid={`text-share-${g.name}`}>
              {fmtShare(g.share / 100)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        First column: population slice. Last column: its share of total income.
      </p>
    </ChartFrame>
  );
}
