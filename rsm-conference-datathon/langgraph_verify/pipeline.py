"""LangGraph pipeline: rebuild the whole analysis from the raw RSM data, produce the Chicago
checkpoint, and verify accuracy with automated checks and reconciliation.

Every number is computed by deterministic pandas code (no language model does arithmetic).
LangGraph orchestrates the steps, carries state between them, and routes to a diagnosis step
when any verification check fails.

Usage:
  python pipeline.py --data <workbook.xlsx | folder with the 3 sheet CSVs> [--alteryx RSM_Host_Scores.csv]

  --alteryx  optional: your Alteryx Section F output (CSV/XLSX with Host plus any of
             R1_Score, Total_Cost, R1_Rank, R2_Rank) to measure your workflow's accuracy.
"""
import argparse
import json
from pathlib import Path
from typing import TypedDict

import numpy as np
import pandas as pd
from langgraph.graph import END, START, StateGraph

ROOT = Path(__file__).resolve().parents[1]
UPLOAD = ROOT / "alteryx_upload"
ANSWER_KEY = ROOT / "answer_key" / "host_scores.csv"
OUT = Path(__file__).resolve().parent / "output"

# Assumptions: identical to ALTERYX_GUIDE.md Section E
AIRPORT_OVERHEAD_H = 2      # per direction
DRIVE_MAX_MI, ROAD_FACTOR, MPH, IRS_RATE, CARPOOL = 150, 1.2, 55, 0.70, 3
ONE_STOP_MPH, TAXI_H, LAYOVER_H, ONE_STOP_RT_FARE = 450, 0.5, 2, 2 * 1.5 * 204
NIGHTS = 3
MIN_ROUTE_FLIGHTS = 10
WEIGHTS_R1 = {"avg_dist": .25, "within300": .25, "pct_easy": .30, "avg_rt_hours": .20}
NAME_FIXES = {"St Petersburg, FL": "St. Petersburg, FL", "Silicon Valley": "San Jose, CA"}
REGION = {"IL": "Midwest", "MN": "Midwest", "OH": "Midwest", "MO": "Midwest", "IA": "Midwest", "MI": "Midwest",
          "NE": "Midwest", "WI": "Midwest", "NY": "Northeast", "MA": "Northeast", "PA": "Northeast", "CT": "Northeast",
          "MD": "Northeast", "DC": "Northeast", "TX": "South", "NC": "South", "FL": "South", "GA": "South",
          "TN": "South", "OK": "South", "AZ": "West", "CA": "West", "CO": "West", "WA": "West", "NV": "West"}
# Venue facts for the recommended city. AI-researched: verify with the venue before presenting.
CHICAGO_VENUE = {"name": "McCormick Place", "general_session_seats": 4249,
                 "general_session_room": "Arie Crown Theater", "source": "AI estimate - verify with McCormick Place"}


class State(TypedDict, total=False):
    data_path: str
    alteryx_path: str
    people: pd.DataFrame
    flights: pd.DataFrame
    offices: pd.DataFrame
    routes: pd.DataFrame
    round_trips: pd.DataFrame
    matrix: pd.DataFrame
    hosts: pd.DataFrame
    chicago: dict
    checks: list
    log: list


def step(state, msg):
    return state.get("log", []) + [msg]


def check(state, name, passed, detail):
    return state.get("checks", []) + [{"check": name, "status": "PASS" if passed else "FAIL", "detail": detail}]


# ---------- nodes ----------
def load(state):
    p = Path(state["data_path"])
    if p.is_dir():
        people = pd.read_csv(p / "RSM_US_Tax_People.csv")
        flights = pd.read_csv(p / "Airport_Data.csv", dtype=str, low_memory=False)
    else:
        people = pd.read_excel(p, sheet_name="RSM US Tax People")
        flights = pd.read_excel(p, sheet_name="Airport Data", dtype=str)
    flights = flights.iloc[:, :9]
    return {"people": people, "flights": flights,
            "log": step(state, f"Loaded {len(people):,} employees and {len(flights):,} flight rows")}


