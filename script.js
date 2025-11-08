// ============================================
// MovieVault — Unified script.js (FINAL)
// - One-time SW/cache cleanup (prevents stale pages from other projects)
// - Robust spinner via request counter
// - Consistent watchlist storage & rendering
// - A11y (lazy images, fixed sizes), Perf (typeahead + session cache)
// ============================================

/* ---------- One-time Service Worker + cache cleanup ---------- */
(async () => {
  try {
    const FLAG = 'mv_sw_cleanup_done_v1';
    if (!localStorage.getItem(FLAG)) {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length) await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      localStorage.setItem(FLAG, '1');
    }
  } catch (e) {
    console.warn('SW cleanup skipped:', e);
  }
})();

/* ---------- API config ---------- */
const API_KEY = "a8d077ff"; // <-- your OMDb API key
// If you later add a Netlify Function proxy, just swap API_URL/DETAILS_URL to the function path.
const API_URL = `https://www.omdbapi.com/?apikey=${API_KEY}&type=movie&s=`;
const DETAILS_URL = `https://www.omdbapi.com/?apikey=${API_KEY}&i=`;

/* ---------- Keys ---------- */
const WATCHLIST_KEY = "movieWatchlist_v1";
const SEARCH_CACHE_KEY = "mv_last_search_json";

/* ---------- DOM ---------- */
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const message = document.getElementById("message");
const results = document.getElementById("results");
const spinner = document.getElementById("spinner");
const watchlistContainer = document.getElementById("watchlist");
const themeToggle = document.getElementById("themeToggle");
const apiKeyWarning = document.getElementById("apiKeyWarning");

/* ---------- Spinner with request counter ---------- */
let activeRequests = 0;
function spinnerStart() {
  activeRequests = Math.max(0, activeRequests) + 1;
  if (spinner) {
    spinner.hidden = false;
    spinner.setAttribute("aria-hidden", "false");
  }
}
function spinnerEnd() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (spinner && activeRequests <= 0) {
    spinner.hidden = true;
    spinner.setAttribute("aria-hidden", "true");
    activeRequests = 0;
  }
}
if (spinner) { spinner.hidden = true; spinner.setAttribute("aria-hidden", "true"); activeRequests = 0; }

/* ---------- Theme ---------- */
(function initTheme() {
  if (!themeToggle) return;
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
    themeToggle.setAttribute("aria-pressed", true);
  }
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    themeToggle.setAttribute("aria-pressed", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
})();

/* ---------- Utilities ---------- */
function showMessage(txt, isError = false) {
  if (!message) return;
  message.textContent = txt;
  message.style.color = isError ? "#b01" : "";
}
function clearMessage() {
  if (!message) return;
  message.textContent = "";
  message.style.color = "";
}
function isApiKeySet() {
  return API_KEY && API_KEY !== "YOUR_OMDB_API_KEY" && API_KEY.trim().length >= 6;
}
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function debounce(fn, ms = 500) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Watchlist storage helpers ---------- */
function readWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("readWatchlist() failed:", e);
    return [];
  }
}
function writeWatchlist(list) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("writeWatchlist() failed:", e);
    return false;
  }
}
function addToWatchlist(movieFull) {
  if (!movieFull || !movieFull.imdbID) {
    showMessage("Invalid movie data; cannot add.", true);
    return;
  }
  const list = readWatchlist();
  if (list.some((m) => m.imdbID === movieFull.imdbID)) {
    showMessage(`⚠️ "${movieFull.Title}" is already in your Watchlist.`);
    return;
  }
  const compact = {
    imdbID: movieFull.imdbID,
    Title: movieFull.Title || "Unknown title",
    Year: movieFull.Year || movieFull.Released || "—",
    Poster: movieFull.Poster || "N/A"
  };
  list.unshift(compact);
  if (writeWatchlist(list)) {
    showMessage(`✅ Added "${compact.Title}" to your Watchlist.`);
    if (watchlistContainer) renderWatchlist();
  } else {
    showMessage("Failed to save watchlist (storage error).", true);
  }
}
function removeFromWatchlist(imdbID) {
  if (!imdbID) return;
  const list = readWatchlist().filter((m) => m.imdbID !== imdbID);
  writeWatchlist(list);
  if (watchlistContainer) renderWatchlist();
  showMessage("🗑️ Removed from Watchlist.");
}
function clearWatchlist() {
  localStorage.removeItem(WATCHLIST_KEY);
  if (watchlistContainer) renderWatchlist();
  showMessage("All watchlist items cleared.");
}

