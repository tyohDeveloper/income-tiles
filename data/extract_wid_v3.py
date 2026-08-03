#!/usr/bin/env python3
"""
WID v3 extraction script.
Builds:
  A.1 - wid_che.json, wid_nor.json, wid_swe.json, wid_fin.json (+ split pretax/posttax files)
  A.2 - data/v3/wid_toptail_thresholds.json (p99.99, p99.999 thresholds, 8 countries)
  A.3 - data/v3/wid_top_shares.json (top shares 2000-2024, 8 countries)

Source: WID bulk download (https://wid.world/bulk_download/wid_all_data.zip), per-country CSVs
extracted to /tmp/wid_extract/WID_data_<ISO2>.csv

Variable naming convention (confirmed against existing wid_deu.json):
  <prefix><concept>j992  where prefix: a=average, t=threshold, s=share, g=gini
  concept: ptinc = pretax national income, diinc = post-tax disposable (national) income
  pop suffix 992 = equal-split adults (j992)
  percentile codes: threshold/share use "pXpY" format; for a simple percentile X,
    the threshold-at-X and share-of-top-(100-X)% both use code "pXp100"
"""
import csv
import json
import sys
from collections import defaultdict

RAW_DIR = "/tmp/wid_extract"
OUT_DIR = "/home/user/workspace/income-tiles/data"
V3_DIR = "/home/user/workspace/income-tiles/data/v3"

# ISO2 -> (ISO3, country name, output basename)
COUNTRIES = {
    "CH": ("CHE", "Switzerland", "che"),
    "NO": ("NOR", "Norway", "nor"),
    "SE": ("SWE", "Sweden", "swe"),
    "FI": ("FIN", "Finland", "fin"),
}

# All 8 v3 countries for A.2/A.3 (iso2 -> iso3 for output keys)
ALL8 = {
    "US": "US", "DE": "DE", "GB": "UK", "NO": "NO", "SE": "SE",
    "FI": "FI", "CH": "CH", "JP": "JP",
}
# map iso2 -> csv filename iso2 (already same) and to existing wid_xxx.json basenames
EXISTING_BASENAME = {
    "US": "us", "DE": "deu", "GB": "gbr", "JP": "jpn",
}

PCT_LABELS = {
    "p10": "p10", "p20": "p20", "p40": "p40", "p50": "p50", "p60": "p60",
    "p80": "p80", "p90": "p90", "p95": "p95", "p98": "p98", "p99": "p99",
    "p99.5": "p99_5", "p99.9": "p99_9",
}
SHARE_LABELS = [
    ("p90", "top10_share"),
    ("p95", "top5_share"),
    ("p99", "top1_share"),
    ("p99.9", "top0_1_share"),
]
# extended shares for A.3
SHARE_LABELS_EXT = [
    ("p90", "top10_share"),
    ("p95", "top5_share"),
    ("p98", "top2_share"),
    ("p99", "top1_share"),
    ("p99.5", "top05_share"),
    ("p99.9", "top01_share"),
    ("p99.99", "top001_share"),
    ("p99.999", "top0001_share"),
]


def load_country_csv(iso2):
    """Load relevant rows into dict: (variable, percentile, year) -> value"""
    path = f"{RAW_DIR}/WID_data_{iso2}.csv"
    data = defaultdict(dict)  # variable -> {(percentile, year): value}
    wanted_prefixes = ("aptincj992", "tptincj992", "sptincj992", "gptincj992",
                        "adiincj992", "tdiincj992", "sdiincj992", "gdiincj992")
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        for row in reader:
            if len(row) < 5:
                continue
            _country, variable, percentile, year, value = row[0], row[1], row[2], row[3], row[4]
            if variable not in wanted_prefixes:
                continue
            try:
                year_i = int(year)
            except ValueError:
                continue
            try:
                value_f = float(value)
            except ValueError:
                continue
            data[variable][(percentile, year_i)] = value_f
    return data


def build_dataset_years(data, concept, year_range):
    """concept: 'ptinc' or 'diinc'. Returns list of year dicts matching wid_deu.json schema."""
    a = data.get(f"a{concept}j992", {})
    t = data.get(f"t{concept}j992", {})
    s = data.get(f"s{concept}j992", {})
    g = data.get(f"g{concept}j992", {})

    years_out = []
    for year in year_range:
        mean = a.get(("p0p100", year))
        if mean is None:
            continue  # skip years with no data at all
        median = t.get(("p50p100", year))
        gini = g.get(("p0p100", year))

        percentiles = {}
        for pcode, pkey in PCT_LABELS.items():
            v = t.get((f"{pcode}p100", year))
            if v is not None:
                percentiles[pkey] = v

        top_shares = {}
        for pcode, skey in SHARE_LABELS:
            v = s.get((f"{pcode}p100", year))
            if v is not None:
                top_shares[skey] = v

        years_out.append({
            "year": year,
            "mean": mean,
            "median": median,
            "gini": gini,
            "percentiles": percentiles if percentiles else None,
            "top_shares": top_shares if top_shares else None,
            "sd_log_income": None,
        })
    return years_out


