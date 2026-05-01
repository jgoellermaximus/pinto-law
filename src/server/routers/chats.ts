import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { chats, chatMessages } from "@/lib/db/schema/legal";

export const chatsRouter = router({
  /** List chats — optionally filtered by project */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(chats.userId, ctx.userId),
        eq(chats.organizationId, ctx.organizationId),
      ];

      if (input.projectId) {
        conditions.push(eq(chats.projectId, input.projectId));
      }

      return db
        .select()
        .from(chats)
        .where(and(...conditions))
        .orderBy(desc(chats.createdAt));
    }),

  /** Create a new chat */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        projectId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [chat] = await db
        .insert(chats)
        .values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          title: input.title ?? null,
          projectId: input.projectId ?? null,
        })
        .returning();
      return chat;
    }),

  /** Get chat with messages */
  getWithMessages: protectedProcedure
    .input(z.object({ chatId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [chat] = await db
        .select()
        .from(chats)
        .where(
          and(
            eq(chats.id, input.chatId),
            eq(chats.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!chat) return null;

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, input.chatId))
        .orderBy(chatMessages.createdAt);

      return { chat, messages };
    }),

  /** Save a message */
  addMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        role: z.enum(["user", "assistant"]),
        content: z.any(),
        files: z.any().optional(),
        annotations: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await db
        .insert(chatMessages)
        .values({
          organizationId: ctx.organizationId,
          chatId: input.chatId,
          role: input.role,
          content: input.content,
          files: input.files ?? null,
          annotations: input.annotations ?? null,
        })
        .returning();
      return message;
    }),

  /** Rename a chat */
  rename: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(chats)
        .set({ title: input.title })
        .where(
          and(
            eq(chats.id, input.chatId),
            eq(chats.userId, ctx.userId),
          ),
        );
      return { ok: true };
    }),

  /** Delete a chat */
  delete: protectedProcedure
    .input(z.object({ chatId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(chats)
        .where(
          and(
            eq(chats.id, input.chatId),
            eq(chats.userId, ctx.userId),
          ),
        );
      return { ok: true };
    }),
});
