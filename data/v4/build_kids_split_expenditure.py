#!/usr/bin/env python3
"""
A.5 + A.6 - International kids-split expenditure & gross income by kids status.

IMPORTANT DATA-QUALITY NOTE on A.6: the task instructions specify "OECD Family Database
indicators PF1.1 and PF1.4" as the source for gross income by kids status. On inspection,
PF1.1 = "Public spending on family benefits" (% of GDP) and PF1.4 = "Tax neutrality of
family policies" -- NEITHER indicator publishes household gross income cross-tabulated by
presence of children. This is a spec/reality mismatch, documented here and in the README.
Instead, gross income by kids status is folded in per-country from the same national
household budget/income surveys used for A.5 (Destatis EVS for DE with EXACT figures;
BLS CES for US; ONS LCF for UK necessity/expenditure only, no income by kids status
published at this granularity so flagged as N/A; JP FIES/BFS HABE/StatFin HBS quintile or
decile data used as an income proxy where a clean with/without-kids split is not published).

necessity categories (matches v3 methodology, necessity.ts "minimal" definition):
housing + food_at_home + healthcare_oop + transport_component (transport_work if present,
else transport_total)
"""
import json

def necessity_share(cat, total):
    transport = cat.get("transport_work") if cat.get("transport_work") is not None else cat.get("transport_total", 0)
    necessity_total = (cat.get("housing") or 0) + (cat.get("food_at_home") or 0) + (cat.get("healthcare_oop") or 0) + (transport or 0)
    return necessity_total, (necessity_total / total if total else None)


# -------------------------------------------------------------------------
# Build a universal "tier ratio" curve from US CES by-decile data (d1-d10):
# necessity_share declines monotonically with income (Engel's law). We use
# this curve's *shape* to derive p50 -> p90 -> p99 ratios, then apply those
# ratios to each country's own group-level mean necessity_share. Same
# relative-curve extrapolation technique used in v3's peer-modeling
# (build_no_se_modeled.py), applied here to move along the income axis
# within a group rather than across countries.
# -------------------------------------------------------------------------
with open("/home/user/workspace/income-tiles/data/v2/us_ces_2024_by_decile.json") as f:
    _us_decile = json.load(f)

_us_curve_shares = []
for r in _us_decile["rows"]:
    _tot = r["avg_expenditure_total"]
    _nt, _sh = necessity_share(r["expenditure_by_category"], _tot)
    _us_curve_shares.append(_sh)  # d1..d10


def tier_ratio_multipliers():
    """Return (p90/p50, p99/p50) ratios from the US CES national necessity-share-by-decile
    curve. p50 ~ d5, p90 ~ d9, p99 ~ extrapolated beyond d10 using the d9->d10 slope."""
    p50 = _us_curve_shares[4]  # d5
    p90 = _us_curve_shares[8]  # d9
    d9, d10 = _us_curve_shares[8], _us_curve_shares[9]
    p99 = d10 + (d10 - d9)  # linear extrapolation one more decile-step beyond d10
    return p90 / p50, p99 / p50


P90_RATIO, P99_RATIO = tier_ratio_multipliers()


def tiered_shares(p50_share):
    """Apply US-curve-derived ratios to a group's own mean (p50-anchored) necessity share."""
    if p50_share is None:
        return {"p50": None, "p90": None, "p99": None}
    return {
        "p50": round(p50_share, 4),
        "p90": round(p50_share * P90_RATIO, 4),
        "p99": round(max(p50_share * P99_RATIO, 0.05), 4),
    }


result = {
    "as_of": "2026-08-03",
    "note": "A.6 data-quality note: OECD Family Database PF1.1 ('Public spending on family benefits', % of GDP) and PF1.4 ('Tax neutrality of family policies') do NOT publish household gross income by presence of children, contrary to the task brief's assumption. Gross/net income by kids status is instead folded in per-country from the same national household budget/income survey used for A.5 (see each country's 'income_source' field below). Where no clean with/without-kids income split is published by the national survey, income is approximated via decile/quintile position and flagged 'Tier C' or 'N/A'.",
    "countries": {}
}

categories_common = ["housing", "food_at_home", "food_away", "healthcare_oop", "transport_work",
                      "transport_total", "apparel", "communications", "personal_care", "education",
                      "cash_contributions", "voluntary_savings", "entertainment"]

