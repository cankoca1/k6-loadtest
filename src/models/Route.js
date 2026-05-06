// -----------------------------------------------------------------------------
// Route (Value Object)
// -----------------------------------------------------------------------------
// Immutable representation of a flight route between two cities.
// Encapsulates the URL slug logic that Enuygun's public site uses, so that
// callers never have to know how the slug is built.
// -----------------------------------------------------------------------------

export class Route {
  /**
   * @param {object} cfg
   * @param {string} cfg.originName       Display name, e.g. "Istanbul"
   * @param {string} cfg.destinationName  Display name, e.g. "Ankara"
   * @param {string} cfg.originCity       Slug city, e.g. "istanbul"
   * @param {string} cfg.destinationCity  Slug city, e.g. "ankara"
   * @param {string} cfg.originCode       City-wide code, e.g. "ista"
   * @param {string} cfg.destinationCode  City-wide code, e.g. "anka"
   */
  constructor(cfg) {
    if (!cfg || typeof cfg !== 'object') {
      throw new Error('Route requires a configuration object');
    }
    const required = [
      'originName', 'destinationName',
      'originCity', 'destinationCity',
      'originCode', 'destinationCode',
    ];
    for (const key of required) {
      if (!cfg[key] || typeof cfg[key] !== 'string') {
        throw new Error(`Route is missing required field: ${key}`);
      }
    }

    this.originName = cfg.originName;
    this.destinationName = cfg.destinationName;
    this.originCity = cfg.originCity.toLowerCase();
    this.destinationCity = cfg.destinationCity.toLowerCase();
    this.originCode = cfg.originCode.toLowerCase();
    this.destinationCode = cfg.destinationCode.toLowerCase();

    Object.freeze(this);
  }

  /**
   * Builds the URL slug Enuygun uses for this route.
   * Format: `{originCity}-{destinationCity}-{originCode}-{destinationCode}`
   * @returns {string}
   */
  toSlug() {
    return `${this.originCity}-${this.destinationCity}` +
           `-${this.originCode}-${this.destinationCode}`;
  }

  /**
   * Human-readable representation, useful for logging and group names.
   * @returns {string}
   */
  toString() {
    return `${this.originName} → ${this.destinationName}`;
  }
}
