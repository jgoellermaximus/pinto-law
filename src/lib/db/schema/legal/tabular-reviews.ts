import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { documents } from "./documents";
import { workflows } from "./workflows";

// ---------------------------------------------------------------------------
// tabular_reviews — bulk document analysis grids (due diligence)
// ---------------------------------------------------------------------------

export const tabularReviews = pgTable(
  "tabular_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull(),
    title: text("title"),
    columnsConfig: jsonb("columns_config"),
    workflowId: uuid("workflow_id").references(() => workflows.id, {
      onDelete: "set null",
    }),
    practice: text("practice"),
    sharedWith: jsonb("shared_with").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tabular_reviews_user").on(table.userId),
    index("idx_tabular_reviews_project").on(table.projectId),
    index("idx_tabular_reviews_org").on(table.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// tabular_cells — extracted data per cell in a review grid
// ---------------------------------------------------------------------------

export const tabularCells = pgTable(
  "tabular_cells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => tabularReviews.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    columnIndex: integer("column_index").notNull(),
    content: text("content"),
    citations: jsonb("citations"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tabular_cells_review").on(
      table.reviewId,
      table.documentId,
      table.columnIndex,
    ),
  ],
);

// ---------------------------------------------------------------------------
// tabular_review_chats — chat threads within a tabular review
// ---------------------------------------------------------------------------

export const tabularReviewChats = pgTable(
  "tabular_review_chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => tabularReviews.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tabular_review_chats_review_idx").on(table.reviewId),
    index("tabular_review_chats_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// tabular_review_chat_messages — messages within tabular review chats
// ---------------------------------------------------------------------------

export const tabularReviewChatMessages = pgTable(
  "tabular_review_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => tabularReviewChats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content"),
    annotations: jsonb("annotations"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tabular_review_chat_messages_chat_idx").on(table.chatId),
  ],
);
