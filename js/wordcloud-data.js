// Sdílená data pro "slovní mrak" (Firebase Realtime Database REST API - jen fetch(), žádný SDK).
// Stejný princip jako u pexesa (leaderboard.js): pokud FIREBASE_URL vypadá jako placeholder
// nebo síťové volání selže/vyprší, běží vše v "lokálním režimu" jen na tomto zařízení.
// Na rozdíl od pexesa si zdejší funkce sessionId nepamatují samy - dostávají ho jako parametr,
// aby plátno lektorky mohlo přepínat mezi víc session bez znovunačtení stránky.

const WC = (() => {
  let localMode = isPlaceholderUrl(FIREBASE_URL);
  let localModeReason = localMode ? "Živý slovní mrak není nastaven (Firebase URL chybí)." : "";
  const LOCAL_KEY = "wordcloud_local_tree";
  const MAX_WORDS_PER_DEVICE = 5;

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
      // localStorage nedostupné - tiše ignorujeme
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
      localModeReason = reason || "Spojení se slovním mrakem selhalo, pokračujeme lokálně.";
    }
  }

  async function dbGet(path) {
    if (localMode) return getAtPath(loadLocalTree(), path);
    try {
      return await fetchWithTimeout(remoteUrl(path), { method: "GET" });
    } catch (e) {
      switchToLocalFallback("Živý slovní mrak momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
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
      switchToLocalFallback("Živý slovní mrak momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
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

  // Tichá identita zařízení (bez přihlašování) - jen pro dodržení limitu 5 slov na "uživatele".
  function deviceId() {
    let id = localStorage.getItem("wc_device_id");
    if (!id) {
      id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try {
        localStorage.setItem("wc_device_id", id);
      } catch (e) {
        // beze změny - id zůstane jen pro tuto session prohlížeče
      }
    }
    return id;
  }

  function normalizeWord(raw) {
    return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  }

  async function getMyWords(sessionId) {
    const words = await dbGet(`wordclouds/${sessionId}/entries/${deviceId()}/words`);
    return Array.isArray(words) ? words : [];
  }

  async function touchSession(sessionId) {
    // Zapíše jednoduchý příznak existence session, aby ji lektorka viděla v seznamu
    // i dřív, než kdokoliv odpoví (jinak by se session objevila až s prvním slovem).
    return await dbPut(`wordclouds/${sessionId}/created`, true);
  }

  async function addWord(sessionId, rawWord) {
    const word = normalizeWord(rawWord);
    if (!word) return { ok: false, reason: "prazdne", words: await getMyWords(sessionId) };

    const current = await getMyWords(sessionId);
    if (current.length >= MAX_WORDS_PER_DEVICE) {
      return { ok: false, reason: "limit", words: current };
    }
    const updated = [...current, word];
    await dbPut(`wordclouds/${sessionId}/entries/${deviceId()}/words`, updated);
    await touchSession(sessionId);
    return { ok: true, words: updated };
  }

  async function removeWord(sessionId, index) {
    const current = await getMyWords(sessionId);
    const updated = current.filter((_, i) => i !== index);
    await dbPut(`wordclouds/${sessionId}/entries/${deviceId()}/words`, updated);
    return updated;
  }

  async function getAllEntries(sessionId) {
    const data = await dbGet(`wordclouds/${sessionId}/entries`);
    return data || {};
  }

  // Vrátí pole {word, count} seřazené sestupně dle četnosti (nejčastější slovo první).
  async function getWordCounts(sessionId) {
    const entries = await getAllEntries(sessionId);
    const counts = {};
    Object.values(entries).forEach((entry) => {
      const words = Array.isArray(entry && entry.words) ? entry.words : [];
      words.forEach((w) => {
        if (!w) return;
        counts[w] = (counts[w] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "cs"));
  }

  // Seznam ID session, které mají dnes nějaký záznam (i prázdný "created" příznak) - pro
  // seznam "záložek" na plátně lektorky, aby se dalo přepínat mezi víc běhy za den.
  async function listTodaySessions(dateStr) {
    async function fromKeys(keys) {
      return keys.filter((id) => id === dateStr || id.startsWith(dateStr + "-")).sort();
    }
    if (localMode) {
      const tree = loadLocalTree();
      const keys = (tree.wordclouds && Object.keys(tree.wordclouds)) || [];
      return fromKeys(keys);
    }
    try {
      const data = await fetchWithTimeout(remoteUrl("wordclouds"), { method: "GET" });
      const keys = data ? Object.keys(data) : [];
      return fromKeys(keys);
    } catch (e) {
      switchToLocalFallback("Živý slovní mrak momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      const tree = loadLocalTree();
      const keys = (tree.wordclouds && Object.keys(tree.wordclouds)) || [];
      return fromKeys(keys);
    }
  }

  // Smaže celou session (všechny odpovědi) - pro lektorku na plátně.
  async function deleteSession(sessionId) {
    if (localMode) {
      const tree = loadLocalTree();
      if (tree.wordclouds) {
        delete tree.wordclouds[sessionId];
        saveLocalTree(tree);
      }
      return;
    }
    try {
      await fetchWithTimeout(remoteUrl(`wordclouds/${sessionId}`), { method: "DELETE" });
    } catch (e) {
      switchToLocalFallback("Živý slovní mrak momentálně neodpovídá, pokračujeme lokálně na tomto zařízení.");
      const tree = loadLocalTree();
      if (tree.wordclouds) {
        delete tree.wordclouds[sessionId];
        saveLocalTree(tree);
      }
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
    deviceId,
    MAX_WORDS_PER_DEVICE,
    getMyWords,
    addWord,
    removeWord,
    getWordCounts,
    touchSession,
    deleteSession,
    listTodaySessions,
    watch,
  };
})();
