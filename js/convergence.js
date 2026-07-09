/**
 * Bull Scouter — Convergence page.
 *
 * Renders data/convergence.json: today's multi-expert overlap cards (enriched
 * with scanner cross-ref, company health, options flow, news, entry/target/stop)
 * + a rolling 7-session history with per-ticker streaks.
 */
(() => {
  const DATA_URL = 'data/convergence.json?_cb=' + Date.now();

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const show = (id) => document.getElementById(id)?.classList.remove('hidden');
  const hide = (id) => document.getElementById(id)?.classList.add('hidden');
  const fmt = (n, d = 1) => (n == null || Number.isNaN(Number(n))) ? '—' : Number(n).toFixed(d);
  const fmtMcap = (m) => {
    if (m == null || Number.isNaN(Number(m))) return '—';
    const n = Number(m);
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
    return '$' + n.toFixed(0);
  };
  const fmtPct = (p) => (p == null || Number.isNaN(Number(p))) ? '—' : (Number(p) > 0 ? '+' : '') + Number(p).toFixed(1) + '%';

  function convictionBadge(o) {
    const c = (o.conviction || '').toLowerCase();
    const conflict = (o.convergence_type || '').toLowerCase() === 'conflicting';
    if (conflict) return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">⚠ conflicting</span>';
    if (c.includes('high')) return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">HIGH</span>';
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-bull-muted">' + esc(o.convergence_type || 'overlap') + '</span>';
  }

  function streakBadge(n) {
    if (!n || n <= 1) return '';
    const cls = n >= 5 ? 'bg-amber-500/20 text-amber-300' : n >= 3 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-bull-muted';
    return ` <span class="px-2 py-0.5 rounded text-[10px] font-bold ${cls}" title="Converged in ${n} consecutive assessor sessions">🔥 ${n}x streak</span>`;
  }

  function scannerBadge(cr) {
    if (!cr || !cr.recommendation) return '<span class="text-[10px] text-white/25">scanner: —</span>';
    const rec = cr.recommendation;
    const buyish = ['BUY', 'WATCHLIST', 'MOMENTUM'].includes(rec);
    const cls = rec === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : buyish ? 'bg-blue-500/15 text-blue-300' : 'bg-white/5 text-bull-muted';
    const label = rec === 'BUY' ? 'Assessor + Scanner BUY' : 'Scanner: ' + rec;
    const score = cr.total_score != null ? ` <span class="font-mono text-[10px]">${cr.total_score}</span>` : '';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${cls}">${esc(label)}${score}</span>`;
  }

  function healthRow(h) {
    if (!h || Object.keys(h).length === 0) return '<span class="text-white/25">—</span>';
    const parts = [];
    if (h.market_cap != null) parts.push(`mcap ${fmtMcap(h.market_cap)}`);
    if (h.down_from_high_pct != null) parts.push(`<span class="text-amber-400">${fmtPct(h.down_from_high_pct)} off high</span>`);
    if (h.opm != null) parts.push(`opm ${(Number(h.opm) * 100).toFixed(1)}%`);
    if (h.rev_g != null) parts.push(`rev ${fmtPct(h.rev_g * 100)}`);
    if (h.profit != null) parts.push(h.profit ? '<span class="text-emerald-400">profit</span>' : '<span class="text-red-400">loss</span>');
    if (h.dilution != null) parts.push(`dil ${fmtPct(h.dilution * 100)}`);
    return parts.join(' · ');
  }

  function flowRow(f) {
    if (!f || Object.keys(f).length === 0) return '<span class="text-white/25">—</span>';
    const parts = [];
    if (f.flow_score != null) {
      const s = Number(f.flow_score);
      const cls = s >= 3 ? 'text-emerald-400' : s <= -3 ? 'text-red-400' : 'text-white/70';
      parts.push(`flow <span class="${cls} font-mono">${fmt(s, 1)}</span>`);
    }
    if (f.put_call_ratio != null) parts.push(`P/C ${fmt(f.put_call_ratio, 2)}`);
    if (f.iv_skew != null) parts.push(`skew ${fmt(f.iv_skew, 2)}`);
    if (f.bullish_streak != null && f.bullish_streak > 0) parts.push(`<span class="text-emerald-400">${f.bullish_streak}d streak</span>`);
    return parts.join(' · ');
  }

  function newsBlock(n) {
    if (!n) return '<span class="text-white/25">—</span>';
    const bits = [];
    if (n.nearest_catalyst_days != null && n.nearest_catalyst_days >= 0) {
      bits.push(`<span class="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">⏰ next catalyst ${n.nearest_catalyst_days}d</span>`);
    }
    const events = (n.catalyst_events || []).slice(0, 4).map(e =>
      `<div class="text-[11px] text-white/60"><span class="text-bull-muted">${esc(e.date || '')}</span> · ${esc(e.type || '')} — ${esc(e.summary || '')}</div>`).join('');
    const jina = n.jina_brief
      ? `<div class="text-[11px] text-white/50 mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap">${esc(n.jina_brief.slice(0, 600))}${n.jina_brief.length > 600 ? '…' : ''}</div>`
      : '';
    if (!bits.length && !events && !jina) return '<span class="text-white/25">—</span>';
    return bits.join(' ') + (events ? `<div class="mt-1 space-y-0.5">${events}</div>` : '') + jina;
  }

  function actionRow(a) {
    if (!a) return '<span class="text-white/25">—</span>';
    const rr = a.rr_at_spot != null ? a.rr_at_spot : a.rr;
    return `entry <span class="font-mono text-white">${fmt(a.entry_low, 2)}–${fmt(a.entry_high, 2)}</span> · target <span class="font-mono text-emerald-400">${fmt(a.target, 2)}</span> · stop <span class="font-mono text-red-400">${fmt(a.stop, 2)}</span> · <span class="font-mono ${rr != null && rr >= 1 ? 'text-emerald-400' : 'text-amber-400'}">R/R ${fmt(rr, 2)}</span>`;
  }

  function renderCard(o) {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 flex flex-col gap-3';
    const tk = esc(o.ticker);
    const reasons = (o.reasons || []).map(r =>
      `<div class="text-[11px] text-white/60"><span class="text-bull-muted font-semibold">${esc(r.expert)}:</span> ${esc(r.reason)}</div>`).join('');
    const experts = (o.experts || []).join(', ');
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <a href="ticker.html?t=${tk}" class="text-lg font-extrabold text-white hover:text-bull-accent">${tk}</a>
          ${o.name ? `<span class="text-xs text-bull-muted ml-2">${esc(o.name)}</span>` : ''}
          <div class="text-[10px] text-white/30 mt-0.5">${esc(experts)}${o.sector ? ' · ' + esc(o.sector) : ''}</div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          ${convictionBadge(o)}${streakBadge(o.streak)}
        </div>
      </div>
      <div>${scannerBadge(o.scanner_cross_ref)}</div>
      <details class="border-t border-white/[0.06] pt-2">
        <summary class="cursor-pointer text-[11px] uppercase tracking-wider text-bull-muted hover:text-white">Why each expert flagged it</summary>
        <div class="mt-2 space-y-1">${reasons || '<span class="text-white/25 text-[11px]">—</span>'}</div>
      </details>
      <div class="border-t border-white/[0.06] pt-2 text-[11px]">
        <div class="text-bull-muted text-[10px] uppercase tracking-wider mb-0.5">Company health</div>
        <div>${healthRow(o.company_health)}</div>
      </div>
      <div class="text-[11px]">
        <div class="text-bull-muted text-[10px] uppercase tracking-wider mb-0.5">Options flow</div>
        <div>${flowRow(o.options_flow)}</div>
      </div>
      <details class="text-[11px]">
        <summary class="cursor-pointer text-bull-muted text-[10px] uppercase tracking-wider hover:text-white">News &amp; catalysts</summary>
        <div class="mt-1">${newsBlock(o.news)}</div>
      </details>
      <div class="border-t border-white/[0.06] pt-2 text-[11px]">
        <div class="text-bull-muted text-[10px] uppercase tracking-wider mb-0.5">Action</div>
        <div>${actionRow(o.action)}</div>
      </div>`;
    return card;
  }

  function renderHistory(history, streaks) {
    const wrap = document.getElementById('cv-history-list');
    wrap.innerHTML = '';
    const streakByTk = Object.fromEntries((streaks || []).map(s => [s.ticker, s.sessions_converged]));
    history.forEach((sess, idx) => {
      const det = document.createElement('details');
      det.className = 'glass-card p-3' + (idx === 0 ? '' : '');
      det.open = idx < 2;
      const tks = (sess.overlaps || []).map(o => {
        const st = streakByTk[o.ticker];
        const hot = st && st >= 3;
        return `<span class="px-2 py-0.5 rounded text-xs ${hot ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-white/70'}" ${hot ? `title="${st}-session streak"` : ''}>${esc(o.ticker)}${hot ? ` 🔥${st}` : ''}</span>`;
      }).join(' ');
      det.innerHTML = `
        <summary class="cursor-pointer text-sm">
          <span class="text-white font-semibold">${esc(sess.session_id)}</span>
          <span class="text-bull-muted text-xs ml-2">${sess.overlap_count} overlaps</span>
        </summary>
        <div class="mt-2 flex flex-wrap gap-1.5">${tks || '<span class="text-white/25 text-xs">none</span>'}</div>`;
      wrap.appendChild(det);
    });
    show('cv-history-section');
  }

  function copyForClaude(data) {
    const ovs = data.today?.overlaps || [];
    const lines = [`Convergence ${data.session_id} (${ovs.length} multi-expert overlaps):`];
    ovs.forEach(o => {
      const cr = o.scanner_cross_ref;
      const rec = cr ? ` [scanner ${cr.recommendation}${cr.total_score != null ? ' ' + cr.total_score : ''}]` : '';
      const reasons = (o.reasons || []).map(r => `${r.expert}: ${r.reason}`).join(' | ');
      lines.push(`- ${o.ticker}${rec} — ${o.convergence_type}, ${o.streak}x streak. ${reasons}`);
    });
    const txt = lines.join('\n');
    navigator.clipboard.writeText(txt).then(() => {
      const btn = $('#btn-copy-all');
      const lbl = btn.querySelector('.copy-label');
      const orig = lbl.textContent;
      lbl.textContent = 'Copied!';
      setTimeout(() => { lbl.textContent = orig; }, 1500);
    }).catch(() => {});
  }

  async function init() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      hide('cv-loading');

      const ovs = (data.today && data.today.overlaps) || [];
      const stats = (data.today && data.today.discovery_stats) || {};
      $('#cv-session').textContent = data.session_id || '-';
      $('#cv-stat-overlaps').textContent = ovs.length;
      $('#cv-stat-discovered').textContent = stats.unique_tickers ?? '—';
      $('#cv-stat-buy').textContent = ovs.filter(o => o.scanner_cross_ref?.recommendation === 'BUY').length;
      const maxStreak = Math.max(0, ...ovs.map(o => o.streak || 0));
      $('#cv-stat-streak').textContent = maxStreak || '—';
      $('#cv-stat-history').textContent = (data.history || []).length;

      if (ovs.length === 0) { show('cv-empty'); return; }

      const container = document.getElementById('cv-cards');
      // Sort: streak desc, then scanner BUY first
      const sorted = [...ovs].sort((a, b) => {
        const buyRank = (o) => o.scanner_cross_ref?.recommendation === 'BUY' ? 1 : 0;
        if (buyRank(b) !== buyRank(a)) return buyRank(b) - buyRank(a);
        return (b.streak || 0) - (a.streak || 0);
      });
      sorted.forEach(o => container.appendChild(renderCard(o)));

      if (data.history && data.history.length) renderHistory(data.history, data.streaks);

      $('#btn-copy-all').addEventListener('click', () => copyForClaude(data));
    } catch (e) {
      hide('cv-loading');
      show('cv-error');
      document.getElementById('cv-error-msg').textContent = String(e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();