/**
 * Copy the published data bundles into `client/public/data` so Vite serves them.
 *
 * Only the JSON the app actually fetches is copied — build scripts, spreadsheets and raw
 * downloads stay out of the deployed bundle. Two files need a shape fix on the way through:
 * the modeled Norwegian and Swedish expenditure datasets use `*_modeled` field names, and the
 * app's expenditure loader expects the canonical survey field names.
 *
 * Usage: node script/sync-data.mjs
 */
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'data');
const dest = path.join(root, 'client', 'public', 'data');

const copied = [];
const skipped = [];

async function copyJson(relFrom, relTo = relFrom) {
  const from = path.join(src, relFrom);
  if (!existsSync(from)) {
    skipped.push(relFrom);
    return;
  }
  const to = path.join(dest, relTo);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
  copied.push(relTo);
}

/** Rename `*_modeled` keys back to the canonical survey field names. */
async function copyModeledExpenditure(relFrom, relTo) {
  const from = path.join(src, relFrom);
  if (!existsSync(from)) {
    skipped.push(relFrom);
    return;
  }
  const raw = JSON.parse(await readFile(from, 'utf8'));
  const rows = (raw.rows ?? []).map((r) => {
    const out = { ...r };
    if ('avg_expenditure_total_modeled' in out) {
      out.avg_expenditure_total = out.avg_expenditure_total_modeled;
      delete out.avg_expenditure_total_modeled;
    }
    if ('expenditure_by_category_modeled' in out) {
      out.expenditure_by_category = out.expenditure_by_category_modeled;
      delete out.expenditure_by_category_modeled;
    }
    return out;
  });
  const out = {
    ...raw,
    rows,
    source_url: raw.source_url ?? raw.source_url_income ?? raw.source_url_necessity_curve ?? '',
    notes: raw.notes ?? [
      `Expenditure shape modeled from ${raw.modeled_from ?? 'FI'}; this country's own household budget survey was discontinued.`,
      ...(raw.methodology ? [String(raw.methodology)] : []),
    ],
  };
  const to = path.join(dest, relTo);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, JSON.stringify(out, null, 2));
  copied.push(`${relTo} (normalized)`);
}

// v1 — every WID bundle plus the US-only sources.
for (const f of await readdir(src)) {
  if (!f.endsWith('.json')) continue;
  // The split pretax/posttax extracts are development artifacts; the app reads the combined bundle.
  if (/_(pre|post)tax_national\.json$/.test(f)) continue;
  if (f === 'bea_national_disposable.json' || f === 'bea_national_personal.json') continue;
  await copyJson(f);
}

// v2 — expenditure surveys, price indices, PPP, pensions, student loans.
const V2 = [
  'us_ces_2024_by_decile.json',
  'us_ces_2024_by_hhtype.json',
  'de_evs.json',
  'de_laender_costs.json',
  'uk_lcf.json',
  'uk_lcf_by_hhtype.json',
  'jp_fies.json',
  'ch_habe.json',
  'fi_hbs.json',
  'oecd_ppp.json',
  'oecd_pensions.json',
  'us_rpp_state.json',
  'us_rpp_metro.json',
  'us_scf_studentloans.json',
];
for (const f of V2) await copyJson(path.join('v2', f), path.join('v2', f));

// v3 — top-tail thresholds and shares, effective tax, the named top-10, benefits.
const V3 = [
  'wid_toptail_thresholds.json',
  'wid_top_shares.json',
  'effective_tax_by_percentile.json',
  'forbes_top10.json',
  'non_monetary_benefits.json',
];
for (const f of V3) await copyJson(path.join('v3', f), path.join('v3', f));

// Modeled Norwegian and Swedish expenditure, published under v3 but read as v2 surveys.
await copyModeledExpenditure(path.join('v3', 'no_expenditure_modeled.json'), path.join('v2', 'no_expenditure.json'));
await copyModeledExpenditure(path.join('v3', 'se_expenditure_modeled.json'), path.join('v2', 'se_expenditure.json'));

console.log(`Synced ${copied.length} files into client/public/data`);
for (const f of copied) console.log(`  + ${f}`);
if (skipped.length) {
  console.log(`Missing (not copied): ${skipped.join(', ')}`);
}
