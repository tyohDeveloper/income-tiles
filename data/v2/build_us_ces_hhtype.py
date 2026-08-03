import json

categories = ["housing","food_at_home","food_away","healthcare_oop","transport_work","transport_total",
              "apparel","communications","personal_care","education","cash_contributions",
              "voluntary_savings","entertainment"]

# PRIMARY SOURCES:
#  - BLS Table 1502 "Composition of consumer unit" 2024, for single/couple/with-kids/one-parent/empty-nester rows
#    (https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-composition-2024.xlsx)
#  - BLS Table 1300 "Age of reference person" 2024, "65 years and older" column, for retirees_65plus row
#    (https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/reference-person-age-ranges-2024.xlsx)
# Both fetched in full via fetch_url (server-side render of BLS xlsx; direct curl/wget is blocked by BLS bot protection).

groups = {
    "single_working_age": {  # BLS "Single person and other consumer units"
        "income_before_tax": 67075,
        "expenditure_total": 56587,
        "food_at_home": 4320,
        "food_away": 2622,
        "healthcare": 4266,
        "transport_total": 9198,
        "transport_work": 3473+1840+725+1554,
        "apparel": 1319,
        "communications": 1109,
        "personal_care": 700,
        "reading_education": 80+872,
        "cash_contributions": 1815,
        "voluntary_savings": 5573,
        "entertainment": 2417,
        "n_thousands": 64426,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "couple_no_kids": {  # BLS "Married couple only"
        "income_before_tax": 120105,
        "expenditure_total": 88687,
        "food_at_home": 6514,
        "food_away": 4469,
        "healthcare": 8683,
        "transport_total": 15317,
        "transport_work": 6445+2778+1123+2065,
        "apparel": 2154,
        "communications": 1533,
        "personal_care": 1132,
        "reading_education": 160+1288,
        "cash_contributions": 3392,
        "voluntary_savings": 9682,
        "entertainment": 4537,
        "n_thousands": 29434,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "with_kids_under6": {  # BLS "Married couple with children, oldest child under 6"
        "income_before_tax": 161271,
        "expenditure_total": 105709,
        "food_at_home": 8317,
        "food_away": 5139,
        "healthcare": 6815,
        "transport_total": 15889,
        "transport_work": 6810+2937+869+2060,
        "apparel": 3356,
        "communications": 1377,
        "personal_care": 1157,
        "reading_education": 182+1276,
        "cash_contributions": 1172,
        "voluntary_savings": 16428,
        "entertainment": 4200,
        "n_thousands": 4661,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "with_kids_6to17": {  # BLS "Married couple with children, oldest child 6-17"
        "income_before_tax": 175737,
        "expenditure_total": 117355,
        "food_at_home": 9582,
        "food_away": 6177,
        "healthcare": 8057,
        "transport_total": 19856,
        "transport_work": 8506+4068+1326+2458,
        "apparel": 3263,
        "communications": 1953,
        "personal_care": 1387,
        "reading_education": 210+3484,
        "cash_contributions": 2237,
        "voluntary_savings": 17958,
        "entertainment": 6542,
        "n_thousands": 14910,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "one_parent_with_kids": {  # BLS "One parent, at least one child under 18"
        "income_before_tax": 61118,
        "expenditure_total": 61857,
        "food_at_home": 5666,
        "food_away": 3529,
        "healthcare": 3247,
        "transport_total": 11296,
        "transport_work": 4940+2187+826+1631,
        "apparel": 1976,
        "communications": 1368,
        "personal_care": 923,
        "reading_education": 75+1343,
        "cash_contributions": 1237,
        "voluntary_savings": 5334,
        "entertainment": 2125,
        "n_thousands": 6161,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "empty_nesters": {  # BLS "Other married couple consumer units" (residual married-couple bucket, used as proxy)
        "income_before_tax": 148763,
        "expenditure_total": 103121,
        "food_at_home": 9704,
        "food_away": 5103,
        "healthcare": 8326,
        "transport_total": 17827,
        "transport_work": 6130+4209+1400+3011,
        "apparel": 2534,
        "communications": 2304,
        "personal_care": 1177,
        "reading_education": 157+2426,
        "cash_contributions": 2282,
        "voluntary_savings": 12713,
        "entertainment": 4076,
        "n_thousands": 5420,
        "homeowner_share": None,
        "imputed_rent": None,
    },
    "retirees_65plus": {  # BLS Table 1300, "65 years and older" column (age of reference person, age-based proxy)
        "income_before_tax": 67462,
        "expenditure_total": 61432,
        "food_at_home": 5251,
        "food_away": 2689,
        "healthcare": 7799,
        "transport_total": 9538,
        "transport_work": 3510+1806+814+1558,
        "apparel": 1198,
        "communications": 1249,
        "personal_care": 782,
        "reading_education": 120+429,
        "cash_contributions": 3158,
        "voluntary_savings": 2863,  # BLS "Retirement, pensions, and Social Security" line for 65+ -- mostly SS receipts/small residual contributions, NOT a clean voluntary-savings figure; see notes
        "entertainment": 3025,
        "n_thousands": 38369,
        "homeowner_share": 0.78,
        "imputed_rent": 1798*12,
    },
}

# Housing totals = BLS's full "Housing" major category = shelter + utilities/fuels/public services +
# household operations + housekeeping supplies + household furnishings & equipment (same construction as decile file).
housing_totals = {
    "single_working_age": 13894+3694+1252+614+1696,
    "couple_no_kids": 16970+5177+1799+1072+3070,
    "with_kids_under6": 22301+5062+7150+1270+3046,
    "with_kids_6to17": 21066+6225+3372+1114+3176,
    "one_parent_with_kids": 14367+4439+1872+588+1783,
    "empty_nesters": 20260+6790+2124+1240+3000,
    "retirees_65plus": 12995+4480+1706+859+2153,  # Table 1300 65+: shelter 12995, utilities 4480, hh ops 1706, housekeeping 859, furnishings 2153
}
for k, v in housing_totals.items():
    groups[k]["housing"] = v

rows = []
for key, g in groups.items():
    rows.append({
        "group": key,
        "avg_income_before_tax": g["income_before_tax"],
        "avg_income_after_tax": None,
        "avg_expenditure_total": g["expenditure_total"],
        "expenditure_by_category": {
            "housing": g["housing"],
            "food_at_home": g["food_at_home"],
            "food_away": g["food_away"],
            "healthcare_oop": g["healthcare"],
            "transport_work": g["transport_work"],
            "transport_total": g["transport_total"],
            "apparel": g["apparel"],
            "communications": g["communications"],
            "personal_care": g["personal_care"],
            "education": g["reading_education"],
            "cash_contributions": g["cash_contributions"],
            "voluntary_savings": g["voluntary_savings"],
            "entertainment": g["entertainment"],
        },
        "housing_owner_share": g["homeowner_share"],
        "housing_owner_imputed_rent_estimate": g["imputed_rent"],
        "n_consumer_units_thousands": g["n_thousands"],
    })

out = {
    "source": "BLS CES",
    "country": "US",
    "year": 2024,
    "unit": "USD",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_household_type",
    "categories": categories,
    "rows": rows,
    "source_url": "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-composition-2024.xlsx",
    "notes": (
        "PRIMARY SOURCES: BLS Table 1502 'Composition of consumer unit' 2024 (single/couple/with-kids/one-parent/"
        "empty-nester rows), full URL https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-composition-2024.xlsx; "
        "and BLS Table 1300 'Age of reference person' 2024, 65-years-and-older column (retirees_65plus row), full URL "
        "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/reference-person-age-ranges-2024.xlsx. "
        "Both retrieved complete via fetch_url server-side rendering (direct curl/wget of BLS xlsx URLs returns an HTML "
        "bot-challenge page, not the file). "
        "BLS's own consumer-unit-type categories do not exactly match the v2 plan's 7-category household-type selector, "
        "so the following MAPPING was applied: "
        "'single_working_age' <- BLS 'Single person and other consumer units' (BLS does not isolate a pure working-age "
        "subgroup within singles in these summary tables; blends all ages, so it will skew somewhat older/younger than "
        "a strict 25-64 filter -- flagged as an approximation). "
        "'couple_no_kids' <- BLS 'Married couple only' (any age, no children present; some empty-nester couples are "
        "also captured here since 'empty_nesters' below uses a different BLS bucket). "
        "'with_kids_under6' and 'with_kids_6to17' <- BLS 'Married couple with children, oldest child under 6' and "
        "'oldest child 6 to 17' respectively. IMPORTANT: BLS splits by AGE OF OLDEST child, not whether the household "
        "has any child in a given band -- e.g. a family with a 3-year-old and a 15-year-old appears only in the "
        "'oldest child 6-17' bucket. The v2 plan's 'kids under 12' and 'kids 12-18' buckets do not line up cleanly "
        "with BLS's under-6/6-17/18+ breaks: 'with_kids_under6' is a partial proxy for 'kids under 12' (undercounts "
        "households whose oldest child is 6-11), and 'with_kids_6to17' spans both the v2 'under 12' and '12-18' "
        "buckets. Treat both as approximations pending a custom BLS microdata pull for exact age-band alignment. "
        "'one_parent_with_kids' <- BLS 'One parent, at least one child under 18' (direct match). "
        "'empty_nesters' <- BLS 'Other married couple consumer units' (BLS's residual married-couple category: "
        "couples with related persons other than their own children under 18, or with adult children present -- the "
        "closest available BLS bucket to 'empty nesters (55+, no dependents)', but not age-filtered by BLS and may "
        "include some non-empty-nest households; true empty-nester isolation would require microdata). "
        "'retirees_65plus' <- BLS Table 1300 age-of-reference-person '65 years and older' column (age-based, not "
        "employment-based; may include some still-working 65+ reference persons since BLS does not publish a "
        "'no employment income' filter in these summary tables; Table 1300 shows 65+ mean wages/salaries of $23,800 "
        "and Social-Security/retirement income of $33,382, confirming a working-retiree mix is included). "
        "CATEGORY-LEVEL CAVEATS specific to this file: "
        "'voluntary_savings' for retirees_65plus (2863) is BLS's 'Retirement, pensions, and Social Security' outlay "
        "line for the 65+ column -- for this age group the figure mostly reflects a small residual of continued "
        "payroll/self-employment tax and/or private pension premiums among still-working or self-employed retirees, "
        "NOT net retirement saving (65+ households are typically net decumulators of savings, drawing down assets and "
        "receiving Social Security as income rather than contributing to it -- see the same table's 'Sources of "
        "pretax income' section showing $33,382 mean Social Security/retirement income received by 65+ households). "
        "This line should NOT be interpreted as a 'voluntary savings rate' for retirees without further adjustment "
        "in the client-side pipeline. "
        "'housing_owner_share' and 'housing_owner_imputed_rent_estimate' are populated ONLY for retirees_65plus "
        "(0.78 homeowner share and $1,798/month * 12 = $21,576/year imputed rent, both directly from Table 1300's "
        "'Housing tenure: Homeowner' percent distribution and 'Estimated monthly rental value of owned home' addendum "
        "for the 65+ column) -- these fields are null for the other six household-type rows because Table 1502's "
        "captured content in this pull did not include the paired homeownership percent-distribution and imputed-rent "
        "addenda rows broken out by composition type; these could be backfilled from a fuller Table 1502 fetch if the "
        "frontend requires per-household-type owner shares. "
        "CATEGORY MAPPING for housing/food/healthcare/transport_work/communications/education/voluntary_savings "
        "construction is otherwise identical to us_ces_2024_by_decile.json (see that file's notes field for full "
        "detail): 'housing' = BLS's full Housing major category (shelter + utilities/fuels/public services + "
        "household operations + housekeeping supplies + household furnishings & equipment); 'healthcare_oop' = BLS's "
        "Healthcare major category (BLS does not separate premiums from true out-of-pocket cost, a known undercount "
        "vs BEA PCE per v2-plan.md open question #6); 'transport_work' is a CONSTRUCTED subtotal (vehicle purchases "
        "net outlay + gasoline & other fuels + maintenance & repairs + vehicle insurance), excluding public/other "
        "transportation, finance charges, and vehicle rental/lease/license fees; 'communications' = BLS 'Telephone "
        "services' line only (no separate broadband/internet line in BLS summary tables); 'education' = BLS 'Reading' "
        "+ BLS 'Education' summed. avg_income_after_tax is null throughout because these BLS composition/age tables "
        "report income before taxes only."
    ),
}

with open("/home/user/workspace/income-tiles/data/v2/us_ces_2024_by_hhtype.json", "w") as f:
    json.dump(out, f, indent=2)

print("Wrote us_ces_2024_by_hhtype.json with", len(rows), "rows")
