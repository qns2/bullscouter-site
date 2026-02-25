/**
 * Bull Scouter - Deep Dive Page
 * Fetches deep-dive.json and renders Opus analysis cards.
 * Supports two formats:
 *   - Legacy: { analyses: [...] }
 *   - Two-path: { value_picks: [...], growth_picks: [...] }
 */

const DeepDive = (() => {
  const DATA_PATH = 'data/deep-dive.json';
  let pageData = null;

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
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyData(copyBtn));
    }

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      pageData = data;
      hide('dd-loading');

      // Detect format
      const isNewFormat = data.value_picks || data.growth_picks;
      const isLegacy = data.analyses && data.analyses.length > 0;

      if (!isNewFormat && !isLegacy) {
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

  // ── Copy ──

  function copyData(copyBtn) {
    if (!pageData) return;

    // Gather all picks from either format
    let allPicks;
    if (pageData.value_picks || pageData.growth_picks) {
      allPicks = [].concat(pageData.value_picks || [], pageData.growth_picks || []);
    } else {
      allPicks = pageData.analyses || [];
    }

    const buys = allPicks.filter(a => (a.opus_recommendation || '').toUpperCase() === 'BUY');
    const watches = allPicks.filter(a => (a.opus_recommendation || '').toUpperCase() === 'WATCHLIST');
    const signals = [...buys, ...watches];
    if (!signals.length) return;

    const lines = signals.map(a => {
      const parts = [`${a.ticker} (${a.opus_recommendation})`];
      if (a.price) parts.push(`$${Number(a.price).toFixed(2)}`);
      const fw = a.framework || a.value_framework || a.growth_framework;
      if (fw) parts.push(`Score: ${fw.score || '?'}/6`);
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
      label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); label.textContent = 'Copy for Claude'; }, 2000);
    });
  }

  // ── Render ──

  function renderPage(data) {
    document.getElementById('dd-date').textContent = data.scan_date || '-';

    // Legacy format: single analyses array
    if (data.analyses && !data.value_picks && !data.growth_picks) {
      document.getElementById('dd-count').textContent = data.analyses.length;
      const container = document.getElementById('dd-cards');
      container.innerHTML = '';
      for (const a of data.analyses) {
        container.appendChild(renderCard(a, 'legacy'));
      }
      return;
    }

    // New format: two sections
    const total = (data.value_picks?.length || 0) + (data.growth_picks?.length || 0);
    document.getElementById('dd-count').textContent = total;

    if (data.value_picks?.length) {
      show('dd-value-section');
      const vh = document.querySelector('#dd-value-section h2');
      if (vh) vh.innerHTML = `Value Picks <span class="text-sm text-gray-500 font-normal ml-2">${data.value_picks.length} stocks &middot; FCF + Balance Sheet + Drawdown</span>`;
      const container = document.getElementById('dd-value-cards');
      container.innerHTML = '';
      for (const a of data.value_picks) {
        container.appendChild(renderCard(a, 'value'));
      }
    }

    if (data.growth_picks?.length) {
      show('dd-growth-section');
      const gh = document.querySelector('#dd-growth-section h2');
      if (gh) gh.innerHTML = `Growth Picks <span class="text-sm text-gray-500 font-normal ml-2">${data.growth_picks.length} stocks &middot; Revenue + Margins + Rule of 40</span>`;
      const container = document.getElementById('dd-growth-cards');
      container.innerHTML = '';
      for (const a of data.growth_picks) {
        container.appendChild(renderCard(a, 'growth'));
      }
    }
  }

  function renderCard(a, pathType) {
    const card = el('div', 'dd-card');

    // Opus recommendation color class
    const rec = (a.opus_recommendation || '').toUpperCase();
    if (rec === 'BUY') card.classList.add('buy');
    else if (rec === 'WATCHLIST') card.classList.add('watchlist');

    // Header row
    const header = el('div', 'dd-card-header');
    const tickerEl = el('div', 'dd-ticker');
    const yf = `https://finance.yahoo.com/quote/${encodeURIComponent(a.ticker)}`;
    tickerEl.innerHTML =
      `<a href="${yf}" target="_blank" rel="noopener" class="text-lg font-bold font-mono hover:text-green-400 transition-colors">${esc(a.ticker)}</a>` +
      `<span class="text-sm text-gray-400 ml-2">${esc(a.name || '')}</span>`;
    header.appendChild(tickerEl);

    // Score badge + price + recommendation
    const fw = a.framework || a.value_framework || a.growth_framework;
    const score = fw?.score;
    const scoreClass = score >= 5 ? 'high' : score >= 3 ? 'mid' : 'low';
    const badges = el('div', 'flex items-center gap-2');
    badges.innerHTML =
      (score != null ? `<span class="dd-score-badge ${scoreClass}">${score}/6</span>` : '') +
      `<span class="text-sm font-mono text-gray-400">$${fmt(a.price)}</span>` +
      (rec ? `<span class="dd-rec-badge ${rec.toLowerCase()}">${rec}</span>` : '');
    header.appendChild(badges);
    card.appendChild(header);

    // Framework — pick the right criteria and data based on path type
    const fwRow = el('div', 'dd-fw-row');

    if (pathType === 'value') {
      fwRow.classList.add('single');
      if (a.framework) {
        fwRow.appendChild(renderFramework('Value Framework', a.framework, VALUE_CRITERIA));
      }
    } else if (pathType === 'growth') {
      fwRow.classList.add('single');
      if (a.framework) {
        fwRow.appendChild(renderFramework('Growth Framework', a.framework, GROWTH_CRITERIA));
      }
    } else {
      // Legacy: side-by-side value + growth
      if (a.value_framework) {
        fwRow.appendChild(renderFramework('Value Framework', a.value_framework, LEGACY_VALUE_CRITERIA));
      }
      if (a.growth_framework) {
        fwRow.appendChild(renderFramework('Growth Framework', a.growth_framework, LEGACY_GROWTH_CRITERIA));
      }
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

    // Deal Radar — only show if there's actual signal data
    if (a.deal_radar) {
      const dr = a.deal_radar;
      const hasSignals = dr.capex_exposure || dr.options_signal;
      if (hasSignals) {
        const section = el('div', 'dd-section');
        let html = `<div class="dd-section-title">Deal Radar</div>`;
        if (dr.capex_exposure) {
          html += `<p class="text-sm"><span class="text-amber-400 font-bold font-mono">CAPEX</span>` +
            `<span class="text-gray-400 ml-2">${esc(dr.capex_exposure)}</span></p>`;
        }
        if (dr.options_signal) {
          html += `<p class="text-sm"><span class="text-blue-400 font-bold font-mono">OPTIONS</span>` +
            `<span class="text-gray-400 ml-2">${esc(dr.options_signal)}</span></p>`;
        }
        if (dr.assessment) {
          html += `<p class="text-sm text-gray-300 mt-1">${esc(dr.assessment)}</p>`;
        }
        section.innerHTML = html;
        card.appendChild(section);
      }
    }

    // Financials — compact key metrics bar
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

    // Catalysts (structured or flat — backward compatible)
    const hasVerified = a.catalysts_verified && a.catalysts_verified.length > 0;
    const hasGeneral = a.catalysts_general && a.catalysts_general.length > 0;
    const hasFlat = a.catalysts && a.catalysts.length > 0;
    if (hasVerified || hasGeneral || hasFlat) {
      const section = el('div', 'dd-section');
      let html = '<div class="dd-section-title">Catalysts</div><ul class="dd-list">';
      if (hasVerified) {
        html += a.catalysts_verified.map(c => `<li><span class="text-green-400 mr-1">&#x2705;</span>${esc(c)}</li>`).join('');
      }
      if (hasGeneral) {
        html += a.catalysts_general.map(c => `<li>${esc(c)}</li>`).join('');
      }
      if (!hasVerified && !hasGeneral && hasFlat) {
        html += a.catalysts.map(c => `<li>${esc(c)}</li>`).join('');
      }
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

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
