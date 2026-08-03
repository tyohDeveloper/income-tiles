import json

# ---------- Decile file (Table 1110, 2024) ----------
decile_income = {
    "d1": 9612, "d2": 23805, "d3": 36188, "d4": 49681, "d5": 65170,
    "d6": 83760, "d7": 106439, "d8": 136502, "d9": 182587, "d10": 346942,
}
decile_expenditure_total = {
    "d1": 31660, "d2": 38473, "d3": 46340, "d4": 53778, "d5": 62880,
    "d6": 70913, "d7": 81716, "d8": 98158, "d9": 121317, "d10": 179513,
}
# housing = shelter + utilities,fuels,public services + household operations + housekeeping supplies + household furnishings & equipment
decile_shelter = {"d1": 8287, "d2": 10083, "d3": 11252, "d4": 12553, "d5": 14369, "d6": 16144, "d7": 16963, "d8": 18730, "d9": 21456, "d10": 33257}
decile_utilities = {"d1": 2627, "d2": 3246, "d3": 3890, "d4": 4240, "d5": 4402, "d6": 4867, "d7": 5253, "d8": 5608, "d9": 6137, "d10": 7079}
decile_hhops = {"d1": 864, "d2": 837, "d3": 1068, "d4": 1188, "d5": 1507, "d6": 1515, "d7": 1850, "d8": 2167, "d9": 3044, "d10": 5149}
decile_housekeeping = {"d1": 474, "d2": 552, "d3": 655, "d4": 707, "d5": 743, "d6": 852, "d7": 996, "d8": 1138, "d9": 1236, "d10": 1418}
decile_furnishings = {"d1": 1043, "d2": 1130, "d3": 1329, "d4": 1469, "d5": 1795, "d6": 1990, "d7": 2994, "d8": 3036, "d9": 3637, "d10": 5702}
decile_housing_total = {"d1": 13295, "d2": 15849, "d3": 18193, "d4": 20158, "d5": 22816, "d6": 25368, "d7": 28056, "d8": 30678, "d9": 35511, "d10": 52604}

decile_food_at_home = {"d1": 3655, "d2": 4031, "d3": 4515, "d4": 5390, "d5": 5625, "d6": 6015, "d7": 6766, "d8": 7559, "d9": 8357, "d10": 10313}
decile_food_away = {"d1": 1656, "d2": 1655, "d3": 2366, "d4": 2530, "d5": 2987, "d6": 3567, "d7": 4259, "d8": 5106, "d9": 6264, "d10": 9039}
decile_healthcare = {"d1": 2755, "d2": 4145, "d3": 4568, "d4": 5085, "d5": 5281, "d6": 6071, "d7": 6916, "d8": 7574, "d9": 9072, "d10": 10476}
decile_transport_total = {"d1": 4341, "d2": 5881, "d3": 7549, "d4": 9314, "d5": 11261, "d6": 12052, "d7": 13714, "d8": 18167, "d9": 21146, "d10": 29636}
# work-related vehicle costs proxy = vehicle purchases + gasoline + maintenance&repairs + vehicle insurance (excludes public/other transportation & finance charges & rental/leases)
decile_transport_work = {
    "d1": 1383+1205+359+732, "d2": 2058+1320+430+1060, "d3": 2416+1885+649+1624,
    "d4": 3435+2176+737+1734, "d5": 4325+2495+886+1846, "d6": 3917+2791+1014+2210,
    "d7": 4580+3092+1114+2343, "d8": 7297+3606+1233+2692, "d9": 9441+3897+1474+2718,
    "d10": 14450+3966+1942+2962,
}
decile_apparel = {"d1": 997, "d2": 1250, "d3": 1217, "d4": 1439, "d5": 1658, "d6": 1626, "d7": 1779, "d8": 2290, "d9": 3024, "d10": 4719}
decile_communications = {"d1": 775+93, "d2": 893+133, "d3": 1144+133, "d4": 1263+105, "d5": 1367+96, "d6": 1562+81, "d7": 1673+95, "d8": 1865+89, "d9": 1963+83, "d10": 2085+94}  # telephone services (incl residential+cell already in telephone total, this is telephone services mean)
# simpler: telephone services total already includes cell+residential; use telephone services mean directly
decile_communications = {"d1": 775, "d2": 893, "d3": 1144, "d4": 1263, "d5": 1367, "d6": 1562, "d7": 1673, "d8": 1865, "d9": 1963, "d10": 2085}
decile_personal_care = {"d1": 369, "d2": 486, "d3": 637, "d4": 681, "d5": 807, "d6": 896, "d7": 1065, "d8": 1224, "d9": 1490, "d10": 2115}
decile_reading_education = {"d1": 46+1169, "d2": 48+482, "d3": 82+493, "d4": 68+322, "d5": 84+573, "d6": 80+925, "d7": 120+1171, "d8": 123+1532, "d9": 218+2788, "d10": 383+6207}
decile_cash_contributions = {"d1": 687, "d2": 869, "d3": 1170, "d4": 1670, "d5": 1687, "d6": 2161, "d7": 2080, "d8": 2499, "d9": 4513, "d10": 5552}
decile_personal_ins_pensions = {"d1": 455, "d2": 971, "d3": 2128, "d4": 3297, "d5": 5244, "d6": 7251, "d7": 9743, "d8": 14103, "d9": 19867, "d10": 34737}
decile_voluntary_savings = {"d1": 311, "d2": 767, "d3": 1835, "d4": 2980, "d5": 4804, "d6": 6820, "d7": 9232, "d8": 13379, "d9": 19005, "d10": 32918}  # retirement, pensions, and social security line (includes mandatory SS + voluntary 401k; BLS doesn't split)
decile_entertainment = {"d1": 1144, "d2": 1489, "d3": 1949, "d4": 2363, "d5": 2646, "d6": 2881, "d7": 3595, "d8": 4666, "d9": 6145, "d10": 9185}

