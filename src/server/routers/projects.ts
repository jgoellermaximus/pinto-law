import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  projects,
  documents,
  chats,
  tabularReviews,
} from "@/lib/db/schema/legal";

export const projectsRouter = router({
  /** List all projects for current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, ctx.userId),
          eq(projects.organizationId, ctx.organizationId),
        ),
      )
      .orderBy(desc(projects.createdAt));

    // Attach counts
    const result = await Promise.all(
      rows.map(async (p) => {
        const [docCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(documents)
          .where(eq(documents.projectId, p.id));

        const [chatCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(chats)
          .where(eq(chats.projectId, p.id));

        const [reviewCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(tabularReviews)
          .where(eq(tabularReviews.projectId, p.id));

        return {
          ...p,
          is_owner: true,
          document_count: Number(docCount?.count ?? 0),
          chat_count: Number(chatCount?.count ?? 0),
          review_count: Number(reviewCount?.count ?? 0),
        };
      }),
    );

    return result;
  }),

  /** Get single project by ID */
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!project) return null;
      return project;
    }),

  /** Create a new project (matter) */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        cmNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await db
        .insert(projects)
        .values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          name: input.name.trim(),
          cmNumber: input.cmNumber ?? null,
        })
        .returning();

      return project;
    }),

  /** Rename a project */
  rename: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(projects)
        .set({ name: input.name.trim(), updatedAt: new Date() })
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.userId),
            eq(projects.organizationId, ctx.organizationId),
          ),
        );
      return { ok: true };
    }),

  /** Delete a project */
  delete: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.userId),
            eq(projects.organizationId, ctx.organizationId),
          ),
        );
      return { ok: true };
    }),
});
