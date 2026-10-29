# RSM Datathon: Where should RSM host its next conference?

**Recommendation: Chicago, IL** (McCormick Place). Runner-up: St. Louis, MO.

| Metric | Chicago | Why it matters |
|---|---|---|
| Round 1 score (centrality + accessibility) | **93 / 100, #1 of 41** | Most central large city; 299 staff attend locally |
| Robustness | **Wins 86% of 10,000 random weightings** | The answer doesn't hinge on our weights |
| Staff with a nonstop flight or short drive | **99.9%** (all but 2) | Fewest connections = least friction |
| Average round-trip travel time per person | **7.6 h** (lowest) | 27,400 person-hours in total |
| Total cost of attendance | **$18.9M, #1 of 35 viable cities** | Airfare $1.3M + hotel $2.2M + lost billable time $15.4M |
| Savings vs alternatives | $0.7M (St. Louis) to $11.0M (San Francisco) | NYC: +$3.9M, Las Vegas: +$6.5M |

**Does the recommendation still stand after the cost and venue constraints? Yes.** On cash alone (airfare + hotel), Houston is cheapest and Chicago ranks only #24 because of its hotel rates. But 81% of the true cost is employee time, and Chicago saves enough of it to win by $1.6M over Houston. The pick flips only if employee travel time is valued at $0.

## What's in this folder

| Path | Use it for |
|---|---|
| [`ALTERYX_GUIDE.md`](ALTERYX_GUIDE.md) | **Start here.** Step-by-step Designer Cloud build with exact formulas and checkpoint numbers |
| [`PRESENTATION_PLAYBOOK.md`](PRESENTATION_PLAYBOOK.md) | 12-slide storyline, assumptions table, AI-usage slide, design rules, judge Q&A prep |
| `alteryx_upload/` | AI-enrichment files to upload to Alteryx: `office_airport_map.csv`, `city_enrichment.csv` |
| `answer_key/` | Expected outputs: host scores for all 41 cities, the office × host matrix, office headcount |
| `charts/` | 7 slide-ready PNG charts (Chicago highlighted) |
| `scripts/` | Python validation model and chart generator (the "AI verification" layer) |
| [`langgraph_verify/`](langgraph_verify/README.md) | LangGraph pipeline: rebuilds everything from raw data, Chicago checkpoint, 11 automated accuracy checks, checks your Alteryx output |
| [`decision-lab/`](decision-lab/RUN_WITH_RSM_DATA.md) | Interactive dashboard (FastAPI + LangGraph) loaded with the real results, for a live demo |

The provided RSM workbook (employee listing) is **not** committed here. Upload it to Alteryx directly.

## Reproduce the answer key

```bash
# export the workbook's 3 sheets to CSV in <csv_dir> first (Excel → Save As CSV)
python scripts/01_prepare_routes.py <csv_dir> <work_dir>
cp alteryx_upload/city_enrichment.csv <work_dir>/
python scripts/02_score_hosts.py <work_dir>
python scripts/make_charts.py answer_key charts
```

## Public repos from earlier runs of this RSM / Alteryx datathon

Found via GitHub search. They are outside this session's access, so they were **not** reviewed. Skim them for presentation ideas, but don't copy them; judges may have seen them.

- [RishiNatarajan6932/RSM-Conference-Location-Optimization-Alteryx-](https://github.com/RishiNatarajan6932/RSM-Conference-Location-Optimization-Alteryx-): same use case, Alteryx (Oct 2025)
- [agrawalmanyata/conference-location-optimization](https://github.com/agrawalmanyata/conference-location-optimization): same use case; Alteryx + AI + cost modeling (May 2026)
- [ramyarajeswarivissapragada/RSM-Conference-Location-Optimization](https://github.com/ramyarajeswarivissapragada/RSM-Conference-Location-Optimization): same use case, Jupyter notebook (Mar 2025)
- [manvimehta1009/Alteryx-RSM-Datathon-Project](https://github.com/manvimehta1009/Alteryx-RSM-Datathon-Project): an earlier RSM Alteryx datathon (different use case)
- [Prriyam/Alteryx-Datathon-Project](https://github.com/Prriyam/Alteryx-Datathon-Project): UT Dallas datathon with RSM/Alteryx (different use case)
