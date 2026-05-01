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
// workflows — reusable prompt templates (attorney review letter, etc.)
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
    type: text("type").notNull(),
    promptMd: text("prompt_md"),
    columnsConfig: jsonb("columns_config"),
    practice: text("practice"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workflows_user").on(table.userId),
    index("idx_workflows_org").on(table.organizationId),
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
