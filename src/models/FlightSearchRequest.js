// -----------------------------------------------------------------------------
// FlightSearchRequest (Value Object)
// -----------------------------------------------------------------------------
// Encapsulates a single flight search query (route + date + passengers + cabin).
// Provides a stable, well-typed interface for the FlightSearchClient instead of
// passing loose `(route, date, count, cabin)` parameters everywhere.
// -----------------------------------------------------------------------------

import { Route } from './Route.js';

export class FlightSearchRequest {
  /**
   * @param {object} cfg
   * @param {Route}  cfg.route             Origin/destination
   * @param {string} cfg.departureDate     YYYY-MM-DD
   * @param {number} [cfg.passengerCount=1]
   * @param {string} [cfg.cabin='ekonomi'] economy / business / first
   */
  constructor(cfg) {
    if (!cfg || typeof cfg !== 'object') {
      throw new Error('FlightSearchRequest requires a configuration object');
    }
    if (!(cfg.route instanceof Route)) {
      throw new Error('FlightSearchRequest.route must be a Route instance');
    }
    if (!FlightSearchRequest._isIsoDate(cfg.departureDate)) {
      throw new Error(
        `FlightSearchRequest.departureDate must be YYYY-MM-DD, got "${cfg.departureDate}"`,
      );
    }

    const passengerCount = cfg.passengerCount ?? 1;
    if (!Number.isInteger(passengerCount) || passengerCount < 1) {
      throw new Error('FlightSearchRequest.passengerCount must be a positive integer');
    }

    this.route = cfg.route;
    this.departureDate = cfg.departureDate;
    this.passengerCount = passengerCount;
    this.cabin = cfg.cabin ?? 'ekonomi';

    Object.freeze(this);
  }

  /**
   * Returns the query string portion of the search URL (without leading "?").
   * @returns {string}
   */
  toQueryString() {
    const params = {
      gidis: this.departureDate,
      yetiskin: String(this.passengerCount),
      sinif: this.cabin,
    };
    return Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  toString() {
    return `${this.route} on ${this.departureDate} ` +
           `(${this.passengerCount} pax, ${this.cabin})`;
  }

  static _isIsoDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
