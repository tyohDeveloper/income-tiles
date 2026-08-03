import json

fi = json.load(open('/home/user/workspace/income-tiles/data/v2/fi_hbs.json'))
no = json.load(open('/home/user/workspace/income-tiles/data/v2/no_expenditure.json'))
se = json.load(open('/home/user/workspace/income-tiles/data/v2/se_expenditure.json'))

# --- Step 1: compute Finland necessity share by quintile ---
# necessity categories per client/src/lib/necessity.ts "minimal" strictness:
# housing + food_at_home + healthcare_oop + transport_work(or 0.6*transport_total) + childcare(if present)
# Finland's childcare is null for all quintiles, so minimal = housing+food_at_home+healthcare_oop+0.6*transport_total
fi_quintiles = []
for row in fi['rows']:
    c = row['expenditure_by_category']
    transport_component = c['transport_work'] if c.get('transport_work') is not None else 0.6 * c['transport_total']
    necessity_total = c['housing'] + c['food_at_home'] + c['healthcare_oop'] + transport_component
    total_exp = row['avg_expenditure_total']
    share = necessity_total / total_exp
    fi_quintiles.append({
        'group': row['group'],
        'avg_income_after_tax': row['avg_income_after_tax'],
        'avg_expenditure_total': total_exp,
        'necessity_total': necessity_total,
        'necessity_share': share,
        # also carry full category *shares* of total expenditure, so we can
        # apply Finland's full spending pattern (not just the necessity/discretionary
        # split) to NO/SE, in case downstream app code wants category-level detail
        'category_shares': {k: (v / total_exp if v is not None else None) for k, v in c.items()},
    })

for q in fi_quintiles:
    print(q['group'], 'income=', q['avg_income_after_tax'], 'necessity_share=', round(q['necessity_share'], 4))

# --- Step 2: map Finland's 5 quintiles onto a 10-decile necessity-share curve ---
# v3-plan.md guidance: fit monotone interpolation to decile centers; extrapolate
# tail by holding constant at d10's share (upper bound) or clipping at ~10% (lower bound).
# Quintile centers (in decile-space, 1-10): q1->d1.5(mean of d1,d2), q2->d3.5, q3->d5.5, q4->d7.5, q5->d9.5
quintile_centers = [1.5, 3.5, 5.5, 7.5, 9.5]
shares = [q['necessity_share'] for q in fi_quintiles]

def interpolate_share(decile_center, centers=quintile_centers, values=shares):
    if decile_center <= centers[0]:
        return values[0]
    if decile_center >= centers[-1]:
        return values[-1]
    for i in range(len(centers) - 1):
        if centers[i] <= decile_center <= centers[i+1]:
            frac = (decile_center - centers[i]) / (centers[i+1] - centers[i])
            return values[i] + frac * (values[i+1] - values[i])
    return values[-1]

decile_necessity_share = {}
for d in range(1, 11):
    center = d - 0.5 + 0.5  # decile d covers [d-1,d]*10%, center at d-0.5... use d as center directly mapped to 1..10 scale
    decile_necessity_share[d] = interpolate_share(d)

print("\nInterpolated decile necessity shares:")
for d, s in decile_necessity_share.items():
    print(f"d{d}: {round(s,4)}")

# --- Step 2b: also interpolate full category-share vectors per decile (for richer modeled output) ---
category_keys = list(fi_quintiles[0]['category_shares'].keys())
decile_category_shares = {}
for d in range(1, 11):
    center = d
    row = {}
    for k in category_keys:
        vals = [q['category_shares'][k] for q in fi_quintiles]
        if any(v is None for v in vals):
            row[k] = None
            continue
        row[k] = interpolate_share(center, quintile_centers, vals)
    decile_category_shares[d] = row

# --- Step 3: apply to NO and SE income deciles ---
# NOTE: NO/SE avg_income_after_tax is per SSB/SCB's own methodology (NOK/SEK,
# "average income after tax per consumption unit" for NO; "average equivalised
# disposable income" for SE) -- both already disposable-income concepts,
# directly comparable in spirit to Finland's avg_income_after_tax used to
# derive the necessity-share curve. We assume households at a given income
# decile spend a total amount approximated by NO's/SE's own avg_income_after_tax
# (i.e., we assume total expenditure ~= disposable income for modeling purposes,
# since no independent expenditure-total figure exists for NO/SE) -- this is
# the central simplifying assumption of the peer-model and is documented below.

