#!/usr/bin/env python3
"""
A.4 - OECD Taxing Wages effective tax rate by percentile of average wage.

Source: OECD Taxing Wages 2025 (data year 2024), Table 3.2 (income tax + employee SSC,
single person no children, % of gross wage earnings) and Table 3.1 (tax wedge, % of labour
cost, incl. employer SSC) via
https://www.oecd.org/en/publications/2025/04/taxing-wages-2025_20d1a01d/full-report/effective-tax-rates-on-labour-income-in-2024_878e20ff.html

OECD's standard Taxing Wages tables publish only 67%, 100%, and 167% of the average wage (AW)
as standardised multiples for single filers -- there is no official 250% AW column in the
report. For 250% AW we extrapolate linearly using the 100%->167% slope (rate_250 = rate_167 +
(rate_167 - rate_100) * (250-167)/(167-100)), capped so it doesn't exceed a country's top
statutory marginal rate. This is clearly flagged as "extrapolated" per data point.

US cross-check: CBO's post-tax national income series (used elsewhere in this project,
cbo_us.json) implies an effective federal tax rate (federal taxes / income before transfers)
of roughly 20-24% at the 91-95th percentile band and higher at the top 1% for recent years --
broadly consistent with (though not identical in scope to) the OECD single-filer no-children
figure of 24.4% at 100% AW and 29.2% at 167% AW; OECD Taxing Wages covers income tax + employee
SSC only (no state/local tax, no capital gains, no corporate incidence), while CBO's series
includes all federal taxes -- the two are not directly interchangeable but point the same
direction.
"""
import json

DATA = {
    # iso: {67, 100, 167} = income tax + employee SSC as % of gross wage (Table 3.2)
    "US": {67: 21.6, 100: 24.4, 167: 29.2},
    "DE": {67: 32.7, 100: 37.4, 167: 41.5},
    "UK": {67: 17.8, 100: 21.4, 167: 29.7},
    "NO": {67: 23.5, 100: 28.1, 167: 35.0},
    "SE": {67: 20.0, 100: 23.1, 167: 33.5},
    "FI": {67: 22.3, 100: 30.3, 167: 38.3},
    "CH": {67: 14.9, 100: 18.0, 167: 22.8},
    "JP": {67: 19.8, 100: 22.0, 167: 26.4},
}

# Tax wedge (income tax + employee + employer SSC, % of labour cost) - Table 3.1, for reference
WEDGE = {
    "US": {67: 27.6, 100: 30.1, 167: 34.4},
    "DE": {67: 43.9, 100: 47.9, 167: 49.1},
    "UK": {67: 25.3, 100: 29.4, 167: 37.4},
    "NO": {67: 32.3, 100: 36.4, 167: 43.3},
    "SE": {67: 39.1, 100: 41.5, 167: 49.4},
    "FI": {67: 35.2, 100: 41.9, 167: 48.5},
    "CH": {67: 20.0, 100: 22.9, 167: 27.4},
    "JP": {67: 30.7, 100: 32.6, 167: 35.7},
}

# Rough top statutory combined marginal rate caps (income tax + employee SSC), for capping
# the 250% AW extrapolation. Source: OECD Tax Database / national statutory schedules (approx).
TOP_RATE_CAP = {
    "US": 40.8,   # federal top 37% + ~1.45%/2.35% Medicare + typical state ~ but this is fed-only concept; keep conservative for income-tax+SSC federal concept
    "DE": 47.5,
    "UK": 47.0,
    "NO": 47.4,
    "SE": 52.0,
    "FI": 51.4,
    "CH": 22.5,   # federal is low; SSC caps out; combined stays close to 167% figure
    "JP": 45.0,
}


def extrapolate_250(r100, r167, cap):
    slope_unit = (r167 - r100) / (167 - 100)  # rate change per 1 pct-point of AW
    r250 = r167 + slope_unit * (250 - 167)
    return round(min(r250, cap), 1)


def main():
    out = {
        "source": "OECD Taxing Wages 2025 (data year 2024)",
        "source_url": "https://www.oecd.org/en/publications/2025/04/taxing-wages-2025_20d1a01d/full-report/effective-tax-rates-on-labour-income-in-2024_878e20ff.html",
        "extracted": "2026-08-03",
        "household_type": "single person, no children",
        "measure": "income tax + employee social security contributions, as % of gross wage earnings (net personal average tax rate components; does not include employer SSC, state/local/cantonal income tax on top of federal in some countries, or means-tested cash benefits)",
        "wage_basis": "% of national average wage (AW), OECD Taxing Wages definition (avg annual gross wage of full-time adult workers)",
        "notes": (
            "67%, 100%, and 167% AW values are the OECD's own standardised published data points "
            "(Table 3.2 of Taxing Wages 2025). OECD does not publish a 250% AW point for this table; "
            "the 250% figure is LINEARLY EXTRAPOLATED from the 100%->167% slope and capped at an "
            "approximate top statutory combined marginal rate per country -- treat as directional, "
            "not an official OECD figure (flagged 'extrapolated': true below). A supplementary "
            "'tax_wedge_pct' block (income tax + employee + employer SSC as % of labour cost, "
            "Table 3.1) is included per country for cross-checking / alternate definitions. "
            "For the US specifically, cross-check this single-filer OECD series against CBO's "
            "federal effective tax rate by income group in cbo_us.json -- the two use different "
            "scope (OECD = income tax + employee SSC only; CBO = all federal taxes including "
            "corporate and payroll incidence) so they will not match exactly, but should move "
            "in the same direction across the income scale."
        ),
        "countries": {},
    }
    for iso, rates in DATA.items():
        r250 = extrapolate_250(rates[100], rates[167], TOP_RATE_CAP[iso])
        out["countries"][iso] = {
            "effective_tax_pct_of_gross_wage": {
                "67": rates[67],
                "100": rates[100],
                "167": rates[167],
                "250": r250,
            },
            "extrapolated": {"67": False, "100": False, "167": False, "250": True},
            "tax_wedge_pct_of_labour_cost": {
                "67": WEDGE[iso][67],
                "100": WEDGE[iso][100],
                "167": WEDGE[iso][167],
            },
        }
    with open("/home/user/workspace/income-tiles/data/v3/effective_tax_by_percentile.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Wrote effective_tax_by_percentile.json")


if __name__ == "__main__":
    main()