/* Expose for tests/debugging */
window.__MovieVault = window.__MovieVault || {};
window.__MovieVault.readWatchlist = readWatchlist;
window.__MovieVault.writeWatchlist = writeWatchlist;
window.__MovieVault.WATCHLIST_KEY = WATCHLIST_KEY;

/* ---------- Fetch with timeout ---------- */
async function fetchWithTimeout(resource, { timeout = 8000 } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* ---------- Render search results ---------- */
function renderMovies(movies) {
  if (!results) return;
  if (!Array.isArray(movies) || movies.length === 0) {
    results.innerHTML = `<p class="placeholder">No results.</p>`;
    return;
  }
  results.innerHTML = movies
    .map((movie) => {
      const poster = movie.Poster && movie.Poster !== "N/A" ? movie.Poster : "./assets/placeholder.png";
      return `
      <div class="movie-card" role="listitem" tabindex="0">
        <img
          src="${poster}"
          alt="${escapeHtml(movie.Title)} poster"
          class="movie-poster"
          loading="lazy"
          decoding="async"
          width="300" height="450"
        />
        <div class="movie-info">
          <h3 class="movie-title">${escapeHtml(movie.Title)}</h3>
          <p class="movie-meta">${escapeHtml(movie.Year || "—")}</p>
          <button class="add-btn" data-id="${movie.imdbID}" aria-label="Add ${escapeHtml(movie.Title)} to Watchlist">➕ Add to Watchlist</button>
        </div>
      </div>`;
    })
    .join("");

  // wire add buttons
  results.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const imdbID = e.currentTarget.dataset.id;
      if (!imdbID) return;
      spinnerStart();
      try {
        const res = await fetchWithTimeout(DETAILS_URL + imdbID, { timeout: 7000 });
        if (!res.ok) {
          showMessage(`Network error: ${res.status} ${res.statusText}`, true);
          return;
        }
        const json = await res.json();
        if (json.Response === "False") {
          showMessage(`OMDb: ${json.Error || "Failed to fetch details"}`, true);
          return;
        }
        addToWatchlist(json);
      } catch (err) {
        console.error("details fetch error", err);
        if (err.name === "AbortError") showMessage("Request timed out. Try again.", true);
        else showMessage("Failed to fetch details. See console.", true);
      } finally {
        spinnerEnd();
      }
    });
  });
}

/* ---------- Render watchlist page ---------- */
function renderWatchlist() {
  if (!watchlistContainer) return;
  const list = readWatchlist();
  if (!list.length) {
    watchlistContainer.innerHTML = `<p class="placeholder">Your watchlist is empty 🍿</p>`;
    return;
  }

  // Render movie cards directly into the container (which already has results-grid class)
  watchlistContainer.innerHTML = list
    .map((m) => {
      const poster = m.Poster && m.Poster !== "N/A" ? m.Poster : "./assets/placeholder.png";
      return `
      <div class="movie-card" role="listitem" tabindex="0">
        <img
          src="${poster}"
          alt="${escapeHtml(m.Title)} poster"
          class="movie-poster"
          loading="lazy"
          decoding="async"
          width="300" height="450"
        />
        <div class="movie-info">
          <h3 class="movie-title">${escapeHtml(m.Title)}</h3>
          <p class="movie-meta">${escapeHtml(m.Year || "—")}</p>
          <button class="remove-btn" data-id="${m.imdbID}" aria-label="Remove ${escapeHtml(m.Title)} from Watchlist">❌ Remove</button>
        </div>
      </div>`;
    })
    .join("");

  // Add clear button after the movie grid
  const clearBtnContainer = document.createElement("div");
  clearBtnContainer.style.marginTop = "1rem";
  clearBtnContainer.style.textAlign = "center";
  const clearBtn = document.createElement("button");
  clearBtn.id = "clearWatchlistBtn";
  clearBtn.className = "favorite-btn";
  clearBtn.textContent = "Clear Watchlist";
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all watchlist items?")) return;
    clearWatchlist();
  });
  clearBtnContainer.appendChild(clearBtn);
  watchlistContainer.appendChild(clearBtnContainer);

  // Wire up remove buttons
  watchlistContainer.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      removeFromWatchlist(id);
    });
  });
}
window.renderWatchlist = renderWatchlist;

