#!/usr/bin/env python3
"""
Build fi_hbs.json — Finland Household Budget Survey (Kulutustutkimus) 2022
by income quintile, from Statistics Finland (Tilastokeskus) StatFin PxWeb API.

Sources:
- Table 14pg "Household consumption expenditure by income quintile, 2012-2022"
  https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14pg.px
  (queried via POST for year=2022, top-level COICOP categories 0/01-13, all quintiles,
   contentscode=kulu_kt_hk_1_1 = "Household's consumption expenditure at current prices per year, EUR")
- Table 14qa "Background information by income quintile, 2012-2022"
  https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14qa.px
  (disposable income per household, household counts, average household size)

Table landing pages (human-readable):
  https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ktutk/statfin_ktutk_pxt_14pg.px/
  https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ktutk/statfin_ktutk_pxt_14qa.px/

Tier A (real primary-source microdata aggregates, no fabrication).
Currency: EUR (local currency; frontend applies PPP conversion at display time).
"""
import json

RAW_EXP = "raw/fi_14pg_response.json"
RAW_INC = "raw/fi_14qa_response.json"
OUT = "fi_hbs.json"

exp = json.load(open(RAW_EXP))
inc = json.load(open(RAW_INC))

# --- Parse expenditure table (dims: timeperiod_y[1], coicop[14], quintile[5]) ---
coicop_labels = exp["dimension"]["coicop_46_20231201"]["category"]["label"]
coicop_index = exp["dimension"]["coicop_46_20231201"]["category"]["index"]  # code -> position
quintile_labels = exp["dimension"]["tuloviidennes_2_20140501"]["category"]["label"]
quintile_index = exp["dimension"]["tuloviidennes_2_20140501"]["category"]["index"]

n_coicop = len(coicop_index)
n_quintile = len(quintile_index)
# value order follows dimension order: timeperiod_y (size1) x coicop (size14) x quintile (size5) x contentscode(size1)
# id order = ['timeperiod_y','coicop_46_20231201','tuloviidennes_2_20140501','contentscode']
values = exp["value"]
assert len(values) == 1 * n_coicop * n_quintile * 1, (len(values), n_coicop, n_quintile)

# reshape: index = coicop_pos * n_quintile + quintile_pos
exp_by_quintile_coicop = {}  # {quintile_code: {coicop_code: value}}
for q_code, q_pos in quintile_index.items():
    exp_by_quintile_coicop[q_code] = {}
for c_code, c_pos in coicop_index.items():
    for q_code, q_pos in quintile_index.items():
        idx = c_pos * n_quintile + q_pos
        exp_by_quintile_coicop[q_code][c_code] = values[idx]

# --- Parse income/background table (dims: timeperiod_y[1], quintile[5], contentscode[5]) ---
inc_content_index = inc["dimension"]["contentscode"]["category"]["index"]
inc_quintile_index = inc["dimension"]["tuloviidennes_2_20140501"]["category"]["index"]
n_inc_content = len(inc_content_index)
n_inc_quintile = len(inc_quintile_index)
inc_values = inc["value"]
# id order = ['timeperiod_y','tuloviidennes_2_20140501','contentscode']
assert len(inc_values) == 1 * n_inc_quintile * n_inc_content

inc_by_quintile = {}
for q_code, q_pos in inc_quintile_index.items():
    inc_by_quintile[q_code] = {}
    for c_code, c_pos in inc_content_index.items():
        idx = q_pos * n_inc_content + c_pos
        inc_by_quintile[q_code][c_code] = inc_values[idx]

# contentscode meanings (from metadata):
# oklkm_sum = Households in sample
# pklkm_sum = Households in population
# jlkm_mean = Average size of household
# oecdmod_mean = Average number of consumption units per household (oecd-modified)
# Kaytetmk_1_mean = Disposable income per household, nominal EUR (2022 prices in this query = current-year since year=2022)

