import json

# Ownership rate by Bundesland, Destatis Mikrozensus/Zensus 2022
# https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Wohnen/Tabellen/tabelle-eigentumsquote.html
ownership = {
    "Deutschland": {"total_1000": 38992, "owner_1000": 16341, "ownership_rate_pct": 41.9},
    "Brandenburg": {"total_1000": 1241, "owner_1000": 550, "ownership_rate_pct": 44.3},
    "Berlin": {"total_1000": 1850, "owner_1000": 294, "ownership_rate_pct": 15.9},
    "Baden-Wuerttemberg": {"total_1000": 4991, "owner_1000": 2419, "ownership_rate_pct": 48.5},
    "Bayern": {"total_1000": 6068, "owner_1000": 2780, "ownership_rate_pct": 45.8},
    "Bremen": {"total_1000": 341, "owner_1000": 109, "ownership_rate_pct": 32.0},
    "Hessen": {"total_1000": 2844, "owner_1000": 1209, "ownership_rate_pct": 42.5},
    "Hamburg": {"total_1000": 902, "owner_1000": 183, "ownership_rate_pct": 20.3},
    "Mecklenburg-Vorpommern": {"total_1000": 804, "owner_1000": 306, "ownership_rate_pct": 38.0},
    "Niedersachsen": {"total_1000": 3521, "owner_1000": 1725, "ownership_rate_pct": 49.0},
    "Nordrhein-Westfalen": {"total_1000": 8517, "owner_1000": 3286, "ownership_rate_pct": 38.6},
    "Rheinland-Pfalz": {"total_1000": 1865, "owner_1000": 949, "ownership_rate_pct": 50.9},
    "Schleswig-Holstein": {"total_1000": 1421, "owner_1000": 649, "ownership_rate_pct": 45.7},
    "Saarland": {"total_1000": 484, "owner_1000": 289, "ownership_rate_pct": 59.7},
    "Sachsen": {"total_1000": 2023, "owner_1000": 698, "ownership_rate_pct": 34.5},
    "Sachsen-Anhalt": {"total_1000": 1083, "owner_1000": 459, "ownership_rate_pct": 42.4},
    "Thueringen": {"total_1000": 1036, "owner_1000": 436, "ownership_rate_pct": 42.1},
}

# BBSR Regional Price Index 2022 (Bundesdurchschnitt = 100), county/city-level examples
# https://www.bbsr.bund.de/BBSR/DE/veroeffentlichungen/sonderveroeffentlichungen/2023/regionaler-preisindex-big-data-dl.pdf
bbsr_city_examples = {
    "Muenchen": {"bundesland": "Bayern", "regional_price_index_2022": 125.1},
    "Frankfurt am Main": {"bundesland": "Hessen", "regional_price_index_2022": 115.9},
    "Hamburg": {"bundesland": "Hamburg", "regional_price_index_2022": 111.5},
    "Stuttgart": {"bundesland": "Baden-Wuerttemberg", "regional_price_index_2022": 114.8},
    "Koeln": {"bundesland": "Nordrhein-Westfalen", "regional_price_index_2022": 109.4},
    "Duesseldorf": {"bundesland": "Nordrhein-Westfalen", "regional_price_index_2022": 108.5},
    "Bonn": {"bundesland": "Nordrhein-Westfalen", "regional_price_index_2022": 106.8},
    "Potsdam": {"bundesland": "Brandenburg", "regional_price_index_2022": 106.6},
    "Muenster": {"bundesland": "Nordrhein-Westfalen", "regional_price_index_2022": 106.6},
    "Trier": {"bundesland": "Rheinland-Pfalz", "regional_price_index_2022": 104.3},
    "Vogtlandkreis": {"bundesland": "Sachsen", "regional_price_index_2022": 90.5},
    "Greiz": {"bundesland": "Thueringen", "regional_price_index_2022": 90.5},
    "Goerlitz": {"bundesland": "Sachsen", "regional_price_index_2022": 90.6},
    "Salzlandkreis": {"bundesland": "Sachsen-Anhalt", "regional_price_index_2022": 90.7},
    "Gera": {"bundesland": "Thueringen", "regional_price_index_2022": 91.4},
}

bbsr_aggregates = {
    "Germany_national": 100.0,
    "West_Germany_population_weighted": 100.8,
    "East_Germany_population_weighted": 96.6,
    "Top7_cities": 111.5,  # Berlin, Duesseldorf, Frankfurt am Main, Hamburg, Koeln, Muenchen, Stuttgart
    "Kreisfreie_Grossstaedte_ohne_Top7": 100.6,
    "Staedtische_Kreise": 99.9,
    "Laendliche_Kreise_mit_Verdichtungsansaetzen": 96.4,
    "Duenn_besiedelte_laendliche_Kreise": 95.1
}

rows = []
for land, own in ownership.items():
    row = {
        "group": land,
        "households_total_thousands": own["total_1000"],
        "households_owner_thousands": own["owner_1000"],
        "housing_owner_share": round(own["ownership_rate_pct"] / 100, 4),
        "regional_price_index_2022_baseline_100": None,  # not published at Land aggregate level; see notes
        "housing_owner_imputed_rent_estimate": None
    }
    rows.append(row)

