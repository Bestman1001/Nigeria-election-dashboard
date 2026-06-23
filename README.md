# Nigeria Election Dashboard

Interactive static dashboard for exploring Nigerian election results by state and local government area.

## Current Scope

- Real Nigeria state and LGA boundary layers from geoBoundaries/GRID3.
- OpenStreetMap basemap.
- 2023 Nigerian presidential state-level result dataset.
- Search, state drill-down, map metrics, party winner coloring, chart, table, and CSV import workflow.

## Data Model

The dashboard accepts CSV imports with these columns:

```csv
election_id,year,type,office,state,lga,ward,candidate,party,votes,registered,turnout,source_url,result_status
```

Rows are grouped by election, state, LGA, and ward. Party votes are aggregated into the dashboard view.

## Sources

- Boundary files: geoBoundaries Nigeria ADM1 and ADM2, sourced from GRID3.
- Starter result table: 2023 Nigerian presidential election state table compiled from INEC/state result reports.
- Future official result records can be added from INEC result documents, IReV records, state electoral commissions, and verified civil-society datasets.

## Run Locally

Open `index.html` directly or serve the folder:

```bash
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`.
