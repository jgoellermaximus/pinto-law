import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema/legal";

export const userRouter = router({
  /**
   * Ensure user_profiles row exists for current user.
   * Called on first login — creates row if missing.
   */
  ensureProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.userId))
      .limit(1);

    if (existing.length > 0) return { ok: true, profile: existing[0] };

    const [profile] = await db
      .insert(userProfiles)
      .values({
        userId: ctx.userId,
        displayName: ctx.userName,
      })
      .onConflictDoNothing({ target: userProfiles.userId })
      .returning();

    return { ok: true, profile: profile ?? existing[0] };
  }),

  /** Get current user's profile */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.userId))
      .limit(1);

    return profile ?? null;
  }),

  /** Update display name */
  updateDisplayName: protectedProcedure
    .input(z.object({ displayName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(userProfiles)
        .set({ displayName: input.displayName, updatedAt: new Date() })
        .where(eq(userProfiles.userId, ctx.userId));
      return { ok: true };
    }),

  /** Update API key */
  updateApiKey: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["claude", "gemini", "openrouter"]),
        value: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fieldMap = {
        claude: "claudeApiKey" as const,
        gemini: "geminiApiKey" as const,
        openrouter: "openrouterApiKey" as const,
      };
      const field = fieldMap[input.provider];
      await db
        .update(userProfiles)
        .set({ [field]: input.value?.trim() || null, updatedAt: new Date() })
        .where(eq(userProfiles.userId, ctx.userId));
      return { ok: true };
    }),
});
