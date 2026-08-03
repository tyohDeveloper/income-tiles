#!/usr/bin/env python3
"""
A.2 - Total population by country per year 1980-2024.
Source: World Bank Indicators API, SP.POP.TOTL
https://api.worldbank.org/v2/country/{cc}/indicator/SP.POP.TOTL
"""
import json
import subprocess

COUNTRIES = {
    "US": "USA", "DE": "DEU", "UK": "GBR", "NO": "NOR",
    "SE": "SWE", "FI": "FIN", "CH": "CHE", "JP": "JPN",
}

def fetch(iso3, retries=4):
    url = f"https://api.worldbank.org/v2/country/{iso3}/indicator/SP.POP.TOTL?format=json&date=1980:2024&per_page=100"
    last_err = None
    for attempt in range(retries):
        try:
            out = subprocess.run(["curl", "-s", "--max-time", "45", url, "-A", "Mozilla/5.0"],
                                  capture_output=True, text=True, timeout=60)
            data = json.loads(out.stdout)
            if not isinstance(data, list) or len(data) < 2 or data[1] is None:
                raise RuntimeError(f"Bad response for {iso3}: {out.stdout[:300]}")
            return data[1]
        except Exception as e:
            last_err = e
            continue
    raise last_err

result = {
    "as_of": "2026-08-03",
    "source": "World Bank Indicators API - SP.POP.TOTL",
    "source_url": "https://api.worldbank.org/v2/country/{cc}/indicator/SP.POP.TOTL",
    "unit": "persons",
    "coverage": "1980-2024",
    "countries": {}
}

for code, iso3 in COUNTRIES.items():
    rows = fetch(iso3)
    by_year = {}
    for r in rows:
        yr = r.get("date")
        val = r.get("value")
        if yr is not None and val is not None:
            by_year[yr] = int(val)
    # sort by year ascending
    by_year_sorted = {str(y): by_year[str(y)] for y in sorted(int(y) for y in by_year)}
    result["countries"][code] = {
        "iso3": iso3,
        "country_name": rows[0]["country"]["value"] if rows else None,
        "population_by_year": by_year_sorted,
        "min_year_available": min(int(y) for y in by_year) if by_year else None,
        "max_year_available": max(int(y) for y in by_year) if by_year else None,
    }
    print(code, iso3, "years:", len(by_year), "range:",
          min(by_year) if by_year else None, max(by_year) if by_year else None,
          "latest_value:", by_year.get(max(by_year, key=int)) if by_year else None)

with open("/home/user/workspace/income-tiles/data/v4/population_by_year.json", "w") as f:
    json.dump(result, f, indent=2)

print("Saved population_by_year.json")
