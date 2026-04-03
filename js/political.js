/**
 * Bull Scouter - Political Sentiment Page
 * Fetches data/political.json and renders heat gauge, statement feed,
 * SPY timeline chart, and prediction accuracy scatter.
 */

const Political = (() => {
  const DATA_URL = 'data/political.json';
  let pageData = null;
  let timelineChart = null;
  let scatterChart = null;

  function init() {
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(render)
      .catch(err => {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-msg').textContent = err.message;
      });
  }

  function render(data) {
    pageData = data;
    document.getElementById('loading-state').classList.add('hidden');

    // Version badge
    const vb = document.getElementById('version-badge');
    if (vb && data.version) vb.textContent = `v${data.version}`;

    // Date
    const dn = document.getElementById('pol-date-nav');
    if (dn && data.date) dn.textContent = data.date;

    const stmts = data.statements || [];
    if (!stmts.length && !data.heat_score) {
      document.getElementById('empty-state').classList.remove('hidden');
      return;
    }

    document.getElementById('content').classList.remove('hidden');

    // Stats bar
    setText('stat-count', data.statement_count_24h || stmts.length);
    setText('stat-dominant', data.dominant_official || '-');
    const dirEl = document.getElementById('stat-direction');
    if (dirEl) {
      const dir = data.dominant_direction || 'neutral';
      dirEl.textContent = dir.charAt(0).toUpperCase() + dir.slice(1);
      dirEl.className = 'font-bold ' + directionColor(dir);
    }
    const accEl = document.getElementById('stat-accuracy');
    if (accEl && data.accuracy && data.accuracy.direction_accuracy_1h != null) {
      accEl.textContent = data.accuracy.direction_accuracy_1h + '% (n=' + data.accuracy.n + ')';
      accEl.className = 'font-bold ' + (data.accuracy.direction_accuracy_1h >= 55 ? 'text-green-400' : 'text-amber-400');
    }

    // Heat gauge
    renderHeatGauge(data);

    // Statement feed
    renderFeed(stmts);

    // Charts
    renderTimelineChart(stmts);
    renderScatterChart(stmts);

    // Copy button
    const copyBtn = document.getElementById('btn-copy-political');
    if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));
  }

  function renderHeatGauge(data) {
    const score = data.heat_score || 0;
    const count = data.statement_count_24h || 0;

    document.getElementById('heat-value').textContent = score.toFixed(1);
    document.getElementById('heat-count').textContent = count;

    const valueEl = document.getElementById('heat-value');
    const labelEl = document.getElementById('heat-label');

    if (score > 0.5) {
      valueEl.style.color = '#4ade80';
      labelEl.textContent = 'Bullish';
      labelEl.style.color = '#4ade80';
    } else if (score < -0.5) {
      valueEl.style.color = '#ef4444';
      labelEl.textContent = 'Bearish';
      labelEl.style.color = '#ef4444';
    } else {
      valueEl.style.color = '#f59e0b';
      labelEl.textContent = 'Neutral';
      labelEl.style.color = '#f59e0b';
    }

    // Position marker: score range is roughly -3 to +3, map to 0-100%
    const pct = Math.min(100, Math.max(0, ((score + 3) / 6) * 100));
    document.getElementById('heat-marker').style.left = pct + '%';
  }

  function renderFeed(stmts) {
    const container = document.getElementById('statement-feed');
    if (!stmts.length) {
      container.innerHTML = '<p class="text-bull-muted text-sm text-center py-4">No statements recorded</p>';
      return;
    }

    container.innerHTML = stmts.map(s => {
      const emoji = s.composite > 0.3 ? '<span class="text-green-400">&#x1F7E2;</span>'
                  : s.composite < -0.3 ? '<span class="text-red-400">&#x1F534;</span>'
                  : '<span class="text-gray-400">&#x26AA;</span>';

      const compositeColor = s.composite > 0.3 ? 'text-green-400'
                           : s.composite < -0.3 ? 'text-red-400'
                           : 'text-amber-400';

      const sectors = (s.sectors || []).map(sec =>
        `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-bull-muted">${esc(sec)}</span>`
      ).join(' ');

      const spyHtml = s.spy_1h != null
        ? `<span class="text-xs ${s.spy_1h >= 0 ? 'text-green-400' : 'text-red-400'}">SPY 1h: ${s.spy_1h >= 0 ? '+' : ''}${s.spy_1h.toFixed(2)}%</span>`
        : '';

      const spyDayHtml = s.spy_1d != null
        ? `<span class="text-xs ${s.spy_1d >= 0 ? 'text-green-400' : 'text-red-400'} ml-2">1d: ${s.spy_1d >= 0 ? '+' : ''}${s.spy_1d.toFixed(2)}%</span>`
        : '';

      const timeStr = s.time ? formatTime(s.time) : '';

      return `
        <div class="stmt-card">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 text-sm">
              ${emoji}
              <span class="font-semibold text-white">${esc(s.official)}</span>
              <span class="text-[10px] text-bull-muted">${esc(s.source)}</span>
              <span class="text-[10px] text-white/30">${timeStr}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-xs font-mono font-bold ${compositeColor}">${s.composite >= 0 ? '+' : ''}${s.composite.toFixed(2)}</span>
            </div>
          </div>
          <p class="text-sm text-gray-300 mt-1.5 leading-relaxed">"${esc(truncate(s.text || s.summary, 200))}"</p>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            ${sectors}
            ${spyHtml}${spyDayHtml}
            ${s.urgency && s.urgency !== 'vague' ? `<span class="text-[10px] text-amber-400 font-medium">${esc(s.urgency)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function renderTimelineChart(stmts) {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;

    const withSpy = stmts.filter(s => s.spy_1h != null && s.time);

    if (!withSpy.length) {
      ctx.parentElement.innerHTML = '<p class="text-bull-muted text-sm text-center py-20">No SPY reaction data yet</p>';
      return;
    }

    const points = withSpy.map(s => ({
      x: new Date(s.time),
      y: s.spy_1h,
      r: Math.max(4, Math.min(14, Math.abs(s.composite) * 8)),
      official: s.official,
      text: truncate(s.text || s.summary, 80),
      composite: s.composite,
      spy_1h: s.spy_1h,
    }));

    const colors = points.map(p => p.y >= 0 ? 'rgba(74, 222, 128, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    const borderColors = points.map(p => p.y >= 0 ? '#4ade80' : '#ef4444');

    timelineChart = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [{
          data: points,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => {
                const p = items[0].raw;
                return p.official + ' - ' + formatTime(p.x);
              },
              label: item => {
                const p = item.raw;
                return [
                  '"' + p.text + '"',
                  'Predicted: ' + (p.composite >= 0 ? '+' : '') + p.composite.toFixed(2),
                  'SPY 1h: ' + (p.spy_1h >= 0 ? '+' : '') + p.spy_1h.toFixed(2) + '%',
                ];
              }
            },
            bodyFont: { size: 11 },
            titleFont: { size: 12 },
            maxWidth: 350,
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day', tooltipFormat: 'MMM d, yyyy HH:mm' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'SPY % Move (1h)', color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: v => v.toFixed(2) + '%',
            },
          }
        }
      }
    });
  }

  function renderScatterChart(stmts) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;

    const withSpy = stmts.filter(s => s.spy_1h != null && s.composite !== 0);

    if (!withSpy.length) {
      ctx.parentElement.innerHTML = '<p class="text-bull-muted text-sm text-center py-20">Need more data for accuracy chart</p>';
      return;
    }

    // Assign colors by official
    const officials = [...new Set(withSpy.map(s => s.official))];
    const palette = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#22c55e', '#06b6d4'];
    const officialColors = {};
    officials.forEach((o, i) => { officialColors[o] = palette[i % palette.length]; });

    const points = withSpy.map(s => ({
      x: s.composite,
      y: s.spy_1h,
      official: s.official,
    }));

    const colors = points.map(p => officialColors[p.official]);

    // Compute direction accuracy
    let correct = 0;
    withSpy.forEach(s => {
      const predDir = s.composite > 0 ? 1 : -1;
      const actDir = s.spy_1h > 0 ? 1 : -1;
      if (predDir === actDir) correct++;
    });
    const accuracy = ((correct / withSpy.length) * 100).toFixed(1);

    scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: points,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      },
      plugins: [{
        // Draw diagonal reference line
        id: 'diagonalLine',
        afterDraw(chart) {
          const { ctx: c, scales: { x, y } } = chart;
          const minVal = Math.max(x.min, y.min);
          const maxVal = Math.min(x.max, y.max);

          c.save();
          c.strokeStyle = 'rgba(255,255,255,0.15)';
          c.lineWidth = 1;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.moveTo(x.getPixelForValue(minVal), y.getPixelForValue(minVal));
          c.lineTo(x.getPixelForValue(maxVal), y.getPixelForValue(maxVal));
          c.stroke();

          // Zero lines
          c.strokeStyle = 'rgba(255,255,255,0.1)';
          c.setLineDash([]);
          c.beginPath();
          c.moveTo(x.getPixelForValue(0), y.top);
          c.lineTo(x.getPixelForValue(0), y.bottom);
          c.stroke();
          c.beginPath();
          c.moveTo(x.left, y.getPixelForValue(0));
          c.lineTo(x.right, y.getPixelForValue(0));
          c.stroke();
          c.restore();
        }
      }],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => items[0].raw.official,
              label: item => {
                const p = item.raw;
                return [
                  'Predicted: ' + (p.x >= 0 ? '+' : '') + p.x.toFixed(2),
                  'Actual SPY 1h: ' + (p.y >= 0 ? '+' : '') + p.y.toFixed(2) + '%',
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Predicted Composite', color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Actual SPY % (1h)', color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: v => v.toFixed(2) + '%',
            },
          }
        }
      }
    });

    // Stats below chart
    const statsEl = document.getElementById('scatter-stats');
    if (statsEl) {
      const legendHtml = officials.map(o =>
        `<span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:${officialColors[o]}"></span>${esc(o)}</span>`
      ).join('&nbsp;&nbsp;');
      statsEl.innerHTML = `Direction accuracy: <span class="font-bold ${accuracy >= 55 ? 'text-green-400' : 'text-amber-400'}">${accuracy}%</span> (n=${withSpy.length})&nbsp;&nbsp;&middot;&nbsp;&nbsp;${legendHtml}`;
    }
  }

  function copyData(copyBtn) {
    if (!pageData) return;
    const stmts = pageData.statements || [];
    if (!stmts.length) return;

    const lines = [];
    lines.push(`Bull Scouter Political Sentiment - ${pageData.date || 'today'}`);
    lines.push(`Heat Score: ${pageData.heat_score || 0} | Statements: ${pageData.statement_count_24h || stmts.length} | Direction: ${pageData.dominant_direction || 'neutral'}`);
    if (pageData.accuracy && pageData.accuracy.direction_accuracy_1h != null) {
      lines.push(`Direction Accuracy (1h): ${pageData.accuracy.direction_accuracy_1h}% (n=${pageData.accuracy.n})`);
    }
    lines.push('');

    stmts.forEach(s => {
      const emoji = s.composite > 0.3 ? '+' : s.composite < -0.3 ? '-' : '~';
      const parts = [`[${emoji}] ${s.official}`];
      if (s.time) parts.push(formatTime(s.time));
      parts.push(`Composite: ${s.composite >= 0 ? '+' : ''}${s.composite.toFixed(2)}`);
      if (s.spy_1h != null) parts.push(`SPY 1h: ${s.spy_1h >= 0 ? '+' : ''}${s.spy_1h.toFixed(2)}%`);
      if (s.sectors && s.sectors.length) parts.push(`Sectors: ${s.sectors.join(', ')}`);
      lines.push(parts.join(' | '));
      lines.push(`  "${truncate(s.text || s.summary, 150)}"`);
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy for Claude'; }, 2000);
    });
  }

  // Helpers
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function truncate(s, maxLen) {
    if (!s) return '';
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
  }

  function formatTime(t) {
    if (!t) return '';
    try {
      const d = new Date(t);
      if (isNaN(d.getTime())) return t;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
             d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t;
    }
  }

  function directionColor(dir) {
    if (dir === 'bullish') return 'text-green-400';
    if (dir === 'bearish') return 'text-red-400';
    return 'text-amber-400';
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init };
})();
