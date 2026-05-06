/**
 * POST /api/auth/setup-profile
 *
 * Called automatically after signup to create a user_profile record.
 * Looks up the user in neon_auth."user" by email to get auth ID.
 * Idempotent — safe to call multiple times.
 */

import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema/legal";
import { eq, sql } from "drizzle-orm";

const ORG_ID = "pinto-law-group";
const DEFAULT_ROLE = "paralegal";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email?.trim()?.toLowerCase();
    const name = body.name?.trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Look up user in Neon Auth
    const authUser = await db.execute(
      sql`SELECT id, email, name FROM neon_auth."user" WHERE email = ${email} LIMIT 1`,
    );

    const user = authUser.rows?.[0] as
      | { id: string; email: string; name: string | null }
      | undefined;

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Check if profile already exists
    const [existing] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    if (existing) {
      return Response.json({ ok: true, existing: true });
    }

    // Create profile
    const [profile] = await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        displayName: name ?? user.name ?? null,
        organisation: "Pinto Law Group",
        role: DEFAULT_ROLE,
      })
      .returning();

    console.log(
      `[setup-profile] Created profile for ${profile.displayName ?? user.id} (${DEFAULT_ROLE})`,
    );

    return Response.json({ ok: true, profile });
  } catch (err) {
    console.error("[setup-profile] error:", err);
    return Response.json(
      { error: "Failed to create profile" },
      { status: 500 },
    );
  }
}