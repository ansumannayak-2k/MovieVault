/**
 * @jest-environment jsdom
 */
import { mountWatchlistDOM } from './utils/dom.js';

beforeEach(() => {
  mountWatchlistDOM();
});

// Import after DOM is ready so script.js can find elements
test('watchlist add/remove via storage helpers & renderWatchlist()', async () => {
  // Import your app (ESM). It attaches helpers to window.__MovieVault and renderWatchlist to window.
  await import('../script.js');

  const { readWatchlist, writeWatchlist } = window.__MovieVault;
  expect(readWatchlist()).toEqual([]);

  // Add an item directly to storage (compact object shape used in app)
  const movie = {
    imdbID: 'tt0117060',
    Title: 'Mission: Impossible',
    Year: '1996',
    Poster: 'N/A'
  };
  writeWatchlist([movie]);

  // Render and assert DOM reflects one card
  window.renderWatchlist();
  const cards = document.querySelectorAll('.movie-card');
  expect(cards.length).toBe(1);
  expect(document.body).toHaveTextContent('Mission: Impossible');

  // Remove by writing an empty list
  writeWatchlist([]);
  window.renderWatchlist();
  expect(document.querySelectorAll('.movie-card').length).toBe(0);
  expect(document.body).toHaveTextContent('Your watchlist is empty');
});
