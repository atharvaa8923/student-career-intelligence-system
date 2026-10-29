# Alteryx Designer Cloud: step-by-step build guide

**Goal:** a documented workflow that scores all 41 RSM office cities as conference hosts in two rounds:

- **Round 1** ranks cities on centrality and accessibility.
- **Round 2** adds venue suitability and total cost (airfare, hotel and lost billable time), then checks whether the Round 1 pick still stands.

You build six sections, left to right on the canvas. Each step has a **Checkpoint** with the numbers you should see. If yours match (within a few percent), you're on track. Exact answers are in `answer_key/`.

> Time budget for a beginner: about 2.5–3 hours. If time runs short, build sections A–E and skip the min-max normalization in F; ranking by Total Cost alone is still a valid Round 2.

---

## 0. Prepare and upload the data (10 min)

Upload these files:

| File | Where it comes from | What it's for |
|---|---|---|
| `SparkED_Use_Case_..._STUDENT_VERSION.xlsx` | Provided by the organizers | Sheets: `RSM US Tax People`, `Office Locations`, `Airport Data` |
| `alteryx_upload/office_airport_map.csv` | **AI enrichment** (this repo) | Each office city → airport code(s) and latitude/longitude |
| `alteryx_upload/city_enrichment.csv` | **AI enrichment** (this repo) | Each city → convention venue, venue tier (A/B/C), October hotel rate |

Steps (Designer Cloud menus move around a little between versions):
1. Sign in to Alteryx One / Designer Cloud, then open **Data / Library → Import Data** (or **+ New → Upload**).
2. Upload the `.xlsx`. When asked, import **all three sheets** (each becomes its own dataset).
   - The `Airport Data` sheet has 852K rows. If the xlsx upload times out, save that sheet as CSV in Excel and upload the CSV.
3. Upload both CSVs from `alteryx_upload/`.
4. Create a workflow: **+ New → Designer Cloud workflow**. Name it `RSM_Conference_Location`.

**Before you build, verify the enrichment yourself.** Open `city_enrichment.csv` and check the `Rate_Source` column. Only Chicago, Dallas, Houston and New York rates come from GSA FY2026 tables. The rest are AI estimates. If you have 10 minutes, check a few at gsa.gov/perdiem. That spot-check is your "AI verification" story.

---

## A. Employees → office headcount (20 min)

**Tool chain:**
**Input Data** (`RSM US Tax People`) → **Data Cleansing** → **Formula** → **Summarize** → **Browse**

1. **Input Data:** pick the `RSM US Tax People` dataset.
2. **Data Cleansing:** tick *Remove leading and trailing whitespace* on all string fields.
3. **Formula:** add three new fields.
   - `Office_Clean` (V_String):
     ```
     IF [Office] = "St Petersburg, FL" THEN "St. Petersburg, FL"
     ELSEIF [Office] = "Silicon Valley" THEN "San Jose, CA"
     ELSE [Office] ENDIF
     ```
     *Why:* the people sheet spells offices differently from the Office Locations sheet. "Silicon Valley" isn't a city, so it's mapped to San Jose's airport.
   - `Is_Presenter` (Int32): `IIF(Uppercase([Presenter]) = "X", 1, 0)`
     *Why:* the Presenter column uses both "X" and "x". This is a data-quality catch worth a slide bullet.
   - `Is_Partner` (Int32): `IIF([Level] IN ("Partner","Principal"), 1, 0)`
4. **Summarize:** Group By `Office_Clean`, then:
   - Count `Employee` → rename `Employees`
   - Sum `Bill Rate` → rename `Sum_Bill_Rate`
   - Sum `Is_Presenter` → rename `Presenters`
   - Sum `Is_Partner` → rename `Partners`
   - Avg `Bill Rate` → rename `Avg_Bill_Rate`

✅ **Checkpoint:** 41 rows. Chicago 299, New York 297, Dallas 233. Total employees = 3,579; presenters = 35.

---

## B. Flights → clean route table (35 min)

**Tool chain:**
**Input Data** (`Airport Data`) → **Select** → **Filter** → **Formula** → **Summarize** → **Filter**

