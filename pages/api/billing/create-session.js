// /pages/api/billing/create-session.js
// ✅ FINAL version — monthly subscriptions, validated payload
// Supports base plan + modules as recurring line items.

import Stripe from "stripe";
import { BASE_PLANS } from "../../../data/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lineItems, metadata = {} } = req.body;
    const basePlan = metadata.plan ? BASE_PLANS[String(metadata.plan)] : null;
    const isAnnual = metadata.annual === "1";
    const introDiscountPercent = !isAnnual ? (basePlan?.introDiscountPercent || 0) : 0;
    const introMonths = basePlan?.introMonths || 0;
    const trialDays = basePlan?.trialDays || 0;

    // 🛡 Validate payload
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      console.error("❌ No valid line items received:", req.body);
      return res.status(400).json({ error: "No modules provided" });
    }

    const rampEligible = !isAnnual && introDiscountPercent > 0 && introMonths > 0;
    const validLineItems = lineItems.filter((item) => item && item.name && !isNaN(item.amount));

    const normalPrices = [];
    if (rampEligible) {
      for (const item of validLineItems) {
        const normalPrice = await stripe.prices.create({
          currency: "aud",
          product_data: { name: item.name },
          unit_amount: Math.round(Number(item.amount) * 100),
          recurring: { interval: "month" },
        });
        normalPrices.push(normalPrice.id);
      }
    }

    // 🧮 Convert data for Stripe. Monthly ramp plans use one 3-month prepaid
    // intro billing period, then the webhook schedules normal monthly prices.
    const formattedItems = validLineItems.map((item, index) => {
      const normalAmount = Number(item.amount);
      const introUnitAmount = rampEligible
        ? normalAmount * introMonths * (index === 0 ? (1 - introDiscountPercent / 100) : 1)
        : normalAmount;

      return {
        price_data: {
          currency: "aud",
          product_data: { name: rampEligible ? `${item.name} - ${introMonths} month onboarding block` : item.name },
          unit_amount: Math.round(introUnitAmount * 100),
          recurring: rampEligible
            ? { interval: "month", interval_count: introMonths }
            : { interval: isAnnual ? "year" : "month" },
        },
        quantity: 1,
      };
    });

    if (formattedItems.length === 0) {
      console.error("❌ Invalid or empty formattedItems:", lineItems);
      return res.status(400).json({ error: "No valid items for checkout" });
    }

    // 🧾 Build success URL — carry all plan params back so apply-plan can activate them
    const successParts = ["session_id={CHECKOUT_SESSION_ID}"];
    if (metadata.plan)         successParts.push(`plan=${encodeURIComponent(String(metadata.plan))}`);
    if (metadata.emailPlan)    successParts.push(`emailPlan=${encodeURIComponent(String(metadata.emailPlan))}`);
    if (metadata.smsPlan)      successParts.push(`smsPlan=${encodeURIComponent(String(metadata.smsPlan))}`);
    if (metadata.calendarPlan) successParts.push(`calendarPlan=${encodeURIComponent(String(metadata.calendarPlan))}`);
    if (metadata.socialPlan)   successParts.push(`socialPlan=${encodeURIComponent(String(metadata.socialPlan))}`);
    if (metadata.websitePlan)  successParts.push(`websitePlan=${encodeURIComponent(String(metadata.websitePlan))}`);
    if (metadata.selected)     successParts.push(`selected=${encodeURIComponent(String(metadata.selected))}`);
    if (metadata.annual)       successParts.push(`annual=${encodeURIComponent(String(metadata.annual))}`);
    if (metadata.builderPro)   successParts.push(`builderPro=${encodeURIComponent(String(metadata.builderPro))}`);
    if (metadata.projectCreditPack) successParts.push(`projectCreditPack=${encodeURIComponent(String(metadata.projectCreditPack))}`);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: formattedItems,
      metadata: {
        plan:         metadata.plan         ? String(metadata.plan)         : "",
        emailPlan:    metadata.emailPlan    ? String(metadata.emailPlan)    : "",
        smsPlan:      metadata.smsPlan      ? String(metadata.smsPlan)      : "",
        calendarPlan: metadata.calendarPlan ? String(metadata.calendarPlan) : "",
        socialPlan:   metadata.socialPlan   ? String(metadata.socialPlan)   : "",
        websitePlan:  metadata.websitePlan  ? String(metadata.websitePlan)  : "",
        selected:     metadata.selected     ? String(metadata.selected)     : "",
        annual:       metadata.annual       ? String(metadata.annual)       : "",
        pricingModelVersion: metadata.pricingModelVersion ? String(metadata.pricingModelVersion) : "",
        builderPro: metadata.builderPro ? String(metadata.builderPro) : "",
        builderProPriceId: metadata.builderProPriceId ? String(metadata.builderProPriceId) : "",
        projectCreditPack: metadata.projectCreditPack ? String(metadata.projectCreditPack) : "",
        projectCreditQty: metadata.projectCreditQty ? String(metadata.projectCreditQty) : "",
        projectCreditAmount: metadata.projectCreditAmount ? String(metadata.projectCreditAmount) : "",
        projectCreditStripePriceId: metadata.projectCreditStripePriceId ? String(metadata.projectCreditStripePriceId) : "",
        usageUpgradePlaceholders: metadata.usageUpgradePlaceholders ? String(metadata.usageUpgradePlaceholders) : "",
        discountCode: metadata.discountCode ? String(metadata.discountCode) : "",
        discountPercent: metadata.discountPercent ? String(metadata.discountPercent) : "",
        rampEligible: rampEligible ? "1" : "",
        normalPriceIds: normalPrices.join(","),
      },
      subscription_data: {
        trial_period_days: trialDays > 0 ? trialDays : undefined,
        metadata: {
          plan:     metadata.plan     ? String(metadata.plan)     : "",
          websitePlan: metadata.websitePlan ? String(metadata.websitePlan) : "",
          selected: metadata.selected ? String(metadata.selected) : "",
          pricingModelVersion: metadata.pricingModelVersion ? String(metadata.pricingModelVersion) : "",
          builderPro: metadata.builderPro ? String(metadata.builderPro) : "",
          projectCreditPack: metadata.projectCreditPack ? String(metadata.projectCreditPack) : "",
          projectCreditQty: metadata.projectCreditQty ? String(metadata.projectCreditQty) : "",
          projectCreditAmount: metadata.projectCreditAmount ? String(metadata.projectCreditAmount) : "",
          introDiscountPercent: introDiscountPercent ? String(introDiscountPercent) : "",
          introMonths: introMonths ? String(introMonths) : "",
          rampEligible: rampEligible ? "1" : "",
          normalPriceIds: normalPrices.join(","),
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?${successParts.join("&")}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,
    });

    console.log("✅ Stripe subscription session created:", session.id);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}
