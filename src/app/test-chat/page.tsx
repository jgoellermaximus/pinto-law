"use client";

import { useState, useRef } from "react";

export default function TestChatPage() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSend() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResponse("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setResponse(`Error: ${res.status} ${await res.text()}`);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setResponse("No reader available");
        setLoading(false);
        return;
      }

      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_delta") {
              fullText += parsed.text;
              setResponse(fullText);
            }
            if (parsed.type === "error") {
              fullText += `\n\nError: ${parsed.message}`;
              setResponse(fullText);
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setResponse(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Legal Brain — Chat Test</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Direct connection to /api/chat — bypasses all Mike components.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a legal question..."
        rows={3}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #ccc",
          marginBottom: 12,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />

      <button
        onClick={handleSend}
        disabled={loading}
        style={{
          padding: "10px 24px",
          fontSize: 16,
          borderRadius: 8,
          background: loading ? "#999" : "#1B4332",
          color: "white",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {response && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#f8f8f6",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}
        >
          {response}
        </div>
      )}
    </div>
  );
}