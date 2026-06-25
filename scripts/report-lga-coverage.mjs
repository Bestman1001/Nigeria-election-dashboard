import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetPath = path.resolve(process.argv[2] || path.join(repoRoot, "assets", "lga-results.js"));

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bstates?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalState(value) {
  const key = normalizeName(value);
  const aliases = new Map([
    ["fct", "Federal Capital Territory"],
    ["federal capital territory", "Federal Capital Territory"],
    ["abuja federal capital territory", "Federal Capital Territory"],
    ["abuja", "Federal Capital Territory"]
  ]);
  return aliases.get(key) || String(value || "").replace(/\s+State$/i, "").trim();
}

function featureName(feature) {
  return feature.properties?.shapeName || "Unknown";
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, geometry) {
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polygons.some((polygon) => {
    if (!pointInRing(point, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => pointInRing(point, hole));
  });
}

function centroid(feature) {
  const points = [];
  const visit = (coords) => {
    if (typeof coords[0] === "number") points.push(coords);
    else coords.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  const total = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function loadDatasetRows(filePath) {
  const js = fs.readFileSync(filePath, "utf8");
  const match = js.match(/window\.lgaElectionDatasets\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) throw new Error(`Unable to parse ${filePath}`);
  return JSON.parse(match[1])[0]?.rows || [];
}

const statesGeo = JSON.parse(fs.readFileSync(path.join(repoRoot, "assets", "nigeria-states.geojson"), "utf8"));
const lgasGeo = JSON.parse(fs.readFileSync(path.join(repoRoot, "assets", "nigeria-lgas.geojson"), "utf8"));
const rows = loadDatasetRows(datasetPath);
const rowKeys = new Set(rows.map((row) => `${normalizeName(canonicalState(row.state))}::${normalizeName(row.lga)}`));
const boundaryKeys = new Set();
const missing = [];
const counts = [];

for (const state of statesGeo.features) {
  const stateName = featureName(state);
  const lgas = lgasGeo.features
    .filter((lga) => pointInPolygon(centroid(lga), state.geometry))
    .map(featureName)
    .sort();
  const present = lgas.filter((lga) => rowKeys.has(`${normalizeName(canonicalState(stateName))}::${normalizeName(lga)}`));
  lgas.forEach((lga) => boundaryKeys.add(`${normalizeName(canonicalState(stateName))}::${normalizeName(lga)}`));
  counts.push({ state: stateName, present: present.length, total: lgas.length });
  lgas.forEach((lga) => {
    if (!rowKeys.has(`${normalizeName(canonicalState(stateName))}::${normalizeName(lga)}`)) missing.push({ state: stateName, lga });
  });
}

const extra = [...rowKeys].filter((key) => !boundaryKeys.has(key)).map((key) => {
  const [state, lga] = key.split("::");
  return { state, lga };
});

console.log(JSON.stringify({
  dataset: path.relative(repoRoot, datasetPath),
  rows: rows.length,
  unitsWithRows: rowKeys.size,
  boundaryUnits: lgasGeo.features.length,
  missingCount: missing.length,
  extraCount: extra.length,
  counts: counts.filter((item) => item.present !== item.total),
  missing,
  extra
}, null, 2));
