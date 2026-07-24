const DATA_ROOT = "/data/v2";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const fmt = (value, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
};

const dateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const pill = (value) => {
  const text = String(value || "unknown");
  const lower = text.toLowerCase();
  const tone = /acceptable|eligible|active|approved|buy|healthy|strong/.test(lower)
    ? "good"
    : /reject|blocked|failed|unhealthy|exit/.test(lower)
      ? "bad"
      : /pending|watch|partial|missing|insufficient|speculative/.test(lower)
        ? "warn"
        : "info";
  return `<span class="pill ${tone}">${escapeHtml(text.replaceAll("_", " "))}</span>`;
};

const empty = (message) => `<div class="empty">${escapeHtml(message)}</div>`;

const blockerList = (items) => {
  if (!items?.length) return "";
  return `<ul class="blockers">${items.map((item) => `<li>
    <strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.detail)}
  </li>`).join("")}</ul>`;
};

async function loadJson(name) {
  const response = await fetch(`${DATA_ROOT}/${name}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

function setUpdated(value) {
  document.querySelectorAll("[data-updated]").forEach((node) => {
    node.textContent = dateText(value);
  });
}

function renderHome(data) {
  setUpdated(data.generated_at);
  const surfaces = data.surfaces || {};
  const target = document.querySelector("[data-surface-grid]");
  const labels = {
    discoveries: ["Discoveries", "Canonical evidence and research seeds"],
    readiness: ["Shortlist", "Governed, lane-balanced opportunity queue"],
    investments: ["Decisions", "A–D grades and reviewed proposals"],
    theses: ["Theses", "Activated falsifiable research programs"],
  };
  target.innerHTML = Object.entries(labels).map(([key, [title, copy]]) => {
    const surface = surfaces[key] || {};
    const href = key === "investments" ? "investments/" : `${key}/`;
    return `<a class="card card-link" href="${href}">
      <div class="metric">${escapeHtml(surface.count ?? 0)}</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(copy)}</p>
      <span class="pill info">Read only</span>
    </a>`;
  }).join("");
}

function renderDiscoveries(data) {
  setUpdated(data.generated_at);
  const stats = data.stats || {};
  document.querySelector("[data-discovery-stats]").innerHTML = [
    ["Discoveries", stats.discoveries],
    ["Research candidates", (data.candidates || []).length],
    ["Correction queue", (data.correction_queue || []).length],
  ].map(([label, value]) => `<div class="card">
    <div class="metric">${escapeHtml(value ?? 0)}</div><span class="muted">${escapeHtml(label)}</span>
  </div>`).join("");

  const candidates = data.candidates || [];
  document.querySelector("[data-candidates]").innerHTML = candidates.length
    ? candidates.map((item) => `<article class="row-card">
        <div><strong class="ticker">${escapeHtml(item.ticker || "—")}</strong><br>${pill(item.direction)}</div>
        <div><h3>${escapeHtml(item.title)}</h3><p class="muted">${escapeHtml(item.why_now || item.counter_case || "")}</p>
        ${blockerList(item.promotion_blocker_explanations)}</div>
        <div>${pill(item.promotion_eligible ? "promotion eligible" : item.status)}</div>
      </article>`).join("")
    : empty("No current thesis candidates.");

  const opportunities = data.opportunities || [];
  document.querySelector("[data-opportunities]").innerHTML = opportunities.length
    ? opportunities.map((item) => `<tr>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${escapeHtml(item.archetype || "—")}</td>
        <td>${pill(item.direction)}</td>
        <td>${pill(item.qualification?.state || item.state)}</td>
        <td>${pill(item.health?.health_status || "missing")}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">No opportunities.</td></tr>`;

  const discoveries = data.discoveries || [];
  document.querySelector("[data-discoveries]").innerHTML = discoveries.length
    ? discoveries.slice(0, 30).map((item) => `<tr>
        <td>${dateText(item.observed_at)}</td>
        <td class="ticker">${escapeHtml(item.ticker || "—")}</td>
        <td>${escapeHtml(item.title || item.summary || "Untitled discovery")}</td>
        <td>${pill(item.direction)}</td>
        <td>${pill(item.status)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">No discoveries.</td></tr>`;
}

function renderReadiness(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-as-of]").textContent = dateText(data.as_of);
  document.querySelector("[data-readiness-stats]").innerHTML = [
    ["Universe", data.universe_count],
    ["Deduplicated", data.deduplicated_count],
    ["Selected", data.selected_count],
  ].map(([label, value]) => `<div class="card"><div class="metric">${escapeHtml(value ?? 0)}</div><span class="muted">${escapeHtml(label)}</span></div>`).join("");

  const items = data.items || [];
  document.querySelector("[data-readiness]").innerHTML = items.length
    ? items.map((item) => `<tr>
        <td>${escapeHtml(item.rank)}</td>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${pill(item.lane)}</td>
        <td class="score">${fmt(item.score)}</td>
        <td>${pill(item.framework_status)}</td>
        <td>${pill(item.health_status)}</td>
        <td class="break">${escapeHtml(item.next_action || "—")}</td>
      </tr>`).join("")
    : `<tr><td colspan="7">No shortlist has been generated.</td></tr>`;

  const transitions = data.transitions || {};
  const entered = transitions.entered || [];
  const left = transitions.left || [];
  document.querySelector("[data-transitions]").innerHTML = `
    <div class="card">
      <h3>Entered</h3>
      <p>${entered.length ? entered.map(pill).join(" ") : '<span class="muted">None</span>'}</p>
    </div>
    <div class="card">
      <h3>Left the shortlist</h3>
      ${left.length ? left.map((item) => `<p><strong>${escapeHtml(item.ticker)}</strong> · ${escapeHtml(item.reason.replaceAll("_", " "))} · current ${fmt(item.current_score)}</p>`).join("") : '<p class="muted">None</p>'}
    </div>`;
}

