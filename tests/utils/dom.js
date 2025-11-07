/**
 * Minimal DOM mounts that match the IDs your script.js expects.
 */

export function mountIndexDOM() {
    document.body.innerHTML = `
      <main class="container">
        <section class="search-section" aria-label="Search movies">
          <form id="searchForm" autocomplete="off" novalidate>
            <input id="searchInput" type="search" placeholder="Search movies…" required />
            <button type="submit" class="search-btn">Search</button>
          </form>
          <div id="apiKeyWarning" style="display:none;"></div>
        </section>
  
        <section aria-label="Search results">
          <div id="message" role="status" class="message" aria-live="polite"></div>
          <div id="spinner" class="spinner" hidden aria-hidden="true">
            <div class="dot1"></div><div class="dot2"></div><div class="dot3"></div>
          </div>
          <div id="results" class="movie-grid" role="list" aria-live="polite"></div>
        </section>
      </main>
  
      <button id="themeToggle" style="display:none;">🌙</button>
    `;
  }
  
  export function mountWatchlistDOM() {
    document.body.innerHTML = `
      <main class="container">
        <section class="results-section" aria-label="Saved movies">
          <div id="watchlist" class="movie-grid" role="list" aria-live="polite"></div>
        </section>
      </main>
  
      <div id="message"></div>
      <div id="spinner" hidden></div>
      <button id="themeToggle" style="display:none;">🌙</button>
    `;
  }
  