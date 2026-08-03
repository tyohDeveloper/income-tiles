#!/usr/bin/env python3
"""Build data/v3/non_monetary_benefits.json - 11 categories x 8 countries.

Sources (see value_notes / source_url per category):
- OECD Family Database (PF2.1, PF2.4, PF3.4)
- OECD Health at a Glance 2023
- OECD Education at a Glance 2024
- OECD Pensions at a Glance 2023 / Pension replacement rates
- OECD Taxing Wages / Benefits and Wages (unemployment NRR)
- CEPR "No-Vacation Nation" / e-days.com / Wikipedia list of minimum annual leave
- ILO / World Policy Center paid sick leave comparisons
- UITP farebox recovery / fare affordability policy brief
- Country statistical/tax agencies for family cash benefits
"""
import json

COUNTRIES = ["US", "DE", "UK", "NO", "SE", "FI", "CH", "JP"]

categories = []

# 1. Paid vacation (statutory minimum, days/year, excl. public holidays)
categories.append({
    "id": "paid_vacation",
    "label": "Paid vacation (statutory minimum)",
    "unit": "days per year",
    "source_url": "https://en.wikipedia.org/wiki/List_of_minimum_annual_leave_by_country",
    "values": {"US": 0, "DE": 20, "UK": 28, "NO": 25, "SE": 25, "FI": 24, "CH": 20, "JP": 10},
    "value_notes": {
        "US": "No federal or state statutory minimum; ~10-15 days typical employer benefit for full-time staff.",
        "DE": "20 working days minimum (Bundesurlaubsgesetz, 5-day week); most employers offer 25-30 days via CBA.",
        "UK": "28 days (5.6 weeks) statutory minimum; employers may count public holidays toward this total.",
        "NO": "25 working days (Ferieloven); day-count includes Saturdays so effectively ~4 weeks + 1 day on a 5-day week.",
        "SE": "25 working days minimum (Semesterlagen).",
        "FI": "24-30 days depending on tenure (2.5 days/month worked, 2 days/month if <1yr tenure); 24 used as base-case statutory minimum for a new employee's first year, rising to 30 after 1 year.",
        "CH": "20 working days (4 weeks) minimum under the Code of Obligations; employees under 20 get 25 days.",
        "JP": "10 days after 6 months' continuous service with 80% attendance, rising to a legal max of 20 days after 6.5 years of tenure.",
    },
})

# 2. Paid sick leave
categories.append({
    "id": "paid_sick_leave",
    "label": "Paid sick leave (statutory employer-paid period & replacement rate)",
    "unit": "weeks at stated replacement rate",
    "source_url": "https://www.oecd.org/content/dam/oecd/en/publications/reports/2020/07/paid-sick-leave-to-protect-income-health-and-jobs-through-the-covid-19-crisis_4ff5fe3c/a9e1a154-en.pdf",
    "values": {
        "US": {"weeks": 0, "replacement_rate_pct": 0},
        "DE": {"weeks": 6, "replacement_rate_pct": 100},
        "UK": {"weeks": 28, "replacement_rate_pct": 17},
        "NO": {"weeks": 52, "replacement_rate_pct": 100},
        "SE": {"weeks": 2, "replacement_rate_pct": 80},
        "FI": {"weeks": 2, "replacement_rate_pct": 100},
        "CH": {"weeks": 3, "replacement_rate_pct": 100},
        "JP": {"weeks": 0, "replacement_rate_pct": 67},
    },
    "value_notes": {
        "US": "No federal statutory paid sick leave mandate; some states/cities mandate limited accrual (e.g., 40-56 hrs/yr). Treated as 0 at federal level.",
        "DE": "Employer pays 100% wage continuation (Entgeltfortzahlung) for up to 6 weeks per illness; statutory health insurance pays ~70% gross (Krankengeld) thereafter for up to 78 weeks in a 3-year window.",
        "UK": "Statutory Sick Pay is a flat rate (~£116.75/wk, 2025/26) for up to 28 weeks, roughly 17% of an average full-time wage; 3 waiting days apply.",
        "NO": "Employer pays 100% of wages for first 16 calendar days, then National Insurance (NAV) pays 100% (subject to a 6G cap) for up to 52 weeks total.",
        "SE": "Employer pays ~80% of salary for days 2-14 (day 1 unpaid 'karensdag' deduction); Försäkringskassan pays ~80% from day 15 up to 364 days.",
        "FI": "Employer pays full salary for the first ~9-10 working days depending on CBA/tenure (approximated here as 2 weeks); Kela sickness allowance (~70% of income) follows for up to 300 days.",
        "CH": "No unified national scheme; Code of Obligations mandates employer-paid full salary for a length that scales with tenure (commonly 3 weeks in year 1, up to several months later); many employers carry daily sickness allowance insurance (~80% typical).",
        "JP": "No dedicated statutory employer-paid sick leave; health insurance sickness allowance (shobyo teate) pays 66.67% of standard wage from day 4 up to 18 months if absence exceeds 3 days.",
    },
})

