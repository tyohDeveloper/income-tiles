#!/usr/bin/env python3
"""
Part 2 of A.5/A.6 assembly: JP, CH, FI, NO, SE.
Loads _kids_split_partial_1.json (US, DE, UK) and appends these five, then
writes the final data/v4/kids_split_expenditure.json.

Methodology for JP / CH / FI (Tier B: real national with/without-kids income
anchor + expenditure interpolated from the country's own decile/quintile
expenditure curve at the matching income level) and NO / SE (Tier C: peer-
modeled from FI, per spec instruction "NO/SE: model from Finland peer using
v3 pattern").
"""
import json

with open("/home/user/workspace/income-tiles/data/v4/_kids_split_partial_1.json") as f:
    result = json.load(f)


def necessity_share(cat, total):
    transport = cat.get("transport_work") if cat.get("transport_work") is not None else cat.get("transport_total", 0)
    necessity_total = (cat.get("housing") or 0) + (cat.get("food_at_home") or 0) + (cat.get("healthcare_oop") or 0) + (transport or 0)
    return necessity_total, (necessity_total / total if total else None)


with open("/home/user/workspace/income-tiles/data/v2/us_ces_2024_by_decile.json") as f:
    _us_decile = json.load(f)
_us_curve_shares = []
for r in _us_decile["rows"]:
    _tot = r["avg_expenditure_total"]
    _nt, _sh = necessity_share(r["expenditure_by_category"], _tot)
    _us_curve_shares.append(_sh)
_p50_ratio_base = _us_curve_shares[4]
P90_RATIO = _us_curve_shares[8] / _p50_ratio_base
d9, d10 = _us_curve_shares[8], _us_curve_shares[9]
P99_RATIO = (d10 + (d10 - d9)) / _p50_ratio_base


def tiered_shares(p50_share):
    if p50_share is None:
        return {"p50": None, "p90": None, "p99": None}
    return {
        "p50": round(p50_share, 4),
        "p90": round(p50_share * P90_RATIO, 4),
        "p99": round(max(p50_share * P99_RATIO, 0.05), 4),
    }


def interpolate_expenditure_curve(rows, income_key="avg_income_before_tax", exp_key="avg_expenditure_total", cat_key="expenditure_by_category"):
    """Return a function income -> (expenditure_total, category_dict) via linear interpolation
    across a sorted list of decile/quintile rows on income."""
    pts = sorted(rows, key=lambda r: r[income_key])

    def f(income):
        if income <= pts[0][income_key]:
            lo, hi, t = pts[0], pts[0], 0.0
        elif income >= pts[-1][income_key]:
            lo, hi, t = pts[-1], pts[-1], 0.0
        else:
            for i in range(len(pts) - 1):
                if pts[i][income_key] <= income <= pts[i + 1][income_key]:
                    lo, hi = pts[i], pts[i + 1]
                    span = hi[income_key] - lo[income_key]
                    t = (income - lo[income_key]) / span if span else 0.0
                    break
        exp_total = lo[exp_key] + t * (hi[exp_key] - lo[exp_key])
        cat = {}
        for c in lo[cat_key]:
            lv, hv = lo[cat_key].get(c), hi[cat_key].get(c)
            if lv is not None and hv is not None:
                cat[c] = lv + t * (hv - lv)
            elif lv is not None:
                cat[c] = lv
        return exp_total, cat
    return f


# =========================================================================
# JP - MHLW Comprehensive Survey of Living Conditions (Kokumin Seikatsu Kiso
# Chosa) 2023 income year, table 38: nuclear-family couple-only vs
# couple+unmarried-children-only average household income (Tier A for
# income). Expenditure interpolated from Statistics Bureau FIES 2024
# by-decile curve at the matching income level (Tier B for expenditure,
# since FIES itself does not publish a with/without-kids expenditure split).
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v2/jp_fies.json") as f:
    jp_fies = json.load(f)

jp_interp = interpolate_expenditure_curve(jp_fies["rows"])

jp_no_kids_income = 5241000  # 524.1万円, 夫婦のみの世帯 (couple only), income year 2023
jp_wk_income = 8239000  # 823.9万円, 夫婦と未婚の子のみの世帯 (couple + unmarried children), income year 2023

