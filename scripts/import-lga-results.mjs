import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultInput = path.join(repoRoot, "data", "lga-results.csv");
const defaultOutput = path.join(repoRoot, "assets", "lga-results.js");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const inputPath = path.resolve(args.get("--input") || defaultInput);
const outputPath = path.resolve(args.get("--output") || defaultOutput);
const electionId = args.get("--election-id") || "";
const label = args.get("--label") || "";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      value += "\"";
      i++;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => String(cell).trim()));
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bstates?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

function canonicalState(value) {
  const raw = String(value || "").trim();
  const key = normalizeName(raw);
  const aliases = new Map([
    ["fct", "Federal Capital Territory"],
    ["f c t", "Federal Capital Territory"],
    ["federal capital territory", "Federal Capital Territory"],
    ["abuja", "Federal Capital Territory"]
  ]);
  return aliases.get(key) || raw.replace(/\s+State$/i, "").trim();
}

function normalizeParty(value) {
  return String(value || "OTHERS")
    .trim()
    .replace(/^\((.*)\)$/, "$1")
    .toUpperCase()
    .replace(/\s+/g, "") || "OTHERS";
}

function numberValue(value) {
  return Number(String(value || "0").replace(/,/g, "")) || 0;
}

function readBoundaryNames() {
  const lgas = JSON.parse(fs.readFileSync(path.join(repoRoot, "assets", "nigeria-lgas.geojson"), "utf8"));
  return new Set(lgas.features.map((feature) => normalizeName(feature.properties?.shapeName)));
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input CSV not found: ${inputPath}`);
  console.error("Pass --input path/to/results.csv or create data/lga-results.csv.");
  process.exit(1);
}

const records = parseCsv(fs.readFileSync(inputPath, "utf8"));
const headers = records.shift()?.map(normalizeHeader) || [];
const required = ["election_id", "year", "type", "office", "state", "lga", "party", "votes"];
const missing = required.filter((header) => !headers.includes(header));
if (missing.length) {
  console.error(`Missing required columns: ${missing.join(", ")}`);
  process.exit(1);
}

const knownLgas = readBoundaryNames();
const grouped = new Map();
const unmatched = new Set();
const sourceWarnings = [];

for (const record of records) {
  const item = Object.fromEntries(headers.map((header, index) => [header, record[index] || ""]));
  const state = canonicalState(item.state);
  const lga = String(item.lga || "").trim();
  if (!knownLgas.has(normalizeName(lga))) unmatched.add(`${state} / ${lga}`);
  if (!item.source_url) sourceWarnings.push(`${state} / ${lga}`);
  const key = [item.election_id || electionId || "lga-import", state, lga, item.ward || ""].join("::");
  if (!grouped.has(key)) {
    grouped.set(key, {
      election_id: item.election_id || electionId || "lga-import",
      year: item.year || "",
      type: item.type || "",
      office: item.office || "",
      state,
      lga,
      ward: item.ward || "",
      parties: {},
      valid: 0,
      registered: numberValue(item.registered),
      accredited: numberValue(item.accredited),
      rejected: numberValue(item.rejected),
      turnout: numberValue(item.turnout),
      source_url: item.source_url || "",
      status: item.result_status || "imported"
    });
  }
  const row = grouped.get(key);
  const party = normalizeParty(item.party);
  const votes = numberValue(item.votes);
  row.parties[party] = (row.parties[party] || 0) + votes;
  row.valid += votes;
}

if (unmatched.size) {
  console.error("Unmatched LGA names. Fix these before publishing:");
  [...unmatched].sort().forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

const rows = [...grouped.values()];
const first = rows[0] || {};
const dataset = {
  id: electionId || first.election_id || "lga-import",
  year: first.year || "",
  type: first.type || "lga",
  office: first.office || "Election",
  label: label || `${first.year || "Imported"} ${first.office || "LGA"} results`,
  granularity: "lga",
  status: sourceWarnings.length ? "needs-source-review" : "verified-import",
  source: `Imported from ${path.basename(inputPath)}`,
  rows
};

const output = `window.lgaElectionDatasets = ${JSON.stringify([dataset], null, 2)};\n`;
fs.writeFileSync(outputPath, output);

console.log(`Wrote ${rows.length} LGA units to ${outputPath}`);
if (sourceWarnings.length) {
  console.warn(`${sourceWarnings.length} grouped units have no source_url. Add source links before marking verified.`);
}
