const DATA_ROOT = "/data/v2";
const copyPayloads = new Map();
let copySequence = 0;

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
    : date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
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

const plainLabel = (value) => String(value ?? "—").replaceAll("_", " ");

const safeHref = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? escapeHtml(url.href) : null;
  } catch {
    return null;
  }
};

const markdownRecord = (title, fields) => [
  `## ${title}`,
  ...fields
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `- ${label}: ${plainLabel(value)}`),
].join("\n");

const blockerText = (items) => (items || [])
  .map((item) => `${item.label}: ${item.detail}`)
  .join(" | ");

const registerCopy = (text) => {
  const id = `copy-${++copySequence}`;
  copyPayloads.set(id, text);
  return id;
};

const copyButton = (text, label = "Copy") => {
  const id = registerCopy(text);
  return `<button class="copy-button" type="button" data-copy-id="${id}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
};

const setListCopy = (key, title, records, formatter, generatedAt) => {
  const button = document.querySelector(`[data-copy-list="${key}"]`);
  if (!button) return;
  const id = button.dataset.copyId || registerCopy("");
  button.dataset.copyId = id;
  button.disabled = records.length === 0;
  button.textContent = records.length ? `Copy ${records.length}` : "Nothing to copy";
  copyPayloads.set(id, [
    `# BullScouter2 — ${title}`,
    `Last updated: ${dateText(generatedAt)}`,
    "",
    ...records.map(formatter),
  ].join("\n\n"));
};

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-id]");
  if (!button || button.disabled) return;
  const text = copyPayloads.get(button.dataset.copyId);
  if (!text) return;
  const original = button.textContent;
  try {
    await writeClipboard(text);
    button.textContent = "Copied";
    button.classList.add("copied");
  } catch {
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove("copied");
  }, 1600);
});

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
    if (node.tagName === "TIME" && value) node.dateTime = value;
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
  const opportunities = data.opportunities || [];
  const discoveries = data.discoveries || [];
  const candidateCopy = (item) => markdownRecord(
    `${item.ticker || "—"} — ${item.title || "Research candidate"}`,
    [
      ["Record", "Research candidate"],
      ["Direction", item.direction],
      ["Strategy", item.strategy],
      ["Status", item.promotion_eligible ? "promotion eligible" : item.status],
      ["Score", item.score],
      ["Horizon", item.horizon_days ? `${item.horizon_days} days` : null],
      ["Why now", item.why_now],
      ["Counter-case", item.counter_case],
      ["Falsifier", item.falsifier],
      ["Blockers", blockerText(item.promotion_blocker_explanations)],
    ],
  );
  const opportunityCopy = (item) => markdownRecord(
    `${item.ticker || "—"} — ${item.title || "Qualified opportunity"}`,
    [
      ["Record", "Qualified opportunity"],
      ["Archetype", item.archetype],
      ["Direction", item.direction],
      ["Qualification", item.qualification?.state || item.state],
      ["Company health", item.health?.health_status || "missing"],
      ["Observed", dateText(item.observed_at)],
      ["Blockers", blockerText(item.qualification?.blocker_explanations)],
    ],
  );
  const discoveryCopy = (item) => markdownRecord(
    `${item.ticker || "—"} — ${item.title || item.summary || "Discovery"}`,
    [
      ["Record", "Canonical discovery"],
      ["Observed", dateText(item.observed_at)],
      ["Direction", item.direction],
      ["Status", item.status],
      ["Strategy", item.strategy],
      ["Source", item.source],
      ["Strength", item.strength],
      ["Summary", item.summary],
    ],
  );
  const controls = {
    search: document.querySelector("[data-filter-search]"),
    type: document.querySelector("[data-filter-type]"),
    direction: document.querySelector("[data-filter-direction]"),
    outcome: document.querySelector("[data-filter-outcome]"),
    category: document.querySelector("[data-filter-category]"),
  };

  const normalized = (value) => String(value || "").trim().toLowerCase();
  const optionLabel = (value) => String(value || "").replaceAll("_", " ");
  const addOptions = (select, values) => {
    [...new Set(values.filter(Boolean))].sort().forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = optionLabel(value);
      select.append(option);
    });
  };
  addOptions(controls.direction, [
    ...candidates.map((item) => item.direction),
    ...opportunities.map((item) => item.direction),
    ...discoveries.map((item) => item.direction),
  ]);
  addOptions(controls.outcome, [
    ...candidates.map((item) => item.promotion_eligible ? "promotion_eligible" : item.status),
    ...opportunities.map((item) => item.qualification?.state || item.state),
    ...discoveries.map((item) => item.status),
  ]);
  addOptions(controls.category, [
    ...candidates.map((item) => item.strategy),
    ...opportunities.map((item) => item.archetype),
    ...discoveries.map((item) => item.strategy),
  ]);

  const matches = (record) => {
    const query = normalized(controls.search.value);
    const haystack = normalized([
      record.ticker,
      record.title,
      record.summary,
      record.why_now,
      record.counter_case,
    ].filter(Boolean).join(" "));
    return (!query || haystack.includes(query))
      && (!controls.direction.value || record.direction === controls.direction.value)
      && (!controls.outcome.value || record.outcome === controls.outcome.value)
      && (!controls.category.value || record.category === controls.category.value);
  };

  const render = () => {
    const candidateMatches = candidates.filter((item) => matches({
      ...item,
      outcome: item.promotion_eligible ? "promotion_eligible" : item.status,
      category: item.strategy,
    }));
    const opportunityMatches = opportunities.filter((item) => matches({
      ...item,
      outcome: item.qualification?.state || item.state,
      category: item.archetype,
    }));
    const discoveryMatches = discoveries.filter((item) => matches({
      ...item,
      outcome: item.status,
      category: item.strategy,
    }));

    document.querySelector("[data-candidates]").innerHTML = candidateMatches.length
      ? candidateMatches.map((item) => `<article class="row-card">
          <div><strong class="ticker">${escapeHtml(item.ticker || "—")}</strong><br>${pill(item.direction)}</div>
          <div><h3>${escapeHtml(item.title)}</h3><p class="muted">${escapeHtml(item.why_now || item.counter_case || "")}</p>
          ${blockerList(item.promotion_blocker_explanations)}</div>
          <div class="copy-actions">${pill(item.promotion_eligible ? "promotion eligible" : item.status)}${copyButton(candidateCopy(item), `Copy ${item.ticker || "candidate"}`)}</div>
        </article>`).join("")
      : empty("No research candidates match these filters.");

    document.querySelector("[data-opportunities]").innerHTML = opportunityMatches.length
      ? opportunityMatches.map((item) => `<tr>
          <td class="ticker">${escapeHtml(item.ticker)}</td>
          <td>${escapeHtml(optionLabel(item.archetype || "—"))}</td>
          <td>${pill(item.direction)}</td>
          <td>${pill(item.qualification?.state || item.state)}</td>
          <td>${pill(item.health?.health_status || "missing")}</td>
          <td>${copyButton(opportunityCopy(item), `Copy ${item.ticker || "opportunity"}`)}</td>
        </tr>`).join("")
      : `<tr><td colspan="6">No opportunities match these filters.</td></tr>`;

    document.querySelector("[data-discoveries]").innerHTML = discoveryMatches.length
      ? discoveryMatches.map((item) => `<tr>
          <td>${dateText(item.observed_at)}</td>
          <td class="ticker">${escapeHtml(item.ticker || "—")}</td>
          <td>${escapeHtml(item.title || item.summary || "Untitled discovery")}</td>
          <td>${pill(item.direction)}</td>
          <td>${pill(item.status)}</td>
          <td>${copyButton(discoveryCopy(item), `Copy ${item.ticker || "discovery"}`)}</td>
        </tr>`).join("")
      : `<tr><td colspan="6">No discoveries match these filters.</td></tr>`;

    setListCopy(
      "candidates", "Filtered research candidates",
      candidateMatches, candidateCopy, data.generated_at,
    );
    setListCopy(
      "opportunities", "Filtered qualified opportunities",
      opportunityMatches, opportunityCopy, data.generated_at,
    );
    setListCopy(
      "discoveries", "Filtered canonical discoveries",
      discoveryMatches, discoveryCopy, data.generated_at,
    );

    const counts = {
      candidates: candidateMatches.length,
      opportunities: opportunityMatches.length,
      discoveries: discoveryMatches.length,
    };
    Object.entries(counts).forEach(([key, value]) => {
      const node = document.querySelector(`[data-result-count="${key}"]`);
      if (node) node.textContent = `${value} shown`;
    });
    document.querySelectorAll("[data-discovery-section]").forEach((section) => {
      const selected = controls.type.value;
      section.hidden = Boolean(selected && section.dataset.discoverySection !== selected);
    });
    const total = controls.type.value
      ? counts[controls.type.value]
      : counts.candidates + counts.opportunities + counts.discoveries;
    document.querySelector("[data-filter-summary]").textContent = `${total} matching records`;
  };

  Object.values(controls).forEach((control) => {
    control.addEventListener(control === controls.search ? "input" : "change", render);
  });
  document.querySelector("[data-filter-reset]").addEventListener("click", () => {
    Object.values(controls).forEach((control) => { control.value = ""; });
    render();
    controls.search.focus();
  });
  render();
}

