#!/usr/bin/env python3
"""
A.5 - Forbes top-10 billionaires per country (income estimate).

Source: Forbes Real-Time Billionaires (https://www.forbes.com/real-time-billionaires/),
cross-referenced with Forbes' own country/profile pages and third-party aggregators that
mirror Forbes Real-Time Billionaires data (Countly.net, Beinsure, Handelsblatt, Forbes Japan
list) where Forbes' own site could not be filtered by country via direct fetch (client-side
rendered filter). Snapshot date 2026-08-03. Numbers fluctuate daily with market moves; this
is a point-in-time snapshot, not a live feed.

est_annual_income_usd = wealth_usd * 0.04 (4% typical portfolio yield assumption).
"""
import json

YIELD = 0.04
SNAPSHOT_DATE = "2026-08-03"

COUNTRIES = {
    "US": [
        ("Elon Musk", 690.1e9, "Tesla, SpaceX"),
        ("Larry Page", 292.1e9, "Google"),
        ("Jeff Bezos", 278.1e9, "Amazon"),
        ("Sergey Brin", 269.4e9, "Google"),
        ("Michael Dell", 229.2e9, "Dell Technologies"),
        ("Mark Zuckerberg", 191.3e9, "Facebook"),
        ("Jensen Huang", 173.6e9, "Semiconductors (Nvidia)"),
        ("Larry Ellison", 167.5e9, "Oracle"),
        ("Warren Buffett", 145.1e9, "Berkshire Hathaway"),
        ("Steve Ballmer", 144.5e9, "Microsoft"),
    ],
    "DE": [
        ("Dieter Schwarz", 64.9e9, "Retail (Lidl, Kaufland)"),
        ("Klaus-Michael Kuehne", 41.9e9, "Shipping (Kuehne + Nagel)"),
        ("Andreas von Bechtolsheim & family", 34.2e9, "Google, Arista (tech investor)"),
        ("Reinhold Wuerth & family", 28.0e9, "Fasteners (Wuerth Group)"),
        ("Susanne Klatten", 24.7e9, "BMW, pharmaceuticals (Altana)"),
        ("Stefan Quandt", 24.0e9, "BMW"),
        ("Georg Schaeffler", 17.4e9, "Auto parts (Schaeffler AG)"),
        ("Beate Heister", 16.8e9, "Supermarkets (Aldi Sued)"),
        ("Karl Albrecht Jr. & family", 16.8e9, "Supermarkets (Aldi Sued)"),
        ("Ludwig Merckle", 16.8e9, "Pharmaceuticals"),
    ],
    "UK": [
        ("Michael Platt", 20.9e9, "BlueCrest Capital Management"),
        ("Nik Storonsky", 18.8e9, "Revolut"),
        ("Jim Ratcliffe", 18.4e9, "Ineos"),
        ("James Dyson", 15.0e9, "Dyson"),
        ("Simon Reuben", 13.3e9, "Reuben Brothers"),
        ("David Reuben", 13.3e9, "Reuben Brothers"),
        ("Alexander Gerko", 12.0e9, "XTX Markets"),
        ("Christopher Hohn", 11.8e9, "The Children's Investment Fund"),
        ("Anthony Bamford & family", 10.0e9, "JCB"),
        ("Denise Coates", 8.1e9, "bet365"),
    ],
    "NO": [
        ("Torstein Hagen", 18.4e9, "Viking Cruises"),
        ("Odd Reitan & family", 9.1e9, "Reitan Group (retail)"),
        ("Ole Andreas (Andreas) Halvorsen", 8.0e9, "Viking Global Investors"),
        ("Kjell Inge Roekke", 7.7e9, "Aker ASA (shipping, seafood, energy)"),
        ("Gustav Magnar Witzoe", 4.5e9, "SalMar (fish farming)"),
        ("Ivar Tollefsen", 4.2e9, "Real estate (Tollefsen Enterprises)"),
        ("Caroline Hagen Kjos", 3.3e9, "Canica (conglomerate)"),
        ("Stein Erik Hagen", 2.8e9, "Rimi / consumer goods"),
        ("Katharina Andresen", 2.5e9, "Ferd (investments)"),
        ("Alexandra Andresen", 2.5e9, "Ferd (investments)"),
    ],
    "SE": [
        ("Stefan Persson", 21.1e9, "H&M"),
        ("Antonia Ax:son Johnson & family", 13.4e9, "Diversified (Axel Johnson Group)"),
        ("Finn Rausing", 11.6e9, "Packaging (Tetra Laval)"),
        ("Joern Rausing", 11.6e9, "Packaging (Tetra Laval)"),
        ("Kirsten Rausing", 11.6e9, "Packaging (Tetra Laval)"),
        ("Martin Lorentzon", 10.8e9, "Spotify"),
        ("Carl Bennet", 10.0e9, "Investments (Lifco, Getinge)"),
        ("Daniel Ek", 9.6e9, "Spotify"),
        ("Fredrik Lundberg", 9.4e9, "Real estate, investments"),
        ("Frederik Paulsen", 7.6e9, "Health care (Ferring)"),
    ],
    "FI": [
        ("Antti Herlin", 4.0e9, "Elevators, escalators (KONE)"),
        ("Mika Anttonen", 2.3e9, "Oil & gas"),
        ("Heikki Kyoestilae", 2.2e9, "Dental products"),
        ("Heikki Herlin", 2.1e9, "Elevators, escalators (KONE)"),
        ("Ilkka Herlin", 2.0e9, "Elevators, escalators (KONE)"),
        ("Ilona Herlin", 1.9e9, "Elevators, escalators (KONE)"),
        ("Antti Aarnio-Wihuri", 1.5e9, "Diversified"),
    ],
    "CH": [
        ("Gianluigi Aponte", 44.5e9, "Shipping (MSC)"),
        ("Rafaela Aponte-Diamant", 44.5e9, "Shipping (MSC)"),
        ("Ernesto Bertarelli & family", 12.0e9, "Biotech, investments (ex-Serono)"),
        ("Ivan Glasenberg", 13.0e9, "Commodities (ex-Glencore)"),
        ("Thomas Schmidheiny", 11.7e9, "Cement (Holcim heir)"),
        ("Magdalena Martullo-Blocher", 9.5e9, "Chemicals (Ems-Chemie)"),
        ("Rahel Blocher", 8.0e9, "Chemicals (Ems-Chemie)"),
        ("Guillaume Pousaz", 8.0e9, "Fintech (Checkout.com)"),
        ("Andre Hoffmann", 8.4e9, "Health care (Roche heir)"),
        ("Vera Michalski-Hoffmann", 7.5e9, "Health care (Roche heir)"),
    ],
    "JP": [
        ("Tadashi Yanai & family", 65.0e9, "Fashion & retail (Fast Retailing / Uniqlo)"),
        ("Masayoshi Son", 80.0e9, "Finance & investments (SoftBank)"),
        ("Takemitsu Takizaki", 23.6e9, "Manufacturing (Keyence)"),
        ("Nobutada Saji & family", 9.3e9, "Food & beverage (Suntory)"),
        ("Sekiya family", 9.1e9, "Technology (Disco)"),
        ("Yasumitsu Shigeta", 6.0e9, "Telecom & tech (Hikari Tsushin)"),
        ("Takao Yasuda", 4.7e9, "Fashion & retail (Pan Pacific International)"),
        ("Hideyuki Busujima & family", 4.6e9, "Gambling & casinos"),
        ("Toichi Takenaka", 4.0e9, "Construction (Takenaka Corporation)"),
        ("Akira Mori & family", 3.95e9, "Real estate (Mori Trust)"),
    ],
}


