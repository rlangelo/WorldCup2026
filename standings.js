// ─────────────────────────────────────────────
//  World Cup 2026 Sweepstakes — standings.js
// ─────────────────────────────────────────────

// ── Players ──────────────────────────────────
// TODO: update names and add/remove entries as needed
const PLAYERS = [
  { id: "angelo",      name: "Rafael Angelo",      bracket: "" },
  { id: "collette",    name: "David Collette",      bracket: "" },
  { id: "duca",        name: "Ruxi Duca",           bracket: "" },
  { id: "garcia",      name: "Alex Garcia",         bracket: "" },
  { id: "georgiadis",  name: "Kostas Georgiadis",   bracket: "" },
  { id: "leiro",       name: "Alejandro Leiro",     bracket: "" },
  { id: "miranda",     name: "Sebastian Miranda",   bracket: "" },
  { id: "ortiz",       name: "Sebastian Ortiz",     bracket: "" },
  { id: "parra",       name: "Chito Parra",         bracket: "" },
  { id: "paredes",     name: "Diego Paredes",       bracket: "" },
  { id: "riart",       name: "Nico Riart",          bracket: "" },
  { id: "staszak",     name: "Meredith Staszak",    bracket: "" },
  { id: "vasconcelos", name: "Joao Vasconcelos",    bracket: "" },
];

// ── Teams ─────────────────────────────────────
// TODO: replace with the 48 qualified teams for 2026
const TEAMS = [];

// ── Match schedule ────────────────────────────
// Format: [teamA, teamB]
// TODO: fill in the full group-stage schedule (104 matches)
const MATCHES = [];

// ── Actual results ────────────────────────────
// Format: [goalsA, goalsB] or null for unplayed
// TODO: update as matches are played
const RESULTS = MATCHES.map(() => null);

// ── Player predictions ────────────────────────
// Each entry is an array parallel to MATCHES: [goalsA, goalsB]
// TODO: fill in each player's predictions once collected
const PREDICTIONS = {
  angelo:      MATCHES.map(() => [0, 0]),
  collette:    MATCHES.map(() => [0, 0]),
  duca:        MATCHES.map(() => [0, 0]),
  garcia:      MATCHES.map(() => [0, 0]),
  georgiadis:  MATCHES.map(() => [0, 0]),
  leiro:       MATCHES.map(() => [0, 0]),
  miranda:     MATCHES.map(() => [0, 0]),
  ortiz:       MATCHES.map(() => [0, 0]),
  parra:       MATCHES.map(() => [0, 0]),
  paredes:     MATCHES.map(() => [0, 0]),
  riart:       MATCHES.map(() => [0, 0]),
  staszak:     MATCHES.map(() => [0, 0]),
  vasconcelos: MATCHES.map(() => [0, 0]),
};

// ── Scoring rules ─────────────────────────────
// TODO: update points once the 2026 rules are decided
const POINTS = {
  exact:   3,   // exact scoreline
  outcome: 1,   // correct outcome (W/D/L) only
};

// ─────────────────────────────────────────────
//  Scoring logic
// ─────────────────────────────────────────────

function getOutcome(a, b) {
  if (a > b) return "W";
  if (a < b) return "L";
  return "D";
}

function scoreMatch(result, prediction) {
  if (!result) return { exact: false, outcome: false };
  const exact = result[0] === prediction[0] && result[1] === prediction[1];
  const outcome = getOutcome(result[0], result[1]) === getOutcome(prediction[0], prediction[1]);
  return { exact, outcome };
}

function computeStandings() {
  return PLAYERS.map((player) => {
    let exactCount = 0;
    let outcomeCount = 0;

    MATCHES.forEach((_, i) => {
      const { exact, outcome } = scoreMatch(RESULTS[i], PREDICTIONS[player.id][i]);
      if (exact) { exactCount++; }
      else if (outcome) { outcomeCount++; }
    });

    const total = exactCount * POINTS.exact + outcomeCount * POINTS.outcome;
    return { player, total, outcomeCount, exactCount };
  }).sort((a, b) => b.total - a.total || b.exactCount - a.exactCount);
}

// ─────────────────────────────────────────────
//  DOM rendering
// ─────────────────────────────────────────────

function formatScore(pred) {
  return `${pred[0]} x ${pred[1]}`;
}

function formatResult(result) {
  return result ? `${result[0]} x ${result[1]}` : "---";
}

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
      <td>${row.exactCount}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResults() {
  const header = document.getElementById("results-header");
  const tbody = document.querySelector("#results-table tbody");

  // inject player column headers
  PLAYERS.forEach((p) => {
    const th = document.createElement("th");
    th.textContent = p.name.split(" ")[1] || p.name;
    header.appendChild(th);
  });

  // one row per match
  MATCHES.forEach((match, i) => {
    const result = RESULTS[i];
    const tr = document.createElement("tr");

    const matchLabel = `${match[0]} x ${match[1]}`;
    let cells = `<td>${matchLabel}</td><td>${formatResult(result)}</td>`;

    PLAYERS.forEach((player) => {
      const pred = PREDICTIONS[player.id][i];
      const { exact, outcome } = scoreMatch(result, pred);
      let cls = "pending";
      if (result) {
        cls = exact ? "exact" : outcome ? "outcome" : "wrong";
      }
      cells += `<td class="${cls}">${formatScore(pred)}</td>`;
    });

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

function renderBrackets() {
  const tbody = document.getElementById("brackets-body");
  PLAYERS.forEach((p) => {
    const tr = document.createElement("tr");
    const link = p.bracket
      ? `<a href="${p.bracket}" target="_blank">View</a>`
      : "—";
    tr.innerHTML = `<td>${p.name}</td><td>${link}</td>`;
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  renderResults();
  renderStandings(computeStandings());
  renderBrackets();
});
