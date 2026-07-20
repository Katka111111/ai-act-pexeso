// Herní mechanika: obrazovky, párování karet, stopky, napojení na SOUTĚŽ/TEST režim a konfety.

const ROUND_SIZES = { 1: 8, 2: 10, 3: 12 };

let playerName = "";
let mode = null;
let currentRound = 0;
let currentPairs = [];
let matchedCount = 0;
let errorsCount = 0;
let startTimeMs = 0;
let timerIntervalId = null;
let stopModeWatcher = null;

function $(id) {
  return document.getElementById(id);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

function idsToCards(ids) {
  return ids.map((id) => CARDS_DATA.find((c) => c.id === id)).filter(Boolean);
}

// ---------- Vstup hráče a čekání na režim ----------

function onJoin() {
  const val = $("nickname-input").value.trim();
  if (!val) {
    $("nickname-input").focus();
    return;
  }
  playerName = val;
  showScreen("screen-waiting");
  if (LB.isLocal()) {
    $("local-mode-note-waiting").style.display = "block";
    $("local-mode-note-waiting").textContent = LB.getLocalReason();
  }
  stopModeWatcher = LB.watch(
    () => LB.getMode(),
    (m, err) => {
      if (err) return;
      if (m === "test" || m === "soutez") {
        if (stopModeWatcher) stopModeWatcher();
        mode = m;
        LB.setPlayerStatus(playerName, "hraje");
        beginFlow();
      }
    },
    1500
  );
}

function beginFlow() {
  if (mode === "test") {
    startTestSetup();
  } else {
    currentRound = 1;
    startSoutezSetup(currentRound);
  }
}

// ---------- Režim TEST ----------

function startTestSetup() {
  const ids = pickRandom(CARDS_DATA.map((c) => c.id), 8);
  currentPairs = idsToCards(ids);
  $("info-badge").textContent = "Test";
  $("info-title").textContent = "Individuální procvičení";
  $("info-text").textContent = `Vylosováno ${currentPairs.length} dvojic. Najdi ke každému pojmu jeho definici. Výsledek je jen tvůj – nikam se nezapisuje.`;
  showScreen("screen-info");
}

// ---------- Režim SOUTĚŽ ----------

async function startSoutezSetup(round) {
  const size = ROUND_SIZES[round];
  $("info-badge").textContent = `Kolo ${round} z 3`;
  $("info-title").textContent = "Připrav se";
  $("info-text").textContent = `Načítám dvojice pro kolo ${round}…`;
  showScreen("screen-info");

  const ids = await getOrCreateRoundIds(round, size);
  currentPairs = idsToCards(ids);
  $("info-text").textContent = `Toto kolo má ${currentPairs.length} dvojic. Čím dřív a přesněji je najdeš, tím lepší umístění získáš.`;
}

async function getOrCreateRoundIds(round, size) {
  const existing = await LB.getRoundPairs(round);
  if (existing && Array.isArray(existing) && existing.length > 0) return existing;

  let used = [];
  for (let r = 1; r < round; r++) {
    const prev = await LB.getRoundPairs(r);
    if (prev && Array.isArray(prev)) used = used.concat(prev);
  }
  const available = CARDS_DATA.map((c) => c.id).filter((id) => !used.includes(id));
  const chosen = pickRandom(available, Math.min(size, available.length));
  return await LB.setRoundPairsIfAbsent(round, chosen);
}

// ---------- Spuštění kola/testu ----------

function beginRound() {
  matchedCount = 0;
  errorsCount = 0;
  startTimeMs = performance.now();

  $("stat-errors").textContent = "0";
  $("stat-found").textContent = `0 / ${currentPairs.length}`;
  updateTimeDisplay();
  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(updateTimeDisplay, 250);

  renderBoard();
  showScreen("screen-game");
}

function updateTimeDisplay() {
  const elapsed = Math.floor((performance.now() - startTimeMs) / 1000);
  $("stat-time").textContent = `${elapsed} s`;
}

function renderBoard() {
  const grid = $("board-grid");
  grid.innerHTML = "";

  const cells = [];
  currentPairs.forEach((pair) => {
    cells.push({ cardId: pair.id, type: "term", text: pair.term });
    cells.push({ cardId: pair.id, type: "definition", text: pair.definition });
  });
  const shuffled = shuffle(cells);

  shuffled.forEach((cell) => {
    const el = document.createElement("div");
    el.className = `pexeso-card ${cell.type}`;
    el.dataset.cardId = cell.cardId;
    el.dataset.type = cell.type;
    el.innerHTML = `
      <div class="face back"></div>
      <div class="face front">${escapeHtml(cell.text)}</div>
    `;
    el.addEventListener("click", () => onCardClick(el));
    grid.appendChild(el);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Karty se otáčejí ručně (žádné automatické otočení zpět po čekání), ale
// najednou smí být lícem nahoru NEJVÝŠ dvě nespárované karty - dokud hráč
// aspoň jednu z nich sám neotočí zpět rubem nahoru, další kartu otočit nejde.
// Chyba se počítá jen tehdy, když stejnou kartičku hráč odkrývá už podruhé
// (a stále nenajde dvojici) - první podívání na kartu je vždy zdarma.
// Spárované dvojice po krátké animaci úplně zmizí z hrací plochy.
function onCardClick(el) {
  if (el.classList.contains("matched")) return;

  if (el.classList.contains("flipped")) {
    el.classList.remove("flipped");
    return;
  }

  const faceUpCount = document.querySelectorAll(".pexeso-card.flipped:not(.matched)").length;
  if (faceUpCount >= 2) {
    el.classList.add("blocked-shake");
    el.addEventListener("animationend", () => el.classList.remove("blocked-shake"), { once: true });
    return;
  }

  el.classList.add("flipped");
  const flipCount = parseInt(el.dataset.flipCount || "0", 10) + 1;
  el.dataset.flipCount = String(flipCount);

  const cardId = el.dataset.cardId;
  const partner = Array.from(document.querySelectorAll(".pexeso-card.flipped:not(.matched)")).find(
    (other) => other !== el && other.dataset.cardId === cardId
  );

  if (partner) {
    el.classList.remove("mismatch");
    partner.classList.remove("mismatch");
    el.classList.add("matched");
    partner.classList.add("matched");
    [el, partner].forEach((card) => {
      card.addEventListener("animationend", () => card.remove(), { once: true });
    });
    matchedCount++;
    $("stat-found").textContent = `${matchedCount} / ${currentPairs.length}`;
    if (matchedCount === currentPairs.length) {
      onRoundComplete();
    }
  } else if (flipCount > 1) {
    errorsCount++;
    $("stat-errors").textContent = String(errorsCount);
    el.classList.add("mismatch");
    el.addEventListener("animationend", () => el.classList.remove("mismatch"), { once: true });
  }
}

async function onRoundComplete() {
  clearInterval(timerIntervalId);
  const elapsedS = (performance.now() - startTimeMs) / 1000;

  if (mode === "test") {
    const score = Math.max(0, Math.round(1000 - elapsedS * 15 - errorsCount * 30));
    $("test-result-score").textContent = String(score);
    $("test-result-time").textContent = `${Math.round(elapsedS)} s`;
    $("test-result-errors").textContent = String(errorsCount);
    showScreen("screen-test-result");
    startConfetti(3000, false);
    return;
  }

  const poradi = await LB.recordFinish(currentRound, playerName, Date.now(), errorsCount, Math.round(elapsedS));
  $("round-result-badge").textContent = `Kolo ${currentRound} dokončeno`;
  $("round-result-rank").textContent = `Jsi ${poradi}. ze skupiny`;
  $("round-result-time").textContent = `${Math.round(elapsedS)} s`;
  $("round-result-errors").textContent = String(errorsCount);
  showScreen("screen-round-result");
  startConfetti(2500, false);
}

async function onNextRound() {
  if (currentRound < 3) {
    currentRound++;
    await startSoutezSetup(currentRound);
  } else {
    showScreen("screen-final-wait");
    startConfetti(4500, true);
  }
}

// ---------- Opuštění hry ----------

function onLeave() {
  const ok = confirm("Opravdu chceš opustit hru? Tvůj odchod se zaznamená.");
  if (!ok) return;
  clearInterval(timerIntervalId);
  if (stopModeWatcher) stopModeWatcher();
  LB.setPlayerStatus(playerName || "neznamy_hrac", "odesel", Date.now());
  showScreen("screen-left");
}

// ---------- Konfety (vanilla JS, canvas, žádná knihovna) ----------

let confettiRAF = null;

function startConfetti(durationMs, big) {
  const canvas = $("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#702082", "#ED8B00", "#9451a8", "#ffb347", "#63c98a", "#ffffff"];
  const count = big ? 220 : 120;
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * 360,
      vrot: -6 + Math.random() * 12,
      shape: Math.random() > 0.5 ? "square" : "circle",
    });
  }

  const start = performance.now();
  if (confettiRAF) cancelAnimationFrame(confettiRAF);

  function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = now - start;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === "square") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    if (elapsed < durationMs) {
      confettiRAF = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  confettiRAF = requestAnimationFrame(frame);
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
  $("btn-restart").addEventListener("click", () => location.reload());
  $("btn-restart-2").addEventListener("click", () => location.reload());
  window.addEventListener("resize", () => {
    const canvas = $("confetti-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

document.addEventListener("DOMContentLoaded", init);
