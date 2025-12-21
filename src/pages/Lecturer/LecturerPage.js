// src/pages/Lecturer/LecturerPage.js
import React, { useEffect, useMemo, useState } from "react";
import { emitNotesUpdated, getActiveProfile } from "../../utils/storage";
import { notesApi } from "../../services/notesApi";

// --------------------
// Helpers
// --------------------
const safeJsonParse = (x) => {
  if (!x) return null;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
};

const normalizeEmail = (e) => (e || "").trim().toLowerCase();

const getUsersRegistry = () => {
  const raw = localStorage.getItem("rnu_users");
  const list = safeJsonParse(raw);
  return Array.isArray(list) ? list : [];
};

const saveUsersRegistry = (users) => {
  localStorage.setItem("rnu_users", JSON.stringify(users));
};

const itemsKeyForEmail = (email) => `rnu_items__${normalizeEmail(email)}`;
const statsKeyForEmail = (email) => `rnu_stats__${normalizeEmail(email)}`;

// ✅ Notes key (fallback only)
const notesKeyForEmail = (email) => `rnu_notes__${normalizeEmail(email)}`;

const emptyItems = () => ({
  certificates: [],
  projects: [],
  publications: [],
  issues: [],
});

const deriveStatsFromItems = (items) => ({
  certificates: (items?.certificates || []).length,
  projects: (items?.projects || []).length,
  publications: (items?.publications || []).length,
  issues: (items?.issues || []).length,
});

const getStudentItems = (email) => {
  const raw = localStorage.getItem(itemsKeyForEmail(email));
  const parsed = safeJsonParse(raw);
  if (!parsed) return emptyItems();
  return {
    certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    publications: Array.isArray(parsed.publications) ? parsed.publications : [],
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
};

const getStudentStats = (email) => {
  const raw = localStorage.getItem(statsKeyForEmail(email));
  const parsed = safeJsonParse(raw);
  if (parsed) {
    return {
      certificates: parsed.certificates || 0,
      projects: parsed.projects || 0,
      publications: parsed.publications || 0,
      issues: parsed.issues || 0,
    };
  }
  const items = getStudentItems(email);
  return deriveStatsFromItems(items);
};

/* ============================================================
   NOTES — CONTRACT FIRST, FALLBACK LOCAL (to avoid breaking)
   ============================================================ */

// local fallback read
const getStudentNotesLocal = (email) => {
  const raw = localStorage.getItem(notesKeyForEmail(email));
  const list = safeJsonParse(raw);
  return Array.isArray(list) ? list : [];
};

// local fallback write (ADD)
const addStudentNoteLocal = ({ studentEmail, text, lecturerEmail, lecturerName }) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  const current = getStudentNotesLocal(e);
  const next = [
    {
      id: Date.now(),
      text: String(text || "").trim(),
      createdAt: new Date().toISOString(),
      lecturerEmail: normalizeEmail(lecturerEmail),
      lecturerName: (lecturerName || "").trim(),
    },
    ...current,
  ];

  localStorage.setItem(notesKeyForEmail(e), JSON.stringify(next));
  emitNotesUpdated();
  return next;
};

// local fallback update (EDIT)
const updateStudentNoteLocal = (studentEmail, noteId, newText) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  const list = getStudentNotesLocal(e);

  const next = list.map((n) =>
    n.id === noteId
      ? {
          ...n,
          text: String(newText || "").trim(),
          editedAt: new Date().toISOString(),
        }
      : n
  );

  localStorage.setItem(notesKeyForEmail(e), JSON.stringify(next));
  emitNotesUpdated();
  return next;
};

// local fallback delete
const deleteStudentNoteLocal = (studentEmail, noteId) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  const list = getStudentNotesLocal(e);
  const next = list.filter((n) => n.id !== noteId);

  localStorage.setItem(notesKeyForEmail(e), JSON.stringify(next));
  emitNotesUpdated();
  return next;
};

// ✅ CONTRACT-FIRST wrappers
const getStudentNotes = async (email) => {
  const e = normalizeEmail(email);
  if (!e) return [];

  try {
    const res = await notesApi.getNotes(e);
    const list = Array.isArray(res?.notes) ? res.notes : [];
    return list;
  } catch {
    // fallback for now (keeps existing behavior if backend/mock missing)
    return getStudentNotesLocal(e);
  }
};

