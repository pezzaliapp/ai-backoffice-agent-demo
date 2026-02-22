// app.js
// AI Backoffice Agent Demo — Tickets • CRM • Quotes
// Demo sicura: nessuna azione esterna reale. Le azioni sono proposte e registrate.

const $ = (id) => document.getElementById(id);

const state = {
  tickets: [],
  customers: [],
  products: [],
  deals: [],
  report: null,
  approvals: new Set(),        // ticket_id approvati (P0)
  quotes: [],                  // bozze preventivo generate
  selectedQuoteId: null
};

// ---------------------------
// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    $(`panel-${tab}`).classList.add("active");
  });
});

// ---------------------------
// File loaders
$("fileTickets").addEventListener("change", (e) => loadFileToState(e, "tickets"));
$("fileCustomers").addEventListener("change", (e) => loadFileToState(e, "customers"));
$("fileProducts").addEventListener("change", (e) => loadFileToState(e, "products"));
$("fileDeals").addEventListener("change", (e) => loadFileToState(e, "deals"));

async function loadFileToState(e, key) {
  const f = e.target.files?.[0];
  if (!f) return;
  const txt = await f.text();
  const rows = parseCSV(txt);
  state[key] = rows;
  setDataStatus();
  renderCRM();
}

// ---------------------------
// Demo loader
$("loadDemo").addEventListener("click", async () => {
  const files = [
    ["demo_tickets.csv", "tickets"],
    ["demo_customers.csv", "customers"],
    ["demo_products.csv", "products"],
    ["demo_deals.csv", "deals"],
  ];
  for (const [path, key] of files) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Impossibile caricare ${path}`);
    const txt = await res.text();
    state[key] = parseCSV(txt);
  }
  setDataStatus();
  renderCRM();
  setRunStatus("Dataset demo caricato. Ora puoi eseguire l’agente.");
});

$("clearAll").addEventListener("click", () => {
  state.tickets = [];
  state.customers = [];
  state.products = [];
  state.deals = [];
  state.report = null;
  state.approvals.clear();
  state.quotes = [];
  state.selectedQuoteId = null;

  // reset file inputs
  ["fileTickets","fileCustomers","fileProducts","fileDeals"].forEach(id => $(id).value = "");
  setDataStatus();
  renderAll();
  setRunStatus("Stato svuotato.");
});

// ---------------------------
// Policy
function getPolicy() {
  return {
    blockExternal: $("polBlockExternal").checked,
    requireHumanForP0: $("polRequireHumanP0").checked,
    maskPII: $("polMaskPII").checked,
    autoQuote: $("polAutoQuote").checked,
  };
}

// ---------------------------
// Run agent
$("runAgent").addEventListener("click", () => {
  if (!state.tickets.length) return setRunStatus("Carica prima i ticket (o usa il dataset demo).");
  const policy = getPolicy();

  const report = runAgent(state.tickets, policy, {
    customers: state.customers,
    products: state.products,
    deals: state.deals,
    approvals: state.approvals,
  });

  state.report = report;
  // aggiorna quotes accumulate (non duplicare per ticket già quotato)
  mergeQuotes(report.generated_quotes);

  renderAll();
  setRunStatus(`Agente eseguito. Ticket processati: ${report.stats.total}.`);
});

$("exportReport").addEventListener("click", () => {
  if (!state.report) return setRunStatus("Esegui prima l’agente per generare un report.");
  const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backoffice_agent_report.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------------------------
// Agent core
function runAgent(tickets, policy, ctx) {
  const now = new Date().toISOString();
  const items = [];
  const generated_quotes = [];

  for (const t of tickets) {
    const out = processTicket(t, policy, ctx);
    items.push(out);

    // quote generation (only if enabled and action suggests quote)
    if (policy.autoQuote && out.quote_draft) {
      generated_quotes.push(out.quote_draft);
    }
  }

  const stats = summarize(items);
  const report = { generated_at: now, policy, stats, items, generated_quotes };

  return report;
}

function processTicket(ticket, policy, ctx) {
  const log = [];
  const tid = ticket.ticket_id || ticket.id || ticket.TicketID || ticket.TICKET_ID || ticket.ticketId || "N/A";
  const channel = ticket.channel || ticket.canale || ticket.Channel || "";
  const subject = (ticket.subject || ticket.oggetto || "").trim();
  const body = (ticket.body || ticket.testo || "").trim();
  const customer_hint = (ticket.customer_hint || ticket.cliente || ticket.customer || "").trim();
  const date = (ticket.date || ticket.data || "").trim();

  log.push(`OBSERVE: ticket=${tid} channel=${channel || "?"} date=${date || "?"}`);

  const text = normalize(`${subject}\n${body}`);

  // CRM matching
  const match = matchCustomer(customer_hint, text, ctx.customers);
  if (match) log.push(`CRM: match customer_id=${match.customer_id} company=${match.company}`);
  else log.push(`CRM: no match`);

  // Classification
  const category = classify(text);
  log.push(`DECIDE: category=${category}`);

  // Priority
  const priority = scorePriority(text, category);
  log.push(`DECIDE: priority=${priority}`);

  // Deal linking
  const deal = match ? findDealForCustomer(match.customer_id, ctx.deals) : null;
  if (deal) log.push(`CRM: linked deal=${deal.deal_id} stage=${deal.stage}`);
  else log.push(`CRM: no deal linked`);

  // Proposed action
  let action = proposeAction(category, priority, deal);
  let reason = explain(category, priority, deal);

  // LLM “stub” summary (no external call)
  const llm_summary = llmStubSummarize(subject, body);
  log.push(`LLM: summary="${llm_summary}"`);

  // Guardrails
  if (policy.blockExternal && action.type === "send_external_message") {
    log.push("POLICY: blockExternal=true → external action blocked");
    action = { type: "create_internal_task", payload: "Azione esterna bloccata (demo). Creare task interno e assegnare a umano." };
    reason += " | Policy: blocco azioni esterne.";
  }

  // Human approval for P0
  const isApproved = ctx.approvals.has(String(tid));
  if (policy.requireHumanForP0 && priority === "P0" && !isApproved) {
    log.push("POLICY: requireHumanForP0=true → waiting approval");
    action = { type: "require_human_approval", payload: "In attesa di approvazione umana (P0)." };
    reason += " | In attesa approvazione umana (P0).";
  } else if (priority === "P0") {
    log.push(`POLICY: P0 approved=${isApproved}`);
  }

  // Quote draft (business/backoffice)
  let quote_draft = null;
  if (policy.autoQuote && category === "commerciale" && match && ctx.products?.length) {
    quote_draft = buildQuoteDraft({
      ticket_id: String(tid),
      customer: match,
      deal,
      text,
      products: ctx.products,
      policy,
      log,
    });
    if (quote_draft) log.push(`QUOTE: draft generated quote_id=${quote_draft.quote_id} total_net=${quote_draft.total_net.toFixed(2)}`);
  }

  // Mask PII
  const customer_display = policy.maskPII ? maskPII(match ? `${match.company} (${match.contact})` : customer_hint) : (match ? `${match.company} (${match.contact})` : customer_hint);
  const reason_safe = policy.maskPII ? maskPII(reason) : reason;
  const summary_safe = policy.maskPII ? maskPII(llm_summary) : llm_summary;

  log.push("ACT: demo mode → no real external execution. Proposal+log only.");

  return {
    ticket_id: String(tid),
    channel,
    date,
    customer_hint: policy.maskPII ? maskPII(customer_hint) : customer_hint,
    customer_match: match ? {
      customer_id: match.customer_id,
      company: policy.maskPII ? maskPII(match.company) : match.company,
      contact: policy.maskPII ? maskPII(match.contact) : match.contact,
      email: policy.maskPII ? maskPII(match.email) : match.email,
      phone: policy.maskPII ? maskPII(match.phone) : match.phone,
      city: match.city,
      segment: match.segment,
    } : null,
    customer_display,
    category,
    priority,
    action,
    reason: reason_safe,
    llm_summary: summary_safe,
    linked_deal: deal ? {
      deal_id: deal.deal_id,
      stage: deal.stage,
      expected_value: deal.expected_value,
      notes: policy.maskPII ? maskPII(deal.notes || "") : (deal.notes || "")
    } : null,
    quote_draft,
    approved: ctx.approvals.has(String(tid)),
    log
  };
}

// ---------------------------
// Business logic
function classify(text) {
  const t = text.toLowerCase();
  if (hasAny(t, ["preventivo","offerta","sconto","listino","ordine","quotazione","promo","acquisto"])) return "commerciale";
  if (hasAny(t, ["fattura","pagamento","iban","scadenza","nota di credito","sollecito"])) return "amministrazione";
  if (hasAny(t, ["errore","bug","crash","non funziona","bloccato","timeout","assistenza","setup"])) return "tecnico";
  if (hasAny(t, ["diffida","avvocato","denuncia","privacy","violazione","data breach"])) return "legale";
  return "generale";
}

function scorePriority(text, category) {
  const t = text.toLowerCase();
  if (hasAny(t, ["diffida","denuncia","data breach","violazione","avvocato"])) return "P0";
  if (hasAny(t, ["fermo impianto","produzione ferma","cliente fermo","urgenza massima","entro oggi"])) return "P0";
  if (category === "tecnico" && hasAny(t, ["non funziona","bloccato","crash"])) return "P1";
  if (hasAny(t, ["entro domani","scade","urgente","oggi"])) return "P1";
  return "P2";
}

function proposeAction(category, priority, deal) {
  if (priority === "P0") return { type: "send_external_message", payload: "Escalation immediata + notifica responsabile (demo: bloccabile da policy)." };
  if (category === "tecnico") return { type: "create_internal_ticket", payload: "Apri ticket tecnico L2 e raccogli dettagli (log/errori/foto)." };
  if (category === "amministrazione") return { type: "request_documents", payload: "Richiedi documenti mancanti e verifica scadenza/pagamento." };
  if (category === "legale") return { type: "send_external_message", payload: "Inoltra al legale e prepara risposta formale (demo: bloccabile da policy)." };
  if (category === "commerciale") {
    if (deal && (deal.stage || "").toLowerCase().includes("proposal")) {
      return { type: "draft_quote", payload: "Aggiorna proposta esistente e pianifica follow-up." };
    }
    return { type: "draft_quote", payload: "Prepara bozza preventivo e follow-up commerciale." };
  }
  return { type: "create_internal_note", payload: "Risposta standard o assegnazione a team competente." };
}

function explain(category, priority, deal) {
  let s = `Categoria=${category}. Priorità=${priority} basata su parole chiave e contesto.`;
  if (deal) s += ` Deal collegato=${deal.deal_id} (stage=${deal.stage}).`;
  return s;
}

// ---------------------------
// CRM matching
function matchCustomer(customer_hint, text, customers) {
  if (!customers?.length) return null;
  const hint = (customer_hint || "").toLowerCase();
  const t = (text || "").toLowerCase();

  // 1) match by email in hint/text
  const emailIn = extractEmail(customer_hint) || extractEmail(text);
  if (emailIn) {
    const m = customers.find(c => (c.email || "").toLowerCase() === emailIn.toLowerCase());
    if (m) return m;
  }

  // 2) match by phone
  const phoneIn = extractPhone(customer_hint) || extractPhone(text);
  if (phoneIn) {
    const normalizedPhone = normalizePhone(phoneIn);
    const m = customers.find(c => normalizePhone(c.phone || "") === normalizedPhone);
    if (m) return m;
  }

  // 3) match by company keyword
  const byCompany = (needle) => {
    if (!needle) return null;
    const n = needle.toLowerCase();
    return customers.find(c => (c.company || "").toLowerCase().includes(n) || n.includes((c.company || "").toLowerCase()));
  };
  let m = byCompany(hint);
  if (m) return m;

  // try any company appearing in text (simple scan)
  for (const c of customers) {
    const company = (c.company || "").toLowerCase();
    if (company && (t.includes(company) || hint.includes(company))) return c;
  }
  return null;
}

function findDealForCustomer(customer_id, deals) {
  if (!deals?.length) return null;
  const rank = (stage) => {
    const s = (stage || "").toLowerCase();
    if (s.includes("negotiation")) return 3;
    if (s.includes("proposal")) return 2;
    if (s.includes("qualified")) return 1;
    return 0;
  };
  const candidates = deals.filter(d => String(d.customer_id) === String(customer_id));
  if (!candidates.length) return null;
  candidates.sort((a,b) => rank(b.stage) - rank(a.stage));
  return candidates[0];
}

// ---------------------------
// Quote drafting (demo rules)
function buildQuoteDraft({ ticket_id, customer, deal, text, products, policy, log }) {
  const t = text.toLowerCase();

  // quantity heuristic (e.g., "5 pezzi")
  const qty = extractQuantity(t) || 1;

  const findBySku = (sku) => products.find(p => String(p.sku).toLowerCase() === String(sku).toLowerCase());
  const findByNameIncludes = (kw) => products.find(p => (p.name || "").toLowerCase().includes(kw.toLowerCase()));

  const lines = [];

  if (hasAny(t, ["basic 224", "smontagomme"])) {
    const p = findBySku("P1001") || findByNameIncludes("basic 224") || findByNameIncludes("smontagomme");
    if (p) lines.push(makeLine(p, qty));
    const helper = findBySku("P1002") || findByNameIncludes("helper");
    if (helper) lines.push(makeLine(helper, qty));
  }

  if (hasAny(t, ["gonfiatore","ge 23"])) {
    const p = findBySku("P2001") || findByNameIncludes("ge 23") || findByNameIncludes("gonfiatore");
    if (p) lines.push(makeLine(p, 1));
  }

  if (hasAny(t, ["secure cage","gabbia","sicurezza"])) {
    const p = findBySku("P3001") || findByNameIncludes("secure cage") || findByNameIncludes("gabbia");
    if (p) lines.push(makeLine(p, 1));
  }

  if (!lines.length) {
    log.push("QUOTE: no product inference → draft skipped");
    return null;
  }

  // discount heuristic
  let discountPct = 0;
  if (hasAny(t, ["sconto","promo"]) && qty >= 5) discountPct = 5;
  if (!discountPct && deal && Number(deal.expected_value || 0) >= 5000) discountPct = 2;

  for (const ln of lines) {
    ln.discount_pct = discountPct;
    ln.net_unit_after_discount = round2(ln.net_unit * (1 - discountPct / 100));
    ln.net_total = round2(ln.net_unit_after_discount * ln.qty);
  }

  const total_net = round2(lines.reduce((s, ln) => s + ln.net_total, 0));
  const quote_id = `Q-${ticket_id}-${Date.now().toString(36).slice(-6).toUpperCase()}`;

  const notes = [
    "Bozza demo generata automaticamente.",
    discountPct ? `Sconto demo applicato: ${discountPct}%.` : "Nessuno sconto demo applicato.",
    deal ? `Collegato a deal ${deal.deal_id} (stage: ${deal.stage}).` : "Nessun deal collegato."
  ].join(" ");

  return {
    quote_id,
    ticket_id,
    customer_id: customer.customer_id,
    customer_company: policy.maskPII ? maskPII(customer.company) : customer.company,
    lines,
    total_net,
    notes: policy.maskPII ? maskPII(notes) : notes
  };
}

function makeLine(product, qty) {
  const net = Number(product.net_price || 0);
  return {
    sku: product.sku,
    name: product.name,
    qty: Number(qty || 1),
    net_unit: round2(net),
    discount_pct: 0,
    net_unit_after_discount: round2(net),
    net_total: round2(net * Number(qty || 1)),
    vat: Number(product.vat || 0),
  };
}

// ---------------------------
// Rendering
function renderAll() {
  renderTickets();
  renderCRM();
  renderQuotes();
  renderReportPreview();
}

function renderTickets() {
  const body = $("ticketsBody");
  body.innerHTML = "";

  const report = state.report;
  const items = report?.items || [];

  renderTicketKPIs(items);

  if (!items.length) {
    body.innerHTML = `<tr><td colspan="8" class="muted">Nessun output. Carica dati e premi “Esegui agente”.</td></tr>`;
    return;
  }

  for (const it of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(it.ticket_id)}</td>
      <td>${esc(it.channel || "")}</td>
      <td>
        ${esc(it.customer_display || "")}
        ${it.customer_match ? `<div class="muted"><code>${esc(it.customer_match.customer_id)}</code> • ${esc(it.customer_match.city || "")} • ${esc(it.customer_match.segment || "")}</div>` : `<div class="muted">no match</div>`}
      </td>
      <td>${esc(it.category)}</td>
      <td>${priorityPill(it.priority)} ${it.priority==="P0" ? (it.approved ? `<span class="pill p2">approved</span>` : `<span class="pill p1">pending</span>`) : ""}</td>
      <td>
        <code>${esc(it.action.type)}</code>
        <div class="muted">${esc(it.action.payload || "")}</div>
        ${it.quote_draft ? `<div class="muted">Quote: <code>${esc(it.quote_draft.quote_id)}</code> • Tot ${fmtEUR(it.quote_draft.total_net)}</div>` : ``}
      </td>
      <td>${esc(it.reason)}</td>
      <td>
        <div class="actions">
          ${it.priority === "P0" ? `<button data-approve="${esc(it.ticket_id)}" class="primary">${it.approved ? "Revoca" : "Approva P0"}</button>` : ``}
          ${it.quote_draft ? `<button data-openquote="${esc(it.quote_draft.quote_id)}">Apri preventivo</button>` : ``}
          <details>
            <summary>log</summary>
            <pre>${esc(it.log.join("\n"))}</pre>
          </details>
        </div>
      </td>
    `;
    body.appendChild(tr);
  }

  // bind buttons
  body.querySelectorAll("button[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-approve");
      if (state.approvals.has(id)) state.approvals.delete(id);
      else state.approvals.add(id);
      setRunStatus(`Aggiornata approvazione per ticket ${id}. Ora riesegui l’agente per applicare l’azione.`);
      renderTickets();
    });
  });

  body.querySelectorAll("button[data-openquote]").forEach(btn => {
    btn.addEventListener("click", () => {
      const qid = btn.getAttribute("data-openquote");
      state.selectedQuoteId = qid;
      document.querySelector('.tab[data-tab="quotes"]').click();
      renderQuotes();
      renderQuoteDetail(qid);
    });
  });
}

