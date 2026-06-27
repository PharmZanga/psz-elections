(function () {
  const settings = window.PSZ_ELECTIONS_CONFIG || {};
  const storageKeys = {
    votes: "pszElectionVotes",
    register: "pszElectionRegister",
    session: "pszElectionSession"
  };
  const state = {
    session: readJson(storageKeys.session, null),
    register: readJson(storageKeys.register, []),
    votes: readJson(storageKeys.votes, []),
    filteredRows: []
  };

  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");
  const workspace = document.querySelector("[data-workspace]");
  const voterPanel = document.querySelector("[data-voter-panel]");
  const adminPanel = document.querySelector("[data-admin-panel]");
  const sessionLabel = document.querySelector("[data-session-label]");
  const sessionTitle = document.querySelector("[data-session-title]");
  const adminRows = document.querySelector("[data-admin-rows]");

  setupNavigation();
  setupRoutes();
  setupLoginTabs();
  setupLoginForms();
  setupVoting();
  setupAdminTools();
  setupEmailForms();
  restoreSession();
  refreshDashboard();

  function setupRoutes() {
    document.querySelectorAll("[data-route]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const route = link.getAttribute("data-route") || "home";
        showView(route);
      });
    });

    window.addEventListener("hashchange", () => {
      showView(getRouteFromHash(), { updateHash: false });
    });

    showView(getRouteFromHash(), { updateHash: false });
  }

  function showView(route, options = {}) {
    const nextRoute = document.querySelector(`[data-view="${route}"]`) ? route : "home";
    document.querySelectorAll("[data-view]").forEach((screen) => {
      screen.classList.toggle("is-active-view", screen.getAttribute("data-view") === nextRoute);
    });
    document.querySelectorAll("[data-route]").forEach((link) => {
      link.classList.toggle("is-current", link.getAttribute("data-route") === nextRoute);
    });
    if (options.updateHash !== false) {
      history.pushState(null, "", `#${nextRoute}`);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function getRouteFromHash() {
    return window.location.hash.replace("#", "") || "home";
  }

  function setupNavigation() {
    if (!menuButton || !nav) return;

    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        nav.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  function setupLoginTabs() {
    document.querySelectorAll("[data-login-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-login-tab");
        document.querySelectorAll("[data-login-tab]").forEach((node) => {
          node.classList.toggle("is-active", node === tab);
        });
        document.querySelectorAll("[data-login-form]").forEach((form) => {
          form.classList.toggle("is-hidden", form.getAttribute("data-login-form") !== target);
        });
      });
    });
  }

  function setupLoginForms() {
    document.querySelectorAll("[data-login-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const formType = form.getAttribute("data-login-form");
        const data = Object.fromEntries(new FormData(form).entries());
        const status = form.querySelector("[data-status]");

        if (formType === "admin") {
          const expectedCode = settings.adminAccessCode || "PSZ2026";
          if (String(data.code || "").trim() !== expectedCode) {
            setStatus(status, "Invalid administrator access code.");
            return;
          }
          startSession({ role: "admin", email: normalizeEmail(data.email) });
          setStatus(status, "Dashboard opened.");
          return;
        }

        const email = normalizeEmail(data.email);
        const registered = findRegisteredVoter(email);
        if (state.register.length > 0 && !registered) {
          setStatus(status, "This email is not in the uploaded voter register. Contact the elections desk for verification.");
          return;
        }

        startSession({
          role: "voter",
          email,
          memberId: String(data.memberId || "").trim(),
          name: registered ? registered.name : email
        });
        setStatus(status, "Login successful. Ballot ready.");
      });
    });

    document.querySelector("[data-logout]")?.addEventListener("click", () => {
      state.session = null;
      localStorage.removeItem(storageKeys.session);
      workspace?.classList.remove("is-active-view");
      voterPanel?.classList.add("is-hidden");
      adminPanel?.classList.add("is-hidden");
      showView("login");
    });
  }

  function setupVoting() {
    document.querySelector("[data-vote-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = document.querySelector("[data-vote-status]");
      const session = state.session;
      if (!session || session.role !== "voter") {
        setStatus(status, "Please log in as a voter first.");
        return;
      }

      if (state.votes.some((vote) => vote.email === session.email)) {
        setStatus(status, "A vote has already been recorded for this email.");
        return;
      }

      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const vote = {
        email: session.email,
        name: session.name || session.email,
        candidate: data.candidate,
        timestamp: new Date().toISOString(),
        source: settings.backend?.supabaseUrl ? "supabase" : "demo-local"
      };

      setStatus(status, "Recording vote...");
      try {
        await saveVote(vote);
        state.votes.push(vote);
        writeJson(storageKeys.votes, state.votes);
        setStatus(status, "Thank you. Your vote has been recorded.");
        event.currentTarget.reset();
        refreshDashboard();
      } catch (error) {
        console.error(error);
        setStatus(status, "The vote could not be recorded. Please contact the elections desk.");
      }
    });
  }

  function setupAdminTools() {
    document.querySelector("[data-register-upload]")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      state.register = parseCsv(text).map((row, index) => normalizeRegisterRow(row, index)).filter((row) => row.email);
      writeJson(storageKeys.register, state.register);
      refreshDashboard();
    });

    document.querySelector("[data-vote-upload]")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      state.votes = parseCsv(text).map(normalizeVoteRow).filter((row) => row.email);
      writeJson(storageKeys.votes, state.votes);
      refreshDashboard();
    });

    document.querySelector("[data-admin-search]")?.addEventListener("input", refreshDashboard);
    document.querySelector("[data-status-filter]")?.addEventListener("change", refreshDashboard);
    document.querySelector("[data-export-report]")?.addEventListener("click", exportAuditCsv);
  }

  function setupEmailForms() {
    const emailSettings = settings.email || {};
    if (emailSettings.publicKey && window.emailjs) {
      window.emailjs.init({ publicKey: emailSettings.publicKey });
    }

    document.querySelectorAll("[data-email-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = form.querySelector("[data-status]");
        const button = form.querySelector("button[type='submit']");
        const data = Object.fromEntries(new FormData(form).entries());
        const subject = `PSZ Elections enquiry: ${data.requestType || "General enquiry"}`;
        setStatus(status, "Preparing email request...");
        button.disabled = true;

        try {
          if (isEmailJsReady(emailSettings)) {
            await window.emailjs.send(emailSettings.serviceId, emailSettings.contactTemplateId, {
              ...data,
              subject,
              election_email: settings.electionEmail,
              page_url: window.location.href
            });
            setStatus(status, "Email request sent successfully.");
            form.reset();
          } else {
            openMailto(settings.electionEmail, subject, data);
            setStatus(status, "Your email app has been opened with the request ready to send.");
          }
        } catch (error) {
          console.error(error);
          openMailto(settings.electionEmail, subject, data);
          setStatus(status, "Email service was unavailable, so your email app has been opened instead.");
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function startSession(session) {
    state.session = session;
    writeJson(storageKeys.session, session);
    restoreSession();
    showView("workspace");
  }

  function restoreSession() {
    if (!state.session) return;
    voterPanel?.classList.toggle("is-hidden", state.session.role !== "voter");
    adminPanel?.classList.toggle("is-hidden", state.session.role !== "admin");
    sessionLabel.textContent = state.session.role === "admin" ? "Administrator Dashboard" : "Voter Workspace";
    sessionTitle.textContent = state.session.role === "admin" ? "Register and turnout monitor" : `Welcome, ${state.session.name || state.session.email}`;
  }

  function refreshDashboard() {
    const rows = buildAuditRows();
    const search = document.querySelector("[data-admin-search]")?.value.trim().toLowerCase() || "";
    const filter = document.querySelector("[data-status-filter]")?.value || "all";
    const filtered = rows.filter((row) => {
      const matchesSearch = !search || [row.name, row.email, row.status].join(" ").toLowerCase().includes(search);
      const matchesFilter = filter === "all" || row.status === filter;
      return matchesSearch && matchesFilter;
    });
    state.filteredRows = filtered;

    const registered = state.register.length || Number(settings.totalVoters || 0);
    const votedInRegister = rows.filter((row) => row.status === "voted").length;
    const outside = rows.filter((row) => row.status === "outside").length;
    setMetric("registered", registered);
    setMetric("voted", votedInRegister);
    setMetric("pending", Math.max(registered - votedInRegister, 0));
    setMetric("outside", outside);
    updateCounter(votedInRegister, registered);
    renderAdminRows(filtered);
  }

  function buildAuditRows() {
    const voteMap = new Map(state.votes.map((vote) => [vote.email, vote]));
    const registerRows = state.register.map((voter) => {
      const vote = voteMap.get(voter.email);
      return {
        name: voter.name,
        email: voter.email,
        status: vote ? "voted" : "pending",
        timestamp: vote?.timestamp || ""
      };
    });
    const registerEmails = new Set(state.register.map((voter) => voter.email));
    const outsideRows = state.votes
      .filter((vote) => !registerEmails.has(vote.email))
      .map((vote) => ({
        name: vote.name || "Unregistered vote",
        email: vote.email,
        status: "outside",
        timestamp: vote.timestamp || ""
      }));
    return [...registerRows, ...outsideRows];
  }

  function renderAdminRows(rows) {
    if (!adminRows) return;
    if (rows.length === 0) {
      adminRows.innerHTML = `<tr><td colspan="4">${state.register.length ? "No matching records." : "Upload the register to begin."}</td></tr>`;
      return;
    }

    adminRows.innerHTML = rows.slice(0, 300).map((row) => `
      <tr>
        <td>${escapeHtml(row.name || "")}</td>
        <td>${escapeHtml(row.email || "")}</td>
        <td><span class="status-pill status-${row.status}">${labelize(row.status)}</span></td>
        <td>${row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"}</td>
      </tr>
    `).join("");
  }

  async function saveVote(vote) {
    const backend = settings.backend || {};
    if (!backend.supabaseUrl || !backend.supabaseAnonKey) return;

    const response = await fetch(`${backend.supabaseUrl.replace(/\/$/, "")}/rest/v1/votes`, {
      method: "POST",
      headers: {
        apikey: backend.supabaseAnonKey,
        Authorization: `Bearer ${backend.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        email: vote.email,
        name: vote.name,
        candidate: vote.candidate,
        timestamp: vote.timestamp
      })
    });

    if (!response.ok) {
      throw new Error(`Backend vote save failed: ${response.status}`);
    }
  }

  function exportAuditCsv() {
    const rows = state.filteredRows.length ? state.filteredRows : buildAuditRows();
    const csv = toCsv(rows.map((row) => ({
      name: row.name,
      email: row.email,
      status: row.status,
      vote_time: row.timestamp
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "psz-election-audit-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function normalizeRegisterRow(row, index) {
    const email = normalizeEmail(row.email || row.Email || row.EMAIL || row.mail || "");
    const name = [
      row.title || row.Title,
      row.first_name || row.firstname || row.firstName || row.FirstName,
      row.last_name || row.lastname || row.lastName || row.LastName
    ].filter(Boolean).join(" ").trim();
    return {
      id: row.sn || row.SN || row["S/N"] || String(index + 1),
      name: name || row.name || row.Name || email,
      email
    };
  }

  function normalizeVoteRow(row) {
    return {
      email: normalizeEmail(row.email || row.Email || row.EMAIL || ""),
      name: row.name || row.Name || "",
      timestamp: row.timestamp || row.Timestamp || row.vote_time || row["Vote time"] || "",
      candidate: row.candidate || row.Candidate || ""
    };
  }

  function parseCsv(text) {
    const rows = [];
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return rows;
    const headers = splitCsvLine(lines[0]).map((header) => header.trim());
    for (const line of lines.slice(1)) {
      const values = splitCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
    return rows;
  }

  function splitCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    values.push(value);
    return values;
  }

  function toCsv(rows) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((header) => csvEscape(row[header] || "")).join(","));
    });
    return lines.join("\n");
  }

  function csvEscape(value) {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function findRegisteredVoter(email) {
    return state.register.find((voter) => voter.email === email);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function updateCounter(voted, total) {
    const turnout = total > 0 ? ((voted / total) * 100).toFixed(1) : "0.0";
    document.querySelectorAll("[data-votes-cast]").forEach((node) => {
      node.textContent = String(voted);
    });
    document.querySelectorAll("[data-voters-cast-label]").forEach((node) => {
      node.textContent = String(voted);
    });
    document.querySelectorAll("[data-total-voters]").forEach((node) => {
      node.textContent = String(total);
    });
    document.querySelectorAll("[data-turnout]").forEach((node) => {
      node.textContent = `${turnout}% Turnout`;
    });
  }

  function setMetric(name, value) {
    const node = document.querySelector(`[data-metric="${name}"]`);
    if (node) node.textContent = String(value);
  }

  function isEmailJsReady(config) {
    return Boolean(window.emailjs && config.publicKey && config.serviceId && config.contactTemplateId);
  }

  function openMailto(to, subject, data) {
    const body = Object.entries(data)
      .filter(([, value]) => String(value).trim() !== "")
      .map(([key, value]) => `${labelize(key)}: ${value}`)
      .join("\n\n");
    window.location.href = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setStatus(node, message) {
    if (node) node.textContent = message;
  }

  function labelize(value) {
    return String(value)
      .replace(/[-_]/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
