# Workflow prompts (copy-paste)

Use these in **Alteryx Copilot** (the AI assistant inside Designer Cloud), or in any AI chat if Copilot isn't available.

- Paste the **context prompt** first, then **one section prompt at a time**.
- Run the workflow after each section and compare with its ✅ checkpoint before moving on.
- Before pasting, rename the dataset names in the prompts to match what you named them when uploading.

---

## Context prompt (paste once, first)

```
I am building an Alteryx Designer Cloud workflow for a datathon: "Where should RSM host its next company-wide conference?"

Datasets already uploaded:
1. "RSM US Tax People": Employee, Level, Bill Rate, Office, Presenter (3,579 rows)
2. "Airport Data": Airline Code, Airline, Departing Airport, Departing Location, Destination Airport, Destination Location, Departure Time, Arrival Time, Avg_MARKET_FARE (852,146 rows; times are HHMM numbers in LOCAL time, e.g. 630 = 6:30 AM)
3. "office_airport_map.csv": Office, Airport, Lat, Lon (49 rows; maps each office city to its airport codes)
4. "city_enrichment.csv": City, Venue, Venue_Tier (A/B/C), Hotel_Rate_Oct, Rate_Source, Suitability_Note (41 rows)

Goal: score all 41 office cities as conference hosts.
- Round 1: centrality + flight accessibility.
- Round 2: drop cities without a suitable venue (Tier C), then rank by total cost = airfare + hotel + lost billable time (travel hours x bill rate).

I am a beginner. For each step, tell me exactly which tool to add, how to connect it, and how to configure it. Use only tools available in Designer Cloud. I will give you one section at a time.
```

---

## Section A: employee headcount per office

```
Section A. Starting from the "RSM US Tax People" dataset, build:
Input Data -> Data Cleansing (trim leading/trailing whitespace on string fields) -> Formula -> Summarize.

In the Formula tool, create:
- Office_Clean (V_String):
  IF [Office] = "St Petersburg, FL" THEN "St. Petersburg, FL"
  ELSEIF [Office] = "Silicon Valley" THEN "San Jose, CA"
  ELSE [Office] ENDIF
- Is_Presenter (Int32): IIF(Uppercase([Presenter]) = "X", 1, 0)
- Is_Partner (Int32): IIF([Level] IN ("Partner","Principal"), 1, 0)

In the Summarize tool, Group By Office_Clean, then:
- Count Employee as Employees
- Sum Bill Rate as Sum_Bill_Rate
- Avg Bill Rate as Avg_Bill_Rate
- Sum Is_Presenter as Presenters
- Sum Is_Partner as Partners

Add a Comment tool above it: "A. Employee headcount by office (cleans office names and presenter flags)".
```
✅ 41 rows. Chicago 299, New York 297, Dallas 233. Employees total 3,579; presenters total 35.

---

## Section B: clean flights into a route table

```
Section B. Starting from the "Airport Data" dataset, build:
Input Data -> Select -> Filter -> Formula -> Summarize -> Filter.

1. Select: keep only Airline, Departing Airport, Destination Airport, Departure Time, Arrival Time, Avg_MARKET_FARE. Drop the empty extra columns and the two Location columns.

2. Filter (custom):
   !IsNull([Departing Airport]) AND !IsNull([Departure Time]) AND !IsNull([Arrival Time]) AND !IsNull([Avg_MARKET_FARE])

3. Formula (times are HHMM in local time; some values are 2400):
   - Dep_Str (V_String): PadLeft(ToString(ToNumber([Departure Time]),0), 4, "0")
   - Arr_Str (V_String): PadLeft(ToString(ToNumber([Arrival Time]),0), 4, "0")
   - Dep_Min (Int32): ToNumber(Left([Dep_Str],2))*60 + ToNumber(Right([Dep_Str],2))
   - Arr_Min (Int32): ToNumber(Left([Arr_Str],2))*60 + ToNumber(Right([Arr_Str],2))
   - Dur_Min (Int32): IF [Arr_Min]-[Dep_Min] < 0 THEN [Arr_Min]-[Dep_Min]+1440 ELSE [Arr_Min]-[Dep_Min] ENDIF
     (+1440 fixes flights that land the next day)

4. Summarize: Group By Departing Airport and Destination Airport, then:
   - Count Airline as Flights
   - Median Dur_Min as Dur_Min
   - Avg Avg_MARKET_FARE as Fare
   - Count Distinct Airline as Carriers

5. Filter: [Flights] >= 10

Add a Comment: "B. Flight routes: blanks removed, HHMM converted to minutes, overnight fix, ≥10 flights per route".
```
✅ About 763K rows after the first Filter; about 5,142 routes at the end.

---

## Section C: round-trip table (the time-zone fix)

