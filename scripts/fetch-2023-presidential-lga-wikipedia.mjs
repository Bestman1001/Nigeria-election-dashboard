import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repoRoot, "data", "2023-presidential-lga-wikipedia.csv");

const states = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara"
];

const headers = [
  "election_id", "year", "type", "office", "state", "lga", "ward", "candidate", "party",
  "votes", "registered", "accredited", "valid", "rejected", "total_votes", "turnout",
  "source_url", "result_status"
];

const skipLgaRows = new Set(["votes", "tipchi", "tsagem", "unadu"]);

const lgaAliases = new Map(Object.entries({
  "Abia::Obi Ngwa": "Obi Nwga",
  "Abia::Osisioma": "Osisioma Ngwa",
  "Bauchi::Damban": "Dambam",
  "Bauchi::Jamaare": "Jama'Are",
  "Bayelsa::Yenagoa": "Yenegoa",
  "Benue::Otukpo": "Oturkpo",
  "Edo::Igueben": "Iguegben",
  "Edo::Orihionmwon": "Orhionmwon",
  "Ekiti::Ijero Ekiti": "Ijero",
  "Ekiti::Ikere-Ekiti": "Ikere",
  "Federal Capital Territory::Abuja": "Municipal Area Council",
  "Gombe::Shongom": "Shomgom",
  "Imo::Ezinihitte Mbaise": "Ezinihitte",
  "Imo::Mbaitoli": "Mbatoli",
  "Kano::Garun Mallam": "Garun Malam",
  "Kano::Nasarawa": "Nassarawa",
  "Kebbi::Bagudo": "Bagudu",
  "Lagos::Ifako-Ijaiye": "Ifako/Ijaye",
  "Lagos::Somolu": "Shomolu",
  "Nasarawa::Eggon": "Nasarawa Egon",
  "Ogun::Sagamu": "Shagamu",
  "Osun::Aiyedaade": "Ayedade",
  "Osun::Aiyedire": "Ayedire",
  "Osun::Ilesa East": "Ilesha East",
  "Osun::Ilesa West": "Ilesha West",
  "Rivers::Emohua": "Emuoha",
  "Rivers::Omuma": "Omumma",
  "Sokoto::Wamako": "Wamakko"
}));

function titleForState(state) {
  if (state === "Federal Capital Territory") {
    return "2023_Nigerian_presidential_election_in_the_Federal_Capital_Territory";
  }
  return `2023_Nigerian_presidential_election_in_${state.replaceAll(" ", "_")}_State`;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "")
    .replace(/<sup\b[\s\S]*?<\/sup>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function numberText(value) {
  return String(value || "").replace(/,/g, "").replace(/%/g, "").trim();
}

function isNumeric(value) {
  return /^\d+(\.\d+)?$/.test(String(value || ""));
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalLga(state, lga) {
  return lgaAliases.get(`${state}::${lga}`) || lga;
}

function tableRows(tableHtml) {
  const rows = [];
  const rowMatches = tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells = [];
    const cellMatches = rowMatch[0].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi);
    for (const cell of cellMatches) {
      cells.push(stripTags(cell[2]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function findLgaTable(html) {
  const headingIndex = html.indexOf('id="By_local_government_area"');
  if (headingIndex < 0) return null;
  const rest = html.slice(headingIndex);
  const table = rest.match(/<table\b[\s\S]*?<\/table>/i);
  return table?.[0] || null;
}

function parseStateTable(state, sourceUrl, tableHtml) {
  const rows = tableRows(tableHtml);
  const dataRows = rows.filter((row) => {
    const first = row[0] || "";
    return row.length >= 7 && !/^local government area$/i.test(first) && !/^federal constituency$/i.test(first) && !/^totals?\b/i.test(first);
  });
  const output = [];
  for (const row of dataRows) {
    const sourceLga = row[0];
    if (skipLgaRows.has(normalizeName(sourceLga))) continue;
    const lga = canonicalLga(state, sourceLga);
    const compactPartyTable = row.length < 12;
    const apc = numberText(row[1]);
    const pdp = numberText(row[compactPartyTable ? 2 : 3]);
    const lp = numberText(row[compactPartyTable ? 3 : 5]);
    const nnpp = numberText(row[compactPartyTable ? 4 : 7]);
    const others = numberText(row[compactPartyTable ? 5 : 9]);
    const valid = numberText(row[compactPartyTable ? 6 : 11]);
    const turnout = compactPartyTable ? "" : numberText(row[12]);
    if (![apc, pdp, lp, nnpp, others, valid].every(isNumeric)) continue;
    const parties = [
      ["Bola Tinubu", "APC", apc],
      ["Atiku Abubakar", "PDP", pdp],
      ["Peter Obi", "LP", lp],
      ["Rabiu Kwankwaso", "NNPP", nnpp],
      ["Other candidates", "OTHERS", others]
    ];
    for (const [candidate, party, votes] of parties) {
      output.push({
        election_id: "2023-presidential-lga-wikipedia",
        year: "2023",
        type: "general",
        office: "President",
        state,
        lga,
        ward: "",
        candidate,
        party,
        votes,
        registered: "",
        accredited: "",
        valid,
        rejected: "",
        total_votes: valid,
        turnout,
        source_url: sourceUrl,
        result_status: "verified-secondary"
      });
    }
  }
  return output;
}

const allRows = [];
const failures = [];
const skipped = [];

for (const state of states) {
  const title = titleForState(state);
  const url = `https://en.wikipedia.org/wiki/${title}`;
  const response = await fetch(url, {
    headers: { "user-agent": "NigeriaElectionDashboard/1.0 (public data extraction)" }
  });
  if (!response.ok) {
    failures.push(`${state}: HTTP ${response.status}`);
    continue;
  }
  const html = await response.text();
  const table = findLgaTable(html);
  if (!table) {
    failures.push(`${state}: no LGA table`);
    continue;
  }
  const rows = parseStateTable(state, url, table);
  if (!rows.length) {
    skipped.push(`${state}: no numeric LGA results published in table`);
    continue;
  }
  allRows.push(...rows);
  console.log(`${state}: ${rows.length / 5} LGAs`);
}

if (failures.length) {
  console.error("Extraction failed for:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

if (skipped.length) {
  console.warn("Skipped placeholder-only tables:");
  skipped.forEach((item) => console.warn(`- ${item}`));
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const csv = [
  headers.join(","),
  ...allRows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
].join("\n");

fs.writeFileSync(outputPath, `${csv}\n`);
console.log(`Wrote ${allRows.length} party rows to ${outputPath}`);
