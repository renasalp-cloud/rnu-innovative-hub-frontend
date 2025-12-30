// src/pages/Chat/ChatPage.js
import React, { useState } from "react";
import { chatApi } from "../../services/chatApi";
import { getActiveProfile } from "../../utils/storage";

function ChatPage() {
  const profile = getActiveProfile();
  const role = profile?.role || "Student";
  const email = profile?.email || "";

  const [messages, setMessages] = useState([
    { from: "ai", text: "Hi! I am the RNU Assistant. How can I help you?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await chatApi.sendMessage(text, {
        activeUserEmail: email,
        role,
      });

      setMessages((m) => [
        ...m,
        { from: "ai", text: res?.replyText || "No response." },
      ]);
    } catch {
      setError("Failed to get response from AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", color: "white", maxWidth: 800 }}>
      <h2>AI Assistant</h2>

      <div
        style={{
          border: "1px solid #444",
          borderRadius: 8,
          padding: "1rem",
          minHeight: 300,
          marginBottom: "1rem",
          background: "#111",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: "0.5rem",
              textAlign: m.from === "user" ? "right" : "left",
            }}
          >
            <strong>{m.from === "user" ? "You" : "AI"}:</strong> {m.text}
          </div>
        ))}

        {loading && <div>AI is typing…</div>}
      </div>

      {error && <div style={{ color: "salmon" }}>{error}</div>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={input}
          placeholder="Ask something…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPage;
