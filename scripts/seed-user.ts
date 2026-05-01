/**
 * Seed script — creates Jared's admin account.
 * Raul will create his own account via the sign-up page.
 *
 * Usage:
 *   npx tsx scripts/seed-user.ts
 *
 * Requires .env.local with DATABASE_URL, NEON_AUTH_BASE_URL
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { userProfiles } from "../src/lib/db/schema/legal/user-profiles";

const DEMO_USER = {
  email: "jared@maximusdigital.co",
  password: "LegalBrain2026!",
  name: "Jared Goeller",
};

async function seed() {
  console.log("Seeding Jared's admin account...\n");

  const baseUrl = process.env.NEON_AUTH_BASE_URL!;

  // 1. Create auth user via Neon Auth (Better Auth) HTTP API
  let userId: string;

  try {
    const res = await fetch(`${baseUrl}/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
      },
      body: JSON.stringify({
        email: DEMO_USER.email,
        password: DEMO_USER.password,
        name: DEMO_USER.name,
        callbackURL: "http://localhost:3000/assistant",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Check if user already exists
      if (
        data?.message?.includes("already") ||
        data?.code === "USER_ALREADY_EXISTS" ||
        res.status === 422 ||
        res.status === 409
      ) {
        console.log("  User already exists — skipping auth creation.");
        console.log("  If you need to re-seed, delete from neon_auth.user table.\n");
        console.log(`  Email:    ${DEMO_USER.email}`);
        console.log(`  Password: ${DEMO_USER.password}`);
        process.exit(0);
      }
      console.error("Auth API error:", res.status, data);
      process.exit(1);
    }

    userId = data.user?.id ?? data.id;
    if (!userId) {
      console.error("No user ID in response:", data);
      process.exit(1);
    }

    console.log(`✓ Auth user created: ${userId}`);
  } catch (err) {
    console.error("Failed to reach Neon Auth:", err);
    process.exit(1);
  }

  // 2. Create user_profiles row
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  try {
    await db
      .insert(userProfiles)
      .values({
        userId,
        displayName: DEMO_USER.name,
        organisation: "Maximus Digital",
        tier: "Free",
      })
      .onConflictDoNothing({ target: userProfiles.userId });

    console.log(`✓ user_profiles row created`);
  } catch (err) {
    console.error("DB error:", err);
    process.exit(1);
  }

  console.log("\n=== Seed complete ===");
  console.log(`  Email:    ${DEMO_USER.email}`);
  console.log(`  Password: ${DEMO_USER.password}`);
  console.log(`\n  Raul can create his own account at /auth/sign-up`);
}

seed();
