# Run the Decision Lab with the real RSM results

This was tested in a cloud session: all 17 tests pass, and the dashboard ran with the real CSVs below. The screenshots in `screenshots/` come from that run.

## 1. Start it on your computer (5 min)

You need Python 3.12 or newer. Open a terminal in this `decision-lab` folder:

```sh
python -m venv .venv
# Mac/Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate
python -m pip install -r requirements-lock.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

Open **http://127.0.0.1:8765**. (If `requirements-lock.txt` fails, use `requirements.txt` instead.)

## 2. Load the real data

Click **Import data** and choose one of these:

| File | Contents | Use it for |
|---|---|---|
| `data/rsm_shortlist.csv` | 10 lowest-cost viable cities, plus Austin and Cedar Rapids (excluded by the venue gate) | **Presenting.** It's clean and readable |
| `data/rsm_alteryx_results.csv` | All 41 office cities | Appendix, or showing completeness |

Then set **Time value ($/hr) = 562**. That's the average bill rate of all 3,579 employees.

> Once your own Alteryx run finishes, rebuild these CSVs from your Alteryx output if any numbers differ.

## 3. The 60-second live demo (this is the story)

1. **Balanced preset → Run.** The leader is **Houston**, because the cost score uses *cash only* (airfare + hotel), where Houston is cheapest.
2. Say: *"But for a professional-services firm, employee time is the biggest cost."*
3. **Time first → Run.** The leader becomes **Chicago** (85/100): 4,011 fewer travel hours than Houston and 100% nonstop access.
4. Scroll to **The trade-offs, in numbers**. The green line shows cash + time value at $562/hr = **$18.86M** for Chicago, the lowest of every city. That matches our Alteryx/Python answer key exactly, so two independent methods agree.
5. Tick **Require verified venue & activities → Run.** No city qualifies. Say: *"That's our honest next step: confirm McCormick Place dates."*

## What the CSV columns mean

| Column | How it was built (from `answer_key/host_scores.csv`) |
|---|---|
| `airfare_total` | Round-trip airfare (nonstop or 1-stop) plus mileage for drivers |
| `other_cost_total` | Hotel: 3 nights per traveler, +1 per presenter, × October rate |
| `travel_hours_total` | Round-trip door-to-door hours × employees |
| `nonstop_pct` | Share of *traveling* employees with a nonstop flight or a ≤150-mile drive |
| `venue_capacity` | Tier placeholder, **not verified**: A = 10,000, B = 4,000, C = 0 (no suitable venue) |
| `venue_status` | `unverified` everywhere (no dates checked); Austin is `unavailable` (center under rebuild; verify) |

## Notes

- With the shortlist file, the "Access first" sensitivity preset picks Houston. Scores are scaled 0–100 across whichever cities you import, so a smaller set changes the scaling. With all 41 cities, Access first picks Chicago.
- AI interpretation is optional and off. It needs your own Anthropic API key set as an environment variable. Never put keys in files or slides.
