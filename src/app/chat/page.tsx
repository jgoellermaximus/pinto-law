"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FolderOpen,
  Table2,
  Library,
  Send,
  Loader2,
  PanelLeft,
  Plus,
  LogOut,
  ChevronDown,
  Check,
  FileText,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PintoLogo } from "@/components/pinto-logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// Models (OpenRouter)
// ---------------------------------------------------------------------------

const MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5", group: "Anthropic" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash", group: "Google" },
  { id: "qwen/qwen3-235b-a22b", label: "Qwen 3 235B", group: "Open Source" },
] as const;

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: "/chat", label: "Assistant", icon: MessageSquare },
  { href: "/deals", label: "Deals", icon: FileText },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/tabular-reviews", label: "Tabular Review", icon: Table2 },
  { href: "/workflows", label: "Workflows", icon: Library },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const { user, isAuthenticated, authLoading, signOut } = useAuth();
  const router = useRouter();

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Active session
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const messages = activeSession?.messages ?? [];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  // New chat
  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setInput("");
    setStreamingContent("");
    textareaRef.current?.focus();
  }, []);

  // Send message
  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");
    setStreamingContent("");

    // Build messages array
    const newUserMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, newUserMsg];

    // Create or update session
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: sessionId,
        title: text.slice(0, 60) + (text.length > 60 ? "..." : ""),
        messages: [newUserMsg],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(sessionId);
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, newUserMsg] } : s,
        ),
      );
    }

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model,
          chat_id: activeSession?.id !== sessionId ? undefined : activeSessionId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        const errMsg: Message = {
          role: "assistant",
          content: `Error: ${res.status} — ${errText}`,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, errMsg] }
              : s,
          ),
        );
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
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
                setStreamingContent(fullText);
              }
              if (parsed.type === "error") {
                fullText += `\n\nError: ${parsed.message}`;
                setStreamingContent(fullText);
              }
            } catch {
              // skip
            }
          }
        }
      }

      // Save assistant message to session
      const assistantMsg: Message = { role: "assistant", content: fullText };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, assistantMsg] }
            : s,
        ),
      );
      setStreamingContent("");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errMsg: Message = {
          role: "assistant",
          content: `Error: ${err.message}`,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, errMsg] }
              : s,
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const selectedModel = MODELS.find((m) => m.id === model);

  return (
    <div className="flex h-dvh bg-white">
      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 overflow-hidden transition-all duration-200 border-r border-gray-100 bg-gray-50/70`}
      >
        <div className="flex h-full w-64 flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100">
            <PintoLogo size={36} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Legal OS
            </span>
          </div>

          {/* New chat */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={handleNewChat}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          {/* Nav */}
          <nav className="px-3 py-2 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/chat";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-3 pt-2">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              History
            </p>
            {sessions.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No chats yet</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                  s.id === activeSessionId
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setStreamingContent("");
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    if (activeSessionId === s.id) {
                      setActiveSessionId(null);
                      setStreamingContent("");
                    }
                  }}
                  className="hidden group-hover:block text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
          </div>

          {/* User */}
          <div className="border-t border-gray-100 px-3 py-3">
            <div className="flex items-center gap-2.5 px-2">
              <div className="h-7 w-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-medium">
                {user?.name?.[0] ?? user?.email?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user?.name ?? user?.email}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center h-14 px-4 border-b border-gray-100 gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {selectedModel?.label ?? "Model"}
              <ChevronDown className={`h-3 w-3 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setModelDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className="flex w-full items-center px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex-1 text-left">{m.label}</span>
                      <span className="text-[10px] text-gray-400 mr-2">{m.group}</span>
                      {m.id === model && <Check className="h-3.5 w-3.5 text-gray-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingContent ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <PintoLogo size={120} className="object-contain mb-6" />
              <h1 className="text-2xl font-semibold text-gray-800 mb-1">
                Hi, {user?.name?.split(" ")[0] ?? "there"}
              </h1>
              <p className="text-gray-400 text-sm mb-8">
                Ask me anything about New Jersey law
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {[
                  "What is the attorney review period in NJ real estate?",
                  "Draft an expungement petition checklist",
                  "NJ LLC formation requirements and steps",
                  "Landlord obligations under NJ tenant law",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-gray max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-50 text-gray-800">
                    <div className="prose prose-sm prose-gray max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-gray-50">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 focus-within:border-gray-400 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a question about your documents..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className={`flex-shrink-0 rounded-lg p-2 transition-colors ${
                  loading || !input.trim()
                    ? "text-gray-300"
                    : "text-white bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-2">
              AI can make mistakes. Answers are not legal advice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
