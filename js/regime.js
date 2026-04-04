/**
 * Bull Scouter - Market Regime Gauge
 * Interactive chart showing regime score, SPY price with regime coloring,
 * and forward projections vs actual outcomes.
 */

const RegimePage = (() => {
  const DATA_PATH = 'data/regime.json';
  const POL_PATH = 'data/political.json';
  let data = null;
  let polData = null;
  let mainChart = null;
  let scoreChart = null;
  let currentRange = 30;
  let filteredReadings = [];

  const REGIME_COLORS = {
    strong_risk_off: '#ef4444',
    risk_off: '#fb923c',
    neutral: '#6b7280',
    risk_on: '#4ade80',
    strong_risk_on: '#22c55e',
  };

  const REGIME_LABELS = {
    strong_risk_off: 'STRONG RISK-OFF',
    risk_off: 'RISK-OFF',
    neutral: 'NEUTRAL',
    risk_on: 'RISK-ON',
    strong_risk_on: 'STRONG RISK-ON',
  };

  // ── Init ──

  async function init() {
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => setRange(parseInt(btn.dataset.range)));
    });

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status);
      data = await resp.json();
      // Fetch political data (non-blocking)
      try {
        const polResp = await fetch(POL_PATH + '?_cb=' + Date.now());
        if (polResp.ok) polData = await polResp.json();
      } catch (_) {}
      hide('rg-loading');
      show('rg-content');
      renderStats();
      renderCharts();
      renderTable();
      renderProjections();
      renderPolitical();
    } catch (e) {
      hide('rg-loading');
      show('rg-error');
      const msg = document.getElementById('rg-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  // ── Stats bar ──

  function renderStats() {
    const c = data.current;
    if (!c) return;

    const regimeBadge = document.getElementById('rg-regime');
    if (regimeBadge) {
      regimeBadge.textContent = REGIME_LABELS[c.regime] || c.regime;
      regimeBadge.style.color = REGIME_COLORS[c.regime] || '#9ca3af';
    }

    setText('rg-score', (c.score >= 0 ? '+' : '') + c.score.toFixed(0));
    const scoreEl = document.getElementById('rg-score');
    if (scoreEl) scoreEl.style.color = c.score < -25 ? '#f87171' : c.score > 25 ? '#4ade80' : '#9ca3af';

    setText('rg-spy', c.spy ? '$' + c.spy.toFixed(2) : '—');
    setText('rg-vix', c.vix ? c.vix.toFixed(1) : '—');
    setText('rg-date', c.date || '—');

    // Historical avg returns for this regime
    const rs = (data.regime_stats || {})[c.regime] || {};
    const avg5 = rs.avg_5d;
    const avg20 = rs.avg_20d;
    setText('rg-avg5', avg5 != null ? (avg5 >= 0 ? '+' : '') + avg5 + '%' : '—');
    setText('rg-avg20', avg20 != null ? (avg20 >= 0 ? '+' : '') + avg20 + '%' : '—');
  }

  // ── Charts ──

  function filterByRange(readings, days) {
    if (days === 0) return readings;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return readings.filter(r => r.date >= cutStr);
  }

  function getTimeUnit(days) {
    if (days > 0 && days <= 14) return 'day';
    if (days > 0 && days <= 60) return 'week';
    return 'month';
  }

  // Background plugin for regime coloring
  const regimeBgPlugin = {
    id: 'regimeBg',
    beforeDraw(chart) {
      if (!filteredReadings.length) return;
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const top = yScale.top;
      const bottom = yScale.bottom;
      for (let i = 0; i < filteredReadings.length - 1; i++) {
        const x1 = xScale.getPixelForValue(filteredReadings[i].date);
        const x2 = xScale.getPixelForValue(filteredReadings[i + 1].date);
        const color = REGIME_COLORS[filteredReadings[i].regime] || '#6b7280';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r},${g},${b},0.12)`;
        ctx.fillRect(x1, top, x2 - x1, bottom - top);
      }
    }
  };

  function renderCharts() {
    const readings = data.readings || [];
    filteredReadings = filterByRange(readings, currentRange);
    const unit = getTimeUnit(currentRange);

    // Build projection from latest reading
    const current = data.current || {};
    let projAvg = [], projP25 = [], projP75 = [];
    if (current.projection && current.projection.length) {
      const last = { x: current.date, y: current.spy };
      projAvg = [last, ...current.projection.map(p => ({ x: p.date, y: p.avg }))];
      projP25 = [last, ...current.projection.map(p => ({ x: p.date, y: p.p25 }))];
      projP75 = [last, ...current.projection.map(p => ({ x: p.date, y: p.p75 }))];
    }

    // SPY price chart
    const mainCtx = document.getElementById('mainChart');
    if (mainCtx) {
      mainChart = new Chart(mainCtx, {
        type: 'line',
        data: {
          datasets: [
            { label: 'SPY', data: filteredReadings.map(r => ({ x: r.date, y: r.spy })),
              borderColor: '#e0e0e0', borderWidth: 1.5, pointRadius: 0, fill: false, order: 1 },
            { label: 'Projected (avg)', data: projAvg,
              borderColor: '#60a5fa', borderWidth: 2, borderDash: [6, 3],
              pointRadius: 3, pointBackgroundColor: '#60a5fa', fill: false, order: 0 },
            { label: '75th pctl', data: projP75,
              borderColor: 'rgba(96,165,250,0.3)', borderWidth: 1, pointRadius: 0,
              fill: '+1', backgroundColor: 'rgba(96,165,250,0.1)', order: 2 },
            { label: '25th pctl', data: projP25,
              borderColor: 'rgba(96,165,250,0.3)', borderWidth: 1, pointRadius: 0, fill: false, order: 2 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': $' + ctx.parsed.y.toFixed(2) } } },
          scales: {
            x: { type: 'time', time: { unit },
              grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', maxTicksLimit: 20 } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#6b7280', callback: v => '$' + v } },
          },
        },
        plugins: [regimeBgPlugin],
      });
    }

    // Regime score chart
    const scoreCtx = document.getElementById('scoreChart');
    if (scoreCtx) {
      scoreChart = new Chart(scoreCtx, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Score', data: filteredReadings.map(r => ({ x: r.date, y: r.score })),
            borderColor: '#9ca3af', borderWidth: 1.5, pointRadius: 0,
            fill: { target: 'origin', above: 'rgba(34,197,94,0.15)', below: 'rgba(239,68,68,0.15)' },
            segment: { borderColor: ctx => {
              const idx = ctx.p0DataIndex;
              return REGIME_COLORS[filteredReadings[idx]?.regime] || '#6b7280';
            }},
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { type: 'time', time: { unit },
              grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', maxTicksLimit: 20 } },
            y: { min: -100, max: 100,
              grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
          },
        },
      });
    }
  }

  // ── Projection accuracy table ──

  function renderProjections() {
    const tbody = document.getElementById('rg-proj-body');
    if (!tbody) return;

    // Find readings that have projections AND some actual forward data
    const readings = data.readings || [];
    const rows = [];
    for (const r of readings) {
      if (!r.projection || !r.projection.length) continue;
      // Check if we have actual prices for projection dates
      const priceByDate = {};
      for (const rd of readings) {
        if (rd.spy) priceByDate[rd.date] = rd.spy;
      }
      const firstProj = r.projection[0];
      const actual = priceByDate[firstProj.date];
      if (actual == null) continue;
      const projRet = ((firstProj.avg - r.spy) / r.spy * 100).toFixed(2);
      const actualRet = ((actual - r.spy) / r.spy * 100).toFixed(2);
      const diff = (actualRet - projRet).toFixed(2);
      rows.push({ date: r.date, regime: r.regime, spy: r.spy,
        projRet, actualRet, diff, hit: Math.abs(diff) < 2 });
    }

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-bull-muted py-4">Projection tracking starts after first week of data</td></tr>';
      return;
    }

    tbody.innerHTML = rows.slice(-10).reverse().map(r => {
      const color = REGIME_COLORS[r.regime] || '#6b7280';
      const diffClass = r.hit ? 'text-green-400' : 'text-amber-400';
      return `<tr class="border-b border-bull-border/30">
        <td class="py-2 px-3 text-sm">${r.date}</td>
        <td class="py-2 px-3"><span style="color:${color}" class="text-xs font-bold">${REGIME_LABELS[r.regime]}</span></td>
        <td class="py-2 px-3 text-sm text-bull-muted">${r.projRet >= 0 ? '+' : ''}${r.projRet}%</td>
        <td class="py-2 px-3 text-sm font-medium">${r.actualRet >= 0 ? '+' : ''}${r.actualRet}%</td>
        <td class="py-2 px-3 text-sm ${diffClass}">${r.diff >= 0 ? '+' : ''}${r.diff}%</td>
      </tr>`;
    }).join('');
  }

  // ── Stats table ──

  function renderTable() {
    const stats = data.regime_stats || {};
    const interp = {
      strong_risk_off: 'Extreme fear — strongest bounce-backs',
      risk_off: 'Stressed — historically positive forward returns',
      neutral: 'Mixed signals — baseline returns',
      risk_on: 'Calm/bullish — weaker returns',
      strong_risk_on: 'Euphoria — insufficient data',
    };

    for (const [regime, s] of Object.entries(stats)) {
      const row = document.getElementById('rs-' + regime);
      if (!row) continue;
      const avg5 = s.avg_5d != null ? (s.avg_5d >= 0 ? '+' : '') + s.avg_5d + '%' : '—';
      const avg20 = s.avg_20d != null ? (s.avg_20d >= 0 ? '+' : '') + s.avg_20d + '%' : '—';
      const c5 = s.avg_5d >= 0 ? 'text-green-400' : 'text-red-400';
      const c20 = s.avg_20d >= 0 ? 'text-green-400' : 'text-red-400';
      const color = REGIME_COLORS[regime] || '#6b7280';
      const isCurrent = regime === (data.current || {}).regime;
      const bg = isCurrent ? 'bg-white/5' : '';
      row.className = `border-b border-bull-border/30 ${bg}`;
      row.innerHTML = `
        <td class="py-2 px-3"><span style="color:${color}" class="text-xs font-bold">${REGIME_LABELS[regime]}</span></td>
        <td class="py-2 px-3 ${c5} text-sm">${avg5}</td>
        <td class="py-2 px-3 ${c20} text-sm">${avg20}</td>
        <td class="py-2 px-3 text-xs text-bull-muted">${interp[regime] || ''}</td>`;
    }
  }

  // ── Range switching ──

  function setRange(days) {
    currentRange = days;
    const readings = data.readings || [];
    filteredReadings = filterByRange(readings, days);
    const unit = getTimeUnit(days);

    if (mainChart) {
      mainChart.data.datasets[0].data = filteredReadings.map(r => ({ x: r.date, y: r.spy }));
      mainChart.options.scales.x.time.unit = unit;
      mainChart.update();
    }
    if (scoreChart) {
      scoreChart.data.datasets[0].data = filteredReadings.map(r => ({ x: r.date, y: r.score }));
      scoreChart.data.datasets[0].segment.borderColor = ctx => {
        const idx = ctx.p0DataIndex;
        return REGIME_COLORS[filteredReadings[idx]?.regime] || '#6b7280';
      };
      scoreChart.options.scales.x.time.unit = unit;
      scoreChart.update();
    }

    document.querySelectorAll('[data-range]').forEach(b => {
      b.classList.toggle('bg-bull-accent', parseInt(b.dataset.range) === days);
      b.classList.toggle('text-bull-dark', parseInt(b.dataset.range) === days);
      b.classList.toggle('font-bold', parseInt(b.dataset.range) === days);
      b.classList.toggle('bg-bull-card', parseInt(b.dataset.range) !== days);
      b.classList.toggle('text-bull-muted', parseInt(b.dataset.range) !== days);
    });
  }

  // ── Helpers ──

  function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
  function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  // ── Political Heat ──

  function renderPolitical() {
    // Heat badge in stats bar
    const heatEl = document.getElementById('rg-heat');
    if (heatEl && polData) {
      const heat = polData.heat_score || 0;
      heatEl.textContent = (heat >= 0 ? '+' : '') + heat.toFixed(2);
      heatEl.style.color = heat > 0.5 ? '#4ade80' : heat < -0.5 ? '#f87171' : '#9ca3af';
    }

    // Statement feed (top 5 high-impact, recent first)
    const feedEl = document.getElementById('pol-statements');
    if (!feedEl || !polData) return;

    const allStmts = (polData.statements || [])
      .filter(s => Math.abs(s.composite) >= 0.3);

    if (!allStmts.length) {
      feedEl.innerHTML = '<p class="text-xs text-bull-muted">No high-impact statements in the last 30 days.</p>';
      return;
    }

    const PAGE_SIZE = 5;
    let visibleCount = PAGE_SIZE;
    const officialNames = { president: 'President', fed_chair: 'Fed Chair', treasury_sec: 'Treasury Sec' };

    function renderStmtCard(s) {
      const emoji = s.direction > 0 ? '🟢' : s.direction < 0 ? '🔴' : '⚪';
      const actual = s.spy_1d != null ? `<span class="text-bull-muted"> → SPY ${s.spy_1d > 0 ? '+' : ''}${s.spy_1d}%</span>` : '';
      const time = s.time ? new Date(s.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<div class="flex items-start gap-2 py-1.5 border-b border-bull-border/20">
        <span class="text-sm shrink-0">${emoji}</span>
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-medium text-white">${officialNames[s.official] || s.official}</span>
            <span class="text-bull-muted">${time}</span>
            <span class="font-mono ${s.composite > 0 ? 'text-green-400' : s.composite < 0 ? 'text-red-400' : 'text-gray-400'}">${s.composite > 0 ? '+' : ''}${s.composite.toFixed(2)}</span>
            ${actual}
          </div>
          <p class="text-xs text-bull-muted mt-0.5 truncate">${s.summary || s.text}</p>
        </div>
      </div>`;
    }

    function renderFeed() {
      const visible = allStmts.slice(0, visibleCount);
      let html = visible.map(renderStmtCard).join('');
      if (visibleCount < allStmts.length) {
        const remaining = allStmts.length - visibleCount;
        html += `<button id="pol-show-more" class="w-full text-xs text-bull-accent hover:text-white py-2 transition-colors">Show ${Math.min(PAGE_SIZE, remaining)} more (${remaining} remaining)</button>`;
      }
      feedEl.innerHTML = html;
      const btn = document.getElementById('pol-show-more');
      if (btn) btn.addEventListener('click', () => { visibleCount += PAGE_SIZE; renderFeed(); });
    }
    renderFeed();

    // Impact chart: predicted composite vs actual SPY 1d
    const withSpy = (polData.statements || []).filter(s => s.spy_1d != null && s.composite !== 0);
    const chartEl = document.getElementById('polImpactChart');
    if (!chartEl || withSpy.length < 3) {
      if (chartEl) chartEl.parentElement.innerHTML += '<p class="text-xs text-bull-muted mt-2">Impact chart needs 3+ statements with SPY data.</p>';
      return;
    }

    new Chart(chartEl, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Predicted vs Actual',
          data: withSpy.map(s => ({ x: s.composite, y: s.spy_1d, text: s.summary || '' })),
          backgroundColor: withSpy.map(s =>
            s.official === 'president' ? 'rgba(59,130,246,0.7)' :
            s.official === 'fed_chair' ? 'rgba(249,115,22,0.7)' : 'rgba(34,197,94,0.7)'
          ),
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => [
                `Predicted: ${ctx.raw.x > 0 ? '+' : ''}${ctx.raw.x.toFixed(2)}`,
                `Actual SPY: ${ctx.raw.y > 0 ? '+' : ''}${ctx.raw.y}%`,
                ctx.raw.text.substring(0, 60),
              ]
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Predicted Composite', color: '#6b7280', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6b7280', font: { size: 9 } },
          },
          y: {
            title: { display: true, text: 'Actual SPY 1d %', color: '#6b7280', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6b7280', font: { size: 9 } },
          },
        },
      },
    });

    // Show accuracy if available
    if (polData.accuracy && polData.accuracy.n) {
      chartEl.insertAdjacentHTML('afterend',
        `<p class="text-[10px] text-bull-muted mt-1">Direction accuracy: ${polData.accuracy.direction_accuracy_1h}% (N=${polData.accuracy.n}) · <span class="text-blue-400">●</span> President <span class="text-orange-400">●</span> Fed <span class="text-green-400">●</span> Treasury</p>`);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', RegimePage.init);
