/**
 * Bull Scouter - Watchlist Dip Scanner Page
 * Fetches watchlist.json and renders stocks + alerts.
 */

const Watchlist = (() => {
  const DATA_URL = 'data/watchlist.json';

  const ALERT_COLORS = {
    DEEP_VALUE: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: '#ef4444' },
    DIP:        { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '#f59e0b' },
    ABS_TARGET: { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', border: '#22c55e' },
    ENTRY_ZONE: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '#3b82f6' },
  };

  const PRIORITY_COLORS = {
    CRITICAL: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    HIGH:     { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    NORMAL:   { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  };

  let pageData = null;

  function init() {
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(render)
      .catch(err => {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-msg').textContent = err.message;
      });
  }

  function render(data) {
    pageData = data;
    document.getElementById('loading-state').classList.add('hidden');

    // Copy button
    const copyBtn = document.getElementById('btn-copy-watchlist');
    if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

    // Version + date
    const vb = document.getElementById('version-badge');
    if (vb && data.version) vb.textContent = `v${data.version}`;
    const dn = document.getElementById('wl-date-nav');
    if (dn && data.scan_date) dn.textContent = data.scan_date + (data.scan_time ? ' ' + data.scan_time : '');

    // Stats
    const stats = data.stats || {};
    setText('stat-stocks', stats.stocks_monitored || 0);
    setText('stat-alerts', stats.recent_alerts || 0);
    setText('stat-tickers', stats.tickers_alerted || 0);

    const stocks = data.stocks || [];
    const alerts = data.alerts || [];
    const alertsByTicker = data.alerts_by_ticker || {};

    if (!stocks.length && !alerts.length) {
      document.getElementById('empty-state').classList.remove('hidden');
      return;
    }

    // Recent Alerts cards
    if (alerts.length) {
      document.getElementById('section-alerts').classList.remove('hidden');
      const container = document.getElementById('cards-alerts');
      container.innerHTML = alerts.slice(0, 12).map(renderAlertCard).join('');
    }

    // Stocks table
    if (stocks.length) {
      document.getElementById('section-stocks').classList.remove('hidden');
      const tbody = document.getElementById('tbody-stocks');
      tbody.innerHTML = stocks.map(s => renderStockRow(s, alertsByTicker)).join('');
    }
  }

  function renderAlertCard(a) {
    const ac = ALERT_COLORS[a.alert_type] || ALERT_COLORS.DIP;
    const pc = PRIORITY_COLORS[a.priority] || PRIORITY_COLORS.NORMAL;
    const borderStyle = a.priority === 'CRITICAL' ? 'border-left:3px solid #ef4444'
                      : a.priority === 'HIGH' ? 'border-left:3px solid #f59e0b'
                      : '';
    const ts = a.created_at ? a.created_at.slice(0, 16).replace('T', ' ') : '';

    return `
      <div class="opp-card" style="${borderStyle}">
        <div class="flex items-start justify-between mb-2">
          <a href="https://finance.yahoo.com/quote/${esc(a.ticker)}" target="_blank" rel="noopener" class="text-lg font-bold hover:text-green-400 transition-colors">${esc(a.ticker)}</a>
          <span class="profile-badge" style="background:${pc.bg};color:${pc.color}">${a.priority}</span>
        </div>
        <div class="flex flex-wrap gap-1 mb-2">
          <span class="profile-badge" style="background:${ac.bg};color:${ac.color}">${a.alert_type}</span>
          ${a.price ? `<span class="text-xs text-gray-400">$${a.price.toFixed(2)}</span>` : ''}
          ${a.high_5d ? `<span class="text-xs text-gray-500">5d High: $${a.high_5d.toFixed(2)}</span>` : ''}
        </div>
        <div class="text-xs text-gray-600">${ts}</div>
      </div>`;
  }

  function renderStockRow(s, alertsByTicker) {
    const count = alertsByTicker[s.ticker] || 0;
    const countBadge = count > 0
      ? `<span class="profile-badge" style="background:rgba(245,158,11,0.15);color:#fbbf24">${count}</span>`
      : '<span class="text-gray-600">0</span>';

    const entry = (s.entry_low && s.entry_high)
      ? `$${s.entry_low.toFixed(2)} - $${s.entry_high.toFixed(2)}`
      : '-';

    const thesis = s.thesis
      ? `<span title="${esc(s.thesis)}">${esc(s.thesis.slice(0, 40))}${s.thesis.length > 40 ? '...' : ''}</span>`
      : '-';

    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-900/50">
        <td class="py-2 pr-4 font-bold text-gray-200"><a href="https://finance.yahoo.com/quote/${esc(s.ticker)}" target="_blank" rel="noopener" class="hover:text-green-400 transition-colors">${esc(s.ticker)}</a></td>
        <td class="py-2 pr-4 text-gray-400">${esc(s.name || '-')}</td>
        <td class="py-2 pr-4 text-gray-400">${esc(s.profile || '-')}</td>
        <td class="py-2 pr-4">${s.abs_target ? '$' + s.abs_target.toFixed(2) : '-'}</td>
        <td class="py-2 pr-4 text-gray-400">${entry}</td>
        <td class="py-2 pr-4 text-gray-400">${s.fwd_pe ? s.fwd_pe.toFixed(1) : '-'}</td>
        <td class="py-2 pr-4 text-gray-500 text-xs" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${thesis}</td>
        <td class="py-2">${countBadge}</td>
      </tr>`;
  }

  function copyData(copyBtn) {
    if (!pageData) return;
    const alerts = pageData.alerts || [];
    const stocks = pageData.stocks || [];
    const parts = [];
    if (alerts.length) {
      parts.push(`ALERTS (${alerts.length}):`);
      for (const a of alerts) {
        const line = [a.ticker, a.alert_type, a.priority];
        if (a.price) line.push(`$${a.price.toFixed(2)}`);
        if (a.created_at) line.push(a.created_at.slice(0, 16).replace('T', ' '));
        parts.push('  ' + line.join(' | '));
      }
      parts.push('');
    }
    if (stocks.length) {
      parts.push(`WATCHLIST (${stocks.length}):`);
      for (const s of stocks) {
        const line = [s.ticker];
        if (s.name) line.push(s.name);
        if (s.profile) line.push(s.profile);
        if (s.abs_target) line.push(`Target: $${s.abs_target.toFixed(2)}`);
        if (s.entry_low && s.entry_high) line.push(`Entry: $${s.entry_low.toFixed(2)}-$${s.entry_high.toFixed(2)}`);
        if (s.thesis) line.push(s.thesis);
        parts.push('  ' + line.join(' | '));
      }
    }
    const header = `Bull Scouter Entry Opps — ${pageData.scan_date || 'today'}\n`;
    navigator.clipboard.writeText(header + parts.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy for Claude'; }, 2000);
    });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init };
})();
