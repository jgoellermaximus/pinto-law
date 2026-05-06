import {
  Clock,
  Loader2,
  FileText,
  User,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import {
  formatMatterType,
  formatStage,
  formatIntakeType,
  STAGES,
} from "@/components/shared/constants";

// ---------------------------------------------------------------------------
// Matter Type Badge
// ---------------------------------------------------------------------------

const MATTER_COLORS: Record<string, string> = {
  real_estate: "bg-emerald-50 text-emerald-700 border-emerald-200",
  criminal: "bg-red-50 text-red-700 border-red-200",
  business: "bg-blue-50 text-blue-700 border-blue-200",
  municipal: "bg-purple-50 text-purple-700 border-purple-200",
  landlord_tenant: "bg-amber-50 text-amber-700 border-amber-200",
  estate_planning: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function MatterBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-gray-400">—</span>;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        MATTER_COLORS[type] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {formatMatterType(type)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stage Badge
// ---------------------------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-slate-50 text-slate-600 border-slate-200",
  intake: "bg-yellow-50 text-yellow-700 border-yellow-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pending_client: "bg-amber-50 text-amber-700 border-amber-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};

const STAGE_ICONS: Record<string, typeof Clock> = {
  prospecting: Briefcase,
  intake: Clock,
  active: Loader2,
  under_review: FileText,
  pending_client: User,
  complete: CheckCircle2,
  archived: CheckCircle2,
};

/**
 * Compact badge (no icon) — used in DataTable cells.
 */
export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        STAGE_COLORS[stage] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {formatStage(stage)}
    </span>
  );
}

/**
 * Full badge with icon — used in kanban cards, detail modals.
 */
export function StageBadgeFull({ stage }: { stage: string }) {
  const Icon = STAGE_ICONS[stage] ?? Clock;
  const label =
    STAGES.find((s) => s.value === stage)?.label ??
    stage.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        STAGE_COLORS[stage] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Intake Type Badge
// ---------------------------------------------------------------------------

const INTAKE_COLORS: Record<string, string> = {
  attorney_review: "bg-emerald-50 text-emerald-700 border-emerald-200",
  demand_letter: "bg-red-50 text-red-700 border-red-200",
  fee_agreement: "bg-blue-50 text-blue-700 border-blue-200",
  expungement_petition: "bg-purple-50 text-purple-700 border-purple-200",
};

export function IntakeTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-gray-400">—</span>;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        INTAKE_COLORS[type] ?? "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {formatIntakeType(type)}
    </span>
  );
}
