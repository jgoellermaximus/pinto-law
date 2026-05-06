/**
 * POST /api/intake
 *
 * Public endpoint — no auth required (realtors submit without an account).
 * Saves the deal instantly, returns confirmation to the realtor immediately,
 * then generates the attorney review letter in the background.
 *
 * Flow:
 * 1. Save deal_intakes record (form data)
 * 2. Find or create client (by brokerage or realtor name)
 * 3. Create project (matter_type: real_estate, stage: intake, linked to client)
 * 4. Generate attorney review letter in background (fire-and-forget)
 * 5. Return instant confirmation to realtor
 */

import { db } from "@/lib/db";
import {
  dealIntakes,
  clients,
  projects,
  userProfiles,
} from "@/lib/db/schema/legal";
import { completeText, DEFAULT_MAIN_MODEL } from "@/lib/llm";
import { eq, and } from "drizzle-orm";

const ORG_ID = "pinto-law-group";

// ---------------------------------------------------------------------------
// Find the attorney user to assign projects to
// ---------------------------------------------------------------------------

async function getAttorneyUserId(): Promise<string> {
  // First try: find an attorney
  const [attorney] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.role, "attorney"))
    .limit(1);

  if (attorney) return attorney.userId;

  // Fallback: find an admin
  const [admin] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.role, "admin"))
    .limit(1);

  if (admin) return admin.userId;

  // Last resort: first user
  const [any] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .limit(1);

  if (any) return any.userId;

  throw new Error("No users found — cannot assign project");
}

// ---------------------------------------------------------------------------
// Find or create client
// ---------------------------------------------------------------------------

async function findOrCreateClient(
  realtorName: string,
  realtorBrokerage: string | null,
  realtorEmail: string | null,
  realtorPhone: string | null,
): Promise<string> {
  const clientName = realtorBrokerage?.trim() || realtorName.trim();
  const clientType = realtorBrokerage ? "brokerage" : "individual";

  // Check if client already exists
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.organizationId, ORG_ID), eq(clients.name, clientName)),
    )
    .limit(1);

  if (existing) return existing.id;

  // Create new client
  const [newClient] = await db
    .insert(clients)
    .values({
      organizationId: ORG_ID,
      name: clientName,
      type: clientType,
      email: realtorEmail,
      phone: realtorPhone,
    })
    .returning({ id: clients.id });

  console.log(`[intake] Created client: ${clientName} (${clientType})`);
  return newClient.id;
}

// ---------------------------------------------------------------------------
// Letter prompt builder
// ---------------------------------------------------------------------------

function buildLetterPrompt(deal: Record<string, string>): string {
  const price = Number(deal.purchasePrice).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return `You are drafting an Attorney Review Letter for a New Jersey residential real estate transaction on behalf of Raul J. Pinto, Esq., Pinto Law Group, Elizabeth, NJ.

DEAL DETAILS:
- Property: ${deal.propertyAddress}, ${deal.propertyCity}, NJ ${deal.propertyZip}
- Buyer: ${deal.buyerName}
- Seller: ${deal.sellerName}
- Purchase Price: ${price}
- Closing Date: ${deal.closingDate || "TBD"}
- Mortgage Contingency: ${deal.mortgageContingency}
- Inspection Contingency: ${deal.inspectionContingency}
- Representing: ${deal.representingSide}
- Realtor: ${deal.realtorName}, ${deal.realtorBrokerage || "Independent"}
${deal.additionalTerms ? `- Additional Terms: ${deal.additionalTerms}` : ""}

Draft a professional NJ Attorney Review Letter that:

1. States that this letter is written pursuant to the three-business-day attorney review period customary in New Jersey residential real estate transactions
2. Identifies the parties, property, and purchase price
3. Includes standard NJ attorney review modifications:
   - Home inspection contingency (if applicable)
   - Mortgage contingency with specific terms (if applicable)
   - Clear title requirement
   - Smoke detector / CO detector compliance (NJ requirement)
   - Certificate of Occupancy / Certificate of Continued Occupancy
   - Flood zone disclosure
   - Final walk-through rights
   - Prorations (taxes, utilities, HOA if applicable)
   - Time is of the essence clause
4. Notes any specific issues based on the deal details provided
5. Closes with standard attorney review letter language

Format as a professional letter from:
Raul J. Pinto, Esq.
Pinto Law Group
Elizabeth, New Jersey

The letter should be thorough but concise, following NJ real estate attorney review conventions. Use formal legal language appropriate for a small-firm NJ practitioner.`;
}

