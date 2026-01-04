// /supabase/functions/send-checkout/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  try {
    const { checkout_id } = await req.json();

    const responseBody = {
      message: "Checkout request received",
      checkout_id,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown server error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});