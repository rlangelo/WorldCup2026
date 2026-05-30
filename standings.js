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
  exact:       25,
  goalDiff:    18,
  winnerGoals: 15,
  loserGoals:  12,
  winner:      10,
};

// ─────────────────────────────────────────────
//  Google Sheets CSV fetching
//
//  Sheet must be published via:
//  File → Share → Publish to web → Entire Document
//
//  Tab gids (from the #gid= value in the sheet's edit URL):
//  schedule columns:    match_id | team_a | team_b
//  results columns:     match_id | score_a | score_b   (leave blank if unplayed)
//  predictions columns: match_id | angelo | despuig | duca | fernandez |
//                       georgiadis | leiro | miranda | ortiz |
//                       paredes | parra | riart | vasconcelos
//                       (each cell formatted as "score_a-score_b", e.g. "2-1")
// ─────────────────────────────────────────────

const SHEET_GIDS = {
  schedule:    0,
  results:     712569962,
  predictions: 1644574011,
};

function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
}

async function fetchSheet(name, gid) {
  const res = await fetch(sheetUrl(gid));
  if (!res.ok) throw new Error(`Could not load the "${name}" tab (HTTP ${res.status})`);
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

function scoreMatch(result, prediction) {
  if (!result || !prediction) return { points: null, tier: "pending" };

  const [ra, rb] = result;
  const [pa, pb] = prediction;

  const resultSide = ra > rb ? "A" : ra < rb ? "B" : "D";
  const predSide   = pa > pb ? "A" : pa < pb ? "B" : "D";

  if (resultSide !== predSide)                       return { points: 0,                   tier: "wrong"       };
  if (ra === pa && rb === pb)                        return { points: POINTS.exact,         tier: "exact"       };
  if (Math.abs(ra - rb) === Math.abs(pa - pb))       return { points: POINTS.goalDiff,      tier: "goal_diff"   };

  // Draw predictions always reach goalDiff (diff=0=0), so below is non-draw only.
  const winnerGoals = resultSide === "A" ? ra : rb;
  const loserGoals  = resultSide === "A" ? rb : ra;
  const predWinner  = resultSide === "A" ? pa : pb;
  const predLoser   = resultSide === "A" ? pb : pa;

  if (predWinner === winnerGoals) return { points: POINTS.winnerGoals, tier: "winner_goals" };
  if (predLoser  === loserGoals)  return { points: POINTS.loserGoals,  tier: "loser_goals"  };

  return { points: POINTS.winner, tier: "winner" };
}

function computeStandings(matches, results, predictions) {
  return PLAYERS.map(player => {
    let total = 0;
    matches.forEach(match => {
      const { points } = scoreMatch(results[match.id], predictions[player.id][match.id]);
      if (points) total += points;
    });
    return { player, total };
  }).sort((a, b) => b.total - a.total);
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
      <td>${row.total}</td>`;
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
      const { points, tier } = scoreMatch(result, pred);
      const predStr = pred ? `${pred[0]}–${pred[1]}` : "—";
      const label = (tier === "pending") ? predStr : `${predStr} (${points})`;
      cells += `<td class="${tier}">${label}</td>`;
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
      fetchSheet("schedule",     SHEET_GIDS.schedule),
      fetchSheet("results",      SHEET_GIDS.results),
      fetchSheet("predictions",  SHEET_GIDS.predictions),
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
