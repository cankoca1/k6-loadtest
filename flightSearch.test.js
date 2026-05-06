// -----------------------------------------------------------------------------
// Enuygun Flight Search — k6 Load Test (entry point)
// -----------------------------------------------------------------------------
// Thin wiring layer: it builds the object graph and hands control to the
// scenario class. All real logic lives under `src/`:
//
//   models/       - Route, FlightSearchRequest        (value objects)
//   clients/      - FlightSearchClient                (HTTP transport)
//   validators/   - FlightSearchValidator             (response checks)
//   metrics/      - SearchMetrics                     (custom k6 metrics)
//   loggers/      - FailureLogger                     (structured stderr)
//   scenarios/    - FlightSearchScenario              (orchestration)
//
// k6 hooks exported from this file:
//   - options          : scenarios + thresholds
//   - default function : per-iteration entry point
//   - handleSummary    : custom end-of-test report writer
//
// Run:  k6 run flightSearch.test.js
// -----------------------------------------------------------------------------

import {
  BASE_URL,
  DEFAULT_HEADERS,
  THRESHOLDS,
  SCENARIO_CONFIG,
  futureDate,
} from './config/testConfig.js';
import { ROUTES } from './config/routes.js';

import { FlightSearchClient } from './src/clients/FlightSearchClient.js';
import { FlightSearchValidator } from './src/validators/FlightSearchValidator.js';
import { SearchMetrics } from './src/metrics/SearchMetrics.js';
import { FailureLogger } from './src/loggers/FailureLogger.js';
import { FlightSearchScenario } from './src/scenarios/FlightSearchScenario.js';
import { FlightSearchRequest } from './src/models/FlightSearchRequest.js';

import { renderSummary } from './lib/summary.js';
import { generateHtmlReport } from './lib/htmlReport.js';

// -----------------------------------------------------------------------------
// k6 options
// -----------------------------------------------------------------------------
export const options = {
  scenarios: SCENARIO_CONFIG,
  thresholds: THRESHOLDS,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { project: 'enuygun-qa-portfolio' },
};

// -----------------------------------------------------------------------------
// Object graph (init phase — runs once per VU)
// -----------------------------------------------------------------------------
// Custom metrics MUST be created during the init phase, not inside the default
// function. Building the rest of the graph here too keeps construction
// centralised and makes the dependencies explicit.
const client = new FlightSearchClient({
  baseUrl: BASE_URL,
  defaultHeaders: DEFAULT_HEADERS,
  timeout: '30s',
  maxRedirects: 5,
});

const validator = new FlightSearchValidator({
  maxResponseTimeMs: 2000,
  expectedKeywords: ['istanbul', 'ankara'],
});

const metrics = new SearchMetrics();
const logger = new FailureLogger({ prefix: '[FAIL]' });

const scenario = new FlightSearchScenario(
  { client, validator, metrics, logger },
  { groupName: 'Flight Search', thinkTimeSeconds: 1 },
);

// -----------------------------------------------------------------------------
// Default function — runs once per VU iteration
// -----------------------------------------------------------------------------
export default function () {
  const request = new FlightSearchRequest({
    route: ROUTES.istanbulToAnkara,
    departureDate: futureDate(14),
    passengerCount: 1,
    cabin: 'ekonomi',
  });

  scenario.execute(request);
}

// -----------------------------------------------------------------------------
// handleSummary — writes timestamped artifacts to reports/ after each run
// -----------------------------------------------------------------------------
export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    stdout: renderSummary(data),
    [`reports/summary-${ts}.json`]: JSON.stringify(data, null, 2),
    [`reports/report-${ts}.html`]: generateHtmlReport(data),
  };
}