def main():
    out = {
        "source": "Forbes Real-Time Billionaires",
        "source_url": "https://www.forbes.com/real-time-billionaires/",
        "snapshot_date": SNAPSHOT_DATE,
        "yield_assumption": YIELD,
        "notes": (
            "Wealth from Forbes Real-Time Billionaires (US list fetched directly; DE/UK/NO/SE/FI/CH/JP "
            "compiled from Forbes' own country-specific coverage and lists that mirror Forbes Real-Time "
            "Billionaires data, since Forbes' site country filter is client-side rendered and not "
            "directly fetchable). Estimated annual income = wealth * 4%. NOT IRS-reported income; "
            "realized income can differ dramatically year-to-year (e.g. Musk 2021 realized $23B). "
            "Wealth figures fluctuate daily with market prices -- treat as a snapshot, not a live feed. "
            "Finland has only 7 Forbes-listed billionaires (smallest economy of the 8), so its list has "
            "7 entries rather than 10."
        ),
        "countries": {},
    }
    for iso, entries in COUNTRIES.items():
        rows = []
        for i, (name, wealth, source) in enumerate(entries, start=1):
            rows.append({
                "rank": i,
                "name": name,
                "wealth_usd": wealth,
                "est_annual_income_usd": round(wealth * YIELD, 2),
                "source_of_wealth": source,
            })
        out["countries"][iso] = rows
    with open("/home/user/workspace/income-tiles/data/v3/forbes_top10.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Wrote forbes_top10.json")


if __name__ == "__main__":
    main()
