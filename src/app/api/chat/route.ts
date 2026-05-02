/**
 * Streaming AI chat endpoint.
 *
 * POST /api/chat
 *
 * For the demo, this is a simplified version that handles basic AI
 * conversation without document tools. The full chatTools.ts integration
 * (document read/edit/generate) comes after migrating chatTools to Drizzle.
 *
 * Flow:
 *   1. Verify auth via Neon Auth
 *   2. Create or resolve chat in DB (Drizzle)
 *   3. Save user message
 *   4. Stream LLM response via SSE
 *   5. Save assistant message
 */

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { chats, chatMessages, userProfiles } from "@/lib/db/schema/legal";
import { eq, and } from "drizzle-orm";
import {
  streamChatWithTools,
  DEFAULT_MAIN_MODEL,
  resolveModel,
} from "@/lib/llm";
import type { LlmMessage, UserApiKeys } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// System prompt — NJ legal practice context
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Legal Brain, a private AI assistant for Pinto Law Group, a solo law practice in Elizabeth, New Jersey. You assist attorney Raul Pinto with legal research, document drafting, contract review, and practice management.

Your practice areas include:
- Real estate law (residential purchase agreements, attorney review letters, title issues)
- Criminal defense (municipal court, superior court, expungements)
- Business law (entity formation, operating agreements, commercial contracts)
- Municipal/traffic court
- Landlord/tenant disputes
- Estate planning (wills, powers of attorney, healthcare directives)

Key guidelines:
- Always cite New Jersey statutes (N.J.S.A.) and court rules (R.) when relevant
- Reference NJ-specific case law when applicable
- Draft documents in the style of a New Jersey practitioner
- Be aware of NJ-specific procedures (e.g., attorney review period under NJ custom, not statute)
- When reviewing contracts, flag NJ-specific issues (e.g., NJ Consumer Fraud Act implications)
- For criminal matters, reference NJ Criminal Code (Title 2C) specifically
- Always note that your answers are not legal advice and should be verified

You run entirely on private hardware — no client data leaves this system. This is not a cloud AI service. Attorney-client privilege is preserved by architecture.

When drafting documents, match the professional tone of a small-firm NJ attorney. Be thorough but concise. Flag issues proactively.`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Auth check
  const session = await auth.getSession();
  const userId = session?.data?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const orgId = "pinto-law-group";

  // 2. Parse request body
  const body = await req.json();
  const {
    messages,
    chat_id,
    project_id,
    model: requestedModel,
  } = body as {
    messages: { role: string; content: string; files?: unknown[] }[];
    chat_id?: string;
    project_id?: string;
    model?: string;
  };

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
    });
  }

  // 3. Resolve model + API keys
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const apiKeys: UserApiKeys = {
    claude: profile?.claudeApiKey ?? null,
    gemini: profile?.geminiApiKey ?? null,
    openrouter: profile?.openrouterApiKey ?? process.env.OPENROUTER_API_KEY ?? null,
  };

  const model = resolveModel(requestedModel, DEFAULT_MAIN_MODEL);

  // 4. Create or resolve chat
  let chatId = chat_id ?? null;

  if (chatId) {
    const [existing] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.organizationId, orgId)))
      .limit(1);
    if (!existing) chatId = null;
  }

  if (!chatId) {
    const [newChat] = await db
      .insert(chats)
      .values({
        organizationId: orgId,
        userId,
        projectId: project_id ?? null,
      })
      .returning();
    chatId = newChat.id;
  }

  // 5. Save user message
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await db.insert(chatMessages).values({
      organizationId: orgId,
      chatId,
      role: "user",
      content: lastUser.content,
      files: lastUser.files ?? null,
    });
  }

  // 6. Build LLM messages
  const llmMessages: LlmMessage[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    }));

  // 7. Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Send chat_id so frontend can track it
        write(JSON.stringify({ type: "chat_id", chatId }));

        let fullText = "";

        await streamChatWithTools({
          model,
          systemPrompt: SYSTEM_PROMPT,
          messages: llmMessages,
          apiKeys,
          enableThinking: false,
          callbacks: {
            onContentDelta: (delta) => {
              fullText += delta;
              write(JSON.stringify({ type: "content_delta", text: delta }));
            },
            onReasoningDelta: (text) => {
              write(
                JSON.stringify({ type: "reasoning_delta", text }),
              );
            },
          },
        });

        // Save assistant message
        await db.insert(chatMessages).values({
          organizationId: orgId,
          chatId,
          role: "assistant",
          content: fullText,
        });

        // Auto-title if chat has no title yet
        const [chat] = await db
          .select()
          .from(chats)
          .where(eq(chats.id, chatId))
          .limit(1);

        if (!chat?.title && lastUser?.content) {
          await db
            .update(chats)
            .set({ title: lastUser.content.slice(0, 120) })
            .where(eq(chats.id, chatId));
        }

        write("[DONE]");
      } catch (err) {
        console.error("[chat/stream] error:", err);
        write(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : "Stream error",
          }),
        );
        write("[DONE]");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
