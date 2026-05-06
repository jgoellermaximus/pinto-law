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
 *    → resolves default workflow template for "attorney_review" intake type
 *    → document template: DOCX merge → upload to R2 → link to deal
 *    → prompt template: AI generation → save text to deal
 *    → falls back to hardcoded prompt if no workflow exists
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
import {
  getIntakePrompt,
  resolveIntakeTemplate,
} from "@/lib/legal/getIntakePrompt";
import { uploadFile, generatedDocKey } from "@/lib/storage";
import { eq, and } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

const ORG_ID = "pinto-law-group";

// ---------------------------------------------------------------------------
// Find the attorney user to assign projects to
// ---------------------------------------------------------------------------

async function getAttorneyUserId(): Promise<string> {
  const [attorney] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.role, "attorney"))
    .limit(1);

  if (attorney) return attorney.userId;

  const [admin] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.role, "admin"))
    .limit(1);

  if (admin) return admin.userId;

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

  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.organizationId, ORG_ID), eq(clients.name, clientName)),
    )
    .limit(1);

  if (existing) return existing.id;

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
// Build deal details string for prompt substitution
// ---------------------------------------------------------------------------

function buildDealDetails(deal: Record<string, string>): string {
  const price = Number(deal.purchasePrice).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return `- Property: ${deal.propertyAddress}, ${deal.propertyCity}, NJ ${deal.propertyZip}
- Buyer: ${deal.buyerName}
- Seller: ${deal.sellerName}
- Purchase Price: ${price}
- Closing Date: ${deal.closingDate || "TBD"}
- Mortgage Contingency: ${deal.mortgageContingency}
- Inspection Contingency: ${deal.inspectionContingency}
- Representing: ${deal.representingSide}
- Realtor: ${deal.realtorName}, ${deal.realtorBrokerage || "Independent"}${deal.additionalTerms ? `\n- Additional Terms: ${deal.additionalTerms}` : ""}`;
}

// ---------------------------------------------------------------------------
// Background letter generation — fire-and-forget after instant response
// Handles both document (DOCX merge) and prompt (AI generation) templates
// ---------------------------------------------------------------------------

async function generateLetterInBackground(
  intakeId: string,
  dealData: Record<string, string>,
) {
  const result = await resolveIntakeTemplate("attorney_review", dealData);

  console.log(
    `[intake] Template resolved: type=${result.type}, workflow=${
      result.workflowTitle ?? "fallback"
    }`,
  );

  if (result.type === "document") {
    // ── DOCX merge path ──
    const r2Key = generatedDocKey(intakeId, result.filename);

    await uploadFile(
      r2Key,
      result.buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    console.log(
      `[intake] DOCX uploaded to R2: ${r2Key} (${result.filledFields.length} fields filled, ${result.missingFields.length} missing)`,
    );

    if (result.missingFields.length > 0) {
      console.warn(
        `[intake] Missing merge fields: ${result.missingFields.join(", ")}`,
      );
    }

    await db
      .update(dealIntakes)
      .set({
        generatedDocPath: r2Key,
        generatedDocFilename: result.filename,
        status: "letter_generated",
        updatedAt: new Date(),
      })
      .where(eq(dealIntakes.id, intakeId));

    console.log(`[intake] DOCX merge complete for ${intakeId}`);

    logActivity({
      organizationId: ORG_ID,
      actorType: "system",
      action: "docx_merged",
      entityType: "deal_intake",
      entityId: intakeId,
      metadata: {
        workflowTitle: result.workflowTitle,
        filename: result.filename,
        filledFields: result.filledFields.length,
        missingFields: result.missingFields,
      },
    }).catch(console.error);

    return;
  }

  // ── Prompt (AI generation) path ──
  const dealDetails = buildDealDetails(dealData);
  const prompt = result.prompt.replace("{{DEAL_DETAILS}}", dealDetails);

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

  await db
    .update(dealIntakes)
    .set({
      generatedLetter: letter,
      status: "letter_generated",
      updatedAt: new Date(),
    })
    .where(eq(dealIntakes.id, intakeId));

  console.log(`[intake] AI letter generated for ${intakeId}`);

  logActivity({
    organizationId: ORG_ID,
    actorType: "system",
    action: "letter_generated",
    entityType: "deal_intake",
    entityId: intakeId,
    metadata: {
      workflowId: result.workflowId,
      workflowTitle: result.workflowTitle,
      templateType: "prompt",
    },
  }).catch(console.error);
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

    // Log intake submission — attribute to the realtor who submitted
    logActivity({
      organizationId: ORG_ID,
      actorType: "system",
      actorName: `${body.realtorName.trim()}${body.realtorBrokerage ? ` (${body.realtorBrokerage.trim()})` : ""}`,
      action: "intake_submitted",
      entityType: "deal_intake",
      entityId: intake.id,
      metadata: {
        propertyAddress: body.propertyAddress.trim(),
        buyerName: body.buyerName.trim(),
        sellerName: body.sellerName.trim(),
        realtorName: body.realtorName.trim(),
      },
    }).catch(console.error);

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

      const desc = `Real estate intake: ${body.buyerName.trim()} purchasing ${body.propertyAddress.trim()}, ${body.propertyCity.trim()} NJ ${body.propertyZip.trim()} for ${Number(body.purchasePrice).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. Submitted by ${body.realtorName.trim()}${body.realtorBrokerage ? ` (${body.realtorBrokerage.trim()})` : ""}.`;

      await db.insert(projects).values({
        organizationId: ORG_ID,
        userId,
        clientId,
        name: projectName,
        matterType: "real_estate",
        stage: "intake",
        description: desc,
        dealIntakeId: intake.id,
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
