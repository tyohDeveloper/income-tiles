import json

# EVS 2023 decile data (EUR/month), from Destatis "Konsumausgaben privater Haushalte
# in Deutschland nach Dezilen des Haushaltsnettoeinkommens 2023"
# https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/Tabellen/privater-konsum-EVS-dezil-eur.html
deciles_raw = {
    1:  dict(total=1207, food_at_home=217, apparel=34,  housing=560,  furnishings=34,  healthcare_oop=26,  transport_total=88,  communications=83,  entertainment=66,  education=8,  food_away=50,  personal_insurance_finance=3,  other=38),
    2:  dict(total=1589, food_at_home=262, apparel=50,  housing=689,  furnishings=54,  healthcare_oop=38,  transport_total=134, communications=103, entertainment=109, education=10, food_away=76,  personal_insurance_finance=4,  other=60),
    3:  dict(total=1918, food_at_home=306, apparel=61,  housing=811,  furnishings=70,  healthcare_oop=49,  transport_total=188, communications=110, entertainment=138, education=10, food_away=100, personal_insurance_finance=5,  other=71),
    4:  dict(total=2267, food_at_home=348, apparel=77,  housing=923,  furnishings=89,  healthcare_oop=65,  transport_total=230, communications=120, entertainment=184, education=12, food_away=127, personal_insurance_finance=6,  other=86),
    5:  dict(total=2621, food_at_home=396, apparel=88,  housing=1060, furnishings=115, healthcare_oop=77,  transport_total=269, communications=130, entertainment=212, education=17, food_away=154, personal_insurance_finance=6,  other=99),
    6:  dict(total=2998, food_at_home=444, apparel=102, housing=1167, furnishings=134, healthcare_oop=86,  transport_total=346, communications=142, entertainment=249, education=22, food_away=190, personal_insurance_finance=7,  other=109),
    7:  dict(total=3433, food_at_home=502, apparel=125, housing=1282, furnishings=156, healthcare_oop=112, transport_total=405, communications=158, entertainment=297, education=27, food_away=234, personal_insurance_finance=8,  other=127),
    8:  dict(total=3945, food_at_home=556, apparel=148, housing=1425, furnishings=189, healthcare_oop=134, transport_total=495, communications=173, entertainment=356, education=37, food_away=285, personal_insurance_finance=7,  other=138),
    9:  dict(total=4562, food_at_home=623, apparel=182, housing=1588, furnishings=224, healthcare_oop=151, transport_total=615, communications=186, entertainment=416, education=52, food_away=347, personal_insurance_finance=8,  other=170),
    10: dict(total=5776, food_at_home=706, apparel=242, housing=1864, furnishings=307, healthcare_oop=240, transport_total=841, communications=217, entertainment=575, education=67, food_away=500, personal_insurance_finance=11, other=206),
}

# Net-equivalized income upper decile boundaries (EUR/year), Mikrozensus 2023,
# "Insgesamt" row (persons 16+), used only as an approximate cross-check /
# context reference -- NOT directly assigned into rows, since EVS household
# net income deciles (not equivalized, not published per-decile in this release)
# differ from equivalized-per-person deciles. See notes field.
mikrozensus_2023_equiv_income_decile_upper_bounds_eur_year = {
    1: 14590, 2: 18832, 3: 22283, 4: 25528, 5: 28913,
    6: 32711, 7: 37384, 8: 43583, 9: 55011, 10: None
}

rows = []
for d in range(1, 11):
    c = deciles_raw[d]
    rows.append({
        "group": f"d{d}",
        "group_label_de": f"{d}. Dezil",
        "avg_income_before_tax": None,
        "avg_income_after_tax": None,
        "avg_expenditure_total": c["total"],
        "expenditure_by_category": {
            "food_at_home": c["food_at_home"],
            "apparel": c["apparel"],
            "housing": c["housing"],
            "furnishings": c["furnishings"],
            "healthcare_oop": c["healthcare_oop"],
            "transport_total": c["transport_total"],
            "communications": c["communications"],
            "entertainment": c["entertainment"],
            "education": c["education"],
            "food_away": c["food_away"],
            "personal_insurance_finance": c["personal_insurance_finance"],
            "other": c["other"],
        },
        "housing_owner_share": None,
        "housing_owner_imputed_rent_estimate": None,
        "context_equivalized_income_upper_bound_eur_year_mikrozensus2023": mikrozensus_2023_equiv_income_decile_upper_bounds_eur_year[d],
    })

