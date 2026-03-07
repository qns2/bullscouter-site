/**
 * Bull Scouter - Deep Dive Page
 * Fetches deep-dive.json and renders Opus analysis cards.
 * Cards grouped by recommendation (BUY / WATCHLIST / AVOID),
 * with Value/Growth filter tabs and sort controls.
 */

const DeepDive = (() => {
  const DATA_PATH = 'data/deep-dive.json';
  let pageData = null;
  let allPicks = [];
  let activeFilter = 'all';

  // Framework criteria labels per path
  const VALUE_CRITERIA = [
    ['fcf_yield', 'FCF Yield'],
    ['pe_discount', 'PE Discount'],
    ['drawdown', 'Drawdown'],
    ['balance_sheet', 'Balance Sheet'],
    ['dividend', 'Dividend'],
    ['institutional', 'Institutional'],
  ];

  const GROWTH_CRITERIA = [
    ['revenue_growth', 'Revenue Growth'],
    ['gross_margins', 'Gross Margins'],
    ['rule_of_40', 'Rule of 40'],
    ['earnings_accel', 'Earnings Accel'],
    ['capital_efficiency', 'Capital Efficiency'],
    ['short_dynamics', 'SI Dynamics'],
  ];

  // Legacy criteria (old format)
  const LEGACY_VALUE_CRITERIA = [
    ['profitable', 'Profitable'],
    ['strong_fcf', 'Strong FCF'],
    ['near_52w_lows', 'Near 52w Lows'],
    ['sector_panic', 'Sector Panic'],
    ['low_pe_vs_history', 'Low PE vs History'],
    ['no_dilution', 'No Dilution'],
  ];

  const LEGACY_GROWTH_CRITERIA = [
    ['revenue_growth_30', '30%+ Rev Growth'],
    ['gross_margins_60', '60%+ Margins'],
    ['nrr_120', '120%+ NRR'],
    ['tam_under_10', '<10% TAM'],
    ['rule_of_40', 'Rule of 40'],
    ['low_sbc', 'Low SBC'],
  ];

  // ── Init ──

  async function init() {
    // Copy button
    const copyBtn = document.getElementById('btn-copy-dd');
    if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

    // Filter tabs
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderCards();
      });
    });

    // Sort buttons
    document.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bar = btn.closest('.sort-bar');
        bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCards();
      });
    });

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      pageData = data;
      hide('dd-loading');

      // Collect all picks with path metadata
      allPicks = [];
      if (data.value_picks) {
        for (const p of data.value_picks) {
          p._path = 'value';
          allPicks.push(p);
        }
      }
      if (data.growth_picks) {
        for (const p of data.growth_picks) {
          p._path = 'growth';
          allPicks.push(p);
        }
      }
      // Legacy format
      if (data.analyses && !data.value_picks && !data.growth_picks) {
        for (const p of data.analyses) {
          p._path = 'legacy';
          allPicks.push(p);
        }
      }

      if (!allPicks.length) {
        show('dd-empty');
        return;
      }

      // Set date + version in nav
      const dateNav = document.getElementById('dd-date-nav');
      if (dateNav && data.scan_date) dateNav.textContent = data.scan_date + (data.scan_time ? ' ' + data.scan_time : '');
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = 'v' + data.version;

      updateStats();
      renderCards();
    } catch (e) {
      hide('dd-loading');
      show('dd-error');
      const msg = document.getElementById('dd-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  // ── Stats ──

  function updateStats() {
    const filtered = getFiltered();
    const buys = filtered.filter(p => rec(p) === 'BUY');
    const watches = filtered.filter(p => rec(p) === 'WATCHLIST');
    const avoids = filtered.filter(p => rec(p) === 'AVOID');

    setText('dd-stat-total', filtered.length);
    setText('dd-stat-buy', buys.length);
    setText('dd-stat-watch', watches.length);
    setText('dd-stat-avoid', avoids.length);
  }

  // ── Filtering ──

  function getFiltered() {
    if (activeFilter === 'all') return allPicks;
    return allPicks.filter(p => p._path === activeFilter);
  }

  function getActiveSort(section) {
    const bar = document.querySelector(`#dd-section-${section} .sort-bar`);
    if (!bar) return 'score';
    const active = bar.querySelector('.sort-btn.active');
    return active ? active.dataset.sort : 'score';
  }

  function sortPicks(picks, sortKey) {
    return [...picks].sort((a, b) => {
      if (sortKey === 'ticker') return (a.ticker || '').localeCompare(b.ticker || '');
      if (sortKey === 'path') return (a._path || '').localeCompare(b._path || '');
      // Default: score descending
      const sa = getScore(a);
      const sb = getScore(b);
      return sb - sa;
    });
  }

  function getScore(p) {
    const fw = p.framework || p.value_framework || p.growth_framework;
    return fw?.score || 0;
  }

  function rec(p) {
    return (p.opus_recommendation || '').toUpperCase();
  }

  // ── Render ──

  function renderCards() {
    const filtered = getFiltered();
    updateStats();

    const buys = sortPicks(filtered.filter(p => rec(p) === 'BUY'), getActiveSort('buy'));
    const watches = sortPicks(filtered.filter(p => rec(p) === 'WATCHLIST'), getActiveSort('watchlist'));
    const avoids = filtered.filter(p => rec(p) === 'AVOID');

    renderSection('dd-section-buy', 'dd-cards-buy', buys);
    renderSection('dd-section-watchlist', 'dd-cards-watchlist', watches);
    renderSection('dd-section-avoid', 'dd-cards-avoid', avoids);

    // Show empty state if nothing visible
    if (!buys.length && !watches.length && !avoids.length) {
      show('dd-empty');
    } else {
      hide('dd-empty');
    }
  }

  function renderSection(sectionId, containerId, picks) {
    const section = document.getElementById(sectionId);
    const container = document.getElementById(containerId);
    if (!section || !container) return;

    if (!picks.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';
    for (const p of picks) {
      container.appendChild(renderCard(p));
    }
  }

  function renderCard(a) {
    const card = el('div', 'dd-card');
    const r = rec(a);
    if (r === 'BUY') card.classList.add('buy');
    else if (r === 'WATCHLIST') card.classList.add('watchlist');

    // Header row
    const header = el('div', 'dd-card-header');
    const tickerEl = el('div', 'dd-ticker');
    const yf = `https://finance.yahoo.com/quote/${encodeURIComponent(a.ticker)}`;
    tickerEl.innerHTML =
      `<a href="${yf}" target="_blank" rel="noopener" class="text-lg font-bold font-mono hover:text-green-400 transition-colors">${esc(a.ticker)}</a>` +
      `<span class="text-sm text-gray-400 ml-2">${esc(a.name || '')}</span>`;
    header.appendChild(tickerEl);

    // Score badge + price + recommendation + path badge
    const fw = a.framework || a.value_framework || a.growth_framework;
    const score = fw?.score;
    const scoreClass = score >= 5 ? 'high' : score >= 3 ? 'mid' : 'low';
    const pathLabel = a._path === 'value' ? 'Value' : a._path === 'growth' ? 'Growth' : '';
    const pathClass = a._path === 'value' ? 'recovery' : a._path === 'growth' ? 'growth' : '';
    const badges = el('div', 'flex items-center gap-2');
    badges.innerHTML =
      (score != null ? `<span class="dd-score-badge ${scoreClass}">${score}/6</span>` : '') +
      `<span class="text-sm font-mono text-gray-400">$${fmt(a.price)}</span>` +
      (r ? `<span class="dd-rec-badge ${r.toLowerCase()}">${r}</span>` : '') +
      (pathLabel ? `<span class="profile-badge ${pathClass}">${pathLabel}</span>` : '');
    header.appendChild(badges);
    card.appendChild(header);

    // Framework
    const fwRow = el('div', 'dd-fw-row single');
    if (a._path === 'value' && a.framework) {
      fwRow.appendChild(renderFramework('Value Framework', a.framework, VALUE_CRITERIA));
    } else if (a._path === 'growth' && a.framework) {
      fwRow.appendChild(renderFramework('Growth Framework', a.framework, GROWTH_CRITERIA));
    } else if (a._path === 'legacy') {
      fwRow.classList.remove('single');
      if (a.value_framework) fwRow.appendChild(renderFramework('Value Framework', a.value_framework, LEGACY_VALUE_CRITERIA));
      if (a.growth_framework) fwRow.appendChild(renderFramework('Growth Framework', a.growth_framework, LEGACY_GROWTH_CRITERIA));
    }
    card.appendChild(fwRow);

    // AI Exposure
    if (a.ai_exposure) {
      const ai = a.ai_exposure;
      const vClass = ai.verdict === 'tailwind' ? 'text-green-400' : ai.verdict === 'threat' ? 'text-red-400' : 'text-gray-400';
      const vLabel = (ai.verdict || 'neutral').toUpperCase();
      const section = el('div', 'dd-section');
      section.innerHTML =
        `<div class="dd-section-title">AI Exposure</div>` +
        `<p class="text-sm"><span class="${vClass} font-bold font-mono">${esc(vLabel)}</span>` +
        `<span class="text-gray-400 ml-2">${esc(ai.detail || '')}</span></p>`;
      card.appendChild(section);
    }

    // Deal Radar
    if (a.deal_radar) {
      const dr = a.deal_radar;
      if (dr.capex_exposure || dr.options_signal) {
        const section = el('div', 'dd-section');
        let html = `<div class="dd-section-title">Deal Radar</div>`;
        if (dr.capex_exposure) html += `<p class="text-sm"><span class="text-amber-400 font-bold font-mono">CAPEX</span><span class="text-gray-400 ml-2">${esc(dr.capex_exposure)}</span></p>`;
        if (dr.options_signal) html += `<p class="text-sm"><span class="text-blue-400 font-bold font-mono">OPTIONS</span><span class="text-gray-400 ml-2">${esc(dr.options_signal)}</span></p>`;
        if (dr.assessment) html += `<p class="text-sm text-gray-300 mt-1">${esc(dr.assessment)}</p>`;
        section.innerHTML = html;
        card.appendChild(section);
      }
    }

    // Financials
    if (a.financials) {
      const fin = a.financials;
      const section = el('div', 'dd-section');
      const items = [];
      if (fin.range_52w) items.push(finItem('52w Range', fin.range_52w));
      if (fin.forward_pe) items.push(finItem('Fwd PE', fin.forward_pe + 'x'));
      if (fin.market_cap) items.push(finItem('Mkt Cap', fin.market_cap));
      if (fin.revenue_growth) items.push(finItem('Rev Growth', fin.revenue_growth));
      if (fin.gross_margins) items.push(finItem('Gross Margin', fin.gross_margins));
      if (fin.free_cashflow) items.push(finItem('FCF', fin.free_cashflow));
      if (items.length) {
        section.innerHTML =
          `<div class="dd-section-title">Key Metrics</div>` +
          `<div class="dd-fin-grid">${items.join('')}</div>`;
        card.appendChild(section);
      }
    }

    // Catalysts
    const hasVerified = a.catalysts_verified && a.catalysts_verified.length > 0;
    const hasGeneral = a.catalysts_general && a.catalysts_general.length > 0;
    const hasFlat = a.catalysts && a.catalysts.length > 0;
    if (hasVerified || hasGeneral || hasFlat) {
      const section = el('div', 'dd-section');
      let html = '<div class="dd-section-title">Catalysts</div><ul class="dd-list">';
      if (hasVerified) html += a.catalysts_verified.map(c => `<li><span class="text-green-400 mr-1">&#x2705;</span>${esc(c)}</li>`).join('');
      if (hasGeneral) html += a.catalysts_general.map(c => `<li>${esc(c)}</li>`).join('');
      if (!hasVerified && !hasGeneral && hasFlat) html += a.catalysts.map(c => `<li>${esc(c)}</li>`).join('');
      html += '</ul>';
      section.innerHTML = html;
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
    wrap.innerHTML =
      `<div class="dd-fw-title">${esc(title)}</div>` +
      `<table class="dd-fw-table"><tbody>${rows}</tbody></table>`;
    return wrap;
  }

  function verdictIcon(v) {
    if (v === 'pass') return '<span class="text-green-400">&#x2705;</span>';
    if (v === 'fail') return '<span class="text-red-400">&#x274C;</span>';
    if (v === 'insufficient_data') return '<span class="text-gray-500">&#x2014;</span>';
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

  // ── Copy ──

  function copyData(copyBtn) {
    if (!allPicks.length) return;

    const buys = allPicks.filter(a => rec(a) === 'BUY');
    const watches = allPicks.filter(a => rec(a) === 'WATCHLIST');
    const signals = [...buys, ...watches];
    if (!signals.length) return;

    const lines = signals.map(a => {
      const parts = [`${a.ticker} (${a.opus_recommendation})`];
      if (a.price) parts.push(`$${Number(a.price).toFixed(2)}`);
      const fw = a.framework || a.value_framework || a.growth_framework;
      if (fw) parts.push(`Score: ${fw.score || '?'}/6`);
      if (a._path) parts.push(`Path: ${a._path}`);
      if (a.ai_exposure) parts.push(`AI: ${(a.ai_exposure.verdict || 'neutral').toUpperCase()}`);
      if (a.deal_radar && a.deal_radar.assessment) parts.push(`DealRadar: ${a.deal_radar.assessment}`);
      if (a.financials) {
        const f = a.financials;
        if (f.forward_pe) parts.push(`FwdPE: ${f.forward_pe}x`);
        if (f.range_52w) parts.push(`52w: ${f.range_52w}`);
      }
      if (a.ideal_entry) parts.push(`Entry: $${Number(a.ideal_entry.price).toFixed(2)}`);
      const allCats = [].concat(a.catalysts_verified || [], a.catalysts_general || [], (!a.catalysts_verified && !a.catalysts_general) ? (a.catalysts || []) : []);
      if (allCats.length) parts.push(`Catalysts: ${allCats.join('; ')}`);
      if (a.analyst_take) parts.push(`\n  Take: ${a.analyst_take}`);
      return parts.join(' | ');
    });
    const header = `Opus Deep Dive — ${pageData.scan_date || 'today'}\n` +
      `${buys.length} BUY + ${watches.length} WATCHLIST\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy for Claude'; }, 2000);
    });
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

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
