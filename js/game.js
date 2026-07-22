// Herní logika pro SOUTĚŽ (živá vícekolová hra s žebříčkem). Samostatný nekonečný
// test běží odděleně v test.html + js/test-game.js. Karetní mechanika je sdílená
// v js/pexeso-core.js.

const ROUND_SIZES = { 1: 3, 2: 5, 3: 7 };

let playerName = "";
let sessionId = "";
let currentRound = 0;
let currentPairs = [];
let errorsCount = 0;
let startTimeMs = 0;
let timerIntervalId = null;

function $(id) {
  return document.getElementById(id);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

// ---------- Vstup hráče - rovnou začíná kolo 1, žádné čekání na lektorku ----------

function onJoin() {
  const val = $("nickname-input").value.trim();
  if (!val) {
    $("nickname-input").focus();
    return;
  }
  playerName = val;
  sessionId = getSessionId();
  LB.setPlayerStatus(sessionId, playerName, "hraje");
  currentRound = 1;
  startRoundSetup(currentRound);
}

// ---------- Příprava kola ----------

async function startRoundSetup(round) {
  const size = ROUND_SIZES[round];
  $("info-badge").textContent = `Kolo ${round} z 3`;
  $("info-title").textContent = "Připrav se";
  $("info-text").textContent = `Načítám dvojice pro kolo ${round}…`;
  if (LB.isLocal()) {
    $("info-local-note").style.display = "block";
    $("info-local-note").textContent = LB.getLocalReason();
  }
  showScreen("screen-info");

  const ids = await getOrCreateRoundIds(round, size);
  currentPairs = idsToCards(ids, CARDS_DATA);
  $("info-text").textContent = `Toto kolo má ${currentPairs.length} dvojic. Čím dřív a přesněji je najdeš, tím lepší umístění získáš.`;
}

async function getOrCreateRoundIds(round, size) {
  const existing = await LB.getRoundPairs(sessionId, round);
  if (existing && Array.isArray(existing) && existing.length > 0) return existing;

  let used = [];
  for (let r = 1; r < round; r++) {
    const prev = await LB.getRoundPairs(sessionId, r);
    if (prev && Array.isArray(prev)) used = used.concat(prev);
  }
  const available = CARDS_DATA.map((c) => c.id).filter((id) => !used.includes(id));
  const chosen = pickRandomIds(available, Math.min(size, available.length));
  return await LB.setRoundPairsIfAbsent(sessionId, round, chosen);
}

// ---------- Spuštění kola ----------

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

async function onRoundComplete() {
  clearInterval(timerIntervalId);
  const elapsedS = (performance.now() - startTimeMs) / 1000;

  const poradi = await LB.recordFinish(sessionId, currentRound, playerName, Date.now(), errorsCount, Math.round(elapsedS));
  $("round-result-badge").textContent = `Kolo ${currentRound} dokončeno`;
  $("round-result-rank").textContent = `Jsi ${poradi}. ze skupiny`;
  $("round-result-time").textContent = `${Math.round(elapsedS)} s`;
  $("round-result-errors").textContent = String(errorsCount);
  showScreen("screen-round-result");
  startConfettiOn($("confetti-canvas"), 2500, false);
}

async function onNextRound() {
  if (currentRound < 3) {
    currentRound++;
    await startRoundSetup(currentRound);
  } else {
    showScreen("screen-final-wait");
    startConfettiOn($("confetti-canvas"), 4500, true);
  }
}

// ---------- Opuštění hry ----------

function onLeave() {
  const ok = confirm("Opravdu chceš opustit hru? Tvůj odchod se zaznamená.");
  if (!ok) return;
  clearInterval(timerIntervalId);
  LB.setPlayerStatus(sessionId, playerName || "neznamy_hrac", "odesel", Date.now());
  showScreen("screen-left");
}

// ---------- Inicializace ----------

function init() {
  $("btn-join").addEventListener("click", onJoin);
  $("nickname-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onJoin();
  });
  $("btn-start-round").addEventListener("click", beginRound);
  $("btn-next-round").addEventListener("click", onNextRound);
  $("btn-leave-info").addEventListener("click", onLeave);
  $("btn-leave-game").addEventListener("click", onLeave);
  $("btn-restart-2").addEventListener("click", () => location.reload());
  window.addEventListener("resize", () => {
    const canvas = $("confetti-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

document.addEventListener("DOMContentLoaded", init);
