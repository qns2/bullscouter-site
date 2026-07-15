/**
 * Bull Scouter — Deep Buy List page.
 *
 * Renders data/deep-buy.json: ranked convergence picks with full breakdown
 * (composite, entry/target/stop/RR, convergence_paths, components, rationale).
 */

(() => {
  const DATA_URL = 'data/deep-buy.json?_cb=' + Date.now();

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const show = (id) => document.getElementById(id)?.classList.remove('hidden');
  const hide = (id) => document.getElementById(id)?.classList.add('hidden');
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n)) ? '—' : Number(n).toFixed(d);

  function compositeColor(c) {
    if (c >= 80) return '#00ff88';
    if (c >= 60) return '#4ade80';
    if (c >= 40) return '#fbbf24';
    return '#94a3b8';
  }

  function compositeWidth(c) {
    return Math.min(100, Math.max(0, (c / 120) * 100));
  }

  // "2026-04-25" → "1d ago" / "today" / "" if unparseable.
  function noteAge(written_at) {
    if (!written_at) return '';
    const d = new Date(written_at + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((today - d) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  }

  function pathBadge(p) {
    const labels = {
      path1_buy: ['Path 1 BUY', 'green'],
      path3_strong_candidate: ['Path 3 strong', 'amber'],
      path5_strong_quality: ['Buffett quality', 'blue'],
      buffett_quality: ['Buffett quality', 'blue'],
      buffett_strong_quality: ['Buffett STRONG', 'blue'],
      buffett_strong: ['Buffett STRONG', 'blue'],
      flow_sustained: ['Flow sustained', 'green'],
      flow_extreme: ['Flow extreme', 'red'],
      skew_bullish: ['Skew bull', 'green'],
      gex_long_safe: ['GEX safe', 'green'],
      catalyst_near: ['Catalyst <14d', 'amber'],
      insider_buy: ['Insider buy', 'green'],
      activist_filing: ['Activist 13D', 'amber'],
      watchlist_dip: ['Watchlist dip', 'amber'],
    };
    const [label, color] = labels[p] || [p, 'gray'];
    const cls = {
      green: 'text-green-400 bg-green-500/10 border-green-500/20',
      amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      red: 'text-red-400 bg-red-500/10 border-red-500/20',
      gray: 'text-gray-400 bg-white/5 border-white/10',
    }[color];
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded border ${cls}">${esc(label)}</span>`;
  }

  const TIER_THEME = {
    3: {
      label: 'T3',
      border: 'hover:border-emerald-400/30',
      pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      sizeCls: 'bg-emerald-500/10 text-emerald-400',
    },
    2: {
      label: 'T2',
      border: 'hover:border-blue-400/30',
      pill: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      sizeCls: 'bg-blue-500/10 text-blue-400',
    },
    1: {
      label: 'T1',
      border: 'hover:border-orange-400/30',
      pill: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      sizeCls: 'bg-orange-500/10 text-orange-400',
    },
  };

  const SIZE_LABELS = { full: 'Full $1500', standard: 'Std $1000', half: 'Half $500', none: '—' };

  function renderTierCard(p) {
    const tier = p.tier || 1;
    const theme = TIER_THEME[tier] || TIER_THEME[1];
    const compColor = compositeColor(p.composite);
    const compWidth = compositeWidth(p.composite);
    const ent = p.entry || {};
    const earningsStr = p.earnings_days_away != null
      ? `${p.earnings_date} (${p.earnings_days_away}d)`
      : 'no earnings ≤45d';
    const paths = (p.convergence_paths || []).map(pathBadge).join(' ');
    const sourceLabel = (p.source || '').toUpperCase();
    const sizeLabel = SIZE_LABELS[p.size_class] || p.size_class || '—';
    const evidence = (p.tier_evidence || []).join(', ') || '—';

    const compEntries = Object.entries(p.components || {});
    const breakdownHtml = compEntries.map(([k, v]) => {
      const score = v?.score != null ? v.score : v;
      const sign = score > 0 ? '+' : '';
      const cls = score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-400';
      return `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(k)}</span><span class="${cls} font-mono">${sign}${score}</span></div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = `glass-card p-4 transition-colors ${theme.border}`;

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${theme.pill}">${theme.label} · ${esc(sourceLabel)}</span>
          <a href="ticker.html?t=${esc(p.ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(p.ticker)}</a>
          <span class="text-xs text-gray-500 font-mono">$${fmt(p.spot_price, 2)}</span>
        </div>
        <div class="flex items-start gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-2xl font-bold font-mono" style="color:${compColor}">${p.composite}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">composite</div>
          </div>
        </div>
      </div>

      <div class="composite-bar mb-3">
        <div class="composite-fill" style="width:${compWidth}%; background:${compColor}"></div>
      </div>

      <div class="flex flex-wrap gap-1 mb-3">${paths}</div>

      <div class="grid grid-cols-3 gap-2 text-[12px] mb-3">
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Entry zone</div>
          <div class="text-white font-mono">$${fmt(ent.low, 2)} – $${fmt(ent.high, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Target / Stop</div>
          <div class="text-white font-mono">$${fmt(p.target, 2)} / $${fmt(p.stop, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">R/R</div>
          <div class="font-mono text-green-400">${fmt(p.rr_ratio, 2)}:1</div>
        </div>
      </div>

      <div class="flex items-center gap-3 text-[11px] mb-3">
        <span class="px-2 py-0.5 rounded ${theme.sizeCls} font-bold">${esc(sizeLabel)}</span>
        <span class="text-gray-500">evidence: ${esc(evidence)}</span>
      </div>

      <div class="text-[11px] text-gray-400 mb-3 leading-relaxed">${esc(p.rationale_one_liner)}</div>

      ${p.oracle_note ? `
      <div class="bg-blue-500/[0.06] border-l-2 border-blue-500/40 pl-2 pr-2 py-1.5 mb-3 rounded-r">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-[9px] uppercase tracking-wider text-blue-400/80">Oracle</span>
          <span class="text-[9px] text-gray-500">${esc(noteAge(p.oracle_note.written_at))}</span>
        </div>
        <div class="text-[11px] text-gray-300 italic leading-relaxed">${esc(p.oracle_note.text || '')}</div>
      </div>` : ''}

      <div class="text-[10px] text-gray-500 flex items-center gap-3 mb-3">
        <span>${esc(earningsStr)}</span>
        ${p.position_risk_usd != null ? `<span>risk $${fmt(p.position_risk_usd, 2)}</span>` : ''}
      </div>

      ${compEntries.length ? `
      <details class="border-t border-white/[0.06] pt-2">
        <summary class="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 hover:text-white">Component breakdown</summary>
        <div class="mt-2 space-y-1">${breakdownHtml}</div>
      </details>` : ''}
    `;
    return card;
  }

  function renderCard(p) {
    const compColor = compositeColor(p.composite);
    const compWidth = compositeWidth(p.composite);
    const ent = p.entry;
    const earningsStr = p.earnings_days_away != null
      ? `${p.earnings_date} (${p.earnings_days_away}d)`
      : 'no earnings ≤45d';

    const paths = (p.convergence_paths || []).map(pathBadge).join(' ');

    // Component breakdown — collapsed by default
    const compEntries = Object.entries(p.components || {});
    const breakdownHtml = compEntries.map(([k, v]) => {
      const score = v?.score != null ? v.score : v;
      const sign = score > 0 ? '+' : '';
      const cls = score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-400';
      return `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(k)}</span><span class="${cls} font-mono">${sign}${score}</span></div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'glass-card p-4 transition-colors hover:border-bull-accent/30';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-400">#${p.rank}</span>
          <a href="ticker.html?t=${esc(p.ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(p.ticker)}</a>
          <span class="text-xs text-gray-500 font-mono">$${fmt(p.spot_price, 2)}</span>
        </div>
        <div class="flex items-start gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-2xl font-bold font-mono" style="color:${compColor}">${p.composite}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">composite</div>
          </div>
          <button class="db-card-copy p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors" data-ticker="${esc(p.ticker)}" title="Copy ${esc(p.ticker)} for Claude">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
          </button>
        </div>
      </div>

      <div class="composite-bar mb-3">
        <div class="composite-fill" style="width:${compWidth}%; background:${compColor}"></div>
      </div>

      <div class="flex flex-wrap gap-1 mb-3">${paths}</div>

      <div class="grid grid-cols-2 gap-2 text-[12px] mb-3">
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Entry zone</div>
          <div class="text-white font-mono">$${fmt(ent.low, 2)} – $${fmt(ent.high, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Target / Stop</div>
          <div class="text-white font-mono">$${fmt(p.target, 2)} / $${fmt(p.stop, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">R/R</div>
          <div class="font-mono text-green-400">${fmt(p.rr_ratio, 2)}:1</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Suggested size</div>
          <div class="text-white font-mono">$${fmt(p.suggested_size_usd, 0)} (${p.suggested_shares}sh)</div>
        </div>
      </div>

      <div class="text-[11px] text-gray-400 mb-3 leading-relaxed">${esc(p.rationale_one_liner)}</div>

      ${p.oracle_note ? `
      <div class="bg-blue-500/[0.06] border-l-2 border-blue-500/40 pl-2 pr-2 py-1.5 mb-3 rounded-r">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-[9px] uppercase tracking-wider text-blue-400/80">Oracle</span>
          <span class="text-[9px] text-gray-500">${esc(noteAge(p.oracle_note.written_at))}</span>
        </div>
        <div class="text-[11px] text-gray-300 italic leading-relaxed">${esc(p.oracle_note.text || '')}</div>
      </div>` : ''}

      <div class="text-[10px] text-gray-500 flex items-center gap-3 mb-3">
        <span>📅 ${esc(earningsStr)}</span>
        <span>position risk $${fmt(p.position_risk_usd, 2)}</span>
      </div>

      <details class="border-t border-white/[0.06] pt-2">
        <summary class="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 hover:text-white">Component breakdown</summary>
        <div class="mt-2 space-y-1">${breakdownHtml}</div>
      </details>

      ${p.watchlist_thesis ? `
      <details class="border-t border-white/[0.06] pt-2 mt-2">
        <summary class="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 hover:text-white">Watchlist thesis</summary>
        <div class="mt-2 text-[11px] text-gray-400 leading-relaxed">${esc(p.watchlist_thesis)}</div>
      </details>` : ''}
    `;
    return card;
  }

  // Flow-led card — same shape as mainline pick card but with a FLOW-LED pill.
  function renderFlowLedCard(p) {
    const compColor = compositeColor(p.composite);
    const compWidth = compositeWidth(p.composite);
    const ent = p.entry || {};
    const earningsStr = p.earnings_days_away != null
      ? `${p.earnings_date} (${p.earnings_days_away}d)`
      : 'no earnings ≤45d';

    const paths = (p.convergence_paths || []).map(pathBadge).join(' ');

    const compEntries = Object.entries(p.components || {});
    const breakdownHtml = compEntries.map(([k, v]) => {
      const score = v?.score != null ? v.score : v;
      const sign = score > 0 ? '+' : '';
      const cls = score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-400';
      return `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(k)}</span><span class="${cls} font-mono">${sign}${score}</span></div>`;
    }).join('');

    const sourceLabel = (p.source || '').toUpperCase();

    const card = document.createElement('div');
    card.className = 'glass-card p-4 transition-colors hover:border-orange-400/30';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border text-orange-400 bg-orange-500/10 border-orange-500/20">FLOW-LED · ${esc(sourceLabel)}</span>
          <a href="ticker.html?t=${esc(p.ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(p.ticker)}</a>
          <span class="text-xs text-gray-500 font-mono">$${fmt(p.spot_price, 2)}</span>
        </div>
        <div class="flex items-start gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-2xl font-bold font-mono" style="color:${compColor}">${p.composite}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">composite</div>
          </div>
        </div>
      </div>

      <div class="composite-bar mb-3">
        <div class="composite-fill" style="width:${compWidth}%; background:${compColor}"></div>
      </div>

      <div class="flex flex-wrap gap-1 mb-3">${paths}</div>

      <div class="grid grid-cols-2 gap-2 text-[12px] mb-3">
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Entry zone</div>
          <div class="text-white font-mono">$${fmt(ent.low, 2)} – $${fmt(ent.high, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Target / Stop</div>
          <div class="text-white font-mono">$${fmt(p.target, 2)} / $${fmt(p.stop, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">R/R</div>
          <div class="font-mono text-green-400">${fmt(p.rr_ratio, 2)}:1</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Suggested size</div>
          <div class="text-white font-mono">${p.suggested_size_usd != null ? `$${fmt(p.suggested_size_usd, 0)} (${p.suggested_shares}sh)` : '—'}</div>
        </div>
      </div>

      <div class="text-[11px] text-gray-400 mb-3 leading-relaxed">${esc(p.rationale_one_liner)}</div>

      ${p.oracle_note ? `
      <div class="bg-blue-500/[0.06] border-l-2 border-blue-500/40 pl-2 pr-2 py-1.5 mb-3 rounded-r">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-[9px] uppercase tracking-wider text-blue-400/80">Oracle</span>
          <span class="text-[9px] text-gray-500">${esc(noteAge(p.oracle_note.written_at))}</span>
        </div>
        <div class="text-[11px] text-gray-300 italic leading-relaxed">${esc(p.oracle_note.text || '')}</div>
      </div>` : ''}

      <div class="text-[10px] text-gray-500 flex items-center gap-3 mb-3">
        <span>📅 ${esc(earningsStr)}</span>
        ${p.position_risk_usd != null ? `<span>position risk $${fmt(p.position_risk_usd, 2)}</span>` : ''}
      </div>

      ${compEntries.length ? `
      <details class="border-t border-white/[0.06] pt-2">
        <summary class="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 hover:text-white">Component breakdown</summary>
        <div class="mt-2 space-y-1">${breakdownHtml}</div>
      </details>` : ''}
    `;
    return card;
  }

  // Flow-extreme card — same shape as flow-led but red theme (single-axis tier).
  function renderFlowExtremeCard(p) {
    const compColor = compositeColor(p.composite);
    const compWidth = compositeWidth(p.composite);
    const ent = p.entry || {};
    const earningsStr = p.earnings_days_away != null
      ? `${p.earnings_date} (${p.earnings_days_away}d)`
      : 'no earnings ≤45d';

    const paths = (p.convergence_paths || []).map(pathBadge).join(' ');

    const compEntries = Object.entries(p.components || {});
    const breakdownHtml = compEntries.map(([k, v]) => {
      const score = v?.score != null ? v.score : v;
      const sign = score > 0 ? '+' : '';
      const cls = score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-400';
      return `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(k)}</span><span class="${cls} font-mono">${sign}${score}</span></div>`;
    }).join('');

    const sourceLabel = (p.source || '').toUpperCase();

    const card = document.createElement('div');
    card.className = 'glass-card p-4 transition-colors hover:border-red-400/30';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/20">FLOW-EXTREME · ${esc(sourceLabel)}</span>
          <a href="ticker.html?t=${esc(p.ticker)}" class="text-lg font-bold font-mono hover:text-bull-accent transition-colors">${esc(p.ticker)}</a>
          <span class="text-xs text-gray-500 font-mono">$${fmt(p.spot_price, 2)}</span>
        </div>
        <div class="flex items-start gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-2xl font-bold font-mono" style="color:${compColor}">${p.composite}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">composite</div>
          </div>
        </div>
      </div>

      <div class="composite-bar mb-3">
        <div class="composite-fill" style="width:${compWidth}%; background:${compColor}"></div>
      </div>

      <div class="flex flex-wrap gap-1 mb-3">${paths}</div>

      <div class="grid grid-cols-2 gap-2 text-[12px] mb-3">
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Entry zone</div>
          <div class="text-white font-mono">$${fmt(ent.low, 2)} – $${fmt(ent.high, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Target / Stop</div>
          <div class="text-white font-mono">$${fmt(p.target, 2)} / $${fmt(p.stop, 2)}</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">R/R</div>
          <div class="font-mono text-green-400">${fmt(p.rr_ratio, 2)}:1</div>
        </div>
        <div class="bg-white/[0.03] rounded p-2">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Suggested size</div>
          <div class="text-white font-mono">${p.suggested_size_usd != null ? `$${fmt(p.suggested_size_usd, 0)} (${p.suggested_shares}sh)` : '—'}</div>
        </div>
      </div>

      <div class="text-[11px] text-gray-400 mb-3 leading-relaxed">${esc(p.rationale_one_liner)}</div>

      ${p.oracle_note ? `
      <div class="bg-blue-500/[0.06] border-l-2 border-blue-500/40 pl-2 pr-2 py-1.5 mb-3 rounded-r">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-[9px] uppercase tracking-wider text-blue-400/80">Oracle</span>
          <span class="text-[9px] text-gray-500">${esc(noteAge(p.oracle_note.written_at))}</span>
        </div>
        <div class="text-[11px] text-gray-300 italic leading-relaxed">${esc(p.oracle_note.text || '')}</div>
      </div>` : ''}

      <div class="text-[10px] text-gray-500 flex items-center gap-3 mb-3">
        <span>📅 ${esc(earningsStr)}</span>
        ${p.position_risk_usd != null ? `<span>position risk $${fmt(p.position_risk_usd, 2)}</span>` : ''}
      </div>

      ${compEntries.length ? `
      <details class="border-t border-white/[0.06] pt-2">
        <summary class="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 hover:text-white">Component breakdown</summary>
        <div class="mt-2 space-y-1">${breakdownHtml}</div>
      </details>` : ''}
    `;
    return card;
  }

  // Oracle watch card — composite below cutoff but Oracle wants it surfaced.
  // Muted styling, no entry/target/stop, clear "below mechanical cutoff" label.
  function renderWatchCard(w) {
    const card = document.createElement('div');
    card.className = 'rounded-lg p-3 bg-white/[0.02] border border-white/[0.05] opacity-90';
    const paths = (w.convergence_paths || []).map(pathBadge).join(' ') || '<span class="text-[10px] text-gray-600">no paths lit</span>';
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="text-base font-bold text-gray-300">${esc(w.ticker)}</div>
          <div class="text-[9px] text-amber-400/80 uppercase tracking-wider">below mechanical cutoff · oracle-elevated</div>
        </div>
        <div class="text-right text-[11px] font-mono text-gray-400">
          composite ${w.composite}<br/><span class="text-gray-500">$${fmt(w.spot_price, 2)}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-1 mb-2">${paths}</div>
      ${w.oracle_note ? `
      <div class="bg-blue-500/[0.06] border-l-2 border-blue-500/40 pl-2 pr-2 py-1.5 rounded-r">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-[9px] uppercase tracking-wider text-blue-400/80">Oracle</span>
          <span class="text-[9px] text-gray-500">${esc(noteAge(w.oracle_note.written_at))}</span>
        </div>
        <div class="text-[11px] text-gray-300 italic leading-relaxed">${esc(w.oracle_note.text || '')}</div>
      </div>` : ''}
    `;
    return card;
  }

  function copyTicker(data, ticker) {
    const p = (data.picks || []).find(x => x.ticker === ticker);
    if (!p) return Promise.reject();
    const lines = [
      `${p.ticker} — Bull Scouter Deep Buy (${data.date}, rank #${p.rank}, composite ${p.composite})`,
      '',
      `Spot: $${fmt(p.spot_price, 2)}`,
      `Entry: $${fmt(p.entry.low, 2)} - $${fmt(p.entry.high, 2)} (mid $${fmt(p.entry.mid, 2)})`,
      `Target: $${fmt(p.target, 2)}   Stop: $${fmt(p.stop, 2)}   R/R: ${fmt(p.rr_ratio, 2)}:1`,
      `Size: $${fmt(p.suggested_size_usd, 0)} (${p.suggested_shares}sh, position risk $${fmt(p.position_risk_usd, 2)})`,
      `Earnings: ${p.earnings_date || '—'} (${p.earnings_days_away ?? '—'}d)`,
      '',
      `Convergence paths: ${(p.convergence_paths || []).join(', ')}`,
      `Components: ${Object.entries(p.components || {}).map(([k, v]) => `${k} ${v?.score != null ? (v.score > 0 ? '+' : '') + v.score : v}`).join(', ')}`,
      '',
      `Rationale: ${p.rationale_one_liner}`,
    ];
    if (p.oracle_note) {
      lines.push('', `Oracle (${noteAge(p.oracle_note.written_at)}): ${p.oracle_note.text}`);
    }
    return navigator.clipboard.writeText(lines.join('\n'));
  }

  function copyAll(data) {
    const surfaced = (data.picks_count || 0)
      + (data.flow_led_picks || []).length
      + (data.flow_extreme_picks || []).length;
    const header = [
      `Bull Scouter Deep Buy — ${data.date}`,
      `Regime: ${data.regime_label} (${data.regime_score})`,
      `Picks: ${surfaced} surfaced (${data.picks_count} mainline) of ${data.candidates_evaluated} candidates`,
      '',
    ];
    if (data.strategic_context_blocks_new_entries) {
      header.push(`🚫 BLOCKED: ${data.strategic_context_block_reason}`);
      header.push('');
    }
    const rows = (data.picks || []).map(p => {
      const ent = p.entry;
      const base = `#${p.rank} ${p.ticker} comp=${p.composite} @$${fmt(p.spot_price, 2)}  entry=$${fmt(ent.low, 2)}-$${fmt(ent.high, 2)}  target=$${fmt(p.target, 2)}  stop=$${fmt(p.stop, 2)}  RR=${fmt(p.rr_ratio, 2)}:1  earn=${p.earnings_days_away ?? '—'}d  | ${p.rationale_one_liner}`;
      return p.oracle_note ? `${base}\n   Oracle (${noteAge(p.oracle_note.written_at)}): ${p.oracle_note.text}` : base;
    });
    const tierIcons = { 3: '🟢', 2: '🔵', 1: '🟠' };
    const allTiers = [...(data.tier3_picks || []), ...(data.tier2_picks || []), ...(data.tier1_picks || [])];
    const tierRows = allTiers.length ? [
      '', '— Evidence Tiers (primary) —',
      ...allTiers.map(p => {
        const ent = p.entry || {};
        const icon = tierIcons[p.tier] || '·';
        const base = `${icon} T${p.tier} ${p.ticker} [${(p.source || '').toUpperCase()}] comp=${p.composite} size=${p.size_class || '—'} @$${fmt(p.spot_price, 2)}  entry=$${fmt(ent.low, 2)}-$${fmt(ent.high, 2)}  target=$${fmt(p.target, 2)}  stop=$${fmt(p.stop, 2)}  RR=${fmt(p.rr_ratio, 2)}:1  evidence=[${(p.tier_evidence || []).join(',')}]  | ${p.rationale_one_liner}`;
        return p.oracle_note ? `${base}\n   Oracle (${noteAge(p.oracle_note.written_at)}): ${p.oracle_note.text}` : base;
      }),
    ] : [];
    const flowLedRows = !allTiers.length && (data.flow_led_picks || []).length ? [
      '', '— Flow-led picks (separate composite) —',
      ...(data.flow_led_picks || []).map(p => {
        const ent = p.entry || {};
        const base = `⚡ ${p.ticker} [${(p.source || '').toUpperCase()}] comp=${p.composite} @$${fmt(p.spot_price, 2)}  entry=$${fmt(ent.low, 2)}-$${fmt(ent.high, 2)}  target=$${fmt(p.target, 2)}  stop=$${fmt(p.stop, 2)}  RR=${fmt(p.rr_ratio, 2)}:1  | ${p.rationale_one_liner}`;
        return p.oracle_note ? `${base}\n   Oracle (${noteAge(p.oracle_note.written_at)}): ${p.oracle_note.text}` : base;
      }),
    ] : [];
    const flowExtremeRows = !allTiers.length && (data.flow_extreme_picks || []).length ? [
      '', '— Flow-extreme picks (single-axis tier) —',
      ...(data.flow_extreme_picks || []).map(p => {
        const ent = p.entry || {};
        const base = `🔥 ${p.ticker} [${(p.source || '').toUpperCase()}] comp=${p.composite} @$${fmt(p.spot_price, 2)}  entry=$${fmt(ent.low, 2)}-$${fmt(ent.high, 2)}  target=$${fmt(p.target, 2)}  stop=$${fmt(p.stop, 2)}  RR=${fmt(p.rr_ratio, 2)}:1  | ${p.rationale_one_liner}`;
        return p.oracle_note ? `${base}\n   Oracle (${noteAge(p.oracle_note.written_at)}): ${p.oracle_note.text}` : base;
      }),
    ] : [];
    const watchRows = (data.oracle_watch || []).length ? [
      '', '— Oracle watch (below mechanical cutoff) —',
      ...(data.oracle_watch || []).map(w => {
        const note = w.oracle_note ? ` | Oracle (${noteAge(w.oracle_note.written_at)}): ${w.oracle_note.text}` : '';
        return `🔭 ${w.ticker} comp=${w.composite} @$${fmt(w.spot_price, 2)}${note}`;
      }),
    ] : [];
    return navigator.clipboard.writeText([...header, ...rows, ...tierRows, ...flowLedRows, ...flowExtremeRows, ...watchRows].join('\n'));
  }

  function flashCopied(btn) {
    const label = btn?.querySelector('.copy-label');
    const orig = label?.textContent;
    if (label) label.textContent = 'Copied!';
    else { btn.innerHTML = '<span class="text-[10px] text-green-400">✓</span>'; }
    setTimeout(() => {
      if (label && orig) label.textContent = orig;
      else if (btn) btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>';
    }, 1800);
  }

  async function init() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const data = await resp.json();

      $('#db-date').textContent = data.date || '-';
      $('#db-regime').textContent = data.regime_label
        ? `${data.regime_label} (${data.regime_score >= 0 ? '+' : ''}${data.regime_score})`
        : '—';
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = `v${data.version}`;

      // Stats
      const fs = data.filtered_summary || {};
      const filteredTotal = Object.values(fs).reduce((a, b) => a + b, 0);
      // Headline "Picks" = TOTAL surfaced sized orders (mainline + flow_led + flow_extreme),
      // not just mainline picks_count — otherwise it reads "0" while flow_led orders render (#23).
      const surfacedTotal = (data.picks_count || 0)
        + (data.flow_led_picks || []).length
        + (data.flow_extreme_picks || []).length;
      $('#db-stat-picks').textContent = surfacedTotal;
      $('#db-stat-eval').textContent = data.candidates_evaluated || 0;
      $('#db-stat-filtered').textContent = filteredTotal;
      $('#db-stat-held').textContent = fs.held || 0;
      $('#db-stat-earn').textContent = fs.earnings_blackout || 0;
      $('#db-stat-frozen').textContent = fs.frozen || 0;

      // Block warning
      if (data.strategic_context_blocks_new_entries) {
        $('#db-block-reason').textContent = data.strategic_context_block_reason || 'Strategic stance blocks new entries';
        show('db-block-warn');
      }

      // Evidence Tiers (primary, v2.31.0+)
      const t3 = data.tier3_picks || [];
      const t2 = data.tier2_picks || [];
      const t1 = data.tier1_picks || [];
      const hasTiers = t3.length + t2.length + t1.length > 0;

      if (hasTiers) {
        if (t3.length) {
          const c = $('#db-tier3-cards');
          t3.forEach(p => c.appendChild(renderTierCard(p)));
          show('db-tier3-section');
        }
        if (t2.length) {
          const c = $('#db-tier2-cards');
          t2.forEach(p => c.appendChild(renderTierCard(p)));
          show('db-tier2-section');
        }
        if (t1.length) {
          const c = $('#db-tier1-cards');
          t1.forEach(p => c.appendChild(renderTierCard(p)));
          show('db-tier1-section');
        }
        $('#db-stat-t3').textContent = t3.length;
        $('#db-stat-t2').textContent = t2.length;
        $('#db-stat-t1').textContent = t1.length;
        show('db-stat-tiers');
      }

      // Mainline picks (background composite)
      const container = $('#db-cards');
      const picks = data.picks || [];
      picks.forEach(p => container.appendChild(renderCard(p)));
      hide('db-loading');

      // Flow-led / flow-extreme (legacy view — hidden when tier data exists)
      if (!hasTiers) {
        const flowLedPicks = data.flow_led_picks || [];
        const flowLedSection = document.getElementById('db-flow-led-picks');
        if (flowLedPicks.length && flowLedSection) {
          const flowLedContainer = document.getElementById('db-flow-led-cards');
          if (flowLedContainer) {
            flowLedContainer.innerHTML = '';
            flowLedPicks.forEach(p => flowLedContainer.appendChild(renderFlowLedCard(p)));
          }
          flowLedSection.classList.remove('hidden');
        }

        const flowExtremePicks = data.flow_extreme_picks || [];
        const flowExtremeSection = document.getElementById('db-flow-extreme-picks');
        if (flowExtremePicks.length && flowExtremeSection) {
          const flowExtremeContainer = document.getElementById('db-flow-extreme-cards');
          if (flowExtremeContainer) {
            flowExtremeContainer.innerHTML = '';
            flowExtremePicks.forEach(p => flowExtremeContainer.appendChild(renderFlowExtremeCard(p)));
          }
          flowExtremeSection.classList.remove('hidden');
        }
      }

      // Oracle watch sidecar (Task 2b — names below mechanical cutoff that
      // Oracle wants surfaced via rescan + a fresh note). NOT ranked — these
      // are below the cutoff by definition; rendered with muted treatment.
      const watch = data.oracle_watch || [];
      const watchSection = $('#db-oracle-watch');
      if (watch.length && watchSection) {
        const watchContainer = $('#db-oracle-watch-cards');
        if (watchContainer) {
          watchContainer.innerHTML = '';
          watch.forEach(w => watchContainer.appendChild(renderWatchCard(w)));
        }
        watchSection.classList.remove('hidden');
      }

      const hasRenderableRows = picks.length || hasTiers || (!hasTiers && ((data.flow_led_picks || []).length || (data.flow_extreme_picks || []).length)) || watch.length;
      if (!hasRenderableRows && !data.strategic_context_blocks_new_entries) {
        show('db-empty');
      }

      // Per-card copy delegation
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.db-card-copy');
        if (!btn) return;
        e.preventDefault();
        copyTicker(data, btn.dataset.ticker).then(() => flashCopied(btn));
      });

      // Global copy
      $('#btn-copy-all')?.addEventListener('click', (e) => {
        copyAll(data).then(() => flashCopied(e.currentTarget));
      });
    } catch (e) {
      hide('db-loading');
      show('db-error');
      const msg = $('#db-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
