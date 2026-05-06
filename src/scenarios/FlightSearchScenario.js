// -----------------------------------------------------------------------------
// FlightSearchScenario
// -----------------------------------------------------------------------------
// Orchestrates a single iteration of the flight-search load test:
//   1. Issue the search via FlightSearchClient
//   2. Validate the response via FlightSearchValidator
//   3. Record metrics via SearchMetrics
//   4. Log failures via FailureLogger
//
// Dependencies are injected through the constructor (Dependency Injection),
// which makes the class easy to unit test and easy to extend (e.g. plug in a
// different validator subclass to enforce stricter rules).
// -----------------------------------------------------------------------------

import { group, sleep } from 'k6';

export class FlightSearchScenario {
  /**
   * @param {object} deps
   * @param {import('../clients/FlightSearchClient.js').FlightSearchClient} deps.client
   * @param {import('../validators/FlightSearchValidator.js').FlightSearchValidator} deps.validator
   * @param {import('../metrics/SearchMetrics.js').SearchMetrics} deps.metrics
   * @param {import('../loggers/FailureLogger.js').FailureLogger} deps.logger
   * @param {object} [cfg]
   * @param {string} [cfg.groupName='Flight Search']
   * @param {number} [cfg.thinkTimeSeconds=1]
   */
  constructor(deps, cfg = {}) {
    if (!deps || !deps.client || !deps.validator || !deps.metrics || !deps.logger) {
      throw new Error(
        'FlightSearchScenario requires { client, validator, metrics, logger }',
      );
    }
    this.client = deps.client;
    this.validator = deps.validator;
    this.metrics = deps.metrics;
    this.logger = deps.logger;

    this.groupName = cfg.groupName ?? 'Flight Search';
    this.thinkTimeSeconds = cfg.thinkTimeSeconds ?? 1;
  }

  /**
   * Run a single iteration of the scenario for the given request.
   * Errors are caught here as a last-resort safety net so a single bad
   * iteration never crashes the whole test run.
   *
   * @param {import('../models/FlightSearchRequest.js').FlightSearchRequest} request
   */
  execute(request) {
    const groupLabel = `${this.groupName} — ${request.route}`;

    group(groupLabel, () => {
      let outcome = { url: '', response: null, error: null };

      try {
        outcome = this.client.searchFlights(request);
        this._validateAndRecord(outcome);
      } catch (err) {
        // Belt-and-braces: anything thrown above (validator, metric recorder)
        // gets caught here so the VU keeps iterating.
        this.logger.logFailure({
          url: outcome.url || 'n/a',
          response: outcome.response,
          error: err instanceof Error ? err : new Error(String(err)),
        });
        this.metrics.recordFailure(outcome.response || {});
      }
    });

    if (this.thinkTimeSeconds > 0) {
      sleep(this.thinkTimeSeconds);
    }
  }

  // ─── private ───────────────────────────────────────────────────────────────

  _validateAndRecord({ url, response, error }) {
    const checksPassed = this.validator.validate(response);
    const transportFailed = error !== null;
    const statusFailed = response.status !== 200;

    if (transportFailed || statusFailed || !checksPassed) {
      this.metrics.recordFailure(response);
      this.logger.logFailure({ url, response, error });
    } else {
      this.metrics.recordSuccess(response);
    }
  }
}
