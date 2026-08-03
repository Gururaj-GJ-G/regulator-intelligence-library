const data = window.ZAR_SEED;

const screens = [
  ["dashboard", "Dashboard", "What are the most urgent regulatory changes affecting active markets and clients?", "*"],
  ["workspace", "Client Applicability", "Based on a client profile, which regulators, licenses, obligations, and reports apply?", "#"],
  ["jurisdictions", "Jurisdictions", "How is regulatory authority divided and coordinated within a specific country or free-zone?", "%"],
  ["regulators", "Regulators", "What are the foundational details, powers, and scopes of a regulatory body?", "@"],
  ["licenses", "Licenses & Products", "Which products require which licenses, and who oversees them?", "+"],
  ["obligations", "Obligations", "What specific rules must a client comply with, and what is the corresponding control?", "!"],
  ["reporting", "Reporting", "What data must be submitted to the regulator, in what format, and how often?", "="],
  ["monitoring", "Change Log", "How is the regulatory landscape shifting, and what needs review?", "~"],
  ["generator", "Framework Builder", "Based on a client profile, generate a structured compliance framework document ready for delivery.", ">"]
];

const state = {
  screen: "dashboard",
  role: "viewer",
  filters: {},
  drawer: null,
  activeRows: [],
  globalRows: [],
  activeModule: "DASHBOARD",
  workspace: {
    countries: ["IN"],
    products: ["PROD.UPI_MERCHANT", "PROD.CARD_ISSUING"],
    license: "LIC.IN.PSP.UPI",
    matchMode: "all",
    results: []
  },
  licenseTab: "licenses",
  generator: {
    country: "BH",
    license: "LIC.BH.REINSURER",
    entityType: "Pure Reinsurer",
    domains: ["Market Risk","Insurance Risk","Liquidity Risk","Credit Risk"],
    engagementName: "",
    output: null,
    generating: false
  }
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function byId(collection, key, value) {
  return collection.find((item) => item[key] === value);
}

function regulator(id) {
  return byId(data.regulators, "regulator_id", id) || { acronym: id, name: id };
}

function countryName(code) {
  const jurisdiction = byId(data.jurisdictions, "country", code);
  return jurisdiction ? jurisdiction.name : code;
}

function arrayText(value) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function pills(values) {
  const list = Array.isArray(values) ? values : [values];
  return `<span class="pill-list">${list.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}</span>`;
}

function setScreen(screen) {
  state.screen = screen;
  state.drawer = null;
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);
  history.replaceState(null, "", url);
  render();
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function initFromUrl() {
  const params = new URLSearchParams(location.search);
  const screen = params.get("screen");
  if (screen && screens.some(([id]) => id === screen)) state.screen = screen;
  if (params.get("country")) state.workspace.countries = params.get("country").split(",");
  if (params.get("products")) state.workspace.products = params.get("products").split(",");
  if (params.get("license")) state.workspace.license = params.get("license");
  if (state.screen === "workspace") executeWorkspace(false);
}

function syncWorkspaceUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", "workspace");
  url.searchParams.set("country", state.workspace.countries.join(","));
  url.searchParams.set("products", state.workspace.products.join(","));
  url.searchParams.set("license", state.workspace.license);
  history.replaceState(null, "", url);
}