function renderTicketKPIs(items) {
  const el = $("kpiTickets");
  if (!items?.length) {
    el.innerHTML = "";
    return;
  }
  const stats = summarize(items);
  el.innerHTML = `
    <span class="pill">Totale: ${stats.total}</span>
    <span class="pill p0">P0: ${stats.p0}</span>
    <span class="pill p1">P1: ${stats.p1}</span>
    <span class="pill p2">P2: ${stats.p2}</span>
    <span class="pill">Commerciale: ${stats.cat_commerciale}</span>
    <span class="pill">Tecnico: ${stats.cat_tecnico}</span>
    <span class="pill">Amm.: ${stats.cat_amministrazione}</span>
    <span class="pill">Legale: ${stats.cat_legale}</span>
  `;
}

function renderCRM() {
  const cb = $("customersBody");
  cb.innerHTML = "";
  if (!state.customers.length) {
    cb.innerHTML = `<tr><td colspan="7" class="muted">Nessun cliente caricato.</td></tr>`;
  } else {
    const policy = getPolicy();
    for (const c of state.customers) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${esc(c.customer_id || "")}</code></td>
        <td>${esc(policy.maskPII ? maskPII(c.company || "") : (c.company || ""))}</td>
        <td>${esc(policy.maskPII ? maskPII(c.contact || "") : (c.contact || ""))}</td>
        <td>${esc(policy.maskPII ? maskPII(c.email || "") : (c.email || ""))}</td>
        <td>${esc(policy.maskPII ? maskPII(c.phone || "") : (c.phone || ""))}</td>
        <td>${esc(c.city || "")}</td>
        <td>${esc(c.segment || "")}</td>
      `;
      cb.appendChild(tr);
    }
  }

  const db = $("dealsBody");
  db.innerHTML = "";
  if (!state.deals.length) {
    db.innerHTML = `<tr><td colspan="5" class="muted">Nessuna opportunità caricata.</td></tr>`;
  } else {
    const policy = getPolicy();
    for (const d of state.deals) {
      const cust = state.customers.find(c => String(c.customer_id) === String(d.customer_id));
      const custName = cust ? (cust.company || d.customer_id) : (d.customer_id || "");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${esc(d.deal_id || "")}</code></td>
        <td>${esc(policy.maskPII ? maskPII(custName) : custName)}</td>
        <td>${esc(d.stage || "")}</td>
        <td>${esc(d.expected_value || "")}</td>
        <td>${esc(policy.maskPII ? maskPII(d.notes || "") : (d.notes || ""))}</td>
      `;
      db.appendChild(tr);
    }
  }
}

