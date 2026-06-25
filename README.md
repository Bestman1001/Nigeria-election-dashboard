# Nigeria Election Dashboard

Interactive static dashboard for exploring Nigerian election results by state and local government area.

## Current Scope

- Real Nigeria state and LGA boundary layers from geoBoundaries/GRID3.
- OpenStreetMap basemap.
- 2023 Nigerian presidential state-level result dataset.
- Uploaded historical presidential and gubernatorial CSV datasets from 1999 through 2022.
- Search, state drill-down, map metrics, party winner coloring, INEC party logos, chart, table, and CSV import workflow.
- Live-feed controls for trusted JSON/API result sources.

## Data Model

The dashboard accepts CSV imports with these columns:

```csv
election_id,year,type,office,state,lga,ward,candidate,party,votes,registered,turnout,source_url,result_status
```

Rows are grouped by election, state, LGA, and ward. Party votes are aggregated into the dashboard view.

## Live API

GitHub Pages is static hosting, so live mode uses two layers:

1. A GitHub Actions mirror job copies a trusted external API into `assets/live-results.json`.
2. The dashboard polls `assets/live-results.json` every 30 seconds by default.

This keeps the public site fast, avoids browser CORS issues, and creates an auditable commit history for election-night data changes.

To enable production live mode, add one of these repository settings:

- Repository variable: `LIVE_RESULTS_URL`
- Repository secret: `LIVE_RESULTS_URL`

Then run **Actions -> Sync trusted live feed** manually, or let the scheduled workflow run every 15 minutes. For faster election-night operations, the workflow can be triggered manually after a verified source update.

You can still enter an endpoint in the dashboard directly, or use a URL parameter:

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

## Automated Maintenance

The repository includes:

- `.github/workflows/sync-live-feed.yml`: mirrors a trusted live JSON endpoint into `assets/live-results.json`.
- `.github/workflows/sync-party-logos.yml`: refreshes current INEC party logos weekly and can be run manually.
- `scripts/sync-live-feed.mjs`: validates live result JSON before writing it.
- `scripts/sync-party-logos.mjs`: refreshes party logos from INEC's official party list.

## Party Logos

Current registered-party logos are sourced from INEC's official political parties page:

```text
https://inecnigeria.org/list-of-political-parties/
```

The dashboard loads `assets/party-logos/party-logos.js` and uses real logo images when a party code is available. It falls back to generated badge marks for older or defunct parties that are not in the current INEC list.

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