```
Section C. Departure and arrival times are local times, so one-way durations across time zones are wrong (JFK->LAX shows 180 min, LAX->JFK shows 500 min). On a round trip the time-zone shift cancels, so outbound + return = true air time.

Take the final output of Section B and Join it to itself:
- Left.Departing Airport = Right.Destination Airport
- Left.Destination Airport = Right.Departing Airport

On the J output, add a Formula:
- RT_Air_Min (Double): [Dur_Min] + [Right_Dur_Min]
- RT_Fare (Double): [Fare] + [Right_Fare]

Then a Select keeping: Departing Airport, Destination Airport, RT_Air_Min, RT_Fare, Flights.

Add a Comment: "C. Round trips: time zones cancel when outbound and return are added".
Then right-click the last tool of this section and choose Cache and Run Workflow.
```
✅ About 4,976 round-trip routes. JFK→LAX RT_Air_Min ≈ 680.

---

## Section D: every office paired with every host city

```
Section D.
1. Add Input Data "office_airport_map.csv". Join it to the Section A output on Office_Clean = Office (keep the J output). Use a Select to rename Airport to Orig_Airport. This is the ORIGINS table.

2. Add a second Input Data "office_airport_map.csv". Use a Select to rename:
   - Office -> Host
   - Airport -> Host_Airport
   - Lat -> H_Lat
   - Lon -> H_Lon
   This is the HOSTS table.

3. Append Fields: Target = ORIGINS, Source = HOSTS. Allow all appends (this creates every combination).

4. Join the result to the Section C output on:
   - Orig_Airport = Departing Airport
   - Host_Airport = Destination Airport
   Then Union the J and L outputs (auto config by name), so pairs with no nonstop flight are kept.

5. Formula: haversine distance in miles:
   Dist_Mi (Double) = 3958.8 * 2 * ASIN(SQRT(POW(SIN(([H_Lat]-[Lat])*PI()/360),2) + COS([Lat]*PI()/180)*COS([H_Lat]*PI()/180)*POW(SIN(([H_Lon]-[Lon])*PI()/360),2)))

6. Summarize: Group By Office_Clean and Host, then:
   - First of Employees, Presenters, Sum_Bill_Rate and Dist_Mi
   - Min RT_Air_Min as Min_RT_Air_Min
   - Min RT_Fare as Min_RT_Fare

Add a Comment: "D. Office x host matrix: best airport pair, distance between cities".
```
✅ 2,401 rows after Append Fields; 1,681 rows (41 × 41) after Summarize.

---

## Section E: travel mode, hours and cost

```
Section E. Add one Formula tool after Section D with these fields:

- Mode (V_String): IF [Office_Clean]=[Host] THEN "Local" ELSEIF [Dist_Mi]<=150 THEN "Drive" ELSEIF !IsNull([Min_RT_Air_Min]) THEN "Nonstop" ELSE "1-Stop" ENDIF
- RT_Hours (Double): IF [Mode]="Local" THEN 0 ELSEIF [Mode]="Drive" THEN 2*[Dist_Mi]*1.2/55 ELSEIF [Mode]="Nonstop" THEN [Min_RT_Air_Min]/60 + 4 ELSE 2*([Dist_Mi]/450 + 0.5 + 2 + 2) ENDIF
- RT_Cost_pp (Double): IF [Mode]="Local" THEN 0 ELSEIF [Mode]="Drive" THEN 2*[Dist_Mi]*1.2*0.70/3 ELSEIF [Mode]="Nonstop" THEN [Min_RT_Fare] ELSE 612 ENDIF
- Local_Emps (Double): IIF([Mode]="Local",[Employees],0)
- Tickets (Double): IIF([Mode]="Nonstop" OR [Mode]="1-Stop",[Employees],0)
- Easy_Access (Double): IIF([Mode]!="1-Stop",[Employees],0)
- Within_300 (Double): IIF([Dist_Mi]<=300,[Employees],0)
- W_Dist (Double): [Dist_Mi]*[Employees]
- Travel_Cost (Double): [RT_Cost_pp]*[Employees]
- Person_Hours (Double): [RT_Hours]*[Employees]
- Lost_Billable (Double): [RT_Hours]*[Sum_Bill_Rate]
- Hotel_Nights (Double): IIF([Mode]="Local",0,3*[Employees]+[Presenters])

Assumptions behind the numbers:
- +4 hours = 2 hours of airport time each way.
- Drive if within 150 miles: 1.2 road factor, 55 mph, $0.70/mile IRS rate, 3 people per car.
- 1-stop trips: 450 mph average speed plus a 2-hour layover; $612 round-trip fare.
- Hotel: 3 nights per traveler, plus 1 extra night for presenters.

Add a Comment: "E. Travel mode, round-trip hours and costs per office -> host".
```
✅ Mode counts: about 1,088 Nonstop, 510 1-Stop, 42 Drive, 41 Local.

---

## Section F: score and rank the hosts

