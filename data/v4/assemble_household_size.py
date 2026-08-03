#!/usr/bin/env python3
import json

with open("/home/user/workspace/income-tiles/data/v4/_household_size_us_partial.json") as f:
    us = json.load(f)
with open("/home/user/workspace/income-tiles/data/v4/_household_size_intl_partial.json") as f:
    intl = json.load(f)

result = {
    "as_of": "2026-08-03",
    "countries": {
        "US": {
            "source": us["source"],
            "source_url": us["source_url"],
            "year": us["income_year"],
            "data_tier": "A",
            "method": us["method"],
            "deciles": us["deciles"],
        }
    }
}

intl_source_meta = {
    "DE": {"source": "Eurostat ilc_lvph01 (Average household size, national avg 2024) shape-modeled across income deciles",
           "source_url": "https://ec.europa.eu/eurostat/databrowser/view/ilc_lvph01/default/table", "year": 2024},
    "UK": {"source": "ONS Family Spending / Living Costs and Food Survey (decile shape anchor D1=1.3, D10=3.3) + ONS Families and households in the UK 2024 (national avg 2.35) rescale",
           "source_url": "https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/compendium/familyspending/2015/chapter3equivalisedincome", "year": 2024},
    "NO": {"source": "Eurostat ilc_lvph01 (Average household size, national avg 2024) shape-modeled across income deciles",
           "source_url": "https://ec.europa.eu/eurostat/databrowser/view/ilc_lvph01/default/table", "year": 2024},
    "SE": {"source": "Eurostat ilc_lvph01 (Average household size, national avg 2024) shape-modeled across income deciles",
           "source_url": "https://ec.europa.eu/eurostat/databrowser/view/ilc_lvph01/default/table", "year": 2024},
    "FI": {"source": "Eurostat ilc_lvph01 (Average household size, national avg 2024) shape-modeled across income deciles",
           "source_url": "https://ec.europa.eu/eurostat/databrowser/view/ilc_lvph01/default/table", "year": 2024},
    "CH": {"source": "Eurostat ilc_lvph01 (Average household size, national avg 2024) shape-modeled across income deciles",
           "source_url": "https://ec.europa.eu/eurostat/databrowser/view/ilc_lvph01/default/table", "year": 2024},
    "JP": {"source": "Japan MIC / Statistics Bureau household survey (national avg ~2.21, 2024) shape-modeled across income deciles",
           "source_url": "https://www.nippon.com/en/japan-data/h02059/", "year": 2024},
}

method_note = ("Modeled (Tier C): OECD Family Database SF1.1 publishes household size by household TYPE, "
               "not by income decile, and Eurostat SILC does not publish a cross-country household-size-by-income-decile "
               "table. We use the UK's own published decile-level shape (ONS Family Spending / Living Costs and Food "
               "Survey: D1=1.3 people, D10=3.3 people, ratio 2.538x) combined with the empirically observed convex "
               "decile-shape from US Census HINC-01 (income-bracket-weighted mean household size) as the normalized "
               "cross-country curve shape, rescaled per country so its decile average matches that country's own "
               "published national average household size (Eurostat ilc_lvph01 2024 for DE/NO/SE/FI/CH; ONS 2024 for UK; "
               "Japan national statistics for JP). See build_household_size_intl.py for full methodology and rationale.")

for cc, deciles in intl["deciles_by_country"].items():
    meta = intl_source_meta[cc]
    result["countries"][cc] = {
        "source": meta["source"],
        "source_url": meta["source_url"],
        "year": meta["year"],
        "data_tier": "C",
        "method": method_note,
        "national_avg_household_size_anchor": intl["national_avg_source"][cc],
        "deciles": deciles,
    }

with open("/home/user/workspace/income-tiles/data/v4/household_size_by_decile.json", "w") as f:
    json.dump(result, f, indent=2)

print("Saved household_size_by_decile.json with countries:", list(result["countries"].keys()))