def build_modeled(country_code, country_name, src_rows, currency):
    modeled_rows = []
    for row in src_rows:
        d = int(row['group'][1:])  # 'd1' -> 1
        income = row['avg_income_after_tax']
        necessity_share = decile_necessity_share[d]
        # Assume total expenditure approximated by disposable income for modeling
        # (no independent NO/SE expenditure-total source exists -- Tier C survey discontinued)
        assumed_total_expenditure = income
        necessity_total_modeled = assumed_total_expenditure * necessity_share
        cat_shares = decile_category_shares[d]
        expenditure_by_category_modeled = {
            k: (round(assumed_total_expenditure * v, 1) if v is not None else None)
            for k, v in cat_shares.items()
        }
        modeled_rows.append({
            "group": row['group'],
            "avg_income_before_tax": row['avg_income_before_tax'],
            "avg_income_after_tax": income,
            "avg_expenditure_total_modeled": round(assumed_total_expenditure, 1),
            "necessity_share_modeled": round(necessity_share, 4),
            "necessity_total_modeled": round(necessity_total_modeled, 1),
            "expenditure_by_category_modeled": expenditure_by_category_modeled,
            "housing_owner_share": None,
            "housing_owner_imputed_rent_estimate": None,
        })
    out = {
        "source": f"Modeled: {country_name} income deciles (SSB/SCB) x Finland necessity-share curve (Statistics Finland HBS 2022)",
        "country": country_code,
        "year": src_rows[0].get('year', 2024),
        "unit": currency,
        "price_basis": f"nominal_2024",
        "data_tier": "C",
        "modeled_from": "FI",
        "breakdown": "by_decile",
        "categories": category_keys,
        "rows": modeled_rows,
        "methodology": (
            f"{country_name}'s household budget/consumption survey was discontinued "
            f"(Norway: Forbruksundersokelsen, after 2012; Sweden: HUT, after 2009), so no "
            f"post-discontinuation category-level expenditure data exists. Per "
            f"docs/v3-plan.md's peer-modeling guidance, we model {country_name}'s "
            f"necessity/discretionary expenditure split by: (1) computing Finland's "
            f"(Statistics Finland Household Budget Survey / Kulutustutkimus 2022, the "
            f"most recent Nordic HBS with full category-level detail) necessity share "
            f"[minimal strictness: housing + food_at_home + healthcare_oop + "
            f"transport_work-or-0.6x(transport_total)] as a fraction of total household "
            f"expenditure, separately for each of Finland's 5 income quintiles; (2) "
            f"fitting a monotone piecewise-linear interpolation of this necessity-share "
            f"curve across quintile centers (mapped to decile positions 1.5, 3.5, 5.5, "
            f"7.5, 9.5), holding the share constant at Finland's q1 value below the curve's "
            f"lower anchor and at Finland's q5 value above its upper anchor (per "
            f"v3-plan.md's stated extrapolation rule); (3) applying the resulting "
            f"decile-indexed necessity-share curve directly to {country_name}'s own "
            f"published income-decile disposable-income figures (source: "
            f"{'SSB table 12682' if country_code=='NO' else 'SCB HE0110F/TabVX10InkStrukt'}). "
            f"SIMPLIFYING ASSUMPTION (flagged, not hidden): because {country_name} publishes "
            f"income but not expenditure totals, we assume total household expenditure "
            f"approximately equals disposable income at each decile (i.e., a 0% net saving "
            f"rate) purely for the purpose of allocating the necessity/discretionary split -- "
            f"this will understate the true expenditure total if {country_name} households "
            f"save a meaningfully positive share of disposable income at a given decile "
            f"(true almost everywhere, especially at high deciles), so 'necessity_total_modeled' "
            f"should be read as a share-of-income lower bound / a conservative necessity floor "
            f"rather than a literal expenditure prediction. Frontend should badge this data "
            f"'Modeled from FI peer (Tier C)' per v3-plan.md, with caveat text: "
            f"\"{country_name}'s household budget survey was discontinued after "
            f"{'2012' if country_code=='NO' else '2009'}. Necessity floor here assumes "
            f"{'Norwegian' if country_code=='NO' else 'Swedish'} households allocate spending "
            f"in similar proportions to Finnish households at the same income level.\""
        ),
        "source_url_income": ("https://www.ssb.no/en/statbank/table/12682" if country_code == "NO"
                               else "https://www.statistikdatabasen.scb.se/pxweb/en/ssd/START__HE__HE0110__HE0110F/TabVX10InkStrukt/"),
        "source_url_necessity_curve": "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14pg.px ; https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14qa.px",
        "finland_necessity_share_curve_by_quintile": {q['group']: round(q['necessity_share'], 4) for q in fi_quintiles},
    }
    return out

no_out = build_modeled("NO", "Norway", no['rows'], "NOK")
se_out = build_modeled("SE", "Sweden", se['rows'], "SEK")

with open('/home/user/workspace/income-tiles/data/v3/no_expenditure_modeled.json', 'w') as f:
    json.dump(no_out, f, indent=2, ensure_ascii=False)
with open('/home/user/workspace/income-tiles/data/v3/se_expenditure_modeled.json', 'w') as f:
    json.dump(se_out, f, indent=2, ensure_ascii=False)

print("\nWrote no_expenditure_modeled.json and se_expenditure_modeled.json")
print("\nNO sample d1:", no_out['rows'][0])
print("\nNO sample d10:", no_out['rows'][-1])
