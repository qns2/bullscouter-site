/**
 * Bull Scouter — Options Deep page.
 *
 * Renders data/options-deep.json as two card-grid sections:
 *   - My Stocks (held positions, is_held=1)
 *   - Bull Scouter universe (scanner watchlist + BUY/WATCHLIST)
 *
 * Each card shows: flow gauge, signal, skew (direction + magnitude),
 * GEX (regime + magnitude), zero-γ buffer, bullish streak, earnings.
 */

(() => {
  const DATA_URL = 'data/options-deep.json?_cb=' + Date.now();

  let allMine = [];
  let allBs = [];
  let currentFilter = 'all';

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  };
  const show = (id) => document.getElementById(id)?.classList.remove('hidden');
  const hide = (id) => document.getElementById(id)?.classList.add('hidden');
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n)) ? '—' : Number(n).toFixed(d);

  // ---------- flow classification ----------
  function flowLevel(s) {
    if (s == null) return 'none';
    if (s > 5) return 'strong_bull';
    if (s > 2) return 'bull';
    if (s < -5) return 'strong_bear';
    if (s < -2) return 'bear';
    return 'neutral';
  }

  function flowColor(s) {
    if (s == null) return '#64748b';
    if (s > 2) return '#22c55e';
    if (s < -2) return '#ef4444';
    return '#6b7280';
  }

  // ---------- card renderer ----------
  function renderCard(entry) {
    const { ticker, flow, skew, gex, earnings_date } = entry;
    const s = flow?.score;
    const isBullish = s != null && s > 2;
    const isBearish = s != null && s < -2;
    const scoreColor = isBullish ? 'text-green-400'
                     : isBearish ? 'text-red-400' : 'text-gray-400';

    // Flow gauge fill
    const absScore = Math.min(Math.abs(s ?? 0), 15);
    const fillPct = (absScore / 15) * 50;
    const fillColor = flowColor(s);
    const fillStyle = isBullish
      ? `left:50%;width:${fillPct}%`
      : isBearish
        ? `right:50%;width:${fillPct}%`
        : `left:50%;width:0%`;

    // Direction label
    let directionChip = '';
    if (flow?.signal === 'strong_bull')   directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">🚀 STRONG BULL</span>';
    else if (flow?.signal === 'bull')     directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400/80 border border-green-500/20">🟢 BULL</span>';
    else if (flow?.signal === 'strong_bear') directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🚨 STRONG BEAR</span>';
    else if (flow?.signal === 'bear')     directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400/80 border border-red-500/20">🔴 BEAR</span>';
    else if (flow?.signal === 'neutral')  directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">⚖️ NEUTRAL</span>';
    else                                  directionChip = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">⚪ NO DATA</span>';

    // Streak chip
    const streakChip = flow?.bullish_streak
      ? `<span class="text-[11px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded font-semibold">🔥 ${flow.bullish_streak}d streak</span>`
      : '';

    // TD confirmed
    const tdChip = flow?.td_confirmed
      ? '<span class="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded" title="ThetaData-confirmed">✓ TD</span>'
      : '';

    // Days ago meta
    const daysStr = flow?.days_ago == null ? ''
      : flow.days_ago === 0 ? 'today'
      : `${flow.days_ago}d ago`;
    const daysChip = daysStr ? `<span class="text-[10px] text-gray-500">${daysStr}</span>` : '';

    // --- Skew block ---
    let skewHtml = `<div class="text-[11px] text-gray-500 italic">no skew (earnings &gt;45d)</div>`;
    if (skew) {
      const dirCls = skew.direction === 'bullish' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                   : skew.direction === 'bearish' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                   : 'text-gray-400 bg-white/5 border-white/10';
      const dirIcon = skew.direction === 'bullish' ? '📈' : skew.direction === 'bearish' ? '📉' : '⚖';
      const rr = skew.risk_reversal_vp;
      const magCls = skew.magnitude === 'extreme'  ? 'text-red-400 bg-red-500/15 border-red-500/25'
                   : skew.magnitude === 'moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                   : 'text-gray-400 bg-white/5 border-white/10';
      const magIcon = skew.magnitude === 'extreme' ? '⚠' : '';
      skewHtml = `
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${dirCls}">${dirIcon} ${skew.direction.toUpperCase()} ${rr != null ? (rr > 0 ? '+' : '') + fmt(rr) + 'vp' : ''}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${magCls}">${magIcon} ${skew.magnitude.toUpperCase()}</span>
        </div>
        <div class="text-[10px] text-gray-500 mt-1">${esc(skew.expiration)} &middot; put ${fmt(skew.put_25d_iv * 100)}% / call ${fmt(skew.call_25d_iv * 100)}%</div>`;
    }

    // --- GEX block ---
    let gexHtml = `<div class="text-[11px] text-gray-500 italic">no GEX data</div>`;
    if (gex) {
      const gexM = gex.total_gex_usd / 1e6;
      const regimeCls = gex.regime === 'long_gamma' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : gex.regime === 'short_gamma' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : 'text-gray-400 bg-white/5 border-white/10';
      const regimeIcon = gex.regime === 'long_gamma' ? '🟢' : gex.regime === 'short_gamma' ? '🔴' : '⚪';
      const bufCls = gex.buffer === 'safe' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                   : gex.buffer === 'caution' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                   : 'text-red-400 bg-red-500/15 border-red-500/25';
      const bufIcon = gex.buffer === 'safe' ? '🛡' : gex.buffer === 'caution' ? '⚠' : '🚨';
      gexHtml = `
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${regimeCls}">${regimeIcon} ${gex.regime.replace('_', ' ').toUpperCase()}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${bufCls}">${bufIcon} Γ₀ ${gex.buffer.toUpperCase()} ${fmt(gex.zero_gamma_distance_pct)}%</span>
        </div>
        <div class="text-[10px] text-gray-500 mt-1">GEX $${gexM >= 0 ? '+' : ''}${fmt(gexM)}M &middot; zero-γ $${fmt(gex.zero_gamma_level, 2)}</div>`;
    }

    // --- Earnings block ---
    let earningsChip = '';
    if (earnings_date) {
      const dateStr = String(earnings_date).slice(0, 10);
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((d - today) / (86400 * 1000));
        let cls = 'text-gray-400 bg-white/5';
        if (days < 0) cls = 'text-gray-600 bg-white/[0.02]';
        else if (days <= 3) cls = 'text-red-300 bg-red-500/10';
        else if (days <= 14) cls = 'text-amber-400 bg-amber-500/10';
        else if (days <= 45) cls = 'text-blue-400 bg-blue-500/10';
        earningsChip = `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}">📅 ${dateStr} (${days >= 0 ? days + 'd' : 'past'})</span>`;
      } else {
        earningsChip = `<span class="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">📅 ${esc(dateStr)}</span>`;
      }
    }

    // Card border accent by flow
    const level = flowLevel(s);
    const borderCls = level === 'strong_bull' ? 'border-green-500/30 hover:border-green-500/50'
                    : level === 'bull'        ? 'border-green-500/15 hover:border-green-500/30'
                    : level === 'strong_bear' ? 'border-red-500/30 hover:border-red-500/50'
                    : level === 'bear'        ? 'border-red-500/15 hover:border-red-500/30'
                    : 'hover:border-white/20';

    // Build card
    const card = document.createElement('div');
    card.className = `glass-card p-4 transition-colors ${borderCls}`;
    card.dataset.level = level;
    card.dataset.skewMag = skew?.magnitude || 'none';
    card.dataset.gexRegime = gex?.regime || 'none';
    card.dataset.gexBuffer = gex?.buffer || 'none';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <a href="ticker.html?t=${esc(ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(ticker)}</a>
          ${directionChip}
        </div>
        <div class="flex items-start gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-xl font-bold font-mono ${scoreColor}">${s != null ? (s > 0 ? '+' : '') + fmt(s) : '—'}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">flow</div>
          </div>
          <button class="od-card-copy p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                  data-ticker="${esc(ticker)}" title="Copy ${esc(ticker)} for Claude">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="flow-gauge mb-3">
        <div class="flow-gauge-center"></div>
        <div style="${fillStyle};background:${fillColor};position:absolute;height:100%;border-radius:0.25rem;transition:all 0.4s ease-out"></div>
      </div>

      <div class="flex flex-wrap gap-1.5 mb-3">
        ${streakChip}
        ${tdChip}
        ${daysChip}
      </div>

      <div class="mt-3 pt-3 border-t border-white/[0.06]">
        <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Skew</div>
        ${skewHtml}
      </div>

      <div class="mt-3 pt-3 border-t border-white/[0.06]">
        <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Dealer γ</div>
        ${gexHtml}
      </div>

      ${earningsChip ? `
      <div class="mt-3 pt-3 border-t border-white/[0.06]">
        ${earningsChip}
      </div>` : ''}
    `;
    return card;
  }

  // ---------- filtering + render ----------
  function hasAnyData(entry) {
    return entry.flow?.score != null || entry.skew != null || entry.gex != null;
  }

  function matchesFilter(entry, filter) {
    if (filter === 'all') return true;
    const s = entry.flow?.score;
    if (filter === 'bullish')  return s != null && s > 2;
    if (filter === 'bearish')  return s != null && s < -2;
    if (filter === 'extreme')  return entry.skew?.magnitude === 'extreme';
    if (filter === 'shortgamma') return entry.gex?.regime === 'short_gamma';
    if (filter === 'danger')   return entry.gex?.buffer === 'danger';
    return true;
  }

  function renderSection(entries, containerId, countId) {
    const c = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    c.innerHTML = '';
    // Always drop no-data entries (e.g. BRBR with no flow/skew/GEX) — pure noise.
    const withData = entries.filter(hasAnyData);
    const filtered = withData.filter(e => matchesFilter(e, currentFilter));
    filtered.forEach(e => c.appendChild(renderCard(e)));
    if (countEl) {
      const suffix = filtered.length !== withData.length ? `/${withData.length}` : '';
      countEl.textContent = `(${filtered.length}${suffix})`;
    }
  }

  function renderAll() {
    renderSection(allMine, 'od-mine', 'od-mine-count');
    renderSection(allBs, 'od-bs', 'od-bs-count');
  }

  function renderStats(data) {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // Stats reflect what the user actually sees (no-data tickers hidden).
    const mineWithData = (data.mine || []).filter(hasAnyData);
    const bsWithData = (data.bullscouter || []).filter(hasAnyData);
    const all = [...mineWithData, ...bsWithData];
    const bull = all.filter(e => e.flow?.score != null && e.flow.score > 2).length;
    const bear = all.filter(e => e.flow?.score != null && e.flow.score < -2).length;
    const shortg = all.filter(e => e.gex?.regime === 'short_gamma').length;
    const extreme = all.filter(e => e.skew?.magnitude === 'extreme').length;
    setText('od-stat-mine', mineWithData.length);
    setText('od-stat-bs', bsWithData.length);
    setText('od-stat-bull', bull);
    setText('od-stat-bear', bear);
    setText('od-stat-shortg', shortg);
    setText('od-stat-extreme', extreme);
  }

  // ---------- Copy for Claude ----------
  function _formatRow(e) {
    const parts = [e.ticker];
    if (e.flow?.score != null) parts.push(`flow ${e.flow.score > 0 ? '+' : ''}${fmt(e.flow.score)}`);
    if (e.flow?.bullish_streak) parts.push(`🔥${e.flow.bullish_streak}d`);
    if (e.skew) parts.push(`skew ${e.skew.direction} ${fmt(e.skew.risk_reversal_vp)}vp (${e.skew.magnitude})`);
    if (e.gex) parts.push(`${e.gex.regime} Γ₀${fmt(e.gex.zero_gamma_distance_pct)}% ${e.gex.buffer}`);
    if (e.earnings_date) parts.push(`E:${String(e.earnings_date).slice(0, 10)}`);
    return parts.join(' | ');
  }

  function copyTicker(data, ticker) {
    // Find the entry in either list
    const entry = (data.mine || []).concat(data.bullscouter || [])
                                    .find(e => e.ticker === ticker);
    if (!entry) return Promise.reject(new Error(`${ticker} not found`));

    const lines = [];
    lines.push(`${entry.ticker} — Bull Scouter Options Deep (${data.date}, ${data.provider})`);
    lines.push('');

    // Flow
    if (entry.flow?.score != null) {
      const s = entry.flow.score;
      const sigLabel = entry.flow.signal?.replace('_', ' ').toUpperCase() || '';
      const days = entry.flow.days_ago == null ? '' :
        entry.flow.days_ago === 0 ? '(today)' : `(${entry.flow.days_ago}d ago)`;
      const td = entry.flow.td_confirmed ? ' [TD-confirmed]' : '';
      lines.push(`Flow: ${s > 0 ? '+' : ''}${fmt(s)} — ${sigLabel} ${days}${td}`);
      if (entry.flow.bullish_streak) {
        lines.push(`  🔥 ${entry.flow.bullish_streak}-day bullish streak`);
      }
    } else {
      lines.push('Flow: no data');
    }

    // Skew
    if (entry.skew) {
      const k = entry.skew;
      lines.push(`Skew: ${k.direction.toUpperCase()} ${(k.risk_reversal_vp > 0 ? '+' : '')}${fmt(k.risk_reversal_vp)}vp (${k.magnitude}) — ${k.expiration}`);
      lines.push(`  put 25Δ ${fmt(k.put_25d_iv * 100)}% / call 25Δ ${fmt(k.call_25d_iv * 100)}%`);
    } else {
      lines.push('Skew: no data (earnings >45d or insufficient IV)');
    }

    // GEX
    if (entry.gex) {
      const g = entry.gex;
      const gexM = g.total_gex_usd / 1e6;
      lines.push(`Dealer γ: ${g.regime.replace('_', ' ').toUpperCase()} $${gexM >= 0 ? '+' : ''}${fmt(gexM)}M`);
      lines.push(`  Zero-γ: $${fmt(g.zero_gamma_level, 2)} (${g.buffer.toUpperCase()} ${fmt(g.zero_gamma_distance_pct)}% from spot $${fmt(g.spot, 2)})`);
    } else {
      lines.push('Dealer γ: no data');
    }

    // Earnings
    if (entry.earnings_date) {
      const dateStr = String(entry.earnings_date).slice(0, 10);
      const d = new Date(dateStr + 'T00:00:00');
      let suffix = '';
      if (!isNaN(d)) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((d - today) / (86400 * 1000));
        suffix = days >= 0 ? ` (${days}d)` : ' (past)';
      }
      lines.push(`Earnings: ${dateStr}${suffix}`);
    }

    return navigator.clipboard.writeText(lines.join('\n'));
  }

  function copyList(data, which) {
    const header = `Bull Scouter Options Deep — ${data.date} (provider: ${data.provider})`;
    const mine = (data.mine || []).filter(hasAnyData);
    const bs = (data.bullscouter || []).filter(hasAnyData);
    let lines = [header, ''];
    if (which === 'mine') {
      lines.push(`== MY STOCKS (${mine.length}) ==`);
      lines = lines.concat(mine.map(_formatRow));
    } else if (which === 'bullscouter') {
      lines.push(`== BULL SCOUTER UNIVERSE (${bs.length}) ==`);
      lines = lines.concat(bs.map(_formatRow));
    } else {
      lines.push(`Mine: ${mine.length} · Bull Scouter: ${bs.length}`, '');
      lines.push('== MY STOCKS ==');
      lines = lines.concat(mine.map(_formatRow));
      lines.push('', '== BULL SCOUTER ==');
      lines = lines.concat(bs.map(_formatRow));
    }
    return navigator.clipboard.writeText(lines.join('\n'));
  }

  function flashCopied(btn) {
    const label = btn?.querySelector('.copy-label');
    const prev = label?.textContent || 'Copy';
    if (label) label.textContent = 'Copied!';
    setTimeout(() => { if (label) label.textContent = prev; }, 1800);
  }

  // ---------- init ----------
  async function init() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const data = await resp.json();

      const dateEl = $('#od-date'); if (dateEl) dateEl.textContent = data.date || '-';
      const providerEl = $('#od-provider'); if (providerEl) providerEl.textContent = data.provider || '-';
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = `v${data.version}`;

      allMine = data.mine || [];
      allBs = data.bullscouter || [];

      renderStats(data);
      renderAll();

      hide('od-loading');
      if (!allMine.length && !allBs.length) show('od-empty');

      // Filter tabs
      document.querySelectorAll('.od-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.od-filter').forEach(b => {
            b.classList.remove('active', 'bg-white/10', 'text-white');
            b.classList.add('bg-white/5', 'text-gray-400');
          });
          btn.classList.add('active', 'bg-white/10', 'text-white');
          btn.classList.remove('bg-white/5', 'text-gray-400');
          currentFilter = btn.dataset.filter;
          renderAll();
        });
      });

      // Per-list copy
      document.querySelectorAll('.od-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          copyList(data, btn.dataset.copyList).then(() => flashCopied(btn));
        });
      });

      // Per-card copy (delegated — survives re-render on filter change)
      const flashCardCopy = (btn) => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="text-[10px] text-green-400">✓</span>';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      };
      ['od-mine', 'od-bs'].forEach(id => {
        const c = document.getElementById(id);
        if (!c) return;
        c.addEventListener('click', (e) => {
          const btn = e.target.closest('.od-card-copy');
          if (!btn) return;
          e.preventDefault();
          e.stopPropagation();
          copyTicker(data, btn.dataset.ticker).then(() => flashCardCopy(btn));
        });
      });
    } catch (e) {
      hide('od-loading');
      show('od-error');
      const msg = document.getElementById('od-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