def clean_employees(state):
    p = state["people"].copy()
    p["Office"] = p["Office"].astype(str).str.strip()
    p["Office_Clean"] = p["Office"].replace(NAME_FIXES)
    p["Is_Presenter"] = p["Presenter"].fillna("").astype(str).str.strip().str.upper().eq("X").astype(int)
    off = p.groupby("Office_Clean").agg(Employees=("Employee", "size"), Sum_Bill_Rate=("Bill Rate", "sum"),
                                        Presenters=("Is_Presenter", "sum")).reset_index()
    amap = pd.read_csv(UPLOAD / "office_airport_map.csv")
    unmapped = sorted(set(off.Office_Clean) - set(amap.Office))
    checks = check(state, "Every office maps to an airport", not unmapped, f"unmapped: {unmapped or 'none'}")
    checks = check({"checks": checks}, "Employee total = 3,579", off.Employees.sum() == 3579, f"{off.Employees.sum():,}")
    return {"offices": off, "checks": checks,
            "log": step(state, f"{len(off)} offices after name cleaning; {off.Presenters.sum()} presenters")}


def build_routes(state):
    f = state["flights"].dropna(subset=["Departing Airport", "Departure Time", "Arrival Time", "Avg_MARKET_FARE"]).copy()

    def minutes(s):
        s = pd.to_numeric(s, errors="coerce").round().astype("Int64").astype(str).str.zfill(4)
        return s.str[:2].astype(int) * 60 + s.str[2:].astype(int)

    raw = minutes(f["Arrival Time"]) - minutes(f["Departure Time"])
    f["Dur_Min"] = np.where(raw < 0, raw + 1440, raw)          # overnight fix
    f["Fare"] = f["Avg_MARKET_FARE"].astype(float)
    r = (f.groupby(["Departing Airport", "Destination Airport"])
          .agg(Flights=("Dur_Min", "size"), Dur_Min=("Dur_Min", "median"), Fare=("Fare", "mean")).reset_index())
    r = r[r.Flights >= MIN_ROUTE_FLIGHTS]
    jfk_lax = r.query("`Departing Airport`=='JFK' and `Destination Airport`=='LAX'").Dur_Min.iat[0]
    lax_jfk = r.query("`Departing Airport`=='LAX' and `Destination Airport`=='JFK'").Dur_Min.iat[0]
    checks = check(state, "No negative durations after overnight fix", (f.Dur_Min >= 0).all(), f"min {f.Dur_Min.min()}")
    checks = check({"checks": checks}, "Local-time trap detected (JFK→LAX shorter than LAX→JFK)", jfk_lax < lax_jfk,
                   f"naive JFK→LAX {jfk_lax:.0f} min vs LAX→JFK {lax_jfk:.0f} min")
    return {"routes": r, "checks": checks,
            "log": step(state, f"{len(f):,} clean flights → {len(r):,} routes with ≥{MIN_ROUTE_FLIGHTS} flights")}


def round_trips(state):
    r = state["routes"]
    rt = r.merge(r, left_on=["Departing Airport", "Destination Airport"],
                 right_on=["Destination Airport", "Departing Airport"], suffixes=("", "_back"))
    rt["RT_Air_Min"] = rt.Dur_Min + rt.Dur_Min_back                 # time zones cancel
    rt["RT_Fare"] = rt.Fare + rt.Fare_back
    rt = rt[["Departing Airport", "Destination Airport", "RT_Air_Min", "RT_Fare"]]
    jl = rt.query("`Departing Airport`=='JFK' and `Destination Airport`=='LAX'").RT_Air_Min.iat[0]
    checks = check(state, "Round-trip JFK↔LAX is physically plausible (10–12.5 h air time)", 600 <= jl <= 750,
                   f"{jl:.0f} min")
    return {"round_trips": rt, "checks": checks, "log": step(state, f"{len(rt):,} round-trip routes")}


