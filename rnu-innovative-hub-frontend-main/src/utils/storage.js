// =====================================================
// RNU Storage — SINGLE SOURCE OF TRUTH (Frontend)
// =====================================================

// --------------------
// Data source switch (future-proof)
// --------------------
export const DATA_SOURCE = String(
  process.env.REACT_APP_DATA_SOURCE || "local"
).toLowerCase();

// --------------------
// Constants
// --------------------
const PROFILE_KEY = "rnu_user_profile";
const TOKEN_KEY = "token";

// --------------------
// Helpers
// --------------------
const emptyItems = () => ({
  certificates: [],
  projects: [],
  publications: [],
  issues: [],
});

const emptyStats = () => ({
  certificates: 0,
  projects: 0,
  publications: 0,
  issues: 0,
});

// --------------------
// ACTIVE PROFILE — TAB BASED (SINGLE SOURCE)
// --------------------
export const getActiveProfile = () => {
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    return {
      ...p,
      email: (p.email || "").trim().toLowerCase(),
      role: p.role || "Student",
      name: p.name || "",
    };
  } catch {
    return null;
  }
};

/**
 * Sets active profile and ALWAYS emits rnu_profile_updated.
 * Components MUST rely on this event, not manual dispatch.
 */
export const setActiveProfile = (profile) => {
  if (!profile || typeof profile !== "object") return;
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("setActiveProfile error:", e);
  }
  window.dispatchEvent(new Event("rnu_profile_updated"));
};

/**
 * Clears active profile and emits rnu_profile_updated.
 * This is the ONLY place that should remove the profile.
 */
export const clearActiveProfile = () => {
  sessionStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new Event("rnu_profile_updated"));
};

// --------------------
// TOKEN (TAB BASED)
// --------------------
export const getAuthToken = () => sessionStorage.getItem(TOKEN_KEY) || null;

/**
 * Token change does NOT emit profile event by design.
 * Profile is the source of truth for auth state.
 */
export const setAuthToken = (token) => {
  if (!token) sessionStorage.removeItem(TOKEN_KEY);
  else sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
};

// --------------------
// INTERNAL HELPERS
// --------------------
const getEmailKey = () => {
  const profile = getActiveProfile();
  return profile?.email || "";
};

const itemsKeyForEmail = (email) => `rnu_items__${email}`;
const statsKeyForEmail = (email) => `rnu_stats__${email}`;

// --------------------
// Migration (legacy global → per-user)
// --------------------
export const migrateGlobalToUserIfNeeded = () => {
  const email = getEmailKey();
  if (!email) return;

  const userItemsKey = itemsKeyForEmail(email);
  const userStatsKey = statsKeyForEmail(email);

  if (localStorage.getItem(userItemsKey)) return;

  const globalItemsRaw = localStorage.getItem("rnu_items");
  const globalStatsRaw = localStorage.getItem("rnu_stats");

  localStorage.setItem(
    userItemsKey,
    globalItemsRaw || JSON.stringify(emptyItems())
  );
  localStorage.setItem(
    userStatsKey,
    globalStatsRaw || JSON.stringify(emptyStats())
  );

  localStorage.removeItem("rnu_items");
  localStorage.removeItem("rnu_stats");

  syncStatsFromItems();
};

// --------------------
// CLEAR (logout-safe)
// --------------------
export const clearUserStorage = () => {
  // Order matters: token first, profile last
  clearAuthToken();
  clearActiveProfile();

  window.dispatchEvent(new Event("rnu_items_updated"));
  window.dispatchEvent(new Event("rnu_stats_updated"));
};

