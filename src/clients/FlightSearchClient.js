// -----------------------------------------------------------------------------
// FlightSearchClient
// -----------------------------------------------------------------------------
// Encapsulates ALL HTTP communication with Enuygun's flight search endpoint.
// The rest of the test code never imports k6/http directly — it always goes
// through this client, which means:
//
//   * The base URL, headers, timeout, and redirect policy are configured in
//     ONE place.
//   * Adding new endpoints (e.g. autocomplete, airline filters) means adding
//     a new method here, not editing the test script.
//   * Error handling is centralised: transport failures are caught and
//     translated into a synthetic response object so callers never have to
//     deal with raw exceptions.
// -----------------------------------------------------------------------------

import http from 'k6/http';

export class FlightSearchClient {
  /**
   * @param {object} cfg
   * @param {string} cfg.baseUrl
   * @param {object} [cfg.defaultHeaders]
   * @param {string} [cfg.timeout='30s']
   * @param {number} [cfg.maxRedirects=5]
   */
  constructor(cfg) {
    if (!cfg || !cfg.baseUrl) {
      throw new Error('FlightSearchClient requires { baseUrl }');
    }
    this.baseUrl = cfg.baseUrl.replace(/\/$/, '');
    this.defaultHeaders = cfg.defaultHeaders ?? {};
    this.timeout = cfg.timeout ?? '30s';
    this.maxRedirects = cfg.maxRedirects ?? 5;
  }

  /**
   * Perform a flight search.
   * @param {import('../models/FlightSearchRequest.js').FlightSearchRequest} request
   * @returns {{ url: string, response: object, error: Error|null }}
   */
  searchFlights(request) {
    const url = this.buildSearchUrl(request);
    const params = this._buildRequestParams('FlightSearch');

    try {
      const response = http.get(url, params);
      return { url, response, error: null };
    } catch (err) {
      // Synthesize a "failed" response so downstream code (validators, metrics)
      // can keep treating everything as a normal response object.
      return {
        url,
        response: this._syntheticErrorResponse(err),
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  /**
   * Build the public-site search URL for a given request.
   * Public route format used by enuygun.com:
   *   /ucak-bileti/{slug}/?gidis=YYYY-MM-DD&yetiskin=N&sinif=ekonomi
   *
   * @param {import('../models/FlightSearchRequest.js').FlightSearchRequest} request
   * @returns {string}
   */
  buildSearchUrl(request) {
    const slug = request.route.toSlug();
    const query = request.toQueryString();
    return `${this.baseUrl}/ucak-bileti/${slug}/?${query}`;
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  _buildRequestParams(name) {
    return {
      headers: this.defaultHeaders,
      timeout: this.timeout,
      tags: { name, endpoint: 'flight_search' },
      redirects: this.maxRedirects,
    };
  }

  _syntheticErrorResponse(err) {
    return {
      status: 0,
      body: '',
      headers: {},
      timings: { duration: 0 },
      error: err instanceof Error ? err.message : String(err),
      error_code: 'CLIENT_EXCEPTION',
    };
  }
}
