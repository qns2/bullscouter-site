/**
 * Bull Scouter - Contrarian Scanner Page
 * Fetches contrarian.json and renders candidates + filings.
 */

const Contrarian = (() => {
  const DATA_URL = 'data/contrarian.json';

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
    document.getElementById('loading-state').classList.add('hidden');

    // Version + date
    const vb = document.getElementById('version-badge');
    if (vb && data.version) vb.textContent = `v${data.version}`;
    const dn = document.getElementById('ct-date-nav');
    if (dn && data.scan_date) dn.textContent = data.scan_date;

    // Stats
    const stats = data.stats || {};
    setText('stat-total', stats.total_candidates || 0);
    setText('stat-strong', stats.strong_candidates || 0);
    setText('stat-regular', stats.regular_candidates || 0);
    setText('stat-filings', stats.recent_filings || 0);

    const strong = data.strong_candidates || [];
    const candidates = data.candidates || [];
    const filings = data.filings || [];

    if (!strong.length && !candidates.length && !filings.length) {
      document.getElementById('empty-state').classList.remove('hidden');
      return;
    }

    // Strong Candidates cards
    if (strong.length) {
      document.getElementById('section-strong').classList.remove('hidden');
      const container = document.getElementById('cards-strong');
      container.innerHTML = strong.map(renderStrongCard).join('');
    }

    // Candidates table
    if (candidates.length) {
      document.getElementById('section-candidates').classList.remove('hidden');
      const tbody = document.getElementById('tbody-candidates');
      tbody.innerHTML = candidates.map(renderCandidateRow).join('');
    }

    // Filings table
    if (filings.length) {
      document.getElementById('section-filings').classList.remove('hidden');
      const tbody = document.getElementById('tbody-filings');
      tbody.innerHTML = filings.map(renderFilingRow).join('');
    }
  }

  function renderStrongCard(c) {
    const bd = c.breakdown || {};
    const chips = [
      { label: 'Val', value: bd.value, color: 'text-amber-400' },
      { label: 'Qual', value: bd.quality, color: 'text-blue-400' },
      { label: 'Act', value: bd.activist_potential, color: 'text-purple-400' },
      { label: 'Ins', value: bd.insider_signal, color: 'text-cyan-400' },
      { label: 'Sqz', value: bd.squeeze, color: 'text-red-400' },
    ].filter(ch => ch.value > 0)
     .map(ch => `<span class="chip positive">${ch.label}: ${ch.value}</span>`)
     .join(' ');

    const activist = c.has_activist_filing
      ? `<div class="mt-2"><span class="profile-badge" style="background:rgba(168,85,247,0.15);color:#c4b5fd">Activist Filing</span>${c.activist_names ? ` <span class="text-xs text-gray-500">${esc(c.activist_names)}</span>` : ''}</div>`
      : '';

    return `
      <div class="opp-card" style="border-left:3px solid #22c55e">
        <div class="flex items-start justify-between mb-2">
          <div>
            <span class="text-lg font-bold">${esc(c.ticker)}</span>
            <span class="text-xs text-gray-500 ml-2">${esc(c.market_cap_fmt)}</span>
          </div>
          <div class="score-badge buy">${c.score}</div>
        </div>
        <div class="text-xs text-gray-400 mb-2">
          ${c.down_from_high_pct ? `Down ${c.down_from_high_pct}% from high` : ''}
          ${c.current_price ? ` &middot; $${c.current_price.toFixed(2)}` : ''}
        </div>
        <div class="flex flex-wrap gap-1">${chips}</div>
        ${activist}
      </div>`;
  }

  function renderCandidateRow(c) {
    const bd = c.breakdown || {};
    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-900/50">
        <td class="py-2 pr-4 font-bold text-gray-200">${esc(c.ticker)}</td>
        <td class="py-2 pr-4"><span class="text-amber-400 font-bold">${c.score}</span></td>
        <td class="py-2 pr-4">${c.down_from_high_pct ? c.down_from_high_pct + '%' : '-'}</td>
        <td class="py-2 pr-4 text-gray-400">${esc(c.market_cap_fmt)}</td>
        <td class="py-2 pr-4 text-gray-400">${bd.value || '-'}</td>
        <td class="py-2 pr-4 text-gray-400">${bd.quality || '-'}</td>
        <td class="py-2 pr-4 text-gray-400">${bd.activist_potential || '-'}</td>
        <td class="py-2 pr-4 text-gray-400">${bd.insider_signal || '-'}</td>
        <td class="py-2 text-gray-400">${bd.squeeze || '-'}</td>
      </tr>`;
  }

  function renderFilingRow(f) {
    const activistBadge = f.is_activist
      ? '<span class="profile-badge" style="background:rgba(168,85,247,0.15);color:#c4b5fd">Yes</span>'
      : '<span class="text-gray-600">No</span>';

    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-900/50">
        <td class="py-2 pr-4 text-gray-300">${esc(f.filer_name)}</td>
        <td class="py-2 pr-4"><span class="profile-badge" style="background:rgba(59,130,246,0.15);color:#93c5fd">${esc(f.filing_type)}</span></td>
        <td class="py-2 pr-4 font-bold text-gray-200">${esc(f.subject_ticker || f.subject_company || '-')}</td>
        <td class="py-2 pr-4 text-gray-400">${esc(f.filed_date)}</td>
        <td class="py-2 pr-4 text-gray-400">${esc(f.filer_style || '-')}</td>
        <td class="py-2">${activistBadge}</td>
      </tr>`;
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