// --------------------
// ITEMS (Achievements) — per active user
// --------------------
export const getItems = () => {
  const email = getEmailKey();
  if (!email) return emptyItems();

  migrateGlobalToUserIfNeeded();

  const raw = localStorage.getItem(itemsKeyForEmail(email));
  if (!raw) return emptyItems();

  try {
    const parsed = JSON.parse(raw);
    return {
      certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      publications: Array.isArray(parsed.publications) ? parsed.publications : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return emptyItems();
  }
};

export const setItems = (items) => {
  const email = getEmailKey();
  if (!email) return;

  migrateGlobalToUserIfNeeded();
  localStorage.setItem(itemsKeyForEmail(email), JSON.stringify(items));
};

export const addItem = (key, item) => {
  const current = getItems();
  const next = { ...current, [key]: [item, ...(current[key] || [])] };
  setItems(next);
  window.dispatchEvent(new Event("rnu_items_updated"));
  return next;
};

export const removeItem = (key, itemId) => {
  const current = getItems();
  const list = Array.isArray(current[key]) ? current[key] : [];
  const nextList = list.filter((it) => it.id !== itemId);
  const next = { ...current, [key]: nextList };
  setItems(next);
  window.dispatchEvent(new Event("rnu_items_updated"));
  return next;
};

// --------------------
// STATS (derived)
// --------------------
export const getStats = () => {
  const email = getEmailKey();
  if (!email) return emptyStats();

  migrateGlobalToUserIfNeeded();

  const raw = localStorage.getItem(statsKeyForEmail(email));
  if (!raw) return emptyStats();

  try {
    const parsed = JSON.parse(raw);
    return {
      certificates: parsed.certificates || 0,
      projects: parsed.projects || 0,
      publications: parsed.publications || 0,
      issues: parsed.issues || 0,
    };
  } catch {
    return emptyStats();
  }
};

export const setStats = (stats) => {
  const email = getEmailKey();
  if (!email) return;

  migrateGlobalToUserIfNeeded();
  localStorage.setItem(statsKeyForEmail(email), JSON.stringify(stats));
};

export const syncStatsFromItems = () => {
  const items = getItems();
  const fixed = {
    certificates: items.certificates.length,
    projects: items.projects.length,
    publications: items.publications.length,
    issues: items.issues.length,
  };
  setStats(fixed);
  window.dispatchEvent(new Event("rnu_stats_updated"));
  return fixed;
};

// --------------------
// EXPORT / IMPORT (Per-user aware, TAB-based session)
// --------------------
export const exportAllRnuData = () => {
  const profile = getActiveProfile();
  const email = getEmailKey();

  const out = {
    token: sessionStorage.getItem(TOKEN_KEY),
    rnu_user_profile: sessionStorage.getItem(PROFILE_KEY),
    rnu_items: email ? localStorage.getItem(itemsKeyForEmail(email)) : null,
    rnu_stats: email ? localStorage.getItem(statsKeyForEmail(email)) : null,
    rnu_items_key: email ? itemsKeyForEmail(email) : null,
    rnu_stats_key: email ? statsKeyForEmail(email) : null,
    exportedForEmail: profile?.email || null,
  };

  return JSON.stringify(out, null, 2);
};

export const importAllRnuData = (jsonText) => {
  const data = JSON.parse(jsonText);

  [TOKEN_KEY, PROFILE_KEY].forEach((k) => {
    if (data[k] === null || typeof data[k] === "undefined")
      sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, data[k]);
  });

  const email = getEmailKey();
  if (!email) {
    window.dispatchEvent(new Event("rnu_profile_updated"));
    window.dispatchEvent(new Event("rnu_items_updated"));
    window.dispatchEvent(new Event("rnu_stats_updated"));
    return;
  }

  const itemsRaw = data.rnu_items;
  const statsRaw = data.rnu_stats;

  if (itemsRaw === null || typeof itemsRaw === "undefined") {
    localStorage.setItem(itemsKeyForEmail(email), JSON.stringify(emptyItems()));
  } else {
    localStorage.setItem(itemsKeyForEmail(email), itemsRaw);
  }

  if (statsRaw === null || typeof statsRaw === "undefined") {
    localStorage.setItem(statsKeyForEmail(email), JSON.stringify(emptyStats()));
  } else {
    localStorage.setItem(statsKeyForEmail(email), statsRaw);
  }

  syncStatsFromItems();

  window.dispatchEvent(new Event("rnu_profile_updated"));
  window.dispatchEvent(new Event("rnu_items_updated"));
  window.dispatchEvent(new Event("rnu_stats_updated"));
};

// --------------------
// NOTES SYNC (single strategy)
// --------------------
export const emitNotesUpdated = () => {
  window.dispatchEvent(new Event("rnu_notes_updated"));

  try {
    const bc = new BroadcastChannel("rnu_notes_channel");
    bc.postMessage({ type: "notes_updated", at: Date.now() });
    bc.close();
  } catch {}
};