# --- Category mapping: Finland COICOP top-level (01-13) -> v2 schema categories ---
# 01 Food and non-alcoholic beverages -> split not available at top level; entire 01 assigned to food_at_home,
#    food_away comes from 11.1 (Food and beverage serving services) which is a subset of "11 Restaurants and
#    accommodation services" - not separately queried at top level, so food_away is left null here (would require
#    querying the finer 11.1 vs 11.2 split; documented as a known limitation, see notes).
# 02 Alcoholic beverages and tobacco -> "other" (not a dedicated schema category)
# 03 Clothing and footwear -> apparel
# 04 Housing, water, electricity, gas and other fuels -> housing
# 05 Furnishings, household equipment and routine household maintenance -> other
# 06 Health -> healthcare_oop (Finnish COICOP 06 excludes health insurance premiums, which fall under 12.1.2)
# 07 Transport -> transport_total (07.2.2 fuels/lubricants + related could proxy transport_work but not separately
#    queried at top level; transport_work left null)
# 08 Information and communication -> communications
# 09 Recreation, sport and culture -> entertainment
# 10 Education services -> education
# 11 Restaurants and accommodation services -> food_away (approximation: this category also includes hotel/
#    accommodation services, not just dining, so food_away is somewhat overstated; documented in notes)
# 12 Insurance and financial services -> other (contains health/dwelling/transport insurance + financial service fees)
# 13 Personal care, social protection and miscellaneous -> personal_care (also contains childcare services
#    under 13.3.0.1, which cannot be isolated at this level of aggregation; childcare left null)

CATEGORY_MAP = {
    "housing": ["04"],
    "food_at_home": ["01"],
    "food_away": ["11"],
    "healthcare_oop": ["06"],
    "transport_work": None,
    "transport_total": ["07"],
    "apparel": ["03"],
    "communications": ["08"],
    "personal_care": ["13"],
    "education": ["10"],
    "childcare": None,
    "voluntary_savings": None,
    "entertainment": ["09"],
    "other": ["02", "05", "12"],
}

CATEGORIES = ["housing","food_at_home","food_away","healthcare_oop","transport_work",
              "transport_total","apparel","communications","personal_care","education",
              "childcare","voluntary_savings","entertainment","other"]

QUINTILE_GROUP_MAP = {"1": "q1", "2": "q2", "3": "q3", "4": "q4", "5": "q5"}

rows = []
for q_code in ["1", "2", "3", "4", "5"]:
    exp_map = exp_by_quintile_coicop[q_code]
    total_exp = exp_map.get("0")  # "0 Total"

    cat_values = {}
    for cat, coicop_codes in CATEGORY_MAP.items():
        if coicop_codes is None:
            cat_values[cat] = None
        else:
            s = 0.0
            ok = True
            for cc in coicop_codes:
                v = exp_map.get(cc)
                if v is None:
                    ok = False
                    break
                s += v
            cat_values[cat] = round(s, 1) if ok else None

    disposable_income = inc_by_quintile[q_code].get("Kaytetmk_1_mean")

    rows.append({
        "group": QUINTILE_GROUP_MAP[q_code],
        "avg_income_before_tax": None,  # not published in this survey's quintile breakdown; see notes
        "avg_income_after_tax": disposable_income,
        "avg_expenditure_total": total_exp,
        "expenditure_by_category": cat_values,
        "housing_owner_share": None,  # not queried from this table; would require table 14qc/14lv cross-tab
        "housing_owner_imputed_rent_estimate": None,
    })