const addStudentNote = async ({ studentEmail, text, lecturerEmail, lecturerName }) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  const payloadText = String(text || "").trim();
  if (!payloadText) return [];

  try {
    // backend-ready: lecturer identity should be derived from token server-side later
    await notesApi.addNote(e, { text: payloadText });
    emitNotesUpdated();
    return await getStudentNotes(e);
  } catch {
    // fallback keeps working now
    return addStudentNoteLocal({ studentEmail: e, text: payloadText, lecturerEmail, lecturerName });
  }
};

const updateStudentNote = async (studentEmail, noteId, newText) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  const payloadText = String(newText || "").trim();

  try {
    await notesApi.updateNote(e, String(noteId), { text: payloadText });
    emitNotesUpdated();
    return await getStudentNotes(e);
  } catch {
    // fallback until mock/backend supports update
    return updateStudentNoteLocal(e, noteId, payloadText);
  }
};

const deleteStudentNote = async (studentEmail, noteId) => {
  const e = normalizeEmail(studentEmail);
  if (!e) return [];

  try {
    await notesApi.deleteNote(e, String(noteId));
    emitNotesUpdated();
    return await getStudentNotes(e);
  } catch {
    // fallback until mock/backend supports delete
    return deleteStudentNoteLocal(e, noteId);
  }
};

const upsertStudentDataFromExportJson = (exportJsonText) => {
  const root = safeJsonParse(exportJsonText);
  if (!root) throw new Error("Invalid JSON");

  const profileObj = safeJsonParse(root.rnu_user_profile);
  if (!profileObj?.email) throw new Error("Missing profile email");

  const email = normalizeEmail(profileObj.email);

  const itemsRaw = root.rnu_items;
  const statsRaw = root.rnu_stats;

  if (itemsRaw) localStorage.setItem(itemsKeyForEmail(email), itemsRaw);
  else localStorage.setItem(itemsKeyForEmail(email), JSON.stringify(emptyItems()));

  if (statsRaw) localStorage.setItem(statsKeyForEmail(email), statsRaw);
  else {
    const items = getStudentItems(email);
    localStorage.setItem(statsKeyForEmail(email), JSON.stringify(deriveStatsFromItems(items)));
  }

  const users = getUsersRegistry();
  const exists = users.some((u) => normalizeEmail(u?.email) === email);
  if (!exists) {
    saveUsersRegistry([
      {
        name: profileObj.name || email.split("@")[0],
        email,
        role: profileObj.role || "Student",
        department: profileObj.department || "Computer Science",
        password: "demo",
        createdAt: new Date().toISOString(),
      },
      ...users,
    ]);
  }

  return profileObj;
};

// Lecturer-managed list storage (per lecturer)
const lecturerStudentsKey = (lecturerEmail) => `rnu_lecturer_students__${normalizeEmail(lecturerEmail)}`;

// ✅ now store objects: [{ email, addedAt }]
const getLecturerStudentEntries = (lecturerEmail) => {
  const raw = localStorage.getItem(lecturerStudentsKey(lecturerEmail));
  const parsed = safeJsonParse(raw);

  if (Array.isArray(parsed)) {
    // migrate old string[] to entry[]
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      const migrated = parsed
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
        .map((email) => ({ email, addedAt: new Date().toISOString() }));
      localStorage.setItem(lecturerStudentsKey(lecturerEmail), JSON.stringify(migrated));
      return migrated;
    }

    return parsed
      .map((x) => ({
        email: normalizeEmail(x?.email),
        addedAt: x?.addedAt || new Date().toISOString(),
      }))
      .filter((x) => x.email);
  }

  return [];
};

const saveLecturerStudentEntries = (lecturerEmail, entries) => {
  localStorage.setItem(lecturerStudentsKey(lecturerEmail), JSON.stringify(entries));
};

const tabToKey = (tab) => {
  if (tab === "Certificates") return "certificates";
  if (tab === "Projects") return "projects";
  if (tab === "Publications") return "publications";
  return "issues";
};

const singularLabel = (tab) => {
  if (tab === "University Issues") return "Issue";
  if (tab === "Certificates") return "Certificate";
  if (tab === "Projects") return "Project";
  if (tab === "Publications") return "Publication";
  return "Issue";
};

