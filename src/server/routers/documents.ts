import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  documents,
  documentVersions,
  documentEdits,
} from "@/lib/db/schema/legal";

export const documentsRouter = router({
  /** List standalone documents (not in a project) */
  listStandalone: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, ctx.userId),
          eq(documents.organizationId, ctx.organizationId),
          isNull(documents.projectId),
        ),
      )
      .orderBy(desc(documents.createdAt));
  }),

  /** List documents in a project */
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.projectId, input.projectId),
            eq(documents.organizationId, ctx.organizationId),
          ),
        )
        .orderBy(desc(documents.createdAt));
    }),

  /** Get single document with versions */
  get: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, input.documentId),
            eq(documents.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!doc) return null;

      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.documentId))
        .orderBy(desc(documentVersions.createdAt));

      return { ...doc, versions };
    }),

  /** Get edits for a document */
  getEdits: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(documentEdits)
        .where(
          and(
            eq(documentEdits.documentId, input.documentId),
            eq(documentEdits.organizationId, ctx.organizationId),
          ),
        )
        .orderBy(desc(documentEdits.createdAt));
    }),

  /** Resolve (accept/reject) an edit */
  resolveEdit: protectedProcedure
    .input(
      z.object({
        editId: z.string().uuid(),
        status: z.enum(["accepted", "rejected"]),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(documentEdits)
        .set({ status: input.status, resolvedAt: new Date() })
        .where(eq(documentEdits.id, input.editId));
      return { ok: true };
    }),

  /** Delete a document */
  delete: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.id, input.documentId),
            eq(documents.userId, ctx.userId),
            eq(documents.organizationId, ctx.organizationId),
          ),
        );
      return { ok: true };
    }),
});
