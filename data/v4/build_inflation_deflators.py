#!/usr/bin/env python3
"""
A.3 - Inflation deflators 1980-2024, base year 2023 = 100.
Sources:
  US_PCE   - BEA Personal Consumption Expenditures Price Index (FRED series PCEPI, mirrors BEA NIPA Table 2.3.4),
             December observations, Index 2017=100 -> https://fred.stlouisfed.org/data/PCEPI
  US_CPI_U - BLS CPI-U, series CUUR0000SA0, annual average, Index 1982-84=100
             -> https://www.minneapolisfed.org/about-us/monetary-policy/inflation-calculator/consumer-price-index-1913-
             (BLS-sourced annual averages, cross-checked against BLS regional office annual/semiannual table)
  {CC}_HICP - OECD Consumer Price Indices (CPIs, HICPs) database, annual, all items, national CPI series
             used as the comparability proxy for "OECD HICP" per spec (OECD's SDMX API; COICOP2018 dataflow used
             where available [CH, NO, SE, FI, JP], COICOP1999 dataflow used for DE, UK which lack COICOP2018 rows)
             -> https://data.oecd.org/price/inflation-cpi.htm ; https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,...

All series rebased so base_year (2023) = 100, covering 1980-2024 (or as far back as published, if later than 1980).
"""
import csv
import json
from collections import defaultdict

BASE_YEAR = 2023

def rebase(values_by_year, base_year=BASE_YEAR):
    """values_by_year: {year(int): raw_index_value}. Returns {year(str): rebased_value} with base_year=100."""
    base_val = values_by_year.get(base_year)
    if base_val is None:
        # fall back to nearest year if exact base missing
        raise RuntimeError(f"No value for base year {base_year}")
    return {str(y): round(v / base_val * 100, 4) for y, v in sorted(values_by_year.items())}


# ---------- US PCE (from FRED PCEPI December observations, 2017=100) ----------
US_PCE_DEC = {
    1980: 40.621, 1981: 43.594, 1982: 45.693, 1983: 47.358, 1984: 49.081,
    1985: 50.850, 1986: 51.651, 1987: 53.620, 1988: 55.928, 1989: 58.113,
    1990: 60.945, 1991: 62.553, 1992: 64.176, 1993: 65.582, 1994: 66.991,
    1995: 68.300, 1996: 69.914, 1997: 70.701, 1998: 71.298, 1999: 72.763,
    2000: 74.571, 2001: 75.363, 2002: 76.971, 2003: 78.605, 2004: 80.801,
    2005: 83.131, 2006: 85.032, 2007: 87.984, 2008: 88.098, 2009: 89.939,
    2010: 91.268, 2011: 93.574, 2012: 95.094, 2013: 96.414, 2014: 97.120,
    2015: 97.456, 2016: 99.071, 2017: 100.821, 2018: 102.701, 2019: 104.307,
    2020: 105.699, 2021: 112.191, 2022: 118.384, 2023: 121.660, 2024: 124.979,
}

# ---------- US CPI-U (annual average, 1982-84=100), Minneapolis Fed / BLS ----------
US_CPI_U_ANNUAL = {
    1980: 82.4, 1981: 90.9, 1982: 96.5, 1983: 99.6, 1984: 103.9,
    1985: 107.6, 1986: 109.6, 1987: 113.6, 1988: 118.3, 1989: 124.0,
    1990: 130.7, 1991: 136.2, 1992: 140.3, 1993: 144.5, 1994: 148.2,
    1995: 152.4, 1996: 156.9, 1997: 160.5, 1998: 163.0, 1999: 166.6,
    2000: 172.2, 2001: 177.1, 2002: 179.9, 2003: 184.0, 2004: 188.9,
    2005: 195.3, 2006: 201.6, 2007: 207.3, 2008: 215.3, 2009: 214.5,
    2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0, 2014: 236.7,
    2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1, 2019: 255.7,
    2020: 258.8, 2021: 271.0, 2022: 292.7, 2023: 304.7, 2024: 313.7,
}

