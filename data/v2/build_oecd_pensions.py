import json

# Table 8.1 contribution rates 2022, from OECD Pensions at a Glance 2023
# https://www.oecd.org/content/dam/oecd/en/publications/reports/2023/12/pensions-at-a-glance-2023_4757bf20/678055dd-en.pdf
contrib = {
    "US": {"employee_public": 5.3, "employer_public": 5.3, "employee_private": None, "employer_private": None,
           "nominal_total": 10.6, "ceiling_multiple_avg_earnings": 2.27, "effective_rate_avg_earnings": 10.6,
           "notes": None},
    "DE": {"employee_public": 9.3, "employer_public": 9.3, "employee_private": None, "employer_private": None,
           "nominal_total": 18.6, "ceiling_multiple_avg_earnings": 1.54, "effective_rate_avg_earnings": 18.6,
           "notes": "Contribution rate also finances disability/invalidity benefits."},
    "UK": {"employee_public": 12.0, "employer_public": 13.8, "employee_private": 5.0, "employer_private": 3.0,
           "nominal_total": 33.8, "ceiling_multiple_avg_earnings": "None(public) / 1.13(private)",
           "effective_rate_avg_earnings": 30.2,
           "notes": "Nominal public rate varies by earnings level [w]. Covers old age, survivor, disability, sickness/maternity, work injury, unemployment (broader than pure pension contribution)."},
    "NO": {"employee_public": 8.0, "employer_public": 13.0, "employee_private": 0.0, "employer_private": 2.0,
           "nominal_total": 23.0, "ceiling_multiple_avg_earnings": "None(public) / 1.98(private)",
           "effective_rate_avg_earnings": 23.0, "notes": None},
    "SE": {"employee_public": 7.0, "employer_public": 10.81, "employee_private": 0.0, "employer_private": 4.5,
           "nominal_total": 22.3, "ceiling_multiple_avg_earnings": "1.08(public) / None(private)",
           "effective_rate_avg_earnings": 22.3,
           "notes": "Private occupational nominal rate varies by earnings level [w], rising from 4.5% to 30% at 108% of average earnings. Public contribution rate includes mandatory occupational/personal pension schemes."},
    "FI": {"employee_public": 7.47, "employer_public": 17.4, "employee_private": None, "employer_private": None,
           "nominal_total": 24.85, "ceiling_multiple_avg_earnings": "None",
           "effective_rate_avg_earnings": 24.15,
           "notes": "Rate varies by age [a]: employee contribution to public scheme is 8.65% between ages 53-62, 7.15% otherwise. Public pensions in Finland are partly funded and privately managed but classified as public in national accounts."},
    "CH": {"employee_public": 4.35, "employer_public": 4.35, "employee_private": 6.25, "employer_private": 6.25,
           "nominal_total": 21.2, "ceiling_multiple_avg_earnings": "None(public) / 0.85(private)",
           "effective_rate_avg_earnings": 17.3,
           "notes": "Private occupational nominal rate varies by age and earnings [a,w]: average of age-specific rates 7% (25-34), 10% (35-44), 15% (45-54), 18% (55-64); contributions paid only on earnings exceeding 29% of average earnings."},
    "JP": {"employee_public": 9.15, "employer_public": 9.15, "employee_private": None, "employer_private": None,
           "nominal_total": 18.3, "ceiling_multiple_avg_earnings": 2.39, "effective_rate_avg_earnings": 18.3,
           "notes": None},
}
oecd_avg = {"employee_public": 6.3, "employer_public": 9.1, "employee_private": 1.0, "employer_private": 1.7,
            "nominal_total": None, "ceiling_multiple_avg_earnings": None, "effective_rate_avg_earnings": 18.2,
            "notes": "OECD35 average, effective rate at average wage; averages are for earners at the average wage and do not represent a simple average of the nominal-rate columns."}

