"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  Loader2,
  Plus,
  X,
  FileText,
  Zap,
  Calendar,
  Pencil,
  Trash2,
  Star,
  MessageSquare,
  Upload,
  File,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";
import { DataTable, SortHeader, type ColumnDef } from "@/components/data-table";
import {
  INTAKE_TYPES,
  formatIntakeType,
  IntakeTypeBadge,
} from "@/components/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MergeField = {
  key: string;
  label: string;
  type: "text" | "date" | "currency" | "select" | "textarea";
  required: boolean;
  mapTo: string | null;
  defaultValue?: string;
  options?: string[];
};

type Workflow = {
  id: string;
  organizationId: string | null;
  userId: string | null;
  title: string;
  type: string;
  templateType: string;
  promptMd: string | null;
  columnsConfig: unknown;
  templateStoragePath: string | null;
  templateFileName: string | null;
  templateFields: MergeField[] | null;
  practice: string | null;
  isSystem: boolean;
  intakeType: string | null;
  isDefault: boolean;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function makeColumns({
  onEdit,
  onDelete,
  onToggleDefault,
  onUseInChat,
}: {
  onEdit: (w: Workflow) => void;
  onDelete: (w: Workflow) => void;
  onToggleDefault: (w: Workflow) => void;
  onUseInChat: (w: Workflow) => void;
}): ColumnDef<Workflow>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => <SortHeader column={column} title="Template" />,
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-gray-800 truncate max-w-[280px]">
            {row.original.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                row.original.templateType === "document"
                  ? "bg-violet-50 text-violet-700 border-violet-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}
            >
              {row.original.templateType === "document" ? "DOCX" : "Prompt"}
            </span>
            {row.original.templateFileName && (
              <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                {row.original.templateFileName}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "intakeType",
      header: ({ column }) => (
        <SortHeader column={column} title="Intake Type" />
      ),
      cell: ({ row }) => <IntakeTypeBadge type={row.original.intakeType} />,
      filterFn: (row, _id, filterValue: string[]) => {
        if (!filterValue.length) return true;
        return filterValue.includes(row.original.intakeType ?? "");
      },
    },
    {
      accessorKey: "isDefault",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Default
        </span>
      ),
      cell: ({ row }) =>
        row.original.isDefault ? (
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        ) : row.original.intakeType ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleDefault(row.original);
            }}
            className="text-gray-300 hover:text-amber-400 transition-colors"
            title="Set as default for this intake type"
          >
            <Star className="h-4 w-4" />
          </button>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        ),
    },
    {
      accessorKey: "practice",
      header: ({ column }) => <SortHeader column={column} title="Practice" />,
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">
          {row.original.practice ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm text-gray-500">
            {new Date(row.original.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      ),
      sortingFn: "datetime",
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseInChat(row.original);
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Use in Chat"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row.original);
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!row.original.isSystem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.original);
              }}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];
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

  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [editWorkflow, setEditWorkflow] = useState<Workflow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [intakeFilter, setIntakeFilter] = useState<string[]>([]);

  const workflowsQuery = trpc.workflows.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const deleteWorkflow = trpc.workflows.delete.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });
  const updateWorkflow = trpc.workflows.update.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });

  const workflows: Workflow[] = (workflowsQuery.data as Workflow[]) ?? [];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  function handleToggleDefault(workflow: Workflow) {
    if (!workflow.intakeType) return;
    const currentDefault = workflows.find(
      (w) =>
        w.intakeType === workflow.intakeType &&
        w.isDefault &&
        w.id !== workflow.id,
    );
    if (currentDefault) {
      updateWorkflow.mutate({ workflowId: currentDefault.id, isDefault: false });
    }
    updateWorkflow.mutate({ workflowId: workflow.id, isDefault: true });
  }

  function handleUseInChat(workflow: Workflow) {
    if (workflow.promptMd) {
      sessionStorage.setItem("workflow_prompt", workflow.promptMd);
      sessionStorage.setItem("workflow_title", workflow.title);
    }
    router.push("/chat");
  }

  function handleDelete(workflow: Workflow) {
    if (confirm(`Delete "${workflow.title}"? This cannot be undone.`)) {
      deleteWorkflow.mutate({ workflowId: workflow.id });
    }
  }

  const columns = makeColumns({
    onEdit: setEditWorkflow,
    onDelete: handleDelete,
    onToggleDefault: handleToggleDefault,
    onUseInChat: handleUseInChat,
  });

  const columnFilters = intakeFilter.length
    ? [{ id: "intakeType", value: intakeFilter }]
    : [];

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const sidebarContent = (
    <>
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Intake Types
      </p>
      <div className="space-y-0.5">
        {INTAKE_TYPES.map((it) => {
          const count = workflows.filter((w) => w.intakeType === it.value).length;
          const defaultWf = workflows.find(
            (w) => w.intakeType === it.value && w.isDefault,
          );
          return (
            <button
              key={it.value}
              onClick={() =>
                setIntakeFilter((prev) =>
                  prev.includes(it.value)
                    ? prev.filter((v) => v !== it.value)
                    : [...prev, it.value],
                )
              }
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                intakeFilter.includes(it.value)
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <div className="flex flex-col items-start">
                <span>{it.label}</span>
                {defaultWf && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {defaultWf.title}
                  </span>
                )}
              </div>
              {count > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {intakeFilter.length > 0 && (
          <button
            onClick={() => setIntakeFilter([])}
            className="flex w-full items-center gap-1 px-3 py-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" /> Clear filter
          </button>
        )}
      </div>

      <div className="mt-4 px-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Summary
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-medium text-gray-700">{workflows.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Document</span>
            <span className="font-medium text-violet-600">
              {workflows.filter((w) => w.templateType === "document").length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Prompt</span>
            <span className="font-medium text-gray-600">
              {workflows.filter((w) => w.templateType === "prompt").length}
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
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </button>
        </AppHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-6xl mx-auto">
            <DataTable
              columns={columns}
              data={workflows}
              isLoading={workflowsQuery.isLoading}
              searchPlaceholder="Search templates..."
              searchFilterFn={(row, _id, filterValue: string) => {
                const q = filterValue.toLowerCase();
                return (
                  row.original.title.toLowerCase().includes(q) ||
                  (row.original.practice?.toLowerCase().includes(q) ?? false)
                );
              }}
              columnFilters={columnFilters}
              onRowClick={(workflow) => setSelectedWorkflow(workflow)}
              defaultSorting={[{ id: "title", desc: false }]}
              emptyIcon={<Zap className="h-12 w-12 text-gray-300 mb-3" />}
              emptyTitle="No workflow templates"
              emptyDescription="Create a template to speed up your common legal tasks."
            />
          </div>
        </div>
      </main>

      {selectedWorkflow && (
        <WorkflowDetailModal
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
          onEdit={() => {
            setEditWorkflow(selectedWorkflow);
            setSelectedWorkflow(null);
          }}
          onUseInChat={() => {
            handleUseInChat(selectedWorkflow);
            setSelectedWorkflow(null);
          }}
        />
      )}

      {(createOpen || editWorkflow) && (
        <WorkflowFormModal
          workflow={editWorkflow}
          onClose={() => {
            setCreateOpen(false);
            setEditWorkflow(null);
          }}
          onSaved={() => {
            workflowsQuery.refetch();
            setCreateOpen(false);
            setEditWorkflow(null);
          }}
        />
      )}
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Workflow Detail Modal
// ---------------------------------------------------------------------------

function WorkflowDetailModal({
  workflow,
  onClose,
  onEdit,
  onUseInChat,
}: {
  workflow: Workflow;
  onClose: () => void;
  onEdit: () => void;
  onUseInChat: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isDocument = workflow.templateType === "document";
  const fields = (workflow.templateFields as MergeField[]) ?? [];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 truncate">
              {workflow.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  isDocument
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {isDocument ? "Document Template" : "Prompt Template"}
              </span>
              {workflow.intakeType && <IntakeTypeBadge type={workflow.intakeType} />}
              {workflow.isDefault && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Default
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isDocument ? (
            <>
              {/* Document template info */}
              {workflow.templateFileName && (
                <div className="flex items-center gap-3 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 mb-4">
                  <File className="h-5 w-5 text-violet-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-violet-800">
                      {workflow.templateFileName}
                    </p>
                    <p className="text-xs text-violet-600">
                      DOCX template stored in R2
                    </p>
                  </div>
                </div>
              )}

              {/* Merge fields */}
              {fields.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Merge Fields ({fields.length})
                  </p>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Placeholder</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Label</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Maps To</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => (
                          <tr key={f.key} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-mono text-xs text-violet-600">{`{{${f.key}}}`}</td>
                            <td className="px-3 py-2 text-gray-700">{f.label}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {f.mapTo ? (
                                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{f.mapTo}</span>
                              ) : (
                                <span className="text-xs text-gray-400">Auto-generated</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{f.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Optional AI review prompt */}
              {workflow.promptMd && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    AI Review Prompt (Layer 2)
                  </p>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {workflow.promptMd}
                  </pre>
                </div>
              )}
            </>
          ) : (
            /* Prompt template preview */
            workflow.promptMd ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Prompt Template
                </p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {workflow.promptMd}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No prompt template defined yet.</p>
              </div>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            {!isDocument && (
              <button
                onClick={onUseInChat}
                className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Use in Chat
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Workflow Form Modal (create/edit — supports both template types)
// ---------------------------------------------------------------------------

function WorkflowFormModal({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: Workflow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!workflow;

  const [title, setTitle] = useState(workflow?.title ?? "");
  const [type, setType] = useState(workflow?.type ?? "chat");
  const [templateType, setTemplateType] = useState<"prompt" | "document">(
    (workflow?.templateType as "prompt" | "document") ?? "prompt",
  );
  const [promptMd, setPromptMd] = useState(workflow?.promptMd ?? "");
  const [practice, setPractice] = useState(workflow?.practice ?? "");
  const [intakeType, setIntakeType] = useState(workflow?.intakeType ?? "");
  const [isDefault, setIsDefault] = useState(workflow?.isDefault ?? false);

  // Document template state
  const [templateStoragePath, setTemplateStoragePath] = useState(
    workflow?.templateStoragePath ?? "",
  );
  const [templateFileName, setTemplateFileName] = useState(
    workflow?.templateFileName ?? "",
  );
  const [templateFields, setTemplateFields] = useState<MergeField[]>(
    (workflow?.templateFields as MergeField[]) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  const createWorkflow = trpc.workflows.create.useMutation();
  const updateWorkflow = trpc.workflows.update.useMutation();

  // ── File upload handler ──
  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (workflow?.id) {
        formData.append("workflowId", workflow.id);
      }

      const res = await fetch("/api/templates/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json();
      setTemplateStoragePath(data.storagePath);
      setTemplateFileName(data.fileName);
      setTemplateFields(data.templateFields);
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith(".docx")) {
      handleFileUpload(file);
    } else {
      setUploadError("Only .docx files are supported");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  // ── Save handler ──
  async function handleSave() {
    if (!title.trim()) return;
    if (templateType === "document" && !templateStoragePath) {
      setUploadError("Please upload a DOCX template");
      return;
    }
    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        type,
        templateType,
        promptMd: promptMd.trim() || null,
        practice: practice.trim() || null,
        intakeType: intakeType || null,
        isDefault,
        templateStoragePath: templateType === "document" ? templateStoragePath : null,
        templateFileName: templateType === "document" ? templateFileName : null,
        templateFields: templateType === "document" ? templateFields : null,
      };

      if (isEdit && workflow) {
        await updateWorkflow.mutateAsync({ workflowId: workflow.id, ...payload });
      } else {
        await createWorkflow.mutateAsync(payload);
      }
      onSaved();
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setSaving(false);
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
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 md:inset-y-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? "Edit Template" : "New Template"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Template type toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Template Type
            </label>
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 w-fit">
              <button
                onClick={() => setTemplateType("prompt")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  templateType === "prompt"
                    ? "bg-gray-100 text-gray-800"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                AI Prompt
              </button>
              <button
                onClick={() => setTemplateType("document")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  templateType === "document"
                    ? "bg-violet-100 text-violet-800"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <File className="h-3.5 w-3.5" />
                DOCX Template
              </button>
            </div>
          </div>

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
            />
          </div>

          {/* Type + Practice row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400 transition-colors bg-white"
              >
                <option value="chat">Chat Prompt</option>
                <option value="tabular">Tabular Review</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Practice Area
              </label>
              <input
                type="text"
                value={practice}
                onChange={(e) => setPractice(e.target.value)}
                placeholder="NJ Real Estate"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </div>

          {/* Intake type + default */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Intake Type
              </label>
              <select
                value={intakeType}
                onChange={(e) => setIntakeType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400 transition-colors bg-white"
              >
                <option value="">None (manual use only)</option>
                {INTAKE_TYPES.map((it) => (
                  <option key={it.value} value={it.value}>{it.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  disabled={!intakeType}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 disabled:opacity-30"
                />
                <span className={`text-sm ${intakeType ? "text-gray-700" : "text-gray-400"}`}>
                  Default for this intake type
                </span>
              </label>
            </div>
          </div>

          {/* ── Document template: file upload ── */}
          {templateType === "document" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                DOCX Template
              </label>

              {templateFileName ? (
                /* Uploaded file display */
                <div className="flex items-center gap-3 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-violet-800 truncate">
                      {templateFileName}
                    </p>
                    <p className="text-xs text-violet-600">
                      {templateFields.length} merge field{templateFields.length !== 1 ? "s" : ""} detected
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTemplateStoragePath("");
                      setTemplateFileName("");
                      setTemplateFields([]);
                    }}
                    className="text-violet-400 hover:text-violet-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Upload zone */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                    uploading
                      ? "border-violet-300 bg-violet-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 text-violet-400 animate-spin mb-2" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-300 mb-2" />
                  )}
                  <p className="text-sm text-gray-500 font-medium">
                    {uploading ? "Uploading..." : "Drop a .docx file here or click to browse"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Use {"{{PLACEHOLDER}}"} markers in your template where data should be inserted
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* ── Detected merge fields (document template) ── */}
          {templateType === "document" && templateFields.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Detected Merge Fields
              </label>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Placeholder</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Label</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Maps To</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateFields.map((field, i) => (
                      <tr key={field.key} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-xs text-violet-600">
                          {`{{${field.key}}}`}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => {
                              const updated = [...templateFields];
                              updated[i] = { ...field, label: e.target.value };
                              setTemplateFields(updated);
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {field.mapTo ? (
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {field.mapTo}
                            </span>
                          ) : (
                            <span className="text-gray-400">Auto</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const updated = [...templateFields];
                              updated[i] = { ...field, required: e.target.checked };
                              setTemplateFields(updated);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Prompt (always shown — primary for prompt type, optional Layer 2 for document type) ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {templateType === "document"
                ? "AI Review Prompt (optional — Layer 2)"
                : "Prompt Template"}
            </label>
            {templateType === "document" && (
              <p className="text-xs text-gray-400 mb-2">
                Optional: after the DOCX merge, AI can review the filled document and flag issues.
              </p>
            )}
            <textarea
              value={promptMd}
              onChange={(e) => setPromptMd(e.target.value)}
              rows={templateType === "document" ? 6 : 12}
              placeholder={
                templateType === "document"
                  ? "Review the completed attorney review letter and flag any issues with the terms..."
                  : "You are an NJ real estate attorney. Review the following purchase agreement..."
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving || (templateType === "document" && !templateStoragePath)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </>
  );
}
