# Conference Decision Lab — start here

The dashboard is running at **http://127.0.0.1:8765** on this computer. It uses a real LangGraph pipeline with deterministic Python calculations. The included data are synthetic. They are not the RSM datasets and must not be presented as real findings.

## Your next 10 minutes

1. Open the dashboard. Select **Time first** and watch the leader change from Dallas to Chicago in the synthetic example.
2. Select **Require verified venue & activities**, then **Run scenario**. The demo correctly returns no feasible city because no venue is verified.
3. Select **Reset**. Use **Present** for the uncluttered presentation view.
4. Export your actual Alteryx results in the format in `data/demo_cities.csv`. Use **Import data**. Do not rename the demo as real data.
5. Use **Download report**, open the downloaded HTML, and select **Print / Save as PDF**. **Download CSV** exports rankings; **Export audit JSON** captures inputs, parameters, scores, evidence and graph steps.

## Restart

On this Mac, double-click `run.command`, or run it from Terminal. Open http://127.0.0.1:8765. If you see “address already in use,” the app may already be running; open the URL instead of starting another instance.

On another computer, install Python 3.12 or newer, open a terminal in this folder, then:

```sh
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows instead:
# .venv\Scripts\activate
python -m pip install -r requirements-lock.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

Stop the server with Ctrl+C. The app binds only to this computer. It has no hosted public URL.

## What is already working

- Responsive dashboard with presentation mode, ranking bars, comparison table and evidence register.
- Real LangGraph graph: interpret → validate → calculate → stress test → explain.
- Cost/time/access/proximity weights; airfare shock; cash budget; optional employee time valuation.
- Venue capacity, availability, activity support and budget feasibility gates.
- Four sensitivity presets. These are illustrative tests, not probabilities.
- CSV validation, report export, CSV export and reproducible audit JSON.
- Offline question shortcuts: “Prioritize employee time,” “Prioritize cost,” “What if airfare increases 20%?” and “Require verified venues.” Other offline questions return the current computed explanation. This mode is not a generative AI agent.

## Optional generative AI

No API key is required for the demo. For free-form interpretation and additional commentary, set **ANTHROPIC_API_KEY** and **ANTHROPIC_MODEL** in the terminal environment before starting the server. Use a model available in your Anthropic account. Do not put secrets in source files, screenshots, slides, or chat. Reload the dashboard, then explicitly enable **Use AI interpretation**. The app sends the question and city-level metrics/evidence to Anthropic only when that box is enabled and a question is submitted. It never needs employee names.

The language model proposes scenario parameters; Python validates and calculates them. Review the displayed applied parameters. AI text is separately labeled. API failures fall back to offline rules. The live provider integration has not been tested with a real key.

## How scoring works

Default weights: cost 40%, time 30%, nonstop accessibility 20%, local employee share 10%. These are analyst choices, not organizer-provided weights.

For a lower-is-better metric: `100 * (maximum - value) / (maximum - minimum)`.
For a higher-is-better metric: `100 * (value - minimum) / (maximum - minimum)`.
If all values are equal, the metric receives 50. Weighted scores range from 0 to 100. The reference set contains all imported candidates, including excluded ones, so a budget filter does not artificially change scores. Changing the candidate set can change normalization. Exact ties sort alphabetically and near-ties are flagged in the explanation.

Cash cost = total airfare × (1 + airfare change / 100) + other event costs.
Economic cost = cash cost + employee travel hours × hourly value. Economic cost is reported separately, so time is not counted in both the cost and time scores.

The baseline uses default weights, zero airfare shock, no budget cap, and permits provisional venue facts. Sensitivity uses the current budget, airfare and venue constraints with four alternative weight sets. Unknown venue suitability is provisional; strict mode excludes it.

## What is still needed for the submission

- The actual employee and flight datasets.
- Your run and saved/exported workflow in Alteryx Designer Cloud. This project does not include or claim to have executed an Alteryx workflow.
- Source-backed venue capacity, availability for conference dates, activity support and cost assumptions.
- A report exported after importing real data. A demo city is not your final recommendation.

See `ALTERYX_GUIDE.md` for the workflow and `PITCH_SCRIPT.md` for a short demo narrative.

## Verification

17 automated tests cover ranking changes, budget and venue gates, invalid inputs, cost arithmetic, normalization, API import, and AI failure fallback. Run `python -m pytest -q` from this folder. Core code is in `engine.py`; the API is in `app.py`; the dashboard is in `static/`.

## References

- LangGraph graph model: https://docs.langchain.com/oss/python/langgraph/graph-api
- Alteryx Designer Cloud tools: https://help.alteryx.com/aac/en/designer-experience/standard-mode-tools.html
- Alteryx cloud CSV output: https://help.alteryx.com/designer-cloud/en/standard-mode-tools/workflow-in-out-tools/output-data-tool.html
- Anthropic API: https://platform.claude.com/docs/en/api/overview
