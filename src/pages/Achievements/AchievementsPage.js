import React, { useEffect, useMemo, useState } from "react";
import {
  getActiveProfile,
  syncStatsFromItems,
  exportAllRnuData,
  importAllRnuData,
  addItem as addItemLocal,
  removeItem as removeItemLocal,
  setItems as setItemsLocal,
} from "../../utils/storage";
import { studentApi } from "../../services/studentApi";

function AchievementsPage() {
  const STORAGE_MODE = String(process.env.REACT_APP_STORAGE_MODE || "local").toLowerCase();
  const isApiMode = STORAGE_MODE === "api";

  const profile = getActiveProfile();
  const email = (profile?.email || "").trim().toLowerCase();

  const tabs = ["Certificates", "Projects", "Publications", "University Issues"];
  const [activeTab, setActiveTab] = useState("Certificates");

  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");

  // items loaded async (local + api)
  const [items, setItemsState] = useState({
    certificates: [],
    projects: [],
    publications: [],
    issues: [],
  });

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const [dataText, setDataText] = useState("");
  const [msg, setMsg] = useState("");

  const [lastDeleted, setLastDeleted] = useState(null); // { key, item }

  const tabToKey = (tab) => {
    if (tab === "Certificates") return "certificates";
    if (tab === "Projects") return "projects";
    if (tab === "Publications") return "publications";
    return "issues";
  };

  const singularLabel = (tab) => {
    if (tab === "University Issues") return "Issue";
    return tab.slice(0, -1);
  };

  const currentKey = useMemo(() => tabToKey(activeTab), [activeTab]);
  const currentList = useMemo(() => (items[currentKey] || []), [items, currentKey]);

  const fetchItems = async () => {
    if (!email) {
      setItemsState({ certificates: [], projects: [], publications: [], issues: [] });
      return;
    }

    setLoading(true);
    setLoadErr("");
    try {
      // ✅ contract-based (email required now)
      const data = await studentApi.getItems(email, "all");

      // Our api.js mock returns legacy per-user object for now (certificates/projects/...)
      setItemsState({
        certificates: Array.isArray(data?.certificates) ? data.certificates : [],
        projects: Array.isArray(data?.projects) ? data.projects : [],
        publications: Array.isArray(data?.publications) ? data.publications : [],
        issues: Array.isArray(data?.issues) ? data.issues : [],
      });
    } catch (e) {
      setLoadErr(e?.message || "Failed to load achievements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    const onItemsUpdated = () => fetchItems();
    window.addEventListener("rnu_items_updated", onItemsUpdated);
    return () => window.removeEventListener("rnu_items_updated", onItemsUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isApiMode) syncStatsFromItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!email) return;

    const newItem = {
      id: Date.now(), // local id; backend will override to string id later
      title: title.trim(),
      link: link.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // ✅ Write via API client (single source for writes)
      await studentApi.addItem(email, currentKey, newItem);

      setTitle("");
      setLink("");
      if (!isApiMode) syncStatsFromItems();

      setMsg("Saved ✅");
      setTimeout(() => setMsg(""), 1400);

      fetchItems();
    } catch (e2) {
      setMsg("Save failed: " + (e2?.message || "Unknown error"));
    }
  };

  const handleDelete = async (key, item) => {
    const ok = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!ok) return;
    if (!email) return;

    try {
      await studentApi.removeItem(email, key, item.id);

      if (!isApiMode) syncStatsFromItems();
      setLastDeleted({ key, item });

      setMsg("Item deleted ✅ (Undo available)");
      setTimeout(() => setMsg(""), 1800);

      fetchItems();
    } catch (e) {
      setMsg("Delete failed: " + (e?.message || "Unknown error"));
    }
  };

  // ✅ Undo delete
  // - API mode: disabled (needs backend restore/upsert design)
  // - Local mode: uses local fallback then refresh
  const handleUndo = async () => {
    if (!lastDeleted) return;

    if (isApiMode) {
      setMsg("Undo is disabled in API mode for now.");
      setTimeout(() => setMsg(""), 1600);
      return;
    }

    try {
      const { key, item } = lastDeleted;
      const restored = { ...item, updatedAt: new Date().toISOString() };

      // Local fallback restore (keeps your old behavior)
      addItemLocal(key, restored);
      syncStatsFromItems();

      setLastDeleted(null);
      setMsg("Undo ✅ Item restored");
      setTimeout(() => setMsg(""), 1500);

      fetchItems();
    } catch (e) {
      setMsg("Undo failed: " + (e?.message || "Unknown error"));
    }
  };

  // ✅ Edit item (title/link)
  // - API mode: disabled until update contract wiring is added to studentApi
  // - Local mode: same old behavior
  const handleEdit = async (key, itemId) => {
    if (isApiMode) {
      setMsg("Edit is disabled in API mode for now.");
      setTimeout(() => setMsg(""), 1600);
      return;
    }

    const list = Array.isArray(items[key]) ? items[key] : [];
    const target = list.find((x) => x.id === itemId);
    if (!target) return;

    const nextTitle = window.prompt("Edit title:", target.title || "");
    if (nextTitle === null) return;

    const nextLink = window.prompt("Edit link (optional):", target.link || "");
    if (nextLink === null) return;

    const updatedList = list.map((x) =>
      x.id === itemId
        ? {
            ...x,
            title: (nextTitle || "").trim(),
            link: (nextLink || "").trim(),
            updatedAt: new Date().toISOString(),
          }
        : x
    );

    const nextAll = { ...items, [key]: updatedList };
    setItemsLocal(nextAll);
    window.dispatchEvent(new Event("rnu_items_updated"));
    if (!isApiMode) syncStatsFromItems();

    setMsg("Item updated ✅");
    setTimeout(() => setMsg(""), 1400);
  };

  const handleExport = () => {
    try {
      const text = exportAllRnuData();
      setDataText(text);
      setMsg("Exported ✅ Now copy this JSON and paste it into the Import box on the other port.");
    } catch (e) {
      setMsg("Export failed: " + (e?.message || "Unknown error"));
    }
  };

  const handleImport = () => {
    try {
      importAllRnuData(dataText);
      fetchItems();
      setMsg("Imported ✅ Data restored. Go to Profile to verify stats.");
    } catch (e) {
      setMsg("Import failed: Invalid JSON or blocked storage.");
    }
  };

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ marginBottom: "1rem" }}>Achievements</h1>

      {loading && <div style={{ opacity: 0.8, marginBottom: "10px" }}>Loading achievements...</div>}
      {loadErr && (
        <div style={{ marginBottom: "10px", color: "#ffb3b3" }}>
          Failed to load: {loadErr}{" "}
          <button type="button" style={secondaryBtnStyle} onClick={fetchItems}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #3b3d42",
              backgroundColor: activeTab === t ? "#4fa3ff" : "#26282c",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {lastDeleted && (
        <div style={undoBarStyle}>
          <div style={{ fontWeight: 700 }}>
            Deleted: <span style={{ opacity: 0.9 }}>{lastDeleted.item?.title}</span>
          </div>
          <button type="button" style={secondaryBtnStyle} onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={cardStyle}>
          <h2 style={{ marginBottom: "0.8rem" }}>Add {singularLabel(activeTab)}</h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <input
              type="text"
              placeholder={`${singularLabel(activeTab)} Title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Link (optional)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              style={inputStyle}
            />

            <button type="submit" style={primaryBtnStyle}>
              Save
            </button>

            <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              Stats update automatically on Profile{isApiMode ? " (local stats sync disabled in API mode for now)." : "."}
            </div>
          </form>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginBottom: "0.8rem" }}>
            {activeTab} ({currentList.length})
          </h2>

          {currentList.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No items yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {currentList.map((it) => (
                <div key={it.id} style={listItemStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: "700", wordBreak: "break-word" }}>{it.title}</div>

                      {it.link ? (
                        <a href={it.link} target="_blank" rel="noreferrer" style={{ color: "#4fa3ff", fontSize: "0.9rem" }}>
                          Open link
                        </a>
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>No link</div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => handleEdit(currentKey, it.id)} style={secondaryBtnStyle} title="Edit item">
                        Edit
                      </button>

                      <button type="button" onClick={() => handleDelete(currentKey, it)} style={dangerBtnStyle} title="Delete item">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: "1rem", maxWidth: "1100px" }}>
        <h2 style={{ marginBottom: "0.6rem" }}>Data Tools (Export / Import)</h2>
        <div style={{ fontSize: "0.85rem", opacity: 0.8, marginBottom: "0.8rem" }}>
          Use this to move your data between <b>localhost:3001</b> and <b>localhost:3000</b>.
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          <button type="button" style={primaryBtnStyle} onClick={handleExport}>
            Export Data
          </button>

          <button type="button" style={primaryBtnStyle} onClick={handleImport}>
            Import Data
          </button>
        </div>

        <textarea
          value={dataText}
          onChange={(e) => setDataText(e.target.value)}
          placeholder="Export will appear here... (or paste JSON here to import)"
          style={{
            width: "100%",
            minHeight: "180px",
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

        {msg && <div style={{ marginTop: "10px", color: "#d0d3da" }}>{msg}</div>}
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: "#26282c",
  borderRadius: "8px",
  padding: "1.5rem",
  border: "1px solid #3b3d42",
  flex: "1 1 360px",
  minWidth: "320px",
};

const undoBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #3b3d42",
  backgroundColor: "#1f2125",
  marginBottom: "12px",
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
  maxWidth: "200px",
};

const secondaryBtnStyle = {
  padding: "0.55rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid #3b3d42",
  backgroundColor: "#1f2125",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerBtnStyle = {
  padding: "0.55rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid #5a2a2a",
  backgroundColor: "#b23b3b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const listItemStyle = {
  backgroundColor: "#303238",
  border: "1px solid #3b3d42",
  borderRadius: "8px",
  padding: "10px",
};

export default AchievementsPage;
