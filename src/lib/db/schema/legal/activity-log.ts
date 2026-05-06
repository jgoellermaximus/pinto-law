import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// activity_log — audit trail for key events across the platform
//
// Tracks: intake submissions, letter generation, stage changes,
// template uploads, document uploads, approvals, note updates, etc.
// ---------------------------------------------------------------------------

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),

    // Who performed the action
    actorType: text("actor_type").notNull().default("system"), // system | user
    actorId: text("actor_id"),        // userId if user-initiated, null if system
    actorName: text("actor_name"),    // display name for timeline rendering

    // What happened
    action: text("action").notNull(),
    // Actions:
    //   intake_submitted, letter_generated, docx_merged,
    //   stage_changed, deal_approved, note_updated,
    //   template_uploaded, document_uploaded,
    //   client_created, project_created

    // What entity was affected
    entityType: text("entity_type").notNull(), // deal_intake | project | workflow | document | client
    entityId: text("entity_id").notNull(),     // UUID of the affected entity

    // Additional context (flexible)
    // e.g., { from: "intake", to: "active" } for stage changes
    // e.g., { templateType: "document", filename: "..." } for template uploads
    // e.g., { filledFields: 15, missingFields: ["ADDITIONAL_TERMS"] } for DOCX merge
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_activity_log_entity").on(table.entityType, table.entityId),
    index("idx_activity_log_org").on(table.organizationId, table.createdAt),
    index("idx_activity_log_actor").on(table.actorId),
  ],
);
