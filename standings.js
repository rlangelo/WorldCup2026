// ─────────────────────────────────────────────
//  World Cup 2026 Sweepstakes — standings.js
// ─────────────────────────────────────────────

// ── Config ────────────────────────────────────
const SHEET_ID = "2PACX-1vQiCswyzh7OoxCglMTk3tCiOrlVzNsue4Yi1iOHYoTvcPGjtpNS_sSiGjCEznGstW52LuZw7rhkrKoa";

let PLAYERS = []; // populated at runtime from the "list_of_players" sheet tab

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
//  predictions columns: match_id | <player_id> | ... (one column per player id from list_of_players)
//                       (each cell formatted as "score_a-score_b", e.g. "2-1")
// ─────────────────────────────────────────────

const SHEET_GIDS = {
  listOfPlayers:      605662356,
  schedule:           0,
  results:            712569962,
  predictions:        1644574011,
  scheduleKo:         554594304,
  resultsKo:          880665640,
  predictionsKo:      355717236,
  specialPredictions: 89695487,
  specialResults:     1115044732,
};

// schedule_ko / results_ko / predictions_ko use the same column format as the group stage tabs
// special_predictions columns: player_name | champion | vice_champion | golden_boot
// special_results columns:     champion | vice_champion | golden_boot   (one data row)

const SPECIAL_POINTS = {
  champion:    100,
  viceChampion: 50,
  goldenBoot:   75,
};

function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
}

async function fetchSheet(name, gid) {
  const res = await fetch(sheetUrl(gid));
  if (!res.ok) throw new Error(`Could not load the "${name}" tab (HTTP ${res.status})`);
  return parseCSV(await res.text());
}

