import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

// ✅ Server-side supabase (service role is fine here)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { courseId, scope, moduleId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: "Missing courseId" });
    if (!scope || !["full_course", "module"].includes(scope))
      return res.status(400).json({ error: "Invalid scope" });
    if (scope === "module" && !moduleId)
      return res.status(400).json({ error: "Missing moduleId" });

    // ✅ Get user from Bearer token (sent from frontend)
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return res.status(401).json({ error: "Invalid auth" });

    const userId = userData.user.id;
    const userEmail = userData.user.email || undefined;

    // ✅ Load pricing row
    let pricingQ = supabaseAdmin
      .from("course_pricing")
      .select("*")
      .eq("course_id", courseId)
      .eq("scope", scope)
      .eq("is_active", true)
      .limit(1);

    if (scope === "module") pricingQ = pricingQ.eq("module_id", moduleId);

    const { data: prices, error: pErr } = await pricingQ;
    if (pErr || !prices?.[0]) return res.status(400).json({ error: "No active price found" });

    const price = prices[0];

    // ✅ Load course title for Stripe product name
    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id,title")
      .eq("id", courseId)
      .single();

    if (cErr || !course) return res.status(404).json({ error: "Course not found" });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // ✅ IMPORTANT: We mark course purchases using metadata keys that DO NOT clash
    // with your existing store metadata (app_checkout_session_id etc.)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (price.currency || "AUD").toLowerCase(),
            unit_amount: price.price_cents,
            product_data: {
              name:
                scope === "full_course"
                  ? `Full Course: ${course.title}`
                  : `Module: ${course.title}`,
            },
          },
        },
      ],
      success_url: `${appUrl}/pages/modules/courses/${courseId}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pages/modules/courses/${courseId}/learn`,
      metadata: {
        gr8_type: "course_purchase",
        courseId,
        scope,
        moduleId: moduleId || "",
        userId,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