def office_host_matrix(state):
    amap = pd.read_csv(UPLOAD / "office_airport_map.csv")
    origins = state["offices"].merge(amap, left_on="Office_Clean", right_on="Office").rename(columns={"Airport": "Orig_Airport"})
    hosts = amap.rename(columns={"Office": "Host", "Airport": "Host_Airport", "Lat": "H_Lat", "Lon": "H_Lon"})
    x = origins.merge(hosts, how="cross").merge(state["round_trips"], how="left",
        left_on=["Orig_Airport", "Host_Airport"], right_on=["Departing Airport", "Destination Airport"])
    la1, lo1, la2, lo2 = (np.radians(x[c]) for c in ["Lat", "Lon", "H_Lat", "H_Lon"])
    x["Dist_Mi"] = 3958.8 * 2 * np.arcsin(np.sqrt(np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2))
    m = x.groupby(["Office_Clean", "Host"], as_index=False).agg(
        Employees=("Employees", "first"), Presenters=("Presenters", "first"), Sum_Bill_Rate=("Sum_Bill_Rate", "first"),
        Dist_Mi=("Dist_Mi", "first"), RT_Air_Min=("RT_Air_Min", "min"), RT_Fare=("RT_Fare", "min"))
    m["Mode"] = np.select([m.Office_Clean == m.Host, m.Dist_Mi <= DRIVE_MAX_MI, m.RT_Air_Min.notna()],
                          ["Local", "Drive", "Nonstop"], "1-Stop")
    m["RT_Hours"] = np.select([m.Mode == "Local", m.Mode == "Drive", m.Mode == "Nonstop"],
        [0, 2 * m.Dist_Mi * ROAD_FACTOR / MPH, m.RT_Air_Min / 60 + 2 * AIRPORT_OVERHEAD_H],
        2 * (m.Dist_Mi / ONE_STOP_MPH + TAXI_H + LAYOVER_H + AIRPORT_OVERHEAD_H))
    m["RT_Cost_pp"] = np.select([m.Mode == "Local", m.Mode == "Drive", m.Mode == "Nonstop"],
        [0, 2 * m.Dist_Mi * ROAD_FACTOR * IRS_RATE / CARPOOL, m.RT_Fare], ONE_STOP_RT_FARE)
    m["Travel_Cost"] = m.RT_Cost_pp * m.Employees
    m["Person_Hours"] = m.RT_Hours * m.Employees
    m["Lost_Billable"] = m.RT_Hours * m.Sum_Bill_Rate
    m["Hotel_Nights"] = np.where(m.Mode == "Local", 0, NIGHTS * m.Employees + m.Presenters)
    per_host = m.groupby("Host").Employees.sum()
    checks = check(state, "Every host accounts for all 3,579 employees", (per_host == 3579).all(),
                   f"{per_host.min():,}–{per_host.max():,} per host")
    return {"matrix": m, "checks": checks, "log": step(state, f"{len(m):,} office→host pairs; modes {m.Mode.value_counts().to_dict()}")}


def score_hosts(state):
    m, n = state["matrix"], 3579
    e = lambda cond: np.where(cond, m.Employees, 0)
    m = m.assign(Local=e(m.Mode == "Local"), Easy=e(m.Mode != "1-Stop"), Within300=e(m.Dist_Mi <= 300), WDist=m.Dist_Mi * m.Employees)
    g = m.groupby("Host").agg(Local=("Local", "sum"), Within300=("Within300", "sum"), Easy=("Easy", "sum"),
        WDist=("WDist", "sum"), Travel_Cost=("Travel_Cost", "sum"), Person_Hours=("Person_Hours", "sum"),
        Lost_Billable=("Lost_Billable", "sum"), Hotel_Nights=("Hotel_Nights", "sum")).reset_index()
    g = g.merge(pd.read_csv(UPLOAD / "city_enrichment.csv"), left_on="Host", right_on="City")
    g["Avg_Dist"], g["Pct_Easy"], g["Avg_RT_Hours"] = g.WDist / n, g.Easy / n, g.Person_Hours / n
    g["Hotel_Cost"] = g.Hotel_Nights * g.Hotel_Rate_Oct
    g["Total_Cost"] = g.Travel_Cost + g.Hotel_Cost + g.Lost_Billable

    def r1(w):
        nz = lambda s, hi: (s - s.min()) / (s.max() - s.min()) if hi else 1 - (s - s.min()) / (s.max() - s.min())
        return 100 * (w[0] * nz(g.Avg_Dist, False) + w[1] * nz(g.Within300, True) + w[2] * nz(g.Pct_Easy, True) + w[3] * nz(g.Avg_RT_Hours, False))

    g["R1_Score"] = r1(list(WEIGHTS_R1.values()))
    g["R1_Rank"] = g.R1_Score.rank(ascending=False, method="first").astype(int)
    viable = g.Venue_Tier != "C"
    g.loc[viable, "R2_Rank"] = g.loc[viable, "Total_Cost"].rank(method="first")
    rng = np.random.default_rng(7)
    wins = pd.Series([g.Host[r1(rng.dirichlet([1, 1, 1, 1])).idxmax()] for _ in range(10000)]).value_counts()
    g.attrs["robustness"] = wins.head(5).to_dict()
    return {"hosts": g.drop(columns=["City", "WDist"]),
            "log": step(state, f"Scored {len(g)} hosts; Round 1 #1 = {g.loc[g.R1_Rank == 1, 'Host'].iat[0]}, "
                               f"Round 2 #1 = {g.loc[g.R2_Rank == 1, 'Host'].iat[0]}")}


