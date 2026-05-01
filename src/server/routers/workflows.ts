import { z } from "zod";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { workflows, hiddenWorkflows } from "@/lib/db/schema/legal";

export const workflowsRouter = router({
  /** List workflows — user's own + system/builtin */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["chat", "tabular"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Get user's hidden workflow IDs
      const hidden = await db
        .select({ workflowId: hiddenWorkflows.workflowId })
        .from(hiddenWorkflows)
        .where(eq(hiddenWorkflows.userId, ctx.userId));
      const hiddenIds = new Set(hidden.map((h) => h.workflowId));

      // Get own workflows + system workflows
      const conditions = [
        or(
          eq(workflows.userId, ctx.userId),
          eq(workflows.isSystem, true),
        ),
      ];

      if (input?.type) {
        conditions.push(eq(workflows.type, input.type));
      }

      const rows = await db
        .select()
        .from(workflows)
        .where(and(...conditions))
        .orderBy(desc(workflows.createdAt));

      return rows
        .filter((w) => !hiddenIds.has(w.id))
        .map((w) => ({
          ...w,
          is_owner: w.userId === ctx.userId,
          allow_edit: w.userId === ctx.userId,
        }));
    }),

  /** Get single workflow */
  get: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.workflowId))
        .limit(1);

      if (!workflow) return null;
      return {
        ...workflow,
        is_owner: workflow.userId === ctx.userId,
        allow_edit: workflow.userId === ctx.userId,
      };
    }),

  /** Create a workflow */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        type: z.enum(["chat", "tabular"]),
        promptMd: z.string().optional(),
        columnsConfig: z.any().optional(),
        practice: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [workflow] = await db
        .insert(workflows)
        .values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          title: input.title.trim(),
          type: input.type,
          promptMd: input.promptMd ?? null,
          columnsConfig: input.columnsConfig ?? null,
          practice: input.practice ?? null,
        })
        .returning();
      return workflow;
    }),

  /** Update a workflow */
  update: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        title: z.string().optional(),
        promptMd: z.string().optional(),
        columnsConfig: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title.trim();
      if (input.promptMd !== undefined) updates.promptMd = input.promptMd;
      if (input.columnsConfig !== undefined)
        updates.columnsConfig = input.columnsConfig;

      await db
        .update(workflows)
        .set(updates)
        .where(
          and(
            eq(workflows.id, input.workflowId),
            eq(workflows.userId, ctx.userId),
          ),
        );
      return { ok: true };
    }),

  /** Delete a workflow */
  delete: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workflows)
        .where(
          and(
            eq(workflows.id, input.workflowId),
            eq(workflows.userId, ctx.userId),
          ),
        );
      return { ok: true };
    }),
});
