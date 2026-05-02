import type { Provider } from "./types";

// ---------------------------------------------------------------------------
// Canonical model IDs
// ---------------------------------------------------------------------------

// Claude models
export const CLAUDE_MAIN_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
] as const;
export const CLAUDE_MID_MODELS = ["claude-sonnet-4-6"] as const;
export const CLAUDE_LOW_MODELS = ["claude-haiku-4-5"] as const;

// Gemini models
export const GEMINI_MAIN_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
] as const;
export const GEMINI_MID_MODELS = ["gemini-3-flash-preview"] as const;
export const GEMINI_LOW_MODELS = ["gemini-3.1-flash-lite-preview"] as const;

// OpenRouter models — route to any model via OpenRouter prefix
export const OPENROUTER_MAIN_MODELS = [
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5",
  "google/gemini-2.5-flash-preview",
  "qwen/qwen3-235b-a22b",
  "mistralai/mistral-small-3.2-24b-instruct",
] as const;
export const OPENROUTER_MID_MODELS = [
  "anthropic/claude-haiku-4-5",
  "google/gemini-2.5-flash-preview",
] as const;
export const OPENROUTER_LOW_MODELS = [
  "google/gemini-2.5-flash-preview",
] as const;

// Defaults — OpenRouter for the demo, switch to local Ollama in production
export const DEFAULT_MAIN_MODEL = "anthropic/claude-sonnet-4-6";
export const DEFAULT_TITLE_MODEL = "google/gemini-2.5-flash-preview";
export const DEFAULT_TABULAR_MODEL = "google/gemini-2.5-flash-preview";

const ALL_MODELS = new Set<string>([
  ...CLAUDE_MAIN_MODELS,
  ...GEMINI_MAIN_MODELS,
  ...CLAUDE_MID_MODELS,
  ...GEMINI_MID_MODELS,
  ...CLAUDE_LOW_MODELS,
  ...GEMINI_LOW_MODELS,
  ...OPENROUTER_MAIN_MODELS,
  ...OPENROUTER_MID_MODELS,
  ...OPENROUTER_LOW_MODELS,
]);

// ---------------------------------------------------------------------------
// Provider inference
// ---------------------------------------------------------------------------

export function providerForModel(model: string): Provider {
  // OpenRouter models use "org/model" format
  if (model.includes("/")) return "openrouter";
  if (model.startsWith("claude")) return "claude";
  if (model.startsWith("gemini")) return "gemini";
  // Default to openrouter for unknown models in demo
  return "openrouter";
}

export function resolveModel(
  id: string | null | undefined,
  fallback: string,
): string {
  if (id && ALL_MODELS.has(id)) return id;
  return fallback;
}
