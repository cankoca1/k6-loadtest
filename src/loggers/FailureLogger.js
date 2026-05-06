// -----------------------------------------------------------------------------
// FailureLogger
// -----------------------------------------------------------------------------
// Centralised structured logging for failed requests. Decoupled from the
// scenario logic so the format can be changed in one place (or replaced with
// JSON-line logging for log-aggregation pipelines).
// -----------------------------------------------------------------------------

export class FailureLogger {
  /**
   * @param {object} [cfg]
   * @param {string} [cfg.prefix='[FAIL]']
   */
  constructor(cfg = {}) {
    this.prefix = cfg.prefix ?? '[FAIL]';
  }

  /**
   * Log a failed request with context.
   * @param {object} ctx
   * @param {string} ctx.url
   * @param {object} ctx.response
   * @param {Error|null} [ctx.error]
   */
  logFailure({ url, response, error }) {
    const status = response ? response.status : 'n/a';
    const duration = response && response.timings
      ? response.timings.duration.toFixed(0)
      : 'n/a';
    const errMsg = error
      ? error.message
      : (response && response.error) || 'none';

    console.error(
      `${this.prefix} ${url} -> status=${status} ` +
      `duration=${duration}ms error=${errMsg}`,
    );
  }
}
