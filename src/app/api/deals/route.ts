import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { dealIntakes } from "@/lib/db/schema/legal";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.getSession();
  if (!session?.data?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deals = await db
    .select()
    .from(dealIntakes)
    .where(eq(dealIntakes.organizationId, "pinto-law-group"))
    .orderBy(desc(dealIntakes.createdAt));

  return Response.json(deals);
}
