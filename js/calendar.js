/**
 * Bull Scouter - Catalyst Calendar Page
 * Date-sorted event calendar with type filters, sorting,
 * and AI-enriched beneficiary chips.
 * Reads catalysts array from data/catalysts.json.
 */

const CatalystCalendar = (() => {
  const DATA_PATH = 'data/catalysts.json';
  let pageData = null;
  let allCatalysts = [];
  let activeFilter = 'all';
  let activeSort = 'date';

  // Type-to-display config
  const TYPE_CONFIG = {
    fda:               { label: 'FDA',             color: 'cat-badge-fda' },
    launch:            { label: 'Launch',           color: 'cat-badge-launch' },
    earnings:          { label: 'Earnings',         color: 'cat-badge-earnings' },
    insider_buy:       { label: 'Insider Buy',      color: 'cat-badge-insider_buy' },
    activist_filing:   { label: 'Activist',         color: 'cat-badge-activist_filing' },
    partnership:       { label: 'Partnership',      color: 'cat-badge-partnership' },
    buyback:           { label: 'Buyback',          color: 'cat-badge-buyback' },
    analyst_upgrade:   { label: 'Upgrade',          color: 'cat-badge-analyst_upgrade' },
    analyst_downgrade: { label: 'Downgrade',        color: 'cat-badge-analyst_downgrade' },
    dilution:          { label: 'Dilution',         color: 'cat-badge-dilution' },
    earnings_beat:     { label: 'Beat',             color: 'cat-badge-earnings_beat' },
  };

  const SOURCE_LABELS = {
    rttnews: 'RTTNews',
    catalystalert: 'CatalystAlert',
    spacedevs: 'SpaceDevs',
    finnhub: 'Finnhub',
    perplexity: 'Perplexity',
    nasdaq: 'NASDAQ',
    sec_edgar: 'SEC',
    seekingalpha: 'SA',
  };

  const CORE_FILTER_TYPES = new Set(['fda', 'launch', 'earnings', 'insider_buy', 'activist_filing']);

  // ── Init ──

  async function init() {
    document.querySelectorAll('[data-cal-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cal-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.calFilter;
        render();
      });
    });

    document.querySelectorAll('[data-cal-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cal-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSort = btn.dataset.calSort;
        render();
      });
    });

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      pageData = data;
      allCatalysts = data.catalysts || [];
      hide('cal-loading');

      if (!allCatalysts.length) {
        show('cal-empty');
        return;
      }

      const copyBtn = document.getElementById('btn-copy-calendar');
      if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

      const dateNav = document.getElementById('cal-date-nav');
      if (dateNav && data.scan_date) {
        dateNav.textContent = data.scan_date + (data.scan_time ? ' ' + data.scan_time : '');
      }
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = 'v' + data.version;

      render();
    } catch (e) {
      hide('cal-loading');
      show('cal-error');
      const msg = document.getElementById('cal-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  // ── Filter & Sort ──

  function getFiltered() {
    if (activeFilter === 'all') return allCatalysts;
    if (activeFilter === 'other') return allCatalysts.filter(c => !CORE_FILTER_TYPES.has(c.type));
    return allCatalysts.filter(c => c.type === activeFilter);
  }

  function getSorted(catalysts) {
    return [...catalysts].sort((a, b) => {
      if (activeSort === 'ticker') return (a.ticker || '').localeCompare(b.ticker || '');
      if (activeSort === 'type') {
        const ta = a.type || '';
        const tb = b.type || '';
        if (ta !== tb) return ta.localeCompare(tb);
        return dateCmp(a, b);
      }
      return dateCmp(a, b);
    });
  }

  function dateCmp(a, b) {
    const da = a.event_date || '9999';
    const db = b.event_date || '9999';
    if (da !== db) return da.localeCompare(db);
    return (a.ticker || '').localeCompare(b.ticker || '');
  }

  // ── Render ──

  function render() {
    const filtered = getSorted(getFiltered());
    updateStats(filtered);

    const container = document.getElementById('cal-cards');
    if (!container) return;
    container.innerHTML = '';

    if (!filtered.length) {
      show('cal-empty');
      return;
    }
    hide('cal-empty');

    for (const c of filtered) {
      container.appendChild(renderCard(c));
    }
  }

  function updateStats(filtered) {
    setText('cal-stat-total', filtered.length);
    const now7 = filtered.filter(c => c.days_until != null && c.days_until >= 0 && c.days_until <= 7).length;
    const now30 = filtered.filter(c => c.days_until != null && c.days_until >= 0 && c.days_until <= 30).length;
    setText('cal-stat-7d', now7);
    setText('cal-stat-30d', now30);
    const enriched = filtered.filter(c => c.beneficiaries && c.beneficiaries.length > 0).length;
    setText('cal-stat-enriched', enriched);
  }

  function renderCard(c) {
    const card = el('div', 'cat-card');

    // Header: type badge + ticker + event name
    const header = el('div', 'cat-card-header');

    const typeConf = TYPE_CONFIG[c.type] || { label: capitalize(c.type), color: 'cat-badge-other' };
    const badge = el('span', 'cat-type-badge ' + typeConf.color);
    badge.textContent = typeConf.label;
    header.appendChild(badge);

    const tickerLink = document.createElement('a');
    tickerLink.href = `https://finance.yahoo.com/quote/${encodeURIComponent(c.ticker)}`;
    tickerLink.target = '_blank';
    tickerLink.rel = 'noopener';
    tickerLink.className = 'text-base font-bold font-mono hover:text-green-400 transition-colors ml-2';
    tickerLink.textContent = c.ticker;
    header.appendChild(tickerLink);

    const nameEl = el('span', 'text-sm text-gray-400 ml-2 truncate');
    nameEl.textContent = c.event_name || '';
    header.appendChild(nameEl);

    card.appendChild(header);

    // Date row
    const dateRow = el('div', 'cat-date-row');
    if (c.event_date) {
      const dateEl = el('span', 'font-mono text-sm text-gray-300');
      dateEl.textContent = c.event_date;
      dateRow.appendChild(dateEl);

      if (c.days_until != null) {
        const daysClass = c.days_until <= 7 ? 'text-green-400' : c.days_until <= 30 ? 'text-amber-400' : 'text-gray-500';
        const daysEl = el('span', `font-mono text-xs ${daysClass} ml-2`);
        daysEl.textContent = c.days_until === 0 ? 'TODAY' : c.days_until === 1 ? '1 day' : `${c.days_until}d`;
        dateRow.appendChild(daysEl);
      }
    } else {
      const tbdEl = el('span', 'text-xs text-gray-600 italic');
      tbdEl.textContent = 'Ongoing signal';
      dateRow.appendChild(tbdEl);
    }

    const srcLabel = SOURCE_LABELS[c.source] || c.source || '';
    if (srcLabel) {
      const srcEl = el('span', 'cat-source-badge ml-auto');
      srcEl.textContent = srcLabel;
      dateRow.appendChild(srcEl);
    }

    card.appendChild(dateRow);

    // Summary
    if (c.summary && c.summary !== c.event_name) {
      const summaryEl = el('p', 'text-sm text-gray-400 mt-2 leading-relaxed');
      summaryEl.textContent = c.summary;
      card.appendChild(summaryEl);
    }

    // Confidence
    if (c.confidence != null) {
      const confRow = el('div', 'mt-2 flex items-center gap-2');
      const confLabel = el('span', 'text-xs text-gray-600');
      confLabel.textContent = 'Confidence:';
      confRow.appendChild(confLabel);
      const confBar = el('div', 'conf-bar flex-1');
      const confFill = el('div', 'conf-bar-fill');
      const pct = Math.round(c.confidence * 100);
      confFill.style.width = pct + '%';
      confFill.style.background = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#6b7280';
      confBar.appendChild(confFill);
      confRow.appendChild(confBar);
      const confVal = el('span', 'text-xs font-mono text-gray-400');
      confVal.textContent = pct + '%';
      confRow.appendChild(confVal);
      card.appendChild(confRow);
    }

    // Beneficiaries
    if (c.beneficiaries && c.beneficiaries.length > 0) {
      const benSection = el('div', 'cat-beneficiaries');
      const benTitle = el('div', 'cat-section-title');
      benTitle.textContent = 'Also benefits';
      benSection.appendChild(benTitle);

      const chipRow = el('div', 'flex flex-wrap gap-1.5');
      for (const b of c.beneficiaries) {
        const chip = el('span', 'cat-ben-chip');
        chip.textContent = b.ticker;
        chip.title = b.reason || '';
        chipRow.appendChild(chip);
      }
      benSection.appendChild(chipRow);
      card.appendChild(benSection);
    }

    return card;
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
    const filtered = getSorted(getFiltered());
    if (!filtered.length) return;
    const lines = filtered.map(c => {
      const parts = [c.ticker];
      const typeConf = TYPE_CONFIG[c.type] || { label: capitalize(c.type) };
      parts.push(typeConf.label);
      if (c.event_name) parts.push(c.event_name);
      if (c.event_date) parts.push(c.event_date);
      if (c.days_until != null) parts.push(`${c.days_until}d`);
      if (c.confidence != null) parts.push(`Conf: ${Math.round(c.confidence * 100)}%`);
      if (c.source) parts.push(`Src: ${SOURCE_LABELS[c.source] || c.source}`);
      if (c.beneficiaries && c.beneficiaries.length) {
        parts.push(`Also: ${c.beneficiaries.map(b => b.ticker).join(', ')}`);
      }
      return parts.join(' | ');
    });
    const header = `Bull Scouter Calendar — ${pageData?.scan_date || 'today'}\n${filtered.length} events (filter: ${activeFilter})\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copy for Claude'; }, 2000);
    });
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
