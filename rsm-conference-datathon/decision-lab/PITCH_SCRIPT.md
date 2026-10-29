# Two-minute demo script

Until actual datasets are imported, begin with: **“This demonstration uses synthetic data to show the decision process. These are not our final RSM findings.”** Replace the illustrative city names and figures below after importing real data.

## 0:00–0:20 — Frame the decision

“Choosing a conference city involves a trade-off: company spending, employee time, and the ability to bring everyone together. Our approach makes those trade-offs explicit and checks feasibility before making a recommendation.”

## 0:20–0:45 — Establish the evidence

“Alteryx is where we prepare employee counts, reconcile routes, calculate weighted travel metrics and produce our baseline. The decision lab imports those city-level results. Our current baseline weights are 40% cost, 30% time, 20% flight accessibility and 10% proximity. Venue suitability remains a separate constraint.”

Only claim that the Alteryx steps were executed after you actually run them. If presenting the prototype before that, say “Our planned Alteryx workflow will…”

## 0:45–1:15 — Make the live change

Click **Time first**.

“In this synthetic example, Dallas leads with balanced priorities. When employee time becomes the main priority, Chicago takes the lead. Chicago costs $70,000 more in the example but saves 1,100 employee travel hours. The tool shows the consequence of changing priorities instead of hiding that decision inside a single score.”

Optional insight: “That is about $63.64 in extra cash per employee travel hour saved in this illustrative comparison.” This is an incremental trade-off, not an airfare estimate or a claim about employee wages.

## 1:15–1:35 — Demonstrate responsible constraints

Check **Require verified venue & activities**, click **Run scenario**.

“No city is fully verified in the demo, so the system stops short of a final recommendation. It does not invent a venue or assume that a capacity figure proves availability.”

Reset and click **Present** to return to the overview.

## 1:35–2:00 — Close with the deliverable

“We can export the ranking, assumptions, evidence and scenario parameters. LangGraph coordinates the steps; Python performs the calculations. Optional AI interprets questions and explains the results. The contribution is a recommendation that a decision-maker can inspect, challenge and reproduce.”

## Questions judges may ask

**Why LangGraph?** It separates interpretation, validation, scoring, sensitivity and explanation into explicit steps. This demo runs a real graph. It does not require multiple agents or autonomous browsing.

**Is the AI calculating the score?** No. Deterministic Python calculations do the scoring. In no-key mode, question handling is rule-based, not generative AI. Do not describe it as an autonomous AI analyst.

**Where did the weights come from?** They are explicit analyst assumptions. We expose alternative settings so the recommendation can be challenged. They were not supplied by RSM in the brief.

**Does “verified” mean a booking?** No. It is a user-supplied evidence status. Confirm exact dates, capacity and activities before claiming feasibility. No bookings are made.

**What is the biggest limitation?** Real confidence depends on complete route coverage, credible fares and venue evidence. Four sensitivity presets are not a full uncertainty model.

**Why not MCP?** MCP is useful for exposing tools to other assistants. For this demonstration, LangGraph coordinates the workflow directly and the dashboard provides the interaction.
