import json

# ===== Dataset 1: by net household income class, LWR 2023 =====
# Source: https://www.destatis.de/EN/Themes/Society-Environment/Income-Consumption-Living-Conditions/Consumption-Expenditure/Tables/liste-net-household-income.html
income_brackets = [
    ("under_1000", "Under 1,000", 1121, {"food_at_home":205,"apparel":29,"housing":527,"furnishings":28,"healthcare_oop":22,"transport_total":83,"communications":78,"entertainment":56,"education":8,"food_away":50,"personal_insurance_finance":3,"other":34}),
    ("1000_1300", "1,000 to under 1,300", 1280, {"food_at_home":226,"apparel":38,"housing":588,"furnishings":39,"healthcare_oop":30,"transport_total":92,"communications":88,"entertainment":74,"education":8,"food_away":51,"personal_insurance_finance":3,"other":42}),
    ("1300_1500", "1,300 to under 1,500", 1459, {"food_at_home":245,"apparel":43,"housing":649,"furnishings":50,"healthcare_oop":32,"transport_total":109,"communications":99,"entertainment":96,"education":10,"food_away":68,"personal_insurance_finance":4,"other":55}),
    ("1500_2000", "1,500 to under 2,000", 1717, {"food_at_home":280,"apparel":56,"housing":736,"furnishings":58,"healthcare_oop":45,"transport_total":152,"communications":105,"entertainment":122,"education":9,"food_away":84,"personal_insurance_finance":4,"other":65}),
    ("2000_2600", "2,000 to under 2,600", 2090, {"food_at_home":327,"apparel":69,"housing":867,"furnishings":79,"healthcare_oop":55,"transport_total":211,"communications":115,"entertainment":161,"education":11,"food_away":112,"personal_insurance_finance":5,"other":79}),
    ("2600_3600", "2,600 to under 3,600", 2591, {"food_at_home":391,"apparel":87,"housing":1038,"furnishings":112,"healthcare_oop":76,"transport_total":274,"communications":129,"entertainment":211,"education":18,"food_away":153,"personal_insurance_finance":6,"other":96}),
    ("3600_5000", "3,600 to under 5,000", 3273, {"food_at_home":479,"apparel":116,"housing":1245,"furnishings":148,"healthcare_oop":102,"transport_total":382,"communications":152,"entertainment":279,"education":24,"food_away":218,"personal_insurance_finance":7,"other":121}),
    ("5000_plus", "5,000 and more", 4760, {"food_at_home":628,"apparel":191,"housing":1626,"furnishings":240,"healthcare_oop":175,"transport_total":650,"communications":192,"entertainment":449,"education":52,"food_away":377,"personal_insurance_finance":9,"other":171}),
]

rows = []
for code, label, total_exp, cats in income_brackets:
    rows.append({
        "group": code,
        "group_label_de": label,
        "avg_income_before_tax": None,
        "avg_income_after_tax": None,  # bracket midpoint could be used but not precise; left null
        "avg_expenditure_total": total_exp,
        "expenditure_by_category": cats,
        "housing_owner_share": None,
        "housing_owner_imputed_rent_estimate": None
    })