decile_owner_share = {"d1": 0.34, "d2": 0.51, "d3": 0.57, "d4": 0.59, "d5": 0.60, "d6": 0.64, "d7": 0.71, "d8": 0.77, "d9": 0.85, "d10": 0.90}
decile_imputed_rent = {"d1": 604, "d2": 908, "d3": 1048, "d4": 1116, "d5": 1251, "d6": 1395, "d7": 1608, "d8": 1905, "d9": 2321, "d10": 3395}  # estimated monthly rental value of owned home -> will note as monthly

categories = ["housing","food_at_home","food_away","healthcare_oop","transport_work","transport_total",
              "apparel","communications","personal_care","education","cash_contributions",
              "voluntary_savings","entertainment"]

rows = []
for d in ["d1","d2","d3","d4","d5","d6","d7","d8","d9","d10"]:
    rows.append({
        "group": d,
        "avg_income_before_tax": decile_income[d],
        "avg_income_after_tax": None,
        "avg_expenditure_total": decile_expenditure_total[d],
        "expenditure_by_category": {
            "housing": decile_housing_total[d],
            "food_at_home": decile_food_at_home[d],
            "food_away": decile_food_away[d],
            "healthcare_oop": decile_healthcare[d],
            "transport_work": round(decile_transport_work[d]),
            "transport_total": decile_transport_total[d],
            "apparel": decile_apparel[d],
            "communications": decile_communications[d],
            "personal_care": decile_personal_care[d],
            "education": decile_reading_education[d],
            "cash_contributions": decile_cash_contributions[d],
            "voluntary_savings": decile_voluntary_savings[d],
            "entertainment": decile_entertainment[d],
        },
        "housing_owner_share": decile_owner_share[d],
        "housing_owner_imputed_rent_estimate": decile_imputed_rent[d] * 12,  # annualized
    })

us_ces_decile = {
    "source": "BLS CES",
    "country": "US",
    "year": 2024,
    "unit": "USD",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_decile",
    "categories": categories,
    "rows": rows,
    "source_url": "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-income-deciles-before-taxes-2024.xlsx",
    "notes": (
        "Table 1110, Deciles of income before taxes, Consumer Expenditure Surveys 2024 (BLS, published Dec 2025). "
        "All figures are ANNUAL MEANS per consumer unit (not medians). income_after_tax is null because Table 1110 "
        "does not report after-tax income by decile (only the top-line means table 'cu-all-detail' reports "
        "'Income after taxes' for ALL consumer units combined: $87,869 in 2023 vintage; 2024 all-CU after-tax figure "
        "was not captured in this pull — left null rather than guessed). "
        "CATEGORY MAPPING: housing = Shelter + Utilities/fuels/public services + Household operations + Housekeeping "
        "supplies + Household furnishings & equipmentthis is BLS's full 'Housing' major category. food_at_home / "
        "food_away are BLS's own subcategories of 'Food'. healthcare_oop = BLS 'Healthcare' major category (health "
        "insurance premiums + medical services + drugs + medical supplies) -- this includes both premiums and true "
        "out-of-pocket, per BLS methodology (BLS does not further split premium vs true OOP cost in this table). "
        "transport_total = BLS 'Transportation' major category. transport_work is NOT a BLS-published subtotal -- it "
        "is CONSTRUCTED here as vehicle purchases (net outlay) + gasoline & other fuels + maintenance & repairs + "
        "vehicle insurance, excluding public/other transportation, vehicle finance charges, and vehicle rental/lease/"
        "license fees; this is a reasonable proxy for 'cost of owning/running a vehicle for work' but is an "
        "approximation, not an official BLS category -- treat with caution. apparel = BLS 'Apparel and services'. "
        "communications = BLS 'Telephone services' line item only (residential + cellular combined) -- BLS does not "
        "have a standalone broadband/internet line in these summary tables (internet often falls under 'Audio and "
        "visual equipment and services' within Entertainment, not broken out); this understates true communications "
        "spend. personal_care = BLS 'Personal care products and services'. education = BLS 'Reading' + BLS "
        "'Education' summed (per v2 schema's combined 'reading + education' category). cash_contributions = BLS "
        "'Cash contributions'. voluntary_savings = BLS 'Retirement, pensions, and Social Security' sub-line under "
        "'Personal insurance and pensions' -- IMPORTANT: this BLS line includes mandatory Social Security payroll "
        "tax contributions AND voluntary employer-sponsored retirement plan contributions (401k, etc.) blended "
        "together; BLS does not separate them. The v2 pipeline will need to subtract an estimated mandatory FICA "
        "OASDI share (6.2% of wages up to the wage base) if a true 'voluntary savings' figure is needed -- flagged "
        "for the client-side necessity/savings calculator. entertainment = BLS 'Entertainment' major category. "
        "housing_owner_share = percent of consumer units in that decile who are homeowners (BLS 'Homeowner' percent "
        "distribution row). housing_owner_imputed_rent_estimate = BLS's 'Estimated monthly rental value of owned "
        "home' addendum line, ANNUALIZED (x12) here for consistency with other annual figures -- this is BLS's own "
        "imputed rent estimate for owner-occupied housing, averaged across ALL consumer units in the decile "
        "(owners and renters combined), not just owners. "
        "Lower/upper income bounds per decile (not carried into this file) are in the source table's 'Lower limit' "
        "row if needed later."
    ),
}

with open("/home/user/workspace/income-tiles/data/v2/us_ces_2024_by_decile.json", "w") as f:
    json.dump(us_ces_decile, f, indent=2)

print("Wrote us_ces_2024_by_decile.json with", len(rows), "rows")