function renderQuotes() {
  const qb = $("quotesBody");
  qb.innerHTML = "";
  const quotes = state.quotes || [];
  $("quotesEmpty").style.display = quotes.length ? "none" : "block";

  if (!quotes.length) return;

  for (const q of quotes) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td><code>${esc(q.quote_id)}</code></td>
      <td><code>${esc(q.ticket_id)}</code></td>
      <td>${esc(q.customer_company || "")}</td>
      <td>${q.lines.length}</td>
      <td>${fmtEUR(q.total_net)}</td>
      <td class="muted">${esc(q.notes || "")}</td>
      <td class="actions">
        <button data-qexport="${esc(q.quote_id)}">Export JSON</button>
      </td>
    `;
    tr.addEventListener("click", () => {
      state.selectedQuoteId = q.quote_id;
      renderQuoteDetail(q.quote_id);
    });
    qb.appendChild(tr);
  }

  qb.querySelectorAll("button[data-qexport]").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const qid = btn.getAttribute("data-qexport");
      const q = state.quotes.find(x => x.quote_id === qid);
      if (!q) return;
      const blob = new Blob([JSON.stringify(q, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `quote_${qid}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });

  if (state.selectedQuoteId) renderQuoteDetail(state.selectedQuoteId);
}

function renderQuoteDetail(quoteId) {
  const el = $("quoteDetail");
  const q = state.quotes.find(x => x.quote_id === quoteId);
  if (!q) {
    el.textContent = "Seleziona una bozza per vedere le righe prodotto.";
    return;
  }
  const rows = q.lines.map(ln => `
    <tr>
      <td><code>${esc(ln.sku)}</code></td>
      <td>${esc(ln.name)}</td>
      <td>${ln.qty}</td>
      <td>${fmtEUR(ln.net_unit)}</td>
      <td>${ln.discount_pct}%</td>
      <td>${fmtEUR(ln.net_unit_after_discount)}</td>
      <td>${fmtEUR(ln.net_total)}</td>
    </tr>
  `).join("");

  el.innerHTML = `
    <div class="muted">Quote: <code>${esc(q.quote_id)}</code> • Ticket: <code>${esc(q.ticket_id)}</code></div>
    <div class="muted">Cliente: ${esc(q.customer_company || "")}</div>
    <div class="hr"></div>
    <table>
      <thead>
        <tr>
          <th>SKU</th><th>Prodotto</th><th>Q.tà</th><th>Net unit</th><th>Sconto</th><th>Net unit scont.</th><th>Totale</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="kpi" style="margin-top:10px">
      <span class="pill">Totale netto: <b>${fmtEUR(q.total_net)}</b></span>
    </div>
  `;
}

