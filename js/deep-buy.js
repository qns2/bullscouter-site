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

  function pathBadge(p) {
    const labels = {
      path1_buy: ['Path 1 BUY', 'green'],
      path3_strong_candidate: ['Path 3 strong', 'amber'],
      path5_strong_quality: ['Buffett quality', 'blue'],
      flow_sustained: ['Flow sustained', 'green'],
      skew_bullish: ['Skew bull', 'green'],
      gex_long_safe: ['GEX safe', 'green'],
      catalyst_near: ['Catalyst <14d', 'amber'],
      insider_buy: ['Insider buy', 'green'],
      activist_filing: ['Activist 13D', 'amber'],
    };
    const [label, color] = labels[p] || [p, 'gray'];
    const cls = {
      green: 'text-green-400 bg-green-500/10 border-green-500/20',
      amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      gray: 'text-gray-400 bg-white/5 border-white/10',
    }[color];
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded border ${cls}">${esc(label)}</span>`;
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
    return navigator.clipboard.writeText(lines.join('\n'));
  }

  function copyAll(data) {
    const header = [
      `Bull Scouter Deep Buy — ${data.date}`,
      `Regime: ${data.regime_label} (${data.regime_score})`,
      `Picks: ${data.picks_count} of ${data.candidates_evaluated} candidates`,
      '',
    ];
    if (data.strategic_context_blocks_new_entries) {
      header.push(`🚫 BLOCKED: ${data.strategic_context_block_reason}`);
      header.push('');
    }
    const rows = (data.picks || []).map(p => {
      const ent = p.entry;
      return `#${p.rank} ${p.ticker} comp=${p.composite} @$${fmt(p.spot_price, 2)}  entry=$${fmt(ent.low, 2)}-$${fmt(ent.high, 2)}  target=$${fmt(p.target, 2)}  stop=$${fmt(p.stop, 2)}  RR=${fmt(p.rr_ratio, 2)}:1  earn=${p.earnings_days_away ?? '—'}d  | ${p.rationale_one_liner}`;
    });
    return navigator.clipboard.writeText([...header, ...rows].join('\n'));
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
      $('#db-stat-picks').textContent = data.picks_count || 0;
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

      // Cards
      const container = $('#db-cards');
      const picks = data.picks || [];
      if (!picks.length) {
        hide('db-loading');
        if (!data.strategic_context_blocks_new_entries) show('db-empty');
        return;
      }
      picks.forEach(p => container.appendChild(renderCard(p)));
      hide('db-loading');

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
