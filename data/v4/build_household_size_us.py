#!/usr/bin/env python3
"""
A.1 (US portion) - Household size by income decile.
Source: Census Bureau CPS ASEC, Table HINC-01 "Selected Characteristics of Households
by Total Money Income", income year 2023 (published 2024).
https://www2.census.gov/programs-surveys/cps/tables/hinc-01/2024/hinc01_1.xlsx

Method: HINC-01 gives household counts (thousands) and mean household size for each of
42 income brackets ($5k width up to $195-199,999, plus "$200,000 and over"). We compute
cumulative household share across brackets to assign each bracket to decile bin(s), then
compute a household-count-weighted average household size per decile.
"""
import json

# income bracket labels in order
labels = ['Under $5,000','$5,000 to $9,999','$10,000 to $14,999','$15,000 to $19,999',
'$20,000 to $24,999','$25,000 to $29,999','$30,000 to $34,999','$35,000 to $39,999',
'$40,000 to $44,999','$45,000 to $49,999','$50,000 to $54,999','$55,000 to $59,999',
'$60,000 to $64,999','$65,000 to $69,999','$70,000 to $74,999','$75,000 to $79,999',
'$80,000 to $84,999','$85,000 to $89,999','$90,000 to $94,999','$95,000 to $99,999',
'$100,000 to $104,999','$105,000 to $109,999','$110,000 to $114,999','$115,000 to $119,999',
'$120,000 to $124,999','$125,000 to $129,999','$130,000 to $134,999','$135,000 to $139,999',
'$140,000 to $144,999','$145,000 to $149,999','$150,000 to $154,999','$155,000 to $159,999',
'$160,000 to $164,999','$165,000 to $169,999','$170,000 to $174,999','$175,000 to $179,999',
'$180,000 to $184,999','$185,000 to $189,999','$190,000 to $194,999','$195,000 to $199,999',
'$200,000 and over']

counts = [4068,1782,3972,4299,4553,4597,4592,4634,4403,4521,4717,4097,4510,3768,3649,3427,
3506,3144,3264,2693,3260,2530,2528,2404,2512,2006,2056,1804,1848,1523,2078,1406,1474,1259,
1217,1089,1294,981,943,766,19040]

sizes = [1.82,1.82,1.54,1.58,1.79,1.87,2.02,2.14,2.18,2.22,2.24,2.25,2.41,2.39,2.39,2.49,2.52,
2.62,2.6,2.7,2.78,2.78,2.87,2.77,2.86,2.93,2.87,2.9,2.96,3.02,2.92,3.11,3.04,3.06,3.12,3.17,
3.08,3.01,2.99,3.19,3.19]

total_hh = 132200  # thousands

assert len(labels) == len(counts) == len(sizes) == 41, (len(labels), len(counts), len(sizes))

# Build cumulative distribution over brackets (household count weighted)
cum = 0
bracket_cum = []  # (cum_before, cum_after, count, size)
for c, s in zip(counts, sizes):
    bracket_cum.append((cum, cum + c, c, s))
    cum += c

# cum should ~= total_hh (small rounding diff ok)
print("sum of bracket counts:", cum, "vs total_hh:", total_hh)

def decile_weighted_size(d_lo_frac, d_hi_frac):
    """Household-count-weighted mean size for households whose cumulative share falls in [d_lo_frac, d_hi_frac)."""
    lo = d_lo_frac * cum
    hi = d_hi_frac * cum
    weighted_sum = 0.0
    weight = 0.0
    for (c_before, c_after, count, size) in bracket_cum:
        # overlap between [c_before, c_after) and [lo, hi)
        overlap = max(0, min(c_after, hi) - max(c_before, lo))
        if overlap > 0:
            weighted_sum += overlap * size
            weight += overlap
    return weighted_sum / weight if weight > 0 else None

deciles = {}
for i in range(1, 11):
    lo = (i - 1) / 10
    hi = i / 10
    val = decile_weighted_size(lo, hi)
    deciles[f"d{i}"] = round(val, 3)

print(json.dumps(deciles, indent=2))

result = {
    "source": "US Census Bureau, Current Population Survey Annual Social and Economic Supplement (CPS ASEC), Table HINC-01",
    "source_url": "https://www2.census.gov/programs-surveys/cps/tables/hinc-01/2024/hinc01_1.xlsx",
    "income_year": 2023,
    "survey_year": 2024,
    "method": "Household-count-weighted mean household size, computed by allocating each of the 41 published $5,000-wide income brackets (plus open-ended $200k+ bracket) proportionally across income deciles by cumulative household share, then weighting each bracket's published mean household size by its overlap with each decile band. NOTE: HINC-01 is used instead of HINC-04 because HINC-01 publishes mean household size directly cross-tabulated with income brackets at fine granularity; HINC-04 cross-tabulates by presence-of-children x household type, not by income decile, so does not support decile-level household-size estimation as directly.",
    "deciles": deciles,
}

with open("/home/user/workspace/income-tiles/data/v4/_household_size_us_partial.json", "w") as f:
    json.dump(result, f, indent=2)
print("saved partial US result")
