// Komunikace se sdíleným žebříčkem (Firebase Realtime Database REST API - jen fetch(), žádný SDK).
// Pokud FIREBASE_URL vypadá jako nevyplněný placeholder, nebo síťové volání selže/vyprší,
// hra automaticky přepne do "lokálního režimu" - žebříček se simuluje jen z localStorage
// tohoto zařízení, aby šla hra otestovat i bez zřízeného Firebase projektu.

const LB = (() => {
  let sessionId = getSessionId();
  let localMode = isPlaceholderUrl(FIREBASE_URL);
  let localModeReason = localMode ? "Živý žebříček není nastaven (Firebase URL chybí)." : "";

  function isPlaceholderUrl(url) {
    if (!url) return true;
    const u = url.trim().toLowerCase();
    if (u === "") return true;
    if (u.includes("nastavte_zde")) return true;
    if (!u.startsWith("http")) return true;
    return false;
  }

  function localKey() {
    return `pexeso_local_${sessionId}`;
  }

  function loadLocalTree() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLocalTree(tree) {
    try {
      localStorage.setItem(localKey(), JSON.stringify(tree));
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
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  function remoteUrl(path) {
    const base = FIREBASE_URL.trim().replace(/\/+$/, "");
    return `${base}/${path}.json`;
  }

  async function remoteGet(path) {
    const res = await fetchWithTimeout(remoteUrl(path), { method: "GET" });
    return await res.json();
  }

  async function remotePut(path, value) {
    const res = await fetchWithTimeout(remoteUrl(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return await res.json();
  }

  function switchToLocalFallback(reason) {
    if (!localMode) {
      localMode = true;
      localModeReason = reason || "Spojení se sdíleným žebříčkem selhalo, pokračujeme lokálně.";
    }
  }

  async function dbGet(path) {
    if (localMode) {
      return getAtPath(loadLocalTree(), path);
    }
    try {
      return await remoteGet(path);
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
      return await remotePut(path, value);
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

  function getSession() {
    return sessionId;
  }

  async function getMode() {
    return await dbGet(`sessions/${sessionId}/mode`);
  }

  async function setMode(mode) {
    return await dbPut(`sessions/${sessionId}/mode`, mode);
  }

  async function getRoundPairs(round) {
    return await dbGet(`sessions/${sessionId}/roundPairs/${round}`);
  }

  async function getAllRoundPairs() {
    return await dbGet(`sessions/${sessionId}/roundPairs`);
  }

  // Zapíše dvojice pro kolo, POKUD JEŠTĚ NEEXISTUJÍ (jednoduchá ochrana proti přepsání,
  // v lokálním režimu i na Firebase - není to atomické přes síť, ale pro školení v malé skupině stačí).
  async function setRoundPairsIfAbsent(round, idsArray) {
    const existing = await getRoundPairs(round);
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing;
    }
    await dbPut(`sessions/${sessionId}/roundPairs/${round}`, idsArray);
    const check = await getRoundPairs(round);
    return check && check.length ? check : idsArray;
  }

  async function getFinishes(round) {
    const data = await dbGet(`sessions/${sessionId}/rounds/${round}/finishes`);
    return data || {};
  }

  // Zapíše dokončení hráče a spočítá jeho pořadí v kole (kolik hráčů dokončilo dřív + 1).
  // casMs = čas dokončení (Date.now(), srovnatelný napříč zařízeními), trvaniS = doba hraní v sekundách (pro tie-break).
  async function recordFinish(round, playerName, casMs, pocetChyb, trvaniS) {
    const finishes = await getFinishes(round);
    let earlier = 0;
    for (const name in finishes) {
      if (name === playerName) continue;
      const f = finishes[name];
      if (f && typeof f.cas_dokonceni === "number" && f.cas_dokonceni < casMs) earlier++;
    }
    const poradi = earlier + 1;
    const record = { cas_dokonceni: casMs, pocet_chyb: pocetChyb, poradi_v_kole: poradi, trvani_s: trvaniS };
    await dbPut(`sessions/${sessionId}/rounds/${round}/finishes/${encodeName(playerName)}`, record);
    // Po zápisu znovu spočítáme finální pořadí (mohli mezitím dokončit i jiní se stejným nebo dřívějším časem)
    const fresh = await getFinishes(round);
    let finalEarlier = 0;
    for (const name in fresh) {
      if (name === encodeName(playerName)) continue;
      const f = fresh[name];
      if (f && typeof f.cas_dokonceni === "number" && f.cas_dokonceni < casMs) finalEarlier++;
    }
    return finalEarlier + 1;
  }

  function encodeName(name) {
    // Firebase klíče nesmí obsahovat . # $ [ ] /
    return String(name).replace(/[.#$\[\]\/]/g, "_").slice(0, 60) || "hrac";
  }

  async function getPlayers() {
    const data = await dbGet(`sessions/${sessionId}/players`);
    return data || {};
  }

  async function setPlayerStatus(playerName, status, casOdchoduMs) {
    const payload = { jmeno: playerName, status: status };
    if (typeof casOdchoduMs === "number") payload.cas_odchodu = casOdchoduMs;
    return await dbPut(`sessions/${sessionId}/players/${encodeName(playerName)}`, payload);
  }

  // Spočítá celkové pořadí po 3 kolech soutěže: dokončení všech 3 kol > odchod (mezi odešlými
  // rozhoduje, kdo vydržel déle), poradí se řadí podle součtu bodů (pořadí v kolech), tie-break dle součtu časů.
  async function computeOverallStandings() {
    const players = await getPlayers();
    const roundFinishes = {};
    for (const r of [1, 2, 3]) {
      roundFinishes[r] = await getFinishes(r);
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
    getSession,
    encodeName,
    getMode,
    setMode,
    getRoundPairs,
    getAllRoundPairs,
    setRoundPairsIfAbsent,
    getFinishes,
    recordFinish,
    getPlayers,
    setPlayerStatus,
    computeOverallStandings,
    watch,
  };
})();
