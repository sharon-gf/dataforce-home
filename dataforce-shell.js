(function () {
  "use strict";

  const HOME_URL = "https://dataforce.gsaforce.com/";
  const DEFAULT_API_BASE = "https://dataforce-api-production.up.railway.app";
  const SCRIPT_URL = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
  const DEFAULT_LOGO_URL = SCRIPT_URL ? new URL("dataforce-logo.png", SCRIPT_URL).href : "dataforce-logo.png";
  const DEFAULT_FAVICON_HREF = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='4'%20fill='%231a56db'/%3E%3Cpath%20d='M20%205h7v7h-4v8H12v4H5V13h11V9h4z'%20fill='white'/%3E%3Cpath%20d='M13%208h8v8h-4v4H9v-8h4z'%20fill='%237aaed5'%20opacity='.75'/%3E%3C/svg%3E";

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function cfg() {
    return window.DATAFORCE_SHELL || {};
  }

  function ensureFavicon() {
    if (document.querySelector("link[rel~='icon']")) return;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = cfg().faviconHref || DEFAULT_FAVICON_HREF;
    document.head.appendChild(icon);
  }

  function first(selectors, root) {
    const base = root || document;
    for (const selector of selectors) {
      const node = base.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function allFrom(selectors, root) {
    const nodes = [];
    const seen = new Set();
    const base = root || document;
    for (const selector of selectors || []) {
      base.querySelectorAll(selector).forEach((node) => {
        if (!seen.has(node) && !node.closest(".df-shell-header")) {
          seen.add(node);
          nodes.push(node);
        }
      });
    }
    return nodes;
  }

  function readUser() {
    try {
      if (typeof window.getDataforceUser === "function") return window.getDataforceUser() || {};
    } catch (e) {}
    try {
      return JSON.parse(sessionStorage.getItem("df_user") || "{}");
    } catch (e) {
      return {};
    }
  }

  function displayName() {
    const user = readUser();
    return user.name || user.email || "";
  }

  function defaultSignOut() {
    sessionStorage.removeItem("df_user");
    sessionStorage.removeItem("df_permissions");
    window.location.href = HOME_URL;
  }

  function makeLogo(oldHeader) {
    const link = document.createElement("a");
    link.className = "df-shell-logo";
    link.href = HOME_URL;
    link.setAttribute("aria-label", "Back to DATAFORCE home");

    const img = document.createElement("img");
    img.src = cfg().logoSrc || DEFAULT_LOGO_URL;
    img.alt = "DATAFORCE";
    img.onerror = function () {
      img.remove();
      if (!link.querySelector(".df-shell-logo-fallback")) link.appendChild(makeLogoFallback());
    };
    link.appendChild(img);
    return link;
  }

  function makeLogoFallback() {
    const fallback = document.createElement("span");
    fallback.className = "df-shell-logo-fallback";
    fallback.innerHTML = [
      "<span class=\"df-shell-mark\">DF</span>",
      "<span><span class=\"df-shell-word-main\">DATAFORCE</span>",
      "<span class=\"df-shell-word-sub\">GSA FORCE</span></span>"
    ].join("");
    return fallback;
  }

  function makeUser(oldHeader) {
    const wrapper = document.createElement("div");
    wrapper.className = "df-shell-user";

    let userNode = null;
    if (cfg().userNameId) userNode = document.getElementById(cfg().userNameId);
    if (!userNode) userNode = first(["#userLabel", "#userName", "#user-name", ".user-info span"], oldHeader);
    if (!userNode) {
      userNode = document.createElement("span");
      if (cfg().userNameId) userNode.id = cfg().userNameId;
    }
    userNode.classList.add("df-shell-user-name");
    if (!userNode.textContent.trim()) userNode.textContent = displayName();
    wrapper.appendChild(userNode);

    let statusNode = first([".status", ".conn-badge"], oldHeader);
    if (!statusNode) {
      const connDot = oldHeader.querySelector("#connDot");
      const connLabel = oldHeader.querySelector("#connLabel");
      if (connDot && connLabel) {
        statusNode = document.createElement("span");
        statusNode.append(connDot, connLabel);
      }
    }
    if (!statusNode) {
      statusNode = document.createElement("span");
      statusNode.className = "df-shell-status";
      const dot = document.createElement("span");
      dot.className = "df-shell-dot ready";
      if (cfg().statusDotId) dot.id = cfg().statusDotId;
      const text = document.createElement("span");
      if (cfg().statusTextId) text.id = cfg().statusTextId;
      text.textContent = cfg().statusText || "Ready";
      statusNode.append(dot, text);
    }
    statusNode.classList.add("df-shell-status");
    wrapper.appendChild(statusNode);

    let signout = first(["button[onclick*='signOut']", ".logout", ".logout-btn"], oldHeader);
    if (!signout) {
      signout = document.createElement("button");
      signout.type = "button";
      signout.textContent = "Sign out";
    }
    signout.classList.add("df-shell-signout");
    signout.addEventListener("click", function (event) {
      if (signout.getAttribute("onclick")) return;
      event.preventDefault();
      if (typeof window.signOut === "function") window.signOut();
      else defaultSignOut();
    });
    wrapper.appendChild(signout);

    return wrapper;
  }

  function makeTitle(oldHeader) {
    const title = document.createElement("h1");
    title.className = "df-shell-title";
    const existing = first([
      ".header-title",
      ".hdr-module-name",
      ".hdr-title-2",
      ".page-title"
    ], oldHeader);
    title.textContent = cfg().title || (existing ? existing.textContent : "");
    return title;
  }

  function appendNodes(slot, nodes) {
    nodes.forEach((node) => {
      if (node.parentElement) node.parentElement.removeChild(node);
      slot.appendChild(node);
    });
  }

  function ensureHiddenLastUpdate() {
    if (document.getElementById("lastUpdateLabel")) return;
    const hidden = document.createElement("span");
    hidden.id = "lastUpdateLabel";
    hidden.className = "df-shell-hidden";
    hidden.textContent = "-";
    document.body.appendChild(hidden);
  }

  function buildHeader() {
    const settings = cfg();
    if (settings.disabled) return;

    const oldHeader = document.querySelector(settings.headerSelector || "header, .header");
    if (!oldHeader || oldHeader.classList.contains("df-shell-header")) return;

    const header = document.createElement("header");
    header.className = "df-shell-header";

    const top = document.createElement("div");
    top.className = "df-shell-top";
    top.append(makeLogo(oldHeader), makeTitle(oldHeader), makeUser(oldHeader));

    const sub = document.createElement("div");
    sub.className = "df-shell-sub";

    const controls = document.createElement("div");
    controls.className = "df-shell-controls";
    appendNodes(controls, allFrom(settings.controls || [], oldHeader));

    const meta = document.createElement("div");
    meta.className = "df-shell-meta";
    appendNodes(meta, allFrom(settings.meta || [], oldHeader));

    sub.append(controls, meta);
    header.append(top, sub);
    oldHeader.replaceWith(header);
    ensureHiddenLastUpdate();
    syncUserName();
  }

  function syncUserName() {
    const name = displayName();
    if (!name) return;
    document.querySelectorAll(".df-shell-user-name").forEach((node) => {
      if (!node.textContent.trim()) node.textContent = name;
    });
  }

  function formatRefresh(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function apiBase() {
    try {
      if (typeof API_BASE !== "undefined" && API_BASE) return API_BASE;
    } catch (e) {}
    return DEFAULT_API_BASE;
  }

  function apiKey() {
    try {
      if (typeof API_KEY !== "undefined") return API_KEY;
    } catch (e) {}
    return "";
  }

  async function loadFooterStatus() {
    const value = document.getElementById("dfShellRefreshValue");
    const oldLabel = document.getElementById("lastUpdateLabel");
    if (!value) return;

    try {
      const headers = {};
      const key = apiKey();
      if (key) headers["x-api-key"] = key;
      const response = await fetch(`${apiBase()}/api/status`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const formatted = formatRefresh(data.last_upload_at);
      value.textContent = formatted;
      if (oldLabel) oldLabel.textContent = formatted;
    } catch (e) {
      value.textContent = "Unable to load";
    }
  }

  function buildFooter() {
    if (document.getElementById("dfShellFooter")) return;
    const footer = document.createElement("footer");
    footer.id = "dfShellFooter";
    footer.className = "df-shell-footer";
    footer.innerHTML = "Last data update <strong id=\"dfShellRefreshValue\">Loading...</strong>";
    document.body.appendChild(footer);
  }

  window.DataforceShell = {
    refreshFooter: loadFooterStatus,
    syncUserName
  };

  onReady(function () {
    ensureFavicon();
    buildHeader();
    buildFooter();
    loadFooterStatus();
  });
})();
