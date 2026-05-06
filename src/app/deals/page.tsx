"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  Loader2,
  Plus,
  LayoutGrid,
  List,
  X,
  User,
  Calendar,
  Briefcase,
  Filter,
  FileText,
  Scale,
  Check,
} from "lucide-react";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  KanbanCard,
} from "@/components/kibo-ui/kanban";
import type { DragEndEvent } from "@/components/kibo-ui/kanban";
import { CreateDealModal } from "@/components/deals/create-deal-modal";
import { ActivityTimeline } from "@/components/deals/activity-timeline";
import { DataTable, SortHeader, type ColumnDef } from "@/components/data-table";
import {
  MATTER_TYPES,
  STAGES,
  formatMatterType,
  formatStage,
  MatterBadge,
  StageBadge,
  StageBadgeFull,
} from "@/components/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Project = {
  id: string;
  organizationId: string;
  userId: string;
  clientId: string | null;
  name: string;
  matterType: string | null;
  stage: string;
  cmNumber: string | null;
  visibility: string;
  sharedWith: unknown;
  createdAt: Date;
  updatedAt: Date;
  clientName: string | null;
  clientType: string | null;
  is_owner: boolean;
  document_count: number;
  chat_count: number;
  review_count: number;
  description: string | null;
  notes: string | null;
  dealIntakeId: string | null;
};

interface KanbanProject {
  id: string;
  name: string;
  column: string;
  project: Project;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Pipeline columns (for kanban)
// ---------------------------------------------------------------------------

const STAGE_COLUMNS = STAGES.map((s) => ({ id: s.value, name: s.label }));

// ---------------------------------------------------------------------------
// DataTable columns (for list view)
// ---------------------------------------------------------------------------

const listColumns: ColumnDef<Project>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="min-w-[200px]">
        <p className="font-medium text-gray-800 truncate max-w-[300px]">
          {row.original.name}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "clientName",
    header: ({ column }) => <SortHeader column={column} title="Client" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-sm text-gray-600 truncate max-w-[160px]">
          {row.original.clientName ?? "—"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "matterType",
    header: ({ column }) => <SortHeader column={column} title="Type" />,
    cell: ({ row }) => <MatterBadge type={row.original.matterType} />,
    filterFn: (row, _id, filterValue: string[]) => {
      if (!filterValue.length) return true;
      return filterValue.includes(row.original.matterType ?? "");
    },
  },
  {
    accessorKey: "stage",
    header: ({ column }) => <SortHeader column={column} title="Stage" />,
    cell: ({ row }) => <StageBadge stage={row.original.stage} />,
    filterFn: (row, _id, filterValue: string[]) => {
      if (!filterValue.length) return true;
      return filterValue.includes(row.original.stage);
    },
  },
  {
    accessorKey: "document_count",
    header: ({ column }) => <SortHeader column={column} title="Docs" />,
    cell: ({ row }) => (
      <span className="text-sm text-gray-500 tabular-nums">
        {row.original.document_count}
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
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DealsPage() {
  return (
    <SidebarProvider>
      <DealsPageInner />
    </SidebarProvider>
  );
}

function DealsPageInner() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  // UI state
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // tRPC
  const projectsQuery = trpc.projects.list.useQuery(
    matterFilter ? { matterType: matterFilter as any } : undefined,
    { enabled: isAuthenticated },
  );
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => projectsQuery.refetch(),
  });

  const projects: Project[] = (projectsQuery.data as Project[]) ?? [];

