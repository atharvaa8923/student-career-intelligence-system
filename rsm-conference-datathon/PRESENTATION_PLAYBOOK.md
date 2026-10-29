# Presentation playbook: how to win the judging

Judges score the **story and the reasoning**, so build the deck around one message:

> **"Host in Chicago. It's the most central, best-connected city for RSM Tax's 3,579 people, and once you price employee time, it's also the cheapest. It saves $0.7M–$11M versus every alternative."**

Charts for every slide are in `charts/` (PNG, 200 dpi). All numbers come from `answer_key/host_scores.csv`.

---

## Slide-by-slide (12 slides, ~7 minutes)

| # | Slide title (state the conclusion) | Content | Visual |
|---|---|---|---|
| 1 | **Chicago: the right room for 3,579 people** | Recommendation, plus 3 hero numbers: **$18.9M** total cost (lowest), **7.6 h** avg round trip (fastest), **99.9%** of staff with a nonstop flight or short drive | Chicago skyline photo + the 3 numbers |
| 2 | The question | "Where should RSM host its next firm-wide conference?" 41 offices, 3,579 employees, 852K flight records | Map of offices (bubble = headcount), made in PowerPoint or Tableau |
| 3 | Our approach: two rounds | Round 1 = centrality + accessibility. Round 2 = venue gate + total cost of attendance. Then stress-test | Simple 3-step flow graphic |
| 4 | Where our people are | Chicago (299) and NY (297) are the largest offices; the Midwest/Texas belt holds the center of mass | `01_headcount_by_office.png` |
| 5 | **Data detective: the clock lies** | Times in the dataset are *local*. Naive JFK→LAX = 3.0 h, LAX→JFK = 8.3 h. Fix: round-trip math cancels time zones. Also: 84K blank rows, "X" vs "x" presenters, "St Petersburg" vs "St. Petersburg", "Silicon Valley" → San Jose | Before/after table |
| 6 | Round 1: Chicago leads | Score 93/100. 642 staff within 300 miles; 100% reachable nonstop or by car (2 New Bern staff need a connection) | `02_round1_scores.png` |
| 7 | **Robust to how you weight it** | Chicago wins **86% of 10,000 random weightings** of the 4 Round 1 criteria | Bar of win counts: Chicago 8,615, Iowa City 726, Dallas 410, … |
| 8 | Can the city host us? | Venue gate: Tier C cities removed (Cedar Rapids/Iowa City are the *most central* but lack hotels and nonstops; Austin's convention center is closed for rebuild). McCormick Place is the largest US convention center | Table: city, venue, tier |
| 9 | Round 2: total cost of attendance | Airfare + hotel + **lost billable time** (hours in transit × each employee's bill rate). Chicago **$18.9M** vs St. Louis $19.5M, Dallas $19.7M, NYC $22.8M, Las Vegas $25.4M | `03_round2_total_cost.png` |
| 10 | **Time is the real cost** | 81% of the cost is people's time, not tickets. On cash only, Houston is cheapest and Chicago is only #24 (pricey hotels). But Chicago saves 4,010 person-hours vs Houston, worth **$2.4M** in billable time, outweighing its $0.9M higher cash cost | `04_time_is_money.png` + `05_avg_travel_hours.png` |
| 11 | **Does the recommendation stand? Yes** | Rank shift chart. Sensitivity: Chicago stays #1 at 50% bill-rate realization and with hotels +25%. It flips to Houston only if employee time is valued at $0, which is unrealistic for a billable firm | `06_rank_shift.png` |
| 12 | Recommendation and next steps | Book McCormick Place (or a downtown hotel venue) for mid-week to avoid weekend travel; negotiate a room block; New Bern staff fly via CLT. Runner-up: **St. Louis** (cheaper hotels, 2nd-lowest total cost) | Checklist |

**Appendix slides** (shown only if asked): Assumptions table, workflow screenshot, AI-usage log, full ranking table for all 41 cities.

---

## Assumptions slide (copy-paste)

| Assumption | Value | Why |
|---|---|---|
| Candidate hosts | The 41 RSM office cities | Uses the provided data; office staff attend locally |
| Avg_MARKET_FARE | One-way fare; round trip = outbound + return route fares | Field name and range ($9–$574) |
| Flight times | Local clock times; round-trip air time = out + back (time zones cancel) | Verified on JFK↔LAX, BOS↔SEA |
| Overnight flights | Negative duration + 1,440 min | Tips sheet guidance |
| Airport overhead | 2 h each way (to airport, security, boarding) | Industry rule of thumb |
| Drive vs fly | Drive if ≤150 miles straight-line (×1.2 road factor, 55 mph, $0.70/mi IRS rate, 3 per car) | ~3.3 h drive beats flying door-to-door |
| No nonstop | 1-stop: distance/450 mph + 0.5 h taxi + 2 h layover + overhead; fare = 1.5 × avg ($612 RT) | Calibrated against real hub routing (within ~10%) |
| Routes kept | ≥10 flights in the dataset | Removes charter/sporadic service |
| Hotel | 3 nights per traveler, +1 for presenters (rehearsal); October GSA lodging rate | Typical 2.5-day conference |
| Lost billable | Round-trip transit hours × employee bill rate (100% realization; 50% tested) | "EE not billable" per use case |
| Venue | Tier A/B = can host ~3,600 people; Tier C = excluded | AI-assisted research, spot-checked |

---

## AI-usage slide (judges explicitly reward this)

| AI suggestion in the brief | What we did |
|---|---|
| **Data collection / enrichment** | AI mapped 41 offices → 47 airports with coordinates, and researched venue capacity and hotel rates for all 41 cities |
| **Verification** | AI spotted that flight times are local (time-zone trap) and validated the round-trip correction; we checked AI hotel rates against GSA FY2026 tables (Chicago $223, Dallas $170, Houston $128, NYC $342) |
| **Analysis** | A Python validation model cross-checked every Alteryx output; a 10,000-run Monte Carlo test showed the result doesn't depend on our chosen weights |
| **Presentation** | AI drafted the storyline, chart designs and speaker notes |

Be honest about which numbers are AI estimates (`Rate_Source` column). Judges trust teams that show their verification.

---

## Design rules that make the deck look professional

1. **Headline = conclusion.** "Chicago saves $2.4M of billable time," not "Cost analysis."
2. **One highlight color.** Chicago is always blue and everything else gray (the charts already follow this).
3. **≤ 20 words of body text per slide.** Put the detail in speaker notes.
4. **Big numbers.** One hero metric per slide in 60+ pt.
5. **Consistent template.** One font (e.g. Arial or Segoe UI), a white background, generous margins. Don't use RSM's logo unless the organizers say you may.
6. **A map wins hearts.** Build an office-bubble map of the US with lines from each office to Chicago. In PowerPoint use *Insert → Chart → Map*, or plot `office_headcount.csv` (lat/lon included) in Tableau Public or Flourish.
7. Optional wow factor: a 60-second AI voice-over or an interactive Flourish dashboard on the closing slide.

## Q&A prep (likely judge questions)

- **"Why not New York? It's almost as big as Chicago (297 vs 299 people)."** NYC ranks #22 in Round 2. Its hotels cost $342/night and it's far from the western offices.
- **"What if hotels are negotiated cheaper?"** Hotel is only 12% of the cost; Chicago stays #1 even with hotels +25%, and a 20% group discount only helps Chicago more.
- **"Is valuing travel time at full bill rate fair?"** We tested 50% realization: Chicago still wins. Only at $0 (all travel on personal time) does Houston win.
- **"Why are Cedar Rapids/Iowa City excluded if they're so central?"** Only 37% of staff could get there by nonstop flight or car, and there's no hotel or venue base for 3,500 travelers.
- **"How confident are you in the hotel numbers?"** Four come from GSA tables; the rest are AI estimates flagged in our data, and the result is insensitive to them.
