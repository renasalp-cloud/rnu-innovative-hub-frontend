// src/services/api.js
import { Contract } from "./contract";

/**
 * Single API gateway:
 * - Mode switch: REACT_APP_API_MODE = "mock" | "real"
 * - Base URL:     REACT_APP_API_BASE_URL (only used in real mode)
 * - Prefix:       Contract.meta.base is the source of truth (e.g. "/api/v1")
 *
 * NOTE:
 * - REACT_APP_API_PREFIX is allowed as a "visibility hint" for repo users,
 *   but Contract.meta.base is the actual contract source of truth.
 */

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
const API_MODE = String(process.env.REACT_APP_API_MODE || "mock").toLowerCase();
const USE_MOCK = API_MODE !== "real";
const TIMEOUT_MS = Number(process.env.REACT_APP_API_TIMEOUT_MS || 15000);

const CONTRACT_BASE = String(Contract?.meta?.base || "").trim() || "";
const ENV_PREFIX = (process.env.REACT_APP_API_PREFIX || "").trim();

// One-time prefix mismatch warning (helps avoid silent "/api/v1" drift)
let _warnedPrefixMismatch = false;
function warnPrefixMismatchOnce() {
  if (_warnedPrefixMismatch) return;
  if (ENV_PREFIX && CONTRACT_BASE && ENV_PREFIX !== CONTRACT_BASE) {
    // eslint-disable-next-line no-console
    console.warn(
      `[RNU API] Prefix mismatch: REACT_APP_API_PREFIX="${ENV_PREFIX}" but Contract.meta.base="${CONTRACT_BASE}". ` +
        `Using Contract.meta.base as source of truth.`
    );
  }
  _warnedPrefixMismatch = true;
}
warnPrefixMismatchOnce();

/* ================= STANDARD ERRORS ================= */
function createMockNotImplementedError(method, path) {
  const err = new Error(`Mock not implemented for ${method} ${path}`);
  err.isMock = true;
  err.code = "MOCK_NOT_IMPLEMENTED";
  err.method = method;
  err.path = path;
  return err;
}

/* ================= AUTH TOKEN ================= */
function getAuthToken() {
  return sessionStorage.getItem("token") || null;
}

/* ================= PATH HELPERS ================= */
function normalizePath(p) {
  const s = String(p || "");
  if (!s) return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

function withContractBase(path) {
  const p = normalizePath(path);
  const base = normalizePath(CONTRACT_BASE || "");
  // If base is "/" or empty, just return p
  if (!CONTRACT_BASE || base === "/") return p;
  return `${base}${p}`.replace(/\/{2,}/g, "/");
}

/* ================= URL BUILDER ================= */
function buildUrl(pathWithBase, query) {
  const cleanBase = String(BASE_URL || "").replace(/\/+$/, "");
  const cleanPath = String(pathWithBase || "").replace(/^\/+/, "");

  const url = cleanBase
    ? `${cleanBase}/${cleanPath}`
    : `/${cleanPath}`.replace(/\/{2,}/g, "/");

  if (!query || typeof query !== "object") return url;

  const usp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.append(k, String(v));
  });

  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

/* ================= TIMEOUT ================= */
function withTimeout(signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}

/* ================= RESPONSE PARSER ================= */
async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (res.ok) return payload;

  const err = new Error(
    payload?.error?.message || payload?.message || res.statusText || "Request failed"
  );
  err.status = res.status;
  err.data = payload;
  throw err;
}

/* ================= MOCK HELPERS ================= */
const normalizeEmail = (e) => (e || "").trim().toLowerCase();

const emptyItemsObject = () => ({
  certificates: [],
  projects: [],
  publications: [],
  issues: [],
});

const itemsKeyForEmail = (email) => `rnu_items__${normalizeEmail(email)}`;
const notesKeyForEmail = (email) => `rnu_notes__${normalizeEmail(email)}`;

