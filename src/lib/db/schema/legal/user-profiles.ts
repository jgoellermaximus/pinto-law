import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// user_profiles — per-user settings, API keys, model preferences
// No organization_id — this is user-level, not org-scoped.
// user_id references Neon Auth neon_auth.users(id) but no FK constraint
// in Drizzle to avoid type mismatches with the managed auth schema.
// ---------------------------------------------------------------------------

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().unique(),
    displayName: text("display_name"),
    organisation: text("organisation"),
    tier: text("tier").notNull().default("Free"),
    messageCreditsUsed: integer("message_credits_used").notNull().default(0),
    creditsResetDate: timestamp("credits_reset_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tabularModel: text("tabular_model")
      .notNull()
      .default("gemini-3-flash-preview"),
    claudeApiKey: text("claude_api_key"),
    geminiApiKey: text("gemini_api_key"),
    openrouterApiKey: text("openrouter_api_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_user_profiles_user").on(table.userId),
  ],
);