function optionList(values, selected, multiple = false) {
  const selectedList = Array.isArray(selected) ? selected : [selected];
  return values.map((value) => `<option value="${escapeHtml(value)}" ${selectedList.includes(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function readMulti(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function render() {
  const app = $("#app");
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar()}
      ${renderNav()}
      <main class="canvas">${renderScreen()}</main>
      <aside class="drawer">${renderDrawer()}</aside>
    </div>
  `;
  bindEvents();
}

function renderTopbar() {
  const role = data.roles[state.role];
  return `
    <header class="topbar">
      <div class="brand">
        <strong>Regulator Intelligence Library</strong>
        <span>${escapeHtml(role.description)}</span>
      </div>
      <div class="top-actions">
        <label class="role-select">Role
          <select id="role-select">
            ${Object.entries(data.roles).map(([id, item]) => `<option value="${id}" ${state.role === id ? "selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </label>
        <button id="export-open" title="Open shared export modal">Export</button>
      </div>
    </header>
  `;
}

function renderNav() {
  return `
    <nav class="nav" aria-label="Primary">
      ${screens.map(([id, label, , glyph]) => `
        <button data-screen="${id}" class="${state.screen === id ? "active" : ""}">
          <span class="glyph">${glyph}</span><span>${label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function screenHead(moduleId) {
  const entry = screens.find(([id]) => id === state.screen);
  state.activeModule = moduleId;
  return `
    <div class="screen-head">
      <div>
        <span class="screen-kicker">${moduleId}</span>
        <h1>${entry[1]}</h1>
        <p>${entry[2]}</p>
      </div>
      ${renderPermissionHint()}
    </div>
  `;
}

function renderPermissionHint() {
  const role = data.roles[state.role];
  const text = role.canAdmin ? "Admin controls unlocked" : role.canEdit ? "Edit and reconcile controls unlocked" : "Read-only role";
  return `<span class="pill">${text}</span>`;
}

function renderScreen() {
  if (state.screen === "dashboard") return renderDashboard();
  if (state.screen === "workspace") return renderWorkspace();
  if (state.screen === "jurisdictions") return renderJurisdictions();
  if (state.screen === "regulators") return renderRegulators();
  if (state.screen === "licenses") return renderLicenses();
  if (state.screen === "obligations") return renderObligations();
  if (state.screen === "reporting") return renderReporting();
  if (state.screen === "generator") return renderGenerator();
  return renderMonitoring();
}

function renderDashboard() {
  const rows = data.dashboardChanges;
  state.activeRows = rows;
  state.globalRows = data.dashboardChanges;
  return `
    ${screenHead("DASHBOARD")}
    <section class="kpi-strip">
      <div class="kpi"><strong>${rows.filter((row) => row.priority === "High").length}</strong><span>High priority changes</span></div>
      <div class="kpi"><strong>${unique(rows.map((row) => row.jurisdiction)).length}</strong><span>Active jurisdictions</span></div>
      <div class="kpi"><strong>${data.changeLogs.filter((row) => row.review_status !== "Evaluated").length}</strong><span>Open review items</span></div>
    </section>
    <section class="two-col">
      <div class="panel">
        <div class="filters">
          <label class="field">Timeframe
            <select data-filter="dashboardTime">
              ${optionList(["Last 24h", "7d", "30d"], state.filters.dashboardTime || "7d")}
            </select>
          </label>
          <label class="field">Jurisdiction
            <select data-filter="dashboardCountry">
              <option value="">All</option>${optionList(unique(rows.map((row) => row.jurisdiction)), state.filters.dashboardCountry || "")}
            </select>
          </label>
          <label class="field">Regulator Family
            <select data-filter="dashboardFamily">
              <option value="">All</option>${optionList(unique(data.regulators.flatMap((row) => row.regulator_family)), state.filters.dashboardFamily || "")}
            </select>
          </label>
        </div>
        ${grid(rows, [
          ["date", "Date"],
          ["jurisdiction", "Jurisdiction"],
          ["regulator", "Regulator"],
          ["change_summary", "Change Summary"],
          ["priority", "Priority"]
        ], "dashboard")}
      </div>
      <div class="panel">
        <h2>Rollout Phase Tracking</h2>
        ${grid(data.rolloutPhases, [
          ["market", "Market"],
          ["phase", "Phase"],
          ["status", "Status"],
          ["risk", "Risk"]
        ], "rollout")}
      </div>
    </section>
  `;
}

function renderWorkspace() {
  state.activeRows = state.workspace.results;
  state.globalRows = state.workspace.results;
  const countries = unique(data.jurisdictions.map((item) => item.country));
  const products = unique(data.products.map((item) => item.product_id));
  const licenses = unique(data.licenses.map((item) => item.license_id));
  return `
    ${screenHead("WORKSPACE")}
    <section class="workspace-grid">
      <div class="panel">
        <label class="field">Jurisdiction
          <select id="workspace-country" multiple>${optionList(countries, state.workspace.countries, true)}</select>
        </label>
        <label class="field">Product Types
          <select id="workspace-products" multiple>${optionList(products, state.workspace.products, true)}</select>
        </label>
        <label class="field">License Type
          <select id="workspace-license">${optionList(licenses, state.workspace.license)}</select>
        </label>
        <label class="field">Operating Model / Risk Domains
          <input id="workspace-risk" value="payments, AML, privacy, telecom">
        </label>
        <div class="segmented" role="group" aria-label="Matrix filters">
          ${["all", "direct", "secondary"].map((mode) => `<button data-match-mode="${mode}" class="${state.workspace.matchMode === mode ? "active" : ""}">${mode === "all" ? "All Items" : mode === "direct" ? "Direct Matches" : "Overlapping"}</button>`).join("")}
        </div>
        <p class="small">State is serialized into the URL for shareable workspace configurations.</p>
        <button class="primary" id="run-workspace">Execute Matrix Analysis</button>
      </div>
      <div class="panel">
        <div class="tabs">
          <button class="active">Regulators</button><button>Licenses</button><button>Obligations</button><button>Reports</button>
        </div>
        ${state.workspace.results.length ? grid(state.workspace.results, [
          ["regulator", "Regulator"],
          ["role", "Role"],
          ["trigger", "Triggering Product/License"],
          ["obligation_count", "Obligation Count"],
          ["report_count", "Report Count"]
        ], "workspace") : emptyMatrix()}
      </div>
    </section>
  `;
}

function emptyMatrix() {
  return `
    <div class="empty-state">
      <strong>No Explicit Matrix Match Coordinates</strong>
      <p>The criteria matrix matching generated zero specific objects inside the Library. Displaying high-level geographic baseline frameworks.</p>
      <button id="clear-workspace">Clear Filter State</button>
      <button>Report Ingestion Gap</button>
    </div>
  `;
}

function renderJurisdictions() {
  const selected = state.filters.jurisdictionCountry || data.jurisdictions[0].country;
  const doc = byId(data.jurisdictions, "country", selected) || data.jurisdictions[0];
  state.activeRows = data.jurisdictions;
  state.globalRows = data.jurisdictions;
  return `
    ${screenHead("JURISDICTIONS")}
    <section class="workspace-grid">
      <div class="panel">
        <div class="filters">
          <label class="field">Region
            <select data-filter="jurisdictionRegion">
              <option value="">All</option>${optionList(unique(data.jurisdictions.map((item) => item.region)), state.filters.jurisdictionRegion || "")}
            </select>
          </label>
          <label class="field">Environment
            <select data-filter="jurisdictionEnv">
              <option value="">All</option>${optionList(["onshore", "offshore_free_zone"], state.filters.jurisdictionEnv || "")}
            </select>
          </label>
        </div>
        ${data.jurisdictions.map((item) => `<button data-country="${item.country}" class="${doc.country === item.country ? "active" : ""}">${item.country} - ${item.name}</button>`).join("")}
      </div>
      <div class="panel markdown">
        ${markdown(doc.narrative)}
      </div>
    </section>
  `;
}

function renderRegulators() {
  let rows = [...data.regulators];
  const country = state.filters.regCountry || "";
  const family = state.filters.regFamily || "";
  const sector = state.filters.regSector || "";
  if (country) rows = rows.filter((row) => row.country === country);
  if (family) rows = rows.filter((row) => row.regulator_family.includes(family));
  if (sector) rows = rows.filter((row) => row.sectors_covered.includes(sector));
  state.activeRows = rows;
  state.globalRows = data.regulators;
  return `
    ${screenHead("REGULATORS")}
    <section class="panel">
      <div class="filters">
        <label class="field">Country Code<select data-filter="regCountry"><option value="">All</option>${optionList(unique(data.regulators.map((r) => r.country)), country)}</select></label>
        <label class="field">Regulator Family<select data-filter="regFamily"><option value="">All</option>${optionList(unique(data.regulators.flatMap((r) => r.regulator_family)), family)}</select></label>
        <label class="field">Sectors Covered<select data-filter="regSector"><option value="">All</option>${optionList(unique(data.regulators.flatMap((r) => r.sectors_covered)), sector)}</select></label>
      </div>
      ${grid(rows, [
        ["regulator_id", "Regulator ID"],
        ["acronym", "Acronym"],
        ["name", "Official Name"],
        ["country", "Country"],
        ["regulator_family", "Family"],
        ["license_classes_supervised", "Supervised License Classes"]
      ], "regulators")}
    </section>
  `;
}

function renderLicenses() {
  const isLicenses = state.licenseTab === "licenses";
  const rows = isLicenses ? data.licenses : data.products;
  state.activeRows = rows;
  state.globalRows = rows;
  return `
    ${screenHead("LICENSES_PRODUCTS")}
    <section class="panel">
      <div class="tabs">
        <button data-license-tab="licenses" class="${isLicenses ? "active" : ""}">License Mapping</button>
        <button data-license-tab="products" class="${!isLicenses ? "active" : ""}">Product Applicability</button>
      </div>
      ${isLicenses ? grid(rows, [
        ["license_id", "License ID"],
        ["license_name", "License Name"],
        ["jurisdiction", "Jurisdiction"],
        ["primary_regulator", "Primary Regulator"],
        ["secondary_regulators", "Secondary Regulators"],
        ["allowed_products", "Allowed Products"]
      ], "licenses") : grid(rows, [
        ["product_id", "Product ID"],
        ["name", "Product Name"],
        ["jurisdiction", "Jurisdiction"],
        ["regulators_in_scope", "Regulators in Scope"],
        ["risk_domain_tags", "Risk Domain Tags"]
      ], "products")}
    </section>
  `;
}

function renderObligations() {
  let rows = [...data.obligations];
  const type = state.filters.obType || "";
  const reg = state.filters.obReg || "";
  const license = state.filters.obLicense || "";
  if (type) rows = rows.filter((row) => row.obligation_type === type);
  if (reg) rows = rows.filter((row) => row.regulator_id === reg);
  if (license) rows = rows.filter((row) => row.applies_to_license_ids.includes(license));
  state.activeRows = rows;
  state.globalRows = data.obligations;
  return `
    ${screenHead("OBLIGATIONS")}
    <section class="panel">
      <div class="filters">
        <label class="field">Obligation Type<select data-filter="obType"><option value="">All</option>${optionList(unique(data.obligations.map((r) => r.obligation_type)), type)}</select></label>
        <label class="field">Regulator ID<select data-filter="obReg"><option value="">All</option>${optionList(unique(data.obligations.map((r) => r.regulator_id)), reg)}</select></label>
        <label class="field">Linked License ID<select data-filter="obLicense"><option value="">All</option>${optionList(unique(data.obligations.flatMap((r) => r.applies_to_license_ids)), license)}</select></label>
      </div>
      ${grid(rows, [
        ["obligation_id", "Obligation ID"],
        ["regulator_id", "Regulator"],
        ["obligation_type", "Obligation Type"],
        ["legal_source_ref", "Legal Source Ref"],
        ["obligation_summary", "Operational Summary"],
        ["control_template_ref", "Control Template Ref"]
      ], "obligations")}
    </section>
  `;
}

function renderReporting() {
  let rows = [...data.reports];
  const trigger = state.filters.repTrigger || "";
  const frequency = state.filters.repFrequency || "";
  const reg = state.filters.repReg || "";
  if (trigger) rows = rows.filter((row) => row.trigger === trigger);
  if (frequency) rows = rows.filter((row) => row.frequency === frequency);
  if (reg) rows = rows.filter((row) => row.regulator_id === reg);
  state.activeRows = rows;
  state.globalRows = data.reports;
  return `
    ${screenHead("REPORTING")}
    <section class="panel">
      <div class="filters">
        <label class="field">Submission Trigger<select data-filter="repTrigger"><option value="">All</option>${optionList(unique(data.reports.map((r) => r.trigger)), trigger)}</select></label>
        <label class="field">Frequency<select data-filter="repFrequency"><option value="">All</option>${optionList(unique(data.reports.map((r) => r.frequency)), frequency)}</select></label>
        <label class="field">Target Regulator<select data-filter="repReg"><option value="">All</option>${optionList(unique(data.reports.map((r) => r.regulator_id)), reg)}</select></label>
      </div>
      ${grid(rows, [
        ["report_id", "Report ID"],
        ["regulator_id", "Regulator"],
        ["report_name", "Report Name"],
        ["trigger", "Trigger"],
        ["frequency", "Frequency"],
        ["format", "Format"],
        ["deadline", "Submission Deadline"]
      ], "reporting")}
    </section>
  `;
}

function renderMonitoring() {
  let rows = [...data.changeLogs];
  const priority = state.filters.monPriority || "";
  const status = state.filters.monStatus || "";
  if (priority) rows = rows.filter((row) => row.monitoring_priority === priority);
  if (status) rows = rows.filter((row) => row.review_status === status);
  state.activeRows = rows;
  state.globalRows = data.changeLogs;
  const counts = ["Open", "In Review", "Evaluated"].map((statusName) => data.changeLogs.filter((row) => row.review_status === statusName).length);
  return `
    ${screenHead("MONITORING")}
    <section class="status-banner">
      <div class="status-box"><strong>${counts[0]}</strong><br><span>Open</span></div>
      <div class="status-box"><strong>${counts[1]}</strong><br><span>In Review</span></div>
      <div class="status-box"><strong>${counts[2]}</strong><br><span>Evaluated</span></div>
    </section>
    <section class="panel">
      <div class="filters">
        <label class="field">Priority Level<select data-filter="monPriority"><option value="">All</option>${optionList(unique(data.changeLogs.map((r) => r.monitoring_priority)), priority)}</select></label>
        <label class="field">Review Status<select data-filter="monStatus"><option value="">All</option>${optionList(unique(data.changeLogs.map((r) => r.review_status)), status)}</select></label>
      </div>
      ${grid(rows, [
        ["log_date", "Log Date"],
        ["regulator_id", "Regulator"],
        ["update_source", "Update Source"],
        ["major_change_note", "Major Change Note"],
        ["monitoring_priority", "Monitoring Priority"],
        ["review_status", "Review Status"]
      ], "monitoring")}
      ${data.roles[state.role].canEdit ? `<button class="primary" id="flag-review">Flag Entity for Review</button>` : `<button class="locked" title="Editors and admins only">Flag Entity for Review</button>`}
    </section>
  `;
}

function grid(rows, columns, module) {
  if (!rows.length) return `<div class="empty-state"><strong>No records matching filter parameters.</strong><p>Reset column filters to restore active grid records.</p></div>`;
  return `
    <table>
      <thead><tr>${columns.map(([, label]) => `<th>${label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row, index) => `
          <tr data-row-module="${module}" data-row-index="${index}">
            ${columns.map(([key]) => {
              const value = row[key];
              const className = key === "priority" || key === "monitoring_priority" ? `priority-${String(value).toLowerCase()}` : key === "risk" ? `risk-${String(value).toLowerCase()}` : "";
              return `<td class="${className}">${Array.isArray(value) ? pills(value) : escapeHtml(value)}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function markdown(input) {
  const lines = input.split("\n");
  let html = "";
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (cells.every((cell) => /^-+$/.test(cell.replaceAll(" ", "")))) continue;
      if (!inTable) {
        html += "<table>";
        inTable = true;
      }
      html += `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
      continue;
    }
    if (inTable) {
      html += "</table>";
      inTable = false;
    }
    if (line.startsWith("# ")) html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
    else if (line.startsWith("## ")) html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
    else if (line.trim()) html += `<p>${escapeHtml(line)}</p>`;
  }
  if (inTable) html += "</table>";
  return html;
}

function renderDrawer() {
  if (!state.drawer) {
    return `<h2>Context Drawer</h2><p class="small">Select a row to inspect source links, audit timestamps, downstream mappings, and implementation notes.</p>`;
  }
  const { module, row } = state.drawer;
  if (module === "dashboard") return drawerDashboard(row);
  if (module === "workspace") return drawerWorkspace(row);
  if (module === "regulators") return drawerRegulator(row);
  if (module === "licenses") return drawerLicense(row);
  if (module === "products") return drawerProduct(row);
  if (module === "obligations") return drawerObligation(row);
  if (module === "reporting") return drawerReport(row);
  if (module === "monitoring") return drawerMonitoring(row);
  return `<h2>${escapeHtml(row.market || row.name || "Detail")}</h2><p>${escapeHtml(JSON.stringify(row))}</p>`;
}

function dl(entries) {
  return `<dl>${entries.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${Array.isArray(value) ? pills(value) : linkIfUrl(value)}</dd>`).join("")}</dl>`;
}

function linkIfUrl(value) {
  const text = escapeHtml(value);
  if (typeof value === "string" && value.startsWith("http")) return `<a href="${text}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  return text;
}

function drawerDashboard(row) {
  return `
    <h2>${escapeHtml(row.regulator)} Change</h2>
    <p>${escapeHtml(row.change_summary)}</p>
    <div class="drawer-section"><h3>Ingestion Audit</h3>${dl([["source_url", row.source_url], ["source_published_at", row.source_published_at], ["last_ingested_at", row.last_ingested_at]])}</div>
    <div class="drawer-section"><h3>Impact Analysis Narrative</h3><p>${escapeHtml(row.impact)}</p></div>
    <div class="drawer-section"><h3>Downstream Impact Mapping</h3>${dl([["Impacted Licenses", row.impacted_licenses], ["Impacted Obligations", row.impacted_obligations]])}</div>
  `;
}

function drawerWorkspace(row) {
  return `
    <h2>Client Applicability Report</h2>
    <p>${escapeHtml(row.regulator)} is mapped as ${escapeHtml(row.role)} for the selected client profile.</p>
    ${dl([["Trigger", row.trigger], ["Obligation Count", row.obligation_count], ["Report Count", row.report_count], ["Obligations", row.obligations], ["Reports", row.reports]])}
  `;
}

function drawerRegulator(row) {
  return `
    <h2>${escapeHtml(row.acronym)}</h2>
    <p>${escapeHtml(row.name)}</p>
    <div class="drawer-section"><h3>Scope & Identity</h3>${dl([["typical_client_profiles", row.typical_client_profiles], ["official website", row.source_url], ["last_ingested_at", row.last_ingested_at], ["sectors_covered", row.sectors_covered]])}</div>
    <div class="drawer-section"><h3>Legal Foundations</h3>${dl([["key_statutes", row.key_statutes], ["key_rulebooks", row.key_rulebooks]])}</div>
    <div class="drawer-section"><h3>Enforcement Framework</h3>${dl([["max_penalty_reference", row.max_penalty_reference], ["investigatory_powers", row.investigatory_powers], ["corrective_powers", row.corrective_powers], ["authorization_powers", row.authorization_powers]])}</div>
  `;
}

function drawerLicense(row) {
  return `
    <h2>${escapeHtml(row.license_id)}</h2>
    <p>${escapeHtml(row.license_name)}</p>
    ${dl([["Primary Regulator", row.primary_regulator], ["Secondary Regulators", row.secondary_regulators], ["Allowed Products", row.allowed_products], ["core_obligations_refs", row.core_obligations_refs], ["downstream_reporting_refs", row.downstream_reporting_refs]])}
  `;
}

function drawerProduct(row) {
  return `<h2>${escapeHtml(row.product_id)}</h2>${dl([["Name", row.name], ["Jurisdiction", row.jurisdiction], ["Regulators in Scope", row.regulators_in_scope], ["Risk Domain Tags", row.risk_domain_tags]])}`;
}

function drawerObligation(row) {
  return `
    <h2>${escapeHtml(row.obligation_id)}</h2>
    <p>${escapeHtml(row.obligation_summary)}</p>
    <div class="drawer-section"><h3>Source Trace</h3>${dl([["source_excerpt", row.source_excerpt], ["legal_source_ref", row.legal_source_ref], ["source_url", row.source_url], ["source_published_at", row.source_published_at], ["last_ingested_at", row.last_ingested_at]])}</div>
    <div class="drawer-section"><h3>Control Implementation Guide</h3><p>Validate ownership, evidence capture, exception handling, review cadence, and sample-based operating effectiveness for ${escapeHtml(row.control_template_ref)}.</p></div>
  `;
}

function drawerReport(row) {
  return `
    <h2>${escapeHtml(row.report_name)}</h2>
    ${dl([["Report ID", row.report_id], ["Regulator", row.regulator_id], ["Trigger", row.trigger], ["Frequency", row.frequency], ["Format", row.format], ["Deadline", row.deadline], ["source_url", row.source_url], ["Penalty", row.penalty_for_non_compliance]])}
  `;
}

function drawerMonitoring(row) {
  return `
    <h2>${escapeHtml(row.regulator_id)}</h2>
    <p>${escapeHtml(row.major_change_note)}</p>
    ${dl([["Source URL", row.source_url], ["Assigned Auditor", row.assigned_auditor], ["Review Status", row.review_status]])}
    <div class="drawer-section"><h3>Diff Block</h3><p><strong>Replaced:</strong> ${escapeHtml(row.previous_excerpt)}</p><p><strong>Incoming:</strong> ${escapeHtml(row.incoming_excerpt)}</p></div>
  `;
}

function executeWorkspace(showToast = true) {
  const selectedLicense = byId(data.licenses, "license_id", state.workspace.license);
  const selectedProducts = data.products.filter((product) => state.workspace.products.includes(product.product_id));
  let regulatorIds = unique([
    ...(selectedLicense ? [selectedLicense.primary_regulator, ...selectedLicense.secondary_regulators] : []),
    ...selectedProducts.flatMap((product) => product.regulators_in_scope)
  ]);
  regulatorIds = regulatorIds.filter((id) => state.workspace.countries.includes(regulator(id).country));
  if (state.workspace.matchMode === "direct" && selectedLicense) regulatorIds = [selectedLicense.primary_regulator];
  if (state.workspace.matchMode === "secondary" && selectedLicense) regulatorIds = selectedLicense.secondary_regulators;
  state.workspace.results = regulatorIds.map((id) => {
    const obligations = data.obligations.filter((item) => item.regulator_id === id && (
      item.applies_to_license_ids.includes(state.workspace.license) ||
      item.applies_to_products.some((product) => state.workspace.products.includes(product))
    ));
    const reports = data.reports.filter((item) => item.regulator_id === id);
    const role = selectedLicense && selectedLicense.primary_regulator === id ? "Primary" : "Secondary/Overlapping";
    return {
      regulator: id,
      role,
      trigger: `${state.workspace.license}; ${state.workspace.products.join(", ")}`,
      obligation_count: obligations.length,
      report_count: reports.length,
      obligations: obligations.map((item) => item.obligation_id),
      reports: reports.map((item) => item.report_id)
    };
  });
  syncWorkspaceUrl();
  if (showToast) toast("Matrix analysis completed from seeded data.");
}


function renderGenerator() {
  const g = state.generator;
  const countries = unique(data.jurisdictions.map((j) => j.country));
  const licenses = unique(data.licenses.map((l) => l.license_id));
  const allDomains = ["Market Risk","Insurance Risk","Liquidity Risk","Credit Risk","AML/CFT","Governance","Capital Adequacy"];
  state.activeModule = "FRAMEWORK_BUILDER";
  return `
    ${screenHead("FRAMEWORK_BUILDER")}
    <section class="workspace-grid">
      <div class="panel">
        <h2 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#5A6F82">Client Profile</h2>
        <label class="field">Engagement / Client Name
          <input id="gen-name" placeholder="e.g. FinSoul — Bahrain Reinsurer" value="${escapeHtml(g.engagementName)}">
        </label>
        <label class="field">Jurisdiction
          <select id="gen-country">
            ${optionList(countries, g.country)}
          </select>
        </label>
        <label class="field">License Type
          <select id="gen-license">
            ${optionList(licenses, g.license)}
          </select>
        </label>
        <label class="field">Entity Type
          <select id="gen-entity">
            ${optionList(["Direct Insurer","Pure Reinsurer","Captive Insurance Vehicle","Payment Service Provider","Bank","Investment Firm"], g.entityType)}
          </select>
        </label>
        <label class="field">Risk Domains in Scope</label>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          ${allDomains.map((d) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" data-gen-domain="${escapeHtml(d)}" ${g.domains.includes(d) ? "checked" : ""}>
              ${escapeHtml(d)}
            </label>
          `).join("")}
        </div>
        <button class="primary" id="run-generator" ${g.generating ? "disabled" : ""}>
          ${g.generating ? "Generating…" : "Generate Framework Document"}
        </button>
        ${g.output ? `<button id="export-framework" style="margin-top:8px;width:100%;padding:8px;background:#E8953A;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">Export as CSV</button>` : ""}
        <p class="small" style="margin-top:10px">Generates a structured framework outline — policy scope, methodology, scenario list, CBB mapping, and deliverables — drawn from library data for the selected profile.</p>
      </div>
      <div class="panel" style="overflow-y:auto">
        ${g.generating ? `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;color:#5A6F82">
            <div style="font-size:28px">⟳</div>
            <p>Building framework document…</p>
          </div>
        ` : g.output ? renderFrameworkOutput(g.output) : `
          <div class="empty-state">
            <strong>No Framework Generated</strong>
            <p>Configure the client profile on the left and click Generate Framework Document to produce a structured output.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderFrameworkOutput(out) {
  return `
    <div style="display:flex;flex-direction:column;gap:20px">
      <div style="background:#1B3A5C;color:#fff;padding:16px 20px;border-radius:6px">
        <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:4px">Framework Builder Output</div>
        <div style="font-size:16px;font-weight:700">${escapeHtml(out.title)}</div>
        <div style="font-size:12px;color:#D6E4F0;margin-top:4px">${escapeHtml(out.subtitle)}</div>
      </div>

      <div class="drawer-section">
        <h3>1. Engagement Overview</h3>
        <table>
          <tbody>
            ${out.overview.map(([k,v]) => `<tr><td style="font-weight:600;width:200px">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>2. Regulatory Authority</h3>
        ${out.regulators.map((r) => `
          <div style="margin-bottom:10px;padding:10px;background:#f8f9fa;border-left:3px solid #1B3A5C;border-radius:0 4px 4px 0">
            <div style="font-weight:700;font-size:13px">${escapeHtml(r.acronym)} — ${escapeHtml(r.name)}</div>
            <div style="font-size:12px;color:#5A6F82;margin-top:3px">${escapeHtml(r.focus)}</div>
            <div style="margin-top:6px">${pills(r.modules)}</div>
          </div>
        `).join("")}
      </div>

      <div class="drawer-section">
        <h3>3. Obligations in Scope (${out.obligations.length})</h3>
        <table>
          <thead><tr><th>Obligation ID</th><th>Type</th><th>CBB Module</th><th>Summary</th></tr></thead>
          <tbody>
            ${out.obligations.map((o) => `
              <tr>
                <td style="font-family:monospace;font-size:11px;white-space:nowrap">${escapeHtml(o.id)}</td>
                <td>${escapeHtml(o.type)}</td>
                <td><span class="pill">${escapeHtml(o.module)}</span></td>
                <td style="font-size:11px">${escapeHtml(o.summary)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>4. Stress Testing Scenario Matrix</h3>
        <table>
          <thead><tr><th>Scenario ID</th><th>Risk Domain</th><th>Description</th><th>CBB Module</th><th>Severity</th></tr></thead>
          <tbody>
            ${out.scenarios.map((s) => `
              <tr>
                <td style="font-family:monospace;font-size:11px;font-weight:700">${escapeHtml(s.id)}</td>
                <td>${escapeHtml(s.domain)}</td>
                <td style="font-size:11px">${escapeHtml(s.description)}</td>
                <td><span class="pill">${escapeHtml(s.module)}</span></td>
                <td class="priority-${s.severity.toLowerCase()}">${escapeHtml(s.severity)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>5. Reporting Obligations (${out.reports.length})</h3>
        <table>
          <thead><tr><th>Report</th><th>Trigger</th><th>Frequency</th><th>Deadline</th></tr></thead>
          <tbody>
            ${out.reports.map((r) => `
              <tr>
                <td style="font-size:11px;font-weight:600">${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.trigger)}</td>
                <td>${escapeHtml(r.frequency)}</td>
                <td style="font-size:11px">${escapeHtml(r.deadline)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>6. CBB Regulatory Compliance Mapping</h3>
        <table>
          <thead><tr><th>CBB Module</th><th>Requirement</th><th>Framework Response</th><th>Status</th></tr></thead>
          <tbody>
            ${out.mapping.map((m) => `
              <tr>
                <td style="font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap">${escapeHtml(m.module)}</td>
                <td style="font-size:11px">${escapeHtml(m.requirement)}</td>
                <td style="font-size:11px">${escapeHtml(m.response)}</td>
                <td style="color:#1B6B3A;font-weight:600;font-size:11px">${escapeHtml(m.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>7. Deliverables Checklist</h3>
        <table>
          <thead><tr><th>#</th><th>Deliverable</th><th>Description</th><th>Owner</th></tr></thead>
          <tbody>
            ${out.deliverables.map((d,i) => `
              <tr>
                <td style="font-weight:700;color:#1B3A5C">${i+1}</td>
                <td style="font-weight:600">${escapeHtml(d.name)}</td>
                <td style="font-size:11px">${escapeHtml(d.description)}</td>
                <td><span class="pill">${escapeHtml(d.owner)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="background:#FFF2CC;border:1px solid #E8953A;border-radius:6px;padding:14px;font-size:11px;color:#5A6F82">
        <strong style="color:#1B3A5C">Advisory Note:</strong> This framework document is generated from the Regulator Intelligence Library seed data and is illustrative of the underlying methodology and structure. Actuarial assumptions, reserving inputs, and entity-specific calibration must be provided by the client's internal teams and registered actuaries. All CBB module references should be verified against the current CBB Rulebook Volume 3 prior to regulatory submission.
      </div>

      <div style="font-size:10px;color:#5A6F82;text-align:right;padding-top:4px">
        Generated by Regulator Intelligence Library · ${escapeHtml(out.generatedAt)}
      </div>
    </div>
  `;
}

function generateFramework() {
  const g = state.generator;
  const jurisdiction = byId(data.jurisdictions, "country", g.country);
  const license = byId(data.licenses, "license_id", g.license);
  const regulatorIds = license ? [license.primary_regulator, ...license.secondary_regulators] : [];
  const regs = regulatorIds.map((id) => data.regulators.find((r) => r.regulator_id === id)).filter(Boolean);
  const obligations = data.obligations.filter((o) =>
    o.jurisdiction === g.country &&
    license && o.applies_to_license_ids.includes(g.license)
  );
  const reports = data.reports.filter((r) =>
    regs.some((reg) => reg.regulator_id === r.regulator_id)
  );

  const engName = g.engagementName || `${countryName(g.country)} ${g.entityType}`;

  // Domain → scenario map
  const scenarioMap = {
    "Market Risk": [
      { id:"MR-1", desc:"Parallel interest rate rise +300bps", module:"RM-4.1", severity:"Moderate" },
      { id:"MR-2", desc:"Parallel interest rate fall −200bps", module:"RM-4.1", severity:"Moderate" },
      { id:"MR-3", desc:"Equity market crash −40%", module:"RM-4.1", severity:"High" },
      { id:"MR-4", desc:"Real estate value decline −25%", module:"RM-4.1", severity:"Moderate" },
      { id:"MR-5", desc:"Credit spread widening +250bps", module:"RM-4.1", severity:"Moderate" },
      { id:"MR-6", desc:"Adverse FX movement −15%", module:"RM-4.1", severity:"Low" },
      { id:"MR-7", desc:"Combined market shock (simultaneous)", module:"RM-4.1", severity:"High" },
    ],
    "Insurance Risk": [
      { id:"IR-1", desc:"Underwriting deterioration +20% loss ratio", module:"RM-5.1", severity:"Moderate" },
      { id:"IR-2", desc:"Reserve adverse development +15%", module:"RM-5.1", severity:"Moderate" },
      { id:"IR-3", desc:"Catastrophe event — 1-in-50yr return period", module:"RM-5.1", severity:"High" },
      { id:"IR-4", desc:"Catastrophe event — 1-in-200yr return period", module:"RM-5.1", severity:"High" },
      { id:"IR-5", desc:"Claims inflation spike +10%", module:"RM-5.1", severity:"Low" },
      { id:"IR-6", desc:"Premium volume decline −15%", module:"RM-5.1", severity:"Moderate" },
      { id:"IR-7", desc:"Combined underwriting stress (multi-factor)", module:"RM-5.1", severity:"High" },
    ],
    "Liquidity Risk": [
      { id:"LR-1", desc:"Large single claim event — 2× 30-day outflow", module:"RM-3.1", severity:"Moderate" },
      { id:"LR-2", desc:"Forced asset liquidation with haircut", module:"RM-3.1", severity:"Moderate" },
      { id:"LR-3", desc:"Reinsurer payment delay — 30-day withhold", module:"RM-3.1", severity:"Low" },
      { id:"LR-4", desc:"Market-wide funding disruption / freeze", module:"RM-3.1", severity:"High" },
      { id:"LR-5", desc:"Combined liquidity stress (multi-factor)", module:"RM-3.1", severity:"High" },
    ],
    "Credit Risk": [
      { id:"CR-1", desc:"Largest reinsurer default — 100% exposure loss", module:"RM-2.1", severity:"High" },
      { id:"CR-2", desc:"Top 3 reinsurers default — 50% aggregate loss", module:"RM-2.1", severity:"High" },
      { id:"CR-3", desc:"Reinsurer rating downgrade — 2-notch stress", module:"RM-2.1", severity:"Moderate" },
      { id:"CR-4", desc:"Credit asset deterioration — BBB to junk migration", module:"RM-2.1", severity:"Moderate" },
      { id:"CR-5", desc:"Fronting arrangement failure — reinsurer cancels", module:"RM-2.1", severity:"High" },
      { id:"CR-6", desc:"Combined credit stress (multi-factor)", module:"RM-2.1", severity:"High" },
    ],
    "AML/CFT": [
      { id:"AML-1", desc:"High-risk customer onboarding control gap", module:"AML", severity:"High" },
      { id:"AML-2", desc:"Suspicious transaction reporting failure", module:"AML", severity:"High" },
      { id:"AML-3", desc:"Sanctions screening miss on counterparty", module:"AML", severity:"High" },
    ],
    "Governance": [
      { id:"GOV-1", desc:"Board stress testing framework review overdue", module:"HC", severity:"Moderate" },
      { id:"GOV-2", desc:"RACI breakdown — First Line / Second Line boundary", module:"HC", severity:"Moderate" },
    ],
    "Capital Adequacy": [
      { id:"CA-1", desc:"RSM breach under adverse scenario — immediate notification", module:"CA-2", severity:"High" },
      { id:"CA-2", desc:"Tier 1 capital erosion below BD 10m floor (reinsurer)", module:"CA-1.2", severity:"High" },
      { id:"CA-3", desc:"Own-risk capital buffer inadequate under IAIS ICP 17", module:"CA-3", severity:"Moderate" },
    ],
  };

  const scenarios = g.domains.flatMap((domain) =>
    (scenarioMap[domain] || []).map((s) => ({ ...s, domain }))
  );

  // CBB mapping
  const mappingRows = [
    { module:"RM-1.1", requirement:"Identify and manage all material risk categories", response:"Framework covers selected risk domains; risk register embedded in policy", status:"Compliant" },
    { module:"RM-2.1", requirement:"Reinsurance counterparty risk; 25% concentration trigger", response:"CR scenarios cover single and aggregate reinsurer default; CBB flag formula embedded", status:"Compliant" },
    { module:"RM-3.1", requirement:"Liquidity — A/L mismatch and asset liquidation cost", response:"LR scenarios with haircut modelling on illiquid assets", status:"Compliant" },
    { module:"RM-4.1", requirement:"Market risk — investment portfolio stress", response:"MR scenarios cover rate, equity, FX, and spread shocks", status:"Compliant" },
    { module:"RM-5.1", requirement:"Insurance technical risk — underwriting and cat", response:"IR scenarios including 1-in-50 and 1-in-200yr cat events", status:"Compliant" },
    { module:"CA-1.2", requirement:`Minimum Tier 1 capital floor — ${g.entityType === "Pure Reinsurer" ? "BD 10m (reinsurer)" : "BD 5m (insurer)"}`, response:"Capital floor threshold in Capital Summary solvency calculations", status:"Compliant" },
    { module:"CA-2", requirement:"Required Solvency Margin — premium and claims basis", response:"RSM input in each domain; post-stress solvency ratio auto-calculated", status:"Compliant" },
    { module:"HC", requirement:"Board governance of stress testing framework", response:"Policy doc establishes RACI, board ownership, and annual review cycle", status:"Compliant" },
    { module:"BR", requirement:"Prudential reporting to CBB", response:"Reporting template formatted for CBB return schedule", status:"Compliant" },
  ].filter((m) => {
    if (!g.domains.includes("Credit Risk") && m.module === "RM-2.1") return false;
    if (!g.domains.includes("Liquidity Risk") && m.module === "RM-3.1") return false;
    if (!g.domains.includes("Market Risk") && m.module === "RM-4.1") return false;
    if (!g.domains.includes("Insurance Risk") && m.module === "RM-5.1") return false;
    return true;
  });

  const deliverables = [
    { name:"Stress Testing Policy", description:"Board-level policy document establishing governance framework, objectives, scope, and RACI responsibilities for enterprise-wide stress testing.", owner:"Risk Advisory" },
    { name:"Stress Testing Methodology Document", description:"Detailed methodologies, scenario rationale, key assumptions, and data inputs across all selected risk domains, aligned to the CBB Rulebook and client Risk Management Policy.", owner:"Risk Advisory" },
    { name:"Consolidated Stress Testing Workbook", description:"MS Excel toolkit enabling scenario execution, data capture, and output calculation across selected risk domains in a single integrated workbook with live solvency impact calculator.", owner:"Risk Advisory" },
    { name:"Stress Testing Reporting Template", description:"Standardised reporting template capturing scenarios executed, key results, risk insights, and recommended management actions, formatted for senior management and regulatory reporting.", owner:"Risk Advisory" },
    { name:"CBB Compliance Mapping", description:"Structured mapping of the framework against applicable CBB Rulebook Volume 3 requirements, demonstrating regulatory alignment and identifying any residual gaps.", owner:"Risk Advisory" },
    { name:"Client Data Input Package", description:"Populated balance sheet figures, actuarial assumptions, investment portfolio data, and reinsurance programme details required to run the workbook scenarios.", owner:"Client" },
  ];

  return {
    title: `${engName} — Stress Testing Framework`,
    subtitle: `${g.entityType} · ${countryName(g.country)} · ${license ? license.license_name : g.license} · CBB Volume 3 Aligned`,
    generatedAt: new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }),
    overview: [
      ["Engagement Name", engName],
      ["Entity Type", g.entityType],
      ["Jurisdiction", `${countryName(g.country)} (${g.country})`],
      ["License", g.license],
      ["Primary Regulator", regs.length ? regs[0].acronym + " — " + regs[0].name : "—"],
      ["Risk Domains in Scope", g.domains.join(", ")],
      ["Scenarios Generated", String(scenarios.length)],
      ["Obligations Mapped", String(obligations.length)],
      ["Reporting Obligations", String(reports.length)],
      ["Regulatory Standard", "CBB Rulebook Volume 3 (Insurance) + IAIS Insurance Core Principles"],
      ["Framework Owner", "Board / Risk Management Function"],
      ["Actuary Requirement", "CBB-registered actuary required for reserving and RSM calculation"],
      ["Prepared by", "Independent Risk Advisory"],
    ],
    regulators: regs.map((r) => ({
      acronym: r.acronym,
      name: r.name,
      focus: r.primary_supervision_focus,
      modules: r.key_rulebooks
    })),
    obligations: obligations.map((o) => ({
      id: o.obligation_id,
      type: o.obligation_type,
      module: o.legal_source_ref.match(/RM-\d+\.\d+|CA-\d+|HC|BR|AML/)?.[0] || "Vol 3",
      summary: o.obligation_summary.slice(0, 120) + "…"
    })),
    scenarios,
    reports: reports.map((r) => ({
      name: r.report_name,
      trigger: r.trigger,
      frequency: r.frequency,
      deadline: r.deadline
    })),
    mapping: mappingRows,
    deliverables,
  };
}

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.screen));
  });
  $("#role-select").addEventListener("change", (event) => {
    state.role = event.target.value;
    render();
  });
  document.querySelectorAll("[data-filter]").forEach((input) => {
    input.addEventListener("change", (event) => {
      state.filters[event.target.dataset.filter] = event.target.value;
      render();
    });
  });
  document.querySelectorAll("[data-row-module]").forEach((row) => {
    row.addEventListener("click", () => {
      const rows = row.dataset.rowModule === "rollout" ? data.rolloutPhases : state.activeRows;
      state.drawer = { module: row.dataset.rowModule, row: rows[Number(row.dataset.rowIndex)] };
      render();
    });
  });
  document.querySelectorAll("[data-country]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.jurisdictionCountry = button.dataset.country;
      render();
    });
  });
  document.querySelectorAll("[data-license-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.licenseTab = button.dataset.licenseTab;
      render();
    });
  });
  document.querySelectorAll("[data-match-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workspace.matchMode = button.dataset.matchMode;
      executeWorkspace();
      render();
    });
  });
  const run = $("#run-workspace");
  if (run) {
    run.addEventListener("click", () => {
      state.workspace.countries = readMulti($("#workspace-country"));
      state.workspace.products = readMulti($("#workspace-products"));
      state.workspace.license = $("#workspace-license").value;
      executeWorkspace();
      render();
    });
  }
  const clear = $("#clear-workspace");
  if (clear) {
    clear.addEventListener("click", () => {
      state.workspace.countries = ["IN"];
      state.workspace.products = ["PROD.UPI_MERCHANT", "PROD.CARD_ISSUING"];
      state.workspace.license = "LIC.IN.PSP.UPI";
      state.workspace.matchMode = "all";
      executeWorkspace();
      render();
    });
  }
  const presetBahrain = $("#preset-bahrain");
  if (presetBahrain) {
    presetBahrain.addEventListener("click", () => {
      state.workspace.countries = ["BH"];
      state.workspace.products = ["PROD.BH.REINSURANCE"];
      state.workspace.license = "LIC.BH.REINSURER";
      state.workspace.matchMode = "all";
      executeWorkspace();
      render();
      toast("Loaded: Bahrain Pure Reinsurer profile — CBB Volume 3");
    });
  }
  const flagReview = $("#flag-review");
  if (flagReview) flagReview.addEventListener("click", () => toast("Review flag recorded in prototype state."));
  $("#export-open").addEventListener("click", openExport);

  // Generator bindings
  const runGen = $("#run-generator");
  if (runGen) {
    runGen.addEventListener("click", () => {
      state.generator.engagementName = $("#gen-name").value;
      state.generator.country = $("#gen-country").value;
      state.generator.license = $("#gen-license").value;
      state.generator.entityType = $("#gen-entity").value;
      state.generator.domains = [...document.querySelectorAll("[data-gen-domain]:checked")].map((cb) => cb.dataset.genDomain);
      state.generator.generating = true;
      state.generator.output = null;
      render();
      setTimeout(() => {
        state.generator.output = generateFramework();
        state.generator.generating = false;
        render();
        toast("Framework document generated.");
      }, 600);
    });
  }
  const exportFw = $("#export-framework");
  if (exportFw) {
    exportFw.addEventListener("click", () => {
      const out = state.generator.output;
      if (!out) return;
      const rows = [
        ...out.obligations.map((o) => ({ section:"Obligation", id:o.id, type:o.type, module:o.module, detail:o.summary })),
        ...out.scenarios.map((s) => ({ section:"Scenario", id:s.id, type:s.domain, module:s.module, detail:s.description })),
        ...out.reports.map((r) => ({ section:"Report", id:r.name, type:r.trigger, module:r.frequency, detail:r.deadline })),
        ...out.mapping.map((m) => ({ section:"CBB Mapping", id:m.module, type:m.requirement, module:m.status, detail:m.response })),
        ...out.deliverables.map((d,i) => ({ section:"Deliverable", id:String(i+1), type:d.name, module:d.owner, detail:d.description })),
      ];
      const timestamp = new Date().toISOString().replaceAll(":", "-");
      const fileBase = `ZAR_FRAMEWORK_${state.generator.country}_${timestamp}`;
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileBase}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("Framework exported as CSV.");
    });
  }
}

function openExport() {
  $("#export-title").textContent = `Export Data Options: ${state.activeModule} Tracker`;
  $("#filtered-count").textContent = `(${state.activeRows.length} rows)`;
  $("#global-count").textContent = `(${state.globalRows.length} rows)`;
  $("#export-modal").classList.remove("hidden");
  $("#export-modal").setAttribute("aria-hidden", "false");
}

function closeExport() {
  $("#export-modal").classList.add("hidden");
  $("#export-modal").setAttribute("aria-hidden", "true");
}

function executeExport() {
  const scope = $("input[name='export-scope']:checked").value;
  const format = $("#export-format").value;
  const rows = scope === "filtered" ? state.activeRows : state.globalRows;
  const country = rows[0]?.country || rows[0]?.jurisdiction || "GLOBAL";
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const fileBase = `ZAR_${state.activeModule}_${country}_${timestamp}`;
  if (format !== "csv") {
    toast(`${format.toUpperCase()} export queued as ${fileBase}; prototype downloads CSV payload.`);
  }
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileBase}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  closeExport();
}

function toCsv(rows) {
  if (!rows.length) return "";
  const keys = unique(rows.flatMap((row) => Object.keys(row)));
  const quote = (value) => {
    const normalized = Array.isArray(value) ? value.join("; ") : value ?? "";
    return `"${String(normalized).replaceAll('"', '""')}"`;
  };
  return [keys.join(","), ...rows.map((row) => keys.map((key) => quote(row[key])).join(","))].join("\n");
}

document.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-export]")) closeExport();
});

$("#execute-export").addEventListener("click", executeExport);

initFromUrl();
if (!state.workspace.results.length) executeWorkspace(false);
render();
