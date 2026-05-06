/**
 * seed-workflow-intake-types.ts
 *
 * Updates the 4 seeded NJ workflow templates with intake_type + is_default.
 * Run after applying the Drizzle migration that adds these columns.
 *
 * Usage: npx tsx scripts/seed-workflow-intake-types.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, ilike } from "drizzle-orm";
import { workflows } from "../src/lib/db/schema/legal";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const INTAKE_ASSIGNMENTS: { titlePattern: string; intakeType: string }[] = [
  {
    titlePattern: "%Attorney Review%",
    intakeType: "attorney_review",
  },
  {
    titlePattern: "%Demand Letter%",
    intakeType: "demand_letter",
  },
  {
    titlePattern: "%Fee Agreement%",
    intakeType: "fee_agreement",
  },
  {
    titlePattern: "%Expungement%",
    intakeType: "expungement_petition",
  },
];

async function main() {
  console.log("Updating workflow intake types...\n");

  for (const assignment of INTAKE_ASSIGNMENTS) {
    // Find workflow by title pattern
    const rows = await db
      .select({ id: workflows.id, title: workflows.title })
      .from(workflows)
      .where(ilike(workflows.title, assignment.titlePattern));

    if (rows.length === 0) {
      console.log(`  ⚠ No workflow matching "${assignment.titlePattern}"`);
      continue;
    }

    for (const row of rows) {
      await db
        .update(workflows)
        .set({
          intakeType: assignment.intakeType,
          isDefault: true,
        })
        .where(eq(workflows.id, row.id));

      console.log(
        `  ✓ ${row.title} → intake_type: ${assignment.intakeType}, is_default: true`,
      );
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