function renderReadiness(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-as-of]").textContent = dateText(data.as_of);
  const stageCounts = data.stage_counts || {};
  const researchRun = data.prepublication_research || {};
  const shortlist = data.shortlist || [
    ...(data.items || []),
    ...(data.research_queue || []),
  ].sort((a, b) => (a.research_rank || 999) - (b.research_rank || 999));
  document.querySelector("[data-shortlist-count]").textContent = shortlist.length;
  document.querySelector("[data-readiness-stats]").innerHTML = [
    ["Shortlisted", shortlist.length],
    ["Review ready", stageCounts.review_ready],
    ["Approved", stageCounts.approved_opportunity],
    ["Needs research", stageCounts.research_queue],
    ["Research completed", researchRun.completed_task_count],
    ["Research unresolved", researchRun.unresolved_task_count],
  ].map(([label, value]) => `<div class="card"><div class="metric">${escapeHtml(value ?? 0)}</div><span class="muted">${escapeHtml(label)}</span></div>`).join("");

  const items = (data.items || []).filter((item) => item.stage === "review_ready");
  const approved = data.approved_opportunities || [];
  const research = data.research_queue || [];
  const missingLabels = (item) => (item.missing_analysis_gate_explanations || [])
    .map((gate) => gate.label);
  const evidencePacketText = (item) => {
    const packet = item.analysis_packet || {};
    const source = packet.source || {};
    const company = packet.company_health || {};
    const assessment = packet.company_assessment || {};
    const price = packet.market_price || {};
    const research = packet.prepublication_research || {};
    return [
      `Source ${plainLabel(source.status || "missing")}`,
      `company ${plainLabel(company.status || "missing")} (${company.coverage_count ?? 0}/6)`,
      `company assessment ${plainLabel(assessment.status || "incomplete")}`,
      `payoff review ${plainLabel(assessment.payoff_review?.status || "missing")}`,
      `framework ${plainLabel(packet.framework?.status || item.framework_status || "missing")}`,
      `price ${plainLabel(price.status || "missing")}${price.as_of ? ` as of ${price.as_of}` : ""}`,
      `materiality ${plainLabel(item.materiality?.status || "unclassified")}`,
      `ThetaData ${plainLabel(item.theta?.status || "unavailable")}`,
      `counter-case ${plainLabel(packet.counter_case?.status || (item.counter_case ? "complete" : "missing"))}`,
      `invalidation ${plainLabel(packet.invalidation?.status || (item.invalidation ? "complete" : "missing"))}`,
      `pre-publication research ${plainLabel(research.status || "not run")}`,
    ].join(" · ");
  };
  const sourceLinks = (item) => (
    item.analysis_packet?.source?.researched_primary_sources || []
  ).map((source) => `${source.title || source.publisher || "Primary source"}: ${source.url}`).join(" | ");
  const readinessCopy = (item) => markdownRecord(
    `#${item.stage_rank || item.rank} ${item.ticker} — ${item.title || "Review-ready candidate"}`,
    [
      ["Stage", item.stage],
      ["Lane", item.lane],
      ["Direction", item.direction],
      ["Investment readiness", item.investment_readiness_score],
      ["Research priority", item.research_priority_score],
      ["Recommendation", item.recommendation],
      ["Monitoring label", item.monitoring_label],
      ["Materiality", item.materiality?.status],
      ["ThetaData", item.theta?.status],
      ["Framework", item.framework_status],
      ["Company health", item.health_status],
      ["Entry condition", item.entry_condition],
      ["Invalidation", item.invalidation],
      ["Next action", item.next_action],
      ["Blockers", blockerText(item.blocker_explanations)],
      ["Automatic evidence packet", evidencePacketText(item)],
      ["Company metrics", (item.analysis_packet?.company_assessment?.metrics || [])
        .map((value) => `${value.label} ${value.display} (${plainLabel(value.status)})`)
        .join(" | ")],
      ["Governed catalysts", (item.analysis_packet?.company_assessment?.catalysts || [])
        .map((value) => `${value.title} [${plainLabel(value.direction)}]`)
        .join(" | ")],
      ["Payoff review", item.analysis_packet?.company_assessment?.payoff_review?.status],
      ["Researched primary sources", sourceLinks(item)],
    ],
  );
  const shortlistCopy = (item) => markdownRecord(
    `#${item.research_rank || item.rank} ${item.ticker} — ${item.title || "Shortlisted discovery"}`,
    [
      ["Shortlist status", item.stage === "research_queue" ? "needs research" : item.stage],
      ["Lane", item.lane],
      ["Direction", item.direction],
      ["Research priority", item.research_priority_score],
      ["Investment readiness", item.investment_readiness_score ?? "not scored until the automatic packet is complete"],
      ["Automatic evidence packet", evidencePacketText(item)],
      ["Company metrics", (item.analysis_packet?.company_assessment?.metrics || [])
        .map((value) => `${value.label} ${value.display} (${plainLabel(value.status)})`)
        .join(" | ")],
      ["Payoff review", item.analysis_packet?.company_assessment?.payoff_review?.status],
      ["Researched primary sources", sourceLinks(item)],
      ["Research required", missingLabels(item).join(" | ")],
      ["Recommendation", item.recommendation],
      ["Next action", item.next_action],
    ],
  );
  document.querySelector("[data-shortlist]").innerHTML = shortlist.length
    ? shortlist.map((item) => `<tr>
        <td>${escapeHtml(item.research_rank || item.rank)}</td>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${pill(item.lane)}</td>
        <td>${pill(item.stage === "research_queue" ? "needs research" : item.stage)}</td>
        <td class="score">${fmt(item.research_priority_score)}</td>
        <td class="break">${escapeHtml(item.stage === "research_queue" ? missingLabels(item).join(" · ") || "Evidence incomplete" : "Automatic packet complete")}</td>
        <td class="break">${escapeHtml(item.next_action || "—")}</td>
        <td>${copyButton(shortlistCopy(item), `Copy ${item.ticker}`)}</td>
      </tr>`).join("")
    : `<tr><td colspan="8">No discoveries were selected for this run.</td></tr>`;
  setListCopy(
    "shortlist", "Full discovery shortlist", shortlist, shortlistCopy, data.generated_at,
  );

  const researchTasks = shortlist.flatMap((item) => (
    item.analysis_packet?.prepublication_research?.tasks || []
  ).map((task) => ({ ...task, ticker: item.ticker })));
  const researchTaskCopy = (task) => markdownRecord(
    `${task.ticker} — ${plainLabel(task.gate)}`,
    [
      ["Owner", task.owner],
      ["Status", task.status],
      ["Instruction", task.instruction],
      ["Required evidence", task.evidence_required],
    ],
  );
  document.querySelector("[data-research-tasks]").innerHTML = researchTasks.length
    ? researchTasks.map((task) => `<tr>
        <td class="ticker">${escapeHtml(task.ticker)}</td>
        <td>${escapeHtml(plainLabel(task.gate))}</td>
        <td>${pill(task.owner)}</td>
        <td>${pill(task.status)}</td>
        <td class="break">${escapeHtml(task.evidence_required || "—")}</td>
        <td class="break">${escapeHtml(task.instruction || "—")}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">No pre-publication research tasks were required.</td></tr>`;
  setListCopy(
    "research-tasks", "Pre-publication research tasks",
    researchTasks, researchTaskCopy, data.generated_at,
  );
  document.querySelector("[data-readiness]").innerHTML = items.length
    ? items.map((item) => `<tr>
        <td>${escapeHtml(item.stage_rank || item.rank)}</td>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${pill(item.lane)}</td>
        <td class="score">${fmt(item.investment_readiness_score)}</td>
        <td>${pill(item.materiality?.status || "unclassified")}</td>
        <td>${pill(item.theta?.status || "unavailable")}</td>
        <td class="break">${escapeHtml(item.recommendation || "—")}<br><span class="meta">${escapeHtml(item.monitoring_label || "")}</span></td>
        <td>${copyButton(readinessCopy(item), `Copy ${item.ticker}`)}</td>
      </tr>`).join("")
    : `<tr><td colspan="8">No opportunities have completed review admission.</td></tr>`;
  setListCopy(
    "readiness", "Review-ready shortlist", items, readinessCopy, data.generated_at,
  );

  document.querySelector("[data-approved]").innerHTML = approved.length
    ? approved.map((item) => `<tr>
        <td>${escapeHtml(item.stage_rank || item.rank)}</td>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${pill(item.lane)}</td>
        <td class="score">${fmt(item.investment_readiness_score)}</td>
        <td>${pill(item.recommendation || "approved")}</td>
        <td class="break">${escapeHtml(item.next_action || "—")}</td>
        <td>${copyButton(readinessCopy(item), `Copy ${item.ticker}`)}</td>
      </tr>`).join("")
    : `<tr><td colspan="7">No governed opportunities are currently approved.</td></tr>`;
  setListCopy(
    "approved", "Approved opportunities", approved, readinessCopy, data.generated_at,
  );

  const researchCopy = (item) => markdownRecord(
    `#${item.research_rank || item.rank} ${item.ticker} — ${item.title || "Research candidate"}`,
    [
      ["Stage", item.stage],
      ["Lane", item.lane],
      ["Direction", item.direction],
      ["Research priority", item.research_priority_score],
      ["Investment readiness", "not scored until the analysis packet is complete"],
      ["Automatic evidence packet", evidencePacketText(item)],
      ["Missing analysis", (item.missing_analysis_gate_explanations || [])
        .map((gate) => `${gate.label}: ${gate.detail}`).join(" | ")],
      ["Next action", item.next_action],
      ["Blockers", blockerText(item.blocker_explanations)],
    ],
  );
  document.querySelector("[data-research-queue]").innerHTML = research.length
    ? research.map((item) => `<tr>
        <td>${escapeHtml(item.research_rank || item.rank)}</td>
        <td class="ticker">${escapeHtml(item.ticker)}</td>
        <td>${pill(item.lane)}</td>
        <td class="score">${fmt(item.research_priority_score)}</td>
        <td class="break">${escapeHtml((item.missing_analysis_gate_explanations || []).map((gate) => gate.label).join(" · ") || "—")}</td>
        <td class="break">${escapeHtml(item.next_action || "—")}</td>
        <td>${copyButton(researchCopy(item), `Copy ${item.ticker}`)}</td>
      </tr>`).join("")
    : `<tr><td colspan="7">No incomplete opportunities are waiting for research.</td></tr>`;
  setListCopy(
    "research", "Research queue", research, researchCopy, data.generated_at,
  );

  const transitions = data.transitions || {};
  const entered = transitions.entered || [];
  const left = transitions.left || [];
  document.querySelector("[data-transitions]").innerHTML = `
    <div class="card">
      <div class="section-head"><h3>Entered</h3>${copyButton(
        entered.length ? `# BullScouter2 — Entered shortlist\n\n${entered.map((ticker) => `- ${ticker}`).join("\n")}` : "No names entered the shortlist.",
        "Copy",
      )}</div>
      <p>${entered.length ? entered.map(pill).join(" ") : '<span class="muted">None</span>'}</p>
    </div>
    <div class="card">
      <div class="section-head"><h3>Left the shortlist</h3>${copyButton(
        left.length ? `# BullScouter2 — Left shortlist\n\n${left.map((item) => `- ${item.ticker}: ${plainLabel(item.reason)}; current score ${fmt(item.current_score)}`).join("\n")}` : "No names left the shortlist.",
        "Copy",
      )}</div>
      ${left.length ? left.map((item) => `<p><strong>${escapeHtml(item.ticker)}</strong> · ${escapeHtml(item.reason.replaceAll("_", " "))} · current ${fmt(item.current_score)}</p>`).join("") : '<p class="muted">None</p>'}
    </div>`;
}

function renderInvestments(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-investment-stats]").innerHTML = [
    ["Decision universe", data.candidate_count],
    ["Stage 2 pending", data.stage2_pending_count],
    ["Decision ready", data.decision_ready_count ?? data.graded_count],
    ["Execution", "Off"],
  ].map(([label, value]) => `<div class="card"><div class="metric">${escapeHtml(value ?? 0)}</div><span class="muted">${escapeHtml(label)}</span></div>`).join("");

  const items = data.items || [];
  const investmentCopy = (item) => markdownRecord(
    `${item.ticker} — ${item.title || "Investment candidate"}`,
    [
      ["Grade", item.grade],
      ["Recommendation", item.proposal?.recommendation || item.decision?.authoritative_decision || "unproposed"],
      ["Lane", item.lane],
      ["Risk tier", item.proposal?.risk_tier],
      ["Company health", item.company_health?.health_status || "missing"],
      ["Health counts", item.assessment?.health_counts
        ? `${item.assessment.health_counts.pass_count || 0} pass / ${item.assessment.health_counts.partial_count || 0} partial / ${item.assessment.health_counts.fail_count || 0} fail / ${item.assessment.health_counts.missing_count || 0} missing`
        : null],
      ["Company metrics", (item.assessment?.metrics || [])
        .map((value) => `${value.label} ${value.display} (${plainLabel(value.status)})`)
        .join(" | ")],
      ["Reviewed catalysts", (item.assessment?.catalysts || [])
        .map((value) => `${value.title} [${plainLabel(value.direction)}]`)
        .join(" | ")],
      ["Rationale", item.proposal?.rationale],
      ["Entry condition", item.proposal?.entry_condition],
      ["Invalidation", item.proposal?.invalidation_condition],
      ["Payoff review", item.assessment?.payoff_review?.status],
      ["Payoff owner", item.assessment?.payoff_review?.owner],
      ["Payoff instruction", item.assessment?.payoff_review?.instruction],
      ["Blockers", blockerText(item.blocker_explanations)],
      ["Warnings", (item.warnings || []).join(" | ")],
    ],
  );
  document.querySelector("[data-investments]").innerHTML = items.length
    ? items.map((item) => {
      const assessment = item.assessment || {};
      const health = assessment.health_counts || {};
      const metrics = assessment.metrics || [];
      const catalysts = assessment.catalysts || [];
      const payoff = assessment.payoff_review || {};
      const weakCriteria = (assessment.criteria || []).filter(
        (value) => ["fail", "partial", "missing"].includes(value.status),
      );
      return `<article class="card">
        <div class="section-head"><div><span class="ticker">${escapeHtml(item.ticker)}</span><h2>${escapeHtml(item.title)}</h2></div>
        <div class="copy-actions">${pill(`Grade ${item.grade || "—"}`)} ${pill(item.proposal?.recommendation || item.decision?.authoritative_decision || "unproposed")} ${copyButton(investmentCopy(item), `Copy ${item.ticker}`)}</div></div>
        <p class="muted">${escapeHtml(item.proposal?.rationale || "No public proposal rationale.")}</p>
        <p>${pill(item.lane)} ${pill(item.proposal?.risk_tier || "unrated")} ${pill(item.company_health?.health_status || "health missing")}</p>
        <div class="assessment-block">
          <h3>Company-specific evidence</h3>
          <p class="meta">Annual SEC screen · ${escapeHtml(health.pass_count || 0)} pass / ${escapeHtml(health.partial_count || 0)} partial / ${escapeHtml(health.fail_count || 0)} fail / ${escapeHtml(health.missing_count || 0)} missing</p>
          ${metrics.length ? `<ul>${metrics.map((value) => `<li><strong>${escapeHtml(value.label)}</strong> · ${escapeHtml(value.display)} · ${pill(value.status)}</li>`).join("")}</ul>` : '<p class="muted">No public company metrics are available.</p>'}
          ${weakCriteria.length ? `<p class="meta break">Weak or incomplete criteria: ${escapeHtml(weakCriteria.map((value) => `${plainLabel(value.criterion)} (${plainLabel(value.status)})`).join(" · "))}</p>` : ""}
          <h3>Approved catalyst evidence</h3>
          ${catalysts.length ? `<ul>${catalysts.map((value) => {
            const href = safeHref(value.url);
            const title = escapeHtml(value.title || "Reviewed event");
            return `<li>${href ? `<a href="${href}" target="_blank" rel="noopener">${title}</a>` : `<strong>${title}</strong>`} · ${pill(value.direction)}<br><span class="meta">${escapeHtml(value.summary || "")}</span></li>`;
          }).join("")}</ul>` : '<p class="muted">No approved catalyst observations.</p>'}
        </div>
        <div class="notice ${payoff.status === "needs_human" ? "warn" : ""}">
          <strong>Payoff review · ${escapeHtml(plainLabel(payoff.status || "missing"))}</strong>
          <p>${escapeHtml(payoff.instruction || "No payoff workflow is recorded.")}</p>
          ${payoff.owner ? `<span class="meta">Owner: ${escapeHtml(plainLabel(payoff.owner))}</span>` : ""}
        </div>
        ${blockerList(item.blocker_explanations)}
        ${(item.warnings || []).length ? `<p class="meta break">Warnings: ${escapeHtml(item.warnings.join(" · "))}</p>` : ""}
      </article>`;
    }).join("")
    : empty("No complete Stage 2 packet has reached the Stage 3 decision boundary.");
  setListCopy(
    "investments", "Stage 3 decision-ready candidates",
    items, investmentCopy, data.generated_at,
  );
}

function renderTheses(data) {
  setUpdated(data.generated_at);
  document.querySelector("[data-thesis-count]").textContent = data.count ?? 0;
  const items = data.items || [];
  const thesisCopy = (item) => markdownRecord(
    `${item.ticker || "MULTI"} — ${item.title || "Thesis"}`,
    [
      ["Status", item.status],
      ["Direction", item.direction],
      ["Confidence", item.confidence],
      ["Attention required", item.attention ? "yes" : "no"],
      ["Next checkpoint", item.next_checkpoint?.label],
      ["Checkpoint due", dateText(item.next_checkpoint?.due_at)],
    ],
  );
  document.querySelector("[data-theses]").innerHTML = items.length
    ? items.map((item) => `<article class="card">
        <div class="section-head"><div><span class="ticker">${escapeHtml(item.ticker || "MULTI")}</span><h2>${escapeHtml(item.title)}</h2></div><div class="copy-actions">${pill(item.status)}${copyButton(thesisCopy(item), `Copy ${item.ticker || "thesis"}`)}</div></div>
        <p>${pill(item.direction)} ${pill(`confidence ${item.confidence ?? "—"}`)} ${item.attention ? pill("attention") : ""}</p>
        <p class="muted">${item.next_checkpoint ? `Next: ${escapeHtml(item.next_checkpoint.label || "checkpoint")} · ${dateText(item.next_checkpoint.due_at)}` : "No pending checkpoint."}</p>
      </article>`).join("")
    : empty("No activated theses.");
  setListCopy("theses", "Active theses", items, thesisCopy, data.generated_at);
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
