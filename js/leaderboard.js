// Komunikace se sdíleným žebříčkem (Firebase Realtime Database REST API - jen fetch(), žádný SDK).
// Pokud FIREBASE_URL vypadá jako nevyplněný placeholder, nebo síťové volání selže/vyprší,
// hra automaticky přepne do "lokálního režimu" - žebříček se simuluje jen z localStorage
// tohoto zařízení, aby šla hra otestovat i bez zřízeného Firebase projektu.
//
// Na rozdíl od dřívější verze si funkce sessionId nepamatují samy - dostávají ho jako
// parametr, aby plátno lektorky mohlo přepínat mezi víc soutěžemi (i historickými)
// bez znovunačtení stránky.

const LB = (() => {
  let localMode = isPlaceholderUrl(FIREBASE_URL);
  let localModeReason = localMode ? "Živý žebříček není nastaven (Firebase URL chybí)." : "";
  const LOCAL_KEY = "pexeso_local_tree";

  function isPlaceholderUrl(url) {
    if (!url) return true;
    const u = url.trim().toLowerCase();
    if (u === "") return true;
    if (u.includes("nastavte_zde")) return true;
    if (!u.startsWith("http")) return true;
    return false;
  }

  function loadLocalTree() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLocalTree(tree) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(tree));
    } catch (e) {
      // localStorage nedostupné - tiše ignorujeme, hra pojede dál jen v paměti
    }
  }

  function getAtPath(tree, path) {
    const parts = path.split("/").filter(Boolean);
    let node = tree;
    for (const p of parts) {
      if (node == null) return null;
      node = node[p];
    }
    return node === undefined ? null : node;
  }

  function setAtPath(tree, path, value) {
    const parts = path.split("/").filter(Boolean);
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (node[p] == null || typeof node[p] !== "object") node[p] = {};
      node = node[p];
    }
    node[parts[parts.length - 1]] = value;
  }

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  function remoteUrl(path) {
    const base = FIREBASE_URL.trim().replace(/\/+$/, "");
    return `${base}/${path}.json`;
  }

  function switchToLocalFallback(reason) {
    if (!localMode) {
      localMode = true;
      localModeReason = reason || "Spojení se sdíleným žebříčkem selhalo, pokračujeme lokálně.";
    }
  }

  async function dbGet(path) {
    if (localMode) return getAtPath(loadLocalTree(), path);
    try {
      return await fetchWithTimeout(remoteUrl(path), { method: "GET" });
    } catch (e) {
      switchToLocalFallback("Živý žebříček momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      return getAtPath(loadLocalTree(), path);
    }
  }

  async function dbPut(path, value) {
    if (localMode) {
      const tree = loadLocalTree();
      setAtPath(tree, path, value);
      saveLocalTree(tree);
      return value;
    }
    try {
      return await fetchWithTimeout(remoteUrl(path), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
    } catch (e) {
      switchToLocalFallback("Živý žebříček momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      const tree = loadLocalTree();
      setAtPath(tree, path, value);
      saveLocalTree(tree);
      return value;
    }
  }

  function isLocal() {
    return localMode;
  }

  function getLocalReason() {
    return localModeReason;
  }

  // Zapíše jednoduchý příznak existence soutěže, aby ji lektorka viděla v historii
  // i dřív, než se do ní kdokoliv zapojí.
  async function touchSession(sessionId) {
    return await dbPut(`sessions/${sessionId}/created`, true);
  }

  async function getRoundPairs(sessionId, round) {
    return await dbGet(`sessions/${sessionId}/roundPairs/${round}`);
  }

  // Zapíše dvojice pro kolo, POKUD JEŠTĚ NEEXISTUJÍ (jednoduchá ochrana proti přepsání,
  // v lokálním režimu i na Firebase - není to atomické přes síť, ale pro školení v malé skupině stačí).
  async function setRoundPairsIfAbsent(sessionId, round, idsArray) {
    const existing = await getRoundPairs(sessionId, round);
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing;
    }
    await dbPut(`sessions/${sessionId}/roundPairs/${round}`, idsArray);
    const check = await getRoundPairs(sessionId, round);
    return check && check.length ? check : idsArray;
  }

  async function getFinishes(sessionId, round) {
    const data = await dbGet(`sessions/${sessionId}/rounds/${round}/finishes`);
    return data || {};
  }

  // Zapíše dokončení hráče a přepočítá pořadí VŠECH hráčů v kole podle skutečné rychlosti
  // řešení (trvani_s - jak dlouho hráči trvalo kolo dohrát), ne podle toho, kdy na hodinách
  // dokončil - hráči totiž nezačínají kolo ve stejnou chvíli, takže "kdo dřív na hodinách"
  // by zvýhodňovalo toho, kdo dřív začal, i kdyby byl ve skutečnosti pomalejší.
  // casMs (Date.now()) slouží jen jako tie-break při přesně shodném trvani_s.
  async function recordFinish(sessionId, round, playerName, casMs, pocetChyb, trvaniS) {
    const finishes = await getFinishes(sessionId, round);
    const key = encodeName(playerName);
    finishes[key] = { cas_dokonceni: casMs, pocet_chyb: pocetChyb, trvani_s: trvaniS };

    const ranked = Object.entries(finishes).sort((a, b) => {
      const diff = (a[1].trvani_s ?? Infinity) - (b[1].trvani_s ?? Infinity);
      if (diff !== 0) return diff;
      return (a[1].cas_dokonceni ?? Infinity) - (b[1].cas_dokonceni ?? Infinity);
    });
    ranked.forEach(([, rec], idx) => {
      rec.poradi_v_kole = idx + 1;
    });

    await dbPut(`sessions/${sessionId}/rounds/${round}/finishes`, finishes);
    return finishes[key].poradi_v_kole;
  }

  function encodeName(name) {
    // Firebase klíče nesmí obsahovat . # $ [ ] /
    return String(name).replace(/[.#$\[\]\/]/g, "_").slice(0, 60) || "hrac";
  }

  async function getPlayers(sessionId) {
    const data = await dbGet(`sessions/${sessionId}/players`);
    return data || {};
  }

  async function setPlayerStatus(sessionId, playerName, status, casOdchoduMs) {
    const payload = { jmeno: playerName, status: status };
    if (typeof casOdchoduMs === "number") payload.cas_odchodu = casOdchoduMs;
    return await dbPut(`sessions/${sessionId}/players/${encodeName(playerName)}`, payload);
  }

  // Spočítá celkové pořadí po 3 kolech soutěže: dokončení všech 3 kol > odchod (mezi odešlými
  // rozhoduje, kdo vydržel déle), poradí se řadí podle součtu bodů (pořadí v kolech), tie-break dle součtu časů.
  async function computeOverallStandings(sessionId) {
    const players = await getPlayers(sessionId);
    const roundFinishes = {};
    for (const r of [1, 2, 3]) {
      roundFinishes[r] = await getFinishes(sessionId, r);
    }
    const names = new Set();
    Object.keys(players).forEach((n) => names.add(n));
    for (const r of [1, 2, 3]) Object.keys(roundFinishes[r]).forEach((n) => names.add(n));

    const finished = [];
    const left = [];
    const inProgress = [];

    names.forEach((key) => {
      const playerInfo = players[key] || { jmeno: key };
      const displayName = playerInfo.jmeno || key;
      const f1 = roundFinishes[1][key];
      const f2 = roundFinishes[2][key];
      const f3 = roundFinishes[3][key];
      const didFinishAll = !!(f1 && f2 && f3);
      const status = playerInfo.status || "hraje";

      if (didFinishAll) {
        const body = f1.poradi_v_kole + f2.poradi_v_kole + f3.poradi_v_kole;
        const casSoucet = (f1.trvani_s || 0) + (f2.trvani_s || 0) + (f3.trvani_s || 0);
        finished.push({ jmeno: displayName, body, casSoucet });
      } else if (status === "odesel") {
        left.push({ jmeno: displayName, casOdchodu: playerInfo.cas_odchodu || 0 });
      } else {
        inProgress.push({ jmeno: displayName });
      }
    });

    finished.sort((a, b) => (a.body - b.body) || (a.casSoucet - b.casSoucet));
    // Kdo odešel později (vydržel déle), skončí lépe -> sestupně dle casOdchodu.
    left.sort((a, b) => b.casOdchodu - a.casOdchodu);

    const standings = [
      ...finished.map((p) => ({ ...p, stav: "dokoncil" })),
      ...left.map((p) => ({ ...p, stav: "odesel" })),
    ];
    standings.forEach((p, i) => (p.poradi = i + 1));
    return { standings, inProgress };
  }

  // Smaže celou soutěž (kola, výsledky, hráče) - pro lektorku na plátně.
  async function deleteSession(sessionId) {
    if (localMode) {
      const tree = loadLocalTree();
      if (tree.sessions) {
        delete tree.sessions[sessionId];
        saveLocalTree(tree);
      }
      return;
    }
    try {
      await fetchWithTimeout(remoteUrl(`sessions/${sessionId}`), { method: "DELETE" });
    } catch (e) {
      switchToLocalFallback("Živý žebříček momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      const tree = loadLocalTree();
      if (tree.sessions) {
        delete tree.sessions[sessionId];
        saveLocalTree(tree);
      }
    }
  }

  // Seznam ID soutěží, které mají dnes nějaký záznam (i prázdný "created" příznak) -
  // pro historii/záložky na plátně lektorky.
  async function listTodaySessions(dateStr) {
    function fromKeys(keys) {
      return keys.filter((id) => id === dateStr || id.startsWith(dateStr + "-")).sort();
    }
    if (localMode) {
      const tree = loadLocalTree();
      const keys = (tree.sessions && Object.keys(tree.sessions)) || [];
      return fromKeys(keys);
    }
    try {
      const data = await fetchWithTimeout(remoteUrl("sessions"), { method: "GET" });
      const keys = data ? Object.keys(data) : [];
      return fromKeys(keys);
    } catch (e) {
      switchToLocalFallback("Živý žebříček momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      const tree = loadLocalTree();
      const keys = (tree.sessions && Object.keys(tree.sessions)) || [];
      return fromKeys(keys);
    }
  }

  function watch(getterFn, callback, intervalMs) {
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const data = await getterFn();
        callback(data, null);
      } catch (e) {
        callback(null, e);
      }
      if (!stopped) setTimeout(tick, intervalMs || POLL_INTERVAL_MS);
    }
    tick();
    return () => {
      stopped = true;
    };
  }

  return {
    isLocal,
    getLocalReason,
    encodeName,
    touchSession,
    getRoundPairs,
    setRoundPairsIfAbsent,
    getFinishes,
    recordFinish,
    getPlayers,
    setPlayerStatus,
    computeOverallStandings,
    deleteSession,
    listTodaySessions,
    watch,
  };
})();
