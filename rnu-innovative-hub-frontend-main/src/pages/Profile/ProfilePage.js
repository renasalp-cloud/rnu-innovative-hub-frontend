import React, { useEffect, useState } from "react";
import {
  getStats,
  syncStatsFromItems,
  getActiveProfile,
  setActiveProfile,
} from "../../utils/storage";

// --------------------
// Notes helpers (Lecturer -> Student)
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
const notesKeyForEmail = (email) => `rnu_notes__${normalizeEmail(email)}`;

const getStudentNotes = (email) => {
  const raw = localStorage.getItem(notesKeyForEmail(email));
  const list = safeJsonParse(raw);
  return Array.isArray(list) ? list : [];
};

// OPTIONAL: keep registry in sync (local mock users list)
const updateUserInRegistry = (updatedProfile) => {
  const email = normalizeEmail(updatedProfile?.email);
  if (!email) return;

  try {
    const raw = localStorage.getItem("rnu_users");
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;

    const next = list.map((u) => {
      const ue = normalizeEmail(u?.email);
      if (ue !== email) return u;
      return {
        ...u,
        name: updatedProfile.name,
        department: updatedProfile.department,
        role: updatedProfile.role,
        updatedAt: new Date().toISOString(),
      };
    });

    localStorage.setItem("rnu_users", JSON.stringify(next));
  } catch {}
};

