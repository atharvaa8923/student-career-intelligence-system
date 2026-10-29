"""Render slide-ready PNG charts from answer_key/host_scores.csv.

Usage: python make_charts.py <answer_key_dir> <charts_dir>
"""
import sys
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

AK, OUT = sys.argv[1], sys.argv[2]
g = pd.read_csv(f"{AK}/host_scores.csv")
off = pd.read_csv(f"{AK}/office_headcount.csv")

BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
GRAY, INK, INK2, GRID, BG = "#c9c8c2", "#0b0b0b", "#52514e", "#e7e6e1", "#fcfcfb"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 12, "axes.edgecolor": GRID,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False, "figure.facecolor": BG,
    "axes.facecolor": BG, "savefig.facecolor": BG,
})
short = lambda s: s.split(",")[0]


def finish(fig, ax, title, sub, name):
    h = fig.get_size_inches()[1]
    fig.text(0.02, 1 - 0.35 / h, title, ha="left", va="top", fontsize=17, fontweight="bold", color=INK)
    fig.text(0.02, 1 - 0.75 / h, sub, ha="left", va="top", fontsize=11.5, color=INK2)
    fig.tight_layout(rect=(0, 0, 1, 1 - 1.15 / h))
    fig.savefig(f"{OUT}/{name}.png", dpi=200)
    plt.close(fig)


# 1. Where employees sit (centrality)
o = off.sort_values("emps").tail(15)
fig, ax = plt.subplots(figsize=(10, 6))
ax.barh(o.Office_Clean.map(short), o.emps, color=[BLUE if c == "Chicago, IL" else GRAY for c in o.Office_Clean], height=0.62)
for y, v in enumerate(o.emps):
    ax.text(v + 4, y, f"{v:,}", va="center", fontsize=10, color=INK2)
ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True); ax.set_xlabel("Employees")
finish(fig, ax, "Chicago is RSM Tax's largest office", "Top 15 of 41 offices by headcount (3,579 employees total)", "01_headcount_by_office")

# 2. Round 1 score (centrality + accessibility)
t = g.sort_values("R1_Score", ascending=False).head(10).iloc[::-1]
fig, ax = plt.subplots(figsize=(10, 6))
ax.barh(t.Host.map(short), t.R1_Score, color=[BLUE if h == "Chicago, IL" else GRAY for h in t.Host], height=0.62)
for y, v in enumerate(t.R1_Score):
    ax.text(v + 0.8, y, f"{v:.0f}", va="center", fontsize=10, color=INK2)
ax.set_xlim(0, 105); ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True)
ax.set_xlabel("Round 1 score (0-100): 50% centrality, 50% accessibility")
finish(fig, ax, "Round 1: Chicago is the most central and accessible city", "Top 10 of 41 candidate office cities", "02_round1_scores")

# 3. Total cost of attendance, stacked (viable venues only)
v = g[g.Venue_Tier != "C"].sort_values("Total_Cost").head(8).iloc[::-1]
fig, ax = plt.subplots(figsize=(11, 6))
y = range(len(v)); left = 0
for col, c, lab in [("Travel_Cost", BLUE, "Airfare & mileage"), ("Hotel_Cost", ORANGE, "Hotel"), ("Lost_Billable", AQUA, "Lost billable time")]:
    ax.barh(y, v[col] / 1e6, left=left, color=c, height=0.62, label=lab, edgecolor=BG, linewidth=2)
    left = left + v[col].values / 1e6
for i, tot in enumerate(v.Total_Cost / 1e6):
    ax.text(tot + 0.15, i, f"${tot:.1f}M", va="center", fontsize=10.5, color=INK, fontweight="bold" if i == len(v) - 1 else "normal")
ax.set_yticks(list(y)); ax.set_yticklabels(v.Host.map(short))
ax.set_xlim(0, v.Total_Cost.max() / 1e6 * 1.12); ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True)
ax.set_xlabel("Total cost of attendance ($ millions)")
ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.24), ncol=3, frameon=False)
finish(fig, ax, "Round 2: Chicago is still cheapest once time is priced in", "8 lowest-cost cities with a venue that can host ~3,600 people", "03_round2_total_cost")

# 4. Time is the real cost (Chicago breakdown)
c = g[g.Host == "Chicago, IL"].iloc[0]
parts = [("Lost billable time", c.Lost_Billable, AQUA), ("Hotel", c.Hotel_Cost, ORANGE), ("Airfare & mileage", c.Travel_Cost, BLUE)]
fig, ax = plt.subplots(figsize=(10, 3.8))
left = 0
for i, (lab, val, col) in enumerate(parts):
    ax.barh([0], [val / 1e6], left=left, color=col, height=0.5, edgecolor=BG, linewidth=2)
    x = left + val / 2e6 if i == 0 else left + val / 1e6
    ax.text(x, -0.35 - 0.38 * i if i else -0.35, f"{lab}  ${val/1e6:.1f}M ({val/c.Total_Cost:.0%})",
            ha="center" if i == 0 else "right", va="top", fontsize=10.5, color=INK)
    left += val / 1e6
ax.set_ylim(-1.25, 0.3); ax.axis("off")
finish(fig, ax, "81% of the conference's travel cost is employee time", f"Chicago: ${c.Total_Cost/1e6:.1f}M total cost of attendance", "04_time_is_money")

# 5. Avg round-trip hours per employee
t = g.sort_values("Avg_RT_Hours").head(10).iloc[::-1]
fig, ax = plt.subplots(figsize=(10, 6))
ax.barh(t.Host.map(short), t.Avg_RT_Hours, color=[BLUE if h == "Chicago, IL" else GRAY for h in t.Host], height=0.62)
for yy, val in enumerate(t.Avg_RT_Hours):
    ax.text(val + 0.1, yy, f"{val:.1f} h", va="center", fontsize=10, color=INK2)
ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True); ax.set_xlabel("Average round-trip door-to-door hours per employee")
finish(fig, ax, "Chicago gets everyone there fastest", "10 cities with the lowest average travel time (all 3,579 employees)", "05_avg_travel_hours")

# 6. Round 1 -> Round 2 rank shift (slope chart, top 8 by R1)
t = g.sort_values("R1_Rank").head(8)
fig, ax = plt.subplots(figsize=(8, 7))
for _, r in t.iterrows():
    r2 = r.R2_Rank if pd.notna(r.R2_Rank) else 10
    col = BLUE if r.Host == "Chicago, IL" else GRAY
    ax.plot([0, 1], [r.R1_Rank, r2], color=col, lw=2.5 if col == BLUE else 2, marker="o", ms=8)
    ax.text(-0.04, r.R1_Rank, f"{short(r.Host)}  #{r.R1_Rank}", ha="right", va="center", fontsize=10.5, color=INK)
    lab = f"#{int(r.R2_Rank)}  {short(r.Host)}" if pd.notna(r.R2_Rank) else f"Out (no venue)  {short(r.Host)}"
    ax.text(1.04, r2, lab, ha="left", va="center", fontsize=10.5, color=INK)
ax.set_xlim(-0.6, 1.6); ax.set_ylim(23, -0.8); ax.axis("off")
ax.text(0, -0.2, "Round 1\ncentrality + access", ha="center", fontsize=10, color=INK2)
ax.text(1, -0.2, "Round 2\ntotal cost + venue", ha="center", fontsize=10, color=INK2)
finish(fig, ax, "The recommendation holds: Chicago stays #1", "Rank of Round 1's top 8 after adding cost and venue constraints", "06_rank_shift")
print("charts written")
