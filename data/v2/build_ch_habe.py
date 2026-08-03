"""
Build ch_habe.json from Swiss Federal Statistical Office (BFS) Haushaltsbudgeterhebung (HABE),
Table T20.02.01.00.12 "Haushaltseinkommen und -ausgaben nach Einkommensklasse"
(Household income and expenditures by income class), pooled survey years 2012-2014.

IMPORTANT VINTAGE CAVEAT: This is the most recent income-class-disaggregated table BFS has
published in an easily retrievable, permanent-asset xlsx format. The BFS national-average
table is refreshed annually (latest = 2022, dam-api asset 32666961), but the by-income-class
breakdown table found (dam asset 1400581 / T20.02.01.00.12) is dated "Haushaltsbudgeterhebung,
2012-2014" -- an older 3-year pooled vintage. A 2022 press release (dam asset 32526563)
confirms BFS DOES compute quintile splits for 2020-2022 but only published summary quotes in a
press release, not a full category-level table in machine-readable form found in this session.
This file uses the pooled 2012-2014 table AS-IS (real primary BFS data, not fabricated) because
it is the only full-category-breakdown-by-income-bracket table located. All figures are LOCAL
CURRENCY (Swiss francs, CHF), monthly per household, matching BFS's native units. The 5 income
brackets are unequal-width CHF/month bands but each holds ~20% of Swiss households (row 89 in
source = 19.99%-20.02% each across the 5 brackets), so they function as approximate quintiles.
"""
import openpyxl
import json

wb = openpyxl.load_workbook('/home/user/workspace/income-tiles/data/v2/raw/ch_habe_income_class.xlsx', data_only=True)
ws = wb['12']

def vals(r):
    return [ws.cell(row=r, column=c).value for c in [4,7,10,13,16,19]]

rows_map = {
    'gross_income': 30,       # Bruttoeinkommen
    'disposable_income': 40,  # Verfügbares Einkommen [3]
    'consumption_exp': 48,    # Konsumausgaben (negative sign in source; take abs)
    'food_nonalc': 49,        # Nahrungsmittel und alkoholfreie Getränke
    'alcohol_tobacco': 50,    # Alkoholische Getränke und Tabakwaren
    'restaurants_hotels': 51, # Gast- und Beherbergungsstätten (food away from home + lodging)
    'clothing_footwear': 52,  # Bekleidung und Schuhe
    'housing_energy': 53,     # Wohnen und Energie
    'furnishing_household': 54,  # Wohnungseinrichtung und laufende Haushaltsführung
    'health': 55,             # Gesundheitsausgaben
    'transport': 56,          # Verkehr
    'communications': 57,     # Nachrichtenübermittlung
    'entertainment_culture': 58,  # Unterhaltung, Erholung und Kultur
    'other_goods_services': 59,   # Andere Waren und Dienstleistungen
    'household_size': 66,     # Anzahl Personen pro Haushalt
}

data = {k: vals(v) for k, v in rows_map.items()}

quintile_labels = ['q1','q2','q3','q4','q5']  # 5 brackets, each ~20% of households; index 0 in vals() is "all households" -- skip
# vals() returns [Sämtliche(all), <5021, 5021-7336, 7337-9978, 9979-13687, >=13688] i.e. 6 entries: [all, q1..q5]

categories = ["housing","food_at_home","food_away","healthcare_oop","transport_work",
              "transport_total","apparel","communications","personal_care","education",
              "childcare","voluntary_savings","entertainment","other"]