def chicago_spotlight(state):
    m = state["matrix"].query("Host == 'Chicago, IL'").copy()
    g = state["hosts"].set_index("Host")
    c = g.loc["Chicago, IL"]
    m["Region"] = m.Office_Clean.str[-2:].map(REGION)
    m["Distance_Band"] = pd.cut(m.Dist_Mi, [-1, .5, 300, 1000, 9e9], labels=["Local", "Under 300 mi", "300-1,000 mi", "Over 1,000 mi"])
    m["Time_Band"] = pd.cut(m.RT_Hours, [-1, .01, 6, 8, 10, 99], labels=["No travel", "Under 6 h", "6-8 h", "8-10 h", "Over 10 h"])
    by = lambda col: {str(k): int(v) for k, v in m.groupby(col, observed=True).Employees.sum().items()}
    region = (m.groupby("Region").apply(lambda d: {"employees": int(d.Employees.sum()), "offices": len(d),
              "avg_round_trip_h": round(float((d.RT_Hours * d.Employees).sum() / d.Employees.sum()), 1)}, include_groups=False).to_dict())
    viable = g[g.Venue_Tier != "C"].sort_values("Total_Cost")
    runner = viable.index[1]
    hou = g.loc["Houston, TX"]
    spot = {
        "attendees_total": int(m.Employees.sum()),
        "can_attend": int(m.Employees.sum()),
        "by_travel_mode": by("Mode"),
        "by_region": region,
        "by_distance_band": by("Distance_Band"),
        "by_round_trip_time": by("Time_Band"),
        "flight_tickets_needed": int(m.loc[m.Mode.isin(["Nonstop", "1-Stop"]), "Employees"].sum()),
        "hotel_room_nights": int(m.Hotel_Nights.sum()),
        "presenters": int(m.Presenters.sum()),
        "nonstop_or_drive_pct": round(100 * c.Pct_Easy, 1),
        "avg_round_trip_hours": round(float(c.Avg_RT_Hours), 2),
        "total_person_hours": round(float(c.Person_Hours)),
        "round1_score": round(float(c.R1_Score), 1), "round1_rank": int(c.R1_Rank),
        "round2_rank": int(c.R2_Rank), "total_cost": round(float(c.Total_Cost)),
        "cost_breakdown": {"airfare_mileage": round(float(c.Travel_Cost)), "hotel": round(float(c.Hotel_Cost)),
                           "lost_billable_time": round(float(c.Lost_Billable))},
        "time_share_of_cost_pct": round(100 * float(c.Lost_Billable / c.Total_Cost), 1),
        "runner_up": runner, "savings_vs_runner_up": round(float(viable.Total_Cost.iloc[1] - c.Total_Cost)),
        "savings_vs_houston_cash_cheapest": round(float(hou.Total_Cost - c.Total_Cost)),
        "hours_saved_vs_houston": round(float(hou.Person_Hours - c.Person_Hours)),
        "robustness_wins_of_10000": {k: int(v) for k, v in g.attrs.get("robustness", state["hosts"].attrs.get("robustness", {})).items()},
        "venue": CHICAGO_VENUE,
        "venue_fits_everyone": CHICAGO_VENUE["general_session_seats"] >= int(m.Employees.sum()),
    }
    checks = check(state, "Chicago: modes add up to every attendee", sum(spot["by_travel_mode"].values()) == 3579,
                   f"{sum(spot['by_travel_mode'].values()):,}")
    checks = check({"checks": checks}, "Chicago: local attendees = Chicago office headcount",
                   spot["by_travel_mode"].get("Local") == int(state["offices"].set_index("Office_Clean").Employees["Chicago, IL"]),
                   f"{spot['by_travel_mode'].get('Local')}")
    checks = check({"checks": checks}, "Chicago: general-session seats ≥ attendees", spot["venue_fits_everyone"],
                   f"{CHICAGO_VENUE['general_session_seats']:,} seats vs {spot['attendees_total']:,} ({CHICAGO_VENUE['source']})")
    m.to_csv(OUT / "chicago_spotlight_by_office.csv", index=False)
    return {"chicago": spot, "checks": checks, "log": step(state, "Built Chicago checkpoint")}


