# Enuygun Flight Search — k6 Load Test

A small but production-style **k6** load testing project that exercises the
flight search functionality on [enuygun.com](https://www.enuygun.com).
Built as a QA portfolio project to demonstrate clean test structure, custom
metrics, threshold-based pass/fail criteria, and CI-friendly output.

---

## Test Report

After each run, two report artifacts are produced automatically:

| File | Description |
|---|---|
| `report.html` | Self-contained HTML report — open in any browser, no internet needed |
| `summary.json` | Machine-readable raw results (all metrics, checks, thresholds) |

The HTML report includes stat cards, response-time bar chart, error-rate gauge,
check/threshold tables, and a full metrics breakdown — all generated from
`summary.json` by `lib/htmlReport.js`.

---

## Scenario

Simulates a real user searching for one-way economy flights from
**Istanbul (IST) → Ankara (ESB)** two weeks from today.

- 1 virtual user
- 30 second duration
- Realistic browser headers
- Validates HTTP status, response time, content-type, and body contents
- Captures custom metrics for search duration and search-only error rate

---

## Project Structure

```
k6-loadtest/
├── flightSearch.test.js          # Entry point — wires the object graph
├── config/
│   ├── testConfig.js             # Base URL, headers, thresholds, scenarios
│   └── routes.js                 # Pre-built Route value objects
├── src/
│   ├── models/
│   │   ├── Route.js              # Immutable origin/destination value object
│   │   └── FlightSearchRequest.js# Search query value object
│   ├── clients/
│   │   └── FlightSearchClient.js # All HTTP transport (sole user of k6/http)
│   ├── validators/
│   │   └── FlightSearchValidator.js # Response check rules
│   ├── metrics/
│   │   └── SearchMetrics.js      # Custom k6 metrics wrapper
│   ├── loggers/
│   │   └── FailureLogger.js      # Structured stderr logging
│   └── scenarios/
│       └── FlightSearchScenario.js # Per-iteration orchestrator (DI)
├── lib/
│   ├── summary.js                # Console summary renderer (ANSI)
│   └── htmlReport.js             # HTML report generator from summary data
├── report.html                   # ← generated after each run (gitignored)
├── summary.json                  # ← generated after each run (gitignored)
├── package.json                  # Project metadata + npm script shortcuts
├── .gitignore
└── README.md
```

---

## Architecture

The codebase follows OOP principles with classes that each own a single
responsibility and communicate through dependency injection.

```
┌──────────────────────────────────────────────────────────────────────┐
│  flightSearch.test.js  (entry point — k6 hooks)                      │
│   ├─ exports options       → scenarios + thresholds                  │
│   ├─ exports default fn    → builds request → scenario.execute()     │
│   └─ exports handleSummary → JSON + HTML + console artifacts         │
└──────────┬───────────────────────────────────────────────────────────┘
           │ instantiates
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FlightSearchScenario   (orchestrates one iteration)                 │
│   • execute(request) → group → client → validator → metrics → logger │
│   • dependencies injected via constructor                            │
└──────────┬─────────┬──────────────────┬─────────────────┬────────────┘
           │         │                  │                 │
           ▼         ▼                  ▼                 ▼
   ┌────────────┐ ┌──────────────────┐ ┌─────────────┐ ┌────────────┐
   │ Flight-    │ │ Flight-          │ │ Search-     │ │ Failure-   │
   │ Search-    │ │ Search-          │ │ Metrics     │ │ Logger     │
   │ Client     │ │ Validator        │ │             │ │            │
   │ (HTTP)     │ │ (check rules)    │ │ (k6/metrics)│ │ (stderr)   │
   └─────┬──────┘ └──────────────────┘ └─────────────┘ └────────────┘
         │
         │ uses
         ▼
   ┌──────────────────────┐    ┌──────────────────┐
   │ FlightSearchRequest  │ ── │ Route            │
   │ (value object)       │    │ (value object)   │
   └──────────────────────┘    └──────────────────┘
```

### OOP principles applied

| Principle | Where |
|---|---|
| **Single Responsibility** | Each class does exactly one thing — HTTP, validation, metrics, logging, orchestration |
| **Dependency Injection** | `FlightSearchScenario` receives `{ client, validator, metrics, logger }` via constructor; no `new` inside the class |
| **Encapsulation** | `k6/http` and `k6/metrics` are imported **only** by `FlightSearchClient` and `SearchMetrics` respectively — nothing else depends on the framework |
| **Immutability** | `Route` and `FlightSearchRequest` are frozen value objects; passing them around is safe |
| **Open / Closed** | `FlightSearchValidator`'s rules are individual methods — subclass and override `containsRouteKeywords()` to add stricter rules without forking the test |
| **Defensive constructors** | Each class validates its inputs and throws descriptive errors on misuse |
| **Error containment** | `FlightSearchClient.searchFlights()` wraps `http.get()` in try/catch and returns a synthetic response so a transport failure never crashes a VU iteration |

### How to extend

| Goal | What to change |
|---|---|
| Add a new route | Add a `Route` entry to `config/routes.js` |
| Use a different route | Change `ROUTES.istanbulToAnkara` to `ROUTES.ankaraToIstanbul` or `ROUTES.istanbulToIzmir` in `flightSearch.test.js` |
| Add a new check rule | Add a method to `FlightSearchValidator` and reference it from `_buildCheckMap()` |
| Test a different endpoint | Add a method to `FlightSearchClient` (e.g. `getAutocomplete(term)`) |
| Track a new metric | Add a `Trend`/`Rate`/`Counter` to `SearchMetrics` |
| Run a stress profile | Add a new entry under `SCENARIO_CONFIG` in `config/testConfig.js` |

Three routes ship out of the box in `config/routes.js`:

| Key | Route |
|---|---|
| `ROUTES.istanbulToAnkara` | Istanbul → Ankara *(active in test)* |
| `ROUTES.ankaraToIstanbul` | Ankara → Istanbul |
| `ROUTES.istanbulToIzmir` | Istanbul → Izmir |

---

## Prerequisites — Installing k6

k6 is a single binary; you do **not** need Node.js to run it.

### Windows (Chocolatey)

```powershell
choco install k6
```

### Windows (winget)

```powershell
winget install k6 --source winget
```

### macOS (Homebrew)

```bash
brew install k6
```

### Linux (Debian / Ubuntu)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Docker (no install required)

```bash
docker run --rm -i grafana/k6 run - < flightSearch.test.js
```

Verify the install:

```bash
k6 version
```

---

## Running the Test

From the project root:

```bash
k6 run flightSearch.test.js
```

A JSON snapshot of the run will be written to `summary.json` alongside the
console summary.

### Useful flags

| Command | Purpose |
| --- | --- |
| `k6 run --vus 1 --duration 30s flightSearch.test.js` | Override VUs / duration on the fly |
| `k6 run --out json=results.json flightSearch.test.js` | Stream every sample to a JSON file |
| `k6 run --quiet flightSearch.test.js` | Suppress per-request progress bar |
| `k6 run --http-debug="full" flightSearch.test.js` | Print full request/response (debug only) |

If you have npm installed you can also use the shortcut scripts:

```bash
npm test         # runs the test
npm run test:debug
```

---

## What the Test Validates

### Checks (per request)

- `status is 200`
- `response time < 2000ms`
- `response is not empty`
- `body contains route info` (Istanbul or Ankara appears in HTML)
- `content-type is HTML`

### Thresholds (overall pass/fail)

| Threshold | Meaning |
| --- | --- |
| `http_req_failed: rate<0.01` | Less than 1% of HTTP requests may fail |
| `http_req_duration: p(95)<2000` | 95% of requests must complete under 2s |
| `checks: rate>0.95` | At least 95% of all checks must pass |
| `flight_search_duration: p(95)<2000` | Custom: search-only p95 under 2s |
| `flight_search_errors: rate<0.05` | Custom: search error rate under 5% |

If any threshold fails, k6 exits with a **non-zero status code**, making this
script drop-in-ready for CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins).

