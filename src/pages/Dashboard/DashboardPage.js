// src/pages/Dashboard/DashboardPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function DashboardPage() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("student");
  const [hoveredCard, setHoveredCard] = useState(null);

  const readRoleFromStorage = () => {
    const raw = localStorage.getItem("rnu_user_profile");
    if (!raw) return "student";
    try {
      const role = JSON.parse(raw)?.role || "student";
      return String(role).trim().toLowerCase();
    } catch {
      return "student";
    }
  };

  useEffect(() => {
    setUserRole(readRoleFromStorage());
    const onFocus = () => setUserRole(readRoleFromStorage());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const isLecturerOrAdmin = userRole === "lecturer" || userRole === "admin";

  const getCardStyle = (id) => {
    const isHovered = hoveredCard === id;
    return {
      ...cardBaseStyle,
      cursor: "pointer",
      border: isHovered ? "1px solid #4fa3ff" : "1px solid #3b3d42",
      transform: isHovered ? "scale(1.01)" : "scale(1)",
    };
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <h3 style={{ marginBottom: "1.5rem" }}>Menu</h3>

        <ul style={menuListStyle}>
          <li onClick={() => navigate("/profile")}>My Profile</li>
          <li onClick={() => navigate("/achievements")}>Achievements</li>
          <li onClick={() => navigate("/chat")}>AI Assistant</li>

          {isLecturerOrAdmin && (
            <li onClick={() => navigate("/lecturer")}>Lecturer Dashboard</li>
          )}
        </ul>
      </aside>

      {/* Main */}
      <section style={contentStyle}>
        <h1 style={{ marginBottom: "1.5rem" }}>Dashboard Overview</h1>

        <p style={{ marginBottom: "1rem" }}>
          Welcome to the RNU Innovative Hub! You are now logged in 🎉
        </p>

        <div style={cardsWrapperStyle}>
          <div
            style={getCardStyle("achievements")}
            onMouseEnter={() => setHoveredCard("achievements")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => navigate("/achievements")}
            title="Go to Achievements"
          >
            <h3>My Achievements</h3>
            <p>Certificates, Projects, Publications, University Issues.</p>
          </div>

          <div
            style={getCardStyle("profile")}
            onMouseEnter={() => setHoveredCard("profile")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => navigate("/profile")}
            title="Go to Profile"
          >
            <h3>My Profile</h3>
            <p>Role, department and summary statistics will be shown here.</p>
          </div>

          <div
            style={getCardStyle("chat")}
            onMouseEnter={() => setHoveredCard("chat")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => navigate("/chat")}
            title="Go to AI Assistant"
          >
            <h3>AI Assistant</h3>
            <p>Quick access to rule-based chat and smart queries.</p>
          </div>

          {isLecturerOrAdmin && (
            <div
              style={getCardStyle("lecturer")}
              onMouseEnter={() => setHoveredCard("lecturer")}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => navigate("/lecturer")}
              title="Go to Lecturer Dashboard"
            >
              <h3>Lecturer / Admin Area</h3>
              <p>Thesis supervision, student tracking and department reports.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const containerStyle = {
  display: "flex",
  gap: "1.5rem",
  padding: "1rem",
  color: "white",
};

const sidebarStyle = {
  width: "220px",
  backgroundColor: "#26282c",
  borderRadius: "8px",
  padding: "1rem",
  border: "1px solid #3b3d42",
};

const menuListStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
  fontSize: "0.95rem",
  cursor: "pointer",
};

const contentStyle = {
  flex: 1,
  backgroundColor: "#26282c",
  borderRadius: "8px",
  padding: "1.5rem",
  border: "1px solid #3b3d42",
};

const cardsWrapperStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
  marginTop: "0.5rem",
};

const cardBaseStyle = {
  backgroundColor: "#303238",
  borderRadius: "8px",
  padding: "1rem",
  fontSize: "0.95rem",
  transition: "transform 0.1s ease, border-color 0.1s ease",
};

export default DashboardPage;