function renderInvestments(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-investment-stats]").innerHTML = [
    ["Decision universe", data.candidate_count],
    ["Graded", data.graded_count],
    ["Execution", "Off"],
  ].map(([label, value]) => `<div class="card"><div class="metric">${escapeHtml(value ?? 0)}</div><span class="muted">${escapeHtml(label)}</span></div>`).join("");

  const items = data.items || [];
  document.querySelector("[data-investments]").innerHTML = items.length
    ? items.map((item) => `<article class="card">
        <div class="section-head"><div><span class="ticker">${escapeHtml(item.ticker)}</span><h2>${escapeHtml(item.title)}</h2></div>
        <div>${pill(`Grade ${item.grade || "—"}`)} ${pill(item.proposal?.recommendation || item.decision?.authoritative_decision || "unproposed")}</div></div>
        <p class="muted">${escapeHtml(item.proposal?.rationale || "No public proposal rationale.")}</p>
        <p>${pill(item.lane)} ${pill(item.proposal?.risk_tier || "unrated")} ${pill(item.company_health?.health_status || "health missing")}</p>
        ${blockerList(item.blocker_explanations)}
        ${(item.warnings || []).length ? `<p class="meta break">Warnings: ${escapeHtml(item.warnings.join(" · "))}</p>` : ""}
      </article>`).join("")
    : empty("No candidates have reached investment grading.");
}

function renderTheses(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-thesis-count]").textContent = data.count ?? 0;
  const items = data.items || [];
  document.querySelector("[data-theses]").innerHTML = items.length
    ? items.map((item) => `<article class="card">
        <div class="section-head"><div><span class="ticker">${escapeHtml(item.ticker || "MULTI")}</span><h2>${escapeHtml(item.title)}</h2></div>${pill(item.status)}</div>
        <p>${pill(item.direction)} ${pill(`confidence ${item.confidence ?? "—"}`)} ${item.attention ? pill("attention") : ""}</p>
        <p class="muted">${item.next_checkpoint ? `Next: ${escapeHtml(item.next_checkpoint.label || "checkpoint")} · ${dateText(item.next_checkpoint.due_at)}` : "No pending checkpoint."}</p>
      </article>`).join("")
    : empty("No activated theses.");
}

async function boot() {
  const page = document.body.dataset.page;
  const renderers = {
    home: ["manifest.json", renderHome],
    discoveries: ["discoveries.json", renderDiscoveries],
    readiness: ["readiness.json", renderReadiness],
    investments: ["investments.json", renderInvestments],
    theses: ["theses.json", renderTheses],
  };
  const selected = renderers[page];
  if (!selected) return;
  try {
    const data = await loadJson(selected[0]);
    selected[1](data);
  } catch (error) {
    const target = document.querySelector("[data-error]");
    if (target) {
      target.hidden = false;
      target.textContent = `V2 snapshot unavailable: ${error.message}`;
    }
  }
}

boot();