function renderReportPreview() {
  const ta = $("reportPreview");
  if (!state.report) {
    ta.value = "";
    ta.placeholder = "Esegui l’agente per generare il report...";
    return;
  }
  ta.value = JSON.stringify(state.report, null, 2);
}

// ---------------------------
// Quotes merge
function mergeQuotes(newQuotes) {
  if (!newQuotes?.length) return;
  const existingIds = new Set(state.quotes.map(q => q.quote_id));
  const existingTicketIds = new Set(state.quotes.map(q => q.ticket_id));
  for (const q of newQuotes) {
    if (existingIds.has(q.quote_id)) continue;
    if (existingTicketIds.has(q.ticket_id)) continue;
    state.quotes.push(q);
  }
}

// ---------------------------
// Status helpers
function setDataStatus() {
  const s = `Ticket: ${state.tickets.length} • Clienti: ${state.customers.length} • Prodotti: ${state.products.length} • Deals: ${state.deals.length}`;
  $("dataStatus").textContent = s;
}
function setRunStatus(msg) {
  $("runStatus").textContent = msg;
}

// ---------------------------
// Stats
function summarize(items) {
  const s = {
    total: items.length,
    p0: 0, p1: 0, p2: 0,
    cat_tecnico: 0, cat_commerciale: 0, cat_amministrazione: 0, cat_legale: 0, cat_generale: 0
  };
  for (const it of items) {
    if (it.priority === "P0") s.p0++;
    else if (it.priority === "P1") s.p1++;
    else s.p2++;
    s[`cat_${it.category}`] = (s[`cat_${it.category}`] || 0) + 1;
  }
  return s;
}

