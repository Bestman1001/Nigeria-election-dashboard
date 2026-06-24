import fs from "node:fs";
import path from "node:path";

const endpoint = process.env.LIVE_RESULTS_URL || process.argv[2] || "";
const outputPath = path.resolve("assets/live-results.json");

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateDataset(dataset, index) {
  assertObject(dataset, `datasets[${index}]`);
  if (!dataset.id || !dataset.label) {
    throw new Error(`datasets[${index}] must include id and label`);
  }
  if (!Array.isArray(dataset.rows)) {
    throw new Error(`datasets[${index}].rows must be an array`);
  }
  dataset.rows.forEach((row, rowIndex) => {
    assertObject(row, `datasets[${index}].rows[${rowIndex}]`);
    assertObject(row.parties, `datasets[${index}].rows[${rowIndex}].parties`);
  });
}

function validatePayload(payload) {
  assertObject(payload, "Live payload");
  const datasets = payload.datasets || (payload.dataset ? [payload.dataset] : null);
  if (!Array.isArray(datasets)) {
    throw new Error("Live payload must include datasets[] or dataset");
  }
  datasets.forEach(validateDataset);
}

if (!endpoint) {
  console.log("LIVE_RESULTS_URL is not set; leaving assets/live-results.json unchanged.");
  process.exit(0);
}

const response = await fetch(endpoint, {
  headers: { accept: "application/json" }
});

if (!response.ok) {
  throw new Error(`Live feed returned HTTP ${response.status}`);
}

const payload = await response.json();
validatePayload(payload);

const normalized = {
  updatedAt: payload.updatedAt || payload.generatedAt || new Date().toISOString(),
  source: payload.source || endpoint,
  datasets: payload.datasets || [payload.dataset]
};

fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(`Synced ${normalized.datasets.length} live dataset(s) from ${endpoint}`);
