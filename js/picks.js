/**
 * Bull Scouter - Home Page
 * Loads JSON data sources and renders path summary cards.
 */

const Picks = (() => {
  const DATA_BASE = 'data';

  const PROFILE_LABELS = {
    recovery: 'Recovery', acceleration: 'Acceleration', growth: 'Growth',
    value: 'Value', quality_growth: 'Quality Growth',
  };

  const CATALYST_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings', pdufa: 'PDUFA',
    partnership: 'Partnership', approval: 'Approval', data_readout: 'Data',
    contract: 'Contract', ipo_lockup: 'Lockup', merger: 'M&A',
  };

  // ── Data loading ──

  async function fetchJSON(path) {
    const resp = await fetch(`${DATA_BASE}/${path}?_cb=${Date.now()}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function loadAllData() {
    const [dashboard, contrarian, deepdive, watchlist, catalysts, warrens, regime, optionsFlow] = await Promise.all([
      fetchJSON('latest.json').catch(() => null),
      fetchJSON('contrarian.json').catch(() => null),
      fetchJSON('deep-dive.json').catch(() => null),
      fetchJSON('watchlist.json').catch(() => null),
      fetchJSON('catalysts.json').catch(() => null),
      fetchJSON('warrens-picks.json').catch(() => null),
      fetchJSON('regime.json').catch(() => null),
      fetchJSON('options-flow.json').catch(() => null),
    ]);
    return { dashboard, contrarian, deepdive, watchlist, catalysts, warrens, regime, optionsFlow };
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

  // ── Regime bar ──

  function renderRegimeBar(regime) {
    const bar = document.getElementById('regime-bar');
    if (!bar || !regime || !regime.current) return;

    const c = regime.current;
    const score = c.score || 0;
    const regimeName = (c.regime || 'neutral').replace(/_/g, ' ');

    // Color by regime
    const colors = {
      'strong risk off': '#ef4444',
      'risk off': '#f97316',
      'neutral': '#94a3b8',
      'risk on': '#22c55e',
      'strong risk on': '#00ff88',
    };
    const color = colors[regimeName] || '#94a3b8';

    // Label
    const label = document.getElementById('regime-label');
    if (label) {
      label.textContent = regimeName;
      label.style.color = color;
    }

    // Gauge: -100 to +100 mapped to 0-100% width
    const gauge = document.getElementById('regime-gauge');
    if (gauge) {
      const pct = Math.max(0, Math.min(100, (score + 100) / 2));
      gauge.style.width = pct + '%';
      gauge.style.background = color;
    }

    // Score
    setText('regime-score', (score >= 0 ? '+' : '') + score.toFixed(0));

    // VIX & SPY
    if (c.vix) setText('regime-vix', c.vix.toFixed(1));
    if (c.spy) setText('regime-spy', '$' + c.spy.toFixed(2));

    bar.classList.remove('hidden');
  }

  // ── Summary renderers ──

  function renderDashboardSummary(dashboard) {
    const container = document.getElementById('summary-dashboard');
    if (!container) return;

    if (!dashboard || !dashboard.opportunities || !dashboard.opportunities.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
      return;
    }

    const opps = dashboard.opportunities
      .filter(o => o.recommendation === 'BUY' || o.recommendation === 'WATCHLIST')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    if (!opps.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No signals today</p>';
      return;
    }

    container.innerHTML = opps.map(o => {
      const rec = o.recommendation;
      const recCls = rec === 'BUY' ? 'text-green-400' : 'text-amber-400';
      const profileLabel = PROFILE_LABELS[o.profile] || o.profile || '';
      const catLabel = o.catalyst_type ? (CATALYST_LABELS[o.catalyst_type] || o.catalyst_type) : '';
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(o.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(o.ticker)}</a>
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
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
      return;
    }

    const all = [
      ...(contrarian.strong_candidates || []),
      ...(contrarian.candidates || []),
    ].slice(0, 5);

    if (!all.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No candidates found</p>';
      return;
    }

    container.innerHTML = all.map(c => {
      const isStrong = (contrarian.strong_candidates || []).some(s => s.ticker === c.ticker);
      const qc = c.quality_checklist;
      const qcLabel = qc ? `${qc.framework === 'value' ? 'V' : 'G'} ${qc.score}/${qc.denominator}` : '';
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(c.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(c.ticker)}</a>
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
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
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
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No BUY picks</p>';
      return;
    }

    container.innerHTML = buys.map(p => {
      const fw = p.framework || {};
      const pathLabel = p._path === 'value' ? 'Value' : 'Growth';
      const pathCls = p._path === 'value' ? 'recovery' : 'growth';
      const entry = p.ideal_entry ? `$${Number(p.ideal_entry.price).toFixed(2)}` : '';
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(p.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(p.ticker)}</a>
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

  function renderWarrensSummary(warrens) {
    const container = document.getElementById('summary-warrens');
    if (!container) return;

    if (!warrens || !warrens.picks || !warrens.picks.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
      return;
    }

    const top = warrens.picks.slice(0, 5);
    container.innerHTML = top.map(p => {
      const isStrong = p.recommendation === 'STRONG_QUALITY';
      const recLabel = isStrong ? 'STRONG' : 'QUALITY';
      const recCls = isStrong ? 'text-green-400' : 'text-amber-400';
      const mcap = fmtMcap(p.market_cap);
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(p.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(p.ticker)}</a>
          <span class="${recCls} text-xs font-semibold">${recLabel}</span>
          ${p.sector ? `<span class="text-xs text-gray-500">${esc(p.sector)}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${mcap ? `<span>${mcap}</span>` : ''}
          <span class="font-bold font-mono">${p.score}</span>
        </div>
      </div>`;
    }).join('');
  }

  function fmtMcap(val) {
    if (!val) return '';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(0) + 'M';
    return '$' + val.toLocaleString();
  }

  function renderCatalystSummary(catalysts) {
    const container = document.getElementById('summary-catalysts');
    if (!container) return;

    if (!catalysts || !catalysts.heatmap || !catalysts.heatmap.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
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
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(h.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(h.ticker)}</a>
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
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
      return;
    }

    const alerts = (watchlist.alerts || []).slice(0, 5);

    if (!alerts.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No recent alerts</p>';
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
      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(a.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(a.ticker)}</a>
          <span class="text-xs font-semibold" style="color:${ac}">${a.alert_type}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          ${a.price ? `<span class="font-mono">$${a.price.toFixed(2)}</span>` : ''}
          <span class="font-semibold" style="color:${pc}">${a.priority}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderOptionsFlowSummary(optionsFlow, dashboard) {
    const container = document.getElementById('summary-options');
    if (!container) return;

    if (!optionsFlow || !optionsFlow.tickers || !optionsFlow.tickers.length) {
      container.innerHTML = '<p class="text-gray-500 text-sm py-4">No data yet</p>';
      return;
    }

    // Build fundamentals lookup for convergence detection
    const fundMap = {};
    if (dashboard && dashboard.opportunities) {
      dashboard.opportunities.forEach(o => { fundMap[o.ticker] = o; });
    }

    // Sort: strongest |flow_score| first, prefer tickers with fundamental backing
    const scored = optionsFlow.tickers.map(t => {
      const fund = fundMap[t.ticker];
      const hasFund = fund && (fund.recommendation === 'BUY' || fund.recommendation === 'WATCHLIST');
      const hasInsider = fund && fund.breakdown && fund.breakdown.insider_buy_boost > 0;
      let layers = 0;
      if (Math.abs(t.flow_score) > 2) layers++;
      if (hasFund) layers++;
      if (hasInsider) layers++;
      return { ...t, _fund: fund, _layers: layers, _hasFund: hasFund, _hasInsider: hasInsider };
    }).sort((a, b) => {
      if (a._layers !== b._layers) return b._layers - a._layers;
      return Math.abs(b.flow_score) - Math.abs(a.flow_score);
    }).slice(0, 5);

    container.innerHTML = scored.map(t => {
      const isBullish = t.flow_score > 2;
      const isBearish = t.flow_score < -2;
      const scoreCls = isBullish ? 'text-green-400' : isBearish ? 'text-red-400' : 'text-gray-400';
      const prefix = t.flow_score > 0 ? '+' : '';

      let badges = '';
      if (t._hasFund) badges += `<span class="text-xs font-semibold ${t._fund.recommendation === 'BUY' ? 'text-green-400' : 'text-amber-400'}">${t._fund.recommendation}</span>`;
      if (t._hasInsider) badges += '<span class="text-xs text-yellow-400">Insider</span>';
      if (t._layers >= 3) badges += '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">3×</span>';
      else if (t._layers >= 2) badges += '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">2×</span>';

      return `<div class="flex items-center justify-between py-3.5 text-sm">
        <div class="flex items-center gap-2">
          <a href="ticker.html?t=${esc(t.ticker)}" class="font-bold font-mono hover:text-green-400 transition-colors">${esc(t.ticker)}</a>
          ${badges}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-400">
          <span>P/C ${t.put_call_ratio ? t.put_call_ratio.toFixed(2) : '-'}${t.td_put_call_ratio != null ? ' <span class="text-cyan-400">\u0398</span>' : ''}</span>
          <span class="font-bold font-mono ${scoreCls}">${prefix}${t.flow_score.toFixed(1)}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ── Stats bar ──

  function updateStats(data) {
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

      // Update stats
      updateStats(data);

      // Render summaries
      renderRegimeBar(data.regime);
      renderDashboardSummary(data.dashboard);
      renderContrarianSummary(data.contrarian);
      renderDeepDiveSummary(data.deepdive);
      renderWarrensSummary(data.warrens);
      renderWatchlistSummary(data.watchlist);
      renderCatalystSummary(data.catalysts);
      renderOptionsFlowSummary(data.optionsFlow, data.dashboard);

    } catch (e) {
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('error-state').classList.remove('hidden');
      document.getElementById('error-msg').textContent = e.message;
    }
  }

  function copyData(copyBtn, data) {
    const lines = [];
    const scanDate = data.dashboard?.scan_date || 'today';
    const scanTime = data.dashboard?.scan_time ? ` ${data.dashboard.scan_time}` : '';

    // Dashboard BUY/WATCHLIST
    if (data.dashboard?.opportunities) {
      const buys = data.dashboard.opportunities.filter(o => o.recommendation === 'BUY' || o.recommendation === 'WATCHLIST').slice(0, 5);
      if (buys.length) {
        lines.push('## Dashboard');
        for (const o of buys) lines.push(`${o.ticker} (${o.recommendation}) Score:${o.score} Conf:${o.confidence || '-'} ${o.profile || ''}`);
        lines.push('');
      }
    }
    // Contrarian
    if (data.contrarian) {
      const all = [...(data.contrarian.strong_candidates || []), ...(data.contrarian.candidates || [])].slice(0, 5);
      if (all.length) {
        lines.push('## Contrarian');
        for (const c of all) lines.push(`${c.ticker} Score:${c.score} Down:${c.down_from_high_pct || '-'}%`);
        lines.push('');
      }
    }
    // Rick's Picks
    if (data.deepdive) {
      const picks = [...(data.deepdive.value_picks || []), ...(data.deepdive.growth_picks || [])].filter(p => (p.opus_recommendation || '').toUpperCase() === 'BUY').slice(0, 5);
      if (picks.length) {
        lines.push("## Rick's Picks");
        for (const p of picks) lines.push(`${p.ticker} (${p.opus_recommendation}) ${p.framework?.score || '?'}/6`);
        lines.push('');
      }
    }
    // Warren's Picks
    if (data.warrens?.picks) {
      lines.push("## Warren's Picks");
      for (const p of data.warrens.picks.slice(0, 5)) lines.push(`${p.ticker} (${p.recommendation}) Score:${p.score}/100`);
      lines.push('');
    }
    // Options Flow
    if (data.optionsFlow?.tickers) {
      const top = data.optionsFlow.tickers.sort((a, b) => Math.abs(b.flow_score) - Math.abs(a.flow_score)).slice(0, 5);
      if (top.length) {
        lines.push('## Options Flow');
        for (const t of top) lines.push(`${t.ticker} (${t.direction}) Flow:${t.flow_score > 0 ? '+' : ''}${t.flow_score.toFixed(1)} P/C:${(t.put_call_ratio || 0).toFixed(2)}`);
        lines.push('');
      }
    }

    if (!lines.length) return;
    const header = `Bull Scouter Summary - ${scanDate}${scanTime}\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy'; }, 2000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