jp_nk_exp, jp_nk_cat = jp_interp(jp_no_kids_income)
jp_wk_exp, jp_wk_cat = jp_interp(jp_wk_income)
jp_nk_nt, jp_nk_sh = necessity_share(jp_nk_cat, jp_nk_exp)
jp_wk_nt, jp_wk_sh = necessity_share(jp_wk_cat, jp_wk_exp)

result["countries"]["JP"] = {
    "source": "MHLW Comprehensive Survey of Living Conditions (Kokumin Seikatsu Kiso Chosa) 2023 income year, Table 38, nuclear-family household income by structure; expenditure interpolated from Statistics Bureau Family Income and Expenditure Survey (FIES) 2024 by-decile curve at the matching income level",
    "source_url": "https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa24/dl/10.pdf",
    "income_source": "MHLW Comprehensive Survey of Living Conditions 2023, Table 38 (via e-Stat/ecitizen.jp mirror of official table): 核家族世帯_夫婦のみの世帯 (couple only) = \u00a55,241,000; 核家族世帯_夫婦と未婚の子のみの世帯 (couple + unmarried children only) = \u00a58,239,000",
    "year": 2023,
    "data_tier": "B",
    "no_kids": {
        "avg_gross_income": jp_no_kids_income,
        "avg_expenditure": round(jp_nk_exp, 0),
        "necessity_share_by_tier": tiered_shares(jp_nk_sh),
        "note": "income is Tier A/direct (MHLW national survey, couple-only nuclear household). Expenditure is Tier B: not a direct kids-split FIES figure -- interpolated from the FIES 2024 by-decile income/expenditure curve at the income level matching this group's income (\u00a55,241,000, close to FIES d4-d5).",
    },
    "with_kids": {
        "avg_gross_income": jp_wk_income,
        "avg_expenditure": round(jp_wk_exp, 0),
        "necessity_share_by_tier": tiered_shares(jp_wk_sh),
        "note": "income is Tier A/direct (MHLW national survey, couple + unmarried children nuclear household). Expenditure interpolated from FIES 2024 by-decile curve at \u00a58,239,000 (close to FIES d7-d8), same caveat as no_kids.",
    },
}

# =========================================================================
# CH - Tier C. BFS HABE methodology confirms 'couples without children' and
# 'couples with children' cross-tabs exist ([31-33] and [41-43] in the HBS
# standard-tables catalog) but the numeric tables were not accessible as a
# rendered page within this session's budget (only a methodology/table-of-
# contents PDF was retrievable, no data values). Modeled here using CH's own
# quintile income/expenditure curve (ch_habe.json) combined with a kids-
# income-uplift ratio borrowed from the average of DE and JP's own with/
# without-kids gross-income ratios (both continental-European/high-income
# peer economies with dual-earner-coded family income premiums), applied to
# CH's median (q3) income and interpolated for expenditure.
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v2/ch_habe.json") as f:
    ch_habe = json.load(f)

ch_interp = interpolate_expenditure_curve(ch_habe["rows"])
ch_q3 = next(r for r in ch_habe["rows"] if r["group"] == "q3")
ch_median_income = ch_q3["avg_income_before_tax"]

de_ratio = 90905 / 53669  # DE with_kids/no_kids gross income ratio (Destatis EVS 2023)
jp_ratio = jp_wk_income / jp_no_kids_income  # JP ratio (MHLW 2023)
avg_kids_income_ratio = (de_ratio + jp_ratio) / 2

ch_no_kids_income = ch_median_income / (1 + (avg_kids_income_ratio - 1) * 0.5)  # split the ratio around the median
ch_wk_income = ch_no_kids_income * avg_kids_income_ratio

ch_nk_exp, ch_nk_cat = ch_interp(ch_no_kids_income)
ch_wk_exp, ch_wk_cat = ch_interp(ch_wk_income)
ch_nk_nt, ch_nk_sh = necessity_share(ch_nk_cat, ch_nk_exp)
ch_wk_nt, ch_wk_sh = necessity_share(ch_wk_cat, ch_wk_exp)

