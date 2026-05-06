// -----------------------------------------------------------------------------
// FlightSearchValidator
// -----------------------------------------------------------------------------
// Encapsulates the business rules for what makes a flight-search response
// "good". Each rule is a method on the class so it can be unit-tested,
// extended (subclass), or partially overridden without forking the test code.
// -----------------------------------------------------------------------------

import { check } from 'k6';

export class FlightSearchValidator {
  /**
   * @param {object} [cfg]
   * @param {number} [cfg.maxResponseTimeMs=2000]
   * @param {string[]} [cfg.expectedKeywords]  Keywords that must appear in body
   */
  constructor(cfg = {}) {
    this.maxResponseTimeMs = cfg.maxResponseTimeMs ?? 2000;
    this.expectedKeywords = cfg.expectedKeywords ?? ['istanbul', 'ankara'];
  }

  /**
   * Run all checks against the response and let k6 record the results.
   * @param {object} response  k6 HTTP response object
   * @returns {boolean} true if all checks passed
   */
  validate(response) {
    return check(response, this._buildCheckMap());
  }

  // ─── individual rules (overridable in subclasses) ──────────────────────────

  isStatusOk(response) {
    return response.status === 200;
  }

  isWithinTimeBudget(response) {
    return response.timings && response.timings.duration < this.maxResponseTimeMs;
  }

  hasNonEmptyBody(response) {
    return Boolean(response.body) && response.body.length > 0;
  }

  containsRouteKeywords(response) {
    if (typeof response.body !== 'string') return false;
    const body = response.body.toLowerCase();
    return this.expectedKeywords.some((kw) => body.includes(kw.toLowerCase()));
  }

  isHtmlContent(response) {
    const headers = response.headers || {};
    const ct = headers['Content-Type'] || headers['content-type'] || '';
    return ct.toLowerCase().includes('text/html');
  }

  // ─── private ───────────────────────────────────────────────────────────────

  _buildCheckMap() {
    return {
      'status is 200':                                      (r) => this.isStatusOk(r),
      [`response time < ${this.maxResponseTimeMs}ms`]:      (r) => this.isWithinTimeBudget(r),
      'response is not empty':                              (r) => this.hasNonEmptyBody(r),
      'body contains route info':                           (r) => this.containsRouteKeywords(r),
      'content-type is HTML':                               (r) => this.isHtmlContent(r),
    };
  }
}
