import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/legal";

export const workflowsRouter = router({
  // ── List all workflows visible to this user/org ──
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(workflows)
      .where(
        sql`(
          ${workflows.organizationId} = ${ctx.organizationId}
          OR ${workflows.organizationId} IS NULL
          OR ${workflows.isSystem} = true
        )`,
      )
      .orderBy(workflows.title);

    return rows;
  }),

  // ── Get single workflow ──
  get: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.workflowId))
        .limit(1);

      if (!row) throw new Error("Workflow not found");
      return row;
    }),

  // ── Get default workflow for an intake type ──
  getDefaultForIntakeType: protectedProcedure
    .input(z.object({ intakeType: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.intakeType, input.intakeType),
            eq(workflows.isDefault, true),
            sql`(
              ${workflows.organizationId} = ${ctx.organizationId}
              OR ${workflows.organizationId} IS NULL
              OR ${workflows.isSystem} = true
            )`,
          ),
        )
        .limit(1);

      return row ?? null;
    }),

  // ── Create workflow ──
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        type: z.string().min(1),
        templateType: z.enum(["prompt", "document"]).optional(),
        promptMd: z.string().nullable().optional(),
        practice: z.string().nullable().optional(),
        intakeType: z.string().nullable().optional(),
        isDefault: z.boolean().optional(),
        columnsConfig: z.any().optional(),
        // Document template fields
        templateStoragePath: z.string().nullable().optional(),
        templateFileName: z.string().nullable().optional(),
        templateFields: z.any().optional(), // MergeField[]
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If setting as default, unset any existing default for this intake type
      if (input.isDefault && input.intakeType) {
        await db
          .update(workflows)
          .set({ isDefault: false })
          .where(
            and(
              eq(workflows.intakeType, input.intakeType),
              eq(workflows.isDefault, true),
              sql`(
                ${workflows.organizationId} = ${ctx.organizationId}
                OR ${workflows.organizationId} IS NULL
              )`,
            ),
          );
      }

      const [row] = await db
        .insert(workflows)
        .values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          title: input.title,
          type: input.type,
          templateType: input.templateType ?? "prompt",
          promptMd: input.promptMd ?? null,
          practice: input.practice ?? null,
          intakeType: input.intakeType ?? null,
          isDefault: input.isDefault ?? false,
          columnsConfig: input.columnsConfig ?? null,
          templateStoragePath: input.templateStoragePath ?? null,
          templateFileName: input.templateFileName ?? null,
          templateFields: input.templateFields ?? null,
          isSystem: false,
        })
        .returning();

      return row;
    }),

  // ── Update workflow (partial) ──
  update: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        title: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
        templateType: z.enum(["prompt", "document"]).optional(),
        promptMd: z.string().nullable().optional(),
        practice: z.string().nullable().optional(),
        intakeType: z.string().nullable().optional(),
        isDefault: z.boolean().optional(),
        columnsConfig: z.any().optional(),
        templateStoragePath: z.string().nullable().optional(),
        templateFileName: z.string().nullable().optional(),
        templateFields: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workflowId, ...updates } = input;

      // If setting as default, unset any existing default for this intake type
      if (updates.isDefault === true) {
        let targetIntakeType = updates.intakeType;
        if (targetIntakeType === undefined) {
          const [existing] = await db
            .select({ intakeType: workflows.intakeType })
            .from(workflows)
            .where(eq(workflows.id, workflowId))
            .limit(1);
          targetIntakeType = existing?.intakeType ?? null;
        }

        if (targetIntakeType) {
          await db
            .update(workflows)
            .set({ isDefault: false })
            .where(
              and(
                eq(workflows.intakeType, targetIntakeType),
                eq(workflows.isDefault, true),
                sql`${workflows.id} != ${workflowId}`,
                sql`(
                  ${workflows.organizationId} = ${ctx.organizationId}
                  OR ${workflows.organizationId} IS NULL
                )`,
              ),
            );
        }
      }

      // Build set object — only include fields that were provided
      const setObj: Record<string, unknown> = {};
      if (updates.title !== undefined) setObj.title = updates.title;
      if (updates.type !== undefined) setObj.type = updates.type;
      if (updates.templateType !== undefined) setObj.templateType = updates.templateType;
      if (updates.promptMd !== undefined) setObj.promptMd = updates.promptMd;
      if (updates.practice !== undefined) setObj.practice = updates.practice;
      if (updates.intakeType !== undefined) setObj.intakeType = updates.intakeType;
      if (updates.isDefault !== undefined) setObj.isDefault = updates.isDefault;
      if (updates.columnsConfig !== undefined) setObj.columnsConfig = updates.columnsConfig;
      if (updates.templateStoragePath !== undefined) setObj.templateStoragePath = updates.templateStoragePath;
      if (updates.templateFileName !== undefined) setObj.templateFileName = updates.templateFileName;
      if (updates.templateFields !== undefined) setObj.templateFields = updates.templateFields;

      if (Object.keys(setObj).length === 0) {
        throw new Error("No fields to update");
      }

      const [row] = await db
        .update(workflows)
        .set(setObj)
        .where(eq(workflows.id, workflowId))
        .returning();

      return row;
    }),

  // ── Delete workflow ──
  delete: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select({ isSystem: workflows.isSystem })
        .from(workflows)
        .where(eq(workflows.id, input.workflowId))
        .limit(1);

      if (existing?.isSystem) {
        throw new Error("Cannot delete system workflows");
      }

      await db
        .delete(workflows)
        .where(eq(workflows.id, input.workflowId));

      return { success: true };
    }),
});
