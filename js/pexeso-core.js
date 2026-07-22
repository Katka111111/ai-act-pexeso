// Sdílená herní mechanika párování karet - používá jak soutěžní mód (game.js + index.html/board.html),
// tak samostatný nekonečný test (test.html). Beze změny napříč oběma: max 2 otočené nespárované karty
// najednou, chyba se počítá až od druhého otočení téže kartičky, spárované dvojice po animaci jen
// zneviditelní (visibility:hidden) - zůstávají na svém místě v mřížce, aby se ostatní karty neposouvaly.

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomIds(allIds, n) {
  return shuffleArr(allIds).slice(0, n);
}

function idsToCards(ids, cardsData) {
  return ids.map((id) => cardsData.find((c) => c.id === id)).filter(Boolean);
}

function escapeHtmlCore(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Vykreslí kolo do daného gridu a napojí herní logiku. Vrací funkce pro řízení zvenčí.
// opts: { gridEl, pairs, onStatsChange({matchedCount, errorsCount, total}), onComplete({errorsCount}) }
function createPexesoRound(opts) {
  const { gridEl, pairs, onStatsChange, onComplete } = opts;
  let matchedCount = 0;
  let errorsCount = 0;

  gridEl.innerHTML = "";
  const cells = [];
  pairs.forEach((pair) => {
    cells.push({ cardId: pair.id, type: "term", text: pair.term });
    cells.push({ cardId: pair.id, type: "definition", text: pair.definition });
  });
  const shuffled = shuffleArr(cells);

  shuffled.forEach((cell) => {
    const el = document.createElement("div");
    el.className = `pexeso-card ${cell.type}`;
    el.dataset.cardId = cell.cardId;
    el.dataset.type = cell.type;
    el.innerHTML = `
      <div class="face back"></div>
      <div class="face front">${escapeHtmlCore(cell.text)}</div>
    `;
    el.addEventListener("click", () => onCardClick(el));
    gridEl.appendChild(el);
  });

  function onCardClick(el) {
    if (el.classList.contains("matched")) return;

    if (el.classList.contains("flipped")) {
      el.classList.remove("flipped");
      return;
    }

    const faceUpCount = gridEl.querySelectorAll(".pexeso-card.flipped:not(.matched)").length;
    if (faceUpCount >= 2) {
      el.classList.add("blocked-shake");
      el.addEventListener("animationend", () => el.classList.remove("blocked-shake"), { once: true });
      return;
    }

    el.classList.add("flipped");
    const flipCount = parseInt(el.dataset.flipCount || "0", 10) + 1;
    el.dataset.flipCount = String(flipCount);

    const cardId = el.dataset.cardId;
    const partner = Array.from(gridEl.querySelectorAll(".pexeso-card.flipped:not(.matched)")).find(
      (other) => other !== el && other.dataset.cardId === cardId
    );

    if (partner) {
      el.classList.remove("mismatch");
      partner.classList.remove("mismatch");
      el.classList.add("matched");
      partner.classList.add("matched");
      matchedCount++;
      if (onStatsChange) onStatsChange({ matchedCount, errorsCount, total: pairs.length });
      if (matchedCount === pairs.length) {
        onComplete({ errorsCount });
      }
    } else if (flipCount > 1) {
      errorsCount++;
      if (onStatsChange) onStatsChange({ matchedCount, errorsCount, total: pairs.length });
      el.classList.add("mismatch");
      el.addEventListener("animationend", () => el.classList.remove("mismatch"), { once: true });
    }
  }
}

// Konfety (vanilla JS, canvas, žádná knihovna) - vykreslí do libovolného <canvas>.
function startConfettiOn(canvas, durationMs, big) {
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
  let raf = null;

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
      raf = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  raf = requestAnimationFrame(frame);
}
