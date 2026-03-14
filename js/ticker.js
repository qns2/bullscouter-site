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

    // Fallback: if ticker not in main scan, check contrarian + watchlist
    let altMatch = latestMatch;
    if (!altMatch) {
      const [contrarian, watchlist] = await Promise.all([
        fetchJSON('contrarian.json').catch(() => null),
        fetchJSON('watchlist.json').catch(() => null),
      ]);
      if (contrarian) {
        const allC = [...(contrarian.strong_candidates || []), ...(contrarian.candidates || [])];
        const cm = allC.find(c => c.ticker === ticker);
        if (cm) {
          altMatch = {
            ticker: cm.ticker,
            score: cm.score,
            confidence: 0,
            recommendation: cm.recommendation,
            profile: 'contrarian',
            price: cm.current_price,
            breakdown: cm.breakdown,
            market_cap_fmt: cm.market_cap_fmt,
            down_from_high_pct: cm.down_from_high_pct,
            quality_checklist: cm.quality_checklist,
            events: [],
          };
          // Add as most recent entry if no scan history or scan data is stale
          if (!entries.length || entries[entries.length - 1].date < scanDate) {
            entries.push({
              date: scanDate,
              score: cm.score,
              confidence: 0,
              recommendation: cm.recommendation,
              profile: 'contrarian',
              price: cm.current_price,
              breakdown: cm.breakdown,
              market_cap_fmt: cm.market_cap_fmt,
              down_from_high_pct: cm.down_from_high_pct,
            });
          }
        }
      }
      if (!altMatch && watchlist) {
        const wm = (watchlist.stocks || []).find(s => s.ticker === ticker);
        if (wm) {
          altMatch = {
            ticker: wm.ticker,
            score: 0,
            confidence: 0,
            recommendation: 'WATCHLIST',
            profile: '',
            price: wm.current_price,
            breakdown: {},
            market_cap_fmt: '',
            down_from_high_pct: 0,
            events: [],
          };
        }
      }
    }

    return { entries, latest, latestMatch: altMatch };
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

    // BUY zone background plugin — shades columns where recommendation was BUY
    const buyZonePlugin = {
      id: 'buyZone',
      beforeDraw(chart) {
        const ctx2 = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const top = yScale.top;
        const bottom = yScale.bottom;
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].recommendation !== 'BUY') continue;
          const x = xScale.getPixelForValue(i);
          const halfStep = i < entries.length - 1
            ? (xScale.getPixelForValue(i + 1) - x) / 2
            : i > 0 ? (x - xScale.getPixelForValue(i - 1)) / 2 : 20;
          ctx2.fillStyle = 'rgba(0, 255, 136, 0.06)';
          ctx2.fillRect(x - halfStep, top, halfStep * 2, bottom - top);
        }
      }
    };

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
            pointBackgroundColor: entries.map(e => e.recommendation === 'BUY' ? '#00ff88' : '#f59e0b'),
            pointBorderColor: entries.map(e => e.recommendation === 'BUY' ? '#00ff88' : '#f59e0b'),
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
          {
            label: 'BUY threshold (Score 75)',
            data: labels.map(() => 75),
            borderColor: 'rgba(0, 255, 136, 0.25)',
            borderWidth: 1,
            borderDash: [3, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
          },
          {
            label: 'Confidence gate (60)',
            data: labels.map(() => 60),
            borderColor: 'rgba(59, 130, 246, 0.25)',
            borderWidth: 1,
            borderDash: [3, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
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
              filter: (item) => !item.text.includes('threshold') && !item.text.includes('gate'),
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
            filter: (item) => item.datasetIndex <= 1,
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx == null) return '';
                const e = entries[idx];
                return e.recommendation === 'BUY' ? '\nBUY signal active' : '\nBelow BUY threshold';
              },
            },
          },
        },
      },
      plugins: [buyZonePlugin],
    });
  }

  // Human-readable descriptions for breakdown components
  const BREAKDOWN_DESCRIPTIONS = {
    catalyst: 'upcoming binary catalyst (FDA, earnings, launch)',
    social: 'social media attention (Reddit, StockTwits)',
    growth_quality: 'revenue/earnings growth quality',
    margin_quality: 'profit margin strength',
    fallen_angel: 'fallen angel recovery pattern',
    fundamental: 'fundamental valuation metrics',
    technical: 'technical chart signals',
    news_boost: 'recent positive news coverage',
    claude_enhancement: 'AI-assessed upside potential',
    momentum_bonus: 'price momentum trend',
    breakout_pattern_bonus: 'breakout chart pattern match',
    catalyst_pattern_bonus: 'matches historical catalyst winners',
    fundamental_risk: 'fundamental risk adjustment',
    narrative_overlap: 'thesis overlap with other signals',
    pre_revenue_discount: 'pre-revenue stage discount',
    quality_persistence: 'sustained quality metrics',
    controversy_penalty: 'negative news or controversy',
    thesis_decay: 'thesis aging (evidence getting stale)',
    revenue_momentum: 'revenue acceleration',
    margin_expansion: 'margin improvement trend',
    price_trend: 'price trend and relative strength',
    volume_expansion: 'trading volume increase',
    conviction: 'cross-source conviction strength',
    social_discovery: 'social discovery signal',
    acceleration_influence: 'acceleration profile influence',
    profitability: 'profitability metrics',
    fcf: 'free cash flow generation',
    discount: 'discount from 52-week high',
    sector_panic: 'sector-wide panic selling',
    pe_discount: 'PE ratio discount vs peers',
    no_dilution: 'no recent share dilution',
    revenue_growth_q: 'quarterly revenue growth',
    gross_margins_q: 'gross margin quality',
    nrr: 'net revenue retention',
    tam: 'total addressable market size',
    rule40: 'Rule of 40 (growth + margin)',
    sbc: 'stock-based compensation discipline',
    earnings_revision: 'earnings estimate revisions',
    short_pressure: 'short squeeze potential',
    convergence_bonus: 'multiple signals converging',
    overvalued_cap: 'overvaluation cap applied',
    bankruptcy_risk_cap: 'bankruptcy risk cap',
    insider_buy_boost: 'insider buying activity',
    insider_sell_penalty: 'insider selling activity',
    thesis_feedback: 'AI analyst thesis adjustment',
    neg_revenue_cap: 'negative revenue growth cap',
    low_margin: 'low margin penalty',
  };

  function summarizeBreakdown(breakdown, entry) {
    if (!breakdown || !Object.keys(breakdown).length) return '';

    const items = Object.entries(breakdown)
      .filter(([_, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (!items.length) return '';

    const positives = items.filter(([_, v]) => v > 0);
    const negatives = items.filter(([_, v]) => v < 0);
    const total = items.reduce((sum, [_, v]) => sum + v, 0);

    const parts = [];

    // Top drivers
    if (positives.length) {
      const top = positives.slice(0, 3).map(([k, v]) => {
        const desc = BREAKDOWN_DESCRIPTIONS[k] || BREAKDOWN_LABELS[k] || k;
        return `${desc} (+${v})`;
      });
      parts.push(`Driven by ${top.join(', ')}.`);
    }

    // Key drags
    if (negatives.length) {
      const drags = negatives.slice(0, 2).map(([k, v]) => {
        const desc = BREAKDOWN_DESCRIPTIONS[k] || BREAKDOWN_LABELS[k] || k;
        return `${desc} (${v})`;
      });
      parts.push(`Held back by ${drags.join(', ')}.`);
    }

    // BUY status explanation
    const score = entry.score || 0;
    const conf = entry.confidence || 0;
    const rec = entry.recommendation;
    if (rec === 'BUY') {
      parts.push(`Score ${score} and confidence ${conf} both above thresholds \u2014 BUY signal active.`);
    } else if (score >= 75 && conf >= 60) {
      parts.push(`Score ${score} and confidence ${conf} pass thresholds, but needs 2 consecutive qualifying days for BUY.`);
    } else if (score >= 75) {
      parts.push(`Score ${score} passes, but confidence ${conf} is below the 60 gate needed for BUY.`);
    } else if (conf >= 60) {
      parts.push(`Confidence ${conf} passes, but score ${score} is below the 75 minimum for BUY.`);
    } else {
      parts.push(`Both score ${score} and confidence ${conf} are below BUY thresholds (75 and 60).`);
    }

    return parts.join(' ');
  }

  function renderBreakdown(breakdown, entry) {
    if (!breakdown || !Object.keys(breakdown).length) return;

    const section = document.getElementById('section-breakdown');
    const container = document.getElementById('breakdown-chips');
    const summaryEl = document.getElementById('breakdown-summary');

    const entries = Object.entries(breakdown)
      .filter(([_, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (!entries.length) return;

    section.classList.remove('hidden');

    // Summary in plain English
    if (summaryEl) {
      summaryEl.textContent = summarizeBreakdown(breakdown, entry);
    }

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
    if (!events.length) return;

    section.classList.remove('hidden');
    let html = '';

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
      renderBreakdown(mostRecent.breakdown, mostRecent);
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