// --------------------
// Component
// --------------------
function LecturerPage() {
  const lecturer = getActiveProfile();
  const lecturerEmail = normalizeEmail(lecturer?.email);
  const lecturerDept = (lecturer?.department || "").trim();
  const lecturerName = (lecturer?.name || "").trim();

  const [msg, setMsg] = useState("");

  // ✅ Live refresh tick (forces useMemo recalculation when student data changes in another tab)
  const [liveTick, setLiveTick] = useState(0);

  // Registry + search
  const [registrySearch, setRegistrySearch] = useState("");
  const [selectedRegistryEmail, setSelectedRegistryEmail] = useState("");

  // Lecturer list entries
  const [studentEntries, setStudentEntries] = useState(() => getLecturerStudentEntries(lecturerEmail));
  const [activeStudentEmail, setActiveStudentEmail] = useState(studentEntries[0]?.email || "");

  // Filter/sort controls
  const [listSearch, setListSearch] = useState("");
  const [onlyMyDept, setOnlyMyDept] = useState(false);
  const [sortMode, setSortMode] = useState("total_desc"); // total_desc | name_asc | newest

  // Right-side: manual quick search (optional)
  const [quickSearch, setQuickSearch] = useState("");

  // Fallback import box (keep)
  const [importText, setImportText] = useState("");

  // ✅ details tab state
  const detailsTabs = ["Certificates", "Projects", "Publications", "University Issues"];
  const [detailsTab, setDetailsTab] = useState("Certificates");

  // ✅ Note UI state
  const [noteText, setNoteText] = useState("");
  const [notesPreview, setNotesPreview] = useState([]); // latest 5
  const [notesAll, setNotesAll] = useState([]); // all notes for modal

  // ✅ edit state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // ✅ View All Notes modal state
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [allNotesSearch, setAllNotesSearch] = useState("");
  const [allNotesSort, setAllNotesSort] = useState("newest"); // newest | oldest

  useEffect(() => {
    setStudentEntries(getLecturerStudentEntries(lecturerEmail));
  }, [lecturerEmail]);

  // Keep active student valid
  useEffect(() => {
    const emails = studentEntries.map((x) => x.email);
    if (!activeStudentEmail && emails.length > 0) setActiveStudentEmail(emails[0]);
    if (activeStudentEmail && !emails.includes(activeStudentEmail)) {
      setActiveStudentEmail(emails[0] || "");
    }
  }, [studentEntries, activeStudentEmail]);

  const refreshNotesForActiveStudent = async () => {
    const e = normalizeEmail(activeStudentEmail);
    if (!e) {
      setNotesPreview([]);
      setNotesAll([]);
      return;
    }

    const list = await getStudentNotes(e);
    list.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
    setNotesAll(list);
    setNotesPreview(list.slice(0, 5));
  };

  // ✅ When active student changes, reset details tab + notes
  useEffect(() => {
    setDetailsTab("Certificates");
    setNoteText("");
    setEditingNoteId(null);
    setEditingText("");

    // modal state reset for clarity
    setShowAllNotes(false);
    setAllNotesSearch("");
    setAllNotesSort("newest");

    void refreshNotesForActiveStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudentEmail]);

  // ✅ LIVE UPDATE LISTENER (items/stats/notes/registry)
  useEffect(() => {
    const watchedStudentEmails = new Set(studentEntries.map((x) => normalizeEmail(x.email)));
    const activeE = normalizeEmail(activeStudentEmail);

    const bump = () => setLiveTick((t) => t + 1);

    const onStorage = (e) => {
      const k = e?.key || "";
      if (!k) return;

      if (k === lecturerStudentsKey(lecturerEmail)) {
        setStudentEntries(getLecturerStudentEntries(lecturerEmail));
        bump();
        return;
      }

      if (k === "rnu_users") {
        bump();
        return;
      }

      const isStudentItems = k.startsWith("rnu_items__");
      const isStudentStats = k.startsWith("rnu_stats__");
      const isStudentNotes = k.startsWith("rnu_notes__");

      if (!isStudentItems && !isStudentStats && !isStudentNotes) return;

      const keyEmail = k.replace("rnu_items__", "").replace("rnu_stats__", "").replace("rnu_notes__", "");
      const keyEmailNorm = normalizeEmail(keyEmail);

      if (keyEmailNorm === activeE || watchedStudentEmails.has(keyEmailNorm)) {
        bump();
        if (isStudentNotes && keyEmailNorm === activeE) {
          void refreshNotesForActiveStudent();

          // if currently editing a note that got changed elsewhere, cancel edit to avoid confusion
          if (editingNoteId) {
            setEditingNoteId(null);
            setEditingText("");
          }
        }
      }
    };

    const onItemsUpdated = () => bump();
    const onStatsUpdated = () => bump();
    const onNotesUpdated = () => {
      bump();
      void refreshNotesForActiveStudent();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("rnu_items_updated", onItemsUpdated);
    window.addEventListener("rnu_stats_updated", onStatsUpdated);
    window.addEventListener("rnu_notes_updated", onNotesUpdated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rnu_items_updated", onItemsUpdated);
      window.removeEventListener("rnu_stats_updated", onStatsUpdated);
      window.removeEventListener("rnu_notes_updated", onNotesUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerEmail, studentEntries, activeStudentEmail, editingNoteId]);

  const registryStudents = useMemo(() => {
    const _ = liveTick;

    const users = getUsersRegistry();
    const list = users.filter((u) => (u?.role || "").toLowerCase() === "student");

    const q = registrySearch.trim().toLowerCase();
    if (!q) return list;

    return list.filter((u) => {
      const name = (u?.name || "").toLowerCase();
      const email = normalizeEmail(u?.email);
      const dept = (u?.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [registrySearch, liveTick]);

  const lecturerStudents = useMemo(() => {
    const _ = liveTick;

    const users = getUsersRegistry();
    const map = new Map(users.map((u) => [normalizeEmail(u?.email), u]));

    const base = studentEntries
      .map((entry) => {
        const email = normalizeEmail(entry.email);
        const u =
          map.get(email) || { name: email.split("@")[0], email, role: "Student", department: "" };
        const stats = getStudentStats(email);
        const total = stats.certificates + stats.projects + stats.publications + stats.issues;
        return {
          ...u,
          email,
          stats,
          total,
          addedAt: entry.addedAt || "",
        };
      })
      .filter((x) => x.email);

    const q = listSearch.trim().toLowerCase();
    const filteredBySearch = !q
      ? base
      : base.filter((s) => {
          const name = (s?.name || "").toLowerCase();
          const email = normalizeEmail(s?.email);
          const dept = (s?.department || "").toLowerCase();
          return name.includes(q) || email.includes(q) || dept.includes(q);
        });

    const filteredByDept =
      onlyMyDept && lecturerDept
        ? filteredBySearch.filter(
            (s) => (s?.department || "").trim().toLowerCase() === lecturerDept.trim().toLowerCase()
          )
        : filteredBySearch;

    const sorted = [...filteredByDept];
    if (sortMode === "total_desc") {
      sorted.sort((a, b) => (b.total || 0) - (a.total || 0));
    } else if (sortMode === "name_asc") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortMode === "newest") {
      sorted.sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
    }

    return sorted;
  }, [studentEntries, listSearch, onlyMyDept, sortMode, lecturerDept, liveTick]);

  const activeStudent = useMemo(() => {
    const _ = liveTick;

    if (!activeStudentEmail) return null;
    const users = getUsersRegistry();
    const u = users.find((x) => normalizeEmail(x?.email) === normalizeEmail(activeStudentEmail)) || null;

    const email = normalizeEmail(activeStudentEmail);
    const profile = u
      ? { name: u.name, email: u.email, role: u.role, department: u.department }
      : { name: email.split("@")[0], email, role: "Student", department: "" };

    const items = getStudentItems(email);
    const stats = getStudentStats(email);
    return { profile, items, stats };
  }, [activeStudentEmail, liveTick]);

  // ✅ derive current list for selected details tab
  const currentDetailsKey = tabToKey(detailsTab);
  const currentDetailsList = (activeStudent?.items?.[currentDetailsKey] || []).slice();
  currentDetailsList.sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
  );

  const addStudentToLecturerList = (email) => {
    const e = normalizeEmail(email);
    if (!e) return;

    const exists = studentEntries.some((x) => normalizeEmail(x.email) === e);
    if (exists) {
      setActiveStudentEmail(e);
      setMsg("Student already added ✅");
      setTimeout(() => setMsg(""), 1200);
      return;
    }

    const next = [{ email: e, addedAt: new Date().toISOString() }, ...studentEntries];
    setStudentEntries(next);
    saveLecturerStudentEntries(lecturerEmail, next);
    setActiveStudentEmail(e);

    setMsg("Student added ✅");
    setTimeout(() => setMsg(""), 1500);
  };

  const removeStudentFromLecturerList = (email) => {
    const e = normalizeEmail(email);
    const next = studentEntries.filter((x) => normalizeEmail(x.email) !== e);
    setStudentEntries(next);
    saveLecturerStudentEntries(lecturerEmail, next);

    setMsg("Student removed ✅");
    setTimeout(() => setMsg(""), 1500);
  };

  const handleAddFromRegistry = () => {
    if (!selectedRegistryEmail) {
      setMsg("Please select a student from registry.");
      return;
    }
    addStudentToLecturerList(selectedRegistryEmail);
  };

  const handleQuickSearchSelect = () => {
    const e = normalizeEmail(quickSearch);
    if (!e) return;

    const users = getUsersRegistry();
    const exists = users.some((u) => normalizeEmail(u?.email) === e);
    if (!exists) {
      setMsg("No match in registry for this email.");
      return;
    }

    addStudentToLecturerList(e);
    setQuickSearch("");
  };

  const handleImportStudent = () => {
    try {
      const profile = upsertStudentDataFromExportJson(importText);
      addStudentToLecturerList(profile.email);
      setImportText("");
      setMsg("Imported student ✅");
      setTimeout(() => setMsg(""), 1500);
      setLiveTick((t) => t + 1);
    } catch (e) {
      setMsg("Import failed: " + (e?.message || "Invalid JSON"));
    }
  };

  // ✅ Save Note (now async)
  const handleSaveNote = async () => {
    const studentEmail = normalizeEmail(activeStudentEmail);
    if (!studentEmail) {
      setMsg("Select a student first.");
      return;
    }

    const text = (noteText || "").trim();
    if (!text) {
      setMsg("Please write a note first.");
      return;
    }

    await addStudentNote({
      studentEmail,
      text,
      lecturerEmail,
      lecturerName,
    });

    setNoteText("");
    await refreshNotesForActiveStudent();

    setMsg("Note saved ✅");
    setTimeout(() => setMsg(""), 1500);
  };

  // ✅ Modal derived list (search + sort)
  const modalNotes = useMemo(() => {
    const q = allNotesSearch.trim().toLowerCase();
    const base = Array.isArray(notesAll) ? [...notesAll] : [];

    if (allNotesSort === "oldest") {
      base.sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
    } else {
      base.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
    }

    if (!q) return base;

    return base.filter((n) => {
      const t = (n?.text || "").toLowerCase();
      const ln = (n?.lecturerName || "").toLowerCase();
      return t.includes(q) || ln.includes(q);
    });
  }, [notesAll, allNotesSearch, allNotesSort]);

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ marginBottom: "1rem" }}>Lecturer Dashboard</h1>

      {msg && <div style={noticeStyle}>{msg}</div>}

      {/* Registry Select + Search */}
      <div style={{ ...cardStyle, marginBottom: "1rem", maxWidth: "1100px" }}>
        <h2 style={{ marginBottom: "0.6rem" }}>Add Student from Registry</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by name/email/department..."
            value={registrySearch}
            onChange={(e) => setRegistrySearch(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />

          <select
            value={selectedRegistryEmail}
            onChange={(e) => setSelectedRegistryEmail(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 340px", minWidth: "320px" }}
            size={Math.min(8, Math.max(4, registryStudents.length || 4))}
          >
            <option value="" disabled>
              Select a student...
            </option>
            {registryStudents.map((u) => (
              <option key={normalizeEmail(u.email)} value={normalizeEmail(u.email)}>
                {u.name} — {normalizeEmail(u.email)} {u.department ? `(${u.department})` : ""}
              </option>
            ))}
          </select>

          <button type="button" style={primaryBtnStyle} onClick={handleAddFromRegistry}>
            Add
          </button>
        </div>

        <div style={{ marginTop: "10px", opacity: 0.85, fontSize: "0.9rem" }}>
          Registry count: <b>{registryStudents.length}</b>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {/* Left: Lecturer student list */}
        <div style={{ ...cardStyle, flex: "1 1 360px", minWidth: "340px" }}>
          <h2 style={{ marginBottom: "0.8rem" }}>My Students ({lecturerStudents.length})</h2>

          {/* Search + filters + sort */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="Search in my students (name/email/department)..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.9 }}>
                <input type="checkbox" checked={onlyMyDept} onChange={(e) => setOnlyMyDept(e.target.checked)} />
                Only my department{lecturerDept ? ` (${lecturerDept})` : ""}
              </label>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                style={{ ...inputStyle, padding: "0.65rem", minWidth: "220px" }}
              >
                <option value="total_desc">Sort: Total (High → Low)</option>
                <option value="name_asc">Sort: Name (A → Z)</option>
                <option value="newest">Sort: Newest Added</option>
              </select>
            </div>
          </div>

          {/* Quick add by email */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="Quick add by email (must exist in registry)"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              style={{ ...inputStyle, flex: "1 1 260px" }}
            />
            <button type="button" style={secondaryBtnStyle} onClick={handleQuickSearchSelect}>
              Add
            </button>
          </div>

          {lecturerStudents.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No students added yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {lecturerStudents.map((s) => (
                <div
                  key={normalizeEmail(s.email)}
                  style={{
                    ...listItemStyle,
                    border:
                      normalizeEmail(s.email) === normalizeEmail(activeStudentEmail)
                        ? "1px solid #4fa3ff"
                        : listItemStyle.border,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, wordBreak: "break-word" }}>{s.name}</div>
                      <div style={{ opacity: 0.8, fontSize: "0.9rem", wordBreak: "break-word" }}>
                        {normalizeEmail(s.email)}
                      </div>
                      {s.department ? <div style={{ opacity: 0.75, fontSize: "0.85rem" }}>{s.department}</div> : null}

                      <div style={{ marginTop: "8px", fontSize: "0.9rem", opacity: 0.9 }}>
                        Total: <b>{s.total}</b> • C:{s.stats.certificates} P:{s.stats.projects} Pub:{s.stats.publications} I:
                        {s.stats.issues}
                      </div>

                      <div style={{ marginTop: "6px", fontSize: "0.8rem", opacity: 0.7 }}>
                        Added: {s.addedAt ? new Date(s.addedAt).toLocaleString() : "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button type="button" style={secondaryBtnStyle} onClick={() => setActiveStudentEmail(normalizeEmail(s.email))}>
                        View
                      </button>
                      <button type="button" style={dangerBtnStyle} onClick={() => removeStudentFromLecturerList(normalizeEmail(s.email))}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Active student details */}
        <div style={{ ...cardStyle, flex: "2 1 520px", minWidth: "360px" }}>
          <h2 style={{ marginBottom: "0.8rem" }}>
            Student Details{" "}
            {activeStudentEmail ? <span style={{ opacity: 0.7, fontSize: "0.9rem" }}>(Live)</span> : null}
          </h2>

          {!activeStudent ? (
            <div style={{ opacity: "0.75" }}>Select a student from your list.</div>
          ) : (
            <>
              <div style={{ ...subCardStyle, marginBottom: "12px" }}>
                <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{activeStudent.profile.name}</div>
                <div style={{ opacity: 0.85 }}>{normalizeEmail(activeStudent.profile.email)}</div>
                <div style={{ opacity: 0.8, marginTop: "6px" }}>
                  {activeStudent.profile.department || "—"} • {activeStudent.profile.role || "Student"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                <MiniStat label="Certificates" value={activeStudent.stats.certificates} />
                <MiniStat label="Projects" value={activeStudent.stats.projects} />
                <MiniStat label="Publications" value={activeStudent.stats.publications} />
                <MiniStat label="Issues" value={activeStudent.stats.issues} />
              </div>

              {/* Notes */}
              <div style={{ marginTop: "14px" }}>
                <h3 style={{ marginBottom: "8px" }}>Lecturer Feedback / Notes</h3>

                <div style={{ ...subCardStyle, marginBottom: "12px" }}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write feedback for this student..."
                    style={{
                      width: "100%",
                      minHeight: "90px",
                      resize: "vertical",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #555",
                      backgroundColor: "#1f2125",
                      color: "white",
                      fontFamily: "inherit",
                      fontSize: "0.95rem",
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button type="button" style={primaryBtnStyle} onClick={handleSaveNote}>
                      Save Note
                    </button>
                    <div style={{ opacity: 0.75, fontSize: "0.85rem", alignSelf: "center" }}>
                      Saved notes appear in student Profile (read-only).
                    </div>
                  </div>
                </div>

                <div style={{ ...subCardStyle }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 800 }}>
                      Latest Notes <span style={{ opacity: 0.8 }}>({notesPreview.length})</span>
                    </div>

                    <button
                      type="button"
                      style={{
                        ...secondaryBtnStyle,
                        padding: "0.55rem 0.8rem",
                        borderRadius: "10px",
                      }}
                      onClick={() => setShowAllNotes(true)}
                      disabled={!activeStudentEmail}
                      title={!activeStudentEmail ? "Select a student first" : "View all notes"}
                    >
                      View all notes ({notesAll.length})
                    </button>
                  </div>

                  {notesPreview.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>No notes yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {notesPreview.map((n) => (
                        <div key={n.id} style={noteItemStyle}>
                          {editingNoteId === n.id ? (
                            <>
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                style={{
                                  width: "100%",
                                  minHeight: "80px",
                                  padding: "8px",
                                  borderRadius: "6px",
                                  border: "1px solid #555",
                                  backgroundColor: "#1f2125",
                                  color: "white",
                                }}
                              />

                              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  style={primaryBtnStyle}
                                  onClick={async () => {
                                    await updateStudentNote(activeStudentEmail, n.id, editingText);
                                    setEditingNoteId(null);
                                    setEditingText("");
                                    await refreshNotesForActiveStudent();
                                  }}
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  style={secondaryBtnStyle}
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.35rem" }}>
                                {n.text}
                              </div>

                              <div style={{ marginTop: "6px", opacity: 0.8, fontSize: "0.85rem" }}>
                                {n.createdAt ? new Date(n.createdAt).toLocaleString() : "—"}
                                {n.editedAt ? " • edited" : ""}
                              </div>

                              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  style={secondaryBtnStyle}
                                  onClick={() => {
                                    setEditingNoteId(n.id);
                                    setEditingText(n.text);
                                  }}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  style={dangerBtnStyle}
                                  onClick={async () => {
                                    if (window.confirm("Delete this note?")) {
                                      await deleteStudentNote(activeStudentEmail, n.id);
                                      await refreshNotesForActiveStudent();
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ marginTop: "14px" }}>
                <h3 style={{ marginBottom: "10px" }}>Achievements (Full List)</h3>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {detailsTabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDetailsTab(t)}
                      style={{
                        padding: "0.55rem 0.9rem",
                        borderRadius: "10px",
                        border: "1px solid #3b3d42",
                        backgroundColor: detailsTab === t ? "#4fa3ff" : "#1f2125",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div style={{ ...subCardStyle, maxHeight: "340px", overflow: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 800 }}>
                      {detailsTab} <span style={{ opacity: 0.8 }}>({currentDetailsList.length})</span>
                    </div>
                    <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>{singularLabel(detailsTab)} items</div>
                  </div>

                  {currentDetailsList.length === 0 ? (
                    <div style={{ opacity: 0.75, fontSize: "0.95rem" }}>No items in this category.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {currentDetailsList.map((it) => (
                        <div key={it.id} style={detailItemStyle}>
                          <div style={{ fontWeight: 800, wordBreak: "break-word" }}>{it.title}</div>

                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "6px" }}>
                            {it.link ? (
                              <a
                                href={it.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#4fa3ff", fontWeight: 700, fontSize: "0.9rem" }}
                              >
                                Open link
                              </a>
                            ) : (
                              <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>No link</div>
                            )}

                            <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                              {it.createdAt ? `Created: ${new Date(it.createdAt).toLocaleString()}` : "Created: —"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fallback import (keep) */}
      <div style={{ ...cardStyle, marginTop: "1rem", maxWidth: "1100px" }}>
        <h2 style={{ marginBottom: "0.6rem" }}>Add Student by Export JSON (fallback)</h2>
        <div style={{ fontSize: "0.85rem", opacity: 0.8, marginBottom: "0.8rem" }}>
          Paste the student's <b>Export Data</b> JSON here.
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          <button type="button" style={primaryBtnStyle} onClick={handleImportStudent}>
            Import Student
          </button>
        </div>

        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste student export JSON here..."
          style={{
            width: "100%",
            minHeight: "160px",
            resize: "vertical",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #555",
            backgroundColor: "#1f2125",
            color: "white",
            fontFamily: "monospace",
            fontSize: "0.85rem",
          }}
        />
      </div>

      {/* ✅ View All Notes Modal */}
      {showAllNotes && (
        <div
          style={modalOverlayStyle}
          onClick={() => setShowAllNotes(false)}
          role="presentation"
        >
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>
                All Notes{" "}
                <span style={{ opacity: 0.8, fontWeight: 700 }}>({notesAll.length})</span>
              </div>

              <button
                type="button"
                style={{ ...secondaryBtnStyle, padding: "0.55rem 0.8rem", borderRadius: "10px" }}
                onClick={() => setShowAllNotes(false)}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={allNotesSearch}
                onChange={(e) => setAllNotesSearch(e.target.value)}
                placeholder="Search notes (text or lecturer name)..."
                style={{ ...inputStyle, flex: "1 1 280px" }}
              />

              <select
                value={allNotesSort}
                onChange={(e) => setAllNotesSort(e.target.value)}
                style={{ ...inputStyle, padding: "0.65rem", minWidth: "220px" }}
              >
                <option value="newest">Sort: Newest → Oldest</option>
                <option value="oldest">Sort: Oldest → Newest</option>
              </select>
            </div>

            <div style={{ marginTop: "12px", ...subCardStyle, maxHeight: "420px", overflow: "auto" }}>
              {modalNotes.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No results.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {modalNotes.map((n) => (
                    <div key={n.id} style={noteItemStyle}>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.35rem" }}>
                        {n.text}
                      </div>

                      <div style={{ marginTop: "6px", opacity: 0.85, fontSize: "0.85rem" }}>
                        {n.lecturerName ? `By: ${n.lecturerName}` : "By: Lecturer"}
                        {n.createdAt ? ` • ${new Date(n.createdAt).toLocaleString()}` : ""}
                        {n.editedAt ? " • edited" : ""}
                      </div>

                      {/* Optional quick actions inside modal */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={secondaryBtnStyle}
                          onClick={() => {
                            setEditingNoteId(n.id);
                            setEditingText(n.text);
                            setShowAllNotes(false);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          style={dangerBtnStyle}
                          onClick={async () => {
                            if (window.confirm("Delete this note?")) {
                              await deleteStudentNote(activeStudentEmail, n.id);
                              await refreshNotesForActiveStudent();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "10px", opacity: 0.75, fontSize: "0.85rem" }}>
              Tip: Use search to find keywords quickly (works on note text + lecturer name).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------
// UI components/styles
// --------------------
function MiniStat({ label, value }) {
  return (
    <div style={miniStatStyle}>
      <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: "#26282c",
  borderRadius: "8px",
  padding: "1.5rem",
  border: "1px solid #3b3d42",
};

const subCardStyle = {
  backgroundColor: "#303238",
  borderRadius: "8px",
  padding: "12px",
  border: "1px solid #3b3d42",
};

const listItemStyle = {
  backgroundColor: "#303238",
  border: "1px solid #3b3d42",
  borderRadius: "8px",
  padding: "10px",
};

const detailItemStyle = {
  backgroundColor: "#26282c",
  border: "1px solid #3b3d42",
  borderRadius: "10px",
  padding: "10px",
};

const noteItemStyle = {
  backgroundColor: "#26282c",
  border: "1px solid #3b3d42",
  borderRadius: "10px",
  padding: "10px",
};

const noticeStyle = {
  marginBottom: "12px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #3b3d42",
  backgroundColor: "#1f2125",
  color: "#d0d3da",
  maxWidth: "1100px",
};

const inputStyle = {
  padding: "0.8rem",
  borderRadius: "6px",
  border: "1px solid #555",
  backgroundColor: "#3a3d42",
  color: "white",
};

const primaryBtnStyle = {
  padding: "0.7rem 1rem",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#4fa3ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  maxWidth: "220px",
};

const secondaryBtnStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #3b3d42",
  backgroundColor: "#1f2125",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerBtnStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #5a2a2a",
  backgroundColor: "#b23b3b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const miniStatStyle = {
  backgroundColor: "#303238",
  border: "1px solid #3b3d42",
  borderRadius: "10px",
  padding: "12px",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 9999,
};

const modalCardStyle = {
  width: "min(900px, 100%)",
  backgroundColor: "#26282c",
  borderRadius: "12px",
  border: "1px solid #3b3d42",
  padding: "14px",
};

export default LecturerPage;