# ---------- Japan CPI (2020=100), from rateinflation.com / stat.go.jp ----------
JP_CPI_ANNUAL_2020BASE = {
    1980: 73.1, 1981: 76.8, 1982: 78.9, 1983: 80.3, 1984: 82.2,
    1985: 83.8, 1986: 84.3, 1987: 84.5, 1988: 85.0, 1989: 87.0,
    1990: 89.6, 1991: 92.6, 1992: 94.2, 1993: 95.3, 1994: 96.0,
    1995: 95.9, 1996: 96.0, 1997: 97.7, 1998: 98.3, 1999: 98.0,
    2000: 97.3, 2001: 96.6, 2002: 95.8, 2003: 95.5, 2004: 95.5,
    2005: 95.2, 2006: 95.5, 2007: 95.5, 2008: 96.8, 2009: 95.5,
    2010: 94.8, 2011: 94.6, 2012: 94.5, 2013: 94.8, 2014: 97.5,
    2015: 98.2, 2016: 98.1, 2017: 98.6, 2018: 99.6, 2019: 100.0,
    2020: 100.0, 2021: 99.8, 2022: 102.3, 2023: 105.6, 2024: 108.5,
}


def load_oecd_csv(path):
    """Returns {ref_area: {year(int): value(float)}}"""
    data = defaultdict(dict)
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            area = row["REF_AREA"]
            try:
                yr = int(row["TIME_PERIOD"])
                val = float(row["OBS_VALUE"])
            except (ValueError, TypeError):
                continue
            data[area][yr] = val
    return data


def main():
    result = {
        "as_of": "2026-08-03",
        "base_year": BASE_YEAR,
        "note": "All series rebased so base_year (2023) = 100. Values before rebasing are index numbers on each source's own native base (documented per-series below); the rebase only rescales, does not alter underlying growth rates.",
        "series": {}
    }

    # --- US PCE ---
    result["series"]["US_PCE"] = {
        "source": "BEA Personal Consumption Expenditures Price Index (mirrored on FRED as PCEPI)",
        "source_url": "https://www.bea.gov/data/personal-consumption-expenditures-price-index",
        "native_base": "2017=100 (December observations used as annual proxy)",
        "base_year": BASE_YEAR,
        "coverage": "1980-2024",
        "values": rebase(US_PCE_DEC),
    }

    # --- US CPI-U ---
    result["series"]["US_CPI_U"] = {
        "source": "BLS CPI-U, series CUUR0000SA0, annual average",
        "source_url": "https://www.bls.gov/cpi/",
        "native_base": "1982-84=100",
        "base_year": BASE_YEAR,
        "coverage": "1980-2024",
        "values": rebase(US_CPI_U_ANNUAL),
    }

    # --- OECD HICP-proxy series for DE, UK, NO, SE, FI, CH, JP ---
    coicop2018 = load_oecd_csv("/tmp/oecd_cpi_new_all.csv")  # CH, NO, SE, FI, JP
    coicop1999 = load_oecd_csv("/tmp/oecd_cpi_all.csv")      # DE, UK (+others, older series)

    country_map = {
        "DE": ("DEU", coicop1999, "COICOP1999"),
        "UK": ("GBR", coicop1999, "COICOP1999"),
        "NO": ("NOR", coicop2018, "COICOP2018"),
        "SE": ("SWE", coicop2018, "COICOP2018"),
        "FI": ("FIN", coicop2018, "COICOP2018"),
        "CH": ("CHE", coicop2018, "COICOP2018"),
        "JP": ("JPN", coicop2018, "COICOP2018"),
    }

    for cc, (iso3, dataset, series_name) in country_map.items():
        by_year = {y: v for y, v in dataset[iso3].items() if 1980 <= y <= 2024}
        if 2023 not in by_year:
            print(f"WARNING: {cc} missing 2023 in OECD series - skipping/needs fallback")
            continue
        min_y, max_y = min(by_year), max(by_year)
        result["series"][f"{cc}_HICP"] = {
            "source": f"OECD Consumer Price Indices (CPIs, HICPs) database, {series_name} dataflow, national CPI all-items series (used as comparability proxy for 'OECD HICP' per spec; Japan HICP is not published by Eurostat since HICP is EU/EEA-specific, so Japan's national CPI all-items index serves this role)",
            "source_url": "https://data.oecd.org/price/inflation-cpi.htm",
            "native_base": "2015=100 (OECD SDMX default rebase point for this dataflow)",
            "base_year": BASE_YEAR,
            "coverage": f"{min_y}-{max_y}",
            "values": rebase(by_year),
        }
        print(cc, series_name, "years:", min_y, "-", max_y, "n=", len(by_year))

    with open("/home/user/workspace/income-tiles/data/v4/inflation_deflators.json", "w") as f:
        json.dump(result, f, indent=2)
    print("\nSaved inflation_deflators.json")


if __name__ == "__main__":
    main()
