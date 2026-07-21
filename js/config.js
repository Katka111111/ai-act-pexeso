// Nastavení Firebase Realtime Database.
// Dokud tu je placeholder, hra automaticky běží v "lokálním režimu" (viz leaderboard.js)
// - je tedy plně hratelná i bez založeného Firebase účtu.
const FIREBASE_URL = "https://ai-act-pexeso-default-rtdb.firebaseio.com/";

// Jak často (v milisekundách) se dotazujeme Firebase na nové výsledky (žebříček, board.html).
const POLL_INTERVAL_MS = 2000;

// Timeout pro každé síťové volání na Firebase (v milisekundách).
const FETCH_TIMEOUT_MS = 3000;

// ID "session" - podle data, volitelně doplněné o vlastní označení z adresy
// (?s=nazev), aby šlo mít i víc běhů (session) za jeden den. Různé session =
// jiné losování z celé banky 60 dvojic a oddělený žebříček.
// Odkaz/QR pro hráče a plátno lektorky musí mít STEJNÝ parametr ?s=..., jinak
// se nepotkají ve stejné session - o to se stará board.html automaticky.
function getDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getSessionId() {
  const dateStr = getDateStr();
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("s") || "").trim().toLowerCase();
  const suffix = raw.replace(/[^a-z0-9-]/g, "").slice(0, 30);

  return suffix ? `${dateStr}-${suffix}` : dateStr;
}