// ---------------------------
// Utilities
function parseCSV(csvText) {
  const txt = (csvText || "").trim();
  if (!txt) return [];
  const lines = txt.split(/\r?\n/);
  const header = splitCSVLine(lines[0]).map(h => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCSVLine(line);
    const row = {};
    header.forEach((h, idx) => row[h] = (cols[idx] ?? "").trim());
    out.push(row);
  }
  return out;
}

function splitCSVLine(line) {
  const res = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      res.push(cur); cur = "";
    } else cur += ch;
  }
  res.push(cur);
  return res;
}

function normalize(s){ return String(s || "").replace(/\s+/g," ").trim(); }
function hasAny(text, arr) { return arr.some(w => text.includes(w)); }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m] || m));
}
function priorityPill(p) {
  const cls = p === "P0" ? "pill p0" : (p === "P1" ? "pill p1" : "pill p2");
  return `<span class="${cls}">${esc(p)}</span>`;
}
function fmtEUR(n) {
  const v = Number(n || 0);
  return v.toLocaleString("it-IT", { style:"currency", currency:"EUR" });
}
function round2(n){ return Math.round((Number(n||0) + Number.EPSILON) * 100) / 100; }

function maskPII(s) {
  return String(s || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[email]")
    .replace(/\b(\+?\d[\d\s\-]{7,}\d)\b/g, "[tel]");
}

function extractEmail(s) {
  const m = String(s || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}
function extractPhone(s) {
  const m = String(s || "").match(/\+?\d[\d\s\-]{7,}\d/);
  return m ? m[0] : null;
}
function normalizePhone(s) {
  return String(s || "").replace(/[^\d+]/g,"");
}
function extractQuantity(t) {
  const m1 = t.match(/\bn\.?\s*(\d+)\b/);
  if (m1) return Number(m1[1]);
  const m2 = t.match(/\b(\d+)\s*(pz|pezzi|pieces)\b/);
  if (m2) return Number(m2[1]);
  return null;
}

function llmStubSummarize(subject, body) {
  const s = normalize(subject);
  const b = normalize(body);
  const base = s || b;
  if (!base) return "Nessun contenuto rilevante.";
  return base.length > 140 ? base.slice(0, 140) + "…" : base;
}

// Initial paint
setDataStatus();
renderAll();
setRunStatus("Carica i CSV (o usa “Carica dataset demo”), poi esegui l’agente.");
