/**
 * Bull Scouter - Catalyst Heatmap Page
 * Renders ticker-centric heatmap cards ranked by combined
 * catalyst signal strength. Reads heatmap array from catalysts.json.
 */

const CatalystHeatmap = (() => {
  const DATA_PATH = 'data/catalysts.json';
  let pageData = null;
  let heatmapData = [];
  let activeFilter = 'all';

  // Type label map
  const TYPE_LABELS = {
    fda: 'FDA', launch: 'Launch', earnings: 'Earnings',
    insider_buy: 'Insider Buy', activist_filing: 'Activist',
    partnership: 'Partnership', buyback: 'Buyback',
    analyst_upgrade: 'Upgrade', analyst_downgrade: 'Downgrade',
    dilution: 'Dilution', earnings_beat: 'Beat',
    contract: 'Contract', dividend: 'Dividend',
  };

  // Signal chip colors by type
  const SIGNAL_COLORS = {
    insider_buy:       { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
    activist_filing:   { bg: 'rgba(168,85,247,0.15)', text: '#c4b5fd' },
    partnership:       { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd' },
    buyback:           { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
    analyst_upgrade:   { bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },
    fda:               { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
    earnings_beat:     { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
    launch:            { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd' },
    earnings:          { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
    contract:          { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd' },
    dividend:          { bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },
    analyst_downgrade: { bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5' },
    dilution:          { bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5' },
  };
  const DEFAULT_COLOR = { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' };

  const REC_COLORS = {
    BUY: 'bg-green-500/20 text-green-400 border border-green-500/30',
    WATCHLIST: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    MOMENTUM: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };

  const SOURCE_LABELS = {
    finnhub: 'Finnhub', sec_edgar: 'SEC', seekingalpha: 'SA',
    perplexity: 'Perplexity', rttnews: 'RTTNews', spacedevs: 'SpaceDevs',
    catalystalert: 'CatalystAlert', nasdaq: 'NASDAQ', benzinga: 'Benzinga',
  };

  const CHECKLIST_ICONS = { pass: '\u2705', partial: '\u26A0\uFE0F', fail: '\u274C' };

  // ── Init ──

  async function init() {
    // Filter tabs
    document.querySelectorAll('[data-hm-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-hm-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.hmFilter;
        render();
      });
    });

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      pageData = data;
      heatmapData = data.heatmap || [];
      hide('hm-loading');

      if (!heatmapData.length) {
        show('hm-empty');
        return;
      }

      // Copy button
      const copyBtn = document.getElementById('btn-copy-heatmap');
      if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

      // Date + version
      const dateNav = document.getElementById('hm-date-nav');
      if (dateNav && data.scan_date) {
        dateNav.textContent = data.scan_date + (data.scan_time ? ' ' + data.scan_time : '');
      }
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = 'v' + data.version;

      // Stats
      updateStats(heatmapData);

      render();
    } catch (e) {
      hide('hm-loading');
      show('hm-error');
      const msg = document.getElementById('hm-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  function updateStats(items) {
    setText('hm-stat-tickers', items.length);
    const totalSignals = items.reduce((sum, h) => sum + h.signal_count, 0);
    setText('hm-stat-signals', totalSignals);
    const sources = new Set();
    for (const h of items) {
      for (const s of (h.signals || [])) {
        if (s.source) sources.add(s.source);
      }
    }
    setText('hm-stat-sources', sources.size);
  }

  // ── Render ──

  function getFiltered() {
    const nonPharma = heatmapData.filter(h => h.category !== 'pharma');
    if (activeFilter === 'all') return nonPharma;
    if (activeFilter === 'smallmid') return nonPharma.filter(h => !h.large_cap);
    if (activeFilter === 'largecap') return nonPharma.filter(h => h.large_cap);
    return nonPharma;
  }

  function getPharma() {
    return heatmapData.filter(h => h.category === 'pharma');
  }

  function render() {
    const filtered = getFiltered();
    const pharma = getPharma();
    updateStats([...filtered, ...pharma]);

    const container = document.getElementById('hm-cards');
    if (!container) return;
    container.innerHTML = '';

    if (!filtered.length && !pharma.length) {
      show('hm-empty');
      return;
    }
    hide('hm-empty');

    for (const entry of filtered) {
      container.appendChild(renderCard(entry));
    }

    // Pharma section
    const pharmaSection = document.getElementById('hm-pharma-section');
    const pharmaContainer = document.getElementById('hm-pharma-cards');
    if (pharmaSection && pharmaContainer) {
      pharmaContainer.innerHTML = '';
      if (pharma.length) {
        pharmaSection.classList.remove('hidden');
        for (const entry of pharma) {
          pharmaContainer.appendChild(renderCard(entry));
        }
      } else {
        pharmaSection.classList.add('hidden');
      }
    }
  }

  function renderCard(entry) {
    const card = el('div', 'heatmap-card');

    // Top row: score badge + ticker + large-cap tag + recommendation + scanner score
    const topRow = el('div', 'flex items-center gap-2 mb-2');

    // Score badge
    const scoreClass = entry.heatmap_score >= 30 ? 'heatmap-score-high'
      : entry.heatmap_score >= 15 ? 'heatmap-score-mid' : 'heatmap-score-low';
    const scoreBadge = el('div', 'heatmap-score-badge ' + scoreClass);
    scoreBadge.textContent = entry.heatmap_score;
    topRow.appendChild(scoreBadge);

    // Ticker link
    const tickerLink = document.createElement('a');
    tickerLink.href = `ticker.html?t=${encodeURIComponent(entry.ticker)}`;
    tickerLink.className = 'text-base font-bold font-mono hover:text-green-400 transition-colors';
    tickerLink.textContent = entry.ticker;
    topRow.appendChild(tickerLink);

    // Category badge
    if (entry.category === 'pharma') {
      const lcBadge = el('span', 'text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30');
      lcBadge.textContent = 'PHARMA';
      topRow.appendChild(lcBadge);
    } else if (entry.large_cap) {
      const lcBadge = el('span', 'text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30');
      lcBadge.textContent = 'LARGE CAP';
      topRow.appendChild(lcBadge);
    }

    // Recommendation badge
    if (entry.recommendation) {
      const recClass = REC_COLORS[entry.recommendation] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
      const recBadge = el('span', `text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded ${recClass}`);
      recBadge.textContent = entry.recommendation;
      topRow.appendChild(recBadge);
    }

    // Right side: profile + scanner score
    const rightSide = el('div', 'ml-auto flex items-center gap-2');
    if (entry.profile) {
      const profBadge = el('span', 'text-[0.6rem] font-mono text-gray-500');
      profBadge.textContent = entry.profile.replace(/_/g, ' ');
      rightSide.appendChild(profBadge);
    }
    if (entry.score) {
      const scoreEl = el('span', 'text-xs font-mono text-gray-500');
      scoreEl.textContent = `${entry.score}pts`;
      rightSide.appendChild(scoreEl);
    }
    topRow.appendChild(rightSide);

    card.appendChild(topRow);

    // Financial row
    if (entry.financials) {
      const fin = entry.financials;
      const finRow = el('div', 'heatmap-fin-row mb-2');

      if (fin.current_price) addFinItem(finRow, '$' + Number(fin.current_price).toFixed(2));
      if (fin.market_cap_fmt) addFinItem(finRow, fin.market_cap_fmt);
      if (fin.down_from_high_pct) addFinItem(finRow, '-' + fin.down_from_high_pct + '% ATH', fin.down_from_high_pct >= 30 ? '#fbbf24' : null);
      if (fin.forward_pe) addFinItem(finRow, 'PE ' + fin.forward_pe);
      if (fin.revenue_growth != null) addFinItem(finRow, 'Rev ' + (fin.revenue_growth >= 0 ? '+' : '') + fin.revenue_growth + '%', fin.revenue_growth >= 20 ? '#4ade80' : null);
      if (fin.gross_margin != null) addFinItem(finRow, 'GM ' + fin.gross_margin + '%');

      card.appendChild(finRow);
    }

    // Signal chips
    if (entry.signals && entry.signals.length) {
      const chipRow = el('div', 'flex flex-wrap gap-1 mb-1.5');
      for (const sig of entry.signals) {
        const colors = SIGNAL_COLORS[sig.type] || DEFAULT_COLOR;
        const chip = el('span', 'heatmap-signal-chip');
        chip.style.background = colors.bg;
        chip.style.color = colors.text;
        const weightStr = sig.weight >= 0 ? `+${sig.weight}` : `${sig.weight}`;
        chip.textContent = `${TYPE_LABELS[sig.type] || capitalize(sig.type)} ${weightStr}`;
        chip.title = (sig.name || '') + (sig.source ? ` (${SOURCE_LABELS[sig.source] || sig.source})` : '');
        chipRow.appendChild(chip);
      }
      card.appendChild(chipRow);
    }

    // Quality checklist (Value/Growth, like contrarian page)
    if (entry.quality_checklist && entry.quality_checklist.items) {
      const qc = entry.quality_checklist;
      const fw = qc.framework === 'value' ? 'Value' : 'Growth Quality';
      const checklistRow = el('div', 'mt-1.5 text-xs text-gray-400 leading-relaxed');
      const items = Object.entries(qc.items)
        .map(([name, status]) => `<span class="inline-block mr-1">${CHECKLIST_ICONS[status] || '?'} ${name}</span>`)
        .join('');
      checklistRow.innerHTML = `<span class="font-semibold text-gray-300">${fw} (${qc.score}/${qc.denominator})</span>: ${items}`;
      card.appendChild(checklistRow);
    }

    // Signal count + source attribution
    const footRow = el('div', 'text-[0.6rem] text-gray-600 mt-1');
    const srcSet = new Set((entry.signals || []).map(s => s.source).filter(Boolean));
    const srcStr = [...srcSet].map(s => SOURCE_LABELS[s] || s).join(', ');
    footRow.textContent = `${entry.signal_count} signal${entry.signal_count !== 1 ? 's' : ''}` +
      (srcStr ? ` via ${srcStr}` : '');
    card.appendChild(footRow);

    return card;
  }

  function addFinItem(row, text, color) {
    const span = el('span', '');
    span.textContent = text;
    if (color) span.style.color = color;
    row.appendChild(span);
  }

  // ── Helpers ──

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function copyData(copyBtn) {
    if (!heatmapData.length) return;
    const filtered = getFiltered();
    const pharma = getPharma();
    const all = [...filtered, ...pharma];
    const lines = all.map(h => {
      const parts = [`${h.ticker} (score=${h.heatmap_score})`];
      if (h.category === 'pharma') parts.push('PHARMA');
      else if (h.large_cap) parts.push('LARGE-CAP');
      if (h.recommendation) parts.push(h.recommendation);
      if (h.score) parts.push(`${h.score}pts`);
      if (h.profile) parts.push(h.profile);
      if (h.financials) {
        const f = h.financials;
        if (f.current_price) parts.push('$' + Number(f.current_price).toFixed(2));
        if (f.market_cap_fmt) parts.push(f.market_cap_fmt);
        if (f.down_from_high_pct) parts.push(`-${f.down_from_high_pct}% ATH`);
      }
      const sigs = (h.signals || []).map(s => `${TYPE_LABELS[s.type] || s.type}(${s.weight >= 0 ? '+' : ''}${s.weight})`);
      if (sigs.length) parts.push('Signals: ' + sigs.join(', '));
      const qc = h.quality_checklist;
      if (qc) parts.push(`${qc.framework === 'value' ? 'Value' : 'Growth'} ${qc.score}/${qc.denominator}`);
      return parts.join(' | ');
    });
    const filterLabel = activeFilter === 'all' ? '' : ` [${activeFilter}]`;
    const header = `Bull Scouter Catalyst Heatmap${filterLabel} — ${pageData?.scan_date || 'today'}\n${all.length} tickers\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy'; }, 2000);
    });
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
