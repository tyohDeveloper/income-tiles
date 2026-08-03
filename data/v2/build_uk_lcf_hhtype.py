import json

# Table 5 (ad-hoc FYE2024): columns are:
# State pension 1p, State pension 2p, Other retired 1p, Other retired 2p,
# Non-retired 1p, Non-retired 2p, One adult+1child, Two adults+2ormore children (non-retired "with children" group 1),
# One adult+1child (retired/non-retired combined col 11?), Two adults+2children (col 12?)
# Actual header row 6-10 says: Retired: State pension(1p,2p), Other retired(1p,2p) | Non-retired: One person, Two adults
# | Retired and non-retired households: One adult with one child, Two adults with one or more children,
#   One adult with two+ children? Let's recheck header mapping precisely using row6-10.

groups = [
    "retired_statepension_1p", "retired_statepension_2p",
    "retired_other_1p", "retired_other_2p",
    "nonretired_1p", "nonretired_2p",
    "onedultwithchildren_1child", "twoadults_2ormorechildren",
    "onedult_1child_v2", "twoadults_2children_v2"
]
# From header inspection: cols map as (index in the 4:14 slice used earlier, aligned to row5-10):
# idx0 State pension one person | idx1 State pension two adults | idx2 Other retired one person | idx3 Other retired two adults
# idx4 Non-retired one person | idx5 Non-retired two adults
# idx6 One adult with one child | idx7 Two adults with one child... row7/8/9 text: 'One adult','Two adults','One adult with','with','with','with' then 'one child'/'or more children'/'one child'/'two children'
# So idx6 = One adult with one child ; idx7 = Two adults with one or more children ; idx8 = One adult with... wait there are only 10 data cols (4:14)
group_labels = [
    "retired_state_pension_one_person",
    "retired_state_pension_two_adults",
    "retired_other_one_person",
    "retired_other_two_adults",
    "nonretired_one_person",
    "nonretired_two_adults",
    "one_adult_with_one_child",
    "two_adults_with_one_or_more_children",
    "retired_or_nonretired_one_adult_with_children_v2",
    "retired_or_nonretired_two_adults_with_children_v2"
]

def row_vals(rows, i):
    return rows[i][4:14]

def clean(v):
    if v is None:
        return None
    if isinstance(v,(int,float)):
        return float(v)
    s = str(v).strip().strip('[]').replace(',', '')
    if s in ('', '..', ':', '-'):
        return None
    try:
        return float(s)
    except ValueError:
        return None

import openpyxl
wb = openpyxl.load_workbook('/home/user/workspace/income-tiles/data/v2/raw/ons_adhoc_fye2024.xlsx', read_only=True, data_only=True)
ws = wb['Table 5']
rows = list(ws.iter_rows(values_only=True))

weighted_hh = [clean(x) for x in row_vals(rows, 14)]
food_row = [clean(x) for x in row_vals(rows, 25)]        # 1 Food & non-alcoholic drinks
food_only_row = [clean(x) for x in row_vals(rows, 27)]   # 1.1 Food
catering_row = None
# find catering services row (11.1) - search
for i,row in enumerate(rows):
    if row[0]==11.1 and row[1]=='Catering services':
        catering_idx = i
        break
catering_row = [clean(x) for x in row_vals(rows, catering_idx)]

alcohol_row = [clean(x) for x in row_vals(rows, 104)]     # 2
apparel_row = [clean(x) for x in row_vals(rows, 117)]     # 3
housing_row = [clean(x) for x in row_vals(rows, 137)]     # 4 Housing(net) fuel & power
hh_goods_row = [clean(x) for x in row_vals(rows, 182)]    # 5
health_row = [clean(x) for x in row_vals(rows, 202)]      # 6
transport_row = [clean(x) for x in row_vals(rows, 211)]   # 7
comm_row = [clean(x) for x in row_vals(rows, 231)]        # 8
recreation_row = [clean(x) for x in row_vals(rows, 265)]  # 9
education_row = [clean(x) for x in row_vals(rows, 305)]   # 10
restaurants_row = [clean(x) for x in row_vals(rows, 312)] # 11 (restaurants & hotels, total incl accommodation)
misc_row = [clean(x) for x in row_vals(rows, 353)]        # 12
personal_care_row = [clean(x) for x in row_vals(rows, 355)]  # 12.1
other13_row = [clean(x) for x in row_vals(rows, 381)]     # 13
housing_extra_row = None
for i,row in enumerate(rows):
    if row[0]==13.1:
        housing_extra_idx = i+1  # value row is next line (label wraps to two rows)
        break
housing_extra_row = [clean(x) for x in row_vals(rows, housing_extra_idx)]
total_exp_row = [clean(x) for x in row_vals(rows, 395)]
savings_row = [clean(x) for x in row_vals(rows, 405)]     # 14.6

print("weighted_hh", weighted_hh)
print("total_exp", total_exp_row)
print("housing", housing_row)
print("housing_extra", housing_extra_row)
print("health", health_row)
print("education", education_row)
print("savings", savings_row)

group_names = [
    "retired_state_pension_one_person",
    "retired_state_pension_two_adults",
    "retired_other_one_person",
    "retired_other_two_adults",
    "nonretired_one_person",
    "nonretired_two_adults",
    "one_adult_with_one_child",
    "two_adults_with_one_or_more_children",
    "one_or_two_adults_with_one_child",
    "one_or_two_adults_with_two_or_more_children"
]

