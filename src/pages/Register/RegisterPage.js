import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getActiveProfile, setActiveProfile } from "../../utils/storage";

function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  // If already logged in, redirect away from auth page
  useEffect(() => {
    const active = getActiveProfile();
    if (active) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const normalizeRole = (val) => {
    if (val === "student") return "Student";
    if (val === "lecturer") return "Lecturer";
    if (val === "admin") return "Admin";
    return "";
  };

  const getUsers = () => {
    try {
      const raw = localStorage.getItem("rnu_users");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveUsers = (users) => localStorage.setItem("rnu_users", JSON.stringify(users));

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

  const handleRegister = () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    const r = normalizeRole(role);
    const d = department.trim();

    if (!n || !e || !r) return setMsg("Please fill Name, Email and Role.");
    if (password.length < 3) return setMsg("Password is too short (demo).");
    if (password !== confirm) return setMsg("Passwords do not match.");

    const users = getUsers();
    const exists = users.some((u) => (u?.email || "").toLowerCase() === e);
    if (exists) return setMsg("This email is already registered. Please Login.");

    const newUser = {
      name: n,
      email: e,
      role: r,
      department: d || "Computer Science",
      password,
      createdAt: new Date().toISOString(),
    };

    saveUsers([newUser, ...users]);
    ensureUserDataContainers(e);

    // ✅ TAB-BASED session: single source through storage utils
    sessionStorage.setItem("token", "demo-token");
    setActiveProfile({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
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
      <h1 style={{ marginBottom: "2rem" }}>Register</h1>

      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: "flex", flexDirection: "column", width: "320px", gap: "1rem" }}
      >
        <input
          type="text"
          placeholder="Full Name"
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="" disabled>
            Select Role
          </option>
          <option value="student">Student</option>
          <option value="lecturer">Lecturer / Researcher</option>
          <option value="admin">Admin</option>
        </select>

        <input
          type="text"
          placeholder="Department / Program"
          style={inputStyle}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirm Password"
          style={inputStyle}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button type="button" style={buttonStyle} onClick={handleRegister}>
          Create Account
        </button>
        {msg && <div style={{ opacity: 0.85, fontSize: "0.9rem" }}>{msg}</div>}
      </form>

      <p style={{ marginTop: "1rem" }}>
        Already have an account?
        <Link to="/login" style={{ color: "#4fa3ff", marginLeft: "0.5rem" }}>
          Login
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

export default RegisterPage;
