import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// workflows — prompt templates AND document templates
//
// Two types of workflows:
//
// 1. templateType = "prompt" (original)
//    - promptMd contains AI instructions
//    - No DOCX file involved
//    - AI generates content from scratch
//
// 2. templateType = "document" (new)
//    - templateStoragePath points to a DOCX in R2
//    - templateFields defines the merge fields ({{BUYER_NAME}}, etc.)
//    - promptMd is optional — used for Layer 2 AI review after merge
//    - System does mechanical merge, optionally AI reviews result
//
// organization_id is nullable because system/builtin workflows (is_system=true)
// are global and not org-scoped.
// ---------------------------------------------------------------------------

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    title: text("title").notNull(),
    type: text("type").notNull(), // "chat" | "tabular"

    // ── Template type ──
    // "prompt" = AI prompt template (promptMd is the content)
    // "document" = DOCX merge template (templateStoragePath + templateFields)
    templateType: text("template_type").notNull().default("prompt"),

    // ── Prompt template fields ──
    promptMd: text("prompt_md"), // AI instructions (or Layer 2 review prompt for document templates)
    columnsConfig: jsonb("columns_config"), // tabular review columns

    // ── Document template fields ──
    templateStoragePath: text("template_storage_path"), // R2 key to DOCX file
    templateFileName: text("template_file_name"), // Original upload filename
    templateFields: jsonb("template_fields"), // MergeField[] — defines placeholders + mappings

    // ── Metadata ──
    practice: text("practice"),
    isSystem: boolean("is_system").notNull().default(false),

    // ── Intake routing ──
    intakeType: text("intake_type"),
    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workflows_user").on(table.userId),
    index("idx_workflows_org").on(table.organizationId),
    index("idx_workflows_intake_type").on(table.intakeType),
    index("idx_workflows_template_type").on(table.templateType),
  ],
);

// ---------------------------------------------------------------------------
// hidden_workflows — user-dismissed workflows (don't show in their list)
// ---------------------------------------------------------------------------

export const hiddenWorkflows = pgTable(
  "hidden_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    workflowId: text("workflow_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_hidden_workflows_user").on(table.userId),
    unique("hidden_workflows_user_workflow").on(
      table.userId,
      table.workflowId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// workflow_shares — share workflow templates with other users
// ---------------------------------------------------------------------------

export const workflowShares = pgTable(
  "workflow_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    sharedByUserId: text("shared_by_user_id").notNull(),
    sharedWithEmail: text("shared_with_email").notNull(),
    allowEdit: boolean("allow_edit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workflow_shares_workflow_id_idx").on(table.workflowId),
    index("workflow_shares_email_idx").on(table.sharedWithEmail),
    unique("workflow_shares_workflow_email").on(
      table.workflowId,
      table.sharedWithEmail,
    ),
  ],
);
