// src/App.js
import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import "./App.css";

import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/Register/RegisterPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import AchievementsPage from "./pages/Achievements/AchievementsPage";
import LecturerPage from "./pages/Lecturer/LecturerPage";
import ChatPage from "./pages/Chat/ChatPage";

import { clearUserStorage, getActiveProfile } from "./utils/storage";

/* ================= HELPERS ================= */

const normalizeRole = (r) => String(r || "Student").trim().toLowerCase();

/* ================= PAGES ================= */

function AccessDeniedPage() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const role = profile?.role || "Unknown";

  return (
    <div style={{ padding: "2rem", color: "white", maxWidth: 800 }}>
      <h2>Access denied</h2>
      <p style={{ opacity: 0.9 }}>
        You don’t have permission to view this page.
      </p>
      <p style={{ opacity: 0.9 }}>
        Current role: <b>{role}</b>
      </p>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "0.6rem 1rem" }}>
          Back to Dashboard
        </button>
        <button onClick={() => navigate("/profile")} style={{ padding: "0.6rem 1rem" }}>
          Open Profile
        </button>
      </div>
    </div>
  );
}

/* ================= APP ================= */

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(() => getActiveProfile());
  const isLoggedIn = !!profile;
  const userName = profile?.name || "";
  const userRole = profile?.role || "Student";

  const syncProfile = () => {
    setProfile(getActiveProfile());
  };

  useEffect(() => {
    syncProfile();
  }, [location.pathname]);

  useEffect(() => {
    window.addEventListener("rnu_profile_updated", syncProfile);
    return () => window.removeEventListener("rnu_profile_updated", syncProfile);
  }, []);

  /* ================= USER MENU ================= */

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const handleLogout = () => {
    clearUserStorage();
    setProfile(null);
    setUserMenuOpen(false);
    navigate("/login");
  };

  /* ================= ROUTE GUARD ================= */

  const RequireRole = ({ roles, children }) => {
    const active = getActiveProfile();
    if (!active) return <Navigate to="/login" replace />;

    if (!roles || roles.length === 0) return children;

    const role = normalizeRole(active.role);
    const allowed = roles.map(normalizeRole);

    if (!allowed.includes(role)) {
      return <Navigate to="/access-denied" replace />;
    }

    return children;
  };

  /* ================= NAV ================= */

  const path = location.pathname;
  const isAuthPage = path === "/login" || path === "/register";

  const roleNormalized = normalizeRole(userRole);
  const isLecturerOrAdmin = roleNormalized === "lecturer" || roleNormalized === "admin";

  return (
    <div className="App">
      <header className="App-header">
        <h2>RNU Innovative Hub</h2>

        {!isAuthPage && isLoggedIn && (
          <nav className="App-nav">
            {path !== "/dashboard" && <Link to="/dashboard">Dashboard</Link>}
            {path !== "/achievements" && <Link to="/achievements">Achievements</Link>}
            {path !== "/chat" && <Link to="/chat">AI Chat</Link>}
            {isLecturerOrAdmin && path !== "/lecturer" && <Link to="/lecturer">Lecturer</Link>}

            <span className="App-spacer" />

            <div className="App-userWrap" ref={userMenuRef}>
              <span
                className="App-userPill App-userClickable"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <span className="App-avatar">
                  {(userName || "U").trim().charAt(0).toUpperCase()}
                </span>
                <span className="App-userText">
                  <span className="App-userLabel">User:</span> {userName || "User"}
                </span>
                <span className="App-caret">{userMenuOpen ? "▲" : "▼"}</span>
              </span>

              {userMenuOpen && (
                <div className="App-dropdown">
                  <div className="App-ddInfo">
                    <div className="App-ddInfoLabel">Role</div>
                    <div className="App-ddInfoValue">{userRole}</div>
                  </div>

                  {path !== "/profile" && (
                    <button className="App-ddItem" onClick={() => navigate("/profile")}>
                      Profile
                    </button>
                  )}

                  <button className="App-ddItem App-ddDanger" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="App-main">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/access-denied" element={<RequireRole><AccessDeniedPage /></RequireRole>} />

          <Route path="/dashboard" element={<RequireRole><DashboardPage /></RequireRole>} />
          <Route path="/profile" element={<RequireRole><ProfilePage /></RequireRole>} />
          <Route
            path="/achievements"
            element={
              <RequireRole roles={["Student", "Lecturer", "Admin"]}>
                <AchievementsPage />
              </RequireRole>
            }
          />
          <Route
            path="/chat"
            element={
              <RequireRole roles={["Student", "Lecturer", "Admin"]}>
                <ChatPage />
              </RequireRole>
            }
          />
          <Route
            path="/lecturer"
            element={
              <RequireRole roles={["Lecturer", "Admin"]}>
                <LecturerPage />
              </RequireRole>
            }
          />

          <Route
            path="*"
            element={
              <div style={{ padding: "2rem", color: "white" }}>
                <h2>Page not found</h2>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