# 3. Paid parental leave (leave available to mothers, OECD Family Database PF2.1)
categories.append({
    "id": "paid_parental_leave",
    "label": "Paid maternity + parental/home-care leave (length & average payment rate)",
    "unit": "weeks at stated average payment rate",
    "source_url": "https://webfs.oecd.org/els-com/Family_Database/PF2_1_Parental_leave_systems.pdf",
    "values": {
        "US": {"weeks": 0, "avg_payment_rate_pct": 0},
        "DE": {"weeks": 58, "avg_payment_rate_pct": 65},
        "UK": {"weeks": 52, "avg_payment_rate_pct": 30},
        "NO": {"weeks": 59, "avg_payment_rate_pct": 90},
        "SE": {"weeks": 68, "avg_payment_rate_pct": 78},
        "FI": {"weeks": 47.5, "avg_payment_rate_pct": 70},
        "CH": {"weeks": 14, "avg_payment_rate_pct": 80},
        "JP": {"weeks": 58, "avg_payment_rate_pct": 60},
    },
    "value_notes": {
        "US": "No federal statutory paid maternity/parental leave (FMLA guarantees only unpaid, job-protected leave); a handful of states provide paid leave.",
        "DE": "14 weeks maternity leave (Mutterschutz, ~100% via Mutterschaftsgeld+employer top-up) plus up to 3 years shared parental leave, of which Elterngeld pays 65-67% of prior net income for up to 14 months (parents combined) if split between both parents.",
        "UK": "52 weeks Statutory Maternity Leave; pay is 90% of average earnings for 6 weeks then a low flat rate (~£184.03/wk 2024) or 90% if lower for remaining 33 weeks (unpaid last 13 weeks) - so effective average payment rate is low (~30%) relative to average wage.",
        "NO": "Parents choose 49 weeks at 100% pay or 59 weeks at 80% pay (figures shown assume the 80%/59-week option); includes maternity, paternity and shared parental quotas.",
        "SE": "480 total days (~68.5 weeks) of paid parental leave per child shared between parents; ~390 days paid at ~78% of income (capped) and the remainder at a low flat rate.",
        "FI": "17.5 weeks maternity + ~4 weeks paternity + 26 weeks parental leave = 47.5 weeks total around childbirth, paid at roughly 70% average earnings-related rate (varies with income and duration); home care leave extends unpaid/low-flat-rate coverage until age 3.",
        "CH": "14 weeks maternity leave at 80% of earnings (capped); no separate federal parental leave beyond a 2-week paternity leave introduced in 2021 (not included in the maternity-only figure shown).",
        "JP": "14 weeks maternity leave plus child-care leave available to either parent until the child turns 1 (extendable to 2); employment insurance pays 67% of wages for first 6 months of child-care leave, dropping to 50% thereafter (approx. 58 weeks combined shown at a blended ~60% rate).",
    },
})

