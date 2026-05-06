import {
  Home,
  Gavel,
  Building2,
  Scale,
  Briefcase,
  FileText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Matter types
// ---------------------------------------------------------------------------

export const MATTER_TYPES = [
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "criminal", label: "Criminal", icon: Gavel },
  { value: "business", label: "Business", icon: Building2 },
  { value: "municipal", label: "Municipal", icon: Scale },
  { value: "landlord_tenant", label: "Landlord/Tenant", icon: Briefcase },
  { value: "estate_planning", label: "Estate Planning", icon: FileText },
] as const;

export function formatMatterType(type: string | null): string {
  return (
    MATTER_TYPES.find((m) => m.value === type)?.label ??
    type?.replace(/_/g, " ") ??
    "—"
  );
}

export function getMatterConfig(type: string | null) {
  return MATTER_TYPES.find((m) => m.value === type) ?? null;
}

// ---------------------------------------------------------------------------
// Stages (universal project pipeline)
// ---------------------------------------------------------------------------

export const STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "intake", label: "Intake" },
  { value: "active", label: "Active" },
  { value: "under_review", label: "Under Review" },
  { value: "pending_client", label: "Pending Client" },
  { value: "complete", label: "Complete" },
  { value: "archived", label: "Archived" },
] as const;

export function formatStage(stage: string): string {
  return (
    STAGES.find((s) => s.value === stage)?.label ??
    stage.replace(/_/g, " ")
  );
}

// ---------------------------------------------------------------------------
// Intake types (for workflow template routing)
// ---------------------------------------------------------------------------

export const INTAKE_TYPES = [
  { value: "attorney_review", label: "Attorney Review" },
  { value: "demand_letter", label: "Demand Letter" },
  { value: "fee_agreement", label: "Fee Agreement" },
  { value: "expungement_petition", label: "Expungement Petition" },
] as const;

export function formatIntakeType(type: string | null): string {
  return (
    INTAKE_TYPES.find((t) => t.value === type)?.label ??
    type?.replace(/_/g, " ") ??
    "—"
  );
}
