/**
 * Bull Scouter - Scan History
 * Loads daily scan JSON files and renders a timeline of scan summaries.
 */
(function () {
  'use strict';

  // ── Config ──
  const DATA_BASE = 'data/';
  const LOOKBACK_DAYS = 30;

  // ── DOM refs ──
  const $loading = document.getElementById('loading-state');
  const $error = document.getElementById('error-state');
  const $errorMsg = document.getElementById('error-msg');
  const $empty = document.getElementById('empty-state');
  const $cards = document.getElementById('history-cards');
  const $dateRange = document.getElementById('stat-date-range');
  const $scanDays = document.getElementById('stat-scan-days');
  const $avgBuy = document.getElementById('stat-avg-buy');
  const $avgTotal = document.getElementById('stat-avg-total');
  const $versionBadge = document.getElementById('version-badge');
  const $copyBtn = document.getElementById('btn-copy-history');

  // ── Chart state ──
  let trendChart = null;

  // ── Helpers ──
  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDateFull(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function generateDates(count) {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ds = `${yyyy}-${mm}-${dd}`;
      if (!isWeekend(ds)) {
        dates.push(ds);
      }
    }
    return dates;
  }

  function recColor(rec) {
    switch ((rec || '').toUpperCase()) {
      case 'BUY': return '#00ff88';
      case 'WATCHLIST': return '#f59e0b';
      case 'MOMENTUM': return '#6b7280';
      default: return '#6b7280';
    }
  }

  function recClass(rec) {
    switch ((rec || '').toUpperCase()) {
      case 'BUY': return 'buy';
      case 'WATCHLIST': return 'watchlist';
      case 'MOMENTUM': return 'momentum';
      default: return 'momentum';
    }
  }

  function profileLabel(p) {
    const map = {
      recovery: 'Recovery',
      acceleration: 'Accel',
      growth: 'Growth',
      quality_growth: 'GrowthQ',
      value: 'Value',
      contrarian: 'Contrarian',
    };
    return map[p] || p || '-';
  }

  // ── Data loading ──
  async function loadAllDays() {
    // First load latest.json to get current scan date and version
    let latestDate = null;
    let latestVersion = null;
    try {
      const resp = await fetch(DATA_BASE + 'latest.json');
      if (resp.ok) {
        const latest = await resp.json();
        latestDate = latest.scan_date;
        latestVersion = latest.version;
      }
    } catch (e) { /* ignore */ }

    // Generate candidate dates (last 30 calendar days, skipping weekends)
    const candidateDates = generateDates(LOOKBACK_DAYS + 15); // extra buffer for weekends

    // Try loading each date's JSON
    const fetches = candidateDates.slice(0, 40).map(async (dateStr) => {
      try {
        const url = DATA_BASE + dateStr + '.json';
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const data = await resp.json();
        return { date: dateStr, data };
      } catch (e) {
        return null;
      }
    });

    const results = await Promise.allSettled(fetches);
    const days = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first

    return { days, latestVersion };
  }

  // ── Stats extraction ──
  function extractStats(data) {
    const stats = data.stats || {};
    const opps = data.opportunities || [];

    const buyCount = stats.buy_signals != null ? stats.buy_signals : opps.filter(o => o.recommendation === 'BUY').length;
    const watchlistCount = stats.watchlist_signals != null ? stats.watchlist_signals : opps.filter(o => o.recommendation === 'WATCHLIST').length;
    const momentumCount = stats.momentum_signals != null ? stats.momentum_signals : opps.filter(o => o.recommendation === 'MOMENTUM').length;
    const totalOpps = opps.length;
    const scores = opps.map(o => o.score).filter(s => typeof s === 'number');
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return { buyCount, watchlistCount, momentumCount, totalOpps, avgScore };
  }

  function getTopTickers(data, n) {
    const opps = (data.opportunities || []).slice();
    // Sort: BUY first, then by score desc
    const order = { BUY: 0, WATCHLIST: 1, MOMENTUM: 2 };
    opps.sort((a, b) => {
      const oa = order[a.recommendation] ?? 3;
      const ob = order[b.recommendation] ?? 3;
      if (oa !== ob) return oa - ob;
      return (b.score || 0) - (a.score || 0);
    });
    return opps.slice(0, n);
  }

  // ── Chart rendering ──
  function renderTrendChart(days) {
    const canvas = document.getElementById('chart-history-trend');
    if (!canvas || days.length === 0) return;

    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }

    // Chronological order for chart
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map(d => formatDateShort(d.date));
    const buyData = sorted.map(d => extractStats(d.data).buyCount);
    const totalData = sorted.map(d => extractStats(d.data).totalOpps);

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 220);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');

    // Set dark theme defaults
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = '#1f2937';
    Chart.defaults.font.family = 'ui-monospace, monospace';
    Chart.defaults.font.size = 11;

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'BUY Signals',
            data: buyData,
            borderColor: '#00ff88',
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#00ff88',
            fill: true,
            tension: 0.2,
          },
          {
            label: 'Total Opportunities',
            data: totalData,
            borderColor: '#64748b',
            borderWidth: 1.5,
            pointRadius: 2,
            pointBackgroundColor: '#64748b',
            fill: false,
            tension: 0.2,
            borderDash: [4, 2],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, padding: 16 },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        scales: {
          x: {
            grid: { color: '#1f2937' },
            ticks: { maxRotation: 45, font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#1f2937' },
            ticks: { stepSize: 1, font: { size: 10 } },
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
      }
    });
  }

  // ── Card rendering ──
  function renderDayCard(dayObj, index) {
    const { date, data } = dayObj;
    const stats = extractStats(data);
    const version = data.version || '-';
    const scanTime = data.scan_time || '';
    const top3 = getTopTickers(data, 3);
    const allOpps = data.opportunities || [];

    const card = document.createElement('div');
    card.className = 'glass-card history-card rounded-xl p-4 transition-all';
    card.style.animationDelay = `${index * 0.04}s`;

    // Header row: date + version + time
    let headerHTML = `
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold font-mono text-white">${date}</span>
          <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-bull-muted">${formatDateFull(date)}</span>
        </div>
        <div class="flex items-center gap-2">
          ${scanTime ? `<span class="text-xs font-mono text-white/40">${scanTime}</span>` : ''}
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bull-accent/10 text-bull-accent">v${version}</span>
        </div>
      </div>`;

    // Stats row
    let statsHTML = `
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono mb-3 pb-3 border-b border-white/5">
        <span class="text-white/60">${stats.totalOpps} signals</span>
        <span class="text-white/10">|</span>
        <span class="text-bull-accent font-bold">${stats.buyCount} BUY</span>
        <span class="text-white/10">|</span>
        <span class="text-amber-400">${stats.watchlistCount} WATCHLIST</span>
        <span class="text-white/10">|</span>
        <span class="text-white/40">${stats.momentumCount} MOM</span>
        <span class="text-white/10">|</span>
        <span class="text-bull-muted">avg ${stats.avgScore}</span>
      </div>`;

    // Top 3 tickers
    let topHTML = '';
    if (top3.length > 0) {
      topHTML = '<div class="space-y-1.5">';
      for (const opp of top3) {
        const rc = recClass(opp.recommendation);
        topHTML += `
          <div class="flex items-center gap-2 text-sm">
            <a href="ticker.html?t=${opp.ticker}" class="font-mono font-bold text-white hover:text-bull-accent transition-colors w-16">${opp.ticker}</a>
            <span class="rec-badge ${rc}">${opp.recommendation}</span>
            <span class="font-mono text-xs" style="color:${recColor(opp.recommendation)}">${opp.score}</span>
            <span class="profile-badge ${opp.profile || ''} text-[10px]">${profileLabel(opp.profile)}</span>
            ${opp.confidence != null ? `<span class="text-[10px] font-mono text-white/30">conf ${opp.confidence}</span>` : ''}
            ${opp.price != null ? `<span class="text-[10px] font-mono text-white/20 ml-auto">$${opp.price.toFixed(2)}</span>` : ''}
          </div>`;
      }
      topHTML += '</div>';
    } else {
      topHTML = '<p class="text-xs text-white/20 italic">No opportunities this day</p>';
    }

    // Expandable full list
    let expandHTML = '';
    if (allOpps.length > 3) {
      const cardId = 'expand-' + date;
      expandHTML += `
        <div class="mt-3 pt-2 border-t border-white/5">
          <button class="expand-btn" onclick="toggleExpand('${cardId}', this)">Show all ${allOpps.length} opportunities</button>
          <div id="${cardId}" class="expanded-list mt-2 space-y-1">`;

      // Sort same as top3
      const sortedAll = [...allOpps].sort((a, b) => {
        const order = { BUY: 0, WATCHLIST: 1, MOMENTUM: 2 };
        const oa = order[a.recommendation] ?? 3;
        const ob = order[b.recommendation] ?? 3;
        if (oa !== ob) return oa - ob;
        return (b.score || 0) - (a.score || 0);
      });

      for (const opp of sortedAll) {
        const rc = recClass(opp.recommendation);
        expandHTML += `
          <div class="flex items-center gap-2 text-xs">
            <a href="ticker.html?t=${opp.ticker}" class="font-mono font-semibold text-white/80 hover:text-bull-accent transition-colors w-14">${opp.ticker}</a>
            <span class="rec-badge ${rc}" style="font-size:0.55rem">${opp.recommendation}</span>
            <span class="font-mono" style="color:${recColor(opp.recommendation)};font-size:0.65rem">${opp.score}</span>
            <span class="profile-badge ${opp.profile || ''}" style="font-size:0.55rem">${profileLabel(opp.profile)}</span>
            ${opp.confidence != null ? `<span class="font-mono text-white/20" style="font-size:0.55rem">c${opp.confidence}</span>` : ''}
            ${opp.price != null ? `<span class="font-mono text-white/15 ml-auto" style="font-size:0.55rem">$${opp.price.toFixed(2)}</span>` : ''}
          </div>`;
      }

      expandHTML += '</div></div>';
    }

    card.innerHTML = headerHTML + statsHTML + topHTML + expandHTML;
    return card;
  }

  // ── Stats bar ──
  function populateStatsBar(days) {
    if (days.length === 0) {
      $dateRange.textContent = '-';
      $scanDays.textContent = '0';
      $avgBuy.textContent = '0';
      $avgTotal.textContent = '0';
      return;
    }

    const sortedAsc = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const oldest = sortedAsc[0].date;
    const newest = sortedAsc[sortedAsc.length - 1].date;

    $dateRange.textContent = formatDateShort(oldest) + ' \u2014 ' + formatDateShort(newest) + ', ' + newest.slice(0, 4);
    $scanDays.textContent = days.length;

    const totalBuy = days.reduce((sum, d) => sum + extractStats(d.data).buyCount, 0);
    const totalOpps = days.reduce((sum, d) => sum + extractStats(d.data).totalOpps, 0);
    $avgBuy.textContent = (totalBuy / days.length).toFixed(1);
    $avgTotal.textContent = (totalOpps / days.length).toFixed(1);
  }

  // ── Copy to clipboard ──
  function buildCopyText(days) {
    const lines = ['BULL SCOUTER - SCAN HISTORY', ''];
    const sortedDesc = [...days].sort((a, b) => b.date.localeCompare(a.date));

    for (const { date, data } of sortedDesc) {
      const stats = extractStats(data);
      const version = data.version || '-';
      lines.push(`=== ${date} (v${version}) ===`);
      lines.push(`Signals: ${stats.totalOpps} | BUY: ${stats.buyCount} | WATCHLIST: ${stats.watchlistCount} | MOM: ${stats.momentumCount} | Avg Score: ${stats.avgScore}`);

      const opps = (data.opportunities || []).slice().sort((a, b) => {
        const order = { BUY: 0, WATCHLIST: 1, MOMENTUM: 2 };
        const oa = order[a.recommendation] ?? 3;
        const ob = order[b.recommendation] ?? 3;
        if (oa !== ob) return oa - ob;
        return (b.score || 0) - (a.score || 0);
      });

      for (const opp of opps) {
        const conf = opp.confidence != null ? ` conf:${opp.confidence}` : '';
        const price = opp.price != null ? ` $${opp.price.toFixed(2)}` : '';
        lines.push(`  ${opp.ticker.padEnd(8)} ${opp.recommendation.padEnd(10)} ${String(opp.score).padStart(3)} ${profileLabel(opp.profile).padEnd(10)}${conf}${price}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Expand/collapse ──
  window.toggleExpand = function (id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.toggle('open');
    btn.textContent = isOpen ? 'Hide' : btn.dataset.label || 'Show all';
  };

  // ── Main ──
  async function init() {
    try {
      const { days, latestVersion } = await loadAllDays();

      // Set version badge
      if (latestVersion && $versionBadge) {
        $versionBadge.textContent = 'v' + latestVersion;
      }

      $loading.classList.add('hidden');

      if (days.length === 0) {
        $empty.classList.remove('hidden');
        return;
      }

      // Populate stats bar
      populateStatsBar(days);

      // Render trend chart
      renderTrendChart(days);

      // Render daily cards (newest first)
      const sortedDesc = [...days].sort((a, b) => b.date.localeCompare(a.date));
      for (let i = 0; i < sortedDesc.length; i++) {
        const card = renderDayCard(sortedDesc[i], i);
        $cards.appendChild(card);
      }

      // Store expand labels
      document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.dataset.label = btn.textContent;
      });

      // Copy button
      $copyBtn.addEventListener('click', () => {
        const text = buildCopyText(days);
        navigator.clipboard.writeText(text).then(() => {
          $copyBtn.classList.add('copied');
          const label = $copyBtn.querySelector('.copy-label');
          if (label) label.textContent = 'Copied!';
          setTimeout(() => {
            $copyBtn.classList.remove('copied');
            if (label) label.textContent = 'Copy';
          }, 2000);
        });
      });

    } catch (err) {
      $loading.classList.add('hidden');
      $error.classList.remove('hidden');
      $errorMsg.textContent = err.message || 'Unknown error';
      console.error('History load error:', err);
    }
  }

  init();
})();