# =========================================================================
# US - BLS CES 2024, Tier A (exact, already has with/without kids breakdown)
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v2/us_ces_2024_by_hhtype.json") as f:
    us_ces = json.load(f)

rows_by_group = {r["group"]: r for r in us_ces["rows"]}
no_kids = rows_by_group["couple_no_kids"]
wk_u6 = rows_by_group["with_kids_under6"]
wk_617 = rows_by_group["with_kids_6to17"]

# combine with_kids_under6 and with_kids_6to17 weighted by n_consumer_units_thousands
n1, n2 = wk_u6["n_consumer_units_thousands"], wk_617["n_consumer_units_thousands"]
wk_income = (wk_u6["avg_income_before_tax"] * n1 + wk_617["avg_income_before_tax"] * n2) / (n1 + n2)
wk_exp = (wk_u6["avg_expenditure_total"] * n1 + wk_617["avg_expenditure_total"] * n2) / (n1 + n2)
wk_cat = {}
for c in categories_common:
    v1 = wk_u6["expenditure_by_category"].get(c)
    v2 = wk_617["expenditure_by_category"].get(c)
    if v1 is not None and v2 is not None:
        wk_cat[c] = round((v1 * n1 + v2 * n2) / (n1 + n2), 1)

nk_total = no_kids["avg_expenditure_total"]
nk_necessity_total, nk_necessity_share_p50 = necessity_share(no_kids["expenditure_by_category"], nk_total)
wk_necessity_total, wk_necessity_share_p50 = necessity_share(wk_cat, wk_exp)

result["countries"]["US"] = {
    "source": "BLS Consumer Expenditure Survey (CES) 2024, by household type",
    "source_url": "https://www.bls.gov/cex/tables.htm",
    "income_source": "BLS CES 2024 (same survey; income before tax reported per consumer unit type)",
    "year": 2024,
    "data_tier": "A",
    "no_kids": {
        "avg_gross_income": no_kids["avg_income_before_tax"],
        "avg_expenditure": nk_total,
        "necessity_share_by_tier": tiered_shares(nk_necessity_share_p50),
        "note": "necessity_share p50 computed directly from BLS CES 'couple_no_kids' consumer-unit type mean; p90/p99 extrapolated by applying the US CES national necessity-share-by-decile curve's own p50->p90->p99 ratio to this group's mean share (Engel's-law decline in necessity share as income rises), per V4_1_BUILD_SPEC.md instruction to extrapolate from decile data when direct percentile detail isn't published.",
    },
    "with_kids": {
        "avg_gross_income": round(wk_income, 0),
        "avg_expenditure": round(wk_exp, 0),
        "necessity_share_by_tier": tiered_shares(wk_necessity_share_p50),
        "note": "with_kids = weighted average of BLS CES 'with_kids_under6' and 'with_kids_6to17' consumer-unit types, weighted by n_consumer_units_thousands. p90/p99 extrapolated via the same US CES decile-curve ratio technique as no_kids.",
    },
}

# =========================================================================
# DE - Destatis EVS 2023 by household type, Tier A (exact figures via bpb.de Sozialbericht 2024)
# =========================================================================
result["countries"]["DE"] = {
    "source": "Statistisches Bundesamt (Destatis), Einkommens- und Verbrauchsstichprobe (EVS) 2023, by household type (via BMBF/BPB Sozialbericht 2024 summary tables)",
    "source_url": "https://www.bpb.de/system/files/dokument_pdf/05_sozialbericht_24_bf.pdf",
    "income_source": "Destatis EVS 2023 (Jahresbruttoeinkommen / Jahresnettoeinkommen nach Haushaltstyp)",
    "year": 2023,
    "data_tier": "A",
    "no_kids": {
        "avg_gross_income": 53669,
        "avg_net_income": 38043,
        "avg_expenditure_monthly": 3372,
        "avg_expenditure": round(3372 * 12, 0),
        "necessity_share_by_tier": {"p50": None, "p90": None, "p99": None},
        "note": "'Haushalte ohne Kind' (income; annual EUR) matched with 'Paare ohne Kind' (expenditure; monthly EUR, x12 for annual) -- these are closely-related but not identical household-type definitions (income group includes all no-kids households incl. singles/3+ adults; expenditure group is couples-only). Full EVS category-level expenditure breakdown for these exact groups not extracted (source table gives only total monthly consumption expenditure by household type); necessity_share requires the category breakdown, which was not available within this session's source coverage -- flagged as gap, see README.",
    },
    "with_kids": {
        "avg_gross_income": 90905,
        "avg_net_income": 62336,
        "avg_expenditure_monthly": 4029,
        "avg_expenditure": round(4029 * 12, 0),
        "necessity_share_by_tier": {"p50": None, "p90": None, "p99": None},
        "note": "'Haushalte mit Kind(ern)' (income) matched with 'Paare mit Kind(ern)' (expenditure, monthly EUR x12). Same category-breakdown gap as no_kids.",
    },
}

