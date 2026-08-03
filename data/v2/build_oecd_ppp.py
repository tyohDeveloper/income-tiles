import csv, json

RAW = "/home/user/workspace/income-tiles/data/v2/raw/oecd_table4_all.csv"

COUNTRY_MAP = {
    "USA": "US", "DEU": "DE", "GBR": "UK", "NOR": "NO",
    "SWE": "SE", "FIN": "FI", "CHE": "CH", "JPN": "JP",
}

with open(RAW) as f:
    reader = csv.reader(f)
    header = next(reader)
    rows = [dict(zip(header, r)) for r in reader if len(r) == len(header)]

# transaction codes: PPP_P31S14 = PPP for household final consumption expenditure (private consumption)
#                     PPP_P41    = PPP for actual individual consumption (AIC)
data = {}
for r in rows:
    iso3 = r["REF_AREA"]
    if iso3 not in COUNTRY_MAP:
        continue
    code = COUNTRY_MAP[iso3]
    year = r["TIME_PERIOD"]
    txn = r["TRANSACTION"]
    val = r["OBS_VALUE"]
    try:
        val = float(val)
    except ValueError:
        continue
    data.setdefault(code, {}).setdefault(year, {})[txn] = val

years_available = ["2020", "2021", "2022", "2023"]

country_rows = []
for iso3, code in COUNTRY_MAP.items():
    entry = {
        "country": code,
        "country_iso3": iso3,
    }
    for y in years_available:
        yd = data.get(code, {}).get(y, {})
        entry[f"ppp_private_consumption_{y}"] = yd.get("PPP_P31S14")
        entry[f"ppp_actual_individual_consumption_{y}"] = yd.get("PPP_P41")
    country_rows.append(entry)

# order: US first, then alphabetical by code
country_rows.sort(key=lambda r: (r["country"] != "US", r["country"]))

out = {
    "source": "OECD Annual National Accounts - Purchasing Power Parities and exchange rates (Table 4)",
    "country": "multiple",
    "year": 2023,
    "unit": "local_currency_per_usd",
    "price_basis": "nominal_2023",
    "data_tier": "A",
    "breakdown": "by_country",
    "categories": ["ppp_private_consumption", "ppp_actual_individual_consumption"],
    "rows": country_rows,
    "source_url": "https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAMAIN10@DF_TABLE4,1.0/A.USA+DEU+GBR+NOR+SWE+FIN+CHE+JPN...........?startPeriod=2020&endPeriod=2024&dimensionAtObservation=AllDimensions&format=csvfilewithlabels",
    "notes": (
        "PRIMARY SOURCE: OECD SDMX API, dataflow OECD.SDD.NAD:DSD_NAMAIN10@DF_TABLE4 ('Annual Purchasing Power "
        "Parities and exchange rates', formerly OECD.Stat SNA_TABLE4), fetched directly via curl (no API key "
        "required; full URL in source_url). This supersedes the older DSD_PPP@DF_PPP dataflow (OECD.SDD.TPS), "
        "which only carries data through 2021 under the deprecated COICOP-1999-aligned PPP classification; per "
        "OECD's own documentation, 2022-onward PPPs use the current COICOP-2018-aligned classification and are "
        "published exclusively through the Table 4 / Data Explorer route used here. "
        "LATEST AVAILABLE VINTAGE IS 2023, NOT 2024: as of this data pull, OECD had not yet published a 2024 "
        "'first estimate' for PPP (per OECD's own release calendar, first 2024 GDP-PPP estimates are due in "
        "a subsequent update; full detailed-category updates including household consumption follow later). "
        "2023 is itself flagged 'preliminary' by OECD (2022 is 'quasi-final', up to 2021 is 'final') and is "
        "subject to future revision. All four available years (2020-2023) are included per country as suffixed "
        "fields for trend context, matching the task's 'ideally also 2023 vintage' request -- 2023 IS the "
        "requested latest/current vintage here, not a fallback. "
        "TWO PPP SERIES ARE PROVIDED per OECD Table 4: 'ppp_private_consumption' = OECD transaction code "
        "PPP_P31S14, 'Purchasing Power Parities for household final consumption expenditure' -- this is the "
        "series the task calls for ('OECD PPP for private consumption'). 'ppp_actual_individual_consumption' = "
        "OECD transaction code PPP_P41, 'Purchasing Power Parities for actual individual consumption' (AIC) -- "
        "included as a secondary/alternative series since AIC PPPs are what many cross-country living-standards "
        "comparisons (e.g. OECD Better Life Index, Eurostat) actually use, as AIC nets out cross-country "
        "differences in how government-provided in-kind services (health, education) are organized, which "
        "household-only consumption PPPs do not. The v2 frontend should default to ppp_private_consumption per "
        "the task spec but ppp_actual_individual_consumption is available if a more government-neutral comparison "
        "is desired. "
        "UNITS: both series are in 'national currency per US dollar' (XDC_USD in OECD's own unit code) -- e.g. "
        "Japan's ppp_private_consumption_2023 of 104.84 means 104.84 yen has the same purchasing power domestically "
        "as 1 US dollar has in the US, which is NOT the same as the market exchange rate. "
        "US=1.0 BASELINE: the United States row has ppp_*_2020 through ppp_*_2023 all equal to 1.0 for both series "
        "by construction (OECD Table 4 PPPs are expressed in national-currency-per-USD terms with the US as the "
        "numeraire), directly satisfying the task's 'US=1.0 baseline' requirement without any additional "
        "normalization needed. "
        "COUNTRY CODE MAPPING: task's 'UK' <- OECD/ISO GBR (United Kingdom); 'Norway' <- NOR; 'Sweden' <- SWE; "
        "'Finland' <- FIN; 'Switzerland' <- CHE; 'Japan' <- JPN; 'DE' <- DEU (Germany); 'US' <- USA. "
        "This file intentionally keeps values in LOCAL CURRENCY PER USD (not USD-converted amounts) per the task's "
        "'For each country's non-USD currency data, keep it in local currency' instruction -- the frontend applies "
        "PPP conversion at display time using these raw exchange-rate-like factors."
    ),
}

with open("/home/user/workspace/income-tiles/data/v2/oecd_ppp.json", "w") as f:
    json.dump(out, f, indent=2)

print("Wrote oecd_ppp.json with", len(country_rows), "country rows")
for r in country_rows:
    print(r["country"], r.get("ppp_private_consumption_2023"), r.get("ppp_actual_individual_consumption_2023"))
