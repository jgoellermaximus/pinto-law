"use client";

import { trpc } from "@/trpc/client";
import {
  Loader2,
  FileText,
  ArrowRight,
  Upload,
  CheckCircle2,
  MessageSquare,
  UserPlus,
  FolderPlus,
  StickyNote,
  Zap,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Action display config
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<
  string,
  {
    icon: typeof FileText;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  intake_submitted: {
    icon: Upload,
    label: "Intake submitted",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  letter_generated: {
    icon: FileText,
    label: "Letter generated",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  docx_merged: {
    icon: FileText,
    label: "Document merged",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  stage_changed: {
    icon: ArrowRight,
    label: "Stage changed",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  deal_approved: {
    icon: CheckCircle2,
    label: "Deal approved",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  note_updated: {
    icon: StickyNote,
    label: "Notes updated",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  template_uploaded: {
    icon: Upload,
    label: "Template uploaded",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  document_uploaded: {
    icon: Upload,
    label: "Document uploaded",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  client_created: {
    icon: UserPlus,
    label: "Client created",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
  },
  project_created: {
    icon: FolderPlus,
    label: "Project created",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
};

const DEFAULT_CONFIG = {
  icon: Zap,
  label: "Activity",
  color: "text-gray-600",
  bgColor: "bg-gray-100",
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatStageLabel(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getMetadataDetail(entry: ActivityEntry): string | null {
  const meta = entry.metadata;
  if (!meta) return null;

  if (entry.action === "stage_changed" && meta.from && meta.to) {
    return `${formatStageLabel(meta.from as string)} → ${formatStageLabel(meta.to as string)}`;
  }

  if (entry.action === "docx_merged" || entry.action === "letter_generated") {
    const parts: string[] = [];
    if (meta.workflowTitle) parts.push(String(meta.workflowTitle));
    if (meta.filledFields)
      parts.push(`${meta.filledFields} fields filled`);
    if (meta.filename) parts.push(String(meta.filename));
    return parts.join(" · ");
  }

  if (entry.action === "client_created" && meta.clientName) {
    return String(meta.clientName);
  }

  if (entry.action === "project_created" && meta.projectName) {
    return String(meta.projectName);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Timeline Component
// ---------------------------------------------------------------------------

export function ActivityTimeline({
  projectId,
  dealIntakeId,
}: {
  projectId: string;
  dealIntakeId?: string | null;
}) {
  // Build entity list — always include project, optionally include deal_intake
  const entities = [{ entityType: "project", entityId: projectId }];
  if (dealIntakeId) {
    entities.push({ entityType: "deal_intake", entityId: dealIntakeId });
  }

  const { data: activities, isLoading } =
    trpc.activityLog.listByEntities.useQuery(
      { entities, limit: 50 },
      { enabled: !!projectId },
    );

  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Activity
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-400">Loading activity…</span>
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="flex items-center gap-2 py-4">
          <Clock className="h-4 w-4 text-gray-300" />
          <span className="text-sm text-gray-400">No activity yet</span>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

          <div className="space-y-3">
            {activities.map((entry) => {
              const config =
                ACTION_CONFIG[entry.action] ?? DEFAULT_CONFIG;
              const Icon = config.icon;
              const detail = getMetadataDetail(entry as ActivityEntry);
              const actorLabel =
                entry.actorType === "system"
                  ? "System"
                  : entry.actorName ?? "User";

              return (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  {/* Icon dot */}
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor} z-10`}
                  >
                    <Icon className={`h-3 w-3 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {config.label}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </div>

                    {detail && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {detail}
                      </p>
                    )}

                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {actorLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
