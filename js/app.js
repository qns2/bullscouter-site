/**
 * Bull Scouter - Main Application
 * Fetches JSON data and renders the dashboard.
 */

const App = (() => {
  const DATA_BASE = 'data';
  const HISTORY_DAYS = 14;

  // Breakdown key → display label
  const BREAKDOWN_LABELS = {
    catalyst: 'Catalyst', social: 'Social', growth_quality: 'Growth',
    margin_quality: 'Margin', fallen_angel: 'Fallen Angel',
    fundamental: 'Fundamental', technical: 'Technical',
    news_boost: 'News', claude_enhancement: 'AI',
    momentum_bonus: 'Momentum', breakout_pattern_bonus: 'Breakout',
    catalyst_pattern_bonus: 'Cat Pattern', fundamental_risk: 'Risk',
    narrative_overlap: 'Overlap', pre_revenue_discount: 'Pre-Rev',
    quality_persistence: 'Quality', controversy_penalty: 'Controversy',
    thesis_decay: 'Decay', revenue_momentum: 'Rev Momentum',
    margin_expansion: 'Margins', price_trend: 'Price/RS',
    volume_expansion: 'Volume', conviction: 'Conviction',
    social_discovery: 'Discovery',
  };

  // Profile display names
  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
  };

  // Catalyst type labels
  const CATALYST_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings', pdufa: 'PDUFA',
    partnership: 'Partnership', approval: 'Approval', data_readout: 'Data',
    contract: 'Contract', ipo_lockup: 'Lockup', merger: 'M&A',
  };

  let historyCache = {};

  // ── Data fetching ──

  async function fetchJSON(path) {
    const resp = await fetch(`${DATA_BASE}/${path}`);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async function loadLatest() {
    return fetchJSON('latest.json');
  }

  async function loadIndex() {
    return fetchJSON('index.json');
  }

  async function loadDay(dateStr) {
    if (historyCache[dateStr]) return historyCache[dateStr];
    const data = await fetchJSON(`${dateStr}.json`);
    historyCache[dateStr] = data;
    return data;
  }

  // ── Rendering helpers ──

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function confColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  function formatBreakdown(breakdown) {
    if (!breakdown) return '';
    return Object.entries(breakdown)
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => {
        const label = BREAKDOWN_LABELS[k] || k;
        const cls = v > 0 ? 'positive' : v < 0 ? 'negative' : '';
        const prefix = v > 0 ? '+' : '';
        return `<span class="chip ${cls}">${label} ${prefix}${v}</span>`;
      })
      .join(' ');
  }

  function formatEvents(events) {
    if (!events || !events.length) return '';
    return events.slice(0, 3).map(ev => {
      const cls = ev.direction === 'bull' ? 'bull' : ev.direction === 'bear' ? 'bear' : '';
      const label = CATALYST_LABELS[ev.type] || ev.type || '?';
      const dateStr = ev.date ? ` ${ev.date}` : '';
      const summary = ev.summary ? ` &middot; ${ev.summary}` : '';
      return `<span class="event-pill ${cls}" title="${ev.summary || ''}">${label}${dateStr}</span>`;
    }).join(' ');
  }

  function catalystCountdown(days) {
    if (days === null || days === undefined) return '';
    if (days <= 0) return '<span class="text-red-400">Imminent</span>';
    if (days <= 7) return `<span class="text-amber-400">${days}d</span>`;
    if (days <= 30) return `<span class="text-amber-500">${days}d</span>`;
    return `<span class="text-gray-400">${days}d</span>`;
  }

  // ── Card rendering ──

  function trendIcon(dir) {
    if (dir === 'improving') return '<span class="text-green-400 font-semibold">&#x2191; improving</span>';
    if (dir === 'declining') return '<span class="text-red-400 font-semibold">&#x2193; declining</span>';
    if (dir === 'stable') return '<span class="text-gray-500">&#x2192; stable</span>';
    return '<span class="text-gray-600">&#x2728; new</span>';
  }

  function aggHtml(agg) {
    if (!agg || !agg.avg_score) return '';
    const parts = [`Avg: <b>${agg.avg_score}</b>`, `Peak: <b>${agg.peak_score}</b>`];
    if (agg.buy_pct > 0) parts.push(`BUY: ${agg.buy_pct}%`);
    if (agg.price_change_pct !== undefined) {
      const c = agg.price_change_pct >= 0 ? 'text-green-400' : 'text-red-400';
      parts.push(`Price: <span class="${c}">${agg.price_change_pct > 0 ? '+' : ''}${agg.price_change_pct}%</span>`);
    }
    return `<div class="text-xs text-gray-500 mt-1 px-2 py-1 bg-gray-800/50 rounded font-mono">${parts.join(' &middot; ')}</div>`;
  }

  function renderCard(opp) {
    const rec = opp.recommendation.toLowerCase();
    const card = el('div', `opp-card ${rec}`);

    const profileLabel = PROFILE_LABELS[opp.profile] || opp.profile;
    const catalystLabel = CATALYST_LABELS[opp.catalyst_type] || opp.catalyst_type || '';
    const catalystDate = opp.catalyst_date || '';
    const countdown = catalystCountdown(opp.days_to_catalyst);
    const squeezeBadge = opp.squeeze_potential
      ? '<span class="chip" style="color:#f472b6;background:rgba(244,114,182,0.15)">Squeeze</span>'
      : '';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <div>
          <span class="text-lg font-bold font-mono">${opp.ticker}</span>
          <span class="profile-badge ${rec === 'buy' ? opp.profile : rec} ml-2">${profileLabel}</span>
          <span class="text-xs text-gray-500 ml-1">T${opp.tier}</span>
          ${trendIcon(opp.trend_direction)}
        </div>
        <div class="score-badge ${rec}">${opp.score > 100 ? '100+' : opp.score}</div>
      </div>
      <div class="flex items-center gap-3 text-xs text-gray-400 mb-2">
        <span class="font-mono">$${opp.price.toFixed(2)}</span>
        ${opp.market_cap_fmt ? `<span>${opp.market_cap_fmt}</span>` : ''}
        ${opp.down_from_high_pct ? `<span class="text-red-400">-${opp.down_from_high_pct}% from high</span>` : ''}
        ${opp.short_interest_pct ? `<span>SI ${opp.short_interest_pct.toFixed(1)}%</span>` : ''}
        ${squeezeBadge}
      </div>
      ${catalystLabel ? `
        <div class="flex items-center gap-2 text-xs mb-2">
          <span class="text-gray-500">${catalystLabel}</span>
          ${catalystDate ? `<span class="text-gray-600 font-mono">${catalystDate}</span>` : ''}
          ${countdown ? `<span class="catalyst-countdown">${countdown}</span>` : ''}
        </div>
      ` : ''}
      <div class="conf-bar mb-2">
        <div class="conf-bar-fill" style="width:${Math.min(opp.confidence, 100)}%;background:${confColor(opp.confidence)}"></div>
      </div>
      <div class="text-xs text-gray-600 mb-2">Confidence: ${opp.confidence}/100</div>
      <div class="flex flex-wrap gap-1 mb-2">${formatBreakdown(opp.breakdown)}</div>
      ${aggHtml(opp.aggregate)}
      ${opp.events && opp.events.length ? `<div class="flex flex-wrap gap-1 mb-2 mt-2">${formatEvents(opp.events)}</div>` : ''}
      ${opp.hysteresis_note ? `<div class="text-xs text-amber-600 italic">${opp.hysteresis_note}</div>` : ''}
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-600">${opp.scans_tracked} scans${opp.first_detected ? ` &middot; since ${opp.first_detected.slice(0, 10)}` : ''}</span>
        <div class="sparkline-container" style="width:80px;height:30px;">
          <canvas id="spark-${opp.ticker}" width="80" height="30"></canvas>
        </div>
      </div>
    `;

    return card;
  }

  function renderMomentumRow(opp) {
    const trend = opp.score_trend || [];
    const arrow = trend.length >= 2
      ? (trend[trend.length - 1] > trend[trend.length - 2] ? '&#x2191;' : trend[trend.length - 1] < trend[trend.length - 2] ? '&#x2193;' : '&#x2192;')
      : '';
    const profileLabel = PROFILE_LABELS[opp.profile] || opp.profile;
    const catalystLabel = CATALYST_LABELS[opp.catalyst_type] || opp.catalyst_type || '-';

    return `<tr>
      <td class="font-bold">${opp.ticker}</td>
      <td>${opp.score}</td>
      <td>$${opp.price.toFixed(2)}</td>
      <td><span class="profile-badge ${opp.profile}">${profileLabel}</span></td>
      <td class="text-gray-500">${catalystLabel}</td>
      <td class="text-gray-500">${trend.slice(-5).join(' &rarr; ')} ${arrow}</td>
    </tr>`;
  }

  // ── Main rendering ──

  function renderToday(data) {
    const opps = data.opportunities || [];

    // Stats
    const s = data.stats || {};
    document.getElementById('stat-total').textContent = s.total_tickers || 0;
    document.getElementById('stat-buy').textContent = s.buy_signals || 0;
    document.getElementById('stat-watch').textContent = s.watchlist_signals || 0;
    document.getElementById('stat-momentum').textContent = s.momentum_signals || 0;
    document.getElementById('stat-t1').textContent = s.tier1_qualified || 0;
    document.getElementById('stat-t2').textContent = s.tier2_qualified || 0;
    document.getElementById('stat-growth').textContent = s.growth_qualified || 0;
    document.getElementById('stat-accel').textContent = s.accel_qualified || 0;

    const dateLabel = data.scan_date || '';
    const timeLabel = data.scan_time ? ` ${data.scan_time}` : '';
    document.getElementById('scan-date').textContent = dateLabel + timeLabel;
    document.getElementById('version-badge').textContent = data.version ? `v${data.version}` : '';

    const buys = opps.filter(o => o.recommendation === 'BUY');
    const watches = opps.filter(o => o.recommendation === 'WATCHLIST');
    const momentum = opps.filter(o => o.recommendation === 'MOMENTUM');

    // BUY cards
    const buySection = document.getElementById('section-buy');
    const buyContainer = document.getElementById('cards-buy');
    buyContainer.innerHTML = '';
    if (buys.length) {
      buySection.classList.remove('hidden');
      buys.forEach(opp => buyContainer.appendChild(renderCard(opp)));
    }

    // WATCHLIST cards
    const watchSection = document.getElementById('section-watchlist');
    const watchContainer = document.getElementById('cards-watchlist');
    watchContainer.innerHTML = '';
    if (watches.length) {
      watchSection.classList.remove('hidden');
      watches.forEach(opp => watchContainer.appendChild(renderCard(opp)));
    }

    // MOMENTUM table
    const momSection = document.getElementById('section-momentum');
    const momBody = document.getElementById('tbody-momentum');
    momBody.innerHTML = '';
    if (momentum.length) {
      momSection.classList.remove('hidden');
      momBody.innerHTML = momentum.map(renderMomentumRow).join('');
    }

    // Empty state
    if (!opps.length) {
      document.getElementById('empty-state').classList.remove('hidden');
    }

    // Hide loading
    document.getElementById('loading-state').classList.add('hidden');

    // Render sparklines after cards are in DOM
    requestAnimationFrame(() => {
      [...buys, ...watches].forEach(opp => {
        const canvas = document.getElementById(`spark-${opp.ticker}`);
        if (canvas && opp.score_trend && opp.score_trend.length >= 2) {
          const color = opp.recommendation === 'BUY' ? '#22c55e' : '#f59e0b';
          Charts.sparkline(canvas, opp.score_trend, color);
        }
      });
    });
  }

  // ── History view ──

  async function renderHistory() {
    let index;
    try {
      index = await loadIndex();
    } catch {
      return;
    }

    const dates = (index.dates || []).slice(0, HISTORY_DAYS);
    if (!dates.length) return;

    // Load all available days in parallel
    const dayPromises = dates.map(d => loadDay(d).catch(() => null));
    const days = (await Promise.all(dayPromises)).filter(Boolean);

    // Signal count chart
    const signalData = days.map(d => ({
      date: d.scan_date,
      buy: d.stats?.buy_signals || 0,
      watchlist: d.stats?.watchlist_signals || 0,
      momentum: d.stats?.momentum_signals || 0,
    })).reverse();
    Charts.signalCountChart('chart-signals', signalData);

    // Score distribution chart
    const scoreData = days.map(d => ({
      date: d.scan_date,
      scores: (d.opportunities || []).map(o => o.score),
    })).reverse();
    Charts.scoreDistChart('chart-scores', scoreData);

    // Date picker
    const picker = document.getElementById('date-picker');
    picker.innerHTML = '';
    dates.forEach(d => {
      const btn = el('button', 'date-pill', d);
      btn.addEventListener('click', () => showPastScan(d, btn));
      picker.appendChild(btn);
    });
  }

  async function showPastScan(dateStr, btnEl) {
    // Toggle active state
    document.querySelectorAll('#date-picker .date-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    try {
      const data = await loadDay(dateStr);
      const container = document.getElementById('past-scan-cards');
      const view = document.getElementById('past-scan-view');
      container.innerHTML = '';

      const opps = (data.opportunities || []).filter(o => o.recommendation !== 'MOMENTUM');
      if (!opps.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No signals this day</p>';
      } else {
        opps.forEach(opp => container.appendChild(renderCard(opp)));
      }
      view.classList.remove('hidden');

      // Sparklines
      requestAnimationFrame(() => {
        opps.forEach(opp => {
          const canvas = document.getElementById(`spark-${opp.ticker}`);
          if (canvas && opp.score_trend && opp.score_trend.length >= 2) {
            const color = opp.recommendation === 'BUY' ? '#22c55e' : '#f59e0b';
            Charts.sparkline(canvas, opp.score_trend, color);
          }
        });
      });
    } catch (e) {
      console.error('Failed to load past scan:', e);
    }
  }

  // ── Ticker search ──

  async function searchTicker(ticker) {
    ticker = ticker.toUpperCase().trim();
    if (!ticker) return;

    let index;
    try {
      index = await loadIndex();
    } catch {
      return;
    }

    const dates = index.dates || [];
    const entries = [];

    for (const d of dates) {
      try {
        const data = await loadDay(d);
        const match = (data.opportunities || []).find(o => o.ticker === ticker);
        if (match) {
          entries.push({ date: d, score: match.score, recommendation: match.recommendation, price: match.price });
        }
      } catch {
        continue;
      }
    }

    const resultDiv = document.getElementById('ticker-result');
    const tableDiv = document.getElementById('ticker-history-table');

    if (!entries.length) {
      resultDiv.classList.remove('hidden');
      tableDiv.innerHTML = `<p class="text-gray-500 text-sm">${ticker} not found in recent scans</p>`;
      Charts.destroyChart('chart-ticker');
      return;
    }

    entries.reverse(); // chronological
    resultDiv.classList.remove('hidden');

    // Chart
    Charts.tickerTrajectory('chart-ticker', entries);

    // Table
    tableDiv.innerHTML = `
      <table class="w-full text-xs font-mono">
        <thead><tr class="text-gray-500 text-left">
          <th class="pb-1 pr-3">Date</th><th class="pb-1 pr-3">Score</th>
          <th class="pb-1 pr-3">Price</th><th class="pb-1">Signal</th>
        </tr></thead>
        <tbody>${entries.map(e => `
          <tr class="border-b border-gray-800">
            <td class="py-1 pr-3">${e.date}</td>
            <td class="py-1 pr-3">${e.score}</td>
            <td class="py-1 pr-3">$${e.price.toFixed(2)}</td>
            <td class="py-1"><span class="${e.recommendation === 'BUY' ? 'text-green-400' : e.recommendation === 'WATCHLIST' ? 'text-amber-400' : 'text-gray-500'}">${e.recommendation}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  }

  // ── Tab switching ──

  function setupTabs() {
    const tabToday = document.getElementById('tab-today');
    const tabHistory = document.getElementById('tab-history');
    const viewToday = document.getElementById('view-today');
    const viewHistory = document.getElementById('view-history');

    tabToday.addEventListener('click', () => {
      tabToday.classList.add('tab-active');
      tabToday.classList.remove('text-gray-400');
      tabHistory.classList.remove('tab-active');
      tabHistory.classList.add('text-gray-400');
      viewToday.classList.remove('hidden');
      viewHistory.classList.add('hidden');
    });

    tabHistory.addEventListener('click', async () => {
      tabHistory.classList.add('tab-active');
      tabHistory.classList.remove('text-gray-400');
      tabToday.classList.remove('tab-active');
      tabToday.classList.add('text-gray-400');
      viewHistory.classList.remove('hidden');
      viewToday.classList.add('hidden');
      await renderHistory();
    });
  }

  // ── Init ──

  async function init() {
    setupTabs();

    // Ticker search
    const searchBtn = document.getElementById('btn-search');
    const searchInput = document.getElementById('ticker-search');
    searchBtn.addEventListener('click', () => searchTicker(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchTicker(searchInput.value);
    });

    // Load today's data
    try {
      const data = await loadLatest();
      renderToday(data);
    } catch (e) {
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('error-state').classList.remove('hidden');
      document.getElementById('error-msg').textContent = e.message;
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { searchTicker };
})();
