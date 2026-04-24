/**
 * Bull Scouter — Options Deep page.
 *
 * Loads data/options-deep.json and renders two sections:
 *   - My Stocks (held positions)
 *   - Bull Scouter universe (scanner watchlist)
 *
 * Each row shows: ticker, flow signal, bullish streak, skew direction,
 * skew magnitude, GEX sign, zero-γ buffer, and earnings date.
 */

(() => {
  const DATA_URL = 'data/options-deep.json?_cb=' + Date.now();

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

  // ---------- cell renderers ----------

  function flowCell(flow) {
    const s = flow?.score;
    if (s == null) return '<span class="chip chip-muted">no data</span>';
    const abs = Math.abs(s);
    let cls = 'chip-muted', icon = '⚖️';
    if (s > 5) { cls = 'chip-bull'; icon = '🚀'; }
    else if (s > 2) { cls = 'chip-bull'; icon = '🟢'; }
    else if (s < -5) { cls = 'chip-bear'; icon = '🚨'; }
    else if (s < -2) { cls = 'chip-bear'; icon = '🔴'; }
    const conf = flow.td_confirmed ? ' <span style="color:#00ff88" title="ThetaData-confirmed">✓</span>' : '';
    const days = flow.days_ago == null ? '' : ` <span class="text-[10px] text-gray-500">${flow.days_ago === 0 ? 'today' : flow.days_ago + 'd'}</span>`;
    return `<span class="chip ${cls}">${icon} ${s > 0 ? '+' : ''}${fmt(s)}</span>${conf}${days}`;
  }

  function streakCell(flow) {
    const s = flow?.bullish_streak || 0;
    if (s === 0) return '<span class="text-gray-600 text-xs">—</span>';
    return `<span class="streak-num">🔥 ${s}d</span>`;
  }

  function skewDirCell(skew) {
    if (!skew) return '<span class="chip chip-muted">—</span>';
    const d = skew.direction;  // 'bullish' | 'bearish' | 'neutral'
    const rr = skew.risk_reversal_vp;
    if (d === 'bullish') {
      return `<span class="chip chip-bull">📈 BULL ${rr != null ? '+' + fmt(rr) : ''}</span>`;
    }
    if (d === 'bearish') {
      return `<span class="chip chip-bear">📉 BEAR ${rr != null ? fmt(rr) : ''}</span>`;
    }
    return '<span class="chip chip-muted">NEUTRAL</span>';
  }

  function skewMagCell(skew) {
    if (!skew) return '<span class="chip chip-muted">—</span>';
    const m = skew.magnitude;
    if (m === 'extreme') return '<span class="chip chip-danger">⚠ EXTREME</span>';
    if (m === 'moderate') return '<span class="chip chip-warn">MODERATE</span>';
    return '<span class="chip chip-muted">NORMAL</span>';
  }

  function gexCell(gex) {
    if (!gex) return '<span class="chip chip-muted">—</span>';
    const r = gex.regime;  // 'long_gamma' | 'neutral' | 'short_gamma'
    const gex_m = gex.total_gex_usd / 1e6;
    if (r === 'long_gamma') {
      return `<span class="chip chip-bull">🟢 LONG γ <span class="text-[10px] opacity-70">$${gex_m >= 0 ? '+' : ''}${fmt(gex_m)}M</span></span>`;
    }
    if (r === 'short_gamma') {
      return `<span class="chip chip-bear">🔴 SHORT γ <span class="text-[10px] opacity-70">${fmt(gex_m)}M</span></span>`;
    }
    return `<span class="chip chip-muted">NEUTRAL <span class="text-[10px] opacity-70">${fmt(gex_m)}M</span></span>`;
  }

  function zeroGammaCell(gex) {
    if (!gex) return '<span class="chip chip-muted">—</span>';
    const buf = gex.buffer;  // 'safe' | 'caution' | 'danger'
    const d = gex.zero_gamma_distance_pct;
    const zg = gex.zero_gamma_level;
    const label = buf === 'safe' ? '🛡 SAFE' : buf === 'caution' ? '⚠ CAUTION' : '🚨 DANGER';
    const cls = buf === 'safe' ? 'chip-bull' : buf === 'caution' ? 'chip-warn' : 'chip-danger';
    return `<span class="chip ${cls}">${label} ${fmt(d)}%</span><div class="text-[10px] text-gray-500 mt-0.5">Γ₀ $${fmt(zg, 2)}</div>`;
  }

  function earningsCell(e) {
    if (!e) return '<span class="text-gray-600 text-xs">—</span>';
    // Accept 'YYYY-MM-DD' or ISO datetime; parse first 10 chars
    const dateStr = String(e).slice(0, 10);
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return `<span class="text-xs text-gray-400">${esc(dateStr)}</span>`;
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((d - today) / (86400 * 1000));
    let cls = 'text-gray-400';
    if (days < 0) cls = 'text-gray-600';
    else if (days <= 3) cls = 'text-red-300';
    else if (days <= 14) cls = 'text-amber-400';
    else if (days <= 45) cls = 'text-blue-400';
    return `<span class="text-xs ${cls}">${esc(dateStr)} <span class="text-gray-500">(${days >= 0 ? days + 'd' : 'passed'})</span></span>`;
  }

  function rowClass(flow) {
    const s = flow?.score;
    if (s == null) return 'row-no-data';
    if (s > 5) return 'row-strong-bull';
    if (s > 2) return 'row-bull';
    if (s < -5) return 'row-strong-bear';
    if (s < -2) return 'row-bear';
    return 'row-neutral';
  }

  function renderRow(entry) {
    return `
      <div class="deep-row ${rowClass(entry.flow)}">
        <div class="tk" data-label="Ticker"><a href="ticker.html?t=${esc(entry.ticker)}" class="hover:text-bull-accent">${esc(entry.ticker)}</a></div>
        <div class="flow" data-label="Flow">${flowCell(entry.flow)}</div>
        <div data-label="Streak">${streakCell(entry.flow)}</div>
        <div data-label="Skew dir">${skewDirCell(entry.skew)}</div>
        <div data-label="Skew mag">${skewMagCell(entry.skew)}</div>
        <div data-label="GEX">${gexCell(entry.gex)}</div>
        <div data-label="Zero-γ">${zeroGammaCell(entry.gex)}</div>
        <div data-label="Earnings">${earningsCell(entry.earnings_date)}</div>
      </div>`;
  }

  function renderSection(entries, containerId, countId) {
    const c = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = `(${entries.length})`;
    if (!entries.length) {
      c.innerHTML = '<p class="text-bull-muted text-sm italic">No data.</p>';
      return;
    }
    c.innerHTML = entries.map(renderRow).join('');
  }

  // ---------- Copy for Claude ----------

  function _formatRows(rows) {
    return rows.map(e => {
      const flow = e.flow?.score != null ? `flow ${e.flow.score > 0 ? '+' : ''}${fmt(e.flow.score)}` : 'no flow';
      const streak = e.flow?.bullish_streak ? `🔥${e.flow.bullish_streak}d` : '';
      const skew = e.skew ? `skew ${e.skew.direction} ${fmt(e.skew.risk_reversal_vp)}vp (${e.skew.magnitude})` : '';
      const gex = e.gex ? `${e.gex.regime} Γ₀${fmt(e.gex.zero_gamma_distance_pct)}% ${e.gex.buffer}` : '';
      const earn = e.earnings_date ? `E:${String(e.earnings_date).slice(0,10)}` : '';
      return [e.ticker, flow, streak, skew, gex, earn].filter(Boolean).join(' | ');
    });
  }

  function copyList(data, which) {
    // which: 'mine' | 'bullscouter' | 'all'
    const header = `Bull Scouter Options Deep — ${data.date} (provider: ${data.provider})`;
    let lines = [header, ''];
    if (which === 'mine') {
      lines.push(`== MY STOCKS (${(data.mine || []).length}) ==`);
      lines = lines.concat(_formatRows(data.mine || []));
    } else if (which === 'bullscouter') {
      lines.push(`== BULL SCOUTER UNIVERSE (${(data.bullscouter || []).length}) ==`);
      lines = lines.concat(_formatRows(data.bullscouter || []));
    } else {
      lines.push(`Mine: ${data.counts.mine} · Bull Scouter: ${data.counts.bullscouter}`, '');
      lines.push('== MY STOCKS ==');
      lines = lines.concat(_formatRows(data.mine || []));
      lines.push('', '== BULL SCOUTER ==');
      lines = lines.concat(_formatRows(data.bullscouter || []));
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

      renderSection(data.mine || [], 'od-mine', 'od-mine-count');
      renderSection(data.bullscouter || [], 'od-bs', 'od-bs-count');

      hide('od-loading');

      // Global copy (all)
      const globalBtn = document.getElementById('btn-copy-od');
      globalBtn?.addEventListener('click', () => {
        copyList(data, 'all').then(() => flashCopied(globalBtn));
      });

      // Per-list copy buttons
      document.querySelectorAll('.od-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const which = btn.dataset.copyList;
          copyList(data, which).then(() => flashCopied(btn));
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
