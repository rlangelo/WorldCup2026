// ─────────────────────────────────────────────
//  World Cup 2026 Sweepstakes — standings.js
// ─────────────────────────────────────────────

// ── Config ────────────────────────────────────
const SHEET_ID = "2PACX-1vQiCswyzh7OoxCglMTk3tCiOrlVzNsue4Yi1iOHYoTvcPGjtpNS_sSiGjCEznGstW52LuZw7rhkrKoa";

const PLAYERS = [
  { id: "angelo",      name: "Rafael Angelo",     bracket: "" },
  { id: "despuig",     name: "Sebas Despuig",      bracket: "" },
  { id: "duca",        name: "Ruxi Duca",          bracket: "" },
  { id: "fernandez",   name: "Chris Fernandez",    bracket: "" },
  { id: "georgiadis",  name: "Kostas Georgiadis",  bracket: "" },
  { id: "leiro",       name: "Alejandro Leiro",    bracket: "" },
  { id: "miranda",     name: "Sebas Miranda",      bracket: "" },
  { id: "ortiz",       name: "Sebas Ortiz",        bracket: "" },
  { id: "paredes",     name: "Diego Paredes",      bracket: "" },
  { id: "parra",       name: "Chito Parra",        bracket: "" },
  { id: "riart",       name: "Nico Riart",         bracket: "" },
  { id: "vasconcelos", name: "Joao Vasconcelos",   bracket: "" },
];

const POINTS = {
  exact:   3,  // correct scoreline
  outcome: 1,  // correct outcome (W/D/L) only
};

// ─────────────────────────────────────────────
//  Google Sheets CSV fetching
//
//  Sheet must be published via:
//  File → Share → Publish to web → choose tab → CSV
//
//  Expected tab names: "schedule", "results", "predictions"
//
//  schedule columns:    match_id | team_a | team_b
//  results columns:     match_id | score_a | score_b   (leave blank if unplayed)
//  predictions columns: match_id | angelo | despuig | duca | fernandez |
//                       georgiadis | leiro | miranda | ortiz |
//                       paredes | parra | riart | vasconcelos
//                       (each cell formatted as "score_a-score_b", e.g. "2-1")
// ─────────────────────────────────────────────

function sheetUrl(tabName) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv&sheet=${encodeURIComponent(tabName)}`;
}

async function fetchSheet(tabName) {
  const res = await fetch(sheetUrl(tabName));
  if (!res.ok) throw new Error(`Could not load the "${tabName}" tab (HTTP ${res.status})`);
  return parseCSV(await res.text());
}

// ── CSV parser ────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? "").trim(); });
    return obj;
  });
}

function parseCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─────────────────────────────────────────────
//  Data builders
// ─────────────────────────────────────────────

function buildMatches(rows) {
  return rows.map(r => ({
    id:    r.match_id,
    teamA: r.team_a,
    teamB: r.team_b,
  }));
}

function buildResults(rows) {
  const map = {};
  rows.forEach(r => {
    const a = r.score_a, b = r.score_b;
    map[r.match_id] = (a !== "" && b !== "") ? [parseInt(a), parseInt(b)] : null;
  });
  return map;
}

function buildPredictions(rows) {
  const map = {};
  PLAYERS.forEach(p => { map[p.id] = {}; });
  rows.forEach(r => {
    PLAYERS.forEach(p => {
      const val = (r[p.id] ?? "").trim();
      if (val.includes("-")) {
        const [a, b] = val.split("-").map(Number);
        map[p.id][r.match_id] = [a, b];
      } else {
        map[p.id][r.match_id] = null;
      }
    });
  });
  return map;
}

// ─────────────────────────────────────────────
//  Scoring logic
// ─────────────────────────────────────────────

function getOutcome(a, b) {
  return a > b ? "W" : a < b ? "L" : "D";
}

function scoreMatch(result, prediction) {
  if (!result || !prediction) return { exact: false, outcome: false };
  const exact = result[0] === prediction[0] && result[1] === prediction[1];
  const outcome = getOutcome(result[0], result[1]) === getOutcome(prediction[0], prediction[1]);
  return { exact, outcome };
}

function computeStandings(matches, results, predictions) {
  return PLAYERS.map(player => {
    let exactCount = 0, outcomeCount = 0;
    matches.forEach(match => {
      const { exact, outcome } = scoreMatch(results[match.id], predictions[player.id][match.id]);
      if (exact) exactCount++;
      else if (outcome) outcomeCount++;
    });
    const total = exactCount * POINTS.exact + outcomeCount * POINTS.outcome;
    return { player, total, exactCount, outcomeCount };
  }).sort((a, b) => b.total - a.total || b.exactCount - a.exactCount);
}

// ─────────────────────────────────────────────
//  Rendering
// ─────────────────────────────────────────────

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderStandings(standings) {
  const tbody = document.querySelector("#standings-table tbody");
  tbody.innerHTML = "";
  standings.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ordinal(i + 1)}</td>
      <td>${row.player.name}</td>
      <td>${row.total}</td>
      <td>${row.outcomeCount}</td>
      <td>${row.exactCount}</td>`;
    tbody.appendChild(tr);
  });
}

function renderResults(matches, results, predictions) {
  const header = document.getElementById("results-header");
  const tbody  = document.querySelector("#results-table tbody");

  PLAYERS.forEach(p => {
    const th = document.createElement("th");
    th.textContent = p.name.split(" ").slice(-1)[0];
    header.appendChild(th);
  });

  matches.forEach(match => {
    const result = results[match.id];
    const tr = document.createElement("tr");
    let cells = `
      <td>${match.teamA} v ${match.teamB}</td>
      <td>${result ? `${result[0]}–${result[1]}` : "—"}</td>`;

    PLAYERS.forEach(player => {
      const pred = predictions[player.id][match.id];
      const { exact, outcome } = scoreMatch(result, pred);
      let cls = "pending";
      if (result) cls = exact ? "exact" : outcome ? "outcome" : "wrong";
      cells += `<td class="${cls}">${pred ? `${pred[0]}–${pred[1]}` : "—"}</td>`;
    });

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

function renderBrackets() {
  const tbody = document.getElementById("brackets-body");
  PLAYERS.forEach(p => {
    const tr = document.createElement("tr");
    const link = p.bracket ? `<a href="${p.bracket}" target="_blank">View</a>` : "—";
    tr.innerHTML = `<td>${p.name}</td><td>${link}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Loading / error states ────────────────────
function showLoading(visible) {
  document.getElementById("loading").style.display = visible ? "block" : "none";
}

function showError(msg) {
  showLoading(false);
  const el = document.getElementById("error");
  el.textContent = msg;
  el.style.display = "block";
}

// ─────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  showLoading(true);
  try {
    const [scheduleRows, resultsRows, predictionsRows] = await Promise.all([
      fetchSheet("schedule"),
      fetchSheet("results"),
      fetchSheet("predictions"),
    ]);

    const matches     = buildMatches(scheduleRows);
    const results     = buildResults(resultsRows);
    const predictions = buildPredictions(predictionsRows);

    renderResults(matches, results, predictions);
    renderStandings(computeStandings(matches, results, predictions));
    renderBrackets();
  } catch (err) {
    showError(`Could not load data. (${err.message})`);
  } finally {
    showLoading(false);
  }
});
