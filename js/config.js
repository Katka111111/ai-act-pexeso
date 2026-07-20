// Nastavení Firebase Realtime Database.
// Dokud tu je placeholder, hra automaticky běží v "lokálním režimu" (viz leaderboard.js)
// - je tedy plně hratelná i bez založeného Firebase účtu.
const FIREBASE_URL = "NASTAVTE_ZDE";

// Jak často (v milisekundách) se dotazujeme Firebase na nové výsledky (žebříček, board.html).
const POLL_INTERVAL_MS = 2000;

// Timeout pro každé síťové volání na Firebase (v milisekundách).
const FETCH_TIMEOUT_MS = 3000;

// ID dnešní "session" - podle data. Různé dny školení = jiná session = nové losování z celé banky 60 dvojic.
function getSessionId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
