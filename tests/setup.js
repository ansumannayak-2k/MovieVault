// Jest global setup for DOM tests
import '@testing-library/jest-dom';

// Fail fast if a test forgets to mock fetch
global.fetch = (...args) => {
  throw new Error(
    `Unmocked fetch called in test with args: ${JSON.stringify(args)}`
  );
};

// jsdom already provides localStorage/sessionStorage, but add a clean slate per test
beforeEach(() => {
  localStorage.clear?.();
  sessionStorage.clear?.();
  // Ensure the document is clean before each test file runs events
  document.body.innerHTML = '';
});
