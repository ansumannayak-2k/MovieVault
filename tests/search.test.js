/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/dom';
import { mountIndexDOM } from './utils/dom.js';
import { SEARCH_OK, DETAILS_OK_TT0117060 } from './mocks/omdbResponses.js';

// Polyfill Response for jsdom
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Map(Object.entries(init.headers || {}));
      this._bodyText = typeof body === 'string' ? body : JSON.stringify(body);
    }
    async json() {
      return JSON.parse(this._bodyText);
    }
    async text() {
      return this._bodyText;
    }
    get ok() {
      return this.status >= 200 && this.status < 300;
    }
  };
}

function mockFetchForSearchAndDetails() {
  // Basic URL routing for the two OMDb endpoints your app calls
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('type=movie') && u.includes('&s=')) {
      // search endpoint
      return Promise.resolve(new Response(JSON.stringify(SEARCH_OK), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }
    if (u.includes('&i=tt0117060')) {
      // details endpoint
      return Promise.resolve(new Response(JSON.stringify(DETAILS_OK_TT0117060), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }
    // default: unknown route
    return Promise.resolve(new Response(JSON.stringify({ Response: "False", Error: "Not found" }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    }));
  });
}

beforeEach(() => {
  mountIndexDOM();
  mockFetchForSearchAndDetails();
});

test('search renders results and "Add to Watchlist" stores movie', async () => {
  await import('../script.js');

  // Type and submit
  const input = screen.getByPlaceholderText(/search movies/i);
  fireEvent.input(input, { target: { value: 'mission impossible' } });
  const form = document.getElementById('searchForm');
  fireEvent.submit(form);

  // Wait for results: simple polling since we didn't use async utilities
  await waitFor(() => {
    const grid = document.getElementById('results');
    expect(grid?.querySelectorAll('.movie-card').length).toBeGreaterThan(0);
  });

  // There should be at least one card with an "Add to Watchlist" button
  const grid = document.getElementById('results');
  const firstCard = grid.querySelector('.movie-card');
  const addBtn = firstCard.querySelector('.add-btn');
  expect(addBtn).toBeInTheDocument();
  expect(addBtn).toHaveTextContent(/add to watchlist/i);

  // Click "Add to Watchlist" — this triggers details fetch and storage
  fireEvent.click(addBtn);

  // Wait for async fetch and storage update
  await waitFor(() => {
    const mv = window.__MovieVault;
    const list = mv.readWatchlist();
    expect(list.length).toBe(1);
  });

  // Verify storage updated
  const mv = window.__MovieVault;
  const list = mv.readWatchlist();
  expect(list.length).toBe(1);
  expect(list[0].imdbID).toBe('tt0117060');
});

// tiny helper for polling in plain jest-dom
function waitFor(assertFn, { timeout = 2000, interval = 30 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function loop() {
      try {
        assertFn();
        return resolve();
      } catch (e) {
        if (Date.now() - start > timeout) return reject(e);
        setTimeout(loop, interval);
      }
    })();
  });
}
