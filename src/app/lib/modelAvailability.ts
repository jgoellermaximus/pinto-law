import { MODELS, type ModelOption } from "../components/assistant/ModelToggle";

export type ModelProvider = "claude" | "gemini" | "openrouter";

export function getModelProvider(modelId: string): ModelProvider | null {
    // All models with "/" are routed via OpenRouter
    if (modelId.includes("/")) return "openrouter";
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return null;
    return model.group === "Anthropic" ? "claude" : "gemini";
}

export function isModelAvailable(
    modelId: string,
    apiKeys: {
        claudeApiKey: string | null;
        geminiApiKey: string | null;
        openrouterApiKey?: string | null;
    },
): boolean {
    const provider = getModelProvider(modelId);
    if (!provider) return false;
    // OpenRouter models are always available — key is in env var server-side
    if (provider === "openrouter") return true;
    return provider === "claude"
        ? !!apiKeys.claudeApiKey?.trim()
        : !!apiKeys.geminiApiKey?.trim();
}

export function isProviderAvailable(
    provider: ModelProvider,
    apiKeys: {
        claudeApiKey: string | null;
        geminiApiKey: string | null;
        openrouterApiKey?: string | null;
    },
): boolean {
    if (provider === "openrouter") return true;
    return provider === "claude"
        ? !!apiKeys.claudeApiKey?.trim()
        : !!apiKeys.geminiApiKey?.trim();
}

export function providerLabel(provider: ModelProvider): string {
    if (provider === "openrouter") return "OpenRouter";
    return provider === "claude" ? "Anthropic (Claude)" : "Google (Gemini)";
}

export function modelGroupToProvider(
    group: ModelOption["group"],
): ModelProvider {
    return "openrouter";
}