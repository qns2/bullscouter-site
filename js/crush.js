/**
 * Bull Scouter — Deep-Crush Survivors page.
 *
 * Renders data/crush.json: quality names >=40% off their 52wk high, zeros rejected,
 * ranked by depth, each surfaced with a G3 narrative-falsification prompt. Depth is
 * the only validated edge; quality is a rule, not a ranker; confirmation is a badge.
 */
(() => {
  const DATA_URL = 'data/crush.json?_cb=' + Date.now();

  const $ = (s) => document.querySelector(s);
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const show = (id) => document.getElementById(id)?.classList.remove('hidden');
  const hide = (id) => document.getElementById(id)?.classList.add('hidden');
  const pct = (f, d = 0) => (f == null || Number.isNaN(f)) ? '—' : (f * 100).toFixed(d) + '%';
  const usd = (n) => (n == null || Number.isNaN(n)) ? '—' : '$' + Number(n).toFixed(2);

  const VERDICT = {
    'PASS-QUALITY': { c: '#00ff88', label: 'PASS · QUALITY' },
    'PASS':         { c: '#38bdf8', label: 'PASS' },
    'WATCH':        { c: '#fbbf24', label: 'WATCH' },
  };

  function badge(text, color) {
    return `<span class="text-[10px] px-1.5 py-0.5 rounded" style="background:${color}22;color:${color};border:1px solid ${color}44">${esc(text)}</span>`;
  }

  function card(p) {
    const v = VERDICT[p.verdict] || { c: '#94a3b8', label: p.verdict || '?' };
    const conf = (p.confirmations || []).map((c) => badge(c, '#00ff88')).join(' ');
    const flags = (p.flags || []).map((f) => badge(f, '#fbbf24')).join(' ');
    const stat = (label, val) => `<div><div class="text-[10px] text-bull-muted">${label}</div><div class="font-mono text-sm">${val}</div></div>`;
    const e = p.entry || {};
    return `
    <div class="glass-card p-4 flex flex-col gap-3" style="border-left:3px solid ${v.c}">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-extrabold">${esc(p.ticker)}</span>
            <span class="text-xs text-bull-muted">#${p.rank}</span>
          </div>
          <div class="text-2xl font-extrabold" style="color:${v.c}">${pct(p.down_from_high_pct)}<span class="text-xs text-bull-muted font-medium"> off high</span></div>
        </div>
        <div class="text-right">
          ${badge(v.label, v.c)}
          <div class="text-sm font-mono mt-1">${usd(p.spot_price)}</div>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-2">
        ${stat('op margin', pct(p.operating_margin, 1))}
        ${stat('rev growth', pct(p.revenue_growth, 1))}
        ${stat('dilution', pct(p.dilution, 1))}
        ${stat('R/R', p.rr_ratio == null ? '—' : p.rr_ratio)}
      </div>

      ${conf ? `<div class="flex flex-wrap gap-1">${conf}</div>` : ''}
      ${flags ? `<div class="flex flex-wrap gap-1">${flags}</div>` : ''}

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded bg-white/5 py-1"><div class="text-[10px] text-bull-muted">entry</div><div class="font-mono text-xs">${usd(e.low)}–${usd(e.high)}</div></div>
        <div class="rounded bg-white/5 py-1"><div class="text-[10px] text-bull-muted">target</div><div class="font-mono text-xs text-bull-accent">${usd(p.target)}</div></div>
        <div class="rounded bg-white/5 py-1"><div class="text-[10px] text-bull-muted">stop</div><div class="font-mono text-xs text-red-400">${usd(p.stop)}</div></div>
      </div>

      ${p.size ? `<div class="text-[10px] text-bull-muted">ladder: ${(p.size.rungs || []).map(usd).join(' / ')} · ${p.size.total_shares} sh · ${esc(p.size.note || '')}</div>` : ''}

      <details class="text-xs">
        <summary class="cursor-pointer text-bull-muted hover:text-white">G3 narrative test</summary>
        <p class="mt-1 text-white/70">${esc(p.g3_prompt)}</p>
      </details>

      <button class="cr-copy self-start text-[11px] px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10" data-t="${esc(p.ticker)}">📋 Copy for Claude</button>
    </div>`;
  }

  function copyText(p) {
    return [
      `${p.ticker} — ${pct(p.down_from_high_pct)} off 52wk high — ${p.verdict}`,
      `spot ${usd(p.spot_price)} · op margin ${pct(p.operating_margin, 1)} · rev growth ${pct(p.revenue_growth, 1)} · dilution ${pct(p.dilution, 1)}`,
      `entry ${usd((p.entry || {}).low)}–${usd((p.entry || {}).high)} · target ${usd(p.target)} · stop ${usd(p.stop)} · R/R ${p.rr_ratio}`,
      (p.confirmations || []).length ? `confirmation: ${(p.confirmations || []).join(', ')}` : '',
      (p.flags || []).length ? `flags: ${(p.flags || []).join('; ')}` : '',
      `G3: ${p.g3_prompt}`,
    ].filter(Boolean).join('\n');
  }

  function render(data) {
    $('#cr-date').textContent = data.date || '-';
    $('#cr-counts').textContent =
      `${data.shown ?? data.picks_count ?? 0} shown · ${data.total_survivors ?? data.picks_count ?? 0} survivors · ${data.candidates_evaluated || 0} evaluated · ${data.killed || 0} killed`;
    $('#version-badge') && ($('#version-badge').textContent = 'v' + (data.version || ''));

    if (data.strategic_context_blocks_new_entries) {
      const b = $('#cr-block');
      b.textContent = '⚠ Strategic context blocks new entries this week — survivors are suppressed by design.';
      b.classList.remove('hidden');
    }

    const picks = data.picks || [];
    if (!picks.length) { hide('cr-loading'); show('cr-empty'); return; }

    $('#cr-grid').innerHTML = picks.map(card).join('');
    hide('cr-loading');

    document.querySelectorAll('.cr-copy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = picks.find((x) => x.ticker === btn.dataset.t);
        if (p) navigator.clipboard.writeText(copyText(p)).then(() => {
          const o = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => (btn.textContent = o), 1200);
        });
      });
    });
    $('#btn-copy-all')?.addEventListener('click', () => {
      navigator.clipboard.writeText(picks.map(copyText).join('\n\n'));
    });
  }

  fetch(DATA_URL)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(render)
    .catch((err) => {
      hide('cr-loading');
      $('#cr-error-msg') && ($('#cr-error-msg').textContent = String(err));
      show('cr-error');
    });
})();