1. **Select:** uncheck the empty columns (`F10`/`F11`/`F12` or similar) and the two `Location` columns. Keep:
   - `Airline`
   - `Departing Airport`
   - `Destination Airport`
   - `Departure Time`
   - `Arrival Time`
   - `Avg_MARKET_FARE`
2. **Filter** (Custom):
   ```
   !IsNull([Departing Airport]) AND !IsNull([Departure Time])
   AND !IsNull([Arrival Time]) AND !IsNull([Avg_MARKET_FARE])
   ```
   ✅ **Checkpoint:** about 763,312 rows come out of **T** (84K completely blank rows and about 4.7K rows with missing times go out of **F**).
3. **Formula:** convert "HHMM" clock times to minutes and compute the duration.
   - `Dep_Str` (V_String): `PadLeft(ToString(ToNumber([Departure Time]),0), 4, "0")`
   - `Arr_Str` (V_String): `PadLeft(ToString(ToNumber([Arrival Time]),0), 4, "0")`
   - `Dep_Min` (Int32): `ToNumber(Left([Dep_Str],2))*60 + ToNumber(Right([Dep_Str],2))`
   - `Arr_Min` (Int32): `ToNumber(Left([Arr_Str],2))*60 + ToNumber(Right([Arr_Str],2))`
   - `Dur_Min` (Int32):
     ```
     IF [Arr_Min] - [Dep_Min] < 0 THEN [Arr_Min] - [Dep_Min] + 1440
     ELSE [Arr_Min] - [Dep_Min] ENDIF
     ```
     The `+1440` is the overnight fix from the tips sheet: a negative duration means the flight landed the next day.
   - Want to show the **DateTime** tool, as the tips sheet suggests? Run `Dep_Str` and `Arr_Str` through **DateTime** with custom format `HHmm`, then compute `DateTimeDiff([Arr_Time],[Dep_Time],"minutes")`. **Trap:** 477 rows contain the value `2400` (midnight), which DateTime can't parse. The minutes formula above handles it.
4. **Summarize:** Group By `Departing Airport`, `Destination Airport`, then:
   - Count `Airline` → `Flights`
   - Median `Dur_Min` → `Dur_Min`
   - Avg `Avg_MARKET_FARE` → `Fare`
   - Count Distinct `Airline` → `Carriers`
5. **Filter:** `[Flights] >= 10` drops sporadic or charter routes.

✅ **Checkpoint:** about 5,142 routes. Look up JFK→LAX: Dur_Min ≈ 180. Then LAX→JFK: ≈ 500. 🤔 That's wrong, and it's the most important insight in the dataset. See the next section.

---

## C. Round-trip table: the time-zone fix (15 min)

**The problem:** departure and arrival times are each in *local* time. JFK→LAX looks like a 3-hour flight (really about 6 hours) and LAX→JFK looks like 8.3 hours (really about 5.3). Every one-way duration that crosses a time zone is wrong.

**The fix (no time-zone data needed):** over a **round trip** the clock shifts cancel out. Outbound + return naive durations = true total air time (180 + 500 = 680 min ≈ 6h + 5.3h). ✔

**Tool chain:** route table → **Join** to itself

1. Drag a second connection from the route table's final Filter into the **Join** tool's R input.
2. **Join** on two field pairs:
   - L.`Departing Airport` = R.`Destination Airport`
   - L.`Destination Airport` = R.`Departing Airport`
3. **Formula** on the **J** output:
   - `RT_Air_Min` = `[Dur_Min] + [Right_Dur_Min]`
   - `RT_Fare` = `[Fare] + [Right_Fare]` (assumes Avg_MARKET_FARE is one-way)
4. **Select:** keep `Departing Airport`, `Destination Airport`, `RT_Air_Min`, `RT_Fare`, `Flights`.

✅ **Checkpoint:** about 4,976 round-trip routes.

> 🏆 Put this on a slide: *"We found the dataset uses local times. Naive one-way durations are off by up to 3 hours, so we used round-trip math where the time zones cancel."*

---

## D. Office × host matrix (35 min)