# =========================================================================
# UK - ONS LCF FYE2024 by household composition, Tier A for expenditure;
#      income by kids status not published at this granularity in the source used -> N/A
# =========================================================================
with open("/home/user/workspace/income-tiles/data/v2/uk_lcf_by_hhtype.json") as f:
    uk_lcf = json.load(f)
uk_rows = {r["group"]: r for r in uk_lcf["rows"]}

uk_no_kids_row = uk_rows["nonretired_two_adults"]
uk_wk_row = uk_rows["one_or_two_adults_with_two_or_more_children"]  # use larger-family group as with_kids representative
uk_wk_row_alt = uk_rows["one_or_two_adults_with_one_child"]
n_nt, n_nt_total = uk_no_kids_row["avg_expenditure_total"], uk_no_kids_row["avg_expenditure_total"]

uk_nk_necessity_total, uk_nk_share = necessity_share(uk_no_kids_row["expenditure_by_category"], uk_no_kids_row["avg_expenditure_total"])
# combine one-child and two-plus-child groups weighted by weighted_households_thousands
w1 = uk_wk_row_alt["weighted_households_thousands"]
w2 = uk_wk_row["weighted_households_thousands"]
uk_wk_exp = (uk_wk_row_alt["avg_expenditure_total"] * w1 + uk_wk_row["avg_expenditure_total"] * w2) / (w1 + w2)
uk_wk_cat = {}
for c in categories_common:
    v1 = uk_wk_row_alt["expenditure_by_category"].get(c)
    v2 = uk_wk_row["expenditure_by_category"].get(c)
    if v1 is not None and v2 is not None:
        uk_wk_cat[c] = round((v1 * w1 + v2 * w2) / (w1 + w2), 1)
uk_wk_necessity_total, uk_wk_share = necessity_share(uk_wk_cat, uk_wk_exp)

result["countries"]["UK"] = {
    "source": "ONS Living Costs and Food Survey (LCF) via Family Spending, detailed household expenditure by household composition, UK, FYE 2024",
    "source_url": "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook4expenditurebyhouseholdcharacteristic/fye2024/workbook4expenditurebyhouseholdcharacteristics.xlsx",
    "income_source": "N/A - ONS LCF household-composition breakdown tables used here do not publish income (before/after tax) cross-tabulated by household composition at this granularity; income fields are null in the underlying uk_lcf_by_hhtype.json source file",
    "year": 2024,
    "data_tier": "A",
    "no_kids": {
        "avg_gross_income": None,
        "avg_expenditure": uk_no_kids_row["avg_expenditure_total"],
        "necessity_share_by_tier": tiered_shares(uk_nk_share),
        "note": "group = 'nonretired_two_adults' (proxy for couple, no kids). Income not available in source (see income_source note).",
    },
    "with_kids": {
        "avg_gross_income": None,
        "avg_expenditure": round(uk_wk_exp, 2),
        "necessity_share_by_tier": tiered_shares(uk_wk_share),
        "note": "with_kids = weighted average of 'one_or_two_adults_with_one_child' and 'one_or_two_adults_with_two_or_more_children' groups, weighted by weighted_households_thousands. Income not available in source.",
    },
}

with open("/home/user/workspace/income-tiles/data/v4/_kids_split_partial_1.json", "w") as f:
    json.dump(result, f, indent=2)

print("Saved partial 1 (US, DE, UK)")
print(json.dumps(result["countries"]["US"], indent=2))
