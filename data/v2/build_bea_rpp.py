import csv, json, re

RAW = "/home/user/workspace/income-tiles/data/v2/raw"

LINE_LABELS = {
    "1": "all_items",
    "2": "goods",
    "3": "services_housing_rents",
    "4": "services_utilities",
    "5": "services_other",
}

STATE_ABBR = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
    "Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA",
    "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY",
    "Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
    "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH",
    "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",
    "Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI",
    "South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
    "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
}

def read_rpp(path, year="2023"):
    """Return dict geoname -> {linecode_label: value}"""
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        year_idx = header.index(year)
        for row in reader:
            if len(row) < len(header):
                continue
            geoname = row[1].strip().strip('"')
            linecode = row[4].strip()
            label = LINE_LABELS.get(linecode)
            if label is None:
                continue
            val_raw = row[year_idx].strip()
            try:
                val = float(val_raw)
            except ValueError:
                val = None
            out.setdefault(geoname, {})[label] = val
    return out

# ---------- STATE ----------
state_data_2023 = read_rpp(f"{RAW}/SARPP/SARPP_STATE_2008_2024.csv", "2023")
state_data_2024 = read_rpp(f"{RAW}/SARPP/SARPP_STATE_2008_2024.csv", "2024")

state_rows = []
for geoname, vals2024 in state_data_2024.items():
    if geoname == "United States":
        abbr = "US"
    else:
        # geoname like "Alabama" or "District of Columbia"
        name_clean = geoname.replace(" *", "").strip()
        abbr = STATE_ABBR.get(name_clean)
        if abbr is None:
            continue
    vals2023 = state_data_2023.get(geoname, {})
    state_rows.append({
        "geo": abbr,
        "geo_name": geoname.replace(" *", "").strip(),
        "rpp_all_items_2024": vals2024.get("all_items"),
        "rpp_goods_2024": vals2024.get("goods"),
        "rpp_services_housing_rents_2024": vals2024.get("services_housing_rents"),
        "rpp_services_utilities_2024": vals2024.get("services_utilities"),
        "rpp_services_other_2024": vals2024.get("services_other"),
        "rpp_all_items_2023": vals2023.get("all_items"),
        "rpp_goods_2023": vals2023.get("goods"),
        "rpp_services_housing_rents_2023": vals2023.get("services_housing_rents"),
        "rpp_services_utilities_2023": vals2023.get("services_utilities"),
        "rpp_services_other_2023": vals2023.get("services_other"),
    })

# Sort: US first, then states alphabetically by name
state_rows.sort(key=lambda r: (r["geo"] != "US", r["geo_name"]))

state_out = {
    "source": "BEA Regional Price Parities",
    "country": "US",
    "year": 2024,
    "unit": "index_us_avg_100",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_state",
    "categories": ["all_items", "goods", "services_housing_rents", "services_utilities", "services_other"],
    "rows": state_rows,
    "source_url": "https://apps.bea.gov/regional/zip/SARPP.zip",
    "notes": (
        "Downloaded directly via BEA's public regional-data ZIP endpoint (no API key required): "
        "https://apps.bea.gov/regional/zip/SARPP.zip (table SARPP, 'Regional price parities by state', "
        "covering 2008-2024). This is a full, un-truncated primary-source CSV (BEA does not block direct "
        "curl/wget downloads of these bulk ZIP files, unlike BLS's xlsx endpoints). "
        "RPPs are an INDEX where the U.S. national average = 100 for every year (not a dollar amount); "
        "a state RPP of 110 means prices there average 10% above the U.S. average that year. "
        "LINE CODE MAPPING (BEA's own SARPP table definitions): LineCode 1 = 'All items' (all_items); "
        "LineCode 2 = 'Goods' (durable+nondurable consumption goods: apparel, education, food, housing, "
        "medical, recreation, transportation, other goods) (goods); LineCode 3 = 'Services: Housing' -- "
        "BEA states this line is estimated ONLY for tenant-occupied housing rents plus an imputed rental "
        "value for owner-occupied housing, i.e. this is effectively a RENTS index, not an owner cash-outlay "
        "index (services_housing_rents); LineCode 4 = 'Services: Utilities' (water/sanitation + electricity/gas) "
        "(services_utilities); LineCode 5 = 'Services: Other' (all other services except rents: education, "
        "food, medical, recreation, transportation, other) (services_other). "
        "Both 2024 (latest published) and 2023 (prior vintage, per task spec's 'ideally also 2023 vintage' "
        "request) values are included per geography as suffixed fields (_2024 / _2023). "
        "'US' row (geo='US', geo_name='United States') is the national baseline = 100.000 for every year "
        "by construction. Washington DC is included as geo='DC'. "
        "No dollar-denominated cost-of-living figures are available from BEA RPP -- this is purely a relative "
        "price-level index; the v2 frontend must combine this with a dollar anchor (e.g. national mean "
        "expenditure from BLS CES) to derive dollar estimates by state, matching the same limitation "
        "documented for BEA national income data in v1's data/README.md (BEA publishes no dollar thresholds, "
        "shares/indices only)."
    ),
}

with open("/home/user/workspace/income-tiles/data/v2/us_rpp_state.json", "w") as f:
    json.dump(state_out, f, indent=2)
print("Wrote us_rpp_state.json with", len(state_rows), "rows")

# ---------- METRO ----------
metro_data_2023 = read_rpp(f"{RAW}/MARPP/MARPP_MSA_2008_2024.csv", "2023")
metro_data_2024 = read_rpp(f"{RAW}/MARPP/MARPP_MSA_2008_2024.csv", "2024")

