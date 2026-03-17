/**
 * Bull Scouter - Warren's Picks Page
 * Fetches warrens-picks.json and renders quality stock cards with component bar charts.
 */

const WarrensPicks = (() => {
  const DATA_PATH = 'data/warrens-picks.json';

  const COMPONENT_COLORS = {
    roe_quality: '#22c55e',
    debt_safety: '#3b82f6',
    margin_strength: '#a855f7',
    fcf_machine: '#eab308',
    earnings_consistency: '#06b6d4',
    moat_proxy: '#f97316',
    shareholder_return: '#ec4899',
  };

  async function init() {
    const copyBtn = document.getElementById('btn-copy-wp');
    if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();

      hide('wp-loading');

      if (!data.picks || !data.picks.length) {
        show('wp-empty');
        return;
      }

      // Version + date
      const vb = document.getElementById('version-badge');
      if (vb && data.version) vb.textContent = 'v' + data.version;
      const dateEl = document.getElementById('wp-date');
      if (dateEl && data.scan_date) dateEl.textContent = data.scan_date;

      // Stats
      setText('wp-stat-total', data.total_candidates || data.picks.length);
      setText('wp-stat-strong', data.strong_quality || 0);
      setText('wp-stat-quality', data.quality || 0);

      // Render cards
      const container = document.getElementById('wp-cards');
      container.innerHTML = data.picks.map((p, i) => renderCard(p, i)).join('');

      // Store for copy
      window._wpData = data;

    } catch (e) {
      hide('wp-loading');
      show('wp-error');
      const msg = document.getElementById('wp-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  function renderCard(pick, index) {
    const isStrong = pick.recommendation === 'STRONG_QUALITY';
    const borderColor = isStrong ? '#00ff88' : '#f59e0b';
    const recLabel = isStrong ? 'STRONG QUALITY' : 'QUALITY';
    const recClass = isStrong ? 'text-green-400' : 'text-amber-400';

    let html = `<div class="glass-card p-4 overflow-hidden" style="border-left:3px solid ${borderColor}">`;

    // Header
    html += `<div class="flex items-start justify-between mb-3">`;
    html += `<div>`;
    html += `<a href="ticker.html?t=${esc(pick.ticker)}" class="text-lg font-bold font-mono hover:text-green-400 transition-colors">${esc(pick.ticker)}</a>`;
    html += `<span class="text-xs ${recClass} font-semibold ml-2">${recLabel}</span>`;
    html += `</div>`;
    html += `<div class="text-right">`;
    html += `<div class="text-2xl font-black font-mono ${isStrong ? 'text-green-400' : 'text-amber-400'}">${pick.score}</div>`;
    html += `<div class="text-[10px] text-gray-500 uppercase">/ 100</div>`;
    html += `</div>`;
    html += `</div>`;

    // Meta row
    html += `<div class="flex items-center gap-3 text-xs text-gray-400 mb-4">`;
    if (pick.price) html += `<span class="font-mono">$${Number(pick.price).toFixed(2)}</span>`;
    if (pick.market_cap) html += `<span>${fmtMcap(pick.market_cap)}</span>`;
    if (pick.sector) html += `<span class="text-gray-500">${esc(pick.sector)}</span>`;
    html += `</div>`;

    // Component bars
    if (pick.components && pick.components.length) {
      html += `<div class="space-y-2">`;
      for (const c of pick.components) {
        const color = COMPONENT_COLORS[c.key] || '#6b7280';
        const pct = Math.min(c.pct || 0, 100);
        html += `<div>`;
        html += `<div class="flex justify-between text-[11px] mb-0.5">`;
        html += `<span class="text-gray-400">${esc(c.label)}</span>`;
        html += `<span class="font-mono" style="color:${color}">${c.score}/${c.max}</span>`;
        html += `</div>`;
        html += `<div class="wp-bar-bg"><div class="wp-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  function copyData(copyBtn) {
    const data = window._wpData;
    if (!data || !data.picks || !data.picks.length) return;

    const lines = data.picks.map((p, i) => {
      const parts = [`${p.ticker} (${p.recommendation})`];
      parts.push(`Score: ${p.score}/100`);
      if (p.price) parts.push(`$${Number(p.price).toFixed(2)}`);
      if (p.market_cap) parts.push(`MCap: ${fmtMcap(p.market_cap)}`);
      if (p.sector) parts.push(`Sector: ${p.sector}`);
      if (p.components) {
        const comps = p.components.map(c => `${c.label}: ${c.score}/${c.max}`).join(', ');
        parts.push(`Components: ${comps}`);
      }
      return parts.join(' | ');
    });

    const header = `Warren's Picks (Buffett Quality Screen) - ${data.scan_date || 'today'}\n` +
      `${data.total_candidates} total: ${data.strong_quality} STRONG_QUALITY, ${data.quality} QUALITY\n\n`;

    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy'; }, 2000);
    });
  }

  // Helpers

  function fmtMcap(val) {
    if (!val) return '';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(0) + 'M';
    return '$' + val.toLocaleString();
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
