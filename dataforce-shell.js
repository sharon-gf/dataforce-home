(function () {
  "use strict";

  const HOME_URL = "https://dataforce.gsaforce.com/";
  const DEFAULT_API_BASE = "https://dataforce-api-production.up.railway.app";
  const SCRIPT_URL = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
  const DEFAULT_LOGO_URL = SCRIPT_URL ? new URL("dataforce-logo.png", SCRIPT_URL).href : "dataforce-logo.png";
  const DEFAULT_FAVICON_HREF = SCRIPT_URL ? new URL("favicon.jpg", SCRIPT_URL).href : "favicon.jpg";
  const DEFAULT_FAVICON_TYPE = "image/jpeg";
  const DEFAULT_APP_LOGO_URL = SCRIPT_URL ? new URL("app-logo.png", SCRIPT_URL).href : "app-logo.png";
  const MODULES = [
    { key: "dashboard", label: "Dashboard", href: "https://dataforce.gsaforce.com/dashboard/" },
    { key: "flown", label: "Flown", href: "https://dataforce.gsaforce.com/flown-report/" },
    { key: "booked", label: "Booked", href: "https://dataforce.gsaforce.com/booked-report/" },
    { key: "my_bookings", label: "My Bookings", href: "https://dataforce.gsaforce.com/my-bookings/" },
    { key: "sales_performance", label: "Sales Performance", href: "https://dataforce.gsaforce.com/sales-performance/" },
    { key: "sales_tasks", label: "Sales Tasks", href: "https://dataforce.gsaforce.com/sales-tasks/" },
    { key: "booking_details", label: "Booking Details", href: "https://dataforce.gsaforce.com/booking-details/" },
    { key: "spot_opportunities", label: "Spot Opportunities", href: "https://dataforce.gsaforce.com/spot-opportunities/" },
    { key: "pending_spots", label: "Pending Spots", href: "https://dataforce.gsaforce.com/pending-spots/" },
    { key: "check_rates", label: "Check Rates", href: "https://dataforce.gsaforce.com/check-rates/" },
    { key: "finance", label: "Finance", href: "https://dataforce.gsaforce.com/finance/" },
    { key: "quote", label: "Quote", href: "https://prd-pal-connect.lovable.app/", external: true },
    { key: "vvi_charters", label: "VVI Charters", href: "https://dataforce.gsaforce.com/vvi-charters/" },
    { key: "upload", label: "Upload Data", href: "https://dataforce.gsaforce.com/upload-data/" },
    { key: "customers", label: "Customers", href: "https://dataforce.gsaforce.com/customers/" },
    { key: "admin", label: "Users", href: "https://dataforce.gsaforce.com/users/" }
  ];

 

  
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function cfg() {
    return window.DATAFORCE_SHELL || {};
  }

  function ensureFavicon() {
    let icon = document.querySelector("link[rel~='icon']");
    if (!icon) {
      icon = document.createElement("link");
      document.head.appendChild(icon);
    }
    icon.rel = "icon";
    icon.type = cfg().faviconType || DEFAULT_FAVICON_TYPE;
    icon.href = cfg().faviconHref || DEFAULT_FAVICON_HREF;
    // document.head.appendChild(icon);
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
      const saved = window.DataforceAuth
        ? DataforceAuth.getItem("df_user")
        : (localStorage.getItem("df_user") || sessionStorage.getItem("df_user"));
      return JSON.parse(saved || "{}");
    } catch (e) {
      return {};
    }
  }

  function readPermissions() {
    try {
      const saved = window.DataforceAuth
        ? DataforceAuth.getItem("df_permissions")
        : (localStorage.getItem("df_permissions") || sessionStorage.getItem("df_permissions"));
      return JSON.parse(saved || "null");
    } catch (e) {
      return null;
    }
  }

  function permittedModules() {
    const permissions = readPermissions();
    const modules = permissions && Array.isArray(permissions.modules) ? permissions.modules : null;
    if (!modules) return MODULES.filter((module) => module.key !== "admin");

    const allowed = new Set(
      modules.map((name) => String(name).toLowerCase().replace(/-/g, "_"))
    );
    if (allowed.has("admin")) {
      allowed.add("check_rates");
      allowed.add("spot_opportunities");
      allowed.add("pending_spots");
      allowed.add("customers");
    }
    return MODULES.filter((module) => allowed.has(module.key));
  }

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function displayName() {
    const user = readUser();
    return user.name || user.email || "";
  }

  function defaultSignOut() {
    if (window.DataforceAuth) {
      DataforceAuth.clear();
    } else {
      localStorage.removeItem("df_user");
      localStorage.removeItem("df_permissions");
      localStorage.removeItem("df_remember_login");
      sessionStorage.removeItem("df_user");
      sessionStorage.removeItem("df_permissions");
    }
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

  function makeMenuButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "df-shell-menu-button";
    button.setAttribute("aria-label", "Open module menu");
    button.setAttribute("aria-controls", "dfShellDrawer");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = "<span></span><span></span><span></span>";
    button.addEventListener("click", function () {
      setDrawerOpen(!document.body.classList.contains("df-shell-drawer-open"));
    });
    return button;
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

  function setDrawerOpen(open) {
    const button = document.querySelector(".df-shell-menu-button");
    const drawer = document.getElementById("dfShellDrawer");
    const overlay = document.getElementById("dfShellDrawerOverlay");
    document.body.classList.toggle("df-shell-drawer-open", open);
    if (button) {
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-label", open ? "Close module menu" : "Open module menu");
    }
    if (drawer) drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (overlay) overlay.hidden = !open;
  }

  function buildDrawer() {
    if (document.getElementById("dfShellDrawer")) return;

    const overlay = document.createElement("button");
    overlay.id = "dfShellDrawerOverlay";
    overlay.className = "df-shell-drawer-overlay";
    overlay.type = "button";
    overlay.hidden = true;
    overlay.setAttribute("aria-label", "Close module menu");
    overlay.addEventListener("click", function () {
      setDrawerOpen(false);
    });

    const drawer = document.createElement("aside");
    drawer.id = "dfShellDrawer";
    drawer.className = "df-shell-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-label", "Module menu");

    const logo = document.createElement("a");
    logo.className = "df-shell-drawer-logo";
    logo.href = HOME_URL;
    logo.setAttribute("aria-label", "Back to DATAFORCE home");
    const img = document.createElement("img");
    img.src = cfg().logoSrc || DEFAULT_LOGO_URL;
    img.alt = "DATAFORCE";
    logo.appendChild(img);

    const nav = document.createElement("nav");
    nav.className = "df-shell-drawer-nav";

    const path = currentPath();
    permittedModules().forEach((module) => {
      const link = document.createElement("a");
      link.href = module.href;
      link.textContent = module.label;
      link.className = "df-shell-drawer-link";
      if (module.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      if (!module.external && new URL(module.href).pathname.replace(/\/+$/, "") === path) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      link.addEventListener("click", function () {
        setDrawerOpen(false);
      });
      nav.appendChild(link);
    });

    drawer.append(logo, nav);
    document.body.append(overlay, drawer);
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
    const brand = document.createElement("div");
    brand.className = "df-shell-brand";
    brand.append(makeMenuButton(), makeLogo(oldHeader));
    top.append(brand, makeTitle(oldHeader), makeUser(oldHeader));

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
    buildDrawer();
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
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setDrawerOpen(false);
    });
  });
})();
