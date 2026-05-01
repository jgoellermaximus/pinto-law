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

// ---------------------------------------------------------------------------
// documents — files with metadata (contracts, reports, filings)
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull(),
    filename: text("filename").notNull(),
    fileType: text("file_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    pageCount: integer("page_count"),
    structureTree: jsonb("structure_tree"),
    status: text("status").notNull().default("pending"),
    folderId: uuid("folder_id"),
    // Circular ref to document_versions — no FK constraint in Drizzle,
    // enforced at procedure level. Set via UPDATE after version insert.
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_documents_user_project").on(table.userId, table.projectId),
    index("idx_documents_project_folder").on(table.projectId, table.folderId),
    index("idx_documents_org").on(table.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// document_versions — version history with R2 storage paths
// ---------------------------------------------------------------------------

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    pdfStoragePath: text("pdf_storage_path"),
    source: text("source").notNull().default("upload"),
    versionNumber: integer("version_number"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("document_versions_document_id_idx").on(table.documentId),
    index("document_versions_doc_vnum_idx").on(
      table.documentId,
      table.versionNumber,
    ),
  ],
);

// ---------------------------------------------------------------------------
// document_edits — tracked changes (accept/reject per edit)
// ---------------------------------------------------------------------------

export const documentEdits = pgTable(
  "document_edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chatMessageId: uuid("chat_message_id"),
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    changeId: text("change_id").notNull(),
    delWId: text("del_w_id"),
    insWId: text("ins_w_id"),
    deletedText: text("deleted_text").notNull().default(""),
    insertedText: text("inserted_text").notNull().default(""),
    contextBefore: text("context_before"),
    contextAfter: text("context_after"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("document_edits_document_id_idx").on(table.documentId),
    index("document_edits_message_id_idx").on(table.chatMessageId),
    index("document_edits_version_id_idx").on(table.versionId),
  ],
);