# Replacement rates 2024, from OECD SDMX dataflow OECD.ELS.SPD,DSD_PAG@DF_PRR,1.0
# fetched via https://sdmx.oecd.org/public/rest/data/OECD.ELS.SPD,DSD_PAG@DF_PRR,1.0/...
repl = {
    "US": {"gross_100pct_mandatory": 39.7, "net_100pct_mandatory": 51.3},
    "DE": {"gross_100pct_mandatory": 42.1, "net_100pct_mandatory": 53.3},
    "UK": {"gross_100pct_mandatory": 44.7, "net_100pct_mandatory": 54.2},
    "NO": {"gross_100pct_mandatory": 46.1, "net_100pct_mandatory": 54.9},
    "SE": {"gross_100pct_mandatory": 63.7, "net_100pct_mandatory": 66.3},
    "FI": {"gross_100pct_mandatory": 57.8, "net_100pct_mandatory": 65.7},
    "CH": {"gross_100pct_mandatory": 42.4, "net_100pct_mandatory": 47.5},
    "JP": {"gross_100pct_mandatory": 36.5, "net_100pct_mandatory": 42.4},
}
oecd_avg_repl = {"gross_100pct_mandatory_male": 52.0, "gross_100pct_mandatory_female": 51.4,
                 "net_100pct_mandatory_male": 63.2, "net_100pct_mandatory_female": 62.4}

country_names = {"US": "United States", "DE": "Germany", "UK": "United Kingdom", "NO": "Norway",
                  "SE": "Sweden", "FI": "Finland", "CH": "Switzerland", "JP": "Japan"}

rows = []
for code in ["US", "DE", "UK", "NO", "SE", "FI", "CH", "JP"]:
    c = contrib[code]
    r = repl[code]
    rows.append({
        "group": code,
        "country_name": country_names[code],
        "pension_contribution_employee_public_pct": c["employee_public"],
        "pension_contribution_employer_public_pct": c["employer_public"],
        "pension_contribution_employee_private_pct": c["employee_private"],
        "pension_contribution_employer_private_pct": c["employer_private"],
        "pension_contribution_nominal_total_pct": c["nominal_total"],
        "pension_contribution_effective_rate_avg_earnings_pct": c["effective_rate_avg_earnings"],
        "pension_contribution_ceiling_multiple_of_avg_earnings": c["ceiling_multiple_avg_earnings"],
        "gross_replacement_rate_100pct_avg_wage_mandatory": r["gross_100pct_mandatory"],
        "net_replacement_rate_100pct_avg_wage_mandatory": r["net_100pct_mandatory"],
        "notes": c["notes"]
    })

rows.append({
    "group": "OECD_AVERAGE",
    "country_name": "OECD average (35 countries for contributions; sex-specific average for replacement rates)",
    "pension_contribution_employee_public_pct": oecd_avg["employee_public"],
    "pension_contribution_employer_public_pct": oecd_avg["employer_public"],
    "pension_contribution_employee_private_pct": oecd_avg["employee_private"],
    "pension_contribution_employer_private_pct": oecd_avg["employer_private"],
    "pension_contribution_nominal_total_pct": oecd_avg["nominal_total"],
    "pension_contribution_effective_rate_avg_earnings_pct": oecd_avg["effective_rate_avg_earnings"],
    "pension_contribution_ceiling_multiple_of_avg_earnings": oecd_avg["ceiling_multiple_avg_earnings"],
    "gross_replacement_rate_100pct_avg_wage_mandatory": oecd_avg_repl["gross_100pct_mandatory_male"],
    "net_replacement_rate_100pct_avg_wage_mandatory": oecd_avg_repl["net_100pct_mandatory_male"],
    "notes": oecd_avg["notes"]
})

