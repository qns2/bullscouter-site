/**
 * Bull Scouter - Darwin Evolution Log
 * Renders the system's self-improvement timeline: code changes,
 * reviews, assessment shifts, calibration updates, and version bumps.
 * Reads from data/darwin.json.
 */

const DarwinLog = (() => {
  const DATA_PATH = 'data/darwin.json';
  let pageData = null;
  let allEntries = [];
  let activeFilter = 'all';

  // Agent colors (border-left + badge background)
  const AGENT_COLORS = {
    Tony:    { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: '#ec4899' },
    Linus:   { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '#a855f7' },
    Oracle:  { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '#3b82f6' },
    Rick:    { bg: 'rgba(0, 255, 136, 0.12)',  color: '#00ff88', border: '#00ff88' },
    Scanner: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '#94a3b8' },
    System:  { bg: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255,255,255,0.5)', border: '#64748b' },
  };

  // Type display config
  const TYPE_CONFIG = {
    code_change:  { label: 'Code',        color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
    review:       { label: 'Review',      color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    assessment:   { label: 'Assessment',  color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    calibration:  { label: 'Calibration', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.12)' },
    version:      { label: 'Version',     color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  };

  // Month names for date headers
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ── Init ──

  async function init() {
    // Bind filter buttons
    document.querySelectorAll('[data-darwin-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-darwin-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.darwinFilter;
        render();
      });
    });

    // Bind copy button
    const copyBtn = document.getElementById('btn-copy-darwin');
    if (copyBtn) copyBtn.addEventListener('click', () => copyData(copyBtn));

    try {
      const resp = await fetch(DATA_PATH + '?_cb=' + Date.now());
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const data = await resp.json();
      pageData = data;
      allEntries = data.entries || [];
      hide('darwin-loading');

      // Date nav
      const dateNav = document.getElementById('darwin-date-nav');
      if (dateNav && data.generated) {
        dateNav.textContent = data.generated.split('T')[0];
      }

      // Version badge
      const vBadge = document.getElementById('version-badge');
      if (vBadge && data.version) vBadge.textContent = 'v' + data.version;

      if (!allEntries.length) {
        show('darwin-empty');
        return;
      }

      render();
    } catch (e) {
      hide('darwin-loading');
      show('darwin-error');
      const msg = document.getElementById('darwin-error-msg');
      if (msg) msg.textContent = e.message;
    }
  }

  // ── Filter ──

  function getFiltered() {
    if (activeFilter === 'all') return allEntries;
    return allEntries.filter(e => e.type === activeFilter);
  }

  // ── Render ──

  function render() {
    const filtered = getFiltered();
    updateStats(filtered);

    const container = document.getElementById('darwin-timeline');
    if (!container) return;
    container.innerHTML = '';

    if (!filtered.length) {
      show('darwin-empty');
      return;
    }
    hide('darwin-empty');

    // Group by date
    const groups = groupByDate(filtered);

    for (const [date, entries] of groups) {
      // Date header
      const header = el('div', 'darwin-date-header');
      header.textContent = formatDateHeader(date);
      container.appendChild(header);

      // Entries for this date
      for (const entry of entries) {
        container.appendChild(renderEntry(entry));
      }
    }
  }

  function groupByDate(entries) {
    const map = new Map();
    for (const entry of entries) {
      const date = entry.date || 'Unknown';
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(entry);
    }
    return map;
  }

  function formatDateHeader(dateStr) {
    if (!dateStr || dateStr === 'Unknown') return 'Unknown Date';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return MONTHS[month] + ' ' + day + ', ' + year;
  }

  function updateStats(filtered) {
    const stats = pageData?.stats || {};
    // If we're filtering, compute from filtered entries; otherwise use stats object
    if (activeFilter === 'all') {
      setText('stat-total', stats.total_entries ?? allEntries.length);
      setText('stat-code', stats.code_changes ?? countType(allEntries, 'code_change'));
      setText('stat-reviews', stats.reviews ?? countType(allEntries, 'review'));
      setText('stat-versions', stats.versions ?? countType(allEntries, 'version'));
    } else {
      setText('stat-total', filtered.length);
      setText('stat-code', countType(filtered, 'code_change'));
      setText('stat-reviews', countType(filtered, 'review'));
      setText('stat-versions', countType(filtered, 'version'));
    }
  }

  function countType(entries, type) {
    return entries.filter(e => e.type === type).length;
  }

  function renderEntry(entry) {
    const wrapper = el('div', 'darwin-entry');

    const agentConf = AGENT_COLORS[entry.agent] || AGENT_COLORS.System;
    const typeConf = TYPE_CONFIG[entry.type] || TYPE_CONFIG.code_change;

    // Card with agent-colored left border
    const card = el('div', 'darwin-card');
    card.style.borderLeftColor = agentConf.border;

    // Top row: time + agent badge + type badge
    const topRow = el('div', 'flex items-center gap-2 flex-wrap mb-2');

    // Time
    const timeEl = el('span', 'text-xs font-mono text-white/30');
    timeEl.textContent = entry.time || '';
    if (entry.time) topRow.appendChild(timeEl);

    // Agent badge
    const agentBadge = el('span', 'agent-badge');
    agentBadge.style.backgroundColor = agentConf.bg;
    agentBadge.style.color = agentConf.color;
    agentBadge.textContent = entry.agent || 'System';
    topRow.appendChild(agentBadge);

    // Type badge
    const typeBadge = el('span', 'darwin-type-badge');
    typeBadge.style.backgroundColor = typeConf.bg;
    typeBadge.style.color = typeConf.color;
    typeBadge.textContent = typeConf.label;
    topRow.appendChild(typeBadge);

    card.appendChild(topRow);

    // Title
    const titleEl = el('p', 'text-sm font-semibold text-white/90 leading-snug');
    titleEl.textContent = entry.title || '';
    card.appendChild(titleEl);

    // Description
    if (entry.description) {
      const descEl = el('p', 'text-xs text-white/40 mt-1 leading-relaxed');
      descEl.textContent = entry.description;
      card.appendChild(descEl);
    }

    // Details (expandable)
    if (entry.details && Object.keys(entry.details).length > 0) {
      const detailsContainer = el('div', '');

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'darwin-details-toggle mt-2';
      toggleBtn.textContent = '+ details';

      const detailsDiv = el('div', 'darwin-details hidden');
      detailsDiv.innerHTML = renderDetails(entry.type, entry.details);

      toggleBtn.addEventListener('click', () => {
        const isHidden = detailsDiv.classList.contains('hidden');
        detailsDiv.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? '- details' : '+ details';
      });

      detailsContainer.appendChild(toggleBtn);
      detailsContainer.appendChild(detailsDiv);
      card.appendChild(detailsContainer);
    }

    wrapper.appendChild(card);
    return wrapper;
  }

  function renderDetails(type, details) {
    const parts = [];

    if (type === 'code_change') {
      if (details.files_changed != null) parts.push('<span class="text-white/50">' + details.files_changed + ' file' + (details.files_changed !== 1 ? 's' : '') + ' changed</span>');
      if (details.insertions != null) parts.push('<span style="color: #00ff88;">+' + details.insertions + '</span>');
      if (details.deletions != null) parts.push('<span style="color: #f87171;">-' + details.deletions + '</span>');
      if (details.pr_number != null) parts.push('<span class="text-white/50">PR #' + details.pr_number + '</span>');
      if (details.branch) parts.push('<span class="text-white/40">' + escapeHtml(details.branch) + '</span>');
    } else if (type === 'review') {
      if (details.verdict) {
        const verdictColor = details.verdict === 'approved' ? '#00ff88' : details.verdict === 'changes_requested' ? '#f59e0b' : '#94a3b8';
        parts.push('<span style="color: ' + verdictColor + '; text-transform: uppercase; font-weight: 600;">' + escapeHtml(details.verdict) + '</span>');
      }
      if (details.comments != null) parts.push('<span class="text-white/50">' + details.comments + ' comment' + (details.comments !== 1 ? 's' : '') + '</span>');
      if (details.pr_number != null) parts.push('<span class="text-white/50">PR #' + details.pr_number + '</span>');
    } else if (type === 'calibration') {
      if (details.horizon) parts.push('<span class="text-white/50">Horizon: ' + escapeHtml(details.horizon) + '</span>');
      if (details.win_rate != null) parts.push('<span style="color: #00ff88;">Win rate: ' + details.win_rate + '%</span>');
      if (details.sample_size != null) parts.push('<span class="text-white/50">n=' + details.sample_size + '</span>');
      if (details.prev_win_rate != null) parts.push('<span class="text-white/40">prev: ' + details.prev_win_rate + '%</span>');
    } else if (type === 'version') {
      if (details.changes) parts.push('<span class="text-white/50">' + escapeHtml(details.changes) + '</span>');
    } else if (type === 'assessment') {
      if (details.picks != null) parts.push('<span class="text-white/50">' + details.picks + ' pick' + (details.picks !== 1 ? 's' : '') + '</span>');
      if (details.blind_spots != null) parts.push('<span style="color: #f59e0b;">' + details.blind_spots + ' blind spot' + (details.blind_spots !== 1 ? 's' : '') + '</span>');
      if (details.overlap != null) parts.push('<span style="color: #00ff88;">' + details.overlap + ' overlap</span>');
    }

    // Fallback: render any remaining keys not already handled
    if (!parts.length) {
      for (const [key, val] of Object.entries(details)) {
        parts.push('<span class="text-white/50">' + escapeHtml(key) + ': ' + escapeHtml(String(val)) + '</span>');
      }
    }

    return parts.join('<span class="text-white/10 mx-2">|</span>');
  }

  // ── Copy ──

  function copyData(copyBtn) {
    const filtered = getFiltered();
    if (!filtered.length) return;

    const lines = [];
    lines.push('Bull Scouter Darwin Log');
    lines.push('Generated: ' + (pageData?.generated || 'unknown'));
    lines.push('Filter: ' + activeFilter);
    lines.push('Entries: ' + filtered.length);
    lines.push('');

    let currentDate = '';
    for (const entry of filtered) {
      if (entry.date !== currentDate) {
        currentDate = entry.date;
        lines.push('--- ' + formatDateHeader(currentDate) + ' ---');
      }
      const timePart = entry.time ? ' ' + entry.time : '';
      const typeConf = TYPE_CONFIG[entry.type] || { label: entry.type };
      lines.push('[' + typeConf.label + '] ' + (entry.agent || 'System') + timePart);
      lines.push('  ' + (entry.title || ''));
      if (entry.description) lines.push('  ' + entry.description);

      if (entry.details) {
        const detailParts = [];
        for (const [key, val] of Object.entries(entry.details)) {
          detailParts.push(key + ': ' + val);
        }
        if (detailParts.length) lines.push('  (' + detailParts.join(', ') + ')');
      }
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        if (label) label.textContent = 'Copy';
      }, 2000);
    });
  }

  // ── Helpers ──

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function setText(id, val) {
    const elem = document.getElementById(id);
    if (elem) elem.textContent = val;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', init);
})();