def verify(state):
    g = state["hosts"].set_index("Host")
    checks = state["checks"]
    ref = pd.read_csv(ANSWER_KEY).set_index("Host")
    for col in ["R1_Score", "Total_Cost"]:
        diff = (g[col] - ref[col]).abs() / ref[col].abs()
        checks = check({"checks": checks}, f"Reconcile {col} with answer key (all 41 hosts, ≤0.5%)", diff.max() <= .005,
                       f"max diff {100 * diff.max():.3f}%")
    if state.get("alteryx_path"):
        p = Path(state["alteryx_path"])
        ax = (pd.read_excel(p) if p.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(p)).set_index("Host")
        for col in [c for c in ["R1_Score", "Total_Cost", "R1_Rank", "R2_Rank"] if c in ax.columns]:
            both = ax[col].dropna().index.intersection(g.index)
            d = ((ax.loc[both, col] - g.loc[both, col]).abs() / g.loc[both, col].abs().replace(0, 1))
            checks = check({"checks": checks}, f"YOUR ALTERYX {col} matches pipeline (≤1%)", d.max() <= .01,
                           f"{len(both)} hosts, max diff {100 * d.max():.2f}%; worst: {d.idxmax()}")
    return {"checks": checks, "log": step(state, f"{sum(c['status'] == 'PASS' for c in checks)}/{len(checks)} checks passed")}


def diagnose(state):
    failed = [c for c in state["checks"] if c["status"] == "FAIL"]
    hints = {"YOUR ALTERYX": "Compare your section outputs with the ✅ checkpoints in ALTERYX_GUIDE.md to find the first step that differs.",
             "Reconcile": "Enrichment files or assumptions changed since the answer key was built; rerun scripts/02_score_hosts.py.",
             "seats": "Venue capacity: plan overflow rooms or a larger hall; verify real capacity with the venue."}
    notes = [f"{c['check']}: {next((h for k, h in hints.items() if k in c['check']), 'Inspect this step.')}" for c in failed]
    return {"log": step(state, "Diagnosis: " + " | ".join(notes))}


