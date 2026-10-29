# Alteryx Designer Cloud: fastest defensible workflow

This is an implementation guide, not an executed or packaged Alteryx workflow. Field names below are target names: map them to the actual columns once you open the files. Do not treat Desktop-specific tool names or `.yxzp` packaging as interchangeable with Designer Cloud export.

## 1. Inspect and upload the two source datasets

In Alteryx One, create datasets from the employee and flight files. In Designer Cloud, add an Input Data tool for each. Preview the columns, types, unique employee identifiers, office locations, airport codes, flight dates, times, route direction and fares if present. Keep an untouched source copy.

The brief only promises flight times, routes and carriers. If fares are absent, use clearly labeled estimates with sources and a date; never manufacture “actual prices.” You also need a short candidate-city and venue evidence table.

## 2. Count employees by office

Employee Input → Select → Data Cleansing → Summarize.

- Trim whitespace and standardize office names; preserve a mapping of aliases.
- If an employee ID is available, check duplicates and count distinct IDs. Names alone are not reliable unique identifiers.
- Summarize by office city to produce `office_city` and `employee_count`.
- Record the total headcount. Use it consistently for every destination.
- Keep only aggregated counts in the dashboard export.

## 3. Prepare routes and durations

Flight Input → Select → Data Cleansing → DateTime / Formula → Filter.

- Standardize airport codes; create a small documented office-to-airport mapping.
- Map multiple airports to the same metro consistently (e.g., do not split one conference city into unrelated airport candidates).
- Calculate arrival minus departure using full dates and a common time zone, ideally UTC. Local clock subtraction alone is wrong across time zones.
- If dates are absent, adding 24 hours to a negative difference is only an assumption after time zones have been handled. State that limitation. Do not add 24 hours indiscriminately.
- Flight duration is not door-to-door employee time. Add documented airport, connection and ground-transfer allowances if available; otherwise label the metric as flight-time only.
- Select one consistent itinerary per origin/candidate pair. Do not multiply headcounts by every available flight or count duplicate schedules as extra employees.
- For a round trip, use outbound + inbound costs and times. Doubling outbound is only a disclosed approximation when return data are unavailable.

## 4. Build origin–candidate combinations and join

Use a candidate table containing 3–5 plausible cities. Append Columns can cross join aggregated offices with candidates. Join each nonlocal origin/candidate to the chosen route on both origin and destination keys.

- Same-city employees require no airline ticket. Handle their local travel time and ground costs according to a stated assumption.
- Preserve unmatched routes in a separate exception output. A missing route is not zero cost or zero travel time.
- Do not recommend a candidate if a material group of travelers has no feasible itinerary. Resolve missing routes or exclude the city upstream and document the reason. The dashboard assumes the exported route totals are complete.

For each office/candidate row, compute these quantities (conceptual formulas; adapt actual field names):

- `travelers = 0 if office_city = candidate_city else employee_count`
- `airfare_total_row = travelers * round_trip_fare`
- `travel_hours_row = employee_count * round_trip_door_to_door_hours`
- `nonstop_travelers = travelers if both outbound and inbound are nonstop else 0`
- `local_employees_row = employee_count if office_city = candidate_city else 0`

## 5. Aggregate by candidate

Summarize by candidate city:

- Sum `airfare_total_row` → `airfare_total`.
- Sum `travel_hours_row` → `travel_hours_total`.
- Sum `local_employees_row` → `local_employees`.
- Sum travelers and nonstop travelers.
- `nonstop_pct = 100 * nonstop_travelers / travelers`. If no one flies, define and document the convention; this dashboard requires a numeric value.
- `attendees` = the same total attendance assumption for every candidate.

Use employee-weighted access and hours, not an unweighted mean across offices. A 500-person office should contribute more than a 5-person office.

## 6. Join venue and cost evidence

Prepare a small table with:

| Field | Meaning |
|---|---|
| city | Exact candidate city join key |
| other_cost_total | Total hotel, venue, catering and ground transport scope; record omissions |
| venue_capacity | Capacity for the required seating configuration, as a whole number |
| venue_status | `verified`, `unverified`, or `unavailable` |
| activities_supported | `yes`, `no`, or `unknown` |
| evidence | Source URLs, checked date, conference dates and explicit assumptions |

A building's maximum capacity does not prove date availability or required breakout support. Mark `verified` only when the required availability evidence exists. The dashboard displays your status; it does not independently verify bookings.

Join to the aggregated candidate table. Missing numeric information must be researched or estimated and labeled; do not silently replace unknown costs with zero.

## 7. Calculate the baseline in Alteryx

Keep the main analysis in Alteryx. Use Summarize to obtain candidate minima/maxima and Append Columns to attach those bounds to each candidate. In Formula tools, calculate the four normalized metrics (0–100), then:

`baseline_score = 0.40 * cost_score + 0.30 * time_score + 0.20 * access_score + 0.10 * proximity_score`

- Cost and time: `(maximum - value) / (maximum - minimum) * 100`.
- Nonstop share and local share: `(value - minimum) / (maximum - minimum) * 100`.
- If maximum equals minimum, use 50.
- Local share: `100 * local_employees / attendees`.
- Use all candidate rows as the normalization reference before filtering feasibility, matching the dashboard.
- Filter out insufficient capacity, unavailable venues and unsupported activities. Keep unknown availability clearly provisional.
- Sort remaining candidates by baseline score descending. Keep excluded rows in a separate annotated output.

Export ALL candidate metrics to the dashboard, including capacity failures so it can show the exclusions. Extra columns such as `baseline_score` are allowed and ignored by the importer. Compare your Alteryx baseline leader with the dashboard before presenting.

## 8. Export, run and document

Select/rename these columns exactly:

```text
city,attendees,local_employees,airfare_total,other_cost_total,travel_hours_total,nonstop_pct,venue_capacity,venue_status,activities_supported,evidence
```

Use Output Data to save a CSV. Run the workflow and download the saved output from the Output tool's Job section. Import it into the Decision Lab. The cloud output steps are documented at [Alteryx Output Data](https://help.alteryx.com/designer-cloud/en/standard-mode-tools/workflow-in-out-tools/output-data-tool.html).

Add Comment annotations to sections: inputs, cleanup, route matching, cost/time calculations, suitability, ranking, and output. Save/export the cloud workflow from your workspace using the controls available in your account, and include required datasets/assets according to the organizer's instructions. Verify the exported format with the organizer if they specifically requested a packaged workflow.

## Final sanity checks

- Headcount matches the employee dataset and is the same for all cities.
- Local employees are not charged for flights.
- Unmatched routes are visible and resolved; duplicate flights do not inflate counts.
- Time zones, overnight flights, and round trips are handled explicitly.
- Costs and travel hours are employee-weighted totals.
- Capacity and activity constraints are checked independently of score.
- Sources and estimates are distinguishable.
- Recommendation changes are explained with the exact weights and constraints used.

Tool reference: [Designer Cloud Tools](https://help.alteryx.com/aac/en/designer-experience/standard-mode-tools.html). These steps require tailoring after the actual files are supplied.
