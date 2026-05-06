import { z } from "zod";
import { eq, and, desc, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { activityLog } from "@/lib/db/schema/legal";

export const activityLogRouter = router({
  /**
   * List activity for a specific entity (e.g., a project or deal_intake).
   * Used in the deal detail modal timeline.
   */
  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, ctx.organizationId),
            eq(activityLog.entityType, input.entityType),
            eq(activityLog.entityId, input.entityId),
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * List activity across multiple entity IDs.
   * Useful for showing combined timeline for a project + its linked deal_intake.
   */
  listByEntities: protectedProcedure
    .input(
      z.object({
        entities: z.array(
          z.object({
            entityType: z.string(),
            entityId: z.string(),
          }),
        ),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.entities.length === 0) return [];

      const conditions = input.entities.map((e) =>
        and(
          eq(activityLog.entityType, e.entityType),
          eq(activityLog.entityId, e.entityId),
        ),
      );

      const rows = await db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, ctx.organizationId),
            or(...conditions),
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * Recent activity across the entire org — for a future dashboard/feed.
   */
  recent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(20),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.organizationId, ctx.organizationId))
        .orderBy(desc(activityLog.createdAt))
        .limit(input?.limit ?? 20);

      return rows;
    }),
});