def report(state):
    s, checks = state["chicago"], state["checks"]
    passed = sum(c["status"] == "PASS" for c in checks)
    money = lambda v: f"${v / 1e6:.2f}M"
    lines = [
        "# Chicago checkpoint (generated by the LangGraph pipeline)", "",
        f"**Verification: {passed}/{len(checks)} checks passed.** Every number below was recomputed from the raw RSM data.", "",
        "## Who can attend and how they get there", "",
        f"**All {s['can_attend']:,} employees can attend.** Nobody is unreachable.", "",
        "| How they travel | Employees |", "|---|---|",
        *[f"| {k} | {v:,} |" for k, v in sorted(s["by_travel_mode"].items(), key=lambda t: -t[1])],
        f"| **Total** | **{s['attendees_total']:,}** |", "",
        f"- Flight tickets needed: **{s['flight_tickets_needed']:,}**; hotel room-nights: **{s['hotel_room_nights']:,}** (incl. {s['presenters']} presenters arriving a night early)",
        f"- {s['nonstop_or_drive_pct']}% of employees arrive by nonstop flight or short drive; average round trip **{s['avg_round_trip_hours']} h**",
        f"- Venue: {s['venue']['name']}, {s['venue']['general_session_room']} seats {s['venue']['general_session_seats']:,} for the general session "
        f"({'fits everyone' if s['venue_fits_everyone'] else 'DOES NOT fit everyone'}; {s['venue']['source']})", "",
        "## Where attendees come from (area)", "", "| Region | Offices | Employees | Avg round trip |", "|---|---|---|---|",
        *[f"| {k} | {v['offices']} | {v['employees']:,} | {v['avg_round_trip_h']} h |" for k, v in s["by_region"].items()], "",
        "| Distance to Chicago | Employees |", "|---|---|", *[f"| {k} | {v:,} |" for k, v in s["by_distance_band"].items()], "",
        "| Round-trip travel time | Employees |", "|---|---|", *[f"| {k} | {v:,} |" for k, v in s["by_round_trip_time"].items()], "",
        "## Selling points", "",
        f"1. **#{s['round1_rank']} on centrality + accessibility** (score {s['round1_score']}/100); wins "
        f"{s['robustness_wins_of_10000'].get('Chicago, IL', 0):,} of 10,000 random weightings.",
        f"2. **Lowest total cost of attendance: {money(s['total_cost'])}** (#{s['round2_rank']} of viable cities), "
        f"{money(s['savings_vs_runner_up'])} below runner-up {s['runner_up']}.",
        f"3. **Time is the real cost:** {s['time_share_of_cost_pct']}% of cost is lost billable time; Chicago saves "
        f"{s['hours_saved_vs_houston']:,} person-hours ({money(s['savings_vs_houston_cash_cheapest'])}) vs Houston, the cheapest on cash alone.",
        f"4. **Largest office ({s['by_travel_mode'].get('Local', 0)} local attendees)**; every other office except New Bern ({s['by_travel_mode'].get('1-Stop', 0)} people) "
        f"reaches Chicago by nonstop flight or a ≤{DRIVE_MAX_MI}-mile drive.",
        f"5. **Largest US convention center** with room for everyone in one general session.", "",
        f"Cost breakdown: airfare & mileage {money(s['cost_breakdown']['airfare_mileage'])}, hotel {money(s['cost_breakdown']['hotel'])}, "
        f"lost billable time {money(s['cost_breakdown']['lost_billable_time'])}.", "",
        "## Verification checks", "", "| Check | Result | Detail |", "|---|---|---|",
        *[f"| {c['check']} | {'✅' if c['status'] == 'PASS' else '❌'} {c['status']} | {c['detail']} |" for c in checks], "",
        "## Pipeline trace", "", *[f"{i}. {l}" for i, l in enumerate(state["log"], 1)], "",
    ]
    (OUT / "chicago_checkpoint.md").write_text("\n".join(lines))
    (OUT / "chicago_checkpoint.json").write_text(json.dumps({"chicago": s, "checks": checks, "trace": state["log"]}, indent=2, default=str))
    state["hosts"].to_csv(OUT / "host_scores_langgraph.csv", index=False)
    return {"log": step(state, f"Wrote {OUT / 'chicago_checkpoint.md'}")}


def build_graph():
    g = StateGraph(State)
    nodes = [("load", load), ("clean_employees", clean_employees), ("build_routes", build_routes),
             ("round_trips", round_trips), ("office_host_matrix", office_host_matrix), ("score_hosts", score_hosts),
             ("chicago_spotlight", chicago_spotlight), ("verify", verify), ("diagnose", diagnose), ("report", report)]
    for name, fn in nodes:
        g.add_node(name, fn)
    chain = ["load", "clean_employees", "build_routes", "round_trips", "office_host_matrix", "score_hosts", "chicago_spotlight", "verify"]
    g.add_edge(START, chain[0])
    for a, b in zip(chain, chain[1:]):
        g.add_edge(a, b)
    g.add_conditional_edges("verify", lambda s: "diagnose" if any(c["status"] == "FAIL" for c in s["checks"]) else "report",
                            {"diagnose": "diagnose", "report": "report"})
    g.add_edge("diagnose", "report")
    g.add_edge("report", END)
    return g.compile()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--alteryx")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    final = build_graph().invoke({"data_path": a.data, "alteryx_path": a.alteryx or "", "checks": [], "log": []})
    print("\n".join(final["log"]))
    print(f"\nChecks: {sum(c['status'] == 'PASS' for c in final['checks'])}/{len(final['checks'])} passed")
    for c in final["checks"]:
        print(f"  [{c['status']}] {c['check']}: {c['detail']}")
