"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  Loader2,
  Plus,
  ChevronDown,
  Check,
  PanelRight,
  FileText,
  Upload,
  Scale,
  Copy,
  CheckCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PintoLogo } from "@/components/pinto-logo";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

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
// Prompt suggestions
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  {
    label: "Attorney Review",
    text: "What is the attorney review period in NJ real estate?",
    icon: Scale,
  },
  {
    label: "Expungement",
    text: "Draft an expungement petition checklist for NJ",
    icon: FileText,
  },
  {
    label: "LLC Formation",
    text: "NJ LLC formation requirements and steps",
    icon: FileText,
  },
  {
    label: "Tenant Rights",
    text: "Landlord obligations under NJ tenant law",
    icon: Scale,
  },
];

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;
  const codeStr = String(children).replace(/\n$/, "");

  if (isInline) {
    return (
      <code
        className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] font-mono text-gray-800"
        {...props}
      >
        {children}
      </code>
    );
  }

  const lang = className?.replace("language-", "") ?? "";

  async function handleCopy() {
    await navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
        >
          {copied ? (
            <>
              <CheckCheck className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="bg-gray-900 px-4 py-3 overflow-x-auto">
        <code
          className={`text-[13px] leading-relaxed font-mono text-gray-100 ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation formatter — converts [1], [2] etc to styled references
// ---------------------------------------------------------------------------

function formatCitations(text: string): string {
  return text.replace(
    /\[(\d+)\]/g,
    '<sup class="inline-flex items-center justify-center h-4 min-w-[16px] px-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold cursor-pointer hover:bg-blue-200 transition-colors ml-0.5">$1</sup>',
  );
}

// ---------------------------------------------------------------------------
// Chat Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  return (
    <SidebarProvider>
      <ChatPageInner />
    </SidebarProvider>
  );
}

function ChatPageInner() {
  const { user, isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [docPanelOpen, setDocPanelOpen] = useState(false);

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

    const newUserMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, newUserMsg];

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
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // ── Sidebar content: new chat + history ──
  const sidebarContent = (
    <>
      <div className="pb-2 -mx-3">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

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
    </>
  );

  return (
    <AppLayout sidebarContent={sidebarContent}>
      <main className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <AppHeader>
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

          {/* Document panel toggle */}
          <button
            onClick={() => setDocPanelOpen(!docPanelOpen)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
              docPanelOpen
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <PanelRight className="h-3.5 w-3.5" />
            Docs
          </button>
        </AppHeader>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 && !streamingContent ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <PintoLogo size={80} className="object-contain mb-6 opacity-80" />
                  <h1
                    className="text-3xl font-medium text-gray-800 mb-2"
                    style={{ fontFamily: "var(--font-eb-garamond), Georgia, serif" }}
                  >
                    Good {getTimeOfDay()}, {firstName}
                  </h1>
                  <p className="text-gray-400 text-sm mb-8">
                    How can I help with your practice today?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                    {SUGGESTIONS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.text}
                          onClick={() => {
                            setInput(s.text);
                            textareaRef.current?.focus();
                          }}
                          className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                        >
                          <Icon className="h-4 w-4 text-gray-400 mt-0.5 group-hover:text-gray-600 transition-colors" />
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                              {s.label}
                            </p>
                            <p className="text-sm text-gray-600">
                              {s.text}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── Messages ── */
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
                  {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                  ))}

                  {/* Streaming */}
                  {streamingContent && (
                    <MessageBubble
                      message={{ role: "assistant", content: streamingContent }}
                      streaming
                    />
                  )}

                  {/* Loading indicator */}
                  {loading && !streamingContent && (
                    <div className="flex items-start gap-3 py-4">
                      <AssistantAvatar />
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
                <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 focus-within:border-gray-400 transition-colors shadow-sm">
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
                    placeholder="Ask about NJ law, review a contract, draft a document..."
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
                  AI can make mistakes. Verify important legal information independently.
                </p>
              </div>
            </div>
          </div>

          {/* ── Document Panel ── */}
          {docPanelOpen && (
            <aside className="w-72 border-l border-gray-100 bg-gray-50/50 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Documents
                </h3>
                <button
                  onClick={() => setDocPanelOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <PanelRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <Upload className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Upload documents
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Drop contracts, filings, or court documents here. The AI will
                  read and reference them in your conversation.
                </p>
                <button className="mt-4 flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-white hover:border-gray-300 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  Browse files
                </button>
                <p className="text-[10px] text-gray-400 mt-3">
                  PDF, DOCX, TXT — processed 100% locally
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  streaming,
}: {
  message: Message;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end py-2">
        <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 bg-gray-900 text-white">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-4">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 max-w-[85%]">
        <div
          className={`prose prose-sm prose-gray max-w-none
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
            prose-headings:font-semibold prose-headings:text-gray-800
            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
            prose-p:leading-relaxed prose-p:text-gray-700
            prose-li:text-gray-700 prose-li:leading-relaxed
            prose-strong:text-gray-800 prose-strong:font-semibold
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-gray-300 prose-blockquote:text-gray-600
            prose-hr:border-gray-200
            ${streaming ? "animate-pulse-subtle" : ""}
          `}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock as any,
              // Format citations in paragraphs
              p: ({ children, ...props }) => (
                <p
                  {...props}
                  dangerouslySetInnerHTML={
                    typeof children === "string"
                      ? { __html: formatCitations(children) }
                      : undefined
                  }
                >
                  {typeof children === "string" ? undefined : children}
                </p>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant Avatar
// ---------------------------------------------------------------------------

function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-950 flex items-center justify-center mt-0.5">
      <Scale className="h-3.5 w-3.5 text-emerald-200" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time of day helper
// ---------------------------------------------------------------------------

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
