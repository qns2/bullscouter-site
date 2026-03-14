/**
 * Bull Scouter - Ticker Detail Page
 * Loads scoring history for a specific ticker from daily JSON files.
 */

const TickerDetail = (() => {
  const DATA_BASE = 'data';
  const HISTORY_DAYS = 30;

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
    social_discovery: 'Discovery', acceleration_influence: 'Accel\u2192FA',
    profitability: 'Profitability', fcf: 'FCF', discount: '52w Discount',
    sector_panic: 'Panic Signal', pe_discount: 'PE Discount',
    no_dilution: 'No Dilution', revenue_growth_q: 'Rev Growth',
    gross_margins_q: 'Gross Margins', nrr: 'NRR', tam: 'TAM',
    rule40: 'Rule of 40', sbc: 'SBC',
    earnings_revision: 'EPS Revision', short_pressure: 'Short Pressure',
    convergence_bonus: 'Convergence',
    overvalued_cap: 'Overvalued Cap', bankruptcy_risk_cap: 'Bankruptcy Risk',
    low_upside: 'Low Upside', insider_sell_penalty: 'Insider Selling',
    insider_buy_boost: 'Insider Buying', thesis_feedback: 'AI Thesis',
    neg_revenue_cap: 'Neg Revenue', low_margin: 'Low Margin',
    si_no_catalyst: 'SI No Catalyst',
    controversy_insider_compound: 'Controversy+Insider',
    quality_auto_remove: 'Weak Quality',
  };

  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
    value: 'Value', quality_growth: 'Quality Growth',
  };

  let scoreChart = null;

  // ── Helpers ──

  function getTickerParam() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('t') || '').toUpperCase().trim();
  }

  function formatDate(dateStr) {
    // dateStr is YYYY-MM-DD
    return dateStr;
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function generateDateRange(startDate, days) {
    const dates = [];
    const d = new Date(startDate);
    let count = 0;
    while (count < days) {
      d.setDate(d.getDate() - 1);
      if (!isWeekend(d)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        count++;
      }
    }
    return dates;
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function recColor(rec) {
    if (rec === 'BUY') return '#00ff88';
    if (rec === 'WATCHLIST') return '#f59e0b';
    return '#6b7280';
  }

  function confColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  // ── Data loading ──

  async function fetchJSON(path) {
    const resp = await fetch(`${DATA_BASE}/${path}?_cb=${Date.now()}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function loadTickerHistory(ticker) {
    // Load latest.json first to get scan_date and version
    const latest = await fetchJSON('latest.json');
    if (!latest) throw new Error('Could not load latest.json');

    // Set version badge
    const vb = document.getElementById('version-badge');
    if (vb && latest.version) vb.textContent = `v${latest.version}`;

    const scanDate = latest.scan_date; // YYYY-MM-DD

    // Collect entries: start with latest.json
    const entries = [];
    const latestMatch = (latest.opportunities || []).find(o => o.ticker === ticker);
    if (latestMatch) {
      entries.push({
        date: scanDate,
        score: latestMatch.score,
        confidence: latestMatch.confidence || 0,
        recommendation: latestMatch.recommendation,
        profile: latestMatch.profile,
        price: latestMatch.price,
        breakdown: latestMatch.breakdown,
        market_cap_fmt: latestMatch.market_cap_fmt,
        down_from_high_pct: latestMatch.down_from_high_pct,
      });
    }

    // Generate past weekday dates
    const pastDates = generateDateRange(scanDate, HISTORY_DAYS);

    // Filter out the scanDate itself (already loaded from latest.json)
    const datesToLoad = pastDates.filter(d => d !== scanDate);

    // Load all past days in parallel, tolerating 404s
    const results = await Promise.allSettled(
      datesToLoad.map(async (dateStr) => {
        const data = await fetchJSON(`${dateStr}.json`);
        if (!data) return null;
        const match = (data.opportunities || []).find(o => o.ticker === ticker);
        if (!match) return null;
        return {
          date: dateStr,
          score: match.score,
          confidence: match.confidence || 0,
          recommendation: match.recommendation,
          profile: match.profile,
          price: match.price,
          breakdown: match.breakdown,
          market_cap_fmt: match.market_cap_fmt,
          down_from_high_pct: match.down_from_high_pct,
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        entries.push(result.value);
      }
    }

    // Sort chronologically (oldest first)
    entries.sort((a, b) => a.date.localeCompare(b.date));

    return { entries, latest, latestMatch };
  }

  // ── Rendering ──

  function renderHeader(ticker, entry) {
    const symbolEl = document.getElementById('ticker-symbol');
    symbolEl.textContent = ticker;
    symbolEl.href = `https://finance.yahoo.com/quote/${ticker}`;

    document.title = `Bull Scouter - ${ticker}`;

    if (entry.price != null) {
      document.getElementById('ticker-price').textContent = `$${entry.price.toFixed(2)}`;
    }

    // Recommendation badge
    const recBadge = document.getElementById('ticker-rec-badge');
    const rec = entry.recommendation;
    const recCls = rec === 'BUY' ? 'buy' : rec === 'WATCHLIST' ? 'watchlist' : 'momentum';
    recBadge.innerHTML = `<span class="score-badge ${recCls}" style="height:1.75rem;min-width:auto;font-size:0.75rem;padding:0 0.5rem">${esc(rec)}</span>`;

    // Profile badge
    const profileBadge = document.getElementById('ticker-profile-badge');
    if (entry.profile) {
      const profileLabel = PROFILE_LABELS[entry.profile] || entry.profile;
      profileBadge.innerHTML = `<span class="profile-badge ${entry.profile}">${esc(profileLabel)}</span>`;
    }

    // Market cap
    if (entry.market_cap_fmt) {
      document.getElementById('ticker-mcap').textContent = entry.market_cap_fmt;
    }

    // Down from high
    if (entry.down_from_high_pct) {
      document.getElementById('ticker-down').textContent = `-${entry.down_from_high_pct}% from high`;
    }
  }

  function renderChart(entries) {
    if (entries.length < 1) return;

    const ctx = document.getElementById('chart-score-history');
    if (!ctx) return;

    if (scoreChart) {
      scoreChart.destroy();
      scoreChart = null;
    }

    const labels = entries.map(e => e.date);
    const scores = entries.map(e => e.score);
    const confidences = entries.map(e => e.confidence);

    scoreChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Score',
            data: scores,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#00ff88',
            pointBorderColor: '#00ff88',
            pointHoverRadius: 5,
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Confidence',
            data: confidences,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 2,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#3b82f6',
            pointHoverRadius: 4,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#64748b',
              font: { size: 10, family: 'ui-monospace, monospace' },
              maxRotation: 45,
              maxTicksLimit: 10,
            },
            border: {
              color: 'rgba(255, 255, 255, 0.08)',
            },
          },
          y: {
            min: 0,
            max: 120,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#64748b',
              font: { size: 10, family: 'ui-monospace, monospace' },
              stepSize: 20,
            },
            border: {
              color: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#94a3b8',
              font: { size: 11 },
              usePointStyle: true,
              pointStyle: 'line',
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(20, 22, 26, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            titleFont: { family: 'ui-monospace, monospace', size: 11 },
            bodyFont: { family: 'ui-monospace, monospace', size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
      },
    });
  }

  function renderBreakdown(breakdown) {
    if (!breakdown || !Object.keys(breakdown).length) return;

    const section = document.getElementById('section-breakdown');
    const container = document.getElementById('breakdown-chips');

    const entries = Object.entries(breakdown)
      .filter(([_, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (!entries.length) return;

    section.classList.remove('hidden');
    container.innerHTML = entries.map(([k, v]) => {
      const label = BREAKDOWN_LABELS[k] || k;
      const cls = v > 0 ? 'positive' : 'negative';
      const prefix = v > 0 ? '+' : '';
      return `<span class="chip ${cls}">${esc(label)} ${prefix}${v}</span>`;
    }).join('');
  }

  function renderNews(latestMatch, ticker) {
    const section = document.getElementById('section-news');
    if (!section) return;

    const events = latestMatch.events || [];
    const thesis = latestMatch.ai_thesis || '';
    if (!events.length && !thesis) return;

    section.classList.remove('hidden');
    let html = '';

    // AI thesis
    if (thesis) {
      html += `<div class="text-sm text-white/80 mb-4 leading-relaxed">${esc(thesis)}</div>`;
    }

    // Events with source links
    if (events.length) {
      html += '<div class="space-y-2">';
      for (const ev of events) {
        const dirColor = ev.direction === 'bull' ? '#4ade80' : ev.direction === 'bear' ? '#f87171' : '#9ca3af';
        const typeLabel = (ev.type || '').replace(/_/g, ' ');
        const date = ev.date ? `<span class="text-bull-muted text-xs ml-2">${ev.date}</span>` : '';
        html += `<div class="border-l-2 pl-3 py-1" style="border-color:${dirColor}">`;
        html += `<div class="text-xs font-semibold uppercase tracking-wider" style="color:${dirColor}">${esc(typeLabel)}${date}</div>`;
        html += `<div class="text-sm text-white/70">${esc(ev.summary)}</div>`;
        if (ev.sources && ev.sources.length) {
          html += '<div class="mt-1">';
          for (const src of ev.sources) {
            html += `<a href="${esc(src.url)}" target="_blank" rel="noopener" class="text-xs text-bull-blue hover:underline mr-3">${esc(src.title || src.url)}</a>`;
          }
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    document.getElementById('news-content').innerHTML = html;
  }

  function renderHistoryTable(entries) {
    const tbody = document.getElementById('tbody-history');

    // Show most recent first
    const reversed = [...entries].reverse();

    tbody.innerHTML = reversed.map(e => {
      const recStyle = `color:${recColor(e.recommendation)}`;
      const confStyle = `color:${confColor(e.confidence)}`;
      const profileLabel = PROFILE_LABELS[e.profile] || e.profile || '-';
      const profileCls = e.profile || '';

      return `<tr>
        <td>${esc(e.date)}</td>
        <td class="font-bold">${e.score}</td>
        <td><span style="${confStyle}">${e.confidence}</span></td>
        <td><span style="${recStyle};font-weight:600">${esc(e.recommendation)}</span></td>
        <td><span class="profile-badge ${profileCls}">${esc(profileLabel)}</span></td>
        <td>${e.price != null ? '$' + e.price.toFixed(2) : '-'}</td>
      </tr>`;
    }).join('');
  }

  // ── Init ──

  async function init() {
    const ticker = getTickerParam();

    if (!ticker) {
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('notfound-state').classList.remove('hidden');
      document.getElementById('notfound-msg').textContent = 'No ticker specified. Use ?t=AAPL in the URL.';
      return;
    }

    try {
      const { entries, latest, latestMatch } = await loadTickerHistory(ticker);

      document.getElementById('loading-state').classList.add('hidden');

      if (!entries.length) {
        document.getElementById('notfound-state').classList.remove('hidden');
        document.getElementById('notfound-msg').textContent = `${ticker} not found in recent scans`;
        return;
      }

      // Show content
      document.getElementById('ticker-content').classList.remove('hidden');

      // Use the most recent entry for the header
      const mostRecent = entries[entries.length - 1];
      renderHeader(ticker, mostRecent);
      renderChart(entries);
      renderBreakdown(mostRecent.breakdown);
      if (latestMatch) renderNews(latestMatch, ticker);
      renderHistoryTable(entries);

    } catch (e) {
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('error-state').classList.remove('hidden');
      document.getElementById('error-msg').textContent = e.message;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {};
})();