async function fetchSheetOptional(name, gid) {
  if (!gid) return [];
  return fetchSheet(name, gid);
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

function buildPlayers(rows) {
  return rows
    .filter(r => r.id)
    .map(r => ({ id: r.id.trim(), name: `${r.first_name.trim()} ${r.last_name.trim()}`, bracket: "" }));
}

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

function buildSpecialPredictions(rows) {
  const map = {};
  rows.forEach(r => {
    const id = (r.player_name ?? "").trim();
    if (id) {
      map[id] = {
        champion:     (r.champion      ?? "").trim(),
        viceChampion: (r.vice_champion ?? "").trim(),
        goldenBoot:   (r.golden_boot   ?? "").trim(),
      };
    }
  });
  return map;
}

function buildSpecialResults(rows) {
  if (!rows.length) return null;
  const r = rows[0];
  const champion     = (r.champion      ?? "").trim();
  const viceChampion = (r.vice_champion ?? "").trim();
  const goldenBoot   = (r.golden_boot   ?? "").trim();
  if (!champion && !viceChampion && !goldenBoot) return null;
  return { champion, viceChampion, goldenBoot };
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

function computeSpecialScore(specialResults, playerPreds) {
  if (!specialResults || !playerPreds) return 0;
  let total = 0;
  const cmp = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
  if (cmp(specialResults.champion,     playerPreds.champion))     total += SPECIAL_POINTS.champion;
  if (cmp(specialResults.viceChampion, playerPreds.viceChampion)) total += SPECIAL_POINTS.viceChampion;
  if (cmp(specialResults.goldenBoot,   playerPreds.goldenBoot))   total += SPECIAL_POINTS.goldenBoot;
  return total;
}

// matchSets: [groupStage, knockoutStage] — each is { matches, results, predictions }
function computeStandings(matchSets, specialResults, specialPredictions) {
  return PLAYERS.map(player => {
    const stageScores = matchSets.map(({ matches, results, predictions }) => {
      let score = 0;
      matches.forEach(match => {
        const { points } = scoreMatch(results[match.id], predictions[player.id]?.[match.id]);
        if (points) score += points;
      });
      return score;
    });
    const groupScore   = stageScores[0] ?? 0;
    const koScore      = stageScores[1] ?? 0;
    const specialScore = computeSpecialScore(specialResults, specialPredictions[player.id]);
    const total        = groupScore + koScore + specialScore;
    return { player, total, groupScore, koScore, specialScore };
  }).sort((a, b) => b.total - a.total ||
    a.player.name.split(" ").slice(-1)[0].localeCompare(b.player.name.split(" ").slice(-1)[0]));
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
      <td>${row.total        ?? 0}</td>
      <td>${row.groupScore   ?? 0}</td>
      <td>${row.koScore      ?? 0}</td>
      <td>${row.specialScore ?? 0}</td>`;
    tbody.appendChild(tr);
  });
}

function renderResults(matches, results, predictions, headerId = "results-header", tableId = "results-table") {
  const header = document.getElementById(headerId);
  const tbody  = document.querySelector(`#${tableId} tbody`);

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

function renderSpecialPredictions(specialResults, specialPredictions) {
  const header = document.getElementById("special-header");
  const tbody  = document.querySelector("#special-table tbody");

  PLAYERS.forEach(p => {
    const th = document.createElement("th");
    th.textContent = p.name.split(" ").slice(-1)[0];
    header.appendChild(th);
  });

  const categories = [
    { key: "champion",     label: "Champion",      pts: SPECIAL_POINTS.champion     },
    { key: "viceChampion", label: "Vice-Champion", pts: SPECIAL_POINTS.viceChampion },
    { key: "goldenBoot",   label: "Golden Boot",   pts: SPECIAL_POINTS.goldenBoot   },
  ];

  categories.forEach(({ key, label, pts }) => {
    const actual = specialResults?.[key] ?? "";
    const tr = document.createElement("tr");
    let cells = `
      <td>${label} (${pts} pts)</td>
      <td>${actual || "—"}</td>`;

    PLAYERS.forEach(player => {
      const pred = specialPredictions[player.id]?.[key] ?? "";
      let cellContent, className;
      if (!actual) {
        cellContent = pred || "—";
        className   = "pending";
      } else if (!pred) {
        cellContent = "—";
        className   = "";
      } else if (actual.toLowerCase() === pred.toLowerCase()) {
        cellContent = `${pred} (+${pts})`;
        className   = "exact";
      } else {
        cellContent = `${pred} (0)`;
        className   = "wrong";
      }
      cells += `<td class="${className}">${cellContent}</td>`;
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
    const [
      playerRows,
      scheduleRows, resultsRows, predictionsRows,
      scheduleKoRows, resultsKoRows, predictionsKoRows,
      specialPredsRows, specialResRows,
    ] = await Promise.all([
      fetchSheet("list_of_players",     SHEET_GIDS.listOfPlayers),
      fetchSheet("schedule",            SHEET_GIDS.schedule),
      fetchSheet("results",             SHEET_GIDS.results),
      fetchSheet("predictions",         SHEET_GIDS.predictions),
      fetchSheet("schedule_ko",         SHEET_GIDS.scheduleKo),
      fetchSheetOptional("results_ko",      SHEET_GIDS.resultsKo),
      fetchSheetOptional("predictions_ko",  SHEET_GIDS.predictionsKo),
      fetchSheet("special_predictions", SHEET_GIDS.specialPredictions),
      fetchSheet("special_results",     SHEET_GIDS.specialResults),
    ]);

    PLAYERS = buildPlayers(playerRows);

    const matches            = buildMatches(scheduleRows);
    const results            = buildResults(resultsRows);
    const predictions        = buildPredictions(predictionsRows);
    const matchesKo          = buildMatches(scheduleKoRows);
    const resultsKo          = buildResults(resultsKoRows);
    const predictionsKo      = buildPredictions(predictionsKoRows);
    const specialPredictions = buildSpecialPredictions(specialPredsRows);
    const specialResults     = buildSpecialResults(specialResRows);

    renderResults(matches,   results,   predictions);
    renderResults(matchesKo, resultsKo, predictionsKo, "knockout-header", "knockout-table");
    renderSpecialPredictions(specialResults, specialPredictions);
    renderStandings(computeStandings(
      [{ matches, results, predictions }, { matches: matchesKo, results: resultsKo, predictions: predictionsKo }],
      specialResults,
      specialPredictions,
    ));
    renderBrackets();
  } catch (err) {
    showError(`Could not load data. (${err.message})`);
  } finally {
    showLoading(false);
  }
});
