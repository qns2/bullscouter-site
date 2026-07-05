// Personal menu for power-user pages.
// Toggle: ?antonis turns it on, ?antonis=0 turns it off. Sticks via localStorage.
// Renders a small floating pill in the top-right with a dropdown of personal-only pages.
// Obscurity, not security — anything sensitive must not live behind this.
(function () {
  const STORAGE_KEY = 'bs_personal_mode';
  const PARAM_KEY = 'antonis';

  const params = new URLSearchParams(window.location.search);
  if (params.has(PARAM_KEY)) {
    const v = (params.get(PARAM_KEY) || '').toLowerCase();
    if (v === '0' || v === 'off' || v === 'false' || v === 'exit') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    params.delete(PARAM_KEY);
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    history.replaceState(null, '', newUrl);
  }

  if (localStorage.getItem(STORAGE_KEY) !== '1') return;

  const ITEMS = [
    { href: 'daily-analysis.html', label: 'Daily Analysis' },
    { href: 'deep-buy.html', label: 'Deep Buy' },
    { href: 'crush.html', label: 'Deep-Crush' },
    { href: 'volatile-trades.html', label: 'Volatile Trades (IBRX)' },
    { href: 'telegrams.html', label: 'Telegrams' },
    { href: 'regime.html', label: 'Regime' },
    { href: 'catalysts.html', label: 'Catalysts' },
    { href: 'options-my-stocks.html', label: 'Options My Stocks' },
  ];

  const css = `
    #bs-personal-nav { position: fixed; top: 14px; right: 14px; z-index: 100; font-family: 'Inter', system-ui, sans-serif; }
    #bs-personal-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(0,255,136,0.12); border: 1px solid rgba(0,255,136,0.35); color: #6ee7b7; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
    #bs-personal-btn:hover { background: rgba(0,255,136,0.2); }
    #bs-personal-menu { position: absolute; top: 100%; right: 0; margin-top: 6px; min-width: 220px; background: rgba(20,22,26,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    #bs-personal-menu.hidden { display: none; }
    #bs-personal-menu a, #bs-personal-menu button { display: block; padding: 10px 14px; color: #cbd5e1; text-decoration: none; font-size: 13px; background: transparent; border: 0; width: 100%; text-align: left; cursor: pointer; font: inherit; transition: background 0.15s, color 0.15s; }
    #bs-personal-menu a:hover, #bs-personal-menu button:hover { background: rgba(255,255,255,0.06); color: #fff; }
    #bs-personal-menu .bs-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0; }
    #bs-personal-menu .bs-exit { color: #94a3b8; font-size: 11px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const current = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const links = ITEMS
    .filter(it => it.href.toLowerCase() !== current)
    .map(it => `<a href="${it.href}">${it.label}</a>`)
    .join('');

  const wrap = document.createElement('div');
  wrap.id = 'bs-personal-nav';
  wrap.innerHTML = `
    <button id="bs-personal-btn" type="button" aria-expanded="false" aria-haspopup="menu">
      <span aria-hidden="true">★</span><span>antonis</span>
    </button>
    <div id="bs-personal-menu" class="hidden" role="menu">
      ${links}
      <div class="bs-divider"></div>
      <button id="bs-personal-exit" class="bs-exit" type="button">Exit personal mode</button>
    </div>
  `;

  const mount = () => {
    document.body.appendChild(wrap);
    const btn = wrap.querySelector('#bs-personal-btn');
    const menu = wrap.querySelector('#bs-personal-menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = menu.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(!hidden));
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    wrap.querySelector('#bs-personal-exit').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      wrap.remove();
      style.remove();
    });
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
