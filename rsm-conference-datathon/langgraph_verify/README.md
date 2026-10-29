# LangGraph verification pipeline

This pipeline rebuilds the entire analysis from the **raw RSM data**, produces the **Chicago checkpoint** (who can attend, how they travel, where they come from, and the selling points), and **verifies accuracy** with automated checks.

LangGraph organizes the steps; it doesn't make the numbers more accurate on its own. The accuracy comes from three things:

1. An independent rebuild from raw data.
2. Automated sanity and physics checks.
3. Reconciliation against the answer key and, optionally, **your own Alteryx output**.

No language model does any arithmetic.

```
load → clean_employees → build_routes → round_trips → office_host_matrix
     → score_hosts → chicago_spotlight → verify ─┬─(all pass)→ report
                                                 └─(any fail)→ diagnose → report
```

## Run

```sh
pip install langgraph pandas numpy openpyxl
python pipeline.py --data "SparkED_Use_Case__Data_for_AI_Day_STUDENT_VERSION.xlsx"
# after your Alteryx run, check its accuracy (export Section F output as CSV or XLSX):
python pipeline.py --data "<workbook>.xlsx" --alteryx RSM_Host_Scores.csv
```

Reading the 31 MB workbook takes a few minutes. Exporting the 3 sheets to CSV in one folder and passing that folder to `--data` is faster.

## Verified result (11/11 checks passed)

| Check | Result |
|---|---|
| Every office maps to an airport | ✅ |
| Employee total = 3,579 | ✅ |
| No negative durations after the overnight fix | ✅ |
| Local-time trap detected (naive JFK→LAX 180 min vs LAX→JFK 500 min) | ✅ |
| Round-trip JFK↔LAX is physically plausible (680 min) | ✅ |
| Every host accounts for all 3,579 employees | ✅ |
| Chicago: travel modes add up to every attendee | ✅ |
| Chicago: local attendees = Chicago office headcount (299) | ✅ |
| Chicago: general-session seats ≥ attendees (4,249 vs 3,579; venue figure is an AI estimate) | ✅ |
| R1_Score matches the answer key for all 41 hosts | ✅ 0.000% |
| Total_Cost matches the answer key for all 41 hosts | ✅ 0.000% |

The `--alteryx` check was tested both ways. A planted 8% error in Dallas's Total_Cost was caught and sent to `diagnose`, and a correct file passed 15/15.

## Outputs (`output/`)

- `chicago_checkpoint.md`: slide-ready selling points, attendance tables and the check results
- `chicago_checkpoint.json`: the same data, machine-readable
- `chicago_spotlight_by_office.csv`: per-office travel mode, hours and cost to Chicago (no employee names)
- `host_scores_langgraph.csv`: all 41 hosts as recomputed by the pipeline
