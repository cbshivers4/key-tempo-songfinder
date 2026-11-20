import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StyleTags } from "@/lib/style-tags";

const inputSchema = z.object({
  audioBase64: z.string().min(100).max(1_500_000).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Invalid audio"),
  format: z.literal("wav"),
});

export type StyleTagsResult =
  | { status: "ok"; tags: StyleTags }
  | { status: "limit" }
  | { status: "error"; message: string };

// Signed-in only: audio analysis consumes one combined daily use unless the account has Pro.
export const analyzeStyleClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<StyleTagsResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { status: "error", message: "AI style tagging is not configured." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildPaymentsEnv } = await import("@/lib/payments-env");
    const { data: remaining, error } = await supabaseAdmin.rpc("consume_use_for", {
      _user: context.userId,
      check_env: buildPaymentsEnv(),
    });
    if (error) return { status: "error", message: "Couldn't check your plan." };
    if (remaining === null) return { status: "limit" };

    try {
      const { generateStyleTags } = await import("@/lib/ai/style-tags.server");
      const tags = await generateStyleTags(apiKey, data.audioBase64);
      return { status: "ok", tags };
    } catch (error) {
      const { styleTagError } = await import("@/lib/ai/style-tags.server");
      return { status: "error", message: styleTagError(error) };
    }
  });
