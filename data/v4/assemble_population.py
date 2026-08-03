#!/usr/bin/env python3
"""Assemble population_by_year.json from cached World Bank per-country JSON responses in /tmp/wb_pop/."""
import json

COUNTRIES = {
    "US": "USA", "DE": "DEU", "UK": "GBR", "NO": "NOR",
    "SE": "SWE", "FI": "FIN", "CH": "CHE", "JP": "JPN",
}

result = {
    "as_of": "2026-08-03",
    "source": "World Bank Indicators API - SP.POP.TOTL (Population, total)",
    "source_url": "https://api.worldbank.org/v2/country/{cc}/indicator/SP.POP.TOTL",
    "unit": "persons",
    "coverage": "1980-2024",
    "countries": {}
}

for code, iso3 in COUNTRIES.items():
    with open(f"/tmp/wb_pop/{code}.json") as f:
        data = json.load(f)
    rows = data[1]
    by_year = {}
    for r in rows:
        yr = r.get("date")
        val = r.get("value")
        if yr is not None and val is not None:
            by_year[yr] = int(val)
    by_year_sorted = {str(y): by_year[str(y)] for y in sorted(int(y) for y in by_year)}
    result["countries"][code] = {
        "iso3": iso3,
        "country_name": rows[0]["country"]["value"] if rows else None,
        "population_by_year": by_year_sorted,
        "min_year_available": min(int(y) for y in by_year) if by_year else None,
        "max_year_available": max(int(y) for y in by_year) if by_year else None,
    }
    print(code, iso3, "years:", len(by_year),
          "latest:", by_year_sorted.get("2024"))

with open("/home/user/workspace/income-tiles/data/v4/population_by_year.json", "w") as f:
    json.dump(result, f, indent=2)

print("Saved population_by_year.json")
