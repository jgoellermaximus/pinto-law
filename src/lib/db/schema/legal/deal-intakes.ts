import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// deal_intakes — realtor-submitted deal information
// Tracks the full lifecycle: submitted → letter_generated → approved → sent
// ---------------------------------------------------------------------------

export const dealIntakes = pgTable(
  "deal_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),

    // Status: submitted | letter_generated | approved | sent
    status: text("status").notNull().default("submitted"),

    // Property details
    propertyAddress: text("property_address").notNull(),
    propertyCity: text("property_city").notNull(),
    propertyState: text("property_state").notNull().default("NJ"),
    propertyZip: text("property_zip").notNull(),

    // Parties
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email"),
    buyerPhone: text("buyer_phone"),
    buyerAttorney: text("buyer_attorney"),
    sellerName: text("seller_name").notNull(),
    sellerEmail: text("seller_email"),
    sellerPhone: text("seller_phone"),
    sellerAttorney: text("seller_attorney"),

    // Deal terms
    purchasePrice: integer("purchase_price").notNull(),
    closingDate: text("closing_date"),
    mortgageContingency: text("mortgage_contingency"),
    inspectionContingency: text("inspection_contingency"),
    additionalTerms: text("additional_terms"),

    // Realtor info
    realtorName: text("realtor_name").notNull(),
    realtorEmail: text("realtor_email"),
    realtorPhone: text("realtor_phone"),
    realtorBrokerage: text("realtor_brokerage"),

    // Representing side
    representingSide: text("representing_side").notNull().default("buyer"),

    // Generated letter (stored as text after AI generates)
    generatedLetter: text("generated_letter"),
    approvedLetter: text("approved_letter"),

    // Notes from attorney
    attorneyNotes: text("attorney_notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_deal_intakes_org").on(table.organizationId),
    index("idx_deal_intakes_status").on(table.status),
    index("idx_deal_intakes_created").on(table.createdAt),
  ],
);