TOP_50_MSA_KEYWORDS = [
    "New York-Newark-Jersey City",
    "Los Angeles-Long Beach-Anaheim",
    "Chicago-Naperville-Elgin",
    "Dallas-Fort Worth-Arlington",
    "Houston-",
    "Atlanta-Sandy Springs",
    "Washington-Arlington-Alexandria",
    "Miami-Fort Lauderdale",
    "Philadelphia-Camden-Wilmington",
    "Phoenix-Mesa-Chandler",
    "Boston-Cambridge-Newton",
    "Riverside-San Bernardino-Ontario",
    "San Francisco-Oakland",
    "Detroit-Warren-Dearborn",
    "Seattle-Tacoma-Bellevue",
    "Minneapolis-St. Paul-Bloomington",
    "Tampa-St. Petersburg-Clearwater",
    "San Diego-Chula Vista-Carlsbad",
    "Denver-Aurora-",
    "Orlando-Kissimmee-Sanford",
    "Charlotte-Concord-Gastonia",
    "Baltimore-Columbia-Towson",
    "St. Louis",
    "San Antonio-New Braunfels",
    "Austin-Round Rock",
    "Portland-Vancouver-Hillsboro",
    "Sacramento-Roseville",
    "Pittsburgh",
    "Las Vegas-Henderson",
    "Cincinnati",
    "Kansas City",
    "Columbus, OH",
    "Indianapolis-Carmel",
    "Nashville-Davidson",
    "Cleveland, OH",
    "San Jose-Sunnyvale-Santa Clara",
    "Virginia Beach-Chesapeake-Norfolk",
    "Jacksonville, FL",
    "Providence-Warwick",
    "Raleigh-Cary",
    "Milwaukee-Waukesha",
    "Oklahoma City",
    "Louisville",
    "Richmond, VA",
    "Memphis",
    "Salt Lake City",
    "Fresno",
    "Birmingham",
    "Grand Rapids",
    "Hartford",
]

metro_rows = []
matched_keywords = set()
for geoname, vals2024 in metro_data_2024.items():
    for kw in TOP_50_MSA_KEYWORDS:
        if kw in geoname:
            matched_keywords.add(kw)
            vals2023 = metro_data_2023.get(geoname, {})
            metro_rows.append({
                "geo_name": geoname.strip(),
                "match_keyword": kw,
                "rpp_all_items_2024": vals2024.get("all_items"),
                "rpp_goods_2024": vals2024.get("goods"),
                "rpp_services_housing_rents_2024": vals2024.get("services_housing_rents"),
                "rpp_services_utilities_2024": vals2024.get("services_utilities"),
                "rpp_services_other_2024": vals2024.get("services_other"),
                "rpp_all_items_2023": vals2023.get("all_items"),
                "rpp_goods_2023": vals2023.get("goods"),
                "rpp_services_housing_rents_2023": vals2023.get("services_housing_rents"),
                "rpp_services_utilities_2023": vals2023.get("services_utilities"),
                "rpp_services_other_2023": vals2023.get("services_other"),
            })
            break

missing = [kw for kw in TOP_50_MSA_KEYWORDS if kw not in matched_keywords]

metro_out = {
    "source": "BEA Regional Price Parities",
    "country": "US",
    "year": 2024,
    "unit": "index_us_avg_100",
    "price_basis": "nominal_2024",
    "data_tier": "A",
    "breakdown": "by_metro",
    "categories": ["all_items", "goods", "services_housing_rents", "services_utilities", "services_other"],
    "rows": metro_rows,
    "source_url": "https://apps.bea.gov/regional/zip/MARPP.zip",
    "notes": (
        "Downloaded directly via BEA's public regional-data ZIP endpoint (no API key required): "
        "https://apps.bea.gov/regional/zip/MARPP.zip (table MARPP, 'Regional price parities by MSA', "
        "covering 2008-2024, 376 metro areas total in the raw file). Same index construction and LineCode "
        "mapping as us_rpp_state.json (1=all_items, 2=goods, 3=services_housing_rents [tenant+imputed-owner "
        "rents only, not owner cash outlays], 4=services_utilities, 5=services_other); see that file's notes "
        "for full detail. "
        "METRO SELECTION METHOD: BEA's MARPP file does not include population, so the 'top 50 metros' subset "
        "was selected by matching MSA-name keywords from an independent Census-based 2025 population ranking "
        "(https://statranker.org/population/u-s-metro-areas-by-population-2026-snapshot-based-on-2025-census-estimates/, "
        "itself sourced from Census Bureau July 2025 metro population estimates) against BEA's GeoName field via "
        "substring matching, since BEA's MSA delineations/names in this file may differ slightly in vintage from "
        "the most current Census delineations (OMB periodically revises MSA definitions and BEA lags). "
        f"{'All 50 target metros were successfully matched.' if not missing else 'The following target metros from the population ranking could NOT be matched to a BEA GeoName and are MISSING from this file: ' + '; '.join(missing) + '.'} "
        "'match_keyword' field on each row records which population-ranking search term matched it, for "
        "traceability/debugging -- it is not part of the core schema and can be dropped by the frontend. "
        "No dollar-denominated cost-of-living figures are available from BEA RPP for metros either -- purely a "
        "relative price-level index requiring a dollar anchor from another source to convert to currency terms."
    ),
}

with open("/home/user/workspace/income-tiles/data/v2/us_rpp_metro.json", "w") as f:
    json.dump(metro_out, f, indent=2)
print("Wrote us_rpp_metro.json with", len(metro_rows), "rows; missing:", missing)
