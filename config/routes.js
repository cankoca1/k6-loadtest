// -----------------------------------------------------------------------------
// Route Definitions
// -----------------------------------------------------------------------------
// Pre-built Route value objects. Adding a new route requires:
//   1. Look up the Enuygun city slug + city-wide code (e.g. ISTA covers both
//      IST and SAW airports for Istanbul).
//   2. Append a new entry below.
//
// Test scripts import only the entries they need, so unused routes have zero
// runtime cost.
// -----------------------------------------------------------------------------

import { Route } from '../src/models/Route.js';

export const ROUTES = {
  istanbulToAnkara: new Route({
    originName: 'Istanbul',
    destinationName: 'Ankara',
    originCity: 'istanbul',
    destinationCity: 'ankara',
    originCode: 'ista',
    destinationCode: 'anka',
  }),

  ankaraToIstanbul: new Route({
    originName: 'Ankara',
    destinationName: 'Istanbul',
    originCity: 'ankara',
    destinationCity: 'istanbul',
    originCode: 'anka',
    destinationCode: 'ista',
  }),

  istanbulToIzmir: new Route({
    originName: 'Istanbul',
    destinationName: 'Izmir',
    originCity: 'istanbul',
    destinationCity: 'izmir',
    originCode: 'ista',
    destinationCode: 'adb',
  }),
};