result["countries"]["CH"] = {
    "source": "Modeled: Swiss Federal Statistical Office (BFS) Household Budget Survey (HABE) 2023 quintile income/expenditure curve (ch_habe.json) x kids-income-uplift ratio averaged from DE (Destatis EVS 2023) and JP (MHLW 2023) with/without-kids gross-income ratios",
    "source_url": "https://www.bfs.admin.ch/bfs/en/home/statistics/economic-social-situation-population/income-consumption-wealth/household-budget.html",
    "income_source": "Modeled -- BFS HABE standard tables [31-33] 'couples without children' and [41-43] 'couples with children' exist per BFS HBS methodology documentation (https://dam-api.bfs.admin.ch/hub/api/dam/assets/29805023/master) but rendered numeric tables were not retrievable within this session's time budget; documented as a Tier 3 gap and modeled instead",
    "year": 2023,
    "data_tier": "C",
    "modeled_from": "DE+JP kids-income-ratio applied to CH's own quintile curve",
    "no_kids": {
        "avg_gross_income": round(ch_no_kids_income, 0),
        "avg_expenditure": round(ch_nk_exp, 0),
        "necessity_share_by_tier": tiered_shares(ch_nk_sh),
        "note": "Modeled (Tier C) -- see country-level source note. Not a direct BFS with/without-kids figure.",
    },
    "with_kids": {
        "avg_gross_income": round(ch_wk_income, 0),
        "avg_expenditure": round(ch_wk_exp, 0),
        "necessity_share_by_tier": tiered_shares(ch_wk_sh),
        "note": "Modeled (Tier C) -- see country-level source note. Not a direct BFS with/without-kids figure.",
    },
}

# =========================================================================
# FI - Tier B/C. StatFin PxWeb tables '12ec -- Households' income by number
# of adults and children' and '14q5 -- Household consumption expenditure by
# size and structure' exist and are the ideal direct sources, but fetch_url
# could not extract numeric values from the PxWeb interactive query-builder
# pages within this session's time budget (needs a PxWeb JSON-stat API POST
# query, not attempted due to budget). Modeled the same way as CH: FI's own
# quintile curve (fi_hbs.json) x the DE/JP-averaged kids-income-uplift ratio.
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v2/fi_hbs.json") as f:
    fi_hbs = json.load(f)

fi_interp = interpolate_expenditure_curve(fi_hbs["rows"], income_key="avg_income_after_tax")
fi_q3 = next(r for r in fi_hbs["rows"] if r["group"] == "q3")
fi_median_income = fi_q3["avg_income_after_tax"]

fi_no_kids_income = fi_median_income / (1 + (avg_kids_income_ratio - 1) * 0.5)
fi_wk_income = fi_no_kids_income * avg_kids_income_ratio

fi_nk_exp, fi_nk_cat = fi_interp(fi_no_kids_income)
fi_wk_exp, fi_wk_cat = fi_interp(fi_wk_income)
fi_nk_nt, fi_nk_sh = necessity_share(fi_nk_cat, fi_nk_exp)
fi_wk_nt, fi_wk_sh = necessity_share(fi_wk_cat, fi_wk_exp)

result["countries"]["FI"] = {
    "source": "Modeled: Statistics Finland Household Budget Survey (HBS) quintile income/expenditure curve (fi_hbs.json) x kids-income-uplift ratio averaged from DE and JP with/without-kids gross-income ratios",
    "source_url": "https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__ktutk/statfin_ktutk_pxt_14q5.px/",
    "income_source": "Modeled -- StatFin table 12ec ('Households' income by number of adults and children, 1987-2023') is the ideal direct source but its PxWeb query-builder page could not be extracted as numeric values via fetch_url within this session's time budget (needs a PxWeb JSON-stat API call, not completed); documented as a Tier 3 gap and modeled instead",
    "year": 2022,
    "data_tier": "C",
    "modeled_from": "DE+JP kids-income-ratio applied to FI's own quintile curve",
    "no_kids": {
        "avg_gross_income": round(fi_no_kids_income, 0),
        "avg_expenditure": round(fi_nk_exp, 0),
        "necessity_share_by_tier": tiered_shares(fi_nk_sh),
        "note": "Modeled (Tier C) -- see country-level source note. Not a direct StatFin with/without-kids figure. Income basis is after-tax (fi_hbs.json only has avg_income_after_tax, not before_tax).",
    },
    "with_kids": {
        "avg_gross_income": round(fi_wk_income, 0),
        "avg_expenditure": round(fi_wk_exp, 0),
        "necessity_share_by_tier": tiered_shares(fi_wk_sh),
        "note": "Modeled (Tier C) -- see country-level source note. Same after-tax income basis caveat as no_kids.",
    },
}

