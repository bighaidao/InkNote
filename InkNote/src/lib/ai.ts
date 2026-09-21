import { Channel, invoke } from "@tauri-apps/api/core";
import { getStoredValue, setStoredValue } from "./settingsStore";
import { t, type Locale } from "./i18n";

export type AiProtocol = "openai" | "anthropic" | "gemini";

export interface AiProviderPreset {
  id: string;
  name: string;
  protocol: AiProtocol;
  baseUrl: string;
  models: string[];
  requiresKey: boolean;
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  { id: "deepseek", name: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"], requiresKey: true },
  { id: "zhipu", name: "智谱 GLM", protocol: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-5", "glm-4.5", "glm-4.5-air", "glm-4-flash"], requiresKey: true },
  { id: "qwen", name: "通义千问 / 阿里云百炼", protocol: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen3.8-max", "qwen-plus", "qwen-flash", "qwen-long"], requiresKey: true },
  { id: "moonshot", name: "Kimi / Moonshot", protocol: "openai", baseUrl: "https://api.moonshot.cn/v1", models: ["kimi-k2.5", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"], requiresKey: true },
  { id: "doubao", name: "豆包 / 火山方舟", protocol: "openai", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: ["doubao-seed-2-0-lite-260215", "doubao-seed-1-6-251015"], requiresKey: true },
  { id: "siliconflow", name: "硅基流动", protocol: "openai", baseUrl: "https://api.siliconflow.cn/v1", models: ["deepseek-ai/DeepSeek-V3.2", "Pro/deepseek-ai/DeepSeek-R1", "Qwen/Qwen3.6-27B"], requiresKey: true },
  { id: "minimax", name: "MiniMax", protocol: "openai", baseUrl: "https://api.minimax.chat/v1", models: ["MiniMax-Text-01"], requiresKey: true },
  { id: "baichuan", name: "百川智能", protocol: "openai", baseUrl: "https://api.baichuan-ai.com/v1", models: ["Baichuan2-Turbo", "Baichuan2-Turbo-192k"], requiresKey: true },
  { id: "stepfun", name: "阶跃星辰", protocol: "openai", baseUrl: "https://api.stepfun.com/v1", models: ["step-3.7-flash", "step-3.5-flash", "step-2-16k"], requiresKey: true },
  { id: "yi", name: "零一万物 Yi", protocol: "openai", baseUrl: "https://api.lingyiwanwu.com/v1", models: ["yi-lightning", "yi-large"], requiresKey: true },
  { id: "hunyuan", name: "腾讯混元 / TokenHub", protocol: "openai", baseUrl: "https://tokenhub.tencentmaas.com/v1", models: ["hy3-preview", "hunyuan-turbos-latest", "hunyuan-role-latest"], requiresKey: true },
  { id: "qianfan", name: "百度千帆 / 文心", protocol: "openai", baseUrl: "https://qianfan.baidubce.com/v2", models: ["ernie-4.0-turbo-8k", "ernie-3.5-8k", "deepseek-v3"], requiresKey: true },
  { id: "spark", name: "讯飞星火", protocol: "openai", baseUrl: "https://spark-api-open.xf-yun.com/v1", models: ["4.0Ultra", "generalv3.5", "generalv3", "lite"], requiresKey: true },
  { id: "openai", name: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"], requiresKey: true },
  { id: "anthropic", name: "Anthropic Claude", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", models: ["claude-sonnet-4-5", "claude-haiku-4-5"], requiresKey: true },
  { id: "gemini", name: "Google Gemini", protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.5-pro", "gemini-2.5-flash"], requiresKey: true },
  { id: "openrouter", name: "OpenRouter", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", models: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"], requiresKey: true },
  { id: "groq", name: "Groq", protocol: "openai", baseUrl: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"], requiresKey: true },
  { id: "mistral", name: "Mistral AI", protocol: "openai", baseUrl: "https://api.mistral.ai/v1", models: ["mistral-large-latest", "mistral-small-latest"], requiresKey: true },
  { id: "xai", name: "xAI Grok", protocol: "openai", baseUrl: "https://api.x.ai/v1", models: ["grok-4", "grok-3-mini"], requiresKey: true },
  { id: "ollama", name: "Ollama（本地）", protocol: "openai", baseUrl: "http://127.0.0.1:11434/v1", models: ["qwen3", "deepseek-r1", "llama3.2"], requiresKey: false },
  { id: "custom", name: "自定义兼容接口", protocol: "openai", baseUrl: "", models: [], requiresKey: true },
];

export interface AiConfig {
  enabled: boolean;
  provider: string;
  protocol: AiProtocol;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const KEYS = {
  enabled: "mdnote.aiEnabled",
  provider: "mdnote.aiProvider",
  protocol: "mdnote.aiProtocol",
  baseUrl: "mdnote.aiBaseUrl",
  model: "mdnote.aiModel",
  temperature: "mdnote.aiTemperature",
  maxTokens: "mdnote.aiMaxTokens",
  outputLimitVersion: "mdnote.aiOutputLimitVersion",
} as const;

export function providerPreset(id: string): AiProviderPreset {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}

export function getAiConfig(): AiConfig {
  const provider = getStoredValue(KEYS.provider) ?? "deepseek";
  const preset = providerPreset(provider);
  const protocolValue = getStoredValue(KEYS.protocol);
  const temperature = Number(getStoredValue(KEYS.temperature));
  let maxTokens = Number(getStoredValue(KEYS.maxTokens));
  // Older versions saved the 4096 default with every settings change.
  if (maxTokens === 4096 && getStoredValue(KEYS.outputLimitVersion) !== "2") {
    maxTokens = 32768;
    setStoredValue(KEYS.maxTokens, String(maxTokens));
    setStoredValue(KEYS.outputLimitVersion, "2");
  }
  return {
    enabled: getStoredValue(KEYS.enabled) === "on",
    provider,
    protocol: protocolValue === "anthropic" || protocolValue === "gemini" ? protocolValue : preset.protocol,
    baseUrl: getStoredValue(KEYS.baseUrl) ?? preset.baseUrl,
    model: getStoredValue(KEYS.model) ?? preset.models[0] ?? "",
    temperature: temperature >= 0 && temperature <= 2 ? temperature : 0.4,
    maxTokens: maxTokens >= 256 && maxTokens <= 32768 ? maxTokens : 32768,
  };
}

export function saveAiConfig(config: AiConfig) {
  setStoredValue(KEYS.outputLimitVersion, "2");
  setStoredValue(KEYS.enabled, config.enabled ? "on" : "off");
  setStoredValue(KEYS.provider, config.provider);
  setStoredValue(KEYS.protocol, config.protocol);
  setStoredValue(KEYS.baseUrl, config.baseUrl);
  setStoredValue(KEYS.model, config.model);
  setStoredValue(KEYS.temperature, String(config.temperature));
  setStoredValue(KEYS.maxTokens, String(config.maxTokens));
}

export function configForProvider(current: AiConfig, provider: string): AiConfig {
  const preset = providerPreset(provider);
  return {
    ...current,
    provider,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    model: preset.models[0] ?? "",
  };
}

export function setAiApiKey(provider: string, apiKey: string): Promise<void> {
  return invoke("set_ai_api_key", { provider, apiKey });
}

export function hasAiApiKey(provider: string): Promise<boolean> {
  return invoke("has_ai_api_key", { provider });
}

export interface AiGenerateInput {
  config: AiConfig;
  instruction: string;
  content: string;
  signal?: AbortSignal;
  onDelta?: (delta: { text: string; reasoning: string }) => void;
}

export function listAiModels(config: AiConfig, apiKey?: string): Promise<string[]> {
  return invoke("list_ai_models", { request: {
    provider: config.provider, protocol: config.protocol, baseUrl: config.baseUrl,
    requiresKey: providerPreset(config.provider).requiresKey, apiKey: apiKey || null,
  } });
}

export function generateAiText({ config, instruction, content, signal, onDelta }: AiGenerateInput): Promise<string> {
  if (signal?.aborted) return Promise.reject(new Error("ai_cancelled"));
  const preset = providerPreset(config.provider);
  const requestId = crypto.randomUUID();
  const channel = new Channel<{ text: string; reasoning: string }>();
  let active = true;
  channel.onmessage = (delta) => { if (active && !signal?.aborted) onDelta?.(delta); };
  const request = invoke<string>("generate_ai_text", {
    requestId,
    onDelta: channel,
    request: {
      provider: config.provider,
      protocol: config.protocol,
      baseUrl: config.baseUrl,
      model: config.model,
      instruction,
      content,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      requiresKey: preset.requiresKey,
    },
  });
  return new Promise((resolve, reject) => {
    const cancel = (reason: string) => {
      void invoke("cancel_ai_request", { requestId }).catch(() => {});
      cleanup();
      reject(new Error(reason));
    };
    const onAbort = () => cancel("ai_cancelled");
    const timeout = setTimeout(() => cancel("ai_request_timeout"), 605_000);
    const cleanup = () => {
      active = false;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    request.then(resolve, reject).finally(cleanup);
  });
}

export function describeAiError(locale: Locale, reason: unknown): string {
  const value = String(reason);
  if (value.includes("ai_models_unsupported")) return t(locale, "ai.modelsUnsupported");
  if (value.includes("ai_models_empty")) return t(locale, "ai.modelsEmpty");
  if (value.includes("ai_key_missing")) return t(locale, "ai.error.keyMissing");
  if (value.includes("ai_http_401") || value.includes("ai_http_403")) return t(locale, "ai.error.auth");
  if (value.includes("ai_http_429")) return t(locale, "ai.error.rateLimit");
  if (value.includes("ai_request_timeout")) return t(locale, "ai.error.timeout");
  if (value.includes("ai_network_error")) return t(locale, "ai.error.network");
  if (value.includes("ai_endpoint_invalid")) return t(locale, "ai.error.endpoint");
  if (value.includes("ai_model_invalid")) return t(locale, "ai.error.model");
  if (value.includes("ai_response_empty") || value.includes("ai_response_invalid")) return t(locale, "ai.error.response");
  if (value.includes("ai_response_incomplete")) return t(locale, "ai.incomplete");
  return value;
}
