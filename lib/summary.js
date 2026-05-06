// -----------------------------------------------------------------------------
// Minimal custom summary renderer
// -----------------------------------------------------------------------------
// Self-contained replacement for the (network-fetched) `k6-summary` jslib.
// Produces a readable, ANSI-coloured end-of-test report that mirrors the
// information shown by k6's default summary, including:
//
//   * Test metadata (script, duration, scenarios)
//   * Threshold results (pass / fail per metric)
//   * Group-level check results
//   * All metric values with the configured trend stats
//
// Keeping this in-tree means the test runs even on machines that can't reach
// jslib.k6.io and keeps the script fully reproducible.
// -----------------------------------------------------------------------------

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function color(text, code) {
  return `${code}${text}${ANSI.reset}`;
}

function pad(text, width) {
  const t = String(text);
  return t.length >= width ? t : t + ' '.repeat(width - t.length);
}

// Format a value depending on the metric "contains" type. Time-based metrics
// are rendered with adaptive units (us / ms / s) for readability.
function formatValue(value, contains) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';

  if (contains === 'time') {
    if (value < 1) return `${(value * 1000).toFixed(2)}µs`;
    if (value < 1000) return `${value.toFixed(2)}ms`;
    return `${(value / 1000).toFixed(2)}s`;
  }

  if (contains === 'data') {
    if (value < 1024) return `${value.toFixed(0)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4);
}

// Renders a single metric line, e.g.
//   http_req_duration..............: avg=812ms p(95)=1.4s
function renderMetricLine(name, metric) {
  const contains = metric.contains;
  const values = metric.values || {};
  let parts = [];

  if (metric.type === 'counter') {
    parts.push(`count=${formatValue(values.count, contains)}`);
    if (values.rate !== undefined) {
      parts.push(`${color(formatValue(values.rate, contains) + '/s', ANSI.dim)}`);
    }
  } else if (metric.type === 'rate') {
    const passes = values.passes ?? 0;
    const fails = values.fails ?? 0;
    const rate = (values.rate ?? 0) * 100;
    parts.push(`${rate.toFixed(2)}%`);
    parts.push(color(`✓ ${passes}`, ANSI.green));
    parts.push(color(`✗ ${fails}`, ANSI.red));
  } else if (metric.type === 'gauge') {
    parts.push(`value=${formatValue(values.value, contains)}`);
    if (values.min !== undefined) parts.push(`min=${formatValue(values.min, contains)}`);
    if (values.max !== undefined) parts.push(`max=${formatValue(values.max, contains)}`);
  } else {
    // trend
    const stats = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];
    for (const stat of stats) {
      if (values[stat] !== undefined) {
        parts.push(`${stat}=${color(formatValue(values[stat], contains), ANSI.cyan)}`);
      }
    }
  }

  const label = pad(name, 32);
  return `    ${color(label, ANSI.bold)}: ${parts.join(' ')}`;
}

// Format a threshold pass/fail block under each affected metric.
function renderThresholds(metric) {
  if (!metric.thresholds) return '';
  const lines = [];
  for (const [expr, t] of Object.entries(metric.thresholds)) {
    const ok = t.ok !== false;
    const symbol = ok ? color('✓', ANSI.green) : color('✗', ANSI.red);
    lines.push(`        ${symbol} ${color(expr, ok ? ANSI.gray : ANSI.red)}`);
  }
  return lines.join('\n');
}

// Format the per-group `check` block (✓ / ✗ counts).
function renderChecks(rootGroup, indent = '    ') {
  const lines = [];

  function walk(group, depth) {
    const prefix = indent + '  '.repeat(depth);
    if (group.name) {
      lines.push(`${prefix}${color('█', ANSI.bold)} ${color(group.name, ANSI.bold)}`);
    }
    for (const c of group.checks || []) {
      const passed = c.passes;
      const failed = c.fails;
      const total = passed + failed;
      const ok = failed === 0;
      const symbol = ok ? color('✓', ANSI.green) : color('✗', ANSI.red);
      const ratio = total > 0 ? ((passed / total) * 100).toFixed(0) : '0';
      lines.push(
        `${prefix}  ${symbol} ${c.name} ` +
          color(`[${ratio}% — ${passed}/${total}]`, ok ? ANSI.gray : ANSI.red),
      );
    }
    for (const sub of group.groups || []) walk(sub, depth + 1);
  }

  walk(rootGroup, 0);
  return lines.join('\n');
}

export function renderSummary(data) {
  const out = [];
  const metrics = data.metrics || {};
  const root = data.root_group || { name: '', checks: [], groups: [] };

  out.push('');
  out.push(color('═══ k6 Test Summary ═══', ANSI.bold));
  out.push('');

  // ── checks per group ─────────────────────────────────────────────────────
  if ((root.checks && root.checks.length) || (root.groups && root.groups.length)) {
    out.push(color('Checks', ANSI.bold));
    out.push(renderChecks(root));
    out.push('');
  }

  // ── thresholds (pull every metric that has one) ──────────────────────────
  const thresholdMetrics = Object.entries(metrics).filter(
    ([, m]) => m.thresholds && Object.keys(m.thresholds).length > 0,
  );
  if (thresholdMetrics.length) {
    out.push(color('Thresholds', ANSI.bold));
    for (const [name, m] of thresholdMetrics) {
      const allOk = Object.values(m.thresholds).every((t) => t.ok !== false);
      const symbol = allOk ? color('✓', ANSI.green) : color('✗', ANSI.red);
      out.push(`    ${symbol} ${color(name, ANSI.bold)}`);
      out.push(renderThresholds(m));
    }
    out.push('');
  }

  // ── all metrics (sorted: thresholded first, then alpha) ──────────────────
  out.push(color('Metrics', ANSI.bold));
  const names = Object.keys(metrics).sort((a, b) => {
    const aT = metrics[a].thresholds ? 1 : 0;
    const bT = metrics[b].thresholds ? 1 : 0;
    if (aT !== bT) return bT - aT;
    return a.localeCompare(b);
  });
  for (const name of names) {
    out.push(renderMetricLine(name, metrics[name]));
  }
  out.push('');

  return out.join('\n') + '\n';
}
