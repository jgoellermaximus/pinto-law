/**
 * POST /api/intake
 *
 * Public endpoint — no auth required (realtors submit without an account).
 * Saves the deal instantly, returns confirmation to the realtor immediately,
 * then generates the attorney review letter in the background.
 *
 * Future: intake type routes to the appropriate workflow template.
 * Prompts are saved on the record for tracking and optimization (AutoResearch).
 */

import { db } from "@/lib/db";
import { dealIntakes } from "@/lib/db/schema/legal";
import { completeText, DEFAULT_MAIN_MODEL } from "@/lib/llm";
import { eq } from "drizzle-orm";

const ORG_ID = "pinto-law-group";

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

  // Save letter + the prompt used (for AutoResearch optimization tracking)
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

    // 2. Return instantly — realtor sees immediate confirmation
    // 3. Generate letter in background (fire-and-forget)
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