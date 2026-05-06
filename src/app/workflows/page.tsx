"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  Loader2,
  Library,
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Workflow {
  id: string;
  userId: string | null;
  title: string;
  type: string;
  promptMd: string | null;
  columnsConfig: unknown;
  practice: string | null;
  isSystem: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  return (
    <SidebarProvider>
      <WorkflowsPageInner />
    </SidebarProvider>
  );
}

function WorkflowsPageInner() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // tRPC
  const workflowsQuery = trpc.workflows.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const deleteWorkflow = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      workflowsQuery.refetch();
      setDeleteConfirm(null);
    },
  });

  const workflows: Workflow[] = (workflowsQuery.data as Workflow[]) ?? [];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  function handleUseInChat(workflow: Workflow) {
    // Navigate to chat with prompt pre-loaded via URL param
    const prompt = workflow.promptMd ?? "";
    sessionStorage.setItem("prefill_prompt", prompt);
    router.push("/chat");
  }

  // Sidebar
  const sidebarContent = (
    <>
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Templates
      </p>
      <div className="space-y-0.5">
        {workflows.map((wf) => (
          <button
            key={wf.id}
            onClick={() =>
              setExpandedId(expandedId === wf.id ? null : wf.id)
            }
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-left transition-colors ${
              expandedId === wf.id
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{wf.title}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 px-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Summary
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-medium text-gray-700">
              {workflows.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">System</span>
            <span className="font-medium text-gray-500">
              {workflows.filter((w) => w.isSystem).length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Custom</span>
            <span className="font-medium text-gray-700">
              {workflows.filter((w) => !w.isSystem).length}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <AppLayout sidebarContent={sidebarContent}>
      <main className="flex flex-1 flex-col min-w-0">
        <AppHeader>
          <h1 className="text-sm font-semibold text-gray-800 mr-auto">
            Workflows
          </h1>
          <button
            onClick={() => {
              setEditingWorkflow(null);
              setCreateOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </button>
        </AppHeader>

        <div className="flex-1 overflow-auto p-4">
          {workflowsQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <Library className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create reusable prompt templates for common legal tasks.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3">
              {workflows.map((wf) => {
                const isExpanded = expandedId === wf.id;
                return (
                  <div
                    key={wf.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all"
                  >
                    {/* Header */}
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : wf.id)
                      }
                    >
                      <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">
                          {wf.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 capitalize">
                            {wf.type}
                          </span>
                          {wf.practice && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">
                                {wf.practice}
                              </span>
                            </>
                          )}
                          {wf.isSystem && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              System
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseInChat(wf);
                          }}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Use in chat"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Use
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkflow(wf);
                            setCreateOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {!wf.isSystem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(wf.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>

                    {/* Expanded prompt preview */}
                    {isExpanded && wf.promptMd && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                          Prompt Template
                        </p>
                        <div className="prose prose-sm prose-gray max-w-none text-sm bg-white rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {wf.promptMd}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handleUseInChat(wf)}
                            className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-4 py-2 text-xs font-medium hover:bg-gray-800 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Open in Chat
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(wf.promptMd ?? "");
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                          >
                            Copy prompt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      {createOpen && (
        <WorkflowModal
          workflow={editingWorkflow}
          onClose={() => {
            setCreateOpen(false);
            setEditingWorkflow(null);
          }}
          onSaved={() => {
            workflowsQuery.refetch();
            setCreateOpen(false);
            setEditingWorkflow(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Delete template?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteWorkflow.mutate({ workflowId: deleteConfirm })
                }
                disabled={deleteWorkflow.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteWorkflow.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Create/Edit Modal
// ---------------------------------------------------------------------------

function WorkflowModal({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: Workflow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!workflow;
  const [title, setTitle] = useState(workflow?.title ?? "");
  const [type, setType] = useState(workflow?.type ?? "chat");
  const [practice, setPractice] = useState(workflow?.practice ?? "");
  const [promptMd, setPromptMd] = useState(workflow?.promptMd ?? "");

  const createWorkflow = trpc.workflows.create.useMutation({
    onSuccess: onSaved,
  });
  const updateWorkflow = trpc.workflows.update.useMutation({
    onSuccess: onSaved,
  });

  const isSubmitting = createWorkflow.isPending || updateWorkflow.isPending;

  async function handleSubmit() {
    if (!title.trim()) return;

    if (isEditing && workflow) {
      updateWorkflow.mutate({
        workflowId: workflow.id,
        title: title.trim(),
        promptMd: promptMd.trim() || undefined,
      });
    } else {
      createWorkflow.mutate({
        title: title.trim(),
        type: type as "chat" | "tabular",
        practice: practice.trim() || undefined,
        promptMd: promptMd.trim() || undefined,
      });
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEditing ? "Edit Template" : "New Template"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Attorney Review Letter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
              autoFocus
            />
          </div>

          {/* Type + Practice */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <div className="flex items-center gap-2">
                {["chat", "tabular"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                      type === t
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Practice Area
              </label>
              <input
                type="text"
                value={practice}
                onChange={(e) => setPractice(e.target.value)}
                placeholder="Real Estate, Criminal..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Prompt Template
            </label>
            <textarea
              value={promptMd}
              onChange={(e) => setPromptMd(e.target.value)}
              placeholder="Write the prompt template here. Use Markdown formatting..."
              rows={12}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors resize-none font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supports Markdown. This prompt will be sent to the AI when used in chat.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isEditing ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </>
  );
}