out = {
    "source": "Statistics Finland (Tilastokeskus), Household Budget Survey (Kulutustutkimus) 2022",
    "country": "Finland",
    "year": 2022,
    "unit": "EUR",
    "price_basis": "nominal_2022",
    "data_tier": "A",
    "breakdown": "by_quintile",
    "categories": CATEGORIES,
    "rows": rows,
    "source_url": "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14pg.px ; https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14qa.px ; https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ktutk/statfin_ktutk_pxt_14pg.px/ ; https://stat.fi/en/publication/clmyi6vct7jjp0cutgh4ngdsb",
    "notes": (
        "Real primary-source data (Tier A) from Statistics Finland's triennial Household Budget Survey "
        "(Kulutustutkimus), most recent wave = 2022 (survey years 2012, 2016, 2022 only; no 2023/2024 wave "
        "exists — 2022 is the latest available). Retrieved via the StatFin PxWeb API "
        "(table 14pg for expenditure, table 14qa for disposable income and household counts), NOT scraped from "
        "narrative press releases. Figures are annual EUR at current (2022) prices, per household (not per "
        "consumption unit) unless noted. Breakdown is by_quintile (I=lowest 20% income to V=highest 20% income), "
        "matching Statistics Finland's own income-quintile grouping methodology for this survey (based on "
        "disposable income per consumption unit, OECD-modified equivalence scale). "
        "\n\nCATEGORY MAPPING (Finnish COICOP top-level 01-13, ECOICOP 2018 vintage, coded 'coicop_46_20231201' "
        "in the API): 04 Housing/water/electricity/gas/fuels -> housing (includes imputed rent for owner-occupiers, "
        "COICOP 04.2, which Finland's survey methodology imputes and includes in total consumption expenditure — "
        "this differs from BLS/ONS conventions that may treat imputed rent separately; flagged for frontend "
        "author). 01 Food/non-alcoholic beverages -> food_at_home in full (Finland's top-level COICOP 01 does not "
        "separately break out at-home vs away-from-home dining at this level; away-from-home dining sits under "
        "COICOP 11.1, not 01). 11 Restaurants/accommodation services -> food_away (approximation only: also "
        "includes hotel/accommodation spending, which is not separable from restaurant/cafe spending at the "
        "aggregated level queried; this overstates true food_away and is a documented, not fabricated, "
        "approximation). 06 Health -> healthcare_oop (excludes mandatory/voluntary health insurance premiums, "
        "which fall under COICOP 12.1.2 Insurance connected with health). 07 Transport -> transport_total in "
        "full; transport_work (commute-specific subset) is NOT separately available at the top-level COICOP "
        "breakdown queried and is left null rather than estimated. 03 Clothing/footwear -> apparel. "
        "08 Information/communication -> communications. 09 Recreation/sport/culture -> entertainment. "
        "10 Education services -> education (Finland provides largely free public education; this category is "
        "expected to be small/near-zero for most households and mainly reflects private tuition, courses, and "
        "supplies). 13 Personal care/social protection/misc -> personal_care in full (this category also bundles "
        "childcare services under COICOP 13.3.0.1, which cannot be isolated from the top-level aggregate; "
        "childcare is therefore left null rather than double-counted or guessed). 02 Alcoholic beverages/tobacco, "
        "05 Furnishings/household equipment, and 12 Insurance/financial services are combined into 'other' "
        "(none map cleanly to a dedicated v2 schema category). voluntary_savings is left null: Finland's "
        "consumption expenditure survey measures expenditure, not saving/investment flows, so no comparable "
        "figure exists in this source. "
        "\n\navg_income_before_tax is left null for ALL quintiles: table 14qa (background information by income "
        "quintile) publishes only 'disposable income per household' (Käytettävissä oleva rahatulo, contentscode "
        "Kaytetmk_1_mean), used here as avg_income_after_tax. No gross/pre-tax household income by quintile is "
        "published for this specific consumption-survey sample. Finland's separate income distribution survey "
        "(StatFin__tjt, e.g. table 128c) does publish gross income by income DECILE, but that is a different "
        "sample/survey (register-based income distribution statistics, not the triennial consumption survey) "
        "using deciles rather than quintiles — mixing the two would misattribute expenditure and income to "
        "different underlying household samples, so it was deliberately NOT done, per the 'do not fabricate' "
        "rule for Tier A data. "
        "\n\nhousing_owner_share and housing_owner_imputed_rent_estimate are left null for all quintiles: "
        "tenure-status-by-income-quintile cross-tabs were not queried/found in a directly joinable StatFin table "
        "in the time available (a tenure/building-type table 14lv exists by household type, and 13qk covers "
        "heating mode by building type, but neither crosses tenure status with income quintile). Note that "
        "COICOP 04.2 imputed rent IS embedded inside the housing figure per Finland's methodology (see above), "
        "so imputed rent is not being ignored, only not separately reported as its own line. "
        "\n\nAll values in EUR (local currency); frontend applies PPP conversion at display time per project "
        "convention. Household counts, average household size, and OECD-modified consumption units per "
        "household are available in the raw API response (raw/fi_14qa_response.json) if needed for weighting "
        "but were not required by the v2 schema and are omitted from 'rows'."
    ),
}

with open(OUT, "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Wrote {OUT} with {len(rows)} rows")
for r in rows:
    print(r["group"], "total_exp=", r["avg_expenditure_total"], "disp_income=", r["avg_income_after_tax"])