```
Section F.
1. Summarize: Group By Host, then Sum each of:
   Local_Emps, Tickets, Easy_Access, Within_300, W_Dist, Travel_Cost, Person_Hours, Lost_Billable, Hotel_Nights.

2. Join to "city_enrichment.csv" on Host = City.

3. Formula:
   - Avg_Dist = [Sum_W_Dist]/3579
   - Pct_Easy = [Sum_Easy_Access]/3579
   - Avg_RT_Hours = [Sum_Person_Hours]/3579
   - Hotel_Cost = [Sum_Hotel_Nights]*[Hotel_Rate_Oct]
   - Total_Cost = [Sum_Travel_Cost]+[Hotel_Cost]+[Sum_Lost_Billable]

4. Round 1 score with min-max normalization:
   - Summarize (no grouping): Min and Max of Avg_Dist, Sum_Within_300, Pct_Easy and Avg_RT_Hours.
   - Append Fields: Target = host table, Source = that min/max row.
   - Formula:
     R1_Score = 100*( 0.25*(1-([Avg_Dist]-[Min_Avg_Dist])/([Max_Avg_Dist]-[Min_Avg_Dist]))
                    + 0.25*([Sum_Within_300]-[Min_Sum_Within_300])/([Max_Sum_Within_300]-[Min_Sum_Within_300])
                    + 0.30*([Pct_Easy]-[Min_Pct_Easy])/([Max_Pct_Easy]-[Min_Pct_Easy])
                    + 0.20*(1-([Avg_RT_Hours]-[Min_Avg_RT_Hours])/([Max_Avg_RT_Hours]-[Min_Avg_RT_Hours])) )
   - Sort by R1_Score descending, then Record ID named R1_Rank.

5. Round 2:
   - Filter [Venue_Tier] != "C" (location suitability gate).
   - Sort by Total_Cost ascending, then Record ID named R2_Rank.

6. Output Data: write the full table to RSM_Host_Scores.xlsx. Add Browse tools on the Round 1 and Round 2 outputs.

Add a Comment: "F. Round 1 = centrality 50% + accessibility 50%. Round 2 = venue gate + total cost of attendance (airfare + hotel + lost billable time)".
```
✅ Round 1: Chicago 93.2 (#1), Dallas 89.6, St. Louis 88.4.
✅ Round 2: Chicago $18.86M (#1), St. Louis $19.51M, Dallas $19.73M.

---

## Section G: Chicago checkpoint (who can attend and why Chicago)

```
Section G. Branch from the Section E Formula output (the office x host table).

1. Filter: [Host] = "Chicago, IL"

2. Formula:
   - Region (V_String):
     Switch(Right([Office_Clean],2), "Other",
       "IL","Midwest","MN","Midwest","OH","Midwest","MO","Midwest","IA","Midwest","MI","Midwest","NE","Midwest","WI","Midwest",
       "NY","Northeast","MA","Northeast","PA","Northeast","CT","Northeast","MD","Northeast","DC","Northeast",
       "TX","South","NC","South","FL","South","GA","South","TN","South","OK","South",
       "AZ","West","CA","West","CO","West","WA","West","NV","West")
   - Distance_Band (V_String):
     IF [Dist_Mi] < 0.5 THEN "Local" ELSEIF [Dist_Mi] <= 300 THEN "Under 300 mi" ELSEIF [Dist_Mi] <= 1000 THEN "300-1,000 mi" ELSE "Over 1,000 mi" ENDIF
   - Time_Band (V_String):
     IF [RT_Hours] = 0 THEN "No travel" ELSEIF [RT_Hours] <= 6 THEN "Under 6 h" ELSEIF [RT_Hours] <= 8 THEN "6-8 h" ELSEIF [RT_Hours] <= 10 THEN "8-10 h" ELSE "Over 10 h" ENDIF

3. Connect five Summarize tools to that Formula:
   a) Group By Mode, Sum Employees
   b) Group By Region; Count Office_Clean, Sum Employees, Sum Person_Hours. Then a Formula: Avg_RT_Hours = [Sum_Person_Hours]/[Sum_Employees]
   c) Group By Distance_Band, Sum Employees
   d) Group By Time_Band, Sum Employees
   e) No grouping: Sum Employees, Tickets, Hotel_Nights and Presenters

4. Venue check:
   - Add a Text Input with columns Venue = "McCormick Place" and Seats = 4249.
   - Append Fields it to output (e).
   - Formula: Venue_Check = IIF([Sum_Employees] <= [Seats], "Fits everyone in one general session", "Overflow rooms needed")

5. Add a Browse tool on each output, and a Comment: "G. Chicago checkpoint: who can attend, how they travel, where they come from".
```
✅ By mode: Nonstop 3,255 · Local 299 · Drive 23 · 1-Stop 2 = 3,579 (everyone can attend).
✅ By region (employees, avg round trip): Midwest 1,072 (4.5 h) · Northeast 730 (8.0 h) · South 1,133 (8.3 h) · West 644 (11.3 h).
✅ Totals: 3,257 tickets · 9,874 hotel room-nights · venue fits everyone.

---

## Fix-it prompt (when something breaks)

```
My Alteryx Designer Cloud workflow shows this error on the [TOOL NAME] tool in Section [X]:
"[PASTE ERROR MESSAGE]"
The incoming fields are: [list field names and types from the Results pane].
Explain the cause in simple terms and give me the exact fix.
```

## Documentation prompt (at the end)

```
Write a short annotation (max 8 words) for each tool in my workflow, plus a 3-sentence Comment for each of Sections A-F, explaining what the section does and why. Then write a 5-bullet "Methodology" and a 10-bullet "Assumptions" list for my summary report, based on the sections above.
```
