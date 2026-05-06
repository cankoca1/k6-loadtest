// -----------------------------------------------------------------------------
// HTML Report Generator
// -----------------------------------------------------------------------------
// Converts the k6 handleSummary `data` object (identical structure to
// summary.json) into a self-contained HTML string.
//
// Features:
//   - Zero external dependencies — pure HTML + inline CSS + inline SVG
//   - Threshold pass/fail badges
//   - Response-time breakdown bar chart (inline SVG)
//   - Error rate gauge (inline SVG)
//   - Full metrics table
//   - Fully portable: one .html file, works offline
// -----------------------------------------------------------------------------

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value, contains) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (contains === 'time') {
    if (value < 1) return `${(value * 1000).toFixed(0)} µs`;
    if (value < 1000) return `${value.toFixed(0)} ms`;
    return `${(value / 1000).toFixed(2)} s`;
  }
  if (contains === 'data') {
    if (value < 1024) return `${value.toFixed(0)} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} kB`;
    return `${(value / 1048576).toFixed(2)} MB`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function fmtRate(rate) {
  return `${(rate * 100).toFixed(2)}%`;
}

function isoNow() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG: Horizontal bar chart for response time percentiles
// ─────────────────────────────────────────────────────────────────────────────
function responseTimeChart(metrics) {
  const dur = metrics['flight_search_duration'] || metrics['http_req_duration'];
  if (!dur) return '';
  const v = dur.values;
  const c = dur.contains;

  const bars = [
    { label: 'avg',  value: v['avg'],   color: '#6366f1' },
    { label: 'p50',  value: v['med'],   color: '#8b5cf6' },
    { label: 'p90',  value: v['p(90)'], color: '#f59e0b' },
    { label: 'p95',  value: v['p(95)'], color: '#f97316' },
    { label: 'p99',  value: v['p(99)'], color: '#ef4444' },
    { label: 'max',  value: v['max'],   color: '#dc2626' },
  ].filter(b => b.value !== undefined);

  const maxVal = Math.max(...bars.map(b => b.value));
  const budget = 2000;
  const scale = maxVal > 0 ? 1 : 1;
  const chartMax = Math.max(maxVal * 1.15, budget);

  const W = 440, H = bars.length * 36 + 20;
  const labelW = 36, valueW = 70, barAreaW = W - labelW - valueW - 16;

  const budgetX = labelW + (budget / chartMax) * barAreaW;

  const barSvg = bars.map((b, i) => {
    const y = 10 + i * 36;
    const bw = Math.max((b.value / chartMax) * barAreaW, 2);
    return `
      <text x="${labelW - 6}" y="${y + 14}" text-anchor="end"
            font-size="11" fill="#94a3b8">${b.label}</text>
      <rect x="${labelW}" y="${y}" width="${bw}" height="20"
            rx="3" fill="${b.color}" opacity="0.85"/>
      <text x="${labelW + bw + 5}" y="${y + 14}"
            font-size="11" fill="#e2e8f0">${fmt(b.value, c)}</text>`;
  }).join('');

  return `
  <div class="chart-wrap">
    <h3 class="chart-title">Response Time Breakdown (Flight Search)</h3>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
      <!-- budget line -->
      <line x1="${budgetX}" y1="0" x2="${budgetX}" y2="${H}"
            stroke="#22c55e" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>
      <text x="${budgetX + 3}" y="10" font-size="9" fill="#22c55e" opacity="0.8">
        2000 ms budget
      </text>
      ${barSvg}
    </svg>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG: Donut gauge for error rate
// ─────────────────────────────────────────────────────────────────────────────
function errorGauge(rate) {
  const pct = (rate * 100).toFixed(2);
  const ok = rate < 0.01;
  const arcColor = ok ? '#22c55e' : '#ef4444';
  const r = 38, cx = 50, cy = 50, stroke = 10;
  const circ = 2 * Math.PI * r;
  const dash = (rate * circ).toFixed(2);
  const gap = (circ - dash).toFixed(2);

  return `
  <div class="gauge-wrap">
    <h3 class="chart-title">HTTP Error Rate</h3>
    <svg viewBox="0 0 100 100" width="140" height="140">
      <circle cx="${cx}" cy="${cy}" r="${r}"
              fill="none" stroke="#1e293b" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}"
              fill="none" stroke="${arcColor}" stroke-width="${stroke}"
              stroke-dasharray="${dash} ${gap}"
              stroke-dashoffset="${circ * 0.25}"
              stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle"
            font-size="14" font-weight="700" fill="${arcColor}">${pct}%</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle"
            font-size="8" fill="#94a3b8">error rate</text>
    </svg>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checks table
// ─────────────────────────────────────────────────────────────────────────────
function checksSection(rootGroup) {
  const allChecks = [];
  function walk(g) {
    for (const c of g.checks || []) allChecks.push(c);
    for (const sub of g.groups || []) walk(sub);
  }
  walk(rootGroup);

  if (!allChecks.length) return '';

  const rows = allChecks.map(c => {
    const total = c.passes + c.fails;
    const pct = total > 0 ? ((c.passes / total) * 100).toFixed(0) : '0';
    const ok = c.fails === 0;
    return `
      <tr>
        <td><span class="badge ${ok ? 'badge-pass' : 'badge-fail'}">${ok ? '✓' : '✗'}</span></td>
        <td>${c.name}</td>
        <td class="num">${c.passes}</td>
        <td class="num">${c.fails}</td>
        <td class="num"><strong>${pct}%</strong></td>
      </tr>`;
  }).join('');

  const totalPass = allChecks.reduce((s, c) => s + c.passes, 0);
  const totalFail = allChecks.reduce((s, c) => s + c.fails, 0);
  const grandTotal = totalPass + totalFail;
  const grandPct = grandTotal > 0 ? ((totalPass / grandTotal) * 100).toFixed(0) : '0';

  return `
  <section>
    <h2>Checks</h2>
    <table>
      <thead><tr><th></th><th>Check</th><th class="num">Passed</th>
             <th class="num">Failed</th><th class="num">Rate</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td></td><td><strong>Total</strong></td>
        <td class="num"><strong>${totalPass}</strong></td>
        <td class="num"><strong>${totalFail}</strong></td>
        <td class="num"><strong>${grandPct}%</strong></td>
      </tr></tfoot>
    </table>
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds table
// ─────────────────────────────────────────────────────────────────────────────
function thresholdsSection(metrics) {
  const rows = [];
  for (const [name, m] of Object.entries(metrics)) {
    if (!m.thresholds) continue;
    for (const [expr, t] of Object.entries(m.thresholds)) {
      const ok = t.ok !== false;
      rows.push(`
        <tr>
          <td><span class="badge ${ok ? 'badge-pass' : 'badge-fail'}">${ok ? 'PASS' : 'FAIL'}</span></td>
          <td><code>${name}</code></td>
          <td><code>${expr}</code></td>
        </tr>`);
    }
  }
  if (!rows.length) return '';

  return `
  <section>
    <h2>Thresholds</h2>
    <table>
      <thead><tr><th>Result</th><th>Metric</th><th>Expression</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics table (all metrics)
// ─────────────────────────────────────────────────────────────────────────────
function metricsSection(metrics) {
  const TREND_STATS = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

  const rows = Object.entries(metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, m]) => {
      let valueCell = '';
      const c = m.contains;
      const v = m.values || {};

      if (m.type === 'counter') {
        valueCell = `${fmt(v.count, c)} <span class="dim">(${fmt(v.rate, 'default')}/s)</span>`;
      } else if (m.type === 'rate') {
        const ok = v.rate !== undefined ? v.rate : 0;
        valueCell = `${fmtRate(ok)} &nbsp;<span class="dim">✓ ${v.passes ?? 0} / ✗ ${v.fails ?? 0}</span>`;
      } else if (m.type === 'gauge') {
        valueCell = fmt(v.value, c);
      } else {
        // trend
        valueCell = TREND_STATS
          .filter(s => v[s] !== undefined)
          .map(s => `<span class="stat-label">${s}</span> ${fmt(v[s], c)}`)
          .join('&ensp;');
      }

      const hasThreshold = !!m.thresholds;
      const allOk = hasThreshold
        ? Object.values(m.thresholds).every(t => t.ok !== false)
        : null;

      const indicator = allOk === null
        ? ''
        : `<span class="badge ${allOk ? 'badge-pass' : 'badge-fail'} badge-xs">${allOk ? '✓' : '✗'}</span> `;

      return `
        <tr${hasThreshold ? ' class="has-threshold"' : ''}>
          <td><code>${name}</code></td>
          <td class="type-cell">${m.type}</td>
          <td>${indicator}${valueCell}</td>
        </tr>`;
    });

  return `
  <section>
    <h2>All Metrics</h2>
    <table class="metrics-table">
      <thead><tr><th>Metric</th><th>Type</th><th>Values</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat cards row
// ─────────────────────────────────────────────────────────────────────────────
function statCards(metrics, durationMs) {
  const dur = metrics['flight_search_duration'] || metrics['http_req_duration'];
  const p95 = dur ? fmt(dur.values['p(95)'], dur.contains) : '—';
  const avgVal = dur ? fmt(dur.values['avg'], dur.contains) : '—';

  const failed = metrics['http_req_failed'];
  const errRate = failed ? fmtRate(failed.values.rate || 0) : '—';

  const reqs = metrics['http_reqs'];
  const reqCount = reqs ? reqs.values.count : '—';

  const iters = metrics['iterations'];
  const iterCount = iters ? iters.values.count : '—';

  const checksM = metrics['checks'];
  const checksRate = checksM ? fmtRate(checksM.values.rate || 0) : '—';

  const durSec = durationMs ? `${(durationMs / 1000).toFixed(1)} s` : '—';

  const cards = [
    { label: 'Duration',        value: durSec,    sub: 'test run'        },
    { label: 'Iterations',      value: iterCount,  sub: 'completed'       },
    { label: 'HTTP Requests',   value: reqCount,   sub: 'total'           },
    { label: 'Avg Response',    value: avgVal,     sub: 'flight search'   },
    { label: 'p95 Response',    value: p95,        sub: 'flight search'   },
    { label: 'Error Rate',      value: errRate,    sub: 'http_req_failed' },
    { label: 'Checks Passed',   value: checksRate, sub: 'all assertions'  },
  ];

  return `<div class="cards">${cards.map(c => `
    <div class="card">
      <div class="card-value">${c.value}</div>
      <div class="card-label">${c.label}</div>
      <div class="card-sub">${c.sub}</div>
    </div>`).join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function generateHtmlReport(data) {
  const metrics = data.metrics || {};
  const rootGroup = data.root_group || { checks: [], groups: [] };
  const durationMs = data.state ? data.state.testRunDurationMs : undefined;

  const failedM = metrics['http_req_failed'];
  const errRate = failedM ? (failedM.values.rate || 0) : 0;

  const allThresholdsPassed = Object.values(metrics).every(m => {
    if (!m.thresholds) return true;
    return Object.values(m.thresholds).every(t => t.ok !== false);
  });

  const overallBadge = allThresholdsPassed
    ? '<span class="badge badge-pass badge-lg">ALL THRESHOLDS PASSED</span>'
    : '<span class="badge badge-fail badge-lg">THRESHOLD BREACH DETECTED</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>k6 Load Test Report — Enuygun Flight Search</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0f172a;
      --surface:  #1e293b;
      --border:   #334155;
      --text:     #e2e8f0;
      --muted:    #94a3b8;
      --accent:   #6366f1;
      --pass:     #22c55e;
      --fail:     #ef4444;
      --warn:     #f59e0b;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 24px;
    }

    a { color: var(--accent); }

    /* ── Header ─────────────────────────────────────────────── */
    header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 24px;
    }
    header .logo { font-size: 11px; color: var(--muted); letter-spacing: 2px;
                   text-transform: uppercase; margin-bottom: 8px; }
    header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    header .meta { color: var(--muted); font-size: 12px; }
    header .meta span { margin-right: 20px; }
    .overall { margin-top: 14px; }

    /* ── Stat cards ─────────────────────────────────────────── */
    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 20px;
      min-width: 120px;
      flex: 1 1 120px;
    }
    .card-value { font-size: 22px; font-weight: 700; color: var(--accent); }
    .card-label { font-size: 12px; font-weight: 600; margin-top: 2px; }
    .card-sub   { font-size: 11px; color: var(--muted); }

    /* ── Sections ───────────────────────────────────────────── */
    section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 15px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    /* ── Tables ─────────────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left;
      padding: 8px 12px;
      color: var(--muted);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(51,65,85,0.4);
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr.has-threshold td { background: rgba(99,102,241,0.04); }
    tfoot td { border-top: 1px solid var(--border); background: rgba(30,41,59,0.6); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    code {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 12px;
      background: rgba(99,102,241,0.12);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .dim { color: var(--muted); }
    .stat-label { color: var(--muted); font-size: 11px; }
    .type-cell { color: var(--muted); font-size: 12px; }
    .metrics-table td:last-child { font-variant-numeric: tabular-nums; }

    /* ── Badges ─────────────────────────────────────────────── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge-pass { background: rgba(34,197,94,0.15);  color: var(--pass); }
    .badge-fail { background: rgba(239,68,68,0.15);  color: var(--fail); }
    .badge-lg   { font-size: 13px; padding: 5px 14px; }
    .badge-xs   { font-size: 10px; padding: 1px 5px; }

    /* ── Charts ─────────────────────────────────────────────── */
    .charts-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .chart-wrap, .gauge-wrap {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px 24px;
      flex: 1 1 300px;
    }
    .chart-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 14px;
    }
    svg text { font-family: 'Segoe UI', sans-serif; }

    /* ── Footer ─────────────────────────────────────────────── */
    footer {
      text-align: center;
      color: var(--muted);
      font-size: 11px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>

<header>
  <div class="logo">k6 Load Test Report</div>
  <h1>Enuygun — Flight Search Module</h1>
  <div class="meta">
    <span>🌐 www.enuygun.com</span>
    <span>✈️ Istanbul → Ankara</span>
    <span>⏱ ${isoNow()}</span>
    <span>🔧 k6 v2.0.0-rc1</span>
  </div>
  <div class="overall">${overallBadge}</div>
</header>

${statCards(metrics, durationMs)}

<div class="charts-row">
  ${responseTimeChart(metrics)}
  ${errorGauge(errRate)}
</div>

${checksSection(rootGroup)}
${thresholdsSection(metrics)}
${metricsSection(metrics)}

<footer>
  Generated by <strong>lib/htmlReport.js</strong> from <code>summary.json</code> &mdash;
  Enuygun QA Portfolio &bull; k6 load test
</footer>

</body>
</html>`;
}
