import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { normalizeStyleTags, type StyleTags } from "@/lib/style-tags";
import { createLovableAiGatewayProvider } from "./gateway.server.ts";

const MODEL = "google/gemini-3.1-flash-lite";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

const styleTagsSchema = z.object({
  summary: z.string(),
  styles: z.array(z.string()),
  instruments: z.array(z.string()),
  moods: z.array(z.string()),
  searchPhrase: z.string(),
});

const PROMPT = `Analyze the attached complete short music clip for music discovery.
Describe only audible evidence; do not guess the song title, artist, lyrics or copyright status.
Return JSON with:
- summary: one useful sentence, at most 40 words
- styles: 3 to 6 specific genre, subgenre, era, production or rhythm tags
- instruments: 1 to 8 likely audible instrument or vocal tags; use an empty array if unclear
- moods: 2 to 5 mood or energy tags
- searchPhrase: one concise natural search query combining the most distinctive styles, instruments and moods
Prefer searchable terms such as "dusty boom bap", "analog synth" or "falsetto vocals" over vague praise.
Instrument and style tags are estimates, not confirmed identifications.`;

export async function generateStyleTags(apiKey: string, audioBase64: string): Promise<StyleTags> {
  const provider = createLovableAiGatewayProvider(apiKey, undefined, { baseURL: GATEWAY_URL });
  const result = streamText({
    model: provider.chatModel(MODEL),
    output: Output.object({ schema: styleTagsSchema }),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "file", data: audioBase64, mediaType: "audio/wav" },
      ],
    }],
    maxOutputTokens: 1200,
    maxRetries: 0,
  });
  return normalizeStyleTags(await result.output);
}

/** Preserve safe upstream recovery messages without exposing credentials or raw responses. */
export function styleTagError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    try {
      const body = error.responseBody ? JSON.parse(error.responseBody) : undefined;
      const message = body?.message ?? body?.error?.message;
      if (typeof message === "string" && message.trim()) return message.trim().slice(0, 400);
    } catch { /* fall through to the SDK's safe message */ }
    if (error.message) return error.message.slice(0, 400);
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return "The AI returned an unreadable tag result. Please try another clip.";
  }
  console.error("Style tag generation failed", error);
  return "AI style tagging is unavailable right now. Please try again later.";
}
