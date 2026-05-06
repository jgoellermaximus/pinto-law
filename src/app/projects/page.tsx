"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Loader2,
  Search,
  FolderOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  Gavel,
  Building2,
  Scale,
  Briefcase,
  FileText,
  User,
  Calendar,
  Plus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MATTER_TYPES = [
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "criminal", label: "Criminal", icon: Gavel },
  { value: "business", label: "Business", icon: Building2 },
  { value: "municipal", label: "Municipal", icon: Scale },
  { value: "landlord_tenant", label: "Landlord/Tenant", icon: Briefcase },
  { value: "estate_planning", label: "Estate Planning", icon: FileText },
];

const STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "intake", label: "Intake" },
  { value: "active", label: "Active" },
  { value: "under_review", label: "Under Review" },
  { value: "pending_client", label: "Pending Client" },
  { value: "complete", label: "Complete" },
  { value: "archived", label: "Archived" },
];

function formatMatterType(type: string | null): string {
  return (
    MATTER_TYPES.find((m) => m.value === type)?.label ??
    type?.replace(/_/g, " ") ??
    "—"
  );
}

function formatStage(stage: string): string {
  return (
    STAGES.find((s) => s.value === stage)?.label ??
    stage.replace(/_/g, " ")
  );
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<Project>[] = [
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
    accessorKey: "chat_count",
    header: ({ column }) => <SortHeader column={column} title="Chats" />,
    cell: ({ row }) => (
      <span className="text-sm text-gray-500 tabular-nums">
        {row.original.chat_count}
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

export default function ProjectsPage() {
  return (
    <SidebarProvider>
      <ProjectsPageInner />
    </SidebarProvider>
  );
}

function ProjectsPageInner() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  // State
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [matterFilter, setMatterFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // tRPC
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => projectsQuery.refetch(),
  });

  const projects: Project[] = (projectsQuery.data as Project[]) ?? [];

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  // Table
  const table = useReactTable({
    data: projects,
    columns,
    state: {
      sorting,
      globalFilter: search,
      columnFilters: [
        ...(matterFilter.length
          ? [{ id: "matterType", value: matterFilter }]
          : []),
        ...(stageFilter.length
          ? [{ id: "stage", value: stageFilter }]
          : []),
      ],
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
    globalFilterFn: (row, _id, filterValue: string) => {
      const q = filterValue.toLowerCase();
      return (
        row.original.name.toLowerCase().includes(q) ||
        (row.original.clientName?.toLowerCase().includes(q) ?? false)
      );
    },
  });

  // Loading
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Sidebar
  const sidebarContent = (
    <>
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        By Type
      </p>
      <div className="space-y-0.5">
        {MATTER_TYPES.map((mt) => {
          const count = projects.filter(
            (p) => p.matterType === mt.value,
          ).length;
          return (
            <button
              key={mt.value}
              onClick={() =>
                setMatterFilter((prev) =>
                  prev.includes(mt.value)
                    ? prev.filter((v) => v !== mt.value)
                    : [...prev, mt.value],
                )
              }
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                matterFilter.includes(mt.value)
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span>{mt.label}</span>
              {count > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {matterFilter.length > 0 && (
          <button
            onClick={() => setMatterFilter([])}
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
            <span className="font-medium text-gray-700">{projects.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Active</span>
            <span className="font-medium text-blue-600">
              {projects.filter((p) => p.stage === "active").length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">No client</span>
            <span className="font-medium text-amber-600">
              {projects.filter((p) => !p.clientId).length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">No type</span>
            <span className="font-medium text-amber-600">
              {projects.filter((p) => !p.matterType).length}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <AppLayout sidebarContent={sidebarContent}>
      <main className="flex flex-1 flex-col min-w-0">
        <AppHeader>
          <h1 className="text-sm font-semibold text-gray-800 mr-auto">
            Projects
          </h1>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 w-56 focus-within:border-gray-400 transition-colors">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Stage filter */}
          <StageFilterDropdown
            selected={stageFilter}
            onChange={setStageFilter}
          />
        </AppHeader>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {projectsQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <FolderOpen className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No projects yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create matters from the Deals page.
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-3">
              {/* Active filters summary */}
              {(matterFilter.length > 0 || stageFilter.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Showing {filteredCount} of {projects.length}</span>
                  <button
                    onClick={() => {
                      setMatterFilter([]);
                      setStageFilter([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className="bg-gray-50/80"
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length > 0 ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-gray-50/80 transition-colors"
                          onClick={() =>
                            setSelectedProject(row.original)
                          }
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center text-sm text-gray-400"
                        >
                          No matching projects.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs text-gray-400">
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Detail modal — reuse pattern from deals */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={(projectId, updates) => {
            updateProject.mutate({ projectId, ...updates });
            // Optimistically update selected project
            setSelectedProject((prev) =>
              prev ? { ...prev, ...updates } : null,
            );
          }}
        />
      )}
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Sort Header
// ---------------------------------------------------------------------------

function SortHeader({
  column,
  title,
}: {
  column: any;
  title: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <button
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 transition-colors"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-gray-300" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stage Filter Dropdown
// ---------------------------------------------------------------------------

function StageFilterDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
          selected.length > 0
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 text-gray-500 hover:border-gray-300"
        }`}
      >
        Stage
        {selected.length > 0 && (
          <span className="bg-white/20 rounded-full px-1.5 text-[10px]">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
            {STAGES.map((s) => {
              const checked = selected.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() =>
                    onChange(
                      checked
                        ? selected.filter((v) => v !== s.value)
                        : [...selected, s.value],
                    )
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                      checked
                        ? "bg-gray-900 border-gray-900"
                        : "border-gray-300"
                    }`}
                  >
                    {checked && (
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                      >
                        <path
                          d="M1.5 4L3 5.5L6.5 2"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-700">{s.label}</span>
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="flex w-full items-center justify-center px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-1"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matter Type Badge
// ---------------------------------------------------------------------------

function MatterBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-gray-400">—</span>;

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

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        colors[stage] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {formatStage(stage)}
    </span>
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
              {project.clientName ?? "No client"} ·{" "}
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
            <InfoCard label="Matter Type" value={formatMatterType(project.matterType)} />
            <InfoCard label="Client" value={project.clientName ?? "—"} />
            <InfoCard label="Documents" value={String(project.document_count)} />
            <InfoCard
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
              <p className="text-xs text-amber-600">
                No client linked — you can update this anytime.
              </p>
            </div>
          )}

          {/* No matter type nudge */}
          {!project.matterType && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-6">
              <Scale className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-blue-600 mb-2">
                  No matter type set — select one:
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
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

          {/* Stage */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stage
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STAGES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onUpdate(project.id, { stage: s.value })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    project.stage === s.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity */}
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
// Info Card
// ---------------------------------------------------------------------------

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
