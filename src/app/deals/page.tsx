"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  Loader2,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  LayoutGrid,
  List,
  X,
  Home,
  Calendar,
  User,
  Briefcase,
  Scale,
  Building2,
  Gavel,
  Filter,
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
};

interface KanbanProject {
  id: string;
  name: string;
  column: string;
  project: Project;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Pipeline columns (project stages)
// ---------------------------------------------------------------------------

const STAGE_COLUMNS = [
  { id: "prospecting", name: "Prospecting" },
  { id: "intake", name: "Intake" },
  { id: "active", name: "Active" },
  { id: "under_review", name: "Under Review" },
  { id: "pending_client", name: "Pending Client" },
  { id: "complete", name: "Complete" },
  { id: "archived", name: "Archived" },
];

// ---------------------------------------------------------------------------
// Matter type config
// ---------------------------------------------------------------------------

const MATTER_TYPES = [
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "criminal", label: "Criminal", icon: Gavel },
  { value: "business", label: "Business", icon: Building2 },
  { value: "municipal", label: "Municipal", icon: Scale },
  { value: "landlord_tenant", label: "Landlord/Tenant", icon: Briefcase },
  { value: "estate_planning", label: "Estate Planning", icon: FileText },
];

function getMatterConfig(type: string | null) {
  return MATTER_TYPES.find((m) => m.value === type) ?? null;
}

function formatMatterType(type: string | null): string {
  return getMatterConfig(type)?.label ?? type?.replace(/_/g, " ") ?? "—";
}

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

    // Persist stage change
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
                      !matterFilter ? "font-medium text-gray-900" : "text-gray-600"
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
            <ListView
              projects={projects}
              onSelectProject={setSelectedProject}
            />
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
// Kanban View
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
                    {/* Title */}
                    <p className="text-sm font-medium text-gray-800 leading-tight mb-1.5">
                      {item.project.name}
                    </p>

                    {/* Client */}
                    {item.project.clientName && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500 truncate">
                          {item.project.clientName}
                        </span>
                      </div>
                    )}

                    {/* Matter type badge + meta */}
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
// List View
// ---------------------------------------------------------------------------

function ListView({
  projects,
  onSelectProject,
}: {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}) {
  return (
    <div className="overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="w-full text-left bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {project.name}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {project.clientName ?? "No client"} ·{" "}
                {formatMatterType(project.matterType)}
              </p>
            </div>
            {project.matterType && (
              <MatterBadge type={project.matterType} />
            )}
            <StageBadge stage={project.stage} />
          </button>
        ))}
      </div>
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
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
          <StageBadge stage={project.stage} />
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
                  onClick={() =>
                    onUpdate(project.id, { stage: col.id })
                  }
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

          {/* Counts */}
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
// Matter Type Badge
// ---------------------------------------------------------------------------

function MatterBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    real_estate: "bg-emerald-50 text-emerald-700 border-emerald-200",
    criminal: "bg-red-50 text-red-700 border-red-200",
    business: "bg-blue-50 text-blue-700 border-blue-200",
    municipal: "bg-purple-50 text-purple-700 border-purple-200",
    landlord_tenant: "bg-amber-50 text-amber-700 border-amber-200",
    estate_planning: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        colors[type] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {formatMatterType(type)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stage Badge
// ---------------------------------------------------------------------------

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    prospecting: "bg-slate-50 text-slate-600 border-slate-200",
    intake: "bg-yellow-50 text-yellow-700 border-yellow-200",
    active: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-indigo-50 text-indigo-700 border-indigo-200",
    pending_client: "bg-amber-50 text-amber-700 border-amber-200",
    complete: "bg-green-50 text-green-700 border-green-200",
    archived: "bg-gray-50 text-gray-500 border-gray-200",
  };

  const Icons: Record<string, typeof Clock> = {
    prospecting: Briefcase,
    intake: Clock,
    active: Loader2,
    under_review: FileText,
    pending_client: User,
    complete: CheckCircle2,
    archived: CheckCircle2,
  };

  const Icon = Icons[stage] ?? Clock;
  const label =
    STAGE_COLUMNS.find((c) => c.id === stage)?.name ??
    stage.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        colors[stage] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
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
  icon: typeof Home;
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