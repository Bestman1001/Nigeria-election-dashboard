# Nigeria Election Dashboard

Interactive static dashboard for exploring Nigerian election results by state and local government area.

## Current Scope

- Real Nigeria state and LGA boundary layers from geoBoundaries/GRID3.
- OpenStreetMap basemap.
- 2023 Nigerian presidential state-level result dataset.
- Uploaded historical presidential and gubernatorial CSV datasets from 1999 through 2022.
- Search, state drill-down, map metrics, party winner coloring, party badge marks, chart, table, and CSV import workflow.
- Live-feed controls for trusted JSON/API result sources.

## Data Model

The dashboard accepts CSV imports with these columns:

```csv
election_id,year,type,office,state,lga,ward,candidate,party,votes,registered,turnout,source_url,result_status
```

Rows are grouped by election, state, LGA, and ward. Party votes are aggregated into the dashboard view.

## Live API

GitHub Pages is static hosting, so live mode works by polling a trusted JSON endpoint every 30 seconds by default. Configure it in `assets/live-config.json`, enter an endpoint in the dashboard, or use a URL parameter:

```text
https://bestman1001.github.io/Nigeria-election-dashboard/?liveApi=https://example.org/results.json
```

Expected payload:

```json
{
  "updatedAt": "2026-06-24T12:00:00Z",
  "source": "Trusted live election feed",
  "datasets": [
    {
      "id": "2026-ekiti-governor-live",
      "label": "2026 Ekiti Governor live results",
      "year": 2026,
      "type": "gubernatorial",
      "office": "Governor",
      "granularity": "lga",
      "status": "live",
      "rows": [
        {
          "state": "Ekiti",
          "lga": "Ado Ekiti",
          "parties": { "APC": 0, "PDP": 0, "LP": 0 },
          "valid": 0,
          "registered": 0,
          "turnout": 0,
          "status": "pending",
          "source_url": "https://trusted-source.example/result-sheet"
        }
      ]
    }
  ]
}
```

Candidate trusted sources include ERAD, a verified election-observer backend, Supabase, Firebase, Google Sheets middleware, or another API that can provide signed or reviewed JSON.

## Party Logos

The dashboard currently renders generated party badge marks. Official party logos can be added later in `assets/party-logos/` using uppercase party-code filenames such as `APC.svg`, `PDP.svg`, `LP.svg`, and `NNPP.svg` after usage rights and sources are confirmed.

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