1. **Input Data:** `office_airport_map.csv` (49 rows: Office, Airport, Lat, Lon).
2. **Join** (A's Summarize output) `Office_Clean` = (map) `Office`, keeping the **J** output.
   This gives the **origins**. Use a **Select** to rename `Airport` → `Orig_Airport`.
   ✅ 49 rows (Chicago, NY, Dallas, Houston, DC and St. Pete have 2–3 airports).
3. Add a second **Input Data** of `office_airport_map.csv` for the **hosts**, then a **Select** that renames:
   - `Office` → `Host`
   - `Airport` → `Host_Airport`
   - `Lat` → `H_Lat`
   - `Lon` → `H_Lon`
4. **Append Fields:** Target = origins, Source = hosts. Set the record-limit option to *allow all appends*.
   ✅ 49 × 49 = 2,401 rows, every origin airport paired with every host airport.
5. **Join** to section C's round-trip table:
   - `Orig_Airport` = `Departing Airport`
   - `Host_Airport` = `Destination Airport`
6. **Union** the Join's **J** and **L** outputs, auto-configured by name. L holds the pairs with **no nonstop**, which you need to keep.
7. **Formula:** distance in miles (haversine):
   - `Dist_Mi` (Double):
     ```
     3958.8 * 2 * ASIN(SQRT(
       POW(SIN(([H_Lat]-[Lat])*PI()/360),2)
       + COS([Lat]*PI()/180) * COS([H_Lat]*PI()/180) * POW(SIN(([H_Lon]-[Lon])*PI()/360),2)))
     ```
8. **Summarize:** Group By `Office_Clean`, `Host`, then:
   - First of `Employees`, `Presenters`, `Sum_Bill_Rate` and `Dist_Mi`
   - Min `RT_Air_Min`
   - Min `RT_Fare`

   This picks the best airport pair for cities with several airports.
   ✅ 41 × 41 = 1,681 rows.

---

## E. Travel mode, time and cost per office → host (25 min)

Use one **Formula** tool with these fields (all Double unless noted):

| Field | Expression |
|---|---|
| `Mode` (V_String) | `IF [Office_Clean]=[Host] THEN "Local" ELSEIF [Dist_Mi]<=150 THEN "Drive" ELSEIF !IsNull([Min_RT_Air_Min]) THEN "Nonstop" ELSE "1-Stop" ENDIF` |
| `RT_Hours` | `IF [Mode]="Local" THEN 0 ELSEIF [Mode]="Drive" THEN 2*[Dist_Mi]*1.2/55 ELSEIF [Mode]="Nonstop" THEN [Min_RT_Air_Min]/60 + 4 ELSE 2*([Dist_Mi]/450 + 0.5 + 2 + 2) ENDIF` |
| `RT_Cost_pp` | `IF [Mode]="Local" THEN 0 ELSEIF [Mode]="Drive" THEN 2*[Dist_Mi]*1.2*0.70/3 ELSEIF [Mode]="Nonstop" THEN [Min_RT_Fare] ELSE 612 ENDIF` |
| `Local_Emps` | `IIF([Mode]="Local",[Employees],0)` |
| `Tickets` | `IIF([Mode]="Nonstop" OR [Mode]="1-Stop",[Employees],0)` |
| `Easy_Access` | `IIF([Mode]!="1-Stop",[Employees],0)` |
| `Within_300` | `IIF([Dist_Mi]<=300,[Employees],0)` |
| `W_Dist` | `[Dist_Mi]*[Employees]` |
| `Travel_Cost` | `[RT_Cost_pp]*[Employees]` |
| `Person_Hours` | `[RT_Hours]*[Employees]` |
| `Lost_Billable` | `[RT_Hours]*[Sum_Bill_Rate]` |
| `Hotel_Nights` | `IIF([Mode]="Local",0,3*[Employees]+[Presenters])` |

What the constants mean (these all go on your **Assumptions** slide):

- `+ 4` = 2 hours per direction for getting to the airport, security and boarding.
- `1.2` = road miles per straight-line mile.
- `55` = driving speed in mph.
- `0.70` = IRS 2025 mileage rate per mile.
- `/3` = three people carpool per car.
- `450` = average block speed in mph for a connecting itinerary.
- `+ 2` = layover hours.
- `612` = 1-stop round-trip fare: 1.5 × the $204 dataset average fare, times 2 directions.
- `3` = hotel nights per traveler; presenters get +1 night for rehearsal.

✅ **Checkpoint:** Mode counts are about 1,088 Nonstop, 510 1-Stop, 42 Drive, 41 Local.

---

## F. Host scores: Round 1 and Round 2 (35 min)

1. **Summarize:** Group By `Host`, then Sum each of:
   - `Local_Emps`
   - `Tickets`
   - `Easy_Access`
   - `Within_300`
   - `W_Dist`
   - `Travel_Cost`
   - `Person_Hours`
   - `Lost_Billable`
   - `Hotel_Nights`
2. **Join** to `city_enrichment.csv` on `Host` = `City`.
3. **Formula:**
   - `Avg_Dist` = `[Sum_W_Dist]/3579`
   - `Pct_Easy` = `[Sum_Easy_Access]/3579`
   - `Avg_RT_Hours` = `[Sum_Person_Hours]/3579`
   - `Hotel_Cost` = `[Sum_Hotel_Nights]*[Hotel_Rate_Oct]`
   - `Total_Cost` = `[Sum_Travel_Cost]+[Hotel_Cost]+[Sum_Lost_Billable]`
4. **Round 1 score (min-max normalization):**
   - **Summarize** (no group): Min and Max of `Avg_Dist`, `Sum_Within_300`, `Pct_Easy`, `Avg_RT_Hours`.
   - **Append Fields:** Target = host table, Source = the min/max row.
   - **Formula:**
     ```
     R1_Score = 100 * (
       0.25 * (1 - ([Avg_Dist]-[Min_Avg_Dist]) / ([Max_Avg_Dist]-[Min_Avg_Dist]))
     + 0.25 * ([Sum_Within_300]-[Min_Sum_Within_300]) / ([Max_Sum_Within_300]-[Min_Sum_Within_300])
     + 0.30 * ([Pct_Easy]-[Min_Pct_Easy]) / ([Max_Pct_Easy]-[Min_Pct_Easy])
     + 0.20 * (1 - ([Avg_RT_Hours]-[Min_Avg_RT_Hours]) / ([Max_Avg_RT_Hours]-[Min_Avg_RT_Hours])))
     ```
   - **Sort** `R1_Score` descending → **Record ID** (name it `R1_Rank`).
5. **Round 2:**
   - **Filter:** `[Venue_Tier] != "C"`. This is the location-suitability gate; it removes Cedar Rapids, Iowa City, Champaign, New Bern, Lincoln and Austin.
   - **Sort** `Total_Cost` ascending → **Record ID** (name it `R2_Rank`).
6. **Output Data:** write `RSM_Host_Scores.xlsx` (or CSV) and add **Browse** tools for screenshots.

✅ **Final checkpoint:**

| Host | R1 score | R1 rank | Total cost | R2 rank |
|---|---|---|---|---|
| **Chicago** | 93.2 | 1 | $18.86M | **1** |
| Dallas | 89.6 | 2 | $19.73M | 3 |
| St. Louis | 88.4 | 3 | $19.51M | 2 |
| Detroit | 86.1 | 4 | $19.77M | 4 |

---

## G. Document, run, package (15 min)

- **Run:** click **Run** (top right). Fix any red error icons first; click the tool to see its message. Paste the error into your AI assistant if it's unclear.
- **Comment tools:** add one above each section A–F with a heading (e.g. "C. Round-trip table: time zones cancel"). Judges look at this first.
- **Annotate tools:** in each tool's config, the Annotation tab (pencil icon) holds a 3–5 word label.
- **Cache:** right-click the last tool of section C → *Cache and Run Workflow*. Afterward, edits to D–F rerun in seconds instead of re-reading 852K rows.
- **Package:** use the workflow's ⋯ menu → *Export / Download*. Confirm with the organizers which format they want (.yxzp / .yxmd).
- **Screenshot the full canvas** for the deck's methodology slide.

## Common errors

| Symptom | Fix |
|---|---|
| `ToNumber` returns 0 or null on times | The field is a string with spaces; add `Trim()` inside, or run Data Cleansing first |
| Join outputs 0 rows | Field types differ (String vs V_String is fine; Int vs String isn't), or names differ ("St Petersburg" vs "St. Petersburg") |
| Append Fields error "too many records" | Set the option to allow all appends |
| Union misaligns columns | Set it to *Auto config by Name* |
| Durations of around 1,400 minutes | The overnight fix fired on a bad record; the Median in Summarize absorbs these |