---

## Reading the Results

A typical successful run prints something like:

```
═══ k6 Test Summary ═══

Checks
    █ Flight Search — IST → ESB
        ✓ status is 200            [100% — 17/17]
        ✓ response time < 2000ms   [100% — 17/17]
        ✓ response is not empty    [100% — 17/17]
        ✓ body contains route info [100% — 17/17]
        ✓ content-type is HTML     [100% — 17/17]

Thresholds
    ✓ checks                  ✓ rate>0.95
    ✓ flight_search_duration  ✓ p(95)<2000
    ✓ flight_search_errors    ✓ rate<0.05
    ✓ http_req_duration       ✓ p(95)<2000
    ✓ http_req_failed         ✓ rate<0.01

Metrics
    checks                 : 100.00% ✓ 85  ✗ 0
    flight_search_duration : avg=376ms  p(95)=663ms  p(99)=729ms
    flight_search_errors   : 0.00%   ✓ 0   ✗ 17
    http_req_duration      : avg=256ms  p(95)=413ms  p(99)=694ms
    http_req_failed        : 0.00%   ✓ 0   ✗ 51
    http_reqs              : count=51  1.69/s
    iterations             : count=17  0.56/s
```

### Key metrics explained

| Metric | What it tells you |
| --- | --- |
| `http_req_duration` | Total request time (DNS + TCP + TLS + send + wait + receive) |
| `http_req_waiting` | Time-to-first-byte — usually the best proxy for server load |
| `http_req_failed` | Rate of network/HTTP errors (status ≥ 400 or transport failure) |
| `iterations` | How many times the default function ran |
| `checks` | Percentage of `check()` assertions that passed |
| `flight_search_duration` | Custom: time of just the search request |
| `flight_search_errors` | Custom: error rate of just the search request |
| `vus` / `vus_max` | Active and max concurrent virtual users |

### How to interpret pass/fail

- **All thresholds green** → the page meets the SLA at this load level.
- **Threshold breach (✗)** → k6 exits with code `99`. Investigate the failing
  metric — e.g. a high `http_req_waiting` p95 usually indicates server-side
  latency rather than network problems.
- **Failed checks** → log lines starting with `[FAIL]` are written to stderr
  with the URL, status, duration, and error so you can reproduce easily.

---

## Extending the Test

The script is intentionally modular so it can scale beyond a single VU demo.

- **More routes** — add entries to `ROUTES` in `config/testConfig.js`
- **Higher load** — swap `executor: 'constant-vus'` for `'ramping-vus'`
  with a `stages` array
- **Smoke / load / stress** — define multiple `scenarios` in `options`
- **CI integration** — `k6 run` returns non-zero on threshold breach, so it
  works out-of-the-box with any CI runner

Example ramping configuration:

```javascript
scenarios: {
  ramp_up: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '1m',  target: 20 },
      { duration: '30s', target: 0 },
    ],
  },
},
```

---

## Notes on Responsible Testing

This script is configured for **1 VU / 30s** and includes a 1-second think
time between iterations — i.e. ~30 requests total against a public website.
That's well within polite browsing levels.

Before running anything heavier against `enuygun.com` (or any third-party
service), make sure you have **written permission** from the site owner.
For load testing real production traffic patterns, point the script at your
own staging environment.

---

## License

MIT — feel free to fork and adapt for your own portfolio.
