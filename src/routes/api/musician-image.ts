import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

function errorResponse(message: string, status: number, code?: string) {
  return Response.json({ error: { message, code } }, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/musician-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!token) return errorResponse("Sign in to generate a musician image.", 401);

        let instrument = "";
        let stream = true;
        try {
          const body = await request.json() as { instrument?: unknown; stream?: unknown };
          instrument = typeof body.instrument === "string" ? body.instrument.trim() : "";
          stream = body.stream !== false;
        } catch {
          return errorResponse("Enter an instrument to generate an image.", 400);
        }
        if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'()&+-]{1,59}$/u.test(instrument)) {
          return errorResponse("Enter an instrument using 2–60 letters, numbers, spaces or basic punctuation.", 400);
        }

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const authClient = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false },
          global: { fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return errorResponse("Your session expired. Sign in again.", 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildPaymentsEnv } = await import("@/lib/payments-env");
        const { data: remaining, error: usageError } = await supabaseAdmin.rpc("consume_use_for", {
          _user: authData.user.id,
          check_env: buildPaymentsEnv(),
        });
        if (usageError) return errorResponse("Couldn't check your plan.", 500);
        if (remaining === null) return errorResponse("You've used today's 3 free uses.", 403, "free_limit");

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return errorResponse("AI image generation is not configured.", 500);
        const prompt = `Photorealistic cinematic square portrait of a fictional adult musician actively playing the ${instrument}. Show the musician and the complete instrument clearly, with a believable playing posture. Tasteful dark stage lighting with subtle cyan accents, sharp realistic detail, no text, no logos, no watermark, no other people.`;
        try {
          const upstream = await generateImage({ ...imageSettings, apiKey }, prompt, stream);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
              "Cache-Control": "no-cache, no-store",
            },
          });
        } catch (error) {
          console.error("Musician image request failed", error);
          return errorResponse("The image service is unavailable right now.", 502);
        }
      },
    },
  },
});