function readItemsFor(email) {
  const raw = localStorage.getItem(itemsKeyForEmail(email));
  if (!raw) return emptyItemsObject();
  try {
    const parsed = JSON.parse(raw);
    return {
      certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      publications: Array.isArray(parsed.publications) ? parsed.publications : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return emptyItemsObject();
  }
}

function writeItemsFor(email, obj) {
  localStorage.setItem(itemsKeyForEmail(email), JSON.stringify(obj));
  window.dispatchEvent(new Event("rnu_items_updated"));
}

function readNotesFor(email) {
  const raw = localStorage.getItem(notesKeyForEmail(email));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotesFor(email, list) {
  localStorage.setItem(notesKeyForEmail(email), JSON.stringify(list));
  window.dispatchEvent(new Event("rnu_notes_updated"));
}

/* ================= MOCK REQUEST ================= */
async function mockRequest(contract, { params = {}, body, query } = {}) {
  await new Promise((r) => setTimeout(r, 120));

  const { method } = contract;

  // IMPORTANT:
  // contract.path is WITHOUT Contract.meta.base (e.g. "/auth/me")
  // We match on cleanPath (no base) to keep mock logic stable.
  let cleanPath = normalizePath(contract.path);

  Object.entries(params).forEach(([k, v]) => {
    cleanPath = cleanPath.replace(`:${k}`, encodeURIComponent(String(v)));
  });

  /* ---------- AUTH ---------- */
  if (method === "GET" && cleanPath === "/auth/me") {
    const raw = sessionStorage.getItem("rnu_user_profile");
    return { user: raw ? JSON.parse(raw) : null };
  }

  /* =====================================================
     AI CHAT MOCK
     ===================================================== */
  if (method === "POST" && cleanPath === "/ai/chat") {
    const msg = String(body?.message || "").toLowerCase();

    // Very simple “smart” mock
    if (msg.includes("certificate")) {
      const profile = JSON.parse(sessionStorage.getItem("rnu_user_profile") || "{}");
      const email = normalizeEmail(profile?.email);
      const items = readItemsFor(email);
      return { replyText: `You currently have ${items.certificates.length} certificates.` };
    }

    if (msg.includes("project")) {
      const profile = JSON.parse(sessionStorage.getItem("rnu_user_profile") || "{}");
      const email = normalizeEmail(profile?.email);
      const items = readItemsFor(email);
      return { replyText: `You have ${items.projects.length} projects listed.` };
    }

    return {
      replyText:
        "I’m a demo AI assistant for now. I can answer simple questions about your achievements.",
    };
  }

  /* =====================================================
     ACHIEVEMENTS
     Contract says response = { items: AchievementItem[] }
     Your local storage keeps category buckets. We return the raw object
     (existing UI behavior) to avoid breaking current pages.
     ===================================================== */
  if (method === "GET" && /^\/users\/[^/]+\/achievements$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    return readItemsFor(email);
  }

  if (method === "POST" && /^\/users\/[^/]+\/achievements$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    const category = String(body?.category || "").trim().toLowerCase();
    const item = body?.item || {};

    const map = {
      certifications: "certificates",
      certificates: "certificates",
      projects: "projects",
      publications: "publications",
      issues: "issues",
    };
    const key = map[category];
    if (!key) throw new Error("Invalid category");

    const current = readItemsFor(email);
    const now = new Date().toISOString();

    const newItem = {
      ...item,
      id: item?.id ?? `itm_${Date.now()}`,
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    };

    writeItemsFor(email, { ...current, [key]: [newItem, ...(current[key] || [])] });
    return { item: newItem };
  }

  if (method === "DELETE" && /^\/users\/[^/]+\/achievements\/[^/]+$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    const id = decodeURIComponent(parts[4] || "");
    const category = String(query?.category || "").trim().toLowerCase();

    const current = readItemsFor(email);
    if (!category || !current[category]) return { ok: true };

    writeItemsFor(email, {
      ...current,
      [category]: (current[category] || []).filter((it) => String(it.id) !== String(id)),
    });
    return { ok: true };
  }

  /* =====================================================
     NOTES
     ===================================================== */
  if (method === "GET" && /^\/students\/[^/]+\/notes$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    return { notes: readNotesFor(email) };
  }

  if (method === "POST" && /^\/students\/[^/]+\/notes$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));

    const lecturerEmail = normalizeEmail(
      JSON.parse(sessionStorage.getItem("rnu_user_profile") || "{}")?.email
    );

    const list = readNotesFor(email);
    const note = {
      id: `note_${Date.now()}`,
      text: body?.text || "",
      lecturerEmail,
      createdAt: new Date().toISOString(),
      editedAt: null,
    };

    writeNotesFor(email, [note, ...list]);
    return { note };
  }

  if (method === "PATCH" && /^\/students\/[^/]+\/notes\/[^/]+$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    const noteId = decodeURIComponent(parts[4] || "");

    const list = readNotesFor(email);
    const next = list.map((n) =>
      String(n.id) === String(noteId)
        ? { ...n, text: body?.text ?? n.text, editedAt: new Date().toISOString() }
        : n
    );

    writeNotesFor(email, next);
    return { ok: true };
  }

  if (method === "DELETE" && /^\/students\/[^/]+\/notes\/[^/]+$/.test(cleanPath)) {
    const parts = cleanPath.split("/");
    const email = normalizeEmail(decodeURIComponent(parts[2] || ""));
    const noteId = decodeURIComponent(parts[4] || "");

    const list = readNotesFor(email);
    writeNotesFor(
      email,
      list.filter((n) => String(n.id) !== String(noteId))
    );
    return { ok: true };
  }

  // Standardized mock error (UX-safe + debuggable)
  throw createMockNotImplementedError(method, withContractBase(cleanPath));
}

/* ================= REAL REQUEST ================= */
async function realRequest(contract, { params = {}, body, query, headers, signal } = {}) {
  let cleanPath = normalizePath(contract.path);

  Object.entries(params).forEach(([k, v]) => {
    cleanPath = cleanPath.replace(`:${k}`, encodeURIComponent(String(v)));
  });

  // Real calls ALWAYS include Contract.meta.base prefix (e.g. "/api/v1")
  const pathWithBase = withContractBase(cleanPath);
  const url = buildUrl(pathWithBase, query);

  const token = getAuthToken();

  const finalHeaders = {
    "Content-Type": "application/json",
    ...(headers || {}),
    ...(contract.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const { signal: timeoutSignal, cancel } = withTimeout(signal);

  try {
    const res = await fetch(url, {
      method: contract.method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutSignal,
    });
    return await parseResponse(res);
  } finally {
    cancel();
  }
}

/* ================= EXPORTS ================= */
export function call(contract, options = {}) {
  return USE_MOCK ? mockRequest(contract, options) : realRequest(contract, options);
}

// Backward-compatible aliases (avoid breaking existing imports)
export function requestByContract(contract, options = {}) {
  return call(contract, options);
}

export function callByContract(contract, options = {}) {
  return call(contract, options);
}