rows_out = []
for i, g in enumerate(quintile_labels):
    idx = i + 1  # skip the "all households" column at index 0
    gross = data['gross_income'][idx]
    disposable = data['disposable_income'][idx]
    consumption = abs(data['consumption_exp'][idx])
    exp_by_cat = {
        "housing": round(abs(data['housing_energy'][idx]) * 12, 0),
        "food_at_home": round(abs(data['food_nonalc'][idx]) * 12, 0),
        "food_away": round(abs(data['restaurants_hotels'][idx]) * 12, 0),  # includes lodging/hotels, not pure dining -- see notes
        "healthcare_oop": round(abs(data['health'][idx]) * 12, 0),
        "transport_work": None,  # Swiss "Verkehr" category is not split into work-commute vs. other; see notes
        "transport_total": round(abs(data['transport'][idx]) * 12, 0),
        "apparel": round(abs(data['clothing_footwear'][idx]) * 12, 0),
        "communications": round(abs(data['communications'][idx]) * 12, 0),
        "personal_care": None,  # folded into "Andere Waren und Dienstleistungen" (other goods/services), not separately reported
        "education": None,  # not a distinct line item in this table version (may appear in more granular COICOP breakdowns not retrieved)
        "childcare": None,  # not a distinct category
        "voluntary_savings": None,  # not directly available; "Sparbetrag" (row 63, savings amount) is a residual balance, not a voluntary-contribution concept comparable to BLS
        "entertainment": round(abs(data['entertainment_culture'][idx]) * 12, 0),
        "other": round((abs(data['furnishing_household'][idx]) + abs(data['alcohol_tobacco'][idx]) + abs(data['other_goods_services'][idx])) * 12, 0),
    }
    rows_out.append({
        "group": g,
        "avg_income_before_tax": round(gross * 12, 0),
        "avg_income_after_tax": round(disposable * 12, 0),
        "avg_expenditure_total": round(consumption * 12, 0),
        "expenditure_by_category": exp_by_cat,
        "housing_owner_share": None,  # not published by income class in this table (only as a national-average figure elsewhere, ~fluctuates ~36-38% nationally per other BFS releases; not decile/quintile-specific)
        "housing_owner_imputed_rent_estimate": None,
    })