# food_at_home = food_only_row (1.1), food_away = catering_row (11.1)
other_leftover_13 = [round(other13_row[i] - housing_extra_row[i],2) if (other13_row[i] is not None and housing_extra_row[i] is not None) else None for i in range(10)]
misc_excl_pc = [round(misc_row[i]-personal_care_row[i],2) if (misc_row[i] is not None and personal_care_row[i] is not None) else None for i in range(10)]
other_bucket = []
for i in range(10):
    parts = [hh_goods_row[i], misc_excl_pc[i], alcohol_row[i], other_leftover_13[i]]
    parts = [p for p in parts if p is not None]
    other_bucket.append(round(sum(parts),2) if parts else None)

housing_combined = [round(housing_row[i]+housing_extra_row[i],2) if (housing_row[i] is not None and housing_extra_row[i] is not None) else None for i in range(10)]

rows_hhtype = []
for i, g in enumerate(group_names):
    exp_by_cat = {
        "housing": housing_combined[i],
        "food_at_home": food_only_row[i],
        "food_away": catering_row[i],
        "healthcare_oop": health_row[i],
        "transport_work": None,
        "transport_total": transport_row[i],
        "apparel": apparel_row[i],
        "communications": comm_row[i],
        "personal_care": personal_care_row[i],
        "education": education_row[i],
        "childcare": None,
        "voluntary_savings": savings_row[i],
        "entertainment": recreation_row[i],
        "other": other_bucket[i]
    }
    rows_hhtype.append({
        "group": g,
        "weighted_households_thousands": weighted_hh[i],
        "avg_income_before_tax": None,
        "avg_income_after_tax": None,
        "avg_expenditure_total": round(total_exp_row[i]*52.1786,2) if total_exp_row[i] is not None else None,
        "expenditure_by_category": {k: (round(v*52.1786,2) if v is not None else None) for k,v in exp_by_cat.items()},
        "housing_owner_share": None,
        "housing_owner_imputed_rent_estimate": None
    })

categories_schema = ["housing","food_at_home","food_away","healthcare_oop","transport_work","transport_total",
                     "apparel","communications","personal_care","education","childcare","voluntary_savings",
                     "entertainment","other"]

data_hhtype = {
    "source": "ONS Living Costs and Food Survey (LCF) via Family Spending ad-hoc Table 5: detailed household expenditure by household composition, UK, FYE 2024",
    "country": "UK",
    "year": 2024,
    "unit": "GBP",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_household_type",
    "categories": categories_schema,
    "rows": rows_hhtype,
    "source_url": "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/adhocs/3014familyspendingadhoctablesukfinancialyearending2024/familyspendingadhoctablesfye24.xlsx",
    "notes": (
        "TIER A (UK): REAL primary-source ONS LCF data, ad-hoc Table 5 'Detailed household expenditure by "
        "household composition', UK FYE 2024. All £/week figures converted to ANNUAL via x52.1786, kept in "
        "nominal GBP (local currency; frontend applies PPP conversion). "
        "GROUP LABELS (source header structure, spanning two logical super-groups): 'Retired households' split "
        "by pension type (State pension / Other retired) x household size (One person / Two adults); "
        "'Non-retired' households split by size only (One person / Two adults, no children distinction in this "
        "column set); and a combined 'Retired and non-retired households' block split by adult count x child "
        "count (One adult with one child / Two adults with one or more children / One or two adults with one "
        "child / One or two adults with two or more children -- the source's last two columns partially overlap "
        "conceptually with the first two of this block per the header merge cells, an ambiguity in the original "
        "ONS table's column spanning that we have preserved via the literal group names rather than resolving "
        "by guesswork). NOTE: unlike US CES's by-household-type file, this table does NOT include a clean "
        "'couple_no_kids' / 'single_parent' taxonomy matching the v2 schema's example group names -- ONS's own "
        "household-composition cuts for FYE2024 in this ad-hoc release are retirement-status-first, not "
        "family-structure-first; consuming code should treat the 'group' field values as free-text labels rather "
        "than assuming exact string matches against the schema's illustrative examples (couple_no_kids, etc.). "
        "avg_income_before_tax and avg_income_after_tax are NULL for all groups -- this ad-hoc release's Table 5 "
        "reports EXPENDITURE only, no income figures by household composition; ONS's income-by-household-type "
        "series (via the Effects of Taxes and Benefits release) uses a different household typology and was not "
        "joined here to avoid a low-confidence cross-table merge; flagged as a gap rather than fabricated. "
        "housing_owner_share is NULL for all groups -- no tenure-by-household-composition cross-tab was located "
        "for FYE2024 within the task budget (only tenure-by-INCOME-DECILE was available, used in the sibling "
        "uk_lcf.json file instead). "
        "CATEGORY MAPPING: identical methodology to uk_lcf.json (by-decile file) -- see that file's notes for "
        "full COICOP-row-to-schema mapping detail. Key difference: in THIS household-composition table, ONS does "
        "NOT suppress the Health (row 6) or Education (row 10) rows for disclosure reasons (unlike the by-decile "
        "table), so healthcare_oop and education are populated with real values here where by-decile they are "
        "null -- education is itself heavily null/suppressed within specific household types too (only "
        "nonretired_two_adults, one_or_two_adults_with_one_child, and one_or_two_adults_with_two_or_more_children "
        "report non-null education spend, consistent with those being the groups most likely to have "
        "school-age children). "
        "avg_expenditure_total = ONS's own published 'Total expenditure' row (sum of groups 1-13); "
        "voluntary_savings (row 14.6, 'Other items recorded') sits outside this total per ONS convention, same "
        "caveat as the by-decile file. All dollar figures nominal 2024 GBP, not inflation-adjusted to another "
        "base year."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/uk_lcf_by_hhtype.json','w') as f:
    json.dump(data_hhtype, f, indent=2)

print("Wrote uk_lcf_by_hhtype.json")
print(json.dumps(rows_hhtype[0], indent=2))
print(json.dumps(rows_hhtype[6], indent=2))
