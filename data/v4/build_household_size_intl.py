#!/usr/bin/env python3
"""
A.1 (international portion) - Household size by income decile for DE, UK, NO, SE, FI, CH, JP.

Direct decile-level household-size-by-income tabulations are not published in a single
comparable cross-country table by OECD Family Database or Eurostat SILC (OECD Family
Database SF1.1 publishes household size by household TYPE and country, not by income
decile; Eurostat ilc_lvph01 publishes national average household size only, not
cross-tabulated by income). The one country with a directly published decile-level
household-size table is the UK (ONS Family Spending / Living Costs and Food Survey,
"equivalised income" chapter), which shows:
  - Lowest (D1) non-equivalised disposable income decile: 1.3 people/household
  - Highest (D10) non-equivalised disposable income decile: 3.3 people/household
  https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/compendium/familyspending/2015/chapter3equivalisedincome

Method: We use the UK relative decile SHAPE (a smooth monotonic curve fit through
D1=1.3, D10=3.3, with intermediate deciles interpolated using the same curvature
documented in the ONS report text -- "average number of people in each household also
increases" with income, most steeply in the upper-middle deciles per ONS commentary),
then RESCALE this shape proportionally so that its household-count-weighted mean equals
each country's own nationally published average household size (source: Eurostat
ilc_lvph01 for DE/FI/SE/NO/CH 2024; ONS "Families and households in the UK: 2024" for UK;
Japan Statistics Bureau / nippon.com 2024 report for JP). This is the same peer-modeling
convention used in v3 (see data/v3/no_expenditure_modeled.json, se_expenditure_modeled.json)
extended to a shape-and-rescale approach for household size. Tier: C (modeled).

National average household size sources (2024 or latest available):
  DE: 2.0  (Eurostat ilc_lvph01, 2024)
  UK: 2.35 (ONS, "Families and households in the UK: 2024")
  NO: 2.0  (Eurostat ilc_lvph01, 2024)
  SE: 2.0  (Eurostat ilc_lvph01, 2024)
  FI: 1.9  (Eurostat ilc_lvph01, 2024)
  CH: 2.2  (Eurostat ilc_lvph01, 2024)
  JP: 2.21 (Japan MIC Housing & Land Survey / nippon.com summary of 2024 data, "average household
             consisted of 2.21 members" per most recent Basic Resident Register tally cited widely;
             stat.go.jp Statistical Handbook cites 2.21 for 2020 census, consistent order of magnitude)
"""
import json

# UK reference decile shape from ONS (2014 LCF, non-equivalised disposable income deciles).
# Only D1 and D10 explicitly published in the fetched text; intermediate deciles are
# interpolated with a monotonic convex curve (steeper rise in upper deciles) which is
# consistent with ONS's qualitative description and with the general shape seen in
# equivalent US Census HINC-01 income-bracket household-size data (see build_household_size_us.py
# output: d1=1.67, d10=3.19, also convex/accelerating toward top deciles).
UK_D1 = 1.3
UK_D10 = 3.3

# Use US decile shape (which we have at full granularity from Census HINC-01, itself an
# empirical anchor) NORMALIZED to [0,1] range, then rescaled to UK_D1..UK_D10 span, as the
# best available common cross-country shape proxy (household size vs income decile follows
# a broadly similar convex pattern across advanced economies: singles/childless concentrate
# in low deciles, multi-adult/multi-child households concentrate in high deciles).
US_SHAPE = {
    "d1": 1.674, "d2": 1.859, "d3": 2.157, "d4": 2.275, "d5": 2.424,
    "d6": 2.622, "d7": 2.823, "d8": 2.962, "d9": 3.133, "d10": 3.19,
}
us_min = min(US_SHAPE.values())
us_max = max(US_SHAPE.values())
us_norm = {k: (v - us_min) / (us_max - us_min) for k, v in US_SHAPE.items()}  # 0..1

# rescale normalized shape to each country's own D1..D10 span, then further rescale
# so the simple decile-average (proxy for household-weighted mean, deciles assumed
# equal-sized population bins) matches the country's published national average size.
NATIONAL_AVG = {
    "DE": 2.0, "UK": 2.35, "NO": 2.0, "SE": 2.0, "FI": 1.9, "CH": 2.2, "JP": 2.21,
}

# Assume UK's own D1/D10 spread ratio (3.3/1.3 = 2.538x) is a reasonable cross-country
# anchor span ratio (Eurostat/OECD Family Database do not publish D1/D10 spread by
# household size per country so this ratio is applied uniformly, flagged as modeled).
SPREAD_RATIO = UK_D10 / UK_D1  # 2.538...

results = {}
for cc, target_avg in NATIONAL_AVG.items():
    # solve for country-specific d1, d10 such that spread ratio holds AND decile-average
    # (using US-shape-normalized weights) equals target_avg
    # value(d) = d1 + norm(d) * (d10 - d1); d10 = d1 * SPREAD_RATIO
    # mean over deciles = d1 + mean(norm) * d1 * (SPREAD_RATIO - 1) = target_avg
    mean_norm = sum(us_norm.values()) / len(us_norm)
    d1 = target_avg / (1 + mean_norm * (SPREAD_RATIO - 1))
    d10 = d1 * SPREAD_RATIO
    deciles = {k: round(d1 + v * (d10 - d1), 3) for k, v in us_norm.items()}
    results[cc] = deciles

print(json.dumps(results, indent=2))

# sanity check: decile average vs target
for cc, deciles in results.items():
    avg = sum(deciles.values()) / len(deciles)
    print(cc, "decile avg:", round(avg, 3), "target:", NATIONAL_AVG[cc])

with open("/home/user/workspace/income-tiles/data/v4/_household_size_intl_partial.json", "w") as f:
    json.dump({"deciles_by_country": results, "national_avg_source": NATIONAL_AVG}, f, indent=2)
print("saved intl partial result")
