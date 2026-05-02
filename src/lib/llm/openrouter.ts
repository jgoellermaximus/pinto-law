/**
 * OpenRouter LLM provider — uses OpenAI-compatible API.
 * Messages are already in OpenAI format so minimal translation needed.
 */

import OpenAI from "openai";
import type {
  StreamChatParams,
  StreamChatResult,
  NormalizedToolCall,
} from "./types";

const MAX_TOKENS = 16384;

function client(override?: string | null): OpenAI {
  const apiKey =
    override?.trim() || process.env.OPENROUTER_API_KEY || "";
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Pinto Law Group - Legal Brain",
    },
  });
}

export async function streamOpenRouter(
  params: StreamChatParams,
): Promise<StreamChatResult> {
  const {
    model,
    systemPrompt,
    tools = [],
    callbacks = {},
    runTools,
    apiKeys,
  } = params;
  const maxIter = params.maxIterations ?? 10;
  const openai = client(apiKeys?.openrouter);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...params.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Convert tool schemas to OpenAI format
  const openaiTools: OpenAI.Chat.ChatCompletionTool[] | undefined =
    tools.length > 0
      ? tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }))
      : undefined;

  let fullText = "";

  for (let iter = 0; iter < maxIter; iter++) {
    const stream = await openai.chat.completions.create({
      model,
      messages,
      tools: openaiTools,
      max_tokens: MAX_TOKENS,
      stream: true,
    });

    let iterText = "";
    const toolCalls: Map<
      number,
      { id: string; name: string; args: string }
    > = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Content streaming
      if (delta.content) {
        iterText += delta.content;
        callbacks.onContentDelta?.(delta.content);
      }

      // Tool call accumulation
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCalls.get(tc.index);
          if (existing) {
            existing.args += tc.function?.arguments ?? "";
          } else {
            toolCalls.set(tc.index, {
              id: tc.id ?? `call_${tc.index}`,
              name: tc.function?.name ?? "",
              args: tc.function?.arguments ?? "",
            });
          }
        }
      }
    }

    fullText += iterText;

    // If no tool calls, we're done
    if (toolCalls.size === 0) break;

    // Process tool calls
    const normalized: NormalizedToolCall[] = Array.from(
      toolCalls.values(),
    ).map((tc) => {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.args);
      } catch {
        input = {};
      }
      callbacks.onToolCallStart?.({
        id: tc.id,
        name: tc.name,
        input,
      });
      return { id: tc.id, name: tc.name, input };
    });

    if (!runTools) break;

    // Add assistant message with tool calls
    messages.push({
      role: "assistant",
      content: iterText || null,
      tool_calls: Array.from(toolCalls.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      })),
    });

    // Run tools and add results
    const results = await runTools(normalized);
    for (const r of results) {
      messages.push({
        role: "tool",
        tool_call_id: r.tool_use_id,
        content: r.content,
      });
    }
  }

  return { fullText };
}

export async function completeOpenRouterText(params: {
  model: string;
  systemPrompt?: string;
  user: string;
  maxTokens?: number;
  apiKeys?: { openrouter?: string | null };
}): Promise<string> {
  const openai = client(params.apiKeys?.openrouter);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (params.systemPrompt) {
    messages.push({ role: "system", content: params.systemPrompt });
  }
  messages.push({ role: "user", content: params.user });

  const response = await openai.chat.completions.create({
    model: params.model,
    messages,
    max_tokens: params.maxTokens ?? 4096,
  });

  return response.choices[0]?.message?.content ?? "";
}