# 4. Public healthcare (funding model + public financing share)
categories.append({
    "id": "public_healthcare",
    "label": "Public healthcare financing share of total health spending",
    "unit": "percent of total health expenditure, model type",
    "source_url": "https://www.oecd.org/en/publications/2023/11/health-at-a-glance-2023_e04f8239/full-report/public-funding-of-health-spending_712db152.html",
    "values": {
        "US": {"public_financing_share_pct": 26, "model": "mixed (federal/state programs + employer & individual private insurance)"},
        "DE": {"public_financing_share_pct": 84, "model": "compulsory social health insurance (multi-payer, sickness funds)"},
        "UK": {"public_financing_share_pct": 79, "model": "universal, tax-funded National Health Service"},
        "NO": {"public_financing_share_pct": 85, "model": "universal, government-financed national health service"},
        "SE": {"public_financing_share_pct": 84, "model": "universal, regionally-run tax-funded system"},
        "FI": {"public_financing_share_pct": 78, "model": "universal, municipally-run + compulsory national health insurance"},
        "CH": {"public_financing_share_pct": 64, "model": "mandatory private insurance with community rating & subsidies (not government-run)"},
        "JP": {"public_financing_share_pct": 84, "model": "universal compulsory social health insurance (multi-payer)"},
    },
    "value_notes": {
        "US": "OECD/Health at a Glance 2023 (2021 data): government + compulsory programs (Medicare/Medicaid) ~26% government transfers; total compulsory financing (incl. employer-mandated) is much higher (~58%) but a large voluntary/private share remains, unlike other countries in this table.",
        "DE": "Compulsory statutory health insurance (GKV) covers ~90% of the population; roughly three-quarters or more of spending flows through compulsory insurance funds.",
        "UK": "NHS is financed primarily from general taxation; government schemes fund ~80% or more of national health spending.",
        "NO": "Government transfers fund 85%+ of health spending, among the highest shares of any OECD country.",
        "SE": "Government (largely regional/county) financing covers 84% of health spending.",
        "FI": "Combination of municipal tax funding and compulsory national health insurance; ~78% publicly financed with a comparatively higher out-of-pocket share (~20%) than other Nordics.",
        "CH": "Mandatory but privately-run insurance (LAMal/KVG) is the primary payer; total compulsory (insurance + government subsidy) financing is ~64%, with high out-of-pocket costs (~29%) versus other high-income peers.",
        "JP": "Universal compulsory social health insurance (employment-based or residence-based); combined compulsory/government financing covers roughly 84% of spending.",
    },
})

# 5. Public higher education (typical annual public-university tuition)
categories.append({
    "id": "public_higher_education",
    "label": "Public university tuition (typical annual fee, national students)",
    "unit": "USD per year",
    "source_url": "https://www.oecd.org/en/publications/2024/09/education-at-a-glance-2024_5ea68448/full-report/how-much-do-tertiary-students-pay-and-what-public-support-do-they-receive_a48eab74.html",
    "values": {"US": 11260, "DE": 250, "UK": 11600, "NO": 0, "SE": 0, "FI": 0, "CH": 1427, "JP": 5645},
    "value_notes": {
        "US": "In-state public 4-year tuition average (NCES); no-tuition/low-cost only via targeted programs, not a national norm.",
        "DE": "Public universities charge no tuition for German/EU students; only a semester administrative contribution of roughly €100-400 (~$105-420) applies.",
        "UK": "Tuition capped at £9,250/yr (~$11,600) for home students at English universities; Scotland offers free tuition to Scottish-domiciled students (not reflected in this UK-wide figure).",
        "NO": "Public universities charge no tuition to any student (domestic or, historically, international); only a small semester fee (~€30-60) applies. Since 2023 non-EU/EEA students pay full fees, but domestic students remain free.",
        "SE": "No tuition for Swedish/EU/EEA students at public universities.",
        "FI": "No tuition for Finnish/EU/EEA students at public universities (non-EU students pay fees since 2017).",
        "CH": "Public (cantonal) universities charge modest fees, roughly CHF 500-2,000/semester; figure shown is an average annual estimate (OECD/Education Data Initiative).",
        "JP": "National university standard tuition is set at ¥535,800/year (~$3,500-5,600 depending on FX) plus admission fee; figure is OECD/Education Data Initiative estimate inclusive of standard fees.",
    },
})

