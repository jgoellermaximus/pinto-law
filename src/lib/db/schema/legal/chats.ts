import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

// ---------------------------------------------------------------------------
// chats — AI conversation threads (per-matter or standalone)
// ---------------------------------------------------------------------------

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_chats_user").on(table.userId),
    index("idx_chats_project").on(table.projectId),
    index("idx_chats_org").on(table.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// chat_messages — individual messages with files and annotations
// ---------------------------------------------------------------------------

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content"),
    files: jsonb("files"),
    annotations: jsonb("annotations"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_chat_messages_chat").on(table.chatId),
  ],
);
