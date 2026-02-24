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
    social_discovery: 'Discovery', acceleration_influence: 'Accel→FA',
    // Track C: Value + Growth Quality
    profitability: 'Profitability', fcf: 'FCF', discount: '52w Discount',
    sector_panic: 'Panic Signal', pe_discount: 'PE Discount',
    no_dilution: 'No Dilution', revenue_growth_q: 'Rev Growth',
    gross_margins_q: 'Gross Margins', nrr: 'NRR', tam: 'TAM',
    rule40: 'Rule of 40', sbc: 'SBC', convergence_bonus: 'Convergence',
    overvalued_cap: 'Overvalued Cap', bankruptcy_risk_cap: 'Bankruptcy Risk',
    low_upside: 'Low Upside', insider_sell_penalty: 'Insider Selling',
    insider_buy_boost: 'Insider Buying', thesis_feedback: 'AI Thesis',
    neg_revenue_cap: 'Neg Revenue', low_margin: 'Low Margin',
    si_no_catalyst: 'SI No Catalyst',
    controversy_insider_compound: 'Controversy+Insider',
    quality_auto_remove: 'Weak Quality',
  };

  // Profile display names
  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
    value: 'Value', quality_growth: 'Quality Growth',
  };

  // Catalyst type labels
  const CATALYST_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings', pdufa: 'PDUFA',
    partnership: 'Partnership', approval: 'Approval', data_readout: 'Data',
    contract: 'Contract', ipo_lockup: 'Lockup', merger: 'M&A',
  };

  let historyCache = {};
  let currentData = { buys: [], watches: [], momentum: [] };
  let currentSort = { buy: 'score', watchlist: 'score' };
  let currentFilters = { profile: 'all', newOnly: false };

  // ── Data fetching ──

  async function fetchJSON(path) {
    const cacheBust = `_cb=${Date.now()}`;
    const sep = path.includes('?') ? '&' : '?';
    const resp = await fetch(`${DATA_BASE}/${path}${sep}${cacheBust}`);
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

  function fundamentalsHtml(f) {
    if (!f || !Object.keys(f).length) return '';
    const parts = [];
    if (f.pe) {
      const c = f.pe < 25 ? 'text-green-400' : f.pe < 50 ? 'text-amber-400' : 'text-red-400';
      parts.push(`<b>P/E:</b> <span class="${c}">${f.pe}</span>`);
    }
    if (f.rev_growth_pct !== undefined) {
      const c = f.rev_growth_pct > 0 ? 'text-green-400' : 'text-red-400';
      parts.push(`<b>Rev:</b> <span class="${c}">${f.rev_growth_pct > 0 ? '+' : ''}${f.rev_growth_pct}%</span>`);
    }
    if (f.margin_pct !== undefined) {
      const c = f.margin_pct > 0 ? 'text-green-400' : 'text-red-400';
      parts.push(`<b>Margin:</b> <span class="${c}">${f.margin_pct}%</span>`);
    }
    if (f.target_price) {
      const c = f.target_upside_pct >= 0 ? 'text-green-400' : 'text-red-400';
      parts.push(`<b>Target:</b> $${f.target_price.toFixed(0)} (<span class="${c}">${f.target_upside_pct > 0 ? '+' : ''}${f.target_upside_pct}%</span>)`);
    }
    if (!parts.length) return '';
    return `<div class="text-xs text-gray-400 mt-2 font-mono">${parts.join(' <span class="text-gray-700">|</span> ')}</div>`;
  }

  function badgesHtml(opp) {
    const parts = [];
    // Congress
    if (opp.congress && opp.congress.signal) {
      const bi = opp.congress.bipartisan ? ' bipartisan' : '';
      parts.push(`<span class="chip" style="color:#93c5fd;background:rgba(59,130,246,0.15)">Congress ${opp.congress.signal} (${opp.congress.buyers} buyers${bi})</span>`);
    }
    // Insider
    if (opp.insider && opp.insider.signal) {
      const c = opp.insider.signal === 'STRONG' ? 'color:#4ade80;background:rgba(34,197,94,0.15)' : 'color:#fb923c;background:rgba(251,146,60,0.15)';
      parts.push(`<span class="chip" style="${c}">Insider ${opp.insider.signal} (${opp.insider.buys}B/${opp.insider.sells}S)</span>`);
    }
    // Analyst distribution or upgrade/downgrade fallback
    if (opp.analyst && opp.analyst.distribution && opp.analyst.distribution.total >= 3) {
      const dist = opp.analyst.distribution;
      const buyN = (dist.strong_buy || 0) + (dist.buy || 0);
      const holdN = dist.hold || 0;
      const sellN = (dist.sell || 0) + (dist.strong_sell || 0);
      parts.push(`<span class="chip" style="color:#60a5fa;background:rgba(59,130,246,0.15)">${buyN} Buy &middot; ${holdN} Hold &middot; ${sellN} Sell</span>`);
    } else if (opp.analyst && (opp.analyst.upgrades || opp.analyst.downgrades)) {
      const u = opp.analyst.upgrades, d = opp.analyst.downgrades;
      if (u > d) {
        parts.push(`<span class="chip" style="color:#4ade80;background:rgba(34,197,94,0.15)">Analyst &#x2191;${u}${d ? ` &#x2193;${d}` : ''}</span>`);
      } else if (d > u) {
        parts.push(`<span class="chip" style="color:#f87171;background:rgba(248,113,113,0.15)">Analyst &#x2193;${d}${u ? ` &#x2191;${u}` : ''}</span>`);
      }
    }
    // Squeeze
    if (opp.squeeze_potential) {
      const reason = opp.squeeze_reasons && opp.squeeze_reasons[0] ? ` (${opp.squeeze_reasons[0]})` : '';
      parts.push(`<span class="chip" style="color:#f472b6;background:rgba(244,114,182,0.15)">Squeeze${reason}</span>`);
    }
    // Trajectory
    if (opp.trajectory && opp.trajectory.match) {
      const t = opp.trajectory;
      parts.push(`<span class="chip" style="color:#c4b5fd;background:rgba(168,85,247,0.15)">${t.phase}: ${t.match} (r=${t.correlation}, ~${Math.round(t.months_est)}mo)</span>`);
    }
    if (opp.trajectory && opp.trajectory.catalyst_match) {
      const t = opp.trajectory;
      parts.push(`<span class="chip" style="color:#fb923c;background:rgba(251,146,60,0.15)">${t.catalyst_phase}: ${t.catalyst_match} (r=${t.catalyst_correlation})</span>`);
    }
    if (!parts.length) return '';
    return `<div class="flex flex-wrap gap-1 mt-2">${parts.join('')}</div>`;
  }

  function checklistHtml(opp) {
    const checklist = opp.checklist;
    if (!checklist || !Object.keys(checklist).length) return '';
    const framework = opp.quality_framework === 'value' ? 'Value' : opp.quality_framework === 'quality_growth' ? 'Growth Quality' : opp.quality_framework || '';
    const score = opp.checklist_score || 0;
    const statusIcon = { pass: '\u2705', partial: '\u26A0\uFE0F', fail: '\u274C' };
    const items = Object.entries(checklist).map(([name, status]) =>
      `<span class="text-xs mr-2">${statusIcon[status] || '?'} ${name}</span>`
    ).join('');
    const convergence = opp.convergence_signal
      ? '<span class="chip" style="color:#fb923c;background:rgba(251,146,60,0.15)">Convergence: Social + Financial</span>'
      : '';
    return `<div class="text-xs text-gray-400 mt-2 px-2 py-1 border border-gray-700 rounded">
      <span class="font-semibold">${framework} (${score}/6)</span>: ${items}${convergence}
    </div>`;
  }

  function thesisHtml(thesis, ticker) {
    if (!thesis) return '';
    const id = `thesis-${ticker}`;
    return `<div class="mt-2">
      <button onclick="document.getElementById('${id}').classList.toggle('hidden');this.querySelector('span').textContent=document.getElementById('${id}').classList.contains('hidden')?'▸':'▾'" class="text-xs text-green-400/80 hover:text-green-300 font-medium cursor-pointer"><span>▸</span> AI Thesis</button>
      <div id="${id}" class="hidden mt-1 px-3 py-2 text-xs text-green-200/80 bg-green-900/20 border border-green-800/30 rounded italic leading-relaxed">${thesis}</div>
    </div>`;
  }

  function catalystCountdown(days) {
    if (days === null || days === undefined) return '';
    if (days <= 0) return '<span class="text-red-400">Imminent</span>';
    if (days <= 7) return `<span class="text-amber-400">${days}d</span>`;
    if (days <= 30) return `<span class="text-amber-500">${days}d</span>`;
    return `<span class="text-gray-400">${days}d</span>`;
  }

  // ── Sorting ──

  function sortOpps(opps, key) {
    const sorted = [...opps];
    if (key === 'confidence') {
      sorted.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } else if (key === 'satellite') {
      // Filter to satellite-worthy stocks (score >= 50), then sort descending
      const satFiltered = sorted.filter(o => (o.satellite_score || 0) >= 50);
      satFiltered.sort((a, b) => (b.satellite_score || 0) - (a.satellite_score || 0));
      return satFiltered;
    } else if (key === 'insider') {
      // Sort by insider conviction: buy_boost > 0 first, then sell_penalty, by score within tier
      sorted.sort((a, b) => {
        const aBoost = (a.breakdown || {}).insider_buy_boost || 0;
        const bBoost = (b.breakdown || {}).insider_buy_boost || 0;
        const aSell = (a.breakdown || {}).insider_sell_penalty || 0;
        const bSell = (b.breakdown || {}).insider_sell_penalty || 0;
        const aInsider = aBoost + aSell;
        const bInsider = bBoost + bSell;
        if (aInsider !== bInsider) return bInsider - aInsider;
        return (b.score || 0) - (a.score || 0);
      });
    } else if (key === 'entry') {
      sorted.sort((a, b) => {
        const aScore = (a.entry_timing || {}).score || 0;
        const bScore = (b.entry_timing || {}).score || 0;
        return bScore - aScore;
      });
    } else if (key === 'catalyst') {
      // Soonest catalyst first; nulls to the bottom
      sorted.sort((a, b) => {
        const da = a.days_to_catalyst;
        const db = b.days_to_catalyst;
        if (da == null && db == null) return (b.score || 0) - (a.score || 0);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    } else {
      // Default: score descending
      sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    return sorted;
  }

  function rerenderSection(section, opps) {
    const containerId = section === 'buy' ? 'cards-buy' : 'cards-watchlist';
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    opps.forEach(opp => container.appendChild(renderCard(opp)));
    // Re-draw sparklines
    requestAnimationFrame(() => {
      opps.forEach(opp => {
        const canvas = document.getElementById(`spark-${opp.ticker}`);
        if (canvas && opp.score_trend && opp.score_trend.length >= 2) {
          const color = opp.recommendation === 'BUY' ? '#22c55e' : '#f59e0b';
          Charts.sparkline(canvas, opp.score_trend, color);
        }
      });
    });
  }

  // ── Filtering ──

  function filterOpps(opps) {
    let result = opps;
    if (currentFilters.profile !== 'all') {
      result = result.filter(o => o.profile === currentFilters.profile);
    }
    if (currentFilters.newOnly) {
      result = result.filter(o => (o.scans_tracked || 0) <= 1);
    }
    return result;
  }

  function applyFiltersAndSort() {
    // BUY
    const filteredBuys = filterOpps(currentData.buys);
    const sortedBuys = sortOpps(filteredBuys, currentSort.buy);
    rerenderSection('buy', sortedBuys);
    const buySection = document.getElementById('section-buy');
    if (filteredBuys.length) buySection.classList.remove('hidden');
    else buySection.classList.add('hidden');

    // WATCHLIST
    const filteredWatches = filterOpps(currentData.watches);
    const sortedWatches = sortOpps(filteredWatches, currentSort.watchlist);
    rerenderSection('watchlist', sortedWatches);
    const watchSection = document.getElementById('section-watchlist');
    if (filteredWatches.length) watchSection.classList.remove('hidden');
    else watchSection.classList.add('hidden');

    // MOMENTUM table
    const filteredMom = filterOpps(currentData.momentum);
    const momSection = document.getElementById('section-momentum');
    const momBody = document.getElementById('tbody-momentum');
    momBody.innerHTML = '';
    if (filteredMom.length) {
      momSection.classList.remove('hidden');
      momBody.innerHTML = filteredMom.map(renderMomentumRow).join('');
    } else {
      momSection.classList.add('hidden');
    }

    // Empty state
    const total = filteredBuys.length + filteredWatches.length + filteredMom.length;
    const emptyState = document.getElementById('empty-state');
    if (total === 0 && (currentData.buys.length + currentData.watches.length + currentData.momentum.length) > 0) {
      emptyState.innerHTML = '<p class="text-gray-500 text-lg">No matches for current filters</p>';
      emptyState.classList.remove('hidden');
    } else if (total > 0) {
      emptyState.classList.add('hidden');
    }
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
          <a href="https://finance.yahoo.com/quote/${opp.ticker}" target="_blank" rel="noopener" class="text-lg font-bold font-mono hover:text-green-400 transition-colors">${opp.ticker}</a>
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
      <div class="text-xs text-gray-400 mb-2">Confidence: <span class="${opp.confidence >= 70 ? 'text-green-400' : opp.confidence >= 50 ? 'text-amber-400' : 'text-red-400'}">${opp.confidence}</span>/100${opp.satellite_fit && opp.satellite_fit !== 1.0 ? ` <span class="text-gray-500">|</span> Satellite: <span class="font-bold ${opp.satellite_score >= 50 ? 'text-green-400' : opp.satellite_score >= 25 ? 'text-amber-400' : 'text-red-400'}">${opp.satellite_score}</span><span class="text-gray-500">/100 (${opp.satellite_fit}x)</span>` : ''}${opp.entry_timing ? ` <span class="text-gray-500">|</span> Entry: <span class="font-bold ${opp.entry_timing.label === 'Enter' ? 'text-green-400' : opp.entry_timing.label === 'Wait' ? 'text-amber-400' : 'text-red-400'}">${opp.entry_timing.score}</span><span class="text-gray-500"> ${opp.entry_timing.label}${opp.entry_timing.label === 'Wait' && opp.entry_timing.recommended_entry ? ' @ $' + opp.entry_timing.recommended_entry.toFixed(2) : ''}</span>` : ''}</div>
      <div class="flex flex-wrap gap-1 mb-2">${formatBreakdown(opp.breakdown)}</div>
      ${aggHtml(opp.aggregate)}
      ${fundamentalsHtml(opp.fundamentals)}
      ${badgesHtml(opp)}
      ${checklistHtml(opp)}
      ${opp.events && opp.events.length ? `<div class="flex flex-wrap gap-1 mb-2 mt-2">${formatEvents(opp.events)}</div>` : ''}
      ${thesisHtml(opp.ai_thesis, opp.ticker)}
      ${opp.hysteresis_note ? `<div class="text-xs text-amber-600 italic mt-1">${opp.hysteresis_note}</div>` : ''}
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
      <td class="font-bold"><a href="https://finance.yahoo.com/quote/${opp.ticker}" target="_blank" rel="noopener" class="hover:text-green-400 transition-colors">${opp.ticker}</a></td>
      <td>${opp.score}</td>
      <td>$${opp.price.toFixed(2)}</td>
      <td><span class="profile-badge ${opp.profile}">${profileLabel}</span></td>
      <td class="text-gray-500">${catalystLabel}</td>
      <td class="text-gray-500">${trend.slice(-5).join(' &rarr; ')} ${arrow}</td>
    </tr>`;
  }

  // ── Main rendering ──

  function renderToday(data) {
    currentData.latestPayload = data;
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

    // Store for re-sorting
    currentData.buys = buys;
    currentData.watches = watches;
    currentData.momentum = momentum;
    currentSort.buy = 'score';
    currentSort.watchlist = 'score';

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
    const tabs = [
      { btn: document.getElementById('tab-today'), view: document.getElementById('view-today') },
      { btn: document.getElementById('tab-history'), view: document.getElementById('view-history') },
      { btn: document.getElementById('tab-portfolio'), view: document.getElementById('view-portfolio') },
    ];

    function activateTab(idx) {
      tabs.forEach((t, i) => {
        if (i === idx) {
          t.btn.classList.add('tab-active');
          t.btn.classList.remove('text-gray-400');
          t.view.classList.remove('hidden');
        } else {
          t.btn.classList.remove('tab-active');
          t.btn.classList.add('text-gray-400');
          t.view.classList.add('hidden');
        }
      });
    }

    tabs[0].btn.addEventListener('click', () => activateTab(0));
    tabs[1].btn.addEventListener('click', async () => {
      activateTab(1);
      await renderHistory();
    });
    tabs[2].btn.addEventListener('click', () => {
      activateTab(2);
      renderPortfolio();
    });
  }

  // ── Portfolio view ──

  function renderPortfolio() {
    if (!currentData.latestPayload) return;
    const pp = currentData.latestPayload.paper_portfolio;

    if (!pp) {
      document.getElementById('pp-empty').classList.remove('hidden');
      return;
    }

    const stats = pp.stats || {};
    const positions = pp.positions || [];

    // Stats cards
    const pnlColor = stats.total_pnl_eur >= 0 ? 'text-green-400' : 'text-red-400';
    const pendingCount = stats.total_pending || 0;
    document.getElementById('pp-open').textContent = (stats.total_open || 0) + (pendingCount ? ` (+${pendingCount} pending)` : '');
    const pnlEl = document.getElementById('pp-pnl');
    pnlEl.textContent = `${stats.total_pnl_eur >= 0 ? '+' : ''}${(stats.total_pnl_eur || 0).toFixed(0)}`;
    pnlEl.className = `text-2xl font-bold font-mono ${pnlColor}`;
    document.getElementById('pp-winrate').textContent = stats.total_closed > 0 ? `${stats.win_rate}%` : '-';
    const avgRet = stats.avg_open_return || 0;
    const avgRetEl = document.getElementById('pp-avgret');
    avgRetEl.textContent = `${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(1)}%`;
    avgRetEl.className = `text-2xl font-bold font-mono ${avgRet >= 0 ? 'text-green-400' : 'text-red-400'}`;

    // Timing analysis
    const tc = stats.timing_correlation;
    if (tc) {
      document.getElementById('pp-timing-analysis').classList.remove('hidden');
      const hiColor = tc.high_timing_avg >= 0 ? 'text-green-400' : 'text-red-400';
      const loColor = tc.low_timing_avg >= 0 ? 'text-green-400' : 'text-red-400';
      document.getElementById('pp-timing-content').innerHTML =
        `High timing (${tc.high_count} pos): <span class="${hiColor}">${tc.high_timing_avg >= 0 ? '+' : ''}${tc.high_timing_avg}%</span> avg ` +
        `<span class="text-gray-600">|</span> ` +
        `Low timing (${tc.low_count} pos): <span class="${loColor}">${tc.low_timing_avg >= 0 ? '+' : ''}${tc.low_timing_avg}%</span> avg`;
    }

    // Positions table
    const tbody = document.getElementById('pp-positions');
    if (!positions.length) {
      document.getElementById('pp-empty').classList.remove('hidden');
      tbody.innerHTML = '';
      return;
    }

    document.getElementById('pp-empty').classList.add('hidden');
    tbody.innerHTML = positions.map(p => {
      const isPending = p.status === 'pending';
      const retColor = p.return_pct >= 0 ? 'text-green-400' : 'text-red-400';
      const pnlColor = p.pnl_eur >= 0 ? 'text-green-400' : 'text-red-400';
      const timingColor = p.entry_timing_score >= 70 ? 'text-green-400' : p.entry_timing_score >= 40 ? 'text-amber-400' : 'text-red-400';
      const statusBadge = isPending
        ? `<span class="text-xs bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded ml-1">Pending @ $${(p.trigger_price || 0).toFixed(2)}</span>`
        : '';
      return `<tr class="border-b border-gray-800${isPending ? ' opacity-70' : ''}">
        <td class="py-2 pr-4 font-bold"><a href="https://finance.yahoo.com/quote/${p.ticker}" target="_blank" rel="noopener" class="hover:text-green-400">${p.ticker}</a>${statusBadge}</td>
        <td class="py-2 pr-4">${isPending ? '-' : '$' + p.entry_price.toFixed(2)}</td>
        <td class="py-2 pr-4">${p.current_price ? '$' + p.current_price.toFixed(2) : '-'}</td>
        <td class="py-2 pr-4 ${isPending ? 'text-gray-500' : retColor}">${isPending ? '-' : (p.return_pct >= 0 ? '+' : '') + p.return_pct.toFixed(1) + '%'}</td>
        <td class="py-2 pr-4 ${isPending ? 'text-gray-500' : pnlColor}">${isPending ? '-' : (p.pnl_eur >= 0 ? '+' : '') + p.pnl_eur.toFixed(0)}</td>
        <td class="py-2 pr-4 ${timingColor}">${p.entry_timing_score}</td>
        <td class="py-2 pr-4">${isPending ? (p.pending_scans || 0) + ' scans' : p.holding_days + 'd'}</td>
        <td class="py-2">${isPending ? '-' : '<span class="text-green-400">+' + (p.peak_return_pct || 0).toFixed(0) + '%</span> / <span class="text-red-400">' + (p.trough_return_pct || 0).toFixed(0) + '%</span>'}</td>
      </tr>`;
    }).join('');
  }

  // ── Init ──

  async function init() {
    setupTabs();

    // Sort buttons
    document.querySelectorAll('.sort-bar').forEach(bar => {
      const section = bar.dataset.section; // 'buy' or 'watchlist'
      bar.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.sort;
          if (currentSort[section] === key) return;
          currentSort[section] = key;
          bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFiltersAndSort();
        });
      });
    });

    // Profile filter buttons
    document.querySelectorAll('#filter-bar .filter-btn[data-profile]').forEach(btn => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile;
        if (currentFilters.profile === profile) return;
        currentFilters.profile = profile;
        document.querySelectorAll('#filter-bar .filter-btn[data-profile]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFiltersAndSort();
      });
    });

    // New only toggle
    document.getElementById('btn-new-only').addEventListener('click', (e) => {
      currentFilters.newOnly = !currentFilters.newOnly;
      e.currentTarget.classList.toggle('active', currentFilters.newOnly);
      applyFiltersAndSort();
    });

    // Ticker search
    const searchBtn = document.getElementById('btn-search');
    const searchInput = document.getElementById('ticker-search');
    searchBtn.addEventListener('click', () => searchTicker(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchTicker(searchInput.value);
    });

    // Copy signals to clipboard
    document.getElementById('btn-copy-signals').addEventListener('click', () => {
      const signals = [...(currentData.buys || []), ...(currentData.watches || [])];
      if (!signals.length) return;
      const lines = signals.map(o => {
        const parts = [`${o.ticker} (${o.recommendation})`];
        if (o.price) parts.push(`$${Number(o.price).toFixed(2)}`);
        if (o.score) parts.push(`Score: ${o.score}`);
        if (o.profile) parts.push(`Profile: ${o.profile}`);
        if (o.confidence) parts.push(`Conf: ${o.confidence}`);
        if (o.market_cap_fmt) parts.push(`MCap: ${o.market_cap_fmt}`);
        if (o.down_from_high_pct) parts.push(`Down: ${Number(o.down_from_high_pct).toFixed(1)}%`);
        const f = o.fundamentals || {};
        if (f.pe) parts.push(`PE: ${f.pe}`);
        if (f.revenue_growth) parts.push(`RevGr: ${f.revenue_growth}`);
        if (f.margin) parts.push(`Margin: ${f.margin}`);
        if (f.target_upside) parts.push(`Upside: ${f.target_upside}`);
        if (o.catalyst_type) {
          let cat = o.catalyst_type;
          if (o.days_to_catalyst != null) cat += ` (${o.days_to_catalyst}d)`;
          parts.push(`Cat: ${cat}`);
        }
        if (o.short_interest_pct) parts.push(`SI: ${Number(o.short_interest_pct).toFixed(1)}%`);
        if (o.ai_thesis) parts.push(`\n  Thesis: ${o.ai_thesis}`);
        return parts.join(' | ');
      });
      const header = `Bull Scouter Signals — ${currentData.latestPayload?.scan_date || 'today'}\n` +
        `${currentData.buys?.length || 0} BUY + ${currentData.watches?.length || 0} WATCHLIST\n\n`;
      const text = header + lines.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy-signals');
        const label = btn.querySelector('.copy-label');
        btn.classList.add('copied');
        label.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); label.textContent = 'Copy for Claude'; }, 2000);
      });
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
