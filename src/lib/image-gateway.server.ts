export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai" | "gemini-chat" | "generate-content" | "cloudflare-input";
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "xhigh" | "max" | "auto";
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
  size: "1024x1024",
  quality: "low",
};

export function generateImage(config: ImageConfig, prompt: string, stream = true, signal?: AbortSignal) {
  let input: Record<string, unknown>;
  switch (config.format) {
    case "openai":
      input = {
        prompt,
        ...(config.size ? { size: config.size } : {}),
        ...(config.quality ? { quality: config.quality } : {}),
        ...(stream ? { partial_images: 1 } : {}),
      };
      break;
    case "cloudflare-input":
      input = { input: { prompt } };
      break;
    case "generate-content":
      input = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      };
      break;
    default:
      input = {
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      };
  }
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: config.model, ...input, ...(stream ? { stream: true } : {}) }),
    signal: signal ?? null,
  });
}
