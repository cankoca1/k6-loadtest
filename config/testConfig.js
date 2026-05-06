// -----------------------------------------------------------------------------
// Test Configuration
// -----------------------------------------------------------------------------
// Centralised, environment-agnostic configuration:
//   * Base URL of the system under test
//   * Browser-like default headers
//   * Threshold (SLA) budgets enforced by k6
//   * Helper to compute future ISO dates for self-healing tests
//
// Route data lives in `./routes.js` (one Route per entry) so that adding a
// new origin/destination pair never requires touching this file.
// -----------------------------------------------------------------------------

export const BASE_URL = 'https://www.enuygun.com';

/**
 * Returns a date in `YYYY-MM-DD` format, offset by the given number of days
 * from "today". Search dates always remain in the future, regardless of when
 * the script is executed.
 *
 * @param {number} [daysAhead=14]
 * @returns {string}
 */
export function futureDate(daysAhead = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// Realistic browser-like headers. Enuygun (like most travel sites) returns
// different content for non-browser clients, so spoofing a real UA gives a
// more representative load profile.
export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

// Performance / reliability budgets enforced by the test run. Any breach
// makes k6 exit with a non-zero status code — perfect for CI gating.
export const THRESHOLDS = {
  http_req_failed: ['rate<0.01'],            // <1% of requests may fail
  http_req_duration: ['p(95)<2000'],         // 95% of requests below 2s
  checks: ['rate>0.95'],                     // >95% of checks must pass
  flight_search_duration: ['p(95)<2000'],    // custom: search-only timing
  flight_search_errors: ['rate<0.05'],       // custom: search-only errors
};

// k6 scenario configuration for the single-VU baseline run.
export const SCENARIO_CONFIG = {
  flight_search_baseline: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    gracefulStop: '5s',
    tags: { scenario: 'flight_search' },
  },
};