// ---------------------------------------------------------------------------
// Background letter generation — fire-and-forget after instant response
// ---------------------------------------------------------------------------

async function generateLetterInBackground(
  intakeId: string,
  dealData: Record<string, string>,
) {
  const prompt = buildLetterPrompt(dealData);
  const model = DEFAULT_MAIN_MODEL;
  const systemPrompt =
    "You are a New Jersey real estate attorney drafting professional legal documents. Be thorough and precise.";

  const letter = await completeText({
    model,
    systemPrompt,
    user: prompt,
    maxTokens: 4096,
    apiKeys: {
      openrouter: process.env.OPENROUTER_API_KEY ?? null,
    },
  });

  // Save letter + update status
  await db
    .update(dealIntakes)
    .set({
      generatedLetter: letter,
      status: "letter_generated",
      updatedAt: new Date(),
    })
    .where(eq(dealIntakes.id, intakeId));

  console.log(`[intake] Letter generated for ${intakeId}`);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    const required = [
      "propertyAddress",
      "propertyCity",
      "propertyZip",
      "buyerName",
      "sellerName",
      "purchasePrice",
      "realtorName",
    ];

    for (const field of required) {
      if (!body[field]?.toString().trim()) {
        return Response.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    // 1. Save the intake immediately
    const [intake] = await db
      .insert(dealIntakes)
      .values({
        organizationId: ORG_ID,
        propertyAddress: body.propertyAddress.trim(),
        propertyCity: body.propertyCity.trim(),
        propertyZip: body.propertyZip.trim(),
        buyerName: body.buyerName.trim(),
        buyerEmail: body.buyerEmail?.trim() || null,
        buyerPhone: body.buyerPhone?.trim() || null,
        sellerName: body.sellerName.trim(),
        sellerEmail: body.sellerEmail?.trim() || null,
        sellerPhone: body.sellerPhone?.trim() || null,
        purchasePrice: parseInt(body.purchasePrice, 10),
        closingDate: body.closingDate?.trim() || null,
        mortgageContingency: body.mortgageContingency || "yes",
        inspectionContingency: body.inspectionContingency || "yes",
        additionalTerms: body.additionalTerms?.trim() || null,
        realtorName: body.realtorName.trim(),
        realtorEmail: body.realtorEmail?.trim() || null,
        realtorPhone: body.realtorPhone?.trim() || null,
        realtorBrokerage: body.realtorBrokerage?.trim() || null,
        representingSide: body.representingSide || "buyer",
      })
      .returning();

    // 2. Find or create client
    let clientId: string | null = null;
    try {
      clientId = await findOrCreateClient(
        body.realtorName.trim(),
        body.realtorBrokerage?.trim() || null,
        body.realtorEmail?.trim() || null,
        body.realtorPhone?.trim() || null,
      );
    } catch (err) {
      console.error("[intake] client creation failed:", err);
    }

    // 3. Create project
    try {
      const userId = await getAttorneyUserId();
      const projectName = `${body.propertyAddress.trim()}, ${body.propertyCity.trim()} — ${body.buyerName.trim()}/${body.sellerName.trim()}`;

      await db.insert(projects).values({
        organizationId: ORG_ID,
        userId,
        clientId,
        name: projectName,
        matterType: "real_estate",
        stage: "intake",
      });

      console.log(`[intake] Created project: ${projectName}`);
    } catch (err) {
      console.error("[intake] project creation failed:", err);
    }

    // 4. Return instantly — realtor sees immediate confirmation
    // 5. Generate letter in background (fire-and-forget)
    generateLetterInBackground(intake.id, body).catch((err) =>
      console.error("[intake] background generation failed:", err),
    );

    return Response.json({
      ok: true,
      id: intake.id,
      status: "submitted",
    });
  } catch (err) {
    console.error("[intake] error:", err);
    return Response.json(
      { error: "Failed to process intake" },
      { status: 500 },
    );
  }
}
