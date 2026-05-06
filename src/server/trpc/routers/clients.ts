import { z } from "zod";
import { eq, and, desc, ilike } from "drizzle-orm";
import { router, protectedProcedure } from "../../trpc";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/legal";

export const clientsRouter = router({
  /** List all clients for current org */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, ctx.organizationId))
      .orderBy(desc(clients.createdAt));

    return rows;
  }),

  /** Search clients by name (for dropdowns / autocomplete) */
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, ctx.organizationId),
            ilike(clients.name, `%${input.query}%`),
          ),
        )
        .orderBy(clients.name)
        .limit(10);

      return rows;
    }),

  /** Get single client by ID */
  get: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [client] = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!client) return null;
      return client;
    }),

  /** Create a new client */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["individual", "business", "brokerage"]),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [client] = await db
        .insert(clients)
        .values({
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          type: input.type,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        })
        .returning();

      return client;
    }),

  /** Update a client */
  update: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        name: z.string().min(1).optional(),
        type: z.enum(["individual", "business", "brokerage"]).optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId, ...fields } = input;

      // Only include fields that were explicitly passed
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) updates.name = fields.name.trim();
      if (fields.type !== undefined) updates.type = fields.type;
      if (fields.email !== undefined) updates.email = fields.email;
      if (fields.phone !== undefined) updates.phone = fields.phone;
      if (fields.address !== undefined) updates.address = fields.address;
      if (fields.notes !== undefined) updates.notes = fields.notes;

      await db
        .update(clients)
        .set(updates)
        .where(
          and(
            eq(clients.id, clientId),
            eq(clients.organizationId, ctx.organizationId),
          ),
        );

      return { ok: true };
    }),

  /** Delete a client */
  delete: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.organizationId, ctx.organizationId),
          ),
        );

      return { ok: true };
    }),
});
