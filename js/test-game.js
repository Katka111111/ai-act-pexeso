// Samostatný nekonečný test (bez Firebase, bez jména, bez lektorky) - uživatel si
// může libovolně generovat nové kombinace 7 dvojic, dokud sám neklikne na "Chci odejít".
// Karetní mechanika je sdílená v js/pexeso-core.js.

const TEST_PAIRS_COUNT = 7;

let errorsCount = 0;
let startTimeMs = 0;
let timerIntervalId = null;
let currentPairs = [];

function $(id) {
  return document.getElementById(id);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function startNewRound() {
  const ids = pickRandomIds(CARDS_DATA.map((c) => c.id), TEST_PAIRS_COUNT);
  currentPairs = idsToCards(ids, CARDS_DATA);
  $("info-text").textContent = `Vylosováno ${currentPairs.length} dvojic. Najdi ke každému pojmu jeho definici.`;
  showScreen("screen-info");
}

function beginRound() {
  errorsCount = 0;
  startTimeMs = performance.now();

  $("stat-errors").textContent = "0";
  $("stat-found").textContent = `0 / ${currentPairs.length}`;
  updateTimeDisplay();
  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(updateTimeDisplay, 250);

  createPexesoRound({
    gridEl: $("board-grid"),
    pairs: currentPairs,
    onStatsChange: ({ matchedCount, errorsCount: errs, total }) => {
      errorsCount = errs;
      $("stat-errors").textContent = String(errorsCount);
      $("stat-found").textContent = `${matchedCount} / ${total}`;
    },
    onComplete: ({ errorsCount: finalErrors }) => {
      errorsCount = finalErrors;
      onRoundComplete();
    },
  });

  showScreen("screen-game");
}

function updateTimeDisplay() {
  const elapsed = Math.floor((performance.now() - startTimeMs) / 1000);
  $("stat-time").textContent = `${elapsed} s`;
}

function onRoundComplete() {
  clearInterval(timerIntervalId);
  const elapsedS = (performance.now() - startTimeMs) / 1000;
  const score = Math.max(0, Math.round(1000 - elapsedS * 15 - errorsCount * 30));
  $("result-score").textContent = String(score);
  $("result-time").textContent = `${Math.round(elapsedS)} s`;
  $("result-errors").textContent = String(errorsCount);
  showScreen("screen-result");
  startConfettiOn($("confetti-canvas"), 3000, false);
}

function onLeaveMidGame() {
  const ok = confirm("Opravdu chceš odejít z testu?");
  if (!ok) return;
  clearInterval(timerIntervalId);
  showScreen("screen-left");
}

function init() {
  $("btn-start-round").addEventListener("click", beginRound);
  $("btn-leave-info").addEventListener("click", () => showScreen("screen-left"));
  $("btn-leave-game").addEventListener("click", onLeaveMidGame);
  $("btn-play-again").addEventListener("click", startNewRound);
  $("btn-quit").addEventListener("click", () => showScreen("screen-left"));
  window.addEventListener("resize", () => {
    const canvas = $("confetti-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  startNewRound();
}

document.addEventListener("DOMContentLoaded", init);