data = {
    "source": "OECD Pensions at a Glance 2023 (contribution rates, Table 8.1) and OECD Pension Replacement Rates dataflow (2024, mandatory schemes)",
    "country": "US,DE,UK,NO,SE,FI,CH,JP,OECD_AVERAGE",
    "year": 2024,
    "unit": "percent",
    "price_basis": "not_applicable",
    "data_tier": "A",
    "breakdown": "by_country",
    "categories": ["pension_contribution_rate", "pension_replacement_rate"],
    "rows": rows,
    "source_url": "https://www.oecd.org/content/dam/oecd/en/publications/reports/2023/12/pensions-at-a-glance-2023_4757bf20/678055dd-en.pdf ; https://sdmx.oecd.org/public/rest/data/OECD.ELS.SPD,DSD_PAG@DF_PRR,1.0/all?dimensionAtObservation=AllDimensions&format=csvfilewithlabels",
    "notes": (
        "REAL PRIMARY DATA from two official OECD sources, combined into one file: "
        "(1) MANDATORY PENSION CONTRIBUTION RATES for an average worker in 2022 (latest available), from Table 8.1 "
        "of the OECD's biennial 'Pensions at a Glance 2023: OECD and G20 Indicators' report (PDF: "
        "https://www.oecd.org/content/dam/oecd/en/publications/reports/2023/12/pensions-at-a-glance-2023_4757bf20/678055dd-en.pdf). "
        "Figures cover contributions to MANDATORY AND QUASI-MANDATORY pension schemes (public plus, where applicable, "
        "mandatory/auto-enrolment private/occupational schemes), split into employee/employer and public/private "
        "components, plus an 'effective rate on average earnings' that accounts for contribution ceilings. "
        "(2) PENSION REPLACEMENT RATES for 2024 (gross and net, at 100% of average wage, mandatory schemes only, "
        "combining public and private mandatory pensions), fetched directly from the OECD's live SDMX data API "
        "(dataflow OECD.ELS.SPD:DSD_PAG@DF_PRR, measures GPRR100/NPRR100, optionality=Mandatory) which underlies "
        "the 'Pensions at a Glance' indicator pages e.g. https://www.oecd.org/en/data/indicators/net-pension-replacement-rates.html "
        "and https://www.oecd.org/en/data/indicators/gross-pension-replacement-rates.html. Values were identical "
        "for Male and Female in the fetched data for all 8 target countries at the 100%-of-average-wage income "
        "level (differences by sex mainly arise at other earnings levels or in countries with sex-specific "
        "retirement ages/rules not reflected in this file). "
        "VINTAGE MISMATCH CAVEAT: contribution rates are for 2022 (Table 8.1, the latest published in the 2023 "
        "biennial report; the next edition, 'Pensions at a Glance 2025', was not yet available as a machine-readable "
        "table at the time of this pull) while replacement rates are the 2024 vintage from the live data API -- "
        "these two vintages are combined in a single row per country for convenience but are NOT from the same "
        "survey year; treat contribution-rate figures as materially unchanged since 2022 unless a specific country "
        "is known to have reformed its pension system since then. "
        "CATEGORY MAPPING / DEFINITIONS: 'pension_contribution_effective_rate_avg_earnings_pct' is the headline "
        "summary figure most useful for the v2 discretionary-income calculation (it already nets out the effect of "
        "contribution ceilings and, in Finland's/Switzerland's case, age-varying rates); 'nominal_total' is the "
        "simple sum of nominal employee+employer public+private rates before applying any ceiling and can exceed "
        "the effective rate for countries with earnings ceilings (e.g. Switzerland: nominal 21.2% vs effective "
        "17.3%). UK figures are notably broader than pure old-age pension contributions -- OECD Table 8.1 notes UK's "
        "reported rate 'covers old age, survivor, disability, sickness and maternity, work injury, and unemployment' "
        "(i.e. it is essentially the full UK National Insurance rate, not an isolated pension contribution) -- treat "
        "the UK figure as an upper-bound proxy for pension-specific burden. Sweden and Norway's 'private' "
        "components include mandatory occupational/auto-enrolment schemes (not voluntary savings) so they belong "
        "in a 'mandatory pension contribution' bucket, not the v2 schema's 'voluntary_savings' category. "
        "'gross_replacement_rate' = pension benefit as % of gross pre-retirement earnings at the average-wage level; "
        "'net_replacement_rate' = pension entitlement as % of NET (after-tax) pre-retirement earnings, both for "
        "MANDATORY schemes only (public + mandatory private/occupational), excluding voluntary private pensions -- "
        "net rates are systematically higher than gross rates because retirees typically face lower effective tax "
        "and social-contribution rates than workers. "
        "USAGE NOTE FOR v2 FRONTEND: this file is country-level (not by-decile/household-type) and is intended to "
        "provide (a) a standard mandatory-pension-contribution-rate deduction to subtract from gross income before "
        "computing discretionary income for each non-US country (the US-specific equivalent, Social Security's "
        "6.2% employee OASDI + Medicare 1.45% FICA, is already implicit in the BLS CES after-tax income figures and "
        "should NOT be double-counted using this file's US row), and (b) a reference replacement-rate figure for "
        "any future 'retirement adequacy' feature. All 8 target countries plus the OECD-35 average are included."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/oecd_pensions.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Wrote oecd_pensions.json")
print(json.dumps(rows[:2], indent=2))
