import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getActiveProfile, setActiveProfile } from "../../utils/storage";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // If already logged in, redirect away from auth page
  useEffect(() => {
    const active = getActiveProfile();
    if (active) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const getUsers = () => {
    try {
      const raw = localStorage.getItem("rnu_users");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const ensureUserDataContainers = (emailLower) => {
    const itemsKey = `rnu_items__${emailLower}`;
    const statsKey = `rnu_stats__${emailLower}`;

    if (!localStorage.getItem(itemsKey)) {
      localStorage.setItem(
        itemsKey,
        JSON.stringify({ certificates: [], projects: [], publications: [], issues: [] })
      );
    }

    if (!localStorage.getItem(statsKey)) {
      localStorage.setItem(
        statsKey,
        JSON.stringify({ certificates: 0, projects: 0, publications: 0, issues: 0 })
      );
    }
  };

  const handleLogin = () => {
    const e = email.trim().toLowerCase();

    if (!e) return setMsg("Please enter your email.");
    if (!password.trim()) return setMsg("Please enter your password.");

    const users = getUsers();
    const user = users.find((u) => (u?.email || "").toLowerCase() === e);

    if (!user) return setMsg("User not found. Please Register first.");
    if (user.password !== password) return setMsg("Incorrect password (demo).");

    ensureUserDataContainers(e);

    // ✅ TAB-BASED session: single source through storage utils
    sessionStorage.setItem("token", "demo-token");
    setActiveProfile({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    });

    // setActiveProfile should dispatch "rnu_profile_updated" internally,
    // but we keep this for backward compatibility if needed.
    window.dispatchEvent(new Event("rnu_profile_updated"));

    navigate("/dashboard");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "80vh",
        color: "white",
        padding: "1rem",
      }}
    >
      <h1 style={{ marginBottom: "2rem" }}>Login</h1>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          handleLogin();
        }}
        style={{ display: "flex", flexDirection: "column", width: "320px", gap: "1rem" }}
      >
        <input
          type="email"
          placeholder="Email"
          style={inputStyle}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          style={inputStyle}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />

        <button type="submit" style={buttonStyle}>
          Login
        </button>

        {msg && <div style={{ opacity: 0.85, fontSize: "0.9rem" }}>{msg}</div>}
      </form>

      <p style={{ marginTop: "1rem" }}>
        No account?
        <Link to="/register" style={{ color: "#4fa3ff", marginLeft: "0.5rem" }}>
          Register
        </Link>
      </p>
    </div>
  );
}

const inputStyle = {
  padding: "0.8rem",
  borderRadius: "6px",
  border: "1px solid #555",
  backgroundColor: "#3a3d42",
  color: "white",
};
const buttonStyle = {
  padding: "0.8rem",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#4fa3ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

export default LoginPage;
