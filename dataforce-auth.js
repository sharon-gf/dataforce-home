(function () {
  "use strict";

  const USER_KEY = "df_user";
  const PERMISSIONS_KEY = "df_permissions";
  const REMEMBER_KEY = "df_remember_login";
  const LOCAL_MODULES = [
    "dashboard",
    "flown",
    "booked",
    "my_bookings",
    "sales_performance",
    "sales_tasks",
    "bookings_table",
    "booking_details",
    "spot_opportunities",
    "pending_spots",
    "check_rates",
    "cod",
    "finance",
    "jet_fuel",
    "industry_monitor",
    "quote",
    "vvi_charters",
    "upload",
    "customers",
    "admin"
  ];

  function isLocalPreview() {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "";
  }

  function localUser() {
    return { name: "Local Preview", email: "sharon@gsaforce.com" };
  }

  function localPermissions() {
    return {
      modules: LOCAL_MODULES,
      allowed_businesses: ["ALL"],
      allowed_gsas: [],
      sales_person: null
    };
  }

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (e) {}
  }

  function safeRemove(storage, key) {
    try {
      storage.removeItem(key);
    } catch (e) {}
  }

  function hasRememberedUser() {
    return safeGet(localStorage, USER_KEY) !== null || safeGet(localStorage, REMEMBER_KEY) === "true";
  }

  function activeStorage() {
    return hasRememberedUser() ? localStorage : sessionStorage;
  }

  function getItem(key) {
    if (isLocalPreview()) {
      if (key === USER_KEY && !safeGet(localStorage, key) && !safeGet(sessionStorage, key)) {
        return JSON.stringify(localUser());
      }
      if (key === PERMISSIONS_KEY && !safeGet(localStorage, key) && !safeGet(sessionStorage, key)) {
        return JSON.stringify(localPermissions());
      }
    }
    return safeGet(localStorage, key) || safeGet(sessionStorage, key);
  }

  function setItem(key, value, remember) {
    const storage = remember === undefined ? activeStorage() : (remember ? localStorage : sessionStorage);
    const other = storage === localStorage ? sessionStorage : localStorage;
    safeSet(storage, key, value);
    if (storage === localStorage) {
      safeSet(sessionStorage, key, value);
    } else {
      safeRemove(other, key);
    }
    if (key === USER_KEY) {
      if (storage === localStorage) safeSet(localStorage, REMEMBER_KEY, "true");
      else safeRemove(localStorage, REMEMBER_KEY);
    }
  }

  function removeItem(key) {
    safeRemove(localStorage, key);
    safeRemove(sessionStorage, key);
    if (key === USER_KEY) safeRemove(localStorage, REMEMBER_KEY);
  }

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getUser() {
    if (isLocalPreview()) return parseJson(getItem(USER_KEY), localUser());
    return parseJson(getItem(USER_KEY), null);
  }

  function setUser(user, remember) {
    setItem(USER_KEY, JSON.stringify(user), remember);
  }

  function getPermissions() {
    if (isLocalPreview()) return parseJson(getItem(PERMISSIONS_KEY), localPermissions());
    return parseJson(getItem(PERMISSIONS_KEY), null);
  }

  function setPermissions(permissions) {
    setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  }

  const SESSION_KEY = "df_shared_session";
  const SESSION_API = "https://dataforce-review-api-911713216717.us-east1.run.app";
  let sessionRequest = null;

  function getSession() {
    const value = parseJson(getItem(SESSION_KEY), null);
    const user = getUser();
    if (!value || !user || value.email !== String(user.email).toLowerCase() || value.expires_at * 1000 <= Date.now() + 30000) return null;
    return value;
  }

  async function establishSession(credential, remember) {
    const response = await fetch(SESSION_API + "/api/auth/session", {
      method: "POST", headers: { "Authorization": "Bearer " + credential, "Content-Type": "application/json" },
      body: JSON.stringify({ remember: remember === undefined ? hasRememberedUser() : remember }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error("Could not establish the DATAFORCE session");
    const session = await response.json();
    const user = getUser();
    // Never save a login that finished after sign-out or an account switch.
    if (!user || session.email !== String(user.email).toLowerCase()) throw new Error("Account changed during sign-in");
    setItem(SESSION_KEY, JSON.stringify(session), remember);
    return session.token;
  }

  async function getSessionToken() {
    const saved = getSession();
    if (saved) return saved.token;
    const credential = getItem("df_google_id_token");
    if (!credential) return null;
    if (!sessionRequest) sessionRequest = establishSession(credential).finally(() => { sessionRequest = null; });
    try { return await sessionRequest; } catch (e) { return null; }
  }

  function clear() {
    removeItem(USER_KEY);
    removeItem(PERMISSIONS_KEY);
    removeItem("df_google_id_token");
    removeItem(SESSION_KEY);
  }

  window.DataforceAuth = {
    getSessionToken,
    establishSession,
    getSession,
    getItem,
    setItem,
    removeItem,
    getUser,
    setUser,
    getPermissions,
    setPermissions,
    clear,
    isRemembered: hasRememberedUser,
    isLocalPreview
  };

  window.getDataforceUser = window.getDataforceUser || getUser;
})();