function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStatsState] = useState(getStats());

  const totalAchievements =
    stats.certificates + stats.projects + stats.publications + stats.issues;

  const emptyUserInfo = {
    name: "",
    email: "",
    role: "",
    department: "",
  };

  const [userInfo, setUserInfo] = useState(() => {
    const p = getActiveProfile();
    return p || emptyUserInfo;
  });

  // edit form only Name + Department (email/role readonly)
  const [formData, setFormData] = useState(() => {
    const p = getActiveProfile();
    return p || emptyUserInfo;
  });

  // lecturer notes (read-only in student profile)
  const [notes, setNotes] = useState(() => {
    const p = getActiveProfile();
    const email = normalizeEmail(p?.email);
    if (!email) return [];
    const list = getStudentNotes(email);
    list.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    return list;
  });

  //  NEW: view toggle for notes
  const [showAllNotes, setShowAllNotes] = useState(false);
  const NOTES_PREVIEW_COUNT = 10;

  const refreshNotes = () => {
    const p = getActiveProfile();
    const email = normalizeEmail(p?.email);
    if (!email) {
      setNotes([]);
      return;
    }
    const list = getStudentNotes(email);
    list.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    setNotes(list);
  };

  // load profile (sessionStorage via getActiveProfile)
  useEffect(() => {
    const p = getActiveProfile();
    if (p) {
      setUserInfo(p);
      setFormData(p);
      refreshNotes();
      return;
    }

    setUserInfo(emptyUserInfo);
    setFormData(emptyUserInfo);
    setNotes([]);
  }, []);

  // ALWAYS sync stats from items when Profile opens
  useEffect(() => {
    const fixed = syncStatsFromItems();
    setStatsState(fixed);
  }, []);

  // listen stats updates (Achievements submit)
  useEffect(() => {
    const onStatsUpdated = () => setStatsState(getStats());
    window.addEventListener("rnu_stats_updated", onStatsUpdated);
    return () => window.removeEventListener("rnu_stats_updated", onStatsUpdated);
  }, []);

  // listen profile updates (Login/Register/Edit)
  useEffect(() => {
    const onProfileUpdated = () => {
      const p = getActiveProfile();
      if (!p) {
        setUserInfo(emptyUserInfo);
        setFormData(emptyUserInfo);
        setNotes([]);
        setShowAllNotes(false);
        return;
      }

      setUserInfo(p);
      setFormData(p);
      refreshNotes();
    };

    window.addEventListener("rnu_profile_updated", onProfileUpdated);
    return () => window.removeEventListener("rnu_profile_updated", onProfileUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // listen notes updates (same tab + cross-tab) — single strategy
  useEffect(() => {
    let bc;

    const onNotesUpdated = () => refreshNotes();

    // same tab
    window.addEventListener("rnu_notes_updated", onNotesUpdated);

    // cross-tab (preferred)
    try {
      bc = new BroadcastChannel("rnu_notes_channel");
      bc.onmessage = (msg) => {
        if (msg?.data?.type === "notes_updated") refreshNotes();
      };
    } catch {}

    return () => {
      window.removeEventListener("rnu_notes_updated", onNotesUpdated);
      if (bc) bc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditToggle = () => {
    if (!isEditing) {
      setFormData({ ...userInfo });
      setIsEditing(true);
    } else {
      setFormData({ ...userInfo });
      setIsEditing(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // only allow editing name + department
    const next = {
      ...userInfo,
      name: String(formData.name || "").trim(),
      department: String(formData.department || "").trim(),
    };

    if (!next.name) return;

    setUserInfo(next);
    setFormData(next);

    // update session (single source of truth + event)
    setActiveProfile(next);

    // keep registry in sync (optional)
    updateUserInRegistry(next);

    setIsEditing(false);
  };

  const getBadgeStyle = (isUnlocked) => ({
    width: "170px",
    border: isUnlocked ? "1px solid #4fa3ff" : "1px solid #3b3d42",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor: "#26282c",
  });

  const badges = [
    {
      id: 1,
      icon: "📜",
      title: "First Certificate",
      description: "Add your first certificate to unlock this badge.",
      isUnlocked: stats.certificates > 0,
    },
    {
      id: 2,
      icon: "🧪",
      title: "First Project",
      description: "Add at least one project to unlock.",
      isUnlocked: stats.projects > 0,
    },
    {
      id: 3,
      icon: "📰",
      title: "First Publication",
      description: "Unlock by adding your first publication.",
      isUnlocked: stats.publications > 0,
    },
    {
      id: 4,
      icon: "🔓",
      title: "5 Achievements",
      description: "Reach a total of 5 achievements.",
      isUnlocked: totalAchievements >= 5,
    },
  ];

  const isProfileMissing = !getActiveProfile()?.email;

  const notesToShow = showAllNotes ? notes : notes.slice(0, NOTES_PREVIEW_COUNT);

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>My Profile</h1>

      {isProfileMissing && (
        <div style={noticeStyle}>
          No profile found. Please login/register to create a user profile.
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <SummaryCard label="Certificates" value={stats.certificates} />
        <SummaryCard label="Projects" value={stats.projects} />
        <SummaryCard label="Publications" value={stats.publications} />
        <SummaryCard label="Issues" value={stats.issues} />
      </div>

      {/* USER INFO + EDIT SIDE BY SIDE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isEditing ? "1fr 1fr" : "1fr",
          gap: "1rem",
          alignItems: "start",
          maxWidth: isEditing ? "1000px" : "500px",
        }}
      >
        {/* USER INFO CARD */}
        <div
          style={{
            backgroundColor: "#26282c",
            borderRadius: "8px",
            padding: "1.5rem",
            border: "1px solid #3b3d42",
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>User Information</h2>
          <p>
            <strong>Name:</strong> {userInfo.name || "—"}
          </p>
          <p>
            <strong>Email:</strong> {userInfo.email || "—"}
          </p>
          <p>
            <strong>Role:</strong> {userInfo.role || "—"}
          </p>
          <p>
            <strong>Department:</strong> {userInfo.department || "—"}
          </p>

          <button
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#4fa3ff",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              opacity: isProfileMissing ? 0.6 : 1,
            }}
            onClick={handleEditToggle}
            disabled={isProfileMissing}
            title={isProfileMissing ? "Login/register first" : "Edit profile"}
          >
            {isEditing ? "Close Edit" : "Edit Profile"}
          </button>
        </div>

        {/* EDIT PANEL */}
        {isEditing && (
          <div
            style={{
              backgroundColor: "#26282c",
              borderRadius: "8px",
              padding: "1.5rem",
              border: "1px solid #3b3d42",
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>Edit Profile</h2>

            <form style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
              />

              <input type="email" value={formData.email} style={{ ...inputStyle, opacity: 0.7 }} disabled />
              <input type="text" value={formData.role} style={{ ...inputStyle, opacity: 0.7 }} disabled />

              <input
                type="text"
                placeholder="Department / Program"
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
                style={inputStyle}
              />

              <button
                type="button"
                onClick={handleSave}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.6rem 1rem",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#4fa3ff",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
            </form>
          </div>
        )}
      </div>

      {/* BADGES */}
      <div
        style={{
          marginTop: "1.5rem",
          backgroundColor: "#26282c",
          borderRadius: "8px",
          padding: "1.5rem",
          border: "1px solid #3b3d42",
          maxWidth: "800px",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Achievement Badges</h2>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {badges.map((badge) => (
            <div key={badge.id} style={getBadgeStyle(badge.isUnlocked)}>
              <div style={{ fontSize: "22px" }}>{badge.icon}</div>
              <div style={{ fontSize: "0.9rem", marginTop: "6px", fontWeight: "600" }}>
                {badge.title}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cfcfcf", marginTop: "6px", lineHeight: "1.3rem" }}>
                {badge.description}
              </div>
              {badge.isUnlocked && (
                <div style={{ fontSize: "0.8rem", marginTop: "10px", fontWeight: "bold", color: "#4fa3ff" }}>
                  Unlocked ✅
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* LECTURER NOTES (Read-only) */}
      <div
        style={{
          marginTop: "1.5rem",
          backgroundColor: "#26282c",
          borderRadius: "8px",
          padding: "1.5rem",
          border: "1px solid #3b3d42",
          maxWidth: "800px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>
            Lecturer Notes <span style={{ opacity: 0.75 }}>({notes.length})</span>
          </h2>

          {notes.length > NOTES_PREVIEW_COUNT && (
            <button
              type="button"
              style={{
                padding: "0.55rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid #3b3d42",
                backgroundColor: "#1f2125",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
              onClick={() => setShowAllNotes((v) => !v)}
            >
              {showAllNotes ? "Show latest" : "View all notes"}
            </button>
          )}
        </div>

        <div style={{ marginTop: "1rem" }}>
          {isProfileMissing ? (
            <div style={{ opacity: 0.75 }}>Login first to view lecturer notes.</div>
          ) : notes.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No notes yet.</div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: showAllNotes ? "420px" : "unset",
                overflow: showAllNotes ? "auto" : "visible",
                paddingRight: showAllNotes ? "6px" : 0,
              }}
            >
              {notesToShow.map((n) => (
                <div
                  key={n.id}
                  style={{
                    backgroundColor: "#303238",
                    border: "1px solid #3b3d42",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.35rem" }}>
                    {n.text}
                  </div>

                  <div style={{ marginTop: "8px", opacity: 0.8, fontSize: "0.85rem" }}>
                    {n.lecturerName ? `By: ${n.lecturerName}` : "By: Lecturer"}
                    {n.createdAt ? ` • ${new Date(n.createdAt).toLocaleString()}` : ""}
                    {n.editedAt ? " • edited" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const noticeStyle = {
  marginBottom: "1rem",
  padding: "0.8rem 1rem",
  borderRadius: "8px",
  border: "1px solid #3b3d42",
  backgroundColor: "#1f2125",
  color: "#d0d3da",
  maxWidth: "800px",
};

const inputStyle = {
  padding: "0.7rem",
  borderRadius: "6px",
  border: "1px solid #555",
  backgroundColor: "#3a3d42",
  color: "white",
};

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#26282c",
        borderRadius: "8px",
        padding: "1rem",
        border: "1px solid #3b3d42",
      }}
    >
      <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

export default ProfilePage;