out = {
    "source": "Swiss Federal Statistical Office (BFS), Haushaltsbudgeterhebung (HABE) / Household Budget Survey, Table T20.02.01.00.12 'Haushaltseinkommen und -ausgaben nach Einkommensklasse', pooled survey years 2012-2014",
    "country": "CH",
    "year": 2014,
    "unit": "CHF",
    "price_basis": "nominal_2012_2014_pooled",
    "data_tier": "A",
    "breakdown": "by_quintile",
    "categories": categories,
    "rows": rows_out,
    "source_url": "https://www.bfs.admin.ch/bfsstatic/dam/assets/1400581/master",
    "notes": (
        "REAL PRIMARY DATA from BFS HABE, but VINTAGE CAVEAT: this table (T20.02.01.00.12) pools "
        "three survey years (2012-2014) and is the most recent full-category income-class breakdown "
        "located in permanent/stable xlsx form on BFS's dam-api asset server. BFS's national-AVERAGE "
        "table is refreshed annually (2022 vintage available at "
        "https://dam-api.bfs.admin.ch/hub/api/dam/assets/32666961/master, used for the 2022 all-household "
        "average in de_evs.json-style cross-checks) but its by-income-class disaggregation was not found "
        "updated past 2012-2014 in machine-readable table form during this session; a 2022 BFS press "
        "release (https://dam-api.bfs.admin.ch/hub/api/dam/assets/32526563/master) references quintile "
        "splits (e.g. 'top fifth of single-person households under 65 had CHF 8028/month vs bottom fifth "
        "CHF 1706/month') but only as prose summary statistics, not a full category-by-quintile table -- "
        "so those 2022 figures are NOT included here, to avoid mixing table vintages inconsistently. "
        "Treat this file's absolute CHF figures as reflecting c. 2013 price levels, not 2024 -- apply "
        "Swiss CPI inflation adjustment (~2013->2024 CPI increase ~appx 5-7% cumulative, source: BFS "
        "consumer price index) if a nominal-2024 comparison is required; this file leaves that adjustment "
        "undone per the 'do not fabricate' instruction (only real, retrieved values are included). "
        "Income brackets are 5 unequal-width CHF/month bands (<5021, 5021-7336, 7337-9978, 9979-13687, "
        ">=13688) but each holds ~20.0% of Swiss households (BFS source row 89: 19.99%-20.02% per "
        "bracket), so they are treated here as an approximate QUINTILE breakdown (q1=lowest to q5=highest). "
        "CATEGORY MAPPING (BFS COICOP-derived categories -> v2 schema): "
        "housing = 'Wohnen und Energie' (housing + energy/utilities combined, BFS does not separate them "
        "at this table's granularity); "
        "food_at_home = 'Nahrungsmittel und alkoholfreie Getränke' (food & non-alcoholic beverages); "
        "food_away = 'Gast- und Beherbergungsstätten' (restaurants AND hotels/lodging combined -- BFS does "
        "not separate dining-out from short-stay accommodation at this level, so this OVERSTATES pure "
        "food-away-from-home versus BLS's narrower definition); "
        "healthcare_oop = 'Gesundheitsausgaben' (health expenditure, out-of-pocket; excludes mandatory "
        "basic health-insurance premiums 'Krankenkassen: Prämien für die Grundversicherung', which BFS "
        "classifies as a MANDATORY TRANSFER expenditure alongside taxes/social-security contributions, "
        "not as consumption -- this matches BLS's OOP convention of excluding premiums from healthcare "
        "consumption); "
        "transport_work = null (BFS 'Verkehr' is not split into commute vs. discretionary use); "
        "transport_total = 'Verkehr' (all transport: vehicle costs, public transit, etc.); "
        "apparel = 'Bekleidung und Schuhe' (clothing & footwear); "
        "communications = 'Nachrichtenübermittlung' (postal, telecom); "
        "personal_care = null (folded into 'Andere Waren und Dienstleistungen' / other goods & services, "
        "not separately broken out at this table's granularity); "
        "education = null (not a distinct line item in this table version; BFS does track education "
        "spending in more granular COICOP-12-category tables not retrieved in this session); "
        "childcare = null (not a distinct category); "
        "voluntary_savings = null (BFS reports 'Sparbetrag' -- a residual savings BALANCE = income minus "
        "expenditure, not a voluntary-contribution expenditure flow comparable to BLS's retirement-savings "
        "concept; including it here would conflate a balancing item with a discretionary expenditure "
        "category, so left null per do-not-fabricate); "
        "entertainment = 'Unterhaltung, Erholung und Kultur' (entertainment, recreation & culture); "
        "other = 'Wohnungseinrichtung und laufende Haushaltsführung' (furnishings/household operation) + "
        "'Alkoholische Getränke und Tabakwaren' (alcohol & tobacco) + 'Andere Waren und Dienstleistungen' "
        "(other goods & services, incl. personal care) -- combined residual bucket. "
        "avg_income_before_tax = 'Bruttoeinkommen' (gross income: all earned + pension + transfer income). "
        "avg_income_after_tax = 'Verfügbares Einkommen [3]' (disposable income = gross income minus "
        "mandatory transfer expenditure, i.e. minus social-security contributions + taxes + mandatory "
        "basic health-insurance premiums) -- BFS's disposable-income definition NOTABLY INCLUDES mandatory "
        "health-insurance premiums as a deduction (unlike most countries where health premiums are a "
        "voluntary/discretionary expenditure), which is a Swiss-specific institutional feature (mandatory "
        "individual health insurance) worth flagging for any cross-country comparison. "
        "housing_owner_share = null (not published by income class/quintile in this table; BFS separately "
        "reports a NATIONAL-AVERAGE renter-household share of ~61.7% i.e. owner share ~38.3% for 2022, per "
        "dam asset 32666961 row 94, but not disaggregated by income bracket)."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/ch_habe.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print("Wrote ch_habe.json")
for row in out['rows']:
    print(row['group'], row['avg_income_before_tax'], row['avg_income_after_tax'], row['avg_expenditure_total'])