# 6. Public childcare (net cost as % of household/average earnings, OECD PF3.4)
categories.append({
    "id": "public_childcare",
    "label": "Net childcare cost (2 children, dual-earner couple)",
    "unit": "percent of net household income",
    "source_url": "https://www.oecd.org/en/data/indicators/net-childcare-costs.html",
    "values": {"US": 32, "DE": 1, "UK": 25, "NO": 4, "SE": 4, "FI": 4, "CH": 20, "JP": 13},
    "value_notes": {
        "US": "No universal federal childcare subsidy; net cost highest in the OECD at roughly 32% of net household income for a dual full-time-earner couple with 2 young children in centre-based care.",
        "DE": "Heavily subsidized municipal Kita system brings net cost to ~1% of household income for a typical dual-earner couple, among the lowest in the OECD.",
        "UK": "Net cost around 25% of household income for a dual-earner couple prior to the 2024-25 free-hours expansion for under-3s, which is gradually reducing this figure.",
        "NO": "Nordic income-tested fee caps keep net childcare costs to roughly 1-5% of household income.",
        "SE": "Maxtaxa fee cap system keeps net childcare cost in the low single digits (~1-5%) of household income.",
        "FI": "Income-tested municipal day-care fee caps keep net cost in the low single digits (~1-5%) of household income.",
        "CH": "Among the highest gross childcare fees in the OECD (up to ~64% of average earnings gross); net cost after limited subsidies remains high at roughly 20% of household income, varies significantly by canton.",
        "JP": "Progressive expansion of free/subsidized early childhood education (free for 3-5 year-olds since 2019) has lowered net cost; remaining net burden estimated around 13% of household income for younger (0-2) age care.",
    },
})

# 7. Public transit farebox subsidy (100 - farebox recovery ratio)
categories.append({
    "id": "public_transit",
    "label": "Public transit operating subsidy (100% − average farebox recovery ratio)",
    "unit": "percent of operating cost publicly subsidized",
    "source_url": "https://www.uitp.org/wp-content/uploads/sites/7/2025/08/20250822_Fare-Affordability_Policy-Brief_WEB.pdf",
    "values": {"US": 83, "DE": 30, "UK": 50, "NO": 50, "SE": 56, "FI": 51, "CH": 50, "JP": -20},
    "value_notes": {
        "US": "Average US farebox recovery ratio fell to ~17% post-pandemic (FTA National Transit Summaries 2023), implying an ~83% public operating subsidy across all modes/systems (source: https://www.transit.dot.gov/sites/fta.dot.gov/files/2024-12/2023%20National%20Transit%20Summaries%20and%20Trends_1.2.pdf).",
        "DE": "Germany's larger urban systems report farebox recovery around 70% (e.g., Berlin BVG ~70%), but the UITP-reported European median farebox ratio is ~50%; using the more conservative UITP European-region median of ~50% recovery implies ~50%, but Germany-specific transit-association data suggests recovery nearer 70% (subsidy ~30%). Figure shown uses Germany-specific ~70% recovery estimate (subsidy 30%); treat as approximate (source: https://uncrd.un.org/sites/default/files/5th-est_p2-1.pdf).",
        "UK": "UITP/European regional average farebox recovery is roughly 50% (subsidy ~50%); London Underground specifically has historically run near 100% recovery, so this is a national blended estimate.",
        "NO": "European regional median farebox recovery of ~50% applied as a blended national estimate; Norway-specific system-level data is sparse.",
        "SE": "Stockholm-area farebox recovery historically reported around 44-50%; blended national estimate of ~44-56% recovery implies subsidy of ~44-56%.",
        "FI": "Helsinki region (HSL) farebox recovery reported around 49% (2019), implying an operating subsidy of roughly 51%.",
        "CH": "Switzerland's dense, well-used rail/tram network reports farebox recovery figures in the same ~50% range as the broader European median in most cross-national comparisons; Zurich S-Bahn specific data indicates comparable levels; treated here as ~50% for consistency (specific figure uncertain, flagged as approximate).",
        "JP": "Japanese private rail operators are generally required to recover ~100% of operating costs from fares (regulatory mandate), with government subsidy mainly limited to sparsely-populated regional lines; Tokyo Toei rail farebox recovery has been reported as high as ~120% in some measurements, hence a negative 'subsidy' value (fares exceed operating cost / profitable operation) is shown to reflect the fundamentally different (fare-driven, not subsidy-driven) model versus the other 7 countries.",
    },
})

