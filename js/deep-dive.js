/**
 * Bull Scouter - Deep Dive Page
 * Fetches deep-dive.json and renders Opus analysis cards.
 */

const DeepDive = (() => {
  const DATA_PATH = 'data/deep-dive.json';

  // ── Init ──

  async function init() {
    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      hide('dd-loading');
      if (!data.analyses || data.analyses.length === 0) {
        show('dd-empty');
        return;
      }
      renderPage(data);
    } catch (e) {
      hide('dd-loading');
      show('dd-error');
      const msg = document.getElementById('dd-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  // ── Render ──

  function renderPage(data) {
    document.getElementById('dd-date').textContent = data.scan_date || '-';
    document.getElementById('dd-count').textContent = data.analyses.length;

    const container = document.getElementById('dd-cards');
    container.innerHTML = '';
    for (const a of data.analyses) {
      container.appendChild(renderCard(a));
    }
  }

  function renderCard(a) {
    const card = el('div', 'dd-card');

    // Recommendation color class
    const rec = (a.recommendation || '').toUpperCase();
    if (rec === 'BUY') card.classList.add('buy');
    else if (rec === 'WATCHLIST') card.classList.add('watchlist');

    // Header row
    const header = el('div', 'dd-card-header');
    const tickerEl = el('div', 'dd-ticker');
    tickerEl.innerHTML =
      `<span class="text-lg font-bold font-mono">${esc(a.ticker)}</span>` +
      `<span class="text-sm text-gray-400 ml-2">${esc(a.name || '')}</span>`;
    header.appendChild(tickerEl);

    const badges = el('div', 'flex items-center gap-2');
    badges.innerHTML =
      `<span class="text-sm font-mono">$${fmt(a.price)}</span>` +
      `<span class="dd-rec-badge ${rec.toLowerCase()}">${rec}</span>` +
      `<span class="dd-score-badge">${a.bull_scouter_score || '-'}</span>`;
    header.appendChild(badges);
    card.appendChild(header);

    // Frameworks side by side
    const fwRow = el('div', 'dd-fw-row');
    if (a.value_framework) {
      fwRow.appendChild(renderFramework('Value Framework', a.value_framework, [
        ['profitable', 'Profitable'],
        ['strong_fcf', 'Strong FCF'],
        ['near_52w_lows', 'Near 52w Lows'],
        ['sector_panic', 'Sector Panic'],
        ['low_pe_vs_history', 'Low PE vs History'],
        ['no_dilution', 'No Dilution'],
      ]));
    }
    if (a.growth_framework) {
      fwRow.appendChild(renderFramework('Growth Framework', a.growth_framework, [
        ['revenue_growth_30', '30%+ Rev Growth'],
        ['gross_margins_60', '60%+ Margins'],
        ['nrr_120', '120%+ NRR'],
        ['tam_under_10', '<10% TAM'],
        ['rule_of_40', 'Rule of 40'],
        ['low_sbc', 'Low SBC'],
      ]));
    }
    card.appendChild(fwRow);

    // Financials
    if (a.financials) {
      const fin = a.financials;
      const section = el('div', 'dd-section');
      section.innerHTML =
        `<div class="dd-section-title">Financials</div>` +
        `<div class="dd-fin-grid">` +
        finItem('Price', '$' + fmt(fin.current_price)) +
        finItem('52w Range', fin.range_52w || '-') +
        finItem('Forward PE', fin.forward_pe ? fin.forward_pe + 'x' : '-') +
        finItem('Hist. PE', fin.historical_pe_avg || '-') +
        `</div>`;
      card.appendChild(section);
    }

    // Catalysts
    if (a.catalysts && a.catalysts.length > 0) {
      const section = el('div', 'dd-section');
      section.innerHTML =
        `<div class="dd-section-title">Catalysts</div>` +
        `<ul class="dd-list">${a.catalysts.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
      card.appendChild(section);
    }

    // Downside Scenarios
    if (a.downside_scenarios && a.downside_scenarios.length > 0) {
      card.appendChild(renderDownside(a.downside_scenarios));
    }

    // Ideal Entry
    if (a.ideal_entry) {
      const section = el('div', 'dd-section');
      section.innerHTML =
        `<div class="dd-section-title">Ideal Entry: $${fmt(a.ideal_entry.price)}</div>` +
        `<p class="text-sm text-gray-400">${esc(a.ideal_entry.reasoning || '')}</p>`;
      card.appendChild(section);
    }

    // Comparables
    if (a.comparables && a.comparables.length > 0) {
      card.appendChild(renderComparables(a.comparables));
    }

    // Opus Take
    if (a.analyst_take) {
      const section = el('div', 'dd-section dd-take');
      section.innerHTML =
        `<div class="dd-section-title">Opus Take</div>` +
        `<p class="text-sm text-gray-300 italic">"${esc(a.analyst_take)}"</p>`;
      card.appendChild(section);
    }

    return card;
  }

  // ── Framework table ──

  function renderFramework(title, fw, criteria) {
    const wrap = el('div', 'dd-fw');
    let rows = '';
    for (const [key, label] of criteria) {
      const item = fw[key];
      if (!item) continue;
      rows += `<tr>
        <td class="dd-fw-icon">${verdictIcon(item.verdict)}</td>
        <td class="dd-fw-label">${esc(label)}</td>
        <td class="dd-fw-detail">${esc(item.detail || '')}</td>
      </tr>`;
    }

    const score = fw.score != null ? fw.score : '-';
    const scoreClass = score >= 5 ? 'text-green-400' : score >= 3 ? 'text-amber-400' : 'text-red-400';

    wrap.innerHTML =
      `<div class="dd-fw-title">${esc(title)}</div>` +
      `<table class="dd-fw-table"><tbody>${rows}</tbody></table>` +
      `<div class="dd-fw-score ${scoreClass}">Score: ${score}/6</div>`;
    return wrap;
  }

  function verdictIcon(v) {
    if (v === 'pass') return '<span class="text-green-400">&#x2705;</span>';
    if (v === 'fail') return '<span class="text-red-400">&#x274C;</span>';
    return '<span class="text-amber-400">&#x26A0;&#xFE0F;</span>';
  }

  // ── Downside table ──

  function renderDownside(scenarios) {
    const section = el('div', 'dd-section');
    let rows = '';
    for (const s of scenarios) {
      rows += `<tr>
        <td class="font-mono text-red-400">$${fmt(s.price)}</td>
        <td class="font-mono text-gray-400">${s.pe_at_level || '-'}x</td>
        <td class="text-gray-400">${esc(s.scenario || '')}</td>
      </tr>`;
    }
    section.innerHTML =
      `<div class="dd-section-title">Downside Scenarios</div>` +
      `<table class="dd-ds-table"><thead><tr>` +
      `<th>Price</th><th>PE</th><th>Scenario</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>`;
    return section;
  }

  // ── Comparables table ──

  function renderComparables(comps) {
    const section = el('div', 'dd-section');
    let rows = '';
    for (const c of comps) {
      rows += `<tr>
        <td class="font-mono font-bold">${esc(c.ticker)}</td>
        <td class="font-mono">${c.forward_pe || '-'}x</td>
        <td class="font-mono">${esc(c.growth || '-')}</td>
        <td class="text-gray-400">${esc(c.note || '')}</td>
      </tr>`;
    }
    section.innerHTML =
      `<div class="dd-section-title">Comparables</div>` +
      `<table class="dd-comp-table"><thead><tr>` +
      `<th>Ticker</th><th>Fwd PE</th><th>Growth</th><th>Note</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>`;
    return section;
  }

  // ── Helpers ──

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function fmt(n) {
    if (n == null) return '-';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function finItem(label, value) {
    return `<div class="dd-fin-item"><span class="text-gray-500">${label}</span><span class="font-mono">${value}</span></div>`;
  }

  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
