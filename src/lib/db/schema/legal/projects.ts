import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { clients } from "./clients";

// ---------------------------------------------------------------------------
// projects — top-level containers (matters in legal context)
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    matterType: text("matter_type"), // real_estate | criminal | business | municipal | landlord_tenant | estate_planning
    stage: text("stage").notNull().default("intake"), // prospecting | intake | active | under_review | pending_client | complete | archived
    cmNumber: text("cm_number"),
    description: text("description"),
    notes: text("notes"),
    dealIntakeId: uuid("deal_intake_id"),
    visibility: text("visibility").notNull().default("private"),
    sharedWith: jsonb("shared_with").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_projects_user").on(table.userId),
    index("idx_projects_org").on(table.organizationId),
    index("idx_projects_client").on(table.clientId),
    index("idx_projects_stage").on(table.organizationId, table.stage),
  ],
);

// ---------------------------------------------------------------------------
// project_subfolders — nested folders within a project/matter
// ---------------------------------------------------------------------------

export const projectSubfolders = pgTable(
  "project_subfolders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    parentFolderId: uuid("parent_folder_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_project_subfolders_project").on(table.projectId),
  ],
);