/* ---------- Search handler + session cache ---------- */
let lastSubmittedQuery = "";
async function performSearch(query) {
  spinnerStart();
  results && (results.innerHTML = "");
  showMessage("");

  try {
    const res = await fetchWithTimeout(API_URL + encodeURIComponent(query), { timeout: 8000 });
    if (!res.ok) {
      showMessage(`Network error: ${res.status} ${res.statusText}`, true);
      console.error("Network response not ok", res);
      return;
    }
    const json = await res.json();
    if (json.Response === "False") {
      const errMsg = json.Error || "No results";
      showMessage(`OMDb: ${errMsg}`, true);
      results && (results.innerHTML = `<p class="placeholder">${escapeHtml(errMsg)}</p>`);
      return;
    }
    // cache results for perf/back-forward
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ q: query, data: json.Search || [] }));
    showMessage(`Showing results for "${escapeHtml(query)}"`);
    renderMovies(json.Search || []);
  } catch (err) {
    console.error("Search error", err);
    if (err.name === "AbortError") showMessage("Request timed out. Try again.", true);
    else showMessage("Failed to load movies. See console.", true);
  } finally {
    spinnerEnd();
  }
}

if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage();

    if (!isApiKeySet()) {
      if (apiKeyWarning) apiKeyWarning.style.display = "block";
      showMessage("Put your OMDb API key in script.js (API_KEY).", true);
      return;
    } else {
      if (apiKeyWarning) apiKeyWarning.style.display = "none";
    }

    const query = (searchInput && searchInput.value || "").trim();
    if (!query) { showMessage("Please enter a movie name."); return; }
    if (!navigator.onLine) { showMessage("You're offline — check your connection.", true); return; }

    lastSubmittedQuery = query;
    performSearch(query);
  });

  // Optional: typeahead (debounced) — triggers only when 3+ chars and different from last submit
  const typeahead = debounce(() => {
    const q = (searchInput && searchInput.value || "").trim();
    if (q.length >= 3 && q !== lastSubmittedQuery) {
      lastSubmittedQuery = q;
      performSearch(q);
    }
  }, 500);
  searchInput && searchInput.addEventListener("input", typeahead);
}

/* ---------- Cross-tab sync ---------- */
window.addEventListener("storage", (e) => {
  if (e.key === WATCHLIST_KEY) {
    if (watchlistContainer) renderWatchlist();
  }
});

/* ---------- Init on load ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Warm UI with last cached search (optional)
  const cached = sessionStorage.getItem(SEARCH_CACHE_KEY);
  if (cached && results) {
    try {
      const { q, data } = JSON.parse(cached);
      if (Array.isArray(data) && data.length) {
        showMessage(`Showing cached results for "${escapeHtml(q)}"`);
        renderMovies(data);
      }
    } catch {}
  }

  if (watchlistContainer) renderWatchlist();

  if (results && !results.innerHTML.trim()) {
    results.innerHTML = `<p class="placeholder">Search for your favorite movies 🎥</p>`;
  }
  if (!isApiKeySet() && apiKeyWarning) apiKeyWarning.style.display = "block";
});