data1 = {
    "source": "Statistisches Bundesamt (Destatis), Laufende Wirtschaftsrechnungen (LWR) / Continuous Household Budget Survey 2023",
    "country": "DE",
    "year": 2023,
    "unit": "EUR",
    "price_basis": "nominal_2023",
    "data_tier": "B",
    "breakdown": "by_income_bracket",
    "categories": ["food_at_home","food_away","housing","furnishings","healthcare_oop","transport_total","communications","entertainment","education","apparel","personal_insurance_finance","other"],
    "rows": rows,
    "source_url": "https://www.destatis.de/EN/Themes/Society-Environment/Income-Consumption-Living-Conditions/Consumption-Expenditure/Tables/liste-net-household-income.html",
    "notes": (
        "TIER B (per v2-plan.md's own Tier classification, Germany is Tier B: modeling/interpolation permitted, but "
        "documented). REAL PRIMARY DATA (not modeled) for the base consumption-by-income-bracket figures: this is "
        "the Federal Statistical Office's (Destatis) official 2023 Laufende Wirtschaftsrechnungen (LWR, 'Continuous "
        "household budget survey') net-household-income table, fetched directly from the Destatis website "
        "(English-language mirror of the German original). It is Tier B rather than Tier A only because (a) the "
        "breakdown unit is INCOME BRACKETS (8 unequal-width euro ranges), not equal-size deciles like BLS CES or "
        "ONS LCF, and (b) some schema fields (avg_income_before_tax/after_tax, housing_owner_share, imputed rent) "
        "are not published in this table and had to be left null rather than measured -- no expenditure figures "
        "were fabricated or interpolated. "
        "CATEGORY MAPPING (Destatis German COICOP-based 12-category schema -> v2 schema): "
        "'Food, beverages and tobacco' -> food_at_home (Destatis does not split at-home vs away-from-home "
        "consumption within this row; away-from-home dining is captured separately under 'Restaurants and hotels' "
        "-> food_away, so 'food_at_home' here is actually 'food+beverages+tobacco consumed anywhere except "
        "restaurants', a coarser bucket than BLS's true at-home-only figure); 'Clothing and footwear' -> apparel; "
        "'Housing, energy, maintenance of the dwelling' -> housing (Destatis housing figure includes actual rent "
        "OR imputed rent for owner-occupiers already netted in via the standard EVS/LWR income-and-expenditure "
        "accounting convention, energy/utilities, and dwelling maintenance/repair -- this is broader than BLS's "
        "'shelter' line and closer to BLS's full 'housing' aggregate); 'Furnishings, equipment and household "
        "maintenance' -> furnishings (no v2 schema category exists for this; kept as its own key rather than "
        "folded into 'other' since it is a large, distinct 4-5% budget share); 'Health' -> healthcare_oop (this is "
        "OUT-OF-POCKET spending only -- statutory health insurance (GKV) premiums are payroll deductions not "
        "captured in LWR consumption expenditure at all, so this likely UNDERSTATES total healthcare burden "
        "relative to BLS's healthcare_oop which nets in US private insurance premiums; a private supplementary "
        "insurance premium, if paid out of net income, would appear here); 'Transport' -> transport_total (no "
        "work-only sub-split published, unlike BLS's transport_work vs transport_total); 'Information and "
        "communication' -> communications (2023 table) / 'Postal communication and telecommunication' -> "
        "communications (2022 household-type table -- slightly different category label across the two source "
        "years but same concept); 'Recreation, sport and culture' / 'Recreation and culture' -> entertainment; "
        "'Education' -> education; 'Restaurants and hotels' -> food_away (this Destatis category ALSO includes "
        "hotel/accommodation spending, which has no clean analog in the v2 schema and is left bundled in here -- "
        "an overstatement of pure 'food away from home' by an unknown but likely small amount); 'Insurance and "
        "financial services' -> personal_insurance_finance (a distinct, very small category in the 2023 table -- "
        "note this does NOT include mandatory statutory pension/health/unemployment payroll contributions, which "
        "are pre-income and never appear in LWR expenditure data at all, unlike BLS's 'personal insurance and "
        "pensions' category which nets in US Social Security/401k contributions from gross pay); 'Miscellaneous "
        "goods and services' -> other. There is NO 'voluntary_savings' category available in this survey; German "
        "LWR/EVS report expenditure, not net saving, and savings must be imputed as (income - expenditure) if "
        "income is available (it published only as a bracket midpoint here, hence left null). There is likewise "
        "NO 'childcare' category broken out separately from 'other' or 'education' in the income-bracket table "
        "(the household-type table, see companion notes, gives a partial proxy via family-type differences). "
        "'personal_care' has no distinct Destatis category and is not separately reported at all in LWR (unlike "
        "BLS's personal_care line) -- likely folded into 'Miscellaneous goods and services'. "
        "INCOME FIELD LIMITATION: Destatis LWR classifies households into NET INCOME BRACKETS (ranges) rather than "
        "reporting an exact mean/median income per bracket, so 'avg_income_before_tax'/'avg_income_after_tax' are "
        "left null here rather than approximated by bracket midpoint (which would be a modeling choice); the v2 "
        "frontend should use the bracket boundaries directly (embedded in the group_label_de field) if an income "
        "reference point is needed. "
        "CROSS-CHECK: aggregate 'Households, total' row (avg total consumption €3,032/month, 2023) is broadly "
        "consistent with Destatis's separately published 2022 all-household figure of €2,846/month reported in the "
        "companion Bundeszentrale für politische Bildung Sozialbericht 2024 summary "
        "(https://www.bpb.de/kurz-knapp/zahlen-und-fakten/sozialbericht-2024/553197/konsumausgaben/), showing a "
        "plausible ~6.5% nominal YoY increase consistent with German inflation in 2023. "
        "This file only reports the by-INCOME-BRACKET breakdown; a companion by-HOUSEHOLD-TYPE breakdown (2022 "
        "vintage, the latest available with that specific cross-tab as of this pull) is embedded below in the same "
        "'rows' array is NOT included in this file to keep schema breakdowns clean -- see notes in "
        "de_laender_costs.json / consider this a placeholder if a separate de_evs_by_hhtype.json is added later. "
        "Homeownership rate (national): Destatis's Zensus 2022 / Mikrozensus reports Germany's dwelling-level "
        "ownership rate (Eigentumsquote) at 44.3% for 2022, down slightly from 45.9% in 2011 "
        "(https://www.destatis.de/DE/Methoden/WISTA-Wirtschaft-und-Statistik/2026/02/eigentumsquoten-vergleich-022026.pdf); "
        "a household-level ownership rate (Eigentumsquote at household level, a very slightly different concept) "
        "was reported at 41.9% for 2022 in a companion table "
        "(https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Wohnen/Tabellen/tabelle-eigentumsquote.html) and is "
        "used as the DE national default in de_laender_costs.json; this is materially lower than the US's ~65% "
        "homeownership rate, so the 'housing_owner_share' field is intentionally left null in the by-income-bracket "
        "rows above (income-specific ownership rates were not found in machine-readable form within the step "
        "budget) rather than applying a single flat national rate across all income brackets, which would "
        "understate the well-documented income gradient in German homeownership (ownership rises sharply with "
        "income, see Destatis's EVS 2018 report noting owner-occupier households are concentrated in higher-income "
        "brackets)."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/de_evs.json', 'w') as f:
    json.dump(data1, f, indent=2)
print("Wrote de_evs.json")
