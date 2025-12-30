import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { call } from "../../services/api";
import { Contract } from "../../services/contract"; // <-- correct path
import { getActiveProfile, setActiveProfile } from "../../utils/storage";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    const active = getActiveProfile();
    if (active) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return setMsg("Please enter your email.");
    if (!password.trim()) return setMsg("Please enter your password.");

    try {
      const res = await call(Contract.auth.login, {
        body: { email: e, password },
      });

      sessionStorage.setItem("token", res.token);
      setActiveProfile(res.user);
      window.dispatchEvent(new Event("rnu_profile_updated"));

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Login failed. Check backend.");
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: "2rem" }}>Login</h1>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          handleLogin();
        }}
        style={formStyle}
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
        <button type="submit" style={buttonStyle}>Login</button>
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

const containerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "80vh",
  color: "white",
  padding: "1rem",
};
const formStyle = { display: "flex", flexDirection: "column", width: "320px", gap: "1rem" };
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
