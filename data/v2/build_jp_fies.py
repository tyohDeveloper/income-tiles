"""
Build jp_fies.json from Japan Statistics Bureau FIES 2024 (総世帯・勤労者世帯)
Source file: stat.go.jp/english/data/sousetai/2024n/zuhyou/s03.xls
Sheet 1 (index 1) = Workers' Households (勤労者世帯) — has full income statement
(gross income, taxes, social insurance, disposable income) + full consumption
expenditure breakdown by yearly income quintile AND decile.

NOTE: Sheet 0 (Total Households / 総世帯) lacks disposable income/tax breakdown,
so workers' households (labor force households) is used as the primary decile
table, consistent with BLS CES's "all consumer units" approach reasonably
approximated by JP's largest households category with full income data.
"""
import xlrd
import json

wb = xlrd.open_workbook('/home/user/workspace/income-tiles/data/v2/raw/jp_s03_2024.xls')
ws = wb.sheet_by_index(1)  # Workers' households

def dec(r):
    """Return decile I-X values (columns 22-31), monthly yen."""
    return [ws.cell_value(r, c) for c in range(22, 32)]

decile_labels = ['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10']

# Row map (0-indexed rows in the xls sheet)
rows = {
    'gross_income_monthly': 23,       # 実収入 (Actual income, i.e. gross earned + other income)
    'total_receipts_monthly': 22,     # 受取 (all receipts incl. borrowing/withdrawals - not income)
    'consumption_expenditure': 62,    # 消費支出
    'food_total': 63,                 # 食料
    'eating_out': 101,                # 外食 (food away from home)
    'housing': 105,                   # 住居 (rent + home maintenance, EXCLUDES utilities)
    'utilities': 110,                 # 光熱・水道 (fuel, light, water)
    'furniture_household': 115,       # 家具・家事用品
    'clothing': 125,                  # 被服及び履物
    'health_total': 134,              # 保健医療 (medical products/services, OOP)
    'transport_comm_total': 139,      # 交通・通信 (transport + communications combined)
    'transport_only': 140,            # 交通 (transport subcategory, excl. car-related & comm.)
    'car_related': 141,               # 自動車等関係費 (vehicle-related costs)
    'communications': 145,            # 通信
    'education': 146,                 # 教育
    'culture_recreation': 147,        # 教養娯楽 (culture & recreation / entertainment)
    'other_consumption': 156,         # その他の消費支出 (miscellaneous/other consumption)
    'non_consumption_expenditure': 183,  # 非消費支出 (direct tax + social insurance)
    'direct_tax': 184,                # 直接税 (income tax + resident tax)
    'social_insurance': 188,          # 社会保険料 (social insurance premiums)
    'disposable_income': 206,         # 可処分所得 (disposable income)
    'annual_income_manyen': 226,      # 年間収入 (annual income, in man-yen = 10,000 JPY units)
    'home_ownership_pct': 20,          # 持家率
}

data = {r: dec(v) for r, v in rows.items()}

# Food at home = food_total - eating_out
food_at_home = [round(data['food_total'][i] - data['eating_out'][i], 1) for i in range(10)]

# transport_work proxy: car-related costs (commuting/vehicle ownership) as best available proxy
# transport_total = transport_comm_total - communications (i.e., transport alone, incl. car + other)
transport_total = [round(data['transport_comm_total'][i] - data['communications'][i], 1) for i in range(10)]

categories = ["housing","food_at_home","food_away","healthcare_oop","transport_work",
              "transport_total","apparel","communications","personal_care","education",
              "childcare","voluntary_savings","entertainment","other"]

rows_out = []
for i, g in enumerate(decile_labels):
    monthly_gross = data['gross_income_monthly'][i]
    monthly_disposable = data['disposable_income'][i]
    monthly_annual_income_manyen = data['annual_income_manyen'][i]
    exp_by_cat = {
        "housing": round((data['housing'][i] + data['utilities'][i]) * 12, 0),  # combine housing+utilities (JP splits utilities separately; BLS bundles under "housing")
        "food_at_home": round(food_at_home[i] * 12, 0),
        "food_away": round(data['eating_out'][i] * 12, 0),
        "healthcare_oop": round(data['health_total'][i] * 12, 0),
        "transport_work": round(data['car_related'][i] * 12, 0),   # best-available proxy: vehicle-related costs (commuting is car-dominant in most of Japan outside major metros)
        "transport_total": round(transport_total[i] * 12, 0),
        "apparel": round(data['clothing'][i] * 12, 0),
        "communications": round(data['communications'][i] * 12, 0),
        "personal_care": None,  # JP does not break "personal care" out separately at this table's granularity (folded into その他の消費支出/other); see notes
        "education": round(data['education'][i] * 12, 0),
        "childcare": None,  # not a distinct category in this table
        "voluntary_savings": None,  # not captured in FIES; savings behavior published separately (預貯金 net flow), not comparable to BLS voluntary retirement contributions
        "entertainment": round(data['culture_recreation'][i] * 12, 0),
        "other": round(data['other_consumption'][i] * 12, 0),
    }
    rows_out.append({
        "group": g,
        "avg_income_before_tax": round(monthly_gross * 12, 0),   # annualize monthly JPY
        "avg_income_after_tax": round(monthly_disposable * 12, 0),
        "avg_expenditure_total": round(data['consumption_expenditure'][i] * 12, 0),
        "expenditure_by_category": exp_by_cat,
        "housing_owner_share": round(data['home_ownership_pct'][i] / 100.0, 3) if data['home_ownership_pct'][i] != '' else None,
        "housing_owner_imputed_rent_estimate": None,
    })

