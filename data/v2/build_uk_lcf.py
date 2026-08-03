import json

def clean(v):
    """Parse ONS cell value into float or None, stripping suppression brackets."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s in ('', '..', ':', '-'):
        return None
    s = s.strip('[]')
    s = s.replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None

# ---------- BY DECILE (Table 3.1, disposable income deciles; income means from 3.1 & A6) ----------
decile_labels = ['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10']

disposable_income_mean = [178,339,445,556,677,813,964,1150,1446,2306]  # £/week, Table 3.1
gross_income_mean =        [189,354,477,611,760,937,1145,1376,1781,2997]  # £/week, Table A6 (NOTE: different decile cut than 3.1 -- see notes)

# Table 3.1 category rows (£/week), UK FYE2024, by DISPOSABLE income decile
food_at_home = [36.10,43.50,49.60,56.30,64.90,64.20,69.50,80.50,84.00,94.60]  # row 1.1 Food
food_away    = [9.80,10.50,20.30,18.40,25.30,30.10,31.20,43.60,51.20,71.70]  # row 11.1 Catering services
alcohol_tobacco_home = None  # not separately requested in schema; folded into 'other'
housing_net  = [80.00,85.10,104.80,111.40,118.70,123.40,117.00,112.80,135.40,144.70]  # row 4 Housing(net) fuel & power
housing_other = [21.70,22.50,34.20,40.50,44.60,58.60,70.10,75.30,100.80,133.70]  # row 13.1 mortgage interest/council tax etc (added to housing)
healthcare_oop = None  # row 6 Health suppressed by decile in Table 3.1 (only 'All households'=7.60) -> null by decile
transport_total = [34.00,29.30,49.40,57.20,76.00,87.00,106.50,112.60,133.40,197.30]  # row 7 Transport
transport_work = None  # LCF does not separately split "commute" transport; not published -> null
apparel = [7.00,7.20,13.50,11.80,15.90,18.50,18.20,21.90,25.20,35.40]  # row 3 Clothing & footwear
communications = [12.60,15.40,18.50,19.10,21.20,24.80,27.20,26.40,26.80,30.20]  # row 8
personal_care = [4.60,5.10,9.50,8.60,11.00,10.70,14.20,15.00,19.10,23.80]  # row 12.1
education = None  # row 10 Education suppressed by decile (only 'All'=5.10) -> null
childcare = None  # LCF has no distinct childcare category comparable to CES; not published separately -> null
voluntary_savings = [1.20,0.50,1.70,3.80,4.20,6.50,5.10,6.40,11.10,21.90]  # row 14.6 Savings and investments (best proxy)
entertainment = [31.10,31.00,38.70,53.30,62.60,69.20,73.30,92.30,99.10,177.80]  # row 9 Recreation & culture
household_goods_services = [18.80,21.40,29.30,28.10,48.10,30.90,49.00,43.70,47.60,70.30]  # row 5
misc_goods_services = [17.40,22.40,27.60,35.00,36.30,42.70,51.20,55.70,72.70,95.50]  # row 12 (minus personal_care already counted separately)
alcohol_tobacco = [7.50,7.40,8.60,9.80,11.90,12.50,10.60,12.70,14.30,15.50]  # row 2
other_expenditure_items_13 = [32.60,32.30,53.20,56.80,63.50,77.60,99.90,107.30,137.30,202.80]  # row 13 (contains 13.1 housing extra already pulled out below)
total_expenditure = [306.70,317.70,429.70,483.20,568.50,606.80,695.90,753.10,878.40,1195.20]  # 'Total expenditure' row

# housing_other (13.1) already double counts inside 'Other expenditure items' (13); to avoid double counting in "other"
# we compute other_misc = other_expenditure_items_13 - housing_other (13.1) - licences/holiday/money transfers already; simplest: keep other_expenditure_items_13 minus 13.1 as its own leftover, folded into "other"
other_leftover_13 = [round(other_expenditure_items_13[i] - housing_other[i], 2) for i in range(10)]

# household_goods_services (5), misc excluding personal_care (12 total minus 12.1 personal_care), alcohol_tobacco (2), leftover of 13 minus mortgage/counciltax -> bucket into "other"
misc_excl_personal_care = [round(misc_goods_services[i] - personal_care[i], 2) for i in range(10)]
other_bucket = [round(household_goods_services[i] + misc_excl_personal_care[i] + alcohol_tobacco[i] + other_leftover_13[i], 2) for i in range(10)]

owner_share_by_decile = {"d1": 0.4437, "d2": 0.5371, "d3": 0.5913, "d4": 0.6441, "d5": 0.6596,
                          "d6": 0.6843, "d7": 0.7226, "d8": 0.7815, "d9": 0.8262, "d10": 0.8266}

rows_decile = []
for i, d in enumerate(decile_labels):
    housing_combined = round(housing_net[i] + housing_other[i], 2)
    exp_by_cat = {
        "housing": housing_combined,
        "food_at_home": food_at_home[i],
        "food_away": food_away[i],
        "healthcare_oop": healthcare_oop,
        "transport_work": transport_work,
        "transport_total": transport_total[i],
        "apparel": apparel[i],
        "communications": communications[i],
        "personal_care": personal_care[i],
        "education": education,
        "childcare": childcare,
        "voluntary_savings": voluntary_savings[i],
        "entertainment": entertainment[i],
        "other": other_bucket[i]
    }
    rows_decile.append({
        "group": d,
        "avg_income_before_tax": round(gross_income_mean[i]*52.1786/12*12,2) if False else gross_income_mean[i]*52.1786,  # convert £/week -> £/year
        "avg_income_after_tax": disposable_income_mean[i]*52.1786,
        "avg_expenditure_total": round(total_expenditure[i]*52.1786,2),
        "expenditure_by_category": {k: (round(v*52.1786,2) if v is not None else None) for k,v in exp_by_cat.items()},
        "housing_owner_share": owner_share_by_decile[d],
        "housing_owner_imputed_rent_estimate": None
    })
    # fix avg_income_before_tax rounding
    rows_decile[-1]["avg_income_before_tax"] = round(gross_income_mean[i]*52.1786, 2)
    rows_decile[-1]["avg_income_after_tax"] = round(disposable_income_mean[i]*52.1786, 2)

categories_schema = ["housing","food_at_home","food_away","healthcare_oop","transport_work","transport_total",
                     "apparel","communications","personal_care","education","childcare","voluntary_savings",
                     "entertainment","other"]

data_decile = {
    "source": "ONS Living Costs and Food Survey (LCF) via Family Spending workbook 1: detailed expenditure and trends, FYE 2024",
    "country": "UK",
    "year": 2024,
    "unit": "GBP",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_decile",
    "categories": categories_schema,
    "rows": rows_decile,
    "source_url": "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook1detailedexpenditureandtrends/fye2024/workbook1detailedexpenditureandtrends.xlsx ; https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/adhocs/1283meanweeklyhouseholdexpenditurebydisposableincomedecileandtenuretypeukfinancialyearending2022/formattedexpenditurebytenureandincomedecile.xlsx",
    "notes": (
        "TIER A (UK): REAL primary-source data from ONS's Living Costs and Food Survey (LCF), published in the "
        "'Family Spending' report series, UK financial year ending (FYE) 2024 (April 2023-March 2024), n=4,210 "
        "sampled households, weighted to 28.48 million UK households. All £ figures converted from the source's "
        "native 'average weekly household expenditure/income' units to ANNUAL figures via x52.1786 "
        "(365.25/7 weeks/year) for consistency with the annual-figure convention used elsewhere in this v2 dataset "
        "(e.g. BLS CES); values remain in nominal GBP (local currency) per the task instruction that non-USD "
        "currency data stay in local currency for the frontend to convert via PPP at display time. "
        "DECILE BASIS CAVEAT: this file's 'rows' groups are DISPOSABLE-income deciles (Table 3.1), which is the "
        "closest LCF equivalent to BLS CES's after-tax income concept, but the boundaries differ from the "
        "GROSS-income deciles used for 'avg_income_before_tax' (Table A6, mean gross income by GROSS-income "
        "decile group) -- ONS explicitly disaggregates by gross-income decile and disposable-income decile "
        "SEPARATELY and does not publish a single table with both income concepts cut by the same decile "
        "boundary. avg_income_before_tax values are therefore the gross-income-decile mean paired positionally "
        "(1st with 1st, 2nd with 2nd, etc.) with the disposable-income-decile's expenditure figures -- a "
        "reasonable but imperfect proxy since decile membership can differ slightly between the two income "
        "concepts; flagged here rather than fabricating a joint distribution. "
        "CATEGORY MAPPING (source COICOP-based headings -> v2 schema): "
        "housing = ONS row '4 Housing (net), fuel & power' [excludes mortgage interest/capital repayments/council "
        "tax by ONS convention] PLUS row '13.1 Housing: mortgage interest payments, council tax etc.' (combined "
        "to give a housing measure closer to CES's all-in housing bucket, though CES imputes owners' rent while "
        "LCF's 'net' housing concept generally does NOT include imputed rental value for owner-occupiers -- see "
        "housing_owner_imputed_rent_estimate=null caveat below). "
        "food_at_home = row 1.1 'Food' (excludes row 1.2 non-alcoholic drinks, which per COICOP is technically "
        "food-adjacent but reported separately by ONS; not re-added to avoid ambiguity, folded into 'other'). "
        "food_away = row 11.1 'Catering services' (restaurant/cafe meals, alcohol away from home, takeaway, "
        "canteens) -- ONS bundles some alcohol-away-from-home into this row, a minor definitional mismatch vs a "
        "pure food-away measure. "
        "healthcare_oop = row 6 'Health' -- SUPPRESSED (shown as '..') at the decile level in the published table "
        "for statistical disclosure/small-sample reasons; only the 'All households' aggregate (£7.60/week) is "
        "published. Set to null for all deciles per the 'do not fabricate' rule rather than estimating a "
        "distribution. "
        "transport_total = row 7 'Transport' (vehicle purchase + operation + transport services, i.e. total "
        "transport spend). transport_work = null: LCF does not publish a work-commute-specific transport split "
        "comparable to BLS CES's 'transportation to/from work' subcategory. "
        "apparel = row 3 'Clothing & footwear'. communications = row 8 'Communication'. "
        "personal_care = row 12.1 'Personal care' (hairdressing, toiletries, cosmetics). "
        "education = row 10 'Education' -- SUPPRESSED at decile level (only 'All households'=£5.10/week "
        "published); set to null for all deciles, same reasoning as healthcare. "
        "childcare = null: LCF/Family Spending has no distinct 'childcare services' COICOP-mapped row comparable "
        "to CES; nursery/childminder costs are believed to be embedded within 'Miscellaneous goods & services' or "
        "'Other services' without being separately broken out in the published tables. "
        "voluntary_savings = row 14.6 'Savings and investments' -- note this ONS row is explicitly listed under "
        "'Other items recorded' (row 14), which sits OUTSIDE ONS's 'Total expenditure' aggregate (rows 1-13); we "
        "still report it here as the schema's best-available proxy for discretionary saving, but it is NOT part "
        "of avg_expenditure_total in this file (avg_expenditure_total = ONS's own 'Total expenditure' row, "
        "rows 1-13 only, which itself already includes row 13's mortgage-interest/council-tax and money-transfer "
        "items but EXCLUDES pension contributions, income tax, National Insurance, and savings -- all reported "
        "under row 14 'Other items recorded'). "
        "entertainment = row 9 'Recreation & culture'. "
        "other = sum of row 5 'Household goods & services' + row 12 'Miscellaneous goods & services' (less its "
        "12.1 personal_care sub-row, already counted separately) + row 2 'Alcoholic drink, tobacco & narcotics' + "
        "the residual of row 13 'Other expenditure items' after removing 13.1 (mortgage/council tax, already "
        "folded into housing) -- i.e. licences/fines/transfers (13.2), holiday spending (13.3), and money "
        "transfers/credit (13.4). This is a residual bucket to absorb categories with no direct v2 schema slot. "
        "OTHER CAVEATS: (1) housing_owner_imputed_rent_estimate is null for all deciles -- LCF/Family Spending's "
        "'Housing (net)' concept, unlike BLS CES, is a NET cash-outlay measure for owner-occupiers (structural "
        "insurance, minor repairs, water charges, etc.) and does NOT impute a rental-equivalent value for "
        "mortgage-free/mortgaged owners the way CES's 'owned dwellings' imputation does; no comparable ONS "
        "imputed-rent series by decile was located within the task's step budget. (2) 'avg_expenditure_total' is "
        "ONS's own published 'Total expenditure' row (sum of expenditure groups 1-13), not a sum of this file's "
        "'expenditure_by_category' object (which nets out to a slightly different total due to the null "
        "suppressions for health/education and the voluntary_savings figure being sourced from outside the "
        "official Total-expenditure aggregate) -- consumers of this file should treat avg_expenditure_total as "
        "authoritative and the per-category breakdown as best-effort/partially incomplete due to ONS disclosure "
        "suppression. (3) housing_owner_share by decile is sourced from a SEPARATE ONS ad-hoc table (FYE 2022 "
        "vintage, two years older than the FYE2024 expenditure figures) that cross-tabulates disposable-income "
        "decile against four tenure types (owned outright, buying with mortgage, social rented, private rented); "
        "owner_share = (owned-outright + buying-with-mortgage households) / (all tenure types), a straightforward "
        "share computed from the ad-hoc table's weighted household counts, not modeled or interpolated by us. "
        "Values rise monotonically from 44.4% (decile 1) to 82.7% (decile 10), consistent with the well-known "
        "UK income-tenure gradient. (4) All 2024 GBP figures are nominal (not adjusted for UK inflation to a "
        "different base year); the frontend should apply its own inflation adjustment if comparing against other "
        "years' figures. (5) Source numbering in comments (e.g. 'row 1.1') refers to ONS's own COICOP-derived "
        "sequential numbering scheme, which the source explicitly notes 'does not use actual COICOP codes' and "
        "'is not comparable to publications before 2001-02'."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/uk_lcf_by_decile_TEMP.json','w') as f:
    json.dump(data_decile, f, indent=2)

print("Decile file rows sample:")
print(json.dumps(rows_decile[0], indent=2))
print(json.dumps(rows_decile[-1], indent=2))
