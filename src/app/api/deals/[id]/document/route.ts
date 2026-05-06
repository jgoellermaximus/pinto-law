/**
 * GET /api/deals/[id]/document
 *
 * Downloads the generated DOCX for a deal intake.
 * Requires auth (attorney/admin only).
 */

import { db } from "@/lib/db";
import { dealIntakes } from "@/lib/db/schema/legal";
import { downloadFile } from "@/lib/storage";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const session = await auth.getSession();
  if (!session?.data?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Look up the deal
  const [deal] = await db
    .select({
      generatedDocPath: dealIntakes.generatedDocPath,
      generatedDocFilename: dealIntakes.generatedDocFilename,
    })
    .from(dealIntakes)
    .where(eq(dealIntakes.id, id))
    .limit(1);

  if (!deal?.generatedDocPath) {
    return Response.json(
      { error: "No generated document found" },
      { status: 404 },
    );
  }

  try {
    const buffer = await downloadFile(deal.generatedDocPath);
    const filename = deal.generatedDocFilename ?? "attorney-review.docx";

    // Convert Buffer to Uint8Array for Response compatibility
    const bytes = new Uint8Array(buffer);

    return new Response(bytes, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[document download] error:", err);
    return Response.json(
      { error: "Failed to download document" },
      { status: 500 },
    );
  }
}
