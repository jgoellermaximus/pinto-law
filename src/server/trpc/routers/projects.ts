import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  projects,
  documents,
  chats,
  tabularReviews,
  clients,
} from "@/lib/db/schema/legal";

const matterTypeEnum = z.enum([
  "real_estate",
  "criminal",
  "business",
  "municipal",
  "landlord_tenant",
  "estate_planning",
]);

const stageEnum = z.enum([
  "prospecting",
  "intake",
  "active",
  "under_review",
  "pending_client",
  "complete",
  "archived",
]);

export const projectsRouter = router({
  /** List all projects — admin sees all org projects, others see only their own */
  list: protectedProcedure
    .input(
      z
        .object({
          matterType: matterTypeEnum.optional(),
          stage: stageEnum.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.userRole === "admin";

      const conditions = [
        eq(projects.organizationId, ctx.organizationId),
      ];

      // Non-admin users only see their own projects
      if (!isAdmin) {
        conditions.push(eq(projects.userId, ctx.userId));
      }

      if (input?.matterType) {
        conditions.push(eq(projects.matterType, input.matterType));
      }
      if (input?.stage) {
        conditions.push(eq(projects.stage, input.stage));
      }

      // Single query with subqueries for counts — replaces N+1 Promise.all
      const rows = await db
        .select({
          project: projects,
          clientName: clients.name,
          clientType: clients.type,
          document_count: sql<number>`(
            SELECT count(*)::int FROM documents
            WHERE documents.project_id = projects.id
          )`,
          chat_count: sql<number>`(
            SELECT count(*)::int FROM chats
            WHERE chats.project_id = projects.id
          )`,
          review_count: sql<number>`(
            SELECT count(*)::int FROM tabular_reviews
            WHERE tabular_reviews.project_id = projects.id
          )`,
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt));

      return rows.map((row) => ({
        ...row.project,
        clientName: row.clientName,
        clientType: row.clientType,
        is_owner: row.project.userId === ctx.userId,
        document_count: row.document_count ?? 0,
        chat_count: row.chat_count ?? 0,
        review_count: row.review_count ?? 0,
      }));
    }),

  /** Get single project by ID */
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({
          project: projects,
          clientName: clients.name,
          clientType: clients.type,
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!row) return null;
      return {
        ...row.project,
        clientName: row.clientName,
        clientType: row.clientType,
      };
    }),

  /** Create a new project (matter) */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        clientId: z.string().uuid().optional(),
        matterType: matterTypeEnum.optional(),
        stage: stageEnum.optional(),
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
          clientId: input.clientId ?? null,
          matterType: input.matterType ?? null,
          stage: input.stage ?? "intake",
          cmNumber: input.cmNumber ?? null,
        })
        .returning();

      return project;
    }),

  /** Update a project */
  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).optional(),
        clientId: z.string().uuid().nullable().optional(),
        matterType: matterTypeEnum.nullable().optional(),
        stage: stageEnum.optional(),
        cmNumber: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...fields } = input;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) updates.name = fields.name.trim();
      if (fields.clientId !== undefined) updates.clientId = fields.clientId;
      if (fields.matterType !== undefined)
        updates.matterType = fields.matterType;
      if (fields.stage !== undefined) updates.stage = fields.stage;
      if (fields.cmNumber !== undefined) updates.cmNumber = fields.cmNumber;

      // Admin can update any project in org, others only their own
      const conditions = [
        eq(projects.id, projectId),
        eq(projects.organizationId, ctx.organizationId),
      ];

      if (ctx.userRole !== "admin") {
        conditions.push(eq(projects.userId, ctx.userId));
      }

      await db
        .update(projects)
        .set(updates)
        .where(and(...conditions));

      return { ok: true };
    }),

  /** Rename a project (kept for backward compat) */
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
      const conditions = [
        eq(projects.id, input.projectId),
        eq(projects.organizationId, ctx.organizationId),
      ];

      if (ctx.userRole !== "admin") {
        conditions.push(eq(projects.userId, ctx.userId));
      }

      await db
        .delete(projects)
        .where(and(...conditions));

      return { ok: true };
    }),
});