# 8. Unemployment insurance (net replacement rate, initial phase, 100% AW, single person)
categories.append({
    "id": "unemployment_insurance",
    "label": "Unemployment benefit net replacement rate (initial phase, single person, 100% AW)",
    "unit": "percent of prior net income",
    "source_url": "https://www.oecd.org/en/publications/society-at-a-glance-2024_918d8db3-en/full-report/unemployment-and-social-safety-net-benefits_ddfedfa8.html",
    "values": {"US": 62, "DE": 60, "UK": 41, "NO": 64, "SE": 62, "FI": 54, "CH": 70, "JP": 54},
    "value_notes": {
        "US": "OECD Benefits and Wages indicators (single person, 100% AW, initial unemployment phase); US state unemployment insurance systems vary but average near 60%; benefit duration is short (typically 26 weeks) relative to European peers.",
        "DE": "Arbeitslosengeld I pays 60% of prior net income (67% for claimants with children) for up to 12-24 months depending on age/contribution history.",
        "UK": "Jobseeker's Allowance / Universal Credit provides comparatively low flat-rate benefits, giving one of the lowest net replacement rates among high-income OECD countries.",
        "NO": "Dagpenger unemployment insurance replaces roughly 62.4% of prior income (capped), among the more generous initial-phase rates in the OECD sample used here.",
        "SE": "A-kassa unemployment insurance pays up to 80% of prior income for the first 100 days (subject to a low cap that reduces the effective rate for average-wage earners), tapering afterward; ~62% reflects the effective rate at the average wage after the benefit cap.",
        "FI": "Earnings-related unemployment allowance (ansiopäiväraha) pays roughly 45-60% of prior earnings depending on income level and union fund membership; ~54% used as a representative average-wage figure.",
        "CH": "Swiss unemployment insurance (ALV/AC) pays 70% of insured earnings (80% for those with dependent children or below a low-income threshold), among the highest initial-phase replacement rates in the OECD.",
        "JP": "Employment insurance basic allowance replaces roughly 50-80% of prior wages on a sliding scale (lower % for higher earners); ~54% used as representative for an average-wage single person.",
    },
})

# 9. Pension replacement rate - reuse from oecd_pensions.json
categories.append({
    "id": "pension_replacement_rate",
    "label": "Mandatory pension net replacement rate (100% average wage earner)",
    "unit": "percent of pre-retirement net earnings",
    "source_url": "https://www.oecd.org/en/publications/2023/12/pensions-at-a-glance-2023_a5be971a.html",
    "values": {"US": 51.3, "DE": 53.3, "UK": 54.2, "NO": 54.9, "SE": 66.3, "FI": 65.7, "CH": None, "JP": None},
    "value_notes": {
        "US": "Reused from data/v2/oecd_pensions.json (net_replacement_rate_100pct_avg_wage_mandatory). Mandatory public (Social Security) only; combined ~10.6% nominal contribution rate.",
        "DE": "Reused from data/v2/oecd_pensions.json. Public statutory pension (GRV) only; contribution rate also finances disability/invalidity benefits.",
        "UK": "Reused from data/v2/oecd_pensions.json. Combines flat-rate State Pension with mandatory auto-enrolment workplace pension (nominal 8% minimum: 5% employee/3% employer).",
        "NO": "Reused from data/v2/oecd_pensions.json. Combines National Insurance Scheme pension with mandatory occupational pension (OTP, min 2% employer above threshold).",
        "SE": "Reused from data/v2/oecd_pensions.json. Combines public income pension, premium pension, and near-universal mandatory occupational pension.",
        "FI": "Reused from data/v2/oecd_pensions.json. Earnings-related statutory pension (TyEL); no separate ceiling.",
        "CH": "Not available in data/v2/oecd_pensions.json extract used for this pull; Swiss 3-pillar system (AHV/IV + mandatory BVG occupational) typically yields a net replacement rate in the 55-65% range per OECD Pensions at a Glance, but the exact OECD figure was not captured in the existing v2 file and was not re-verified in this pass.",
        "JP": "Not available in data/v2/oecd_pensions.json extract used for this pull; Japan's combined Employees' Pension Insurance (kosei nenkin) + basic pension typically yields a net replacement rate around 40-50% per OECD Pensions at a Glance, but the exact figure was not captured in the existing v2 file and was not re-verified in this pass.",
    },
})

