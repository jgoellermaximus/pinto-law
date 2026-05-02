/**
 * Seed NJ legal workflow templates into the workflows table.
 *
 * Usage:
 *   npx tsx scripts/seed-workflows.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { workflows } from "../src/lib/db/schema/legal/workflows";

const NJ_WORKFLOWS = [
  {
    title: "NJ Attorney Review Letter",
    type: "chat",
    practice: "real_estate",
    promptMd: `Draft a New Jersey Attorney Review Letter for a residential real estate transaction.

The letter should be written pursuant to the three-business-day attorney review period customary in NJ residential transactions.

Include the following standard modifications:
- Home inspection contingency with timeline
- Mortgage contingency with specific terms (loan amount, rate, type)
- Clear title requirement
- Smoke detector and CO detector compliance (NJ requirement)
- Certificate of Occupancy / Continued Occupancy
- Flood zone disclosure
- Final walk-through rights (24-48 hours before closing)
- Prorations of taxes, utilities, and HOA (if applicable)
- Time is of the essence clause
- Lead paint disclosure (for pre-1978 properties)

Format as a professional letter from Raul J. Pinto, Esq., Pinto Law Group, Elizabeth, NJ.

Ask the user for: property address, buyer name, seller name, purchase price, closing date, and any special terms.`,
    isSystem: true,
  },
  {
    title: "NJ Demand Letter",
    type: "chat",
    practice: "litigation",
    promptMd: `Draft a professional demand letter under New Jersey law.

The letter should:
1. Clearly state the legal basis for the claim (cite applicable NJ statutes)
2. Describe the facts giving rise to the demand
3. Specify the exact amount demanded with itemization
4. Reference relevant NJ consumer protection laws if applicable (NJ Consumer Fraud Act, N.J.S.A. 56:8-1 et seq.)
5. Include a reasonable deadline for response (typically 10-30 days)
6. State the consequences of non-compliance (litigation, treble damages if CFA applies)
7. Include a preservation of rights clause

Format as a professional letter from Raul J. Pinto, Esq., Pinto Law Group, Elizabeth, NJ.

Ask the user for: recipient name/address, nature of claim, amount demanded, relevant facts, and any prior communications.`,
    isSystem: true,
  },
  {
    title: "NJ Fee Agreement",
    type: "chat",
    practice: "general",
    promptMd: `Draft a New Jersey attorney fee agreement / retainer agreement.

The agreement must comply with NJ RPC 1.5 (Fees) and should include:
1. Scope of representation (specific matter or general)
2. Fee structure:
   - Flat fee (specify amount and what's included)
   - Hourly rate (specify rate and billing increments)
   - Contingency fee (if applicable, must comply with R. 1:21-7)
3. Retainer amount and how it will be applied
4. IOLTA trust account disclosure
5. Billing frequency and payment terms
6. Expense responsibility (filing fees, court costs, expert fees)
7. Termination provisions (client's right to terminate per RPC 1.16)
8. File retention policy
9. Dispute resolution (fee arbitration per R. 1:20A)

Format as a professional agreement between Raul J. Pinto, Esq., Pinto Law Group, Elizabeth, NJ and the client.

Ask the user for: client name, matter type, preferred fee structure, and estimated scope of work.`,
    isSystem: true,
  },
  {
    title: "NJ Expungement Petition",
    type: "chat",
    practice: "criminal",
    promptMd: `Draft a New Jersey Expungement Petition and supporting documents.

Guide the user through the NJ expungement process under N.J.S.A. 2C:52-1 et seq.:

1. Determine eligibility:
   - Indictable offenses: 10-year waiting period (N.J.S.A. 2C:52-2), or 5 years under "clean slate" (N.J.S.A. 2C:52-2(a))
   - Disorderly persons: 5-year waiting period (N.J.S.A. 2C:52-3)
   - Municipal ordinances: 2-year waiting period (N.J.S.A. 2C:52-4)
   - Drug court: eligible upon completion (N.J.S.A. 2C:35-14(m))
   - Dismissals/acquittals: immediate eligibility (N.J.S.A. 2C:52-6)

2. Draft the Verified Petition including:
   - Caption (Superior Court, county where conviction occurred)
   - All arrests, convictions, and dispositions
   - Statement of grounds for expungement
   - Verification and certification

3. Draft the proposed Expungement Order

4. Identify required service list:
   - County Prosecutor
   - NJ State Police
   - Attorney General
   - Municipal court (if applicable)
   - Arresting agency

Ask the user for: full name, DOB, arrest/conviction details, dates, court/county, and disposition of each charge.`,
    isSystem: true,
  },
];

async function seed() {
  console.log("Seeding NJ legal workflow templates...\n");

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  for (const wf of NJ_WORKFLOWS) {
    try {
      await db.insert(workflows).values({
        organizationId: null, // System workflows are global
        userId: null,
        title: wf.title,
        type: wf.type,
        promptMd: wf.promptMd,
        practice: wf.practice,
        isSystem: true,
      });
      console.log(`  ✓ ${wf.title}`);
    } catch (err: any) {
      console.log(`  ⚠ ${wf.title} — ${err.message}`);
    }
  }

  console.log("\n=== Workflow seed complete ===");
}

seed();
