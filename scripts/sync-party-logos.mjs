import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("assets/party-logos");
const manifestPath = path.join(outDir, "party-logos.js");
const sourcesPath = path.join(outDir, "sources.csv");
const downloadListPath = path.join(outDir, "download-list.json");
const pages = [
  "https://inecnigeria.org/list-of-political-parties/",
  "https://inecnigeria.org/list-of-political-parties/page/2/",
  "https://inecnigeria.org/list-of-political-parties/page/3/"
];

fs.mkdirSync(outDir, { recursive: true });

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function absoluteUrl(value, pageUrl) {
  return new URL(decodeHtml(value), pageUrl).toString();
}

function codeFromName(name) {
  const match = decodeHtml(name).match(/\(([A-Z0-9-]{1,12})\)\s*$/);
  return match ? match[1].replace(/\s+/g, "").toUpperCase() : "";
}

function extensionFromUrl(url, contentType) {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname).replace(".", "");
  if (["svg", "png", "jpg", "jpeg", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function extractEntries(html, pageUrl) {
  const entries = [];
  const imgRegex = /<img\b[^>]*>/gi;
  for (const match of html.matchAll(imgRegex)) {
    const tag = match[0];
    const alt = decodeHtml(tag.match(/\balt=["']([^"']+)["']/i)?.[1] || "");
    const name = alt.replace(/^Image:\s*/i, "").trim();
    const code = codeFromName(name);
    if (!code) continue;
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1] || "";
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || "";
    const bestSrc = srcset
      ? srcset.split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean).pop()
      : src;
    if (!bestSrc) continue;
    entries.push({ code, name, url: absoluteUrl(bestSrc, pageUrl) });
  }
  return entries;
}

const collected = new Map();

for (const page of pages) {
  const response = await fetch(page, { headers: { "user-agent": "NigeriaElectionDashboardLogoSync/1.0" } });
  if (!response.ok) throw new Error(`Failed to fetch ${page}: ${response.status}`);
  const html = await response.text();
  for (const entry of extractEntries(html, page)) {
    if (!collected.has(entry.code)) collected.set(entry.code, entry);
  }
}

const manifest = {};
const sources = ["code,name,source,file"];
const downloadList = Array.from(collected.values()).sort((a, b) => a.code.localeCompare(b.code));

for (const entry of downloadList) {
  const response = await fetch(entry.url);
  if (!response.ok) {
    console.warn(`Skipping ${entry.code}: ${response.status} ${entry.url}`);
    continue;
  }
  const contentType = response.headers.get("content-type") || "";
  const ext = extensionFromUrl(entry.url, contentType);
  const fileName = `${entry.code}.${ext}`;
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(outDir, fileName), bytes);
  manifest[entry.code] = {
    name: entry.name,
    file: `assets/party-logos/${fileName}`,
    source: entry.url
  };
  sources.push(`${entry.code},"${entry.name.replaceAll('"', '""')}",${entry.url},${fileName}`);
}

fs.writeFileSync(manifestPath, `window.partyLogoManifest = ${JSON.stringify(manifest, null, 2)};\n`, "utf8");
fs.writeFileSync(sourcesPath, `${sources.join("\n")}\n`, "utf8");
fs.writeFileSync(downloadListPath, `${JSON.stringify(downloadList, null, 2)}\n`, "utf8");

console.log(`Synced ${Object.keys(manifest).length} INEC party logo(s).`);
