(function () {
  "use strict";

  const USER_KEY = "df_user";
  const PERMISSIONS_KEY = "df_permissions";
  const REMEMBER_KEY = "df_remember_login";

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
    return safeGet(localStorage, key) || safeGet(sessionStorage, key);
  }

  function setItem(key, value, remember) {
    const storage = remember === undefined ? activeStorage() : (remember ? localStorage : sessionStorage);
    const other = storage === localStorage ? sessionStorage : localStorage;
    safeSet(storage, key, value);
    safeRemove(other, key);
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
    return parseJson(getItem(USER_KEY), null);
  }

  function setUser(user, remember) {
    setItem(USER_KEY, JSON.stringify(user), remember);
  }

  function getPermissions() {
    return parseJson(getItem(PERMISSIONS_KEY), null);
  }

  function setPermissions(permissions) {
    setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  }

  function clear() {
    removeItem(USER_KEY);
    removeItem(PERMISSIONS_KEY);
  }

  window.DataforceAuth = {
    getItem,
    setItem,
    removeItem,
    getUser,
    setUser,
    getPermissions,
    setPermissions,
    clear,
    isRemembered: hasRememberedUser
  };

  window.getDataforceUser = window.getDataforceUser || getUser;
})();
