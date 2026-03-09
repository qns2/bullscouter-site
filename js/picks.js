/**
 * Bull Scouter - Top Picks Page
 * Loads all 4 JSON data sources, ranks top picks, renders hero cards + path summaries.
 */

const Picks = (() => {
  const DATA_BASE = 'data';

  // Breakdown key → display label (copied from app.js)
  const BREAKDOWN_LABELS = {
    catalyst: 'Catalyst', social: 'Social', growth_quality: 'Growth',
    margin_quality: 'Margin', fallen_angel: 'Fallen Angel',
    fundamental: 'Fundamental', technical: 'Technical',
    news_boost: 'News', claude_enhancement: 'AI',
    momentum_bonus: 'Momentum', breakout_pattern_bonus: 'Breakout',
    catalyst_pattern_bonus: 'Cat Pattern', fundamental_risk: 'Risk',
    narrative_overlap: 'Overlap', pre_revenue_discount: 'Pre-Rev',
    quality_persistence: 'Quality', controversy_penalty: 'Controversy',
    thesis_decay: 'Decay', revenue_momentum: 'Rev Momentum',
    margin_expansion: 'Margins', price_trend: 'Price/RS',
    volume_expansion: 'Volume', conviction: 'Conviction',
    social_discovery: 'Discovery', acceleration_influence: 'Accel→FA',
    profitability: 'Profitability', fcf: 'FCF', discount: '52w Discount',
    sector_panic: 'Panic Signal', pe_discount: 'PE Discount',
    no_dilution: 'No Dilution', revenue_growth_q: 'Rev Growth',
    gross_margins_q: 'Gross Margins', nrr: 'NRR', tam: 'TAM',
    rule40: 'Rule of 40', sbc: 'SBC',
    earnings_revision: 'EPS Revision', short_pressure: 'Short Pressure',
    convergence_bonus: 'Convergence',
    overvalued_cap: 'Overvalued Cap', bankruptcy_risk_cap: 'Bankruptcy Risk',
    low_upside: 'Low Upside', insider_sell_penalty: 'Insider Selling',
    insider_buy_boost: 'Insider Buying', thesis_feedback: 'AI Thesis',
    neg_revenue_cap: 'Neg Revenue', low_margin: 'Low Margin',
    si_no_catalyst: 'SI No Catalyst',
    controversy_insider_compound: 'Controversy+Insider',
    quality_auto_remove: 'Weak Quality',
  };

  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
    value: 'Value', quality_growth: 'Quality Growth',
  };

  const CATALYST_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings', pdufa: 'PDUFA',
    partnership: 'Partnership', approval: 'Approval', data_readout: 'Data',
    contract: 'Contract', ipo_lockup: 'Lockup', merger: 'M&A',
  };

  const RANK_COLORS = ['#eab308', '#94a3b8', '#b45309'];
  const RANK_LABELS = ['#1', '#2', '#3'];

  const CHECKLIST_ICONS = { pass: '\u2705', partial: '\u26A0\uFE0F', fail: '\u274C' };

  // ── Data loading ──

  async function fetchJSON(path) {
    const resp = await fetch(`${DATA_BASE}/${path}?_cb=${Date.now()}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function loadAllData() {
    const [dashboard, contrarian, deepdive, watchlist, catalysts] = await Promise.all([
      fetchJSON('latest.json').catch(() => null),
      fetchJSON('contrarian.json').catch(() => null),
      fetchJSON('deep-dive.json').catch(() => null),
      fetchJSON('watchlist.json').catch(() => null),
      fetchJSON('catalysts.json').catch(() => null),
    ]);
    return { dashboard, contrarian, deepdive, watchlist, catalysts };
  }

  // ── Top picks computation ──

  function computeTopPicks(data) {
    const candidates = []; // { ticker, pick_score, source, sourceLabel, data }

    // Path 1: BUY signals from dashboard
    if (data.dashboard && data.dashboard.opportunities) {
      for (const opp of data.dashboard.opportunities) {
        if (opp.recommendation !== 'BUY') continue;
        const pickScore = Math.min(opp.score || 0, 100) + (opp.confidence || 0) * 0.2;
        candidates.push({
          ticker: opp.ticker,
          pick_score: pickScore,
          sources: [{ label: 'Dashboard BUY', color: '#22c55e' }],
          type: 'dashboard',
          data: opp,
        });
      }
    }

    // Path 3: STRONG_CANDIDATE from contrarian
    if (data.contrarian && data.contrarian.strong_candidates) {
      for (const c of data.contrarian.strong_candidates) {
        const pickScore = (c.score || 0) + 10;
        candidates.push({
          ticker: c.ticker,
          pick_score: pickScore,
          sources: [{ label: 'Contrarian STRONG', color: '#a855f7' }],
          type: 'contrarian',
          data: c,
        });
      }
    }

    // Assessor: STRONG BUY / BUY picks from deep dive (5-expert system)
    if (data.deepdive) {
      const allDDPicks = [
        ...(data.deepdive.value_picks || []),
        ...(data.deepdive.growth_picks || []),
      ];
      for (const dd of allDDPicks) {
        const rec = (dd.opus_recommendation || '').toUpperCase();
        if (rec !== 'BUY' && rec !== 'STRONG BUY') continue;
        const v = dd.framework?.value?.verdict === 'pass' ? 1 : 0;
        const q = dd.framework?.quality?.verdict === 'pass' ? 1 : 0;
        const cat = dd.framework?.catalyst?.verdict === 'pass' ? 1 : 0;
        const fwScore = (dd.framework?.score || 0) * 16; // 0-6 scale → ~0-96
        const convBonus = rec === 'STRONG BUY' ? 15 : 0;
        const pickScore = fwScore + convBonus;
        candidates.push({
          ticker: dd.ticker,
          pick_score: pickScore,
          sources: [{ label: 'Assessor ' + rec, color: '#3b82f6' }],
          type: 'deepdive',
          data: dd,
        });
      }
    }

    // Dedup by ticker: merge source labels, keep higher pick_score data
    const byTicker = {};
    for (const c of candidates) {
      if (!byTicker[c.ticker]) {
        byTicker[c.ticker] = c;
      } else {
        const existing = byTicker[c.ticker];
        // Merge source labels
        for (const s of c.sources) {
          if (!existing.sources.find(es => es.label === s.label)) {
            existing.sources.push(s);
          }
        }
        // Keep higher pick_score data
        if (c.pick_score > existing.pick_score) {
          existing.pick_score = c.pick_score;
          existing.type = c.type;
          existing.data = c.data;
        }
      }
    }

    // Sort descending by pick_score, return top 3
    return Object.values(byTicker)
      .sort((a, b) => b.pick_score - a.pick_score)
      .slice(0, 3);
  }

  // ── Rendering helpers ──

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function confColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Pick card rendering ──

  function renderPickCard(pick, rank) {
    const d = pick.data;
    const color = RANK_COLORS[rank] || '#6b7280';
    const label = RANK_LABELS[rank] || `#${rank + 1}`;
    const isDashboard = pick.type === 'dashboard';
    const isDeepDive = pick.type === 'deepdive';

    let html = `<div class="opp-card" style="border-left:3px solid ${color}">`;

    // Header: rank badge + ticker + source badges
    html += `<div class="flex items-start justify-between mb-2">`;
    html += `<div class="flex items-center gap-2">`;
    html += `<span class="text-xl font-black font-mono" style="color:${color}">${label}</span>`;
    html += `<a href="https://finance.yahoo.com/quote/${esc(d.ticker || pick.ticker)}" target="_blank" rel="noopener" class="text-lg font-bold font-mono hover:text-green-400 transition-colors">${esc(pick.ticker)}</a>`;

    // Profile badge
    if (isDashboard && d.profile) {
      const profileLabel = PROFILE_LABELS[d.profile] || d.profile;
      html += `<span class="profile-badge ${d.profile}">${profileLabel}</span>`;
    }
    if (isDeepDive && d.conviction) {
      const convColor = d.conviction === 'HIGH' ? '#22c55e' : d.conviction === 'MEDIUM' ? '#f59e0b' : '#6b7280';
      html += `<span class="profile-badge" style="background:${hexToRgba(convColor, 0.15)};color:${convColor}">${d.conviction}</span>`;
    }
    html += `</div>`;

    // Score badge
    if (isDashboard) {
      html += `<div class="score-badge buy">${d.score > 100 ? '100+' : d.score}</div>`;
    } else if (isDeepDive && d.framework) {
      html += `<div class="score-badge buy">${d.framework.score?.toFixed(1) || '?'}</div>`;
    } else {
      html += `<div class="score-badge buy">${d.score}</div>`;
    }
    html += `</div>`;

    // Source badges
    html += `<div class="flex flex-wrap gap-1 mb-2">`;
    for (const s of pick.sources) {
      html += `<span class="profile-badge" style="background:${hexToRgba(s.color, 0.15)};color:${s.color}">${s.label}</span>`;
    }
    html += `</div>`;

    // Price row
    html += `<div class="flex items-center gap-3 text-xs text-gray-400 mb-2">`;
    if (isDashboard && d.price) {
      html += `<span class="font-mono">$${d.price.toFixed(2)}</span>`;
      if (d.market_cap_fmt) html += `<span>${d.market_cap_fmt}</span>`;
      if (d.down_from_high_pct) html += `<span class="text-red-400">-${d.down_from_high_pct}% from high</span>`;
    } else if (isDeepDive) {
      if (d.price) html += `<span class="font-mono">$${d.price.toFixed(2)}</span>`;
      if (d.ideal_entry?.price) html += `<span class="text-green-400">Entry: $${d.ideal_entry.price.toFixed(2)}</span>`;
      if (d.source) {
        const srcColor = d.source === 'both' ? '#22c55e' : d.source === 'discovery' ? '#3b82f6' : '#6b7280';
        const srcLabel = d.source === 'both' ? 'OVERLAP' : d.source === 'discovery' ? 'DISCOVERY' : 'SCANNER';
        html += `<span style="color:${srcColor}">${srcLabel}</span>`;
      }
    } else {
      if (d.current_price) html += `<span class="font-mono">$${d.current_price.toFixed(2)}</span>`;
      if (d.market_cap_fmt) html += `<span>${esc(d.market_cap_fmt)}</span>`;
      if (d.down_from_high_pct) html += `<span class="text-red-400">-${d.down_from_high_pct}% from high</span>`;
    }
    html += `</div>`;

    // Confidence bar (Path 1 only)
    if (isDashboard && d.confidence != null) {
      html += `<div class="conf-bar mb-2"><div class="conf-bar-fill" style="width:${Math.min(d.confidence, 100)}%;background:${confColor(d.confidence)}"></div></div>`;
      html += `<div class="text-xs text-gray-400 mb-2">Confidence: <span class="${d.confidence >= 70 ? 'text-green-400' : d.confidence >= 50 ? 'text-amber-400' : 'text-red-400'}">${d.confidence}</span>/100`;
      if (d.entry_timing) {
        html += ` <span class="text-gray-500">|</span> Entry: <span class="font-bold ${d.entry_timing.label === 'Enter' ? 'text-green-400' : d.entry_timing.label === 'Wait' ? 'text-amber-400' : 'text-red-400'}">${d.entry_timing.score}</span><span class="text-gray-500"> ${d.entry_timing.label}</span>`;
      }
      html += `</div>`;
    }

    // Catalyst info (Path 1 only)
    if (isDashboard && d.catalyst_type) {
      const catLabel = CATALYST_LABELS[d.catalyst_type] || d.catalyst_type;
      html += `<div class="flex items-center gap-2 text-xs mb-2">`;
      html += `<span class="text-gray-500">${catLabel}</span>`;
      if (d.catalyst_date) html += `<span class="text-gray-600 font-mono">${d.catalyst_date}</span>`;
      if (d.days_to_catalyst != null) {
        if (d.days_to_catalyst <= 0) html += `<span class="text-red-400">Imminent</span>`;
        else if (d.days_to_catalyst <= 7) html += `<span class="text-amber-400">${d.days_to_catalyst}d</span>`;
        else html += `<span class="text-gray-400">${d.days_to_catalyst}d</span>`;
      }
      html += `</div>`;
    }

    // Deep dive: framework chips (value/quality/catalyst/risk)
    if (isDeepDive && d.framework) {
      html += `<div class="flex flex-wrap gap-1 mb-2">`;
      for (const dim of ['value', 'quality', 'catalyst', 'risk']) {
        const f = d.framework[dim];
        if (!f) continue;
        const cls = f.verdict === 'pass' ? 'positive' : f.verdict === 'fail' ? 'negative' : '';
        const icon = f.verdict === 'pass' ? '\u2705' : f.verdict === 'fail' ? '\u274C' : '\u26A0\uFE0F';
        html += `<span class="chip ${cls}">${icon} ${dim.charAt(0).toUpperCase() + dim.slice(1)}</span>`;
      }
      html += `</div>`;
      // Analyst take
      if (d.analyst_take) {
        html += `<div class="text-xs text-gray-400 mb-2">${esc(d.analyst_take)}</div>`;
      }
    }

    // Top 3 breakdown chips (sorted by |value|)
    const breakdown = d.breakdown;
    if (breakdown) {
      const entries = Object.entries(breakdown)
        .filter(([_, v]) => v !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3);
      if (entries.length) {
        html += `<div class="flex flex-wrap gap-1 mb-2">`;
        for (const [k, v] of entries) {
          const lbl = BREAKDOWN_LABELS[k] || k;
          const cls = v > 0 ? 'positive' : 'negative';
          const prefix = v > 0 ? '+' : '';
          html += `<span class="chip ${cls}">${lbl} ${prefix}${v}</span>`;
        }
        html += `</div>`;
      }
    }

    // Quality checklist
    if (isDashboard && d.checklist && Object.keys(d.checklist).length) {
      const fw = d.quality_framework === 'value' ? 'Value' : d.quality_framework === 'quality_growth' ? 'Growth Quality' : d.quality_framework || '';
      const score = d.checklist_score || 0;
      const denom = d.checklist_denominator || 6;
      const items = Object.entries(d.checklist).map(([name, status]) =>
        `<span class="text-xs mr-2">${CHECKLIST_ICONS[status] || '?'} ${name}</span>`
      ).join('');
      html += `<div class="text-xs text-gray-400 mt-1 px-2 py-1 border border-gray-700 rounded"><span class="font-semibold">${fw} (${score}/${denom})</span>: ${items}</div>`;
    } else if (!isDashboard && d.quality_checklist) {
      const qc = d.quality_checklist;
      const fw = qc.framework === 'value' ? 'Value' : 'Growth Quality';
      const items = Object.entries(qc.items || {}).map(([name, status]) =>
        `<span class="text-xs mr-2">${CHECKLIST_ICONS[status] || '?'} ${esc(name)}</span>`
      ).join('');
      html += `<div class="text-xs text-gray-400 mt-1 px-2 py-1 border border-gray-700 rounded"><span class="font-semibold">${fw} (${qc.score}/${qc.denominator})</span>: ${items}</div>`;
    }

    // Pick score footnote
    html += `<div class="text-xs text-gray-600 mt-2 font-mono">Pick score: ${pick.pick_score.toFixed(1)}</div>`;

    html += `</div>`;
    return html;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Summary renderers ──

  function renderDashboardSummary(dashboard) {
    const container = document.getElementById('summary-dashboard');
    if (!container) return;

    if (!dashboard || !dashboard.opportunities || !dashboard.opportunities.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
      return;
    }

    const opps = dashboard.opportunities
      .filter(o => o.recommendation === 'BUY' || o.recommendation === 'WATCHLIST')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    if (!opps.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No signals today</p>';
      return;
    }

    container.innerHTML = opps.map(o => {
      const rec = o.recommendation;
      const recCls = rec === 'BUY' ? 'text-green-400' : 'text-amber-400';
      const profileLabel = PROFILE_LABELS[o.profile] || o.profile || '';
      const catLabel = o.catalyst_type ? (CATALYST_LABELS[o.catalyst_type] || o.catalyst_type) : '';
      return `<div class="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-sm">
        <div class="flex items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${esc(o.ticker)}" target="_blank" rel="noopener" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(o.ticker)}</a>
          <span class="${recCls} text-xs font-semibold">${rec}</span>
          ${profileLabel ? `<span class="profile-badge ${o.profile}">${profileLabel}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${catLabel ? `<span>${catLabel}</span>` : ''}
          <span class="font-mono">${o.confidence || '-'}</span>
          <span class="font-bold font-mono">${o.score}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderContrarianSummary(contrarian) {
    const container = document.getElementById('summary-contrarian');
    if (!container) return;

    if (!contrarian) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
      return;
    }

    const all = [
      ...(contrarian.strong_candidates || []),
      ...(contrarian.candidates || []),
    ].slice(0, 5);

    if (!all.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No candidates found</p>';
      return;
    }

    container.innerHTML = all.map(c => {
      const isStrong = (contrarian.strong_candidates || []).some(s => s.ticker === c.ticker);
      const qc = c.quality_checklist;
      const qcLabel = qc ? `${qc.framework === 'value' ? 'V' : 'G'} ${qc.score}/${qc.denominator}` : '';
      return `<div class="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-sm">
        <div class="flex items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${esc(c.ticker)}" target="_blank" rel="noopener" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(c.ticker)}</a>
          ${isStrong ? '<span class="profile-badge" style="background:rgba(168,85,247,0.15);color:#c4b5fd">STRONG</span>' : '<span class="text-xs text-gray-500">CANDIDATE</span>'}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${c.down_from_high_pct ? `<span class="text-red-400">-${c.down_from_high_pct}%</span>` : ''}
          ${qcLabel ? `<span>${qcLabel}</span>` : ''}
          <span class="font-bold font-mono">${c.score}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderDeepDiveSummary(deepdive) {
    const container = document.getElementById('summary-deepdive');
    if (!container) return;

    if (!deepdive) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
      return;
    }

    const allPicks = [
      ...(deepdive.value_picks || []).map(p => ({ ...p, _path: 'value' })),
      ...(deepdive.growth_picks || []).map(p => ({ ...p, _path: 'growth' })),
    ];

    const buys = allPicks
      .filter(p => (p.opus_recommendation || '').toUpperCase() === 'BUY')
      .sort((a, b) => {
        const sa = (a.framework || {}).score || 0;
        const sb = (b.framework || {}).score || 0;
        return sb - sa;
      })
      .slice(0, 5);

    if (!buys.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No BUY picks</p>';
      return;
    }

    container.innerHTML = buys.map(p => {
      const fw = p.framework || {};
      const pathLabel = p._path === 'value' ? 'Value' : 'Growth';
      const pathCls = p._path === 'value' ? 'recovery' : 'growth';
      const entry = p.ideal_entry ? `$${Number(p.ideal_entry.price).toFixed(2)}` : '';
      return `<div class="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-sm">
        <div class="flex items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${esc(p.ticker)}" target="_blank" rel="noopener" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(p.ticker)}</a>
          <span class="text-green-400 text-xs font-semibold">BUY</span>
          <span class="profile-badge ${pathCls}">${pathLabel}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${entry ? `<span class="font-mono">${entry}</span>` : ''}
          <span class="font-bold font-mono">${fw.score || '?'}/6</span>
        </div>
      </div>`;
    }).join('');
  }

  const SIGNAL_TYPE_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings',
    insider_buy: 'Insider Buy', activist_filing: 'Activist',
    partnership: 'Partnership', buyback: 'Buyback',
    analyst_upgrade: 'Upgrade', analyst_downgrade: 'Downgrade',
    dilution: 'Dilution', earnings_beat: 'Beat',
  };

  const SIGNAL_COLORS = {
    insider_buy: '#fbbf24', activist_filing: '#c4b5fd', partnership: '#93c5fd',
    buyback: '#4ade80', analyst_upgrade: '#6ee7b7', fda: '#4ade80',
    earnings_beat: '#4ade80', analyst_downgrade: '#fca5a5', dilution: '#fca5a5',
  };

  function renderCatalystSummary(catalysts) {
    const container = document.getElementById('summary-catalysts');
    if (!container) return;

    if (!catalysts || !catalysts.heatmap || !catalysts.heatmap.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
      return;
    }

    const top = catalysts.heatmap.slice(0, 5);
    container.innerHTML = top.map(h => {
      const scoreClass = h.heatmap_score >= 30 ? 'text-green-400' : h.heatmap_score >= 15 ? 'text-amber-400' : 'text-gray-400';
      const topSignals = (h.signals || []).slice(0, 2).map(s => {
        const label = SIGNAL_TYPE_LABELS[s.type] || s.type;
        const color = SIGNAL_COLORS[s.type] || '#9ca3af';
        return `<span style="color:${color}" class="text-xs">${label}</span>`;
      }).join(' ');
      const recBadge = h.recommendation ? `<span class="text-xs font-semibold ${h.recommendation === 'BUY' ? 'text-green-400' : 'text-amber-400'}">${h.recommendation}</span>` : '';
      return `<div class="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-sm">
        <div class="flex items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${esc(h.ticker)}" target="_blank" rel="noopener" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(h.ticker)}</a>
          ${recBadge}
          ${topSignals}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          <span>${h.signal_count} signal${h.signal_count !== 1 ? 's' : ''}</span>
          <span class="font-bold font-mono ${scoreClass}">${h.heatmap_score}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderWatchlistSummary(watchlist) {
    const container = document.getElementById('summary-watchlist');
    if (!container) return;

    if (!watchlist) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
      return;
    }

    const alerts = (watchlist.alerts || []).slice(0, 5);

    if (!alerts.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No recent alerts</p>';
      return;
    }

    const ALERT_COLORS = {
      DEEP_VALUE: '#f87171', DIP: '#fbbf24',
      ABS_TARGET: '#4ade80', ENTRY_ZONE: '#93c5fd',
    };
    const PRIORITY_COLORS = { CRITICAL: '#f87171', HIGH: '#fbbf24', NORMAL: '#9ca3af' };

    container.innerHTML = alerts.map(a => {
      const ac = ALERT_COLORS[a.alert_type] || '#9ca3af';
      const pc = PRIORITY_COLORS[a.priority] || '#9ca3af';
      return `<div class="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-sm">
        <div class="flex items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${esc(a.ticker)}" target="_blank" rel="noopener" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(a.ticker)}</a>
          <span class="text-xs font-semibold" style="color:${ac}">${a.alert_type}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${a.price ? `<span class="font-mono">$${a.price.toFixed(2)}</span>` : ''}
          <span class="font-semibold" style="color:${pc}">${a.priority}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ── Stats bar ──

  function updateStats(data) {
    // Picks count
    const picks = computeTopPicks(data);
    setText('stat-picks', picks.length);

    // BUY count
    const buyCount = data.dashboard
      ? (data.dashboard.opportunities || []).filter(o => o.recommendation === 'BUY').length
      : 0;
    setText('stat-buys', buyCount);

    // Strong candidates
    const strongCount = data.contrarian
      ? (data.contrarian.strong_candidates || []).length
      : 0;
    setText('stat-strong', strongCount);

    // Deep Dive BUY count
    const ddPicks = data.deepdive
      ? [...(data.deepdive.value_picks || []), ...(data.deepdive.growth_picks || [])]
        .filter(p => (p.opus_recommendation || '').toUpperCase() === 'BUY').length
      : 0;
    setText('stat-dd-buy', ddPicks);

    // Watchlist alerts
    const wlAlerts = data.watchlist
      ? (data.watchlist.alerts || []).length
      : 0;
    setText('stat-wl-alerts', wlAlerts);

    // Catalyst heatmap tickers
    const hmTickers = data.catalysts
      ? (data.catalysts.heatmap || []).length
      : 0;
    setText('stat-hm-tickers', hmTickers);
  }

  // ── Init ──

  async function init() {
    try {
      const data = await loadAllData();

      document.getElementById('loading-state').classList.add('hidden');

      // Version + date from dashboard data
      if (data.dashboard) {
        const vb = document.getElementById('version-badge');
        if (vb && data.dashboard.version) vb.textContent = `v${data.dashboard.version}`;
        const sd = document.getElementById('scan-date');
        if (sd) {
          const dateLabel = data.dashboard.scan_date || '';
          const timeLabel = data.dashboard.scan_time ? ` ${data.dashboard.scan_time}` : '';
          sd.textContent = dateLabel + timeLabel;
        }
      }

      // Copy button
      const copyBtn = document.getElementById('btn-copy-picks');
      if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn, data));

      // Compute top picks
      const picks = computeTopPicks(data);

      // Update stats
      updateStats(data);

      // Render hero cards
      const heroContainer = document.getElementById('cards-picks');
      if (picks.length) {
        document.getElementById('section-picks').classList.remove('hidden');
        heroContainer.innerHTML = picks.map((p, i) => renderPickCard(p, i)).join('');
      } else {
        document.getElementById('empty-picks').classList.remove('hidden');
      }

      // Render summaries
      renderDashboardSummary(data.dashboard);
      renderContrarianSummary(data.contrarian);
      renderDeepDiveSummary(data.deepdive);
      renderWatchlistSummary(data.watchlist);
      renderCatalystSummary(data.catalysts);

    } catch (e) {
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('error-state').classList.remove('hidden');
      document.getElementById('error-msg').textContent = e.message;
    }
  }

  function copyData(copyBtn, data) {
    const picks = computeTopPicks(data);
    if (!picks.length) return;
    const lines = picks.map((p, i) => {
      const d = p.data;
      const parts = [`#${i + 1} ${p.ticker}`];
      parts.push(`Source: ${p.sources.map(s => s.label).join(', ')}`);
      if (d.score) parts.push(`Score: ${d.score}`);
      if (d.price) parts.push(`$${d.price.toFixed(2)}`);
      else if (d.current_price) parts.push(`$${d.current_price.toFixed(2)}`);
      if (d.market_cap_fmt) parts.push(`MCap: ${d.market_cap_fmt}`);
      if (d.down_from_high_pct) parts.push(`Down: ${d.down_from_high_pct}%`);
      if (d.confidence) parts.push(`Conf: ${d.confidence}`);
      if (d.profile) parts.push(`Profile: ${d.profile}`);
      if (d.catalyst_type) parts.push(`Cat: ${d.catalyst_type}`);
      parts.push(`Pick: ${p.pick_score.toFixed(1)}`);
      return parts.join(' | ');
    });
    const scanDate = data.dashboard?.scan_date || 'today';
    const scanTime = data.dashboard?.scan_time ? ` ${data.dashboard.scan_time}` : '';
    const header = `Bull Scouter Top Picks — ${scanDate}${scanTime}\n${picks.length} picks\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy for Claude'; }, 2000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { computeTopPicks };
})();