def main():
    year_range = range(1980, 2025)

    # ---------- A.1 ----------
    for iso2, (iso3, name, base) in COUNTRIES.items():
        print(f"Processing A.1: {name} ({iso2})...")
        data = load_country_csv(iso2)
        pretax_years = build_dataset_years(data, "ptinc", year_range)
        posttax_years = build_dataset_years(data, "diinc", year_range)

        combined = {
            "source": "WID",
            "geography": iso3,
            "unit": "equal_split_adult",
            "source_url": f"https://wid.world/country/{name.lower()}/",
            "datasets": [
                {"income_definition": "pretax_national", "years": pretax_years},
                {"income_definition": "posttax_national", "years": posttax_years},
            ],
        }
        with open(f"{OUT_DIR}/wid_{base}.json", "w") as f:
            json.dump(combined, f, indent=2)

        pretax_only = {
            "source": "WID", "geography": iso3, "unit": "equal_split_adult",
            "source_url": f"https://wid.world/country/{name.lower()}/",
            "income_definition": "pretax_national",
            "years": pretax_years,
        }
        with open(f"{OUT_DIR}/wid_{base}_pretax_national.json", "w") as f:
            json.dump(pretax_only, f, indent=2)

        posttax_only = {
            "source": "WID", "geography": iso3, "unit": "equal_split_adult",
            "source_url": f"https://wid.world/country/{name.lower()}/",
            "income_definition": "posttax_national",
            "years": posttax_years,
        }
        with open(f"{OUT_DIR}/wid_{base}_posttax_national.json", "w") as f:
            json.dump(posttax_only, f, indent=2)

        print(f"  pretax years: {len(pretax_years)}, posttax years: {len(posttax_years)}")

    # ---------- A.2: top-tail thresholds (p99.99, p99.999), all 8 countries ----------
    print("Processing A.2: top-tail thresholds...")
    toptail = {
        "source": "WID",
        "extracted": "2026-08-03",
        "source_url": "https://wid.world/data/",
        "unit": "equal_split_adult, local currency, current prices",
        "notes": "p99_99 = threshold for top 0.01% (p99.99p100); p99_999 = threshold for top 0.001% (p99.999p100). income_definition = pretax_national (ptinc). Where WID does not publish an extended series for a country/year, value is null and a 'not_published' flag is set at the country level if NO years have data.",
        "countries": {},
    }
    for iso2, out_key in ALL8.items():
        if iso2 in COUNTRIES:
            data = load_country_csv(iso2)
        else:
            data = load_country_csv(iso2)
        t = data.get("tptincj992", {})
        years_list = []
        any_data = False
        for year in year_range:
            p9999 = t.get(("p99.99p100", year))
            p99999 = t.get(("p99.999p100", year))
            if p9999 is not None or p99999 is not None:
                any_data = True
            years_list.append({"year": year, "p99_99": p9999, "p99_999": p99999})
        # trim leading years with fully-null entries for compactness? keep all, but flag
        toptail["countries"][out_key] = {
            "not_published": not any_data,
            "years": [y for y in years_list if y["p99_99"] is not None or y["p99_999"] is not None],
        }
    with open(f"{V3_DIR}/wid_toptail_thresholds.json", "w") as f:
        json.dump(toptail, f, indent=2)

    # ---------- A.3: top shares 2000-2024, all 8 countries ----------
    print("Processing A.3: top shares 2000-2024...")
    top_shares_out = {
        "source": "WID",
        "extracted": "2026-08-03",
        "source_url": "https://wid.world/data/",
        "income_definition": "pretax_national",
        "unit": "share of total pretax national income (equal-split adults)",
        "notes": "top10_share=p90p100, top5_share=p95p100, top2_share=p98p100, top1_share=p99p100, top05_share=p99.5p100, top01_share=p99.9p100, top001_share=p99.99p100, top0001_share=p99.999p100. This partially duplicates wid_<country>.json top_shares fields (which only go to top0_1_share) -- this file adds top2/top05/top001/top0001 and is intended as the single reference for band math.",
        "countries": {},
    }
    for iso2, out_key in ALL8.items():
        data = load_country_csv(iso2)
        s = data.get("sptincj992", {})
        years_list = []
        for year in range(2000, 2025):
            row = {"year": year}
            has_any = False
            for pcode, skey in SHARE_LABELS_EXT:
                v = s.get((f"{pcode}p100", year))
                row[skey] = v
                if v is not None:
                    has_any = True
            if has_any:
                years_list.append(row)
        top_shares_out["countries"][out_key] = {"years": years_list}
    with open(f"{V3_DIR}/wid_top_shares.json", "w") as f:
        json.dump(top_shares_out, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
