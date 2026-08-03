/**
 * Numeric verification of the distribution model against the figures in BUILD_SPEC.md.
 * Run with: npx tsx script/verify.ts
 */
import { readFileSync } from 'node:fs';

// minimal DOM shim so incomeModel's dataUrl() import doesn't explode
(globalThis as any).document = { baseURI: 'http://localhost/' };

const M = await import('../client/src/lib/incomeModel.ts');

const read = (f: string) => JSON.parse(readFileSync(`data/${f}`, 'utf8'));
const store: any = {
  census: read('census_asec.json'),
  bea: read('bea_national.json'),
  cbo: read('cbo_us.json'),
  poverty: read('poverty_2026.json'),
  wid: {
    US: read('wid_us.json'),
    CAN: read('wid_can.json'),
    GBR: read('wid_gbr.json'),
    DEU: read('wid_deu.json'),
    FRA: read('wid_fra.json'),
    JPN: read('wid_jpn.json'),
  },
};

function show(source: any, def: any, geo: any, year: number) {
  const m = M.buildModel(store, source, def, geo, year);
  if (!m) return console.log(`!! no model for ${source}/${def}/${geo}/${year}`);
  const v = M.deriveView(m, M.DEFAULT_TRIM);
  const t = (p: number) => Math.round(M.percentileTile(v, p).value ?? NaN);
  console.log(`\n== ${source} ${def} ${geo} ${year}  [thresholds: ${m.thresholdProvenance}, lorenz: ${m.lorenzProvenance}]`);
  console.log(
    `   P10 ${t(0.1)}  P20 ${t(0.2)}  P50 ${t(0.5)}  P80 ${t(0.8)}  P90 ${t(0.9)}  P95 ${t(0.95)}  P99 ${t(0.99)}  P99.9 ${t(0.999)}`
  );
  console.log(
    `   median ${Math.round(v.median)}  robust-sigma ${Math.round(v.sigmaRobust)}  med-1s ${Math.round(v.median - v.sigmaRobust)}  med+1s ${Math.round(v.median + v.sigmaRobust)}  med+2s ${Math.round(v.median + 2 * v.sigmaRobust)}`
  );
  console.log(
    `   gini pub ${m.giniPublished ?? '—'} computed ${m.giniComputed.toFixed(4)}  top1 ${(m.topShares.top1! * 100).toFixed(2)}%  top10 ${(m.topShares.top10! * 100).toFixed(2)}%  bottom50 ${(m.bottom50Share * 100).toFixed(2)}%`
  );
  console.log(
    `   P90/P10 ${v.ratios.p90p10?.toFixed(2)}  P90/P50 ${v.ratios.p90p50?.toFixed(2)}  top10/bot50 ${v.ratios.top10Bottom50?.toFixed(2)}`
  );
  const pov = M.dollarTile(v, 15960);
  console.log(`   poverty $15,960 sits at p=${((pov.p ?? 0) * 100).toFixed(1)}  share above ${(pov.shareAbove! * 100).toFixed(1)}%`);
}

show('census', 'market', 'US', 2024);
show('census', 'market', 'US', 2010);
show('wid', 'pretax_national', 'US', 2024);
show('wid', 'posttax_national', 'US', 2024);
show('wid', 'pretax_national', 'DEU', 2024);
show('bea', 'personal', 'US', 2024);
show('bea', 'disposable', 'US', 2024);
show('cbo', 'market', 'US', 2021);
show('cbo', 'posttax_national', 'US', 2021);

// trim behaviour
const m = M.buildModel(store, 'wid', 'pretax_national', 'US', 2024)!;
for (const cap of [1_000_000, 250_000]) {
  const v = M.deriveView(m, { ...M.DEFAULT_TRIM, mode: 'cap', cap });
  console.log(
    `\ncap ${cap}: trimmed fraction ${(v.trim.fraction * 100).toFixed(3)}%  median ${Math.round(v.median)}  sigma ${Math.round(v.sigmaRobust)}  gini ${v.gini.toFixed(4)}  P99 tile ${JSON.stringify(M.percentileTile(v, 0.99).trimmedOut)}`
  );
}
const vN = M.deriveView(m, { ...M.DEFAULT_TRIM, mode: 'topn', topN: 10000, universe: 262000000 });
console.log(`topN 10000/262M: fraction ${(vN.trim.fraction * 100).toFixed(6)}%  median ${Math.round(vN.median)} (untrimmed ${Math.round(M.deriveView(m, M.DEFAULT_TRIM).median)})`);

// year coverage sanity
for (const s of ['census', 'bea', 'cbo', 'wid'] as const) {
  const defs = M.SOURCES[s].defs;
  for (const d of defs) {
    const ds = M.pickDataset(store, s, d, 'US');
    console.log(`${s}/${d}: ${ds ? `${ds.years.length} years ${ds.years[0].year}-${ds.years[ds.years.length - 1].year}` : 'MISSING'}`);
  }
}