out = {
    "source": "Statistics Bureau of Japan, Family Income and Expenditure Survey (FIES) 2024, Workers' Households (勤労者世帯), Table 3 (Average of Monthly Receipts and Disbursements per Household by Yearly Income Decile Group)",
    "country": "JP",
    "year": 2024,
    "unit": "JPY",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_decile",
    "categories": categories,
    "rows": rows_out,
    "source_url": "https://www.stat.go.jp/english/data/sousetai/2024n/zuhyou/s03.xls",
    "notes": (
        "REAL PRIMARY DATA from Japan Statistics Bureau FIES 2024 annual report (released Aug 2025), "
        "sheet 2 of s03.xls ('勤労' = Workers' Households), which is the FIES subsample with full income-statement "
        "detail (gross income, direct tax, social insurance, disposable income) broken out by yearly income decile "
        "(年間収入十分位階級, columns 十I-十X). The 'Total Households' sheet (総世帯, sheet 1) was NOT used as the "
        "primary source because it lacks the tax/social-insurance/disposable-income breakdown needed for this schema "
        "-- it only reports gross annual income and consumption expenditure. Workers' households is a reasonable "
        "proxy for 'all consumer units' per convention in Japanese household-economics literature, though it skews "
        "toward employed (non-retired, non-self-employed-outlier) households; it excludes single-person and retiree-only "
        "households that are captured elsewhere in FIES's broader panel. Values are MONTHLY yen in the source table; "
        "this file annualizes them by x12 for avg_income_before_tax/after_tax/avg_expenditure_total, but "
        "expenditure_by_category values are ALSO annualized (x12) from the source's monthly figures for internal "
        "consistency with avg_expenditure_total. "
        "CATEGORY MAPPING (Japanese FIES codes -> v2 schema): "
        "housing = row '住居' (rent/home-repair-maintenance, EXCLUDES utilities) + row '光熱・水道' (fuel/light/water utilities), "
        "combined to match BLS CES's broader 'housing' bucket which also includes utilities; "
        "food_at_home = '食料' (Food total) minus '外食' (eating out); "
        "food_away = '外食' (eating out / dining out); "
        "healthcare_oop = '保健医療' (medical products + medical services, out-of-pocket; excludes health-insurance premiums, "
        "which are captured separately under 社会保険料/social insurance -- NOT included here, matching BLS OOP convention); "
        "transport_work = '自動車等関係費' (vehicle-related costs: purchase, maintenance, fuel) used as best-available proxy "
        "for work-commute transport since JP FIES does not separately tag commuting vs. discretionary vehicle use; "
        "transport_total = '交通・通信' (transport+communications combined) minus '通信' (communications) = transport alone "
        "(includes public transit fares, vehicle costs, etc.); "
        "apparel = '被服及び履物' (clothing & footwear); "
        "communications = '通信' (postal, telecom, internet); "
        "personal_care = null -- JP FIES does not break out personal care/grooming as a top-level category at this "
        "table's granularity (folded into 'その他の消費支出'/other-consumption's 諸雑費 subcategory, which includes "
        "personal-care services/products alongside pocket money, gifts, etc. -- cannot be cleanly separated without "
        "the more granular item-level table, which was not fetched in this pass); "
        "education = '教育' (school fees, tutoring, textbooks); "
        "childcare = null -- not a distinct FIES category (childcare costs are split across education/other depending "
        "on service type; no dedicated line item); "
        "voluntary_savings = null -- FIES tracks net financial-asset flows (預貯金 net change) as a receipts/disbursements "
        "concept, not a 'voluntary retirement savings' expenditure category comparable to BLS's iRA/401k contributions "
        "concept; leaving null per do-not-fabricate rule; "
        "entertainment = '教養娯楽' (culture & recreation, incl. media, hobbies, travel, admission fees); "
        "other = 'その他の消費支出' (other consumption expenditure: miscellaneous goods/services, personal-care, pocket "
        "money, social/gift expenses, remittances -- a residual bucket similar to BLS's 'other' but broader in scope "
        "since it absorbs personal_care and part of childcare-adjacent gifting). "
        "avg_income_before_tax = '実収入' (actual income: all recurring earned + transfer income, excludes borrowing/asset "
        "drawdowns which JP separately reports under '実収入以外の受取'). avg_income_after_tax = '可処分所得' (disposable "
        "income = actual income minus non-consumption expenditure, i.e. minus direct tax + social insurance premiums), "
        "which is Japan's official disposable-income definition and directly analogous to BLS 'income after taxes'. "
        "housing_owner_share = '持家率' (home-ownership rate, %) reported per decile in the source table -- REAL data, "
        "not imputed. housing_owner_imputed_rent_estimate = null (FIES headline tables do not publish imputed rent; "
        "Japan's SNA imputed-rent estimates exist at the aggregate/national level only, not disaggregated by income decile). "
        "CAVEAT: 'Workers' households' (勤労者世帯, ~55-60% of all Japanese households) excludes retiree households and "
        "self-employed/agricultural households, which have materially different income/expenditure profiles (esp. lower "
        "or zero direct employment income). This is a scope limitation inherited from the source table structure, not "
        "a modeling choice -- Japan's 'Total Households' decile table (sheet 1 of the same file) does NOT publish the "
        "tax/disposable-income breakdown needed for this schema, forcing the workers'-households subsample as the only "
        "viable Tier-A (real, primary-source, by-decile) option with complete required fields."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/jp_fies.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print("Wrote jp_fies.json")
print(json.dumps(out['rows'][0], indent=2, ensure_ascii=False))
print(json.dumps(out['rows'][-1], indent=2, ensure_ascii=False))