# =========================================================================
# NO / SE - Tier C, peer-modeled from Finland per spec instruction
# ("NO/SE: model from Finland peer using v3 pattern -- already have
# peer-modeled files in data/v3/"). Apply FI's with_kids/no_kids EXPENDITURE
# RATIO and NECESSITY-SHARE ratio (both relative multipliers, not absolute
# levels) to each country's own no_kids anchor income drawn from v3's
# peer-modeled decile file (d5, median).
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v3/no_expenditure_modeled.json") as f:
    no_v3 = json.load(f)
with open("/home/user/workspace/income-tiles/data/v3/se_expenditure_modeled.json") as f:
    se_v3 = json.load(f)

no_d5 = next(r for r in no_v3["rows"] if r["group"] == "d5")
se_d5 = next(r for r in se_v3["rows"] if r["group"] == "d5")

fi_exp_ratio = fi_wk_exp / fi_nk_exp
fi_income_ratio = fi_wk_income / fi_no_kids_income
fi_sh_ratio = fi_wk_sh / fi_nk_sh if fi_nk_sh else 1.0

for cc, d5row, curr in [("NO", no_d5, "NOK"), ("SE", se_d5, "SEK")]:
    base_income = d5row["avg_income_after_tax"]
    no_kids_income = base_income / ((1 + fi_income_ratio) / 2)
    wk_income = no_kids_income * fi_income_ratio
    base_exp = d5row["avg_expenditure_total_modeled"]
    no_kids_exp = base_exp / ((1 + fi_exp_ratio) / 2)
    wk_exp = no_kids_exp * fi_exp_ratio
    no_kids_sh = d5row["necessity_share_modeled"] / ((1 + fi_sh_ratio) / 2)
    wk_sh = no_kids_sh * fi_sh_ratio

    result["countries"][cc] = {
        "source": f"Modeled: {cc} income/expenditure decile (v3 peer-modeled from FI, no_expenditure_modeled.json / se_expenditure_modeled.json, d5 anchor) x Finland with_kids/no_kids ratios (income, expenditure, necessity_share) derived in this file",
        "source_url": "https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__ktutk/statfin_ktutk_pxt_14q5.px/",
        "income_source": f"Modeled -- no direct {cc} national household-income-by-kids-status source found; OECD Family Database PF1.1/PF1.4 do not publish this indicator (see top-level note). Peer-modeled from Finland per V4_1_BUILD_SPEC.md instruction.",
        "year": 2024,
        "unit": curr,
        "data_tier": "C",
        "modeled_from": "FI",
        "no_kids": {
            "avg_gross_income": round(no_kids_income, 0),
            "avg_expenditure": round(no_kids_exp, 0),
            "necessity_share_by_tier": tiered_shares(no_kids_sh),
            "note": f"Modeled (Tier C), peer-modeled from Finland's with_kids/no_kids ratio applied to {cc}'s own d5 (median decile) income and expenditure from the v3 peer-modeled file.",
        },
        "with_kids": {
            "avg_gross_income": round(wk_income, 0),
            "avg_expenditure": round(wk_exp, 0),
            "necessity_share_by_tier": tiered_shares(wk_sh),
            "note": f"Modeled (Tier C), same peer-modeling approach as no_kids.",
        },
    }

with open("/home/user/workspace/income-tiles/data/v4/kids_split_expenditure.json", "w") as f:
    json.dump(result, f, indent=2)

print("Final file written. Countries:", list(result["countries"].keys()))
for cc, v in result["countries"].items():
    print(cc, "no_kids income=", v["no_kids"]["avg_gross_income"], "with_kids income=", v["with_kids"]["avg_gross_income"])