  // Kanban data
  const kanbanData: KanbanProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    column: p.stage,
    project: p,
  }));

  const [localKanbanData, setLocalKanbanData] =
    useState<KanbanProject[]>(kanbanData);

  // Sync kanban data when server data changes
  useEffect(() => {
    setLocalKanbanData(kanbanData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsQuery.data]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  // Kanban drag handlers
  function handleKanbanDataChange(newData: KanbanProject[]) {
    setLocalKanbanData(newData);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active } = event;
    const movedItem = localKanbanData.find((item) => item.id === active.id);
    if (!movedItem) return;

    const originalProject = projects.find((p) => p.id === movedItem.id);
    if (!originalProject || originalProject.stage === movedItem.column) return;

    updateProject.mutate({
      projectId: movedItem.id,
      stage: movedItem.column as any,
    });
  }

  // Helpers
  function getColumnCount(columnId: string): number {
    return projects.filter((p) => p.stage === columnId).length;
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ── Sidebar content ──
  const sidebarContent = (
    <>
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Pipeline
      </p>
      <div className="space-y-0.5">
        {STAGE_COLUMNS.map((col) => {
          const count = getColumnCount(col.id);
          return (
            <div
              key={col.id}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-gray-500"
            >
              <span>{col.name}</span>
              {count > 0 && (
                <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 px-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Summary
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total matters</span>
            <span className="font-medium text-gray-700">{projects.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Active</span>
            <span className="font-medium text-blue-600">
              {projects.filter((p) => p.stage === "active").length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Completed</span>
            <span className="font-medium text-green-600">
              {
                projects.filter((p) =>
                  ["complete", "archived"].includes(p.stage),
                ).length
              }
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <AppLayout sidebarContent={sidebarContent}>
      <main className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <AppHeader>
          <h1 className="text-sm font-semibold text-gray-800 mr-auto">
            Deals
          </h1>

          {/* Matter type filter */}
          <div className="relative">
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                matterFilter
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              {matterFilter ? formatMatterType(matterFilter) : "All Types"}
            </button>
            {filterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFilterDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                  <button
                    onClick={() => {
                      setMatterFilter(null);
                      setFilterDropdownOpen(false);
                    }}
                    className={`flex w-full items-center px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      !matterFilter
                        ? "font-medium text-gray-900"
                        : "text-gray-600"
                    }`}
                  >
                    All Types
                  </button>
                  {MATTER_TYPES.map((mt) => {
                    const Icon = mt.icon;
                    return (
                      <button
                        key={mt.value}
                        onClick={() => {
                          setMatterFilter(mt.value);
                          setFilterDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          matterFilter === mt.value
                            ? "font-medium text-gray-900"
                            : "text-gray-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 text-gray-400" />
                        {mt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "kanban"
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {/* New deal button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Deal
          </button>
        </AppHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {projectsQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState filtered={!!matterFilter} />
          ) : view === "kanban" ? (
            <KanbanView
              data={localKanbanData}
              onDataChange={handleKanbanDataChange}
              onDragEnd={handleDragEnd}
              onSelectProject={setSelectedProject}
            />
          ) : (
            /* ── LIST VIEW: shared DataTable ── */
            <div className="overflow-y-auto p-4">
              <div className="max-w-6xl mx-auto">
                <DataTable
                  columns={listColumns}
                  data={projects}
                  isLoading={false}
                  searchPlaceholder="Search deals..."
                  searchFilterFn={(row, _id, filterValue: string) => {
                    const q = filterValue.toLowerCase();
                    return (
                      row.original.name.toLowerCase().includes(q) ||
                      (row.original.clientName?.toLowerCase().includes(q) ??
                        false)
                    );
                  }}
                  onRowClick={(project) => setSelectedProject(project)}
                  defaultSorting={[{ id: "createdAt", desc: true }]}
                  emptyTitle="No matching deals"
                  emptyDescription="Try adjusting your filters or create a new deal."
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={(projectId, updates) => {
            updateProject.mutate({ projectId, ...updates });
          }}
        />
      )}

      {/* Create deal modal */}
      <CreateDealModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => projectsQuery.refetch()}
      />
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Kanban View (unchanged)
// ---------------------------------------------------------------------------

function KanbanView({
  data,
  onDataChange,
  onDragEnd,
  onSelectProject,
}: {
  data: KanbanProject[];
  onDataChange: (data: KanbanProject[]) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onSelectProject: (project: Project) => void;
}) {
  return (
    <div className="h-full overflow-x-auto p-4">
      <KanbanProvider
        columns={STAGE_COLUMNS}
        data={data}
        onDataChange={onDataChange}
        onDragEnd={onDragEnd}
        className="h-full min-w-[900px]"
      >
        {(column) => (
          <KanbanBoard
            key={column.id}
            id={column.id}
            className="bg-gray-50/80"
          >
            <KanbanHeader className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">
                {column.name}
              </span>
              <span className="text-[10px] font-medium text-gray-400 bg-gray-200/60 rounded-full px-1.5 py-0.5">
                {data.filter((d) => d.column === column.id).length}
              </span>
            </KanbanHeader>
            <KanbanCards id={column.id}>
              {(item: KanbanProject) => (
                <KanbanCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  column={item.column}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => onSelectProject(item.project)}
                  >
                    <p className="text-sm font-medium text-gray-800 leading-tight mb-1.5">
                      {item.project.name}
                    </p>
                    {item.project.clientName && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500 truncate">
                          {item.project.clientName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.project.matterType && (
                        <MatterBadge type={item.project.matterType} />
                      )}
                      {item.project.document_count > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {item.project.document_count} doc
                          {item.project.document_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </KanbanCard>
              )}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <Briefcase className="h-12 w-12 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">
        {filtered ? "No matching matters" : "No matters yet"}
      </p>
      <p className="text-sm text-gray-400 mt-1 text-center max-w-xs">
        {filtered
          ? "Try a different filter or create a new deal."
          : "Create a deal to get started, or share /intake with realtor partners."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Detail Modal
// ---------------------------------------------------------------------------

function ProjectDetailModal({
  project,
  onClose,
  onUpdate,
}: {
  project: Project;
  onClose: () => void;
  onUpdate: (projectId: string, updates: Record<string, unknown>) => void;
}) {
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

      <div className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 truncate">
              {project.name}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {project.clientName ?? "No client linked"} ·{" "}
              {formatMatterType(project.matterType)}
            </p>
          </div>
          <StageBadgeFull stage={project.stage} />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Info cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <InfoCard
              icon={Briefcase}
              label="Matter Type"
              value={formatMatterType(project.matterType)}
            />
            <InfoCard
              icon={User}
              label="Client"
              value={project.clientName ?? "—"}
            />
            <InfoCard
              icon={FileText}
              label="Documents"
              value={String(project.document_count)}
            />
            <InfoCard
              icon={Calendar}
              label="Created"
              value={new Date(project.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          </div>

          {/* Description */}
          {project.description && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-4 py-3">
                {project.description}
              </p>
            </div>
          )}

          {/* No client nudge */}
          {!project.clientId && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
              <User className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  No client linked
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Link a client to keep your matters organized. You can update
                  this anytime, or Hermes will suggest one as it learns.
                </p>
              </div>
            </div>
          )}

          {/* No matter type nudge */}
          {!project.matterType && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-6">
              <Scale className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  No matter type set
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Categorize this matter to help with filtering and reporting.
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {MATTER_TYPES.map((mt) => (
                    <button
                      key={mt.value}
                      onClick={() =>
                        onUpdate(project.id, { matterType: mt.value })
                      }
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stage selector */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stage
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STAGE_COLUMNS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => onUpdate(project.id, { stage: col.id })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    project.stage === col.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </div>

           {/* Notes */}
          <NotesSection
            projectId={project.id}
            initialNotes={project.notes}
            onSave={(notes) => onUpdate(project.id, { notes })}
          />

          {/* Activity Timeline */}
          <ActivityTimeline projectId={project.id} dealIntakeId={project.dealIntakeId} />

          {/* Activity counts */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Activity
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {project.document_count}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Documents
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {project.chat_count}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Chats
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {project.review_count}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Reviews
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
// ---------------------------------------------------------------------------
// Notes Section (auto-save on blur)
// ---------------------------------------------------------------------------

function NotesSection({
  projectId,
  initialNotes,
  onSave,
}: {
  projectId: string;
  initialNotes: string | null;
  onSave: (notes: string) => void;
}) {
  const [localNotes, setLocalNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const lastSaved = useRef(initialNotes ?? "");

  // Sync if the project changes (modal reopened for different project)
  useEffect(() => {
    setLocalNotes(initialNotes ?? "");
    lastSaved.current = initialNotes ?? "";
  }, [projectId, initialNotes]);

  function handleBlur() {
    if (localNotes === lastSaved.current) return;
    setSaving(true);
    onSave(localNotes);
    lastSaved.current = localNotes;
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 300);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Notes
        </h3>
        {saving && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {saved && (
          <span className="text-[10px] text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
      <textarea
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add meeting notes, observations, follow-ups…"
        rows={4}
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors resize-y"
      />
    </div>
  );
}
// ---------------------------------------------------------------------------
// Info Card
// ---------------------------------------------------------------------------

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-gray-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </p>
      </div>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