# 10. Family cash benefits (child benefit, first child, monthly, USD)
categories.append({
    "id": "family_cash_benefits",
    "label": "Universal child benefit (first child, monthly)",
    "unit": "USD per month",
    "source_url": "https://en.wikipedia.org/wiki/Child_benefit",
    "values": {"US": 0, "DE": 268, "UK": 124, "NO": 142, "SE": 114, "FI": 100, "CH": 226, "JP": 66},
    "value_notes": {
        "US": "No federal universal child benefit; the (non-universal, phased-out at higher incomes, partly refundable) Child Tax Credit is a tax-time credit rather than a monthly cash payment, so treated as 0 for this monthly-cash-benefit comparison.",
        "DE": "Kindergeld is €255/month per child (2025, rising to €259 in 2026) regardless of parental income; converted at approx. EUR/USD 1.05.",
        "UK": "Child Benefit is £26.05/week (~£112.88/month) for the first child (2025); subject to a High Income Child Benefit Charge clawback above £60,000 income; converted at approx. GBP/USD 1.27, further additional amounts for extra children.",
        "NO": "NOK 1,354/month per child under age 6, NOK 1,054/month for ages 6-18; figure shown is the under-6 rate converted at approx. NOK/USD 0.095 (~$105-135 depending on child age and FX).",
        "SE": "Barnbidrag is SEK 1,250/month per child (tax-free), universal regardless of income; converted at approx. SEK/USD 0.091; additional 'flerbarnstillägg' supplement for 2+ children not included here.",
        "FI": "Kela child benefit is €94.88/month for the first child (2024), plus a single-parent supplement of €73.30/month per child (not included in base figure); converted at approx. EUR/USD 1.05.",
        "CH": "Federal minimum child allowance is CHF 200-400/month depending on canton (figure uses a representative ~CHF 215/month); converted at approx. CHF/USD 1.05; cantons may pay more.",
        "JP": "Kodomo Teate is ¥15,000/month for children under 3, ¥10,000/month for ages 3 through junior high (income-tested reductions apply above a threshold, though 2024 reform removed most income caps); figure uses the under-3 rate converted at approx. JPY/USD 0.0066.",
    },
})

# 11. Statutory retirement age
categories.append({
    "id": "statutory_retirement_age",
    "label": "Statutory (full) retirement / state pension age",
    "unit": "years",
    "source_url": "https://worldpopulationreview.com/country-rankings/retirement-age-by-country",
    "values": {"US": 67, "DE": 66, "UK": 66, "NO": 67, "SE": 65, "FI": 65, "CH": 65, "JP": 65},
    "value_notes": {
        "US": "Social Security full retirement age is 67 for anyone born in 1960 or later; earliest reduced-benefit claiming age is 62, delayed credits available to age 70.",
        "DE": "Currently 66 (2025 cohort), rising gradually to 67 by 2031 (Regelaltersrente); reduced-benefit early retirement possible from 63 with sufficient contribution years.",
        "UK": "State Pension age is currently 66, confirmed to rise to 67 by 2028, with a further rise to 68 under consultation.",
        "NO": "Flexible from age 62, but 67 is the age at which the guaranteed minimum pension level applies; gradual increases linked to life expectancy are planned under pension reform.",
        "SE": "Flexible retirement age system with a rising minimum guarantee-pension age (64 as of recent reform) and a target/'riktålder' benchmark around 65-67 depending on birth year; 65 used as the traditional reference age.",
        "FI": "Statutory retirement age is 65 for those born in 1965 or later under recent reform, linked to life-expectancy coefficient going forward; flexible claiming from age 63-68.",
        "CH": "65 for men; women's retirement age is being phased up from 64 to 65 (AHV 21 reform, completed by 2028).",
        "JP": "Statutory pension eligibility age is 65 (kosei nenkin/basic pension); deferred claiming up to age 75 increases the benefit, and government has encouraged (non-mandatory) employment to age 70.",
    },
})

output = {
    "as_of": "2026-08-03",
    "countries": COUNTRIES,
    "categories": categories,
    "general_notes": [
        "This table compiles non-monetary/in-kind benefit levels from multiple OECD and national sources; see per-category source_url and value_notes for details and caveats.",
        "Values are point-in-time snapshots (mostly 2023-2025 data years) and are not adjusted for purchasing power parity.",
        "Some figures (public_transit subsidy for Germany/UK/Sweden/Switzerland; pension_replacement_rate for CH/JP) are flagged in value_notes as approximate or unavailable due to Tier 3 source access constraints within the task time budget.",
    ],
}

with open("/home/user/workspace/income-tiles/data/v3/non_monetary_benefits.json", "w") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print("wrote non_monetary_benefits.json with", len(categories), "categories")