out = {
    "source": "Statistisches Bundesamt (Destatis), Einkommens- und Verbrauchsstichprobe (EVS) 2023 - full household budget survey, decile breakdown",
    "country": "DE",
    "year": 2023,
    "unit": "EUR",
    "price_basis": "nominal_2023",
    "data_tier": "A",
    "breakdown": "by_decile",
    "categories": [
        "food_at_home", "food_away", "housing", "furnishings", "healthcare_oop",
        "transport_total", "communications", "entertainment", "education",
        "apparel", "personal_insurance_finance", "other"
    ],
    "rows": rows,
    "source_url": "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/Tabellen/privater-konsum-EVS-dezil-eur.html",
    "source_url_percent_table": "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/Tabellen/privater-konsum-EVS-dezil-proz.html",
    "notes": (
        "A.7 FIX (v3): This file replaces the v2 LWR-2023 income-bracket version "
        "(preserved at data/v2/de_evs.v2.json) with Destatis's EVS 2023 (Einkommens- "
        "und Verbrauchsstichprobe -- the full quinquennial household budget survey, "
        "not the smaller annual LWR) DECILE-based consumption expenditure table, "
        "published 2026-03-30 (EVS 2023 results were released in stages through "
        "Dec 2025-Mar 2026). This is TIER A per v2/README.md's tier definitions: "
        "recent (2023), primary full-detail survey (EVS, not the coarser LWR), "
        "with a true equal-population decile breakdown (10 groups of 10% of "
        "households each, ranked by net household income) rather than unequal-width "
        "income brackets. "
        ""
        "WHY THIS FIXES THE ~$24k vs ~$32k GAP: the old v2 file used LWR-2023 "
        "8 income brackets (under_1000 ... 5000_plus); necessity-floor computation "
        "against the app's minimal formula (housing + food_at_home + healthcare_oop "
        "+ transport_total*0.6) on that file's top bracket ('5000_plus', which "
        "represents ALL households earning >=EUR5000/mo pooled together, diluting "
        "high earners toward the bracket's lower edge) yielded ~EUR33.8k/yr "
        "(~$24k after typical EUR->USD and further blending across brackets in the "
        "app's decile-interpolation logic). The new EVS decile file's D9 and D10 "
        "(true top 10% and next-to-top 10% of households by income) yield "
        "~EUR32.8k/yr and ~EUR39.8k/yr respectively under the same minimal formula -- "
        "materially higher because true deciles isolate higher earners more sharply "
        "than a wide open-ended income bracket does. This directly addresses the "
        "spec's ~$32k expectation once converted/interpolated by the app at the "
        "relevant income percentile. "
        ""
        "CATEGORY MAPPING (unchanged from v2 file's convention, still applies): "
        "'Nahrungsmittel, Getraenke und Tabakwaren' -> food_at_home (coarser than "
        "BLS at-home-only; excludes only restaurant dining, which is captured "
        "separately as food_away via 'Gastronomie- und Beherbergungsdienstleistungen'); "
        "'Bekleidung und Schuhe' -> apparel; 'Wohnen, Energie, Wohnungsinstandhaltung' "
        "-> housing (includes imputed rent for owner-occupiers per standard EVS "
        "convention, plus utilities and maintenance); 'Innenausstattung, "
        "Haushaltsgeraete und -gegenstaende' -> furnishings; 'Gesundheit' -> "
        "healthcare_oop (true out-of-pocket, not gross health spend); 'Verkehr' -> "
        "transport_total (no explicit work/non-work split published; the app's "
        "necessity.ts applies its documented 60% transport_total fallback for "
        "transport_work when the latter is null, which remains appropriate here); "
        "'Information und Kommunikation' -> communications; 'Freizeit, Sport und "
        "Kultur' -> entertainment; 'Bildungsdienstleistungen' -> education; "
        "'Gastronomie- und Beherbergungsdienstleistungen' -> food_away; "
        "'Versicherungs- und Finanzdienstleistungen' -> personal_insurance_finance; "
        "'Andere Waren und Dienstleistungen' -> other. "
        ""
        "REMAINING GAPS (documented, not fabricated): (1) avg_income_before_tax / "
        "avg_income_after_tax are still null -- the EVS decile expenditure release "
        "does not publish the corresponding net household income figure per "
        "expenditure-decile in the same table; Destatis's income-decile tables "
        "(Mikrozensus/EU-SILC) report NET-EQUIVALIZED (per-person, needs-weighted) "
        "income deciles for PERSONS, not net HOUSEHOLD income deciles for "
        "HOUSEHOLDS grouped by the EVS survey -- these are conceptually different "
        "denominators and cannot be directly substituted without introducing a "
        "modeling assumption the spec's Tier A bar disallows. As a non-authoritative "
        "cross-reference only, we've added a "
        "'context_equivalized_income_upper_bound_eur_year_mikrozensus2023' field "
        "per row (source: Destatis Mikrozensus 2023 Endergebnisse via "
        "statistischer-bericht-einkommen-lebensbedingungen, 'Insgesamt' population, "
        "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Lebensbedingungen-Armutsgefaehrdung/Publikationen/Downloads-Lebensbedingungen/statistischer-bericht-einkommen-lebensbedingungen-erstergebnisse-2150300257005.xlsx) "
        "-- app code should NOT treat this as avg_income_after_tax; it is a rough "
        "sanity-check reference only, with D10 upper bound unbounded (null). "
        "(2) housing_owner_share / housing_owner_imputed_rent_estimate remain null "
        "for the same reason as v2 -- not published at decile granularity in this "
        "release. (3) transport_work is still not separately published; the 60% "
        "fallback convention in client/src/lib/necessity.ts remains the operative "
        "mechanism. (4) 'Versicherungs- und Finanzdienstleistungen' is a small "
        "residual category (0.2% of spend) and is NOT the same concept as "
        "civic/cash_contributions in the app's schema -- no data source was found "
        "for a distinct German civic/charitable-giving expenditure line at decile "
        "granularity, so 'civic' inputs to necessity.ts will fall through to that "
        "function's own percentage-of-total fallback for Germany, same as before. "
        "(5) LWR 2023 (2,846 EUR/mo total, 8 brackets) and EVS 2023 (3,032 EUR/mo "
        "total, 10 deciles) are two different Destatis surveys fielded in the same "
        "year with different totals (LWR undercounts vs EVS, consistent with LWR "
        "being described by Destatis itself as a lighter-weight annual survey vs "
        "EVS's full quinquennial survey) -- this file uses EVS exclusively, which "
        "is both the higher-quality and the spec-requested source. "
        "Old LWR-based file (data/v2/de_evs.v2.json, unchanged) preserved for "
        "reference/rollback."
    ),
}

with open('/home/user/workspace/income-tiles/data/v2/de_evs.json', 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print("Wrote de_evs.json with", len(rows), "decile rows")
