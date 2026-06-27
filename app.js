(function () {
  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");
  const settings = window.PSZ_ELECTIONS_CONFIG || {};
  const emailSettings = settings.email || {};
  const electionEmail = settings.electionEmail || "elections@psz.org.zm";
  const votesCast = Number(settings.votesCast || 2);
  const totalVoters = Number(settings.totalVoters || 476);

  const turnout = totalVoters > 0 ? ((votesCast / totalVoters) * 100).toFixed(1) : "0.0";

  document.querySelectorAll("[data-votes-cast]").forEach((node) => {
    node.textContent = String(votesCast);
  });
  document.querySelectorAll("[data-voters-cast-label]").forEach((node) => {
    node.textContent = String(votesCast);
  });
  document.querySelectorAll("[data-total-voters]").forEach((node) => {
    node.textContent = String(totalVoters);
  });
  document.querySelectorAll("[data-turnout]").forEach((node) => {
    node.textContent = `${turnout}% Turnout`;
  });

  if (menuButton && nav) {
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

  if (emailSettings.publicKey && window.emailjs) {
    window.emailjs.init({ publicKey: emailSettings.publicKey });
  }

  document.querySelectorAll("[data-email-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-status]");
      const button = form.querySelector("button[type='submit']");
      const formType = form.getAttribute("data-email-form");
      const data = Object.fromEntries(new FormData(form).entries());
      const subject = formType === "reset"
        ? "PSZ Elections password reset request"
        : `PSZ Elections enquiry: ${data.requestType || "General enquiry"}`;

      setStatus(status, "Preparing email request...");
      button.disabled = true;

      try {
        if (isEmailJsReady(emailSettings, formType)) {
          await window.emailjs.send(
            emailSettings.serviceId,
            formType === "reset" ? emailSettings.resetTemplateId : emailSettings.contactTemplateId,
            {
              ...data,
              subject,
              election_email: electionEmail,
              page_url: window.location.href
            }
          );
          setStatus(status, "Email request sent successfully.");
          form.reset();
        } else {
          openMailto(electionEmail, subject, data);
          setStatus(status, "Your email app has been opened with the request ready to send.");
        }
      } catch (error) {
        console.error(error);
        openMailto(electionEmail, subject, data);
        setStatus(status, "Email service was unavailable, so your email app has been opened instead.");
      } finally {
        button.disabled = false;
      }
    });
  });

  function isEmailJsReady(config, formType) {
    const templateKey = formType === "reset" ? "resetTemplateId" : "contactTemplateId";
    return Boolean(window.emailjs && config.publicKey && config.serviceId && config[templateKey]);
  }

  function openMailto(to, subject, data) {
    const body = Object.entries(data)
      .filter(([, value]) => String(value).trim() !== "")
      .map(([key, value]) => `${labelize(key)}: ${value}`)
      .join("\n\n");
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  function setStatus(node, message) {
    if (node) {
      node.textContent = message;
    }
  }

  function labelize(value) {
    return value
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());
  }
})();
