#!/usr/bin/env python3
"""
A.4 - Verify P25/P75 presence in wid_*.json files. They were missing (percentile keys only
had p10,p20,p40,p50,p60,p80,p90,p95,p98,p99,p99_5,p99_9). Extract p25/p75 thresholds from the
WID bulk source (/tmp/wid_extract/WID_data_<ISO2>.csv, already downloaded per v3) and merge
them into each existing wid_*.json file's percentiles dict for every year present.

Files updated: wid_us.json, wid_deu.json, wid_gbr.json, wid_jpn.json, wid_che.json,
wid_nor.json, wid_swe.json, wid_fin.json (data/ root, matching existing pattern).
Both pretax_national (tptincj992) and posttax_national (tdiincj992) datasets updated.
"""
import csv
import json
from collections import defaultdict

RAW_DIR = "/tmp/wid_extract"
DATA_DIR = "/home/user/workspace/income-tiles/data"

# iso2 (WID csv) -> basename used in wid_<basename>.json
FILES = {
    "US": "us", "DE": "deu", "GB": "gbr", "JP": "jpn",
    "CH": "che", "NO": "nor", "SE": "swe", "FI": "fin",
}

VAR_TO_DEFINITION = {
    "tptincj992": "pretax_national",
    "tdiincj992": "posttax_national",
}


def load_thresholds(iso2):
    """Returns {variable: {(percentile_code, year): value}} for p25p100 / p75p100."""
    path = f"{RAW_DIR}/WID_data_{iso2}.csv"
    data = defaultdict(dict)
    wanted_vars = ("tptincj992", "tdiincj992")
    wanted_pcts = ("p25p100", "p75p100")
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        next(reader)  # header
        for row in reader:
            if len(row) < 5:
                continue
            _country, variable, percentile, year, value = row[0], row[1], row[2], row[3], row[4]
            if variable not in wanted_vars or percentile not in wanted_pcts:
                continue
            try:
                year_i = int(year)
                value_f = float(value)
            except ValueError:
                continue
            data[variable][(percentile, year_i)] = value_f
    return data


def main():
    report = {}
    for iso2, basename in FILES.items():
        thresholds = load_thresholds(iso2)
        fname = f"{DATA_DIR}/wid_{basename}.json"
        with open(fname) as f:
            wid = json.load(f)

        updated_years_count = {"pretax_national": 0, "posttax_national": 0}
        already_present = {"pretax_national": 0, "posttax_national": 0}

        for dataset in wid["datasets"]:
            income_def = dataset["income_definition"]
            var = {v: k for k, v in VAR_TO_DEFINITION.items()}.get(income_def)
            if var is None:
                continue
            p25_map = thresholds.get(var, {})
            for year_entry in dataset["years"]:
                yr = year_entry["year"]
                pct = year_entry["percentiles"]
                had_both = "p25" in pct and "p75" in pct
                p25_val = p25_map.get(("p25p100", yr))
                p75_val = p25_map.get(("p75p100", yr))
                if p25_val is not None:
                    pct["p25"] = p25_val
                if p75_val is not None:
                    pct["p75"] = p75_val
                if had_both:
                    already_present[income_def] += 1
                elif p25_val is not None or p75_val is not None:
                    updated_years_count[income_def] += 1

        with open(fname, "w") as f:
            json.dump(wid, f, indent=2)

        report[basename] = {
            "file": fname,
            "already_present_years": already_present,
            "newly_added_years": updated_years_count,
        }
        print(basename, "already_present:", already_present, "newly_added:", updated_years_count)

    with open(f"{DATA_DIR}/v4/p25_p75_verification_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nSaved v4/p25_p75_verification_report.json")


if __name__ == "__main__":
    main()
