import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { call } from "../../services/api";
import { Contract } from "../../services/contract"; // <-- correct path
import { setActiveProfile } from "../../utils/storage";

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Student");
  const [department, setDepartment] = useState("");
  const [msg, setMsg] = useState("");

  const handleRegister = async () => {
    const e = email.trim().toLowerCase();
    if (!name || !e || !password || !role || !department) {
      return setMsg("All fields are required.");
    }

    try {
      const res = await call(Contract.auth.register, {
        body: { name, email: e, password, role, department },
      });

      sessionStorage.setItem("token", res.token);
      setActiveProfile(res.user);
      window.dispatchEvent(new Event("rnu_profile_updated"));

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Registration failed. Check backend.");
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: "2rem" }}>Register</h1>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          handleRegister();
        }}
        style={formStyle}
      >
        <input
          type="text"
          placeholder="Full Name"
          style={inputStyle}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
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
        <input
          type="text"
          placeholder="Department"
          style={inputStyle}
          value={department}
          onChange={(ev) => setDepartment(ev.target.value)}
        />
        <select style={inputStyle} value={role} onChange={(ev) => setRole(ev.target.value)}>
          <option value="Student">Student</option>
          <option value="Lecturer">Lecturer</option>
          <option value="Admin">Admin</option>
        </select>
        <button type="submit" style={buttonStyle}>Register</button>
        {msg && <div style={{ opacity: 0.85, fontSize: "0.9rem" }}>{msg}</div>}
      </form>
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

export default RegisterPage;
