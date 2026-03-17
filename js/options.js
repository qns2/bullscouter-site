/**
 * Bull Scouter — Options Flow (Three-Layer Convergence View)
 *
 * Loads options flow scores and cross-references with scanner fundamentals
 * and catalyst/insider data to surface tickers where all three independent
 * confirmation layers align.
 */

const OptionsFlow = (() => {
  const DATA_BASE = 'data';

  const SIGNAL_LABELS = {
    pc_volume: 'P/C Vol',
    pc_oi: 'P/C OI',
    iv_skew: 'IV Skew',
    otm_call_spike: 'OTM Call',
    otm_put_spike: 'OTM Put',
  };

  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
    value: 'Value', quality_growth: 'Quality Growth',
  };

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
    profitability: 'Profitability', fcf: 'FCF', discount: '52w Discount',
    sector_panic: 'Panic Signal', pe_discount: 'PE Discount',
    no_dilution: 'No Dilution', revenue_growth_q: 'Rev Growth',
    gross_margins_q: 'Gross Margins', nrr: 'NRR', tam: 'TAM',
    rule40: 'Rule of 40', sbc: 'SBC',
    earnings_revision: 'EPS Revision', short_pressure: 'Short Pressure',
    convergence_bonus: 'Convergence', insider_buy_boost: 'Insider Buying',
    insider_sell_penalty: 'Insider Selling',
    controversy_insider_compound: 'Controversy+Insider',
    low_margin: 'Low Margin', neg_revenue_cap: 'Neg Revenue',
  };

  let allTickers = [];
  let currentFilter = 'all';

  // ── Helpers ──

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
  function fmt(n, d) { return n != null ? Number(n).toFixed(d ?? 1) : '-'; }
  function fmtK(n) { return n != null ? Number(n).toLocaleString() : '-'; }

  async function fetchJSON(path) {
    const resp = await fetch(`${DATA_BASE}/${path}?_cb=${Date.now()}`);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  // ── Three-Layer Convergence Analysis ──

  function analyzeConvergence(t) {
    const layers = { flow: null, fundamentals: null, catalysts: null };
    let bullish = 0;
    let bearish = 0;

    // Layer 1: Options Flow
    if (t.flow_score > 5) {
      layers.flow = { label: 'Strong Flow', cls: 'text-green-400' };
      bullish++;
    } else if (t.flow_score > 2) {
      layers.flow = { label: 'Bullish Flow', cls: 'text-green-400/70' };
      bullish++;
    } else if (t.flow_score < -5) {
      layers.flow = { label: 'Strong Bear Flow', cls: 'text-red-400' };
      bearish++;
    } else if (t.flow_score < -2) {
      layers.flow = { label: 'Bearish Flow', cls: 'text-red-400/70' };
      bearish++;
    }

    // Layer 2: Fundamentals / Price
    const f = t._fundamentals;
    if (f) {
      if (f.recommendation === 'BUY') {
        layers.fundamentals = { label: `BUY ${f.score}`, cls: 'text-green-400' };
        bullish++;
      } else if (f.recommendation === 'WATCHLIST') {
        layers.fundamentals = { label: `WATCH ${f.score}`, cls: 'text-amber-400' };
        bullish++;
      } else if (f.down_from_high_pct >= 30) {
        layers.fundamentals = { label: `-${fmt(f.down_from_high_pct)}% value`, cls: 'text-amber-400' };
        bullish++;
      }
    }
    // Contrarian as fallback fundamental signal
    const c = t._contrarian;
    if (!layers.fundamentals && c) {
      if (c.recommendation === 'STRONG_CANDIDATE') {
        layers.fundamentals = { label: `Contrarian ${c.score}`, cls: 'text-amber-400' };
        bullish++;
      }
    }

    // Layer 3: Catalysts & Insider
    const insiderBoost = f?.breakdown?.insider_buy_boost || 0;
    const cat = t._catalysts;
    const hasCatalyst = cat && cat.heatmap_score >= 20;
    if (insiderBoost > 0 && hasCatalyst) {
      layers.catalysts = { label: 'Insider + Catalysts', cls: 'text-green-400' };
      bullish++;
    } else if (insiderBoost > 0) {
      layers.catalysts = { label: `Insider +${insiderBoost}`, cls: 'text-green-400' };
      bullish++;
    } else if (hasCatalyst) {
      layers.catalysts = { label: `${cat.signal_count} catalysts`, cls: 'text-amber-400' };
      bullish++;
    }

    let level = 'none';
    if (bullish >= 3) level = 'triple';
    else if (bullish >= 2) level = 'double';

    return { layers, level, bullish, bearish };
  }

  // ── Card Rendering ──

  function renderCard(t) {
    const conv = analyzeConvergence(t);
    const isBullish = t.flow_score > 2;
    const isBearish = t.flow_score < -2;
    const scoreColor = isBullish ? 'text-green-400' : isBearish ? 'text-red-400' : 'text-gray-400';

    // Convergence badge
    let convBadge = '';
    if (conv.level === 'triple') {
      convBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 whitespace-nowrap">TRIPLE CONVERGENCE</span>';
    } else if (conv.level === 'double') {
      convBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">DOUBLE CONVERGENCE</span>';
    }

    // Flow gauge: center = 0, bullish fills right, bearish fills left
    const absScore = Math.min(Math.abs(t.flow_score), 15);
    const fillPct = (absScore / 15) * 50;
    const fillColor = isBullish ? '#22c55e' : isBearish ? '#ef4444' : '#6b7280';
    const fillStyle = isBullish
      ? `left:50%;width:${fillPct}%`
      : isBearish
        ? `right:50%;width:${fillPct}%`
        : `left:50%;width:0%`;

    // Signal component chips
    const signalChips = Object.entries(t.signals || {})
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => {
        const label = SIGNAL_LABELS[k] || k;
        const cls = v > 0 ? 'text-green-400' : 'text-red-400';
        const prefix = v > 0 ? '+' : '';
        return `<span class="text-[11px] ${cls} bg-white/[0.04] px-1.5 py-0.5 rounded">${esc(label)} ${prefix}${fmt(v)}</span>`;
      }).join('');

    // Fundamentals section
    let fundHtml = '';
    const f = t._fundamentals;
    if (f) {
      const recCls = f.recommendation === 'BUY' ? 'text-green-400 bg-green-500/10'
        : f.recommendation === 'WATCHLIST' ? 'text-amber-400 bg-amber-500/10'
        : 'text-blue-400 bg-blue-500/10';
      const confCls = (f.confidence || 0) >= 70 ? 'text-green-400'
        : (f.confidence || 0) >= 50 ? 'text-amber-400' : 'text-red-400';

      // Top breakdown contributors
      let topBreakdown = '';
      if (f.breakdown) {
        const sorted = Object.entries(f.breakdown)
          .filter(([_, v]) => v !== 0)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, 4);
        topBreakdown = sorted.map(([k, v]) => {
          const lbl = BREAKDOWN_LABELS[k] || k.replace(/_/g, ' ');
          const cls = v > 0 ? 'text-green-400' : 'text-red-400';
          return `<span class="${cls}">${esc(lbl)} ${v > 0 ? '+' : ''}${v}</span>`;
        }).join(' <span class="text-gray-700">&middot;</span> ');
      }

      fundHtml = `
        <div class="mt-3 pt-3 border-t border-white/[0.06]">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fundamentals</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${recCls}">${esc(f.recommendation)}</span>
            <span class="text-[11px] font-mono font-bold text-white">${f.score}</span>
            <span class="text-[10px] ${confCls}">conf ${f.confidence || '?'}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
            ${f.profile ? `<span>${esc(PROFILE_LABELS[f.profile] || f.profile)}</span>` : ''}
            ${f.down_from_high_pct ? `<span class="text-red-400">-${fmt(f.down_from_high_pct)}% from high</span>` : ''}
            ${f.market_cap_fmt ? `<span>${esc(f.market_cap_fmt)}</span>` : ''}
          </div>
          ${topBreakdown ? `<div class="mt-1 text-[10px]">${topBreakdown}</div>` : ''}
        </div>`;
    }

    // Contrarian context (if no fundamentals but contrarian data exists)
    const cn = t._contrarian;
    if (!f && cn) {
      const recCls = cn.recommendation === 'STRONG_CANDIDATE' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 bg-white/5';
      fundHtml = `
        <div class="mt-3 pt-3 border-t border-white/[0.06]">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Contrarian</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${recCls}">${esc(cn.recommendation)}</span>
            <span class="text-[11px] font-mono font-bold text-white">${cn.score}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
            ${cn.down_from_high_pct ? `<span class="text-red-400">-${fmt(cn.down_from_high_pct)}% from high</span>` : ''}
            ${cn.market_cap_fmt ? `<span>${esc(cn.market_cap_fmt)}</span>` : ''}
          </div>
        </div>`;
    }

    // Catalysts & Insider section
    let catHtml = '';
    const cat = t._catalysts;
    const insiderBoost = f?.breakdown?.insider_buy_boost || 0;
    const hasCat = (cat && cat.signals && cat.signals.length > 0) || insiderBoost > 0;

    if (hasCat) {
      let signalPills = '';
      if (cat && cat.signals) {
        signalPills = cat.signals.slice(0, 4).map(s => {
          const typeLabel = s.type.replace(/_/g, ' ');
          const daysStr = s.days_until != null && s.days_until >= 0 ? ` ${s.days_until}d` : '';
          const cls = (s.weight || 0) >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10';
          return `<span class="text-[11px] ${cls} px-1.5 py-0.5 rounded">${esc(typeLabel)}${daysStr}</span>`;
        }).join(' ');
      }

      let insiderPill = '';
      if (insiderBoost > 0) {
        insiderPill = `<span class="text-[11px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-semibold">Insider Buying +${insiderBoost}</span>`;
      }

      catHtml = `
        <div class="mt-3 pt-3 border-t border-white/[0.06]">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Catalysts &amp; Insider</span>
            ${cat ? `<span class="text-[10px] text-gray-500">heatmap ${cat.heatmap_score}</span>` : ''}
          </div>
          <div class="flex flex-wrap gap-1">${signalPills} ${insiderPill}</div>
        </div>`;
    }

    // Convergence layer indicators
    let layerDots = '';
    const lf = conv.layers.flow;
    const lfund = conv.layers.fundamentals;
    const lcat = conv.layers.catalysts;
    if (lf || lfund || lcat) {
      const dots = [];
      if (lf) dots.push(`<span class="${lf.cls} text-[10px]">${esc(lf.label)}</span>`);
      if (lfund) dots.push(`<span class="${lfund.cls} text-[10px]">${esc(lfund.label)}</span>`);
      if (lcat) dots.push(`<span class="${lcat.cls} text-[10px]">${esc(lcat.label)}</span>`);
      layerDots = `<div class="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-gray-500">
        <span class="font-semibold uppercase tracking-wider mr-0.5">Layers:</span>
        ${dots.join(' <span class="text-gray-700">&middot;</span> ')}
      </div>`;
    }

    // Build card
    const card = document.createElement('div');
    const borderCls = conv.level === 'triple' ? 'border-green-500/30 hover:border-green-500/50'
      : conv.level === 'double' ? 'border-amber-500/20 hover:border-amber-500/40'
      : 'hover:border-white/20';
    card.className = `glass-card p-4 transition-colors ${borderCls}`;
    card.dataset.direction = (t.direction || 'NEUTRAL').toLowerCase();

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <a href="ticker.html?t=${esc(t.ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(t.ticker)}</a>
          <span class="text-xs text-gray-500 font-mono">$${fmt(t.spot_price, 2)}</span>
          ${convBadge}
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-xl font-bold font-mono ${scoreColor}">${t.flow_score > 0 ? '+' : ''}${fmt(t.flow_score)}</div>
          <div class="text-[10px] font-bold uppercase tracking-wider ${scoreColor}">${esc(t.direction || 'NEUTRAL')}</div>
        </div>
      </div>

      <div class="flow-gauge mb-3">
        <div class="flow-gauge-center"></div>
        <div style="${fillStyle};background:${fillColor};position:absolute;height:100%;border-radius:0.25rem;transition:all 0.4s ease-out"></div>
      </div>

      <div class="flex flex-wrap gap-1">${signalChips}</div>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-2">
        <span>P/C <span class="text-white font-mono">${fmt(t.put_call_ratio, 2)}</span></span>
        <span>IV Skew <span class="text-white font-mono">${fmt(t.iv_skew, 3)}</span></span>
        <span>Vol <span class="text-white font-mono">${fmtK(t.total_volume)}</span></span>
        <span>OI <span class="text-white font-mono">${fmtK(t.total_oi)}</span></span>
      </div>

      ${fundHtml}
      ${catHtml}
      ${layerDots}
    `;

    return card;
  }

  // ── Rendering ──

  function renderAll(filter) {
    const container = document.getElementById('of-cards');
    container.innerHTML = '';

    let filtered = allTickers;
    if (filter === 'bullish') filtered = allTickers.filter(t => t.direction === 'BULLISH');
    else if (filter === 'bearish') filtered = allTickers.filter(t => t.direction === 'BEARISH');

    // Sort: convergence level first, then |flow_score|
    filtered = [...filtered].sort((a, b) => {
      const ca = analyzeConvergence(a);
      const cb = analyzeConvergence(b);
      if (ca.bullish !== cb.bullish) return cb.bullish - ca.bullish;
      return Math.abs(b.flow_score) - Math.abs(a.flow_score);
    });

    filtered.forEach(t => container.appendChild(renderCard(t)));

    if (!filtered.length) show('of-empty');
    else hide('of-empty');
  }

  // ── Copy ──

  function copyForClaude() {
    const tickers = allTickers
      .filter(t => currentFilter === 'all' || t.direction?.toLowerCase() === currentFilter)
      .sort((a, b) => {
        const ca = analyzeConvergence(a);
        const cb = analyzeConvergence(b);
        if (ca.bullish !== cb.bullish) return cb.bullish - ca.bullish;
        return Math.abs(b.flow_score) - Math.abs(a.flow_score);
      });

    const lines = tickers.map(t => {
      const parts = [`${t.ticker} (${t.direction || 'NEUTRAL'})`];
      parts.push(`Flow: ${t.flow_score > 0 ? '+' : ''}${fmt(t.flow_score)}`);
      parts.push(`P/C: ${fmt(t.put_call_ratio, 2)}`);
      parts.push(`IV Skew: ${fmt(t.iv_skew, 3)}`);
      parts.push(`Vol: ${fmtK(t.total_volume)}`);
      parts.push(`Price: $${fmt(t.spot_price, 2)}`);

      const f = t._fundamentals;
      if (f) {
        parts.push(`Scanner: ${f.recommendation} (${f.score})`);
        if (f.confidence) parts.push(`Conf: ${f.confidence}`);
        if (f.profile) parts.push(`Profile: ${f.profile}`);
      }

      const conv = analyzeConvergence(t);
      if (conv.level !== 'none') {
        parts.push(`Convergence: ${conv.level} (${conv.bullish} layers)`);
      }

      const insiderBoost = f?.breakdown?.insider_buy_boost;
      if (insiderBoost > 0) parts.push(`Insider: +${insiderBoost}`);

      const cat = t._catalysts;
      if (cat && cat.heatmap_score > 0) parts.push(`Catalysts: ${cat.signal_count} (heatmap ${cat.heatmap_score})`);

      return parts.join(' | ');
    });

    const bullishN = allTickers.filter(t => t.direction === 'BULLISH').length;
    const bearishN = allTickers.filter(t => t.direction === 'BEARISH').length;
    const tripleN = allTickers.filter(t => analyzeConvergence(t).level === 'triple').length;
    const doubleN = allTickers.filter(t => analyzeConvergence(t).level === 'double').length;

    const dateStr = document.getElementById('of-date')?.textContent || 'today';
    const header = [
      `Bull Scouter Options Flow — ${dateStr}`,
      `${allTickers.length} tickers: ${bullishN} bullish, ${bearishN} bearish`,
      `Convergence: ${tripleN} triple, ${doubleN} double`,
      '',
    ].join('\n');

    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const btn = document.getElementById('btn-copy-of');
      const label = btn?.querySelector('.copy-label');
      btn?.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => {
        btn?.classList.remove('copied');
        if (label) label.textContent = 'Copy';
      }, 2000);
    });
  }

  // ── Init ──

  async function init() {
    try {
      const [flowData, latestData, catalystsData, contrarianData] = await Promise.all([
        fetchJSON('options-flow.json'),
        fetchJSON('latest.json').catch(() => null),
        fetchJSON('catalysts.json').catch(() => null),
        fetchJSON('contrarian.json').catch(() => null),
      ]);

      if (!flowData || !flowData.tickers || !flowData.tickers.length) {
        hide('of-loading');
        show('of-empty');
        return;
      }

      // Build lookup maps
      const fundMap = {};
      if (latestData && latestData.opportunities) {
        latestData.opportunities.forEach(o => { fundMap[o.ticker] = o; });
      }

      const catMap = {};
      if (catalystsData && catalystsData.heatmap) {
        catalystsData.heatmap.forEach(h => { catMap[h.ticker] = h; });
      }

      const contrMap = {};
      if (contrarianData) {
        (contrarianData.strong_candidates || []).forEach(c => { contrMap[c.ticker] = c; });
        (contrarianData.candidates || []).forEach(c => { if (!contrMap[c.ticker]) contrMap[c.ticker] = c; });
      }

      // Merge: options flow + fundamentals + catalysts + contrarian
      allTickers = flowData.tickers.map(t => ({
        ...t,
        _fundamentals: fundMap[t.ticker] || null,
        _catalysts: catMap[t.ticker] || null,
        _contrarian: contrMap[t.ticker] || null,
      }));

      // Stats
      setText('of-date', flowData.date || '-');
      const vBadge = document.getElementById('version-badge');
      if (vBadge && flowData.version) vBadge.textContent = `v${flowData.version}`;

      const bullishN = allTickers.filter(t => t.direction === 'BULLISH').length;
      const bearishN = allTickers.filter(t => t.direction === 'BEARISH').length;
      const neutralN = allTickers.length - bullishN - bearishN;

      setText('of-stat-total', allTickers.length);
      setText('of-stat-bullish', bullishN);
      setText('of-stat-bearish', bearishN);
      setText('of-stat-neutral', neutralN);

      hide('of-loading');
      renderAll('all');
    } catch (e) {
      hide('of-loading');
      show('of-error');
      const msg = document.getElementById('of-error-msg');
      if (msg) msg.textContent = e.message;
    }

    // Filter buttons
    document.querySelectorAll('.of-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.of-filter').forEach(b => {
          b.classList.remove('active', 'bg-white/10', 'text-white');
          b.classList.add('bg-white/5', 'text-gray-400');
        });
        btn.classList.add('active', 'bg-white/10', 'text-white');
        btn.classList.remove('bg-white/5', 'text-gray-400');
        currentFilter = btn.dataset.filter;
        renderAll(currentFilter);
      });
    });

    // Copy button
    document.getElementById('btn-copy-of')?.addEventListener('click', copyForClaude);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {};
})();