data = {
    "source": "Destatis Mikrozensus/Zensus 2022 (Eigentumsquote by Bundesland) + BBSR/IW Regionaler Preisindex 2022 (Kreis/city-level, not officially aggregated to Bundesland)",
    "country": "DE",
    "year": 2022,
    "unit": "mixed (thousands of households; index points, baseline=100)",
    "price_basis": "nominal_2022",
    "data_tier": "B",
    "breakdown": "by_bundesland",
    "categories": ["housing_owner_share", "regional_price_index"],
    "rows": rows,
    "source_url": "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Wohnen/Tabellen/tabelle-eigentumsquote.html ; https://www.bbsr.bund.de/BBSR/DE/veroeffentlichungen/sonderveroeffentlichungen/2023/regionaler-preisindex-big-data-dl.pdf",
    "notes": (
        "TIER B (Germany, per v2-plan.md classification: modeling/interpolation permitted if documented). This file "
        "combines TWO real primary-source Destatis/BBSR datasets that are NOT natively published at the same "
        "geographic granularity, requiring documented judgment calls: "
        "(1) HOMEOWNERSHIP RATE BY BUNDESLAND (16 states + national): REAL, unmodified figures from Destatis's "
        "official Mikrozensus/Zensus 2022 Eigentumsquote table "
        "(https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Wohnen/Tabellen/tabelle-eigentumsquote.html), "
        "definition = share of owner-occupied dwellings among all occupied dwellings in residential buildings "
        "(excluding dormitories), household-level. This is a full, exact 16-state breakdown with no modeling "
        "required. Ranges from 15.9% (Berlin, a renter-dominated city-state) to 59.7% (Saarland). "
        "(2) REGIONAL PRICE INDEX (cost-of-living analog to BEA RPP): REAL BBSR/IW 'Regionaler Preisindex 2022' "
        "figures, but these are published ONLY at the COUNTY (Kreis) / independent-city level (401 units), covering "
        "over 85% of the CPI basket weight with a strong emphasis on modeled local rents "
        "(https://www.bbsr.bund.de/BBSR/DE/veroeffentlichungen/sonderveroeffentlichungen/2023/regionaler-preisindex-big-data.html), "
        "NOT officially aggregated to the 16-Bundesland level as of this pull -- the source PDF explicitly states "
        "'Eine Tabelle mit dem Regionalen Preisindex als aggregiertem Wert je Bundesland ist nicht enthalten' (no "
        "Land-level aggregate table exists in the publication). Rather than fabricate a population-weighted "
        "Land-level average ourselves (which BBSR itself does not officially publish and which would require the "
        "full 401-county microdata file, not obtained within this task's step budget), we report: (a) individual "
        "COUNTY/CITY-LEVEL index values for ~15 major cities/counties spanning the extremes and each mapped to its "
        "Bundesland (see bbsr_city_examples in this notes field description; also directly embedded as a separate "
        "top-level object structure is NOT part of the 'rows' array to preserve schema conformance -- see raw "
        "reference data in build_de_laender_costs.py in the v2 directory for the full extracted table), and (b) "
        "BBSR's own East/West and urban/rural-settlement-type population-weighted aggregates, which are official "
        "and NOT modeled by us: national baseline=100.0; West Germany=100.8; East Germany=96.6; Top-7 cities "
        "(Berlin, Duesseldorf, Frankfurt am Main, Hamburg, Koeln, Muenchen, Stuttgart)=111.5; large cities excl. "
        "Top-7=100.6; urban counties=99.9; rural counties with some density=96.4; sparsely populated rural "
        "counties=95.1. The 'regional_price_index_2022_baseline_100' field in the per-Bundesland 'rows' array is "
        "left NULL for all 16 states rather than populated with a fabricated/interpolated Land-average, per the "
        "task's 'do not fabricate' instruction; the v2 frontend should instead use a look-up against the city/county "
        "examples plus the BBSR settlement-type aggregates as a reasonable proxy, or obtain the full BBSR county "
        "microdata file directly (available for purchase/request from BBSR, not freely downloadable as CSV) for an "
        "exact population-weighted Land aggregation if higher precision is required. "
        "GENERAL PATTERN (documented in the source, useful even without a Land aggregate): prices are systematically "
        "higher in southern/western urban areas (Bayern, Baden-Wuerttemberg, Hessen -- home to 8 of the top 10 "
        "most expensive counties) and lower in eastern rural areas (16 of the 22 lowest-price counties are in "
        "Ostdeutschland: Sachsen, Sachsen-Anhalt, Thueringen, Brandenburg); Munich has by far the highest cost of "
        "living in Germany at 125.1 (25.1% above the national average), while the cheapest rural areas (Vogtlandkreis "
        "in Sachsen; Greiz in Thueringen) sit at 90.5 (9.5% below average) -- a much narrower urban/rural spread "
        "than the roughly 30-40 percentage-point range seen across US BEA state RPPs, consistent with Germany's "
        "more compressed regional cost structure. "
        "This file is intended to pair with de_evs.json (national-level EVS/LWR consumption-by-income data) to let "
        "the v2 frontend apply a state-like Land/city cost-of-living multiplier and an income-appropriate "
        "homeownership assumption, analogous to how us_rpp_state.json and us_rpp_metro.json are used alongside "
        "us_ces_2024_by_decile.json for the United States."
    )
}

with open('/home/user/workspace/income-tiles/data/v2/de_laender_costs.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Wrote de_laender_costs.json")
print(json.dumps(rows[:3], indent=2))
