// -----------------------------------------------------------------------------
// SearchMetrics
// -----------------------------------------------------------------------------
// Wraps the custom k6 metrics needed by the flight-search scenario behind a
// stable API. The rest of the test code never imports `k6/metrics` — it only
// calls `recordSuccess(res)` / `recordFailure(res)` on this object.
//
// Why a class?
//   * Encapsulation: callers don't need to know which metric is a Trend vs
//     Rate vs Counter.
//   * Single Responsibility: this module is the only place metric names are
//     defined.
//   * Easier testing / mocking: a fake SearchMetrics can be swapped in for
//     unit tests of higher layers.
// -----------------------------------------------------------------------------

import { Trend, Rate, Counter } from 'k6/metrics';

export class SearchMetrics {
  constructor() {
    // `true` on Trend marks it as time-based so k6 displays it in ms / s.
    this.duration = new Trend('flight_search_duration', true);
    this.errorRate = new Rate('flight_search_errors');
    this.failures = new Counter('failed_requests_total');
  }

  /**
   * Record a successful flight search response.
   * @param {object} response k6 HTTP response
   */
  recordSuccess(response) {
    if (response && response.timings) {
      this.duration.add(response.timings.duration);
    }
    this.errorRate.add(false);
  }

  /**
   * Record a failed flight search response (bad status, transport error,
   * or check failure).
   * @param {object} response k6 HTTP response
   */
  recordFailure(response) {
    if (response && response.timings) {
      this.duration.add(response.timings.duration);
    }
    this.errorRate.add(true);
    this.failures.add(1);
  }
}
