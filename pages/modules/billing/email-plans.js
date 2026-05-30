import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

// Tier ordering for comparison (full list kept for delta math)
const EMAIL_TIER_ORDER  = ["email-free", "email-starter", "email-growth", "email-pro", "email-advanced", "email-enterprise"];
const EMAIL_TIER_PRICES = { "email-free": 0, "email-starter": 59, "email-growth": 99, "email-pro": 199, "email-advanced": 499, "email-enterprise": null };

export default function EmailPlans() {
	const router = useRouter();
	const [user, setUser] = useState(null);
	const [selectedPlan, setSelectedPlan] = useState(null);
	const [dbEmailTier, setDbEmailTier] = useState(null);

	useEffect(() => {
		if (!router.isReady) return;
		const fetchUser = async () => {
			const { data: sessionData } = await supabase.auth.getSession();
			let resolvedUser = sessionData?.session?.user;
			if (!resolvedUser) {
				const { data: userData } = await supabase.auth.getUser();
				if (!userData?.user) { router.push("/login"); return; }
				resolvedUser = userData.user;
			}
			setUser(resolvedUser);
			// Skip DB tier when navigating from billing — use the base plan's included tier instead
			if (!router.query.basePlan) {
				const { data: acc } = await supabase.from("accounts")
					.select("email_plan_tier")
					.eq("user_id", resolvedUser.id)
					.order("updated_at", { ascending: false })
					.limit(1);
				if (acc?.[0]?.email_plan_tier) setDbEmailTier(acc[0].email_plan_tier);
			}
		};
		fetchUser();
	}, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Delta pricing ──────────────────────────────────────────────────────────
	// basePlan = their platform plan id (e.g. "growth")
	// emailPlan = separately purchased email tier key (e.g. "email-pro")
	// currentTierId = the HIGHER of: what base plan includes, what they purchased
	const basePlanId     = typeof router.query.basePlan  === "string" ? router.query.basePlan  : null;
	// purchasedId comes from DB (fetched after auth), not from URL param
	const purchasedId    = dbEmailTier || null;
	const includedTier   = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.email : null;
	const includedId     = includedTier?.tierId || null;
	function higherTier(a, b) {
		return (EMAIL_TIER_ORDER.indexOf(a ?? "email-free") >= EMAIL_TIER_ORDER.indexOf(b ?? "email-free")) ? a : b;
	}
	// When basePlanId is set (browsing from billing page), show what the selected base plan includes.
	// Only use the DB-purchased tier when no base plan is in context (e.g. direct navigation).
	const currentTierId = basePlanId ? (includedId || null) : (higherTier(includedId, purchasedId) || null);
	const currentTierPrice = EMAIL_TIER_PRICES[currentTierId] ?? 0;
	function getDeltaLabel(plan) {
		if (plan.id === currentTierId) return "✓ Your Current Level";
		const planOrder = EMAIL_TIER_ORDER.indexOf(plan.id);
		const curOrder  = EMAIL_TIER_ORDER.indexOf(currentTierId);
		if (planOrder < curOrder) return "Downgrade";
		if (plan.price === null)  return "Contact Sales";
		const delta = plan.price - currentTierPrice;
		return delta === 0 ? "Included" : `+$${delta}/mo extra`;
	}
	function getButtonLabel(plan) {
		if (plan.id === currentTierId) return "Current Plan";
		const planOrder = EMAIL_TIER_ORDER.indexOf(plan.id);
		const curOrder  = EMAIL_TIER_ORDER.indexOf(currentTierId);
		if (planOrder < curOrder) return "Downgrade";
		if (plan.price === null)  return "Contact Sales";
		const delta = plan.price - currentTierPrice;
		return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
	}
	// ──────────────────────────────────────────────────────────────────────────

	const asParam = (value) => (typeof value === "string" ? value : "");

	const buildBillingUrl = (next) => {
		const params = new URLSearchParams();
		const basePlan     = asParam(router.query.basePlan);
		const emailPlan    = next?.emailPlan    || asParam(router.query.emailPlan);
		const smsPlan      = next?.smsPlan      || asParam(router.query.smsPlan);
		const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
		const socialPlan   = next?.socialPlan   || asParam(router.query.socialPlan);
		const crmPlan      = next?.crmPlan      || asParam(router.query.crmPlan);
		const funnelPlan   = next?.funnelPlan   || asParam(router.query.funnelPlan);

		if (basePlan)     params.set("basePlan",     basePlan);
		if (emailPlan)    params.set("emailPlan",    emailPlan);
		if (smsPlan)      params.set("smsPlan",      smsPlan);
		if (calendarPlan) params.set("calendarPlan", calendarPlan);
		if (socialPlan)   params.set("socialPlan",   socialPlan);
		if (crmPlan)      params.set("crmPlan",      crmPlan);
		if (funnelPlan)   params.set("funnelPlan",   funnelPlan);

		const query = params.toString();
		return query ? `/billing?${query}` : "/billing";
	};

	// 4 tiers shown — matching the platform pricing table
	const plans = [
		{
			id: "email-starter",
			name: "Starter",
			price: 59,
			subs: "5,000",
			emails: "50,000",
			color: "#6366f1",
		},
		{
			id: "email-growth",
			name: "Growth",
			price: 99,
			subs: "15,000",
			emails: "150,000",
			color: "#22c55e",
		},
		{
			id: "email-pro",
			name: "Scale",
			price: 199,
			subs: "40,000",
			emails: "400,000",
			recommended: true,
			color: "#f59e0b",
		},
		{
			id: "email-advanced",
			name: "Professional",
			price: 499,
			subs: "200,000",
			emails: "2,000,000",
			color: "#7c3aed",
		},
	];

	const features = [
		"Total subscribers",
		"Monthly emails",
		"Overage pricing",
		"Contacts import/export",
		"Scheduled sends",
		"Autoresponders",
		"Broadcasts",
		"Campaigns",
		"Automation level",
		"Segmentation level",
		"A/B testing",
		"Templates",
		"Custom HTML editor",
		"Tracking (opens & clicks)",
		"AI email writer",
		"API / integrations",
		"Team access",
		"Priority support",
	];

	function renderValue(feature, plan) {
		const tier = plan.id.replace("email-", "");

		const map = {
			free: {
				"Total subscribers": "250",
				"Monthly emails": "500",
				"Overage pricing": "Contact Support",
				"Contacts import/export": "-",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "-",
				"Automation level": "-",
				"Segmentation level": "Basic (no segments)",
				"A/B testing": "-",
				Templates: "Basic (10 layouts)",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "-",
				"API / integrations": "-",
				"Team access": "1 user",
				"Priority support": "-",
			},

			starter: {
				"Total subscribers": "5,000",
				"Monthly emails": "50,000",
				"Overage pricing": "$20 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "-",
				"Segmentation level": "Tags & static filters",
				"A/B testing": "-",
				Templates: "Standard (30 templates)",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "-",
				"API / integrations": "yes",
				"Team access": "2 users",
				"Priority support": "-",
			},

			growth: {
				"Total subscribers": "15,000",
				"Monthly emails": "150,000",
				"Overage pricing": "$20 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Multi-step email sequences",
				"Segmentation level": "Behavioral (opens/clicks)",
				"A/B testing": "yes",
				Templates: "Full library (100+ templates)",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "5 users",
				"Priority support": "-",
			},

			pro: {
				"Total subscribers": "40,000",
				"Monthly emails": "400,000",
				"Overage pricing": "$20 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Sequences with if/else branching",
				"Segmentation level": "Behavioral + custom fields",
				"A/B testing": "yes",
				Templates: "Full library (100+ templates)",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "10 users",
				"Priority support": "yes",
			},

			advanced: {
				"Total subscribers": "200,000",
				"Monthly emails": "2,000,000",
				"Overage pricing": "$20 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Sequences with if/else branching",
				"Segmentation level": "Predictive + behavioral",
				"A/B testing": "yes",
				Templates: "Full library (100+ templates)",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "25 users",
				"Priority support": "yes",
			},

			enterprise: {
				"Total subscribers": "500k+",
				"Monthly emails": "Custom",
				"Overage pricing": "Custom",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Unlimited + enterprise controls/SLA",
				"Segmentation level": "Advanced filters",
				"A/B testing": "yes",
				Templates: "Full library",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "Unlimited",
				"Priority support": "Dedicated",
			},
		};

		return map[tier]?.[feature] ?? "-";
	}

	function getPlanPriceLabel(plan) {
		if (typeof plan.price !== "number") {
			return plan.priceLabel || "Contact Support";
		}

		return plan.price === 0 ? "$0/mo" : `$${plan.price}/mo`;
	}

	function getSelectedTotalLabel() {
		if (!selectedPlan) return "$0/mo";

		const plan = plans.find((p) => p.id === selectedPlan);
		if (!plan) return "$0/mo";

		if (typeof plan.price !== "number") {
			return plan.priceLabel || "Contact Support";
		}

		return plan.price === 0 ? "$0/mo" : `$${plan.price}/mo`;
	}

	return (
		<div style={page.wrap}>
			<div style={page.inner}>
				<div style={page.banner}>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ fontSize: 42, lineHeight: 1 }}>📧</span>
						<div>
							<h1 style={page.bannerTitle}>Email Marketing Plans</h1>
							<p style={page.bannerDesc}>Choose your plan - upgrade anytime.</p>
						</div>
					</div>
					<div style={page.bannerRight}>
						<Link href="/billing">
							<button style={page.backBtn}>← Back</button>
						</Link>
					</div>
				</div>
			{/* ── Plan cards ── */}
			{basePlanId && (
				<div style={{ marginBottom: 28, padding: "12px 18px", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#cbd5e1", fontSize: 16, lineHeight: 1.6 }}>
					ℹ️ Your <strong style={{ color: "#fff" }}>{basePlanId.charAt(0).toUpperCase() + basePlanId.slice(1)}</strong> plan includes email up to the{" "}
					<strong style={{ color: "#facc15" }}>{plans.find(p => p.id === currentTierId)?.name || currentTierId}</strong> tier (${currentTierPrice}/mo value).{" "}
					You only pay the <strong style={{ color: "#22c55e" }}>extra difference</strong> to upgrade beyond that.
				</div>
			)}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 40 }}>
				{plans.map((p) => {
					const isCurrent   = p.id === currentTierId;
					const isDowngrade = EMAIL_TIER_ORDER.indexOf(p.id) < EMAIL_TIER_ORDER.indexOf(currentTierId);
					const delta       = isCurrent ? 0 : p.price - currentTierPrice;
					return (
						<div key={p.id} style={{
							position: "relative",
						border: `2px solid ${isCurrent ? p.color : p.color + "55"}`,
						borderRadius: 16,
						padding: "28px 20px 22px",
						background: "#111827",
						display: "flex",
						flexDirection: "column",
						boxShadow: isCurrent ? `0 0 0 3px ${p.color}` : p.recommended ? `0 0 0 3px ${p.color}` : "none",
							transition: "transform 0.2s",
						}}>
							{isCurrent && (
							<span style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: p.color, color: "#000", fontSize: 16, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
									✓ Current Plan
								</span>
							)}
							{p.recommended && !isCurrent && (
								<span style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: p.color, color: "#000", fontSize: 16, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
									Best Value
								</span>
							)}
							<div style={{ fontSize: 22, fontWeight: 600, color: p.color, marginBottom: 6 }}>{p.name}</div>
							<div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 8 }}>
								<span style={{ fontSize: 38, fontWeight: 600, color: p.color, lineHeight: 1 }}>${p.price}</span>
								<span style={{ fontSize: 16, color: "#9ca3af" }}>/mo</span>
							</div>
							{!isCurrent && !isDowngrade && (
								<div style={{ background: p.color + "22", color: p.color, border: `1px solid ${p.color}44`, borderRadius: 8, padding: "5px 10px", fontSize: 16, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>
									{delta === 0 ? "Included in plan" : `+$${delta}/mo extra`}
								</div>
							)}
							<div style={{ height: 2, background: p.color, opacity: 0.25, borderRadius: 2, margin: "10px 0 14px" }} />
							<div style={{ fontSize: 16, color: "#d1d5db", marginBottom: 6 }}>
								<strong style={{ color: p.color }}>{p.subs}</strong> contacts
							</div>
							<div style={{ fontSize: 16, color: "#d1d5db", marginBottom: 16 }}>
								<strong style={{ color: p.color }}>{p.emails}</strong> sends/mo
							</div>
							<button
								disabled={isCurrent}
								onClick={() => {
									if (isCurrent) return;
									setSelectedPlan(p.id);
									router.push(buildBillingUrl({ emailPlan: p.id }));
								}}
								style={{
									marginTop: "auto",
									width: "100%",
									padding: 11,
									borderRadius: 10,
									fontSize: 16,
									fontWeight: 600,
									cursor: isCurrent ? "default" : "pointer",
									background: isCurrent ? "transparent" : isDowngrade ? "#1e293b" : p.color,
									color: isCurrent ? p.color : isDowngrade ? "#9ca3af" : "#000",
									border: isCurrent ? `2px solid ${p.color}` : isDowngrade ? `1px solid ${p.color}44` : "none",
									opacity: 1,
								}}
							>
								{isCurrent ? "✓ Current Plan" : isDowngrade ? "Downgrade" : delta === 0 ? "Select (Included)" : "Select This Plan"}
							</button>
						</div>
					);
				})}
			</div>

			{/* ── Comparison table ── */}
			<div style={{ overflowX: "auto" }}>
				<table style={page.table}>
					<thead>
						<tr>
							<th style={page.th}>Features</th>
							{plans.map((p) => {
								const isCurrent  = p.id === currentTierId;
								const isDowngrade = EMAIL_TIER_ORDER.indexOf(p.id) < EMAIL_TIER_ORDER.indexOf(currentTierId);
								const delta = isCurrent ? 0 : p.price - currentTierPrice;
								return (
									<th key={p.id} style={{ ...page.th, ...(isCurrent ? page.highlightTh : p.recommended ? page.highlightTh : {}), borderTop: `3px solid ${p.color || "#334155"}` }}>
										{p.recommended && <div style={page.recommendedBadge}>Best Value</div>}
										<div style={{ fontSize: 20, fontWeight: 600, color: p.color || "#fff", marginBottom: 6 }}>{p.name}</div>
										{/* Big delta label */}
										{isCurrent ? (
											<div style={{ fontSize: 18, fontWeight: 600, color: "#22c55e" }}>✓ Your Plan</div>
										) : isDowngrade ? (
											<div style={{ fontSize: 16, color: "#9ca3af" }}>—</div>
										) : (
											<div style={{ fontSize: 18, fontWeight: 600, color: "#facc15" }}>
												{delta === 0 ? "Included in plan" : `+$${delta}/mo extra`}
											</div>
										)}
										{/* Small full price for reference */}
										<div style={{ fontSize: 16, color: "#9ca3af", marginTop: 4 }}>
											standalone: ${p.price}/mo
										</div>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
							{features.map((f, i) => (
								<tr key={i}>
									<td style={page.tdFeature}>{f}</td>
									{plans.map((p) => (
										<td key={p.id} style={{ ...page.td, ...(p.recommended ? page.highlightTd : {}) }}>
											{renderValue(f, p)}
										</td>
									))}
								</tr>
							))}

							<tr>
								<td style={page.tdFeature}></td>
							{plans.map((p) => {
								const isCurrent   = p.id === currentTierId;
								const isDowngrade = EMAIL_TIER_ORDER.indexOf(p.id) < EMAIL_TIER_ORDER.indexOf(currentTierId);
								const delta = p.price - currentTierPrice;
								return (
									<td key={p.id} style={{ ...page.td, padding: "16px 10px", ...(isCurrent ? page.highlightTd : p.recommended ? page.highlightTd : {}) }}>
										{!isCurrent && !isDowngrade && (
											<div style={{ fontSize: 16, color: p.color, fontWeight: 600, marginBottom: 6, textAlign: "center" }}>
												{delta === 0 ? "Included in plan" : `+$${delta}/mo`}
											</div>
										)}
										<button
											disabled={isCurrent}
											onClick={() => {
												if (isCurrent) return;
												if (!user) { alert("Please log in to select a plan."); return; }
												router.push(buildBillingUrl({ emailPlan: p.id }));
											}}
											style={{
												width: "100%",
												padding: "10px 14px",
												borderRadius: 8,
												fontSize: 16,
												fontWeight: 600,
												opacity: 1,
												cursor: isCurrent ? "default" : "pointer",
												background: isCurrent ? "transparent" : isDowngrade ? "#1e293b" : p.color || "#1d4ed8",
												color: isCurrent ? (p.color || "#22c55e") : isDowngrade ? "#9ca3af" : "#000",
												border: isCurrent ? `2px solid ${p.color || "#22c55e"}` : isDowngrade ? `1px solid ${p.color || "#22c55e"}44` : "none",
											}}
										>
											{isCurrent ? "✓ Current Plan" : isDowngrade ? "Downgrade" : "Select Plan"}
										</button>
									</td>
								);
							})}
							</tr>
						</tbody>
					</table>
				</div>

				{/* Agency & Enterprise coming soon */}
				<div style={{ marginTop: 24, padding: "14px 20px", background: "#111827", border: "1px solid #1f2937", borderRadius: 10, color: "#9ca3af", fontSize: 16, display: "flex", alignItems: "center", gap: 10 }}>
					<span style={{ fontSize: 18 }}>🚀</span>
					<span><strong style={{ color: "#9ca3af" }}>Agency &amp; Enterprise plans coming soon</strong> — unlimited contacts, dedicated IPs, SLA support, and custom pricing for high-volume senders.</span>
				</div>
			</div>
		</div>
	);
}

const page = {
	wrap: {
		minHeight: "100vh",
		background: "#0c121a",
		color: "#fff",
		padding: "28px 22px",
	},
	inner: { maxWidth: 1320, margin: "0 auto" },
	bannerRight: {
		display: "flex",
		alignItems: "center",
		gap: 10,
		justifyContent: "flex-end",
	},
	banner: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: "#facc15",
		color: "#fff",
		padding: "14px 20px",
		borderRadius: 12,
		marginBottom: 28,
	},
	bannerTitle: { margin: 0, fontSize: 48, fontWeight: 600 },
	bannerDesc: { margin: 0, fontSize: 18, opacity: 0.9 },
	backBtn: {
		background: "#1e293b",
		color: "#fff",
		border: "1px solid #334155",
		borderRadius: 8,
		padding: "6px 14px",
		fontSize: 18,
		cursor: "pointer",
	},
	table: { width: "100%", borderCollapse: "collapse" },
	th: {
		padding: 14,
		background: "#1f2937",
	},
	highlightTh: {
		background: "#203047",
		boxShadow: "inset 0 0 0 1px rgba(250, 204, 21, 0.35)",
	},
	tdFeature: {
		padding: 10,
		background: "#111827",
	},
	td: {
		padding: 10,
		textAlign: "center",
	},
	highlightTd: {
		background: "rgba(250, 204, 21, 0.08)",
	},
	btn: {
		background: "#1e293b",
		border: "1px solid #334155",
		color: "#fff",
		borderRadius: 8,
		padding: "8px 16px",
		cursor: "pointer",
	},
	total: {
		marginTop: 30,
		textAlign: "right",
		color: "#38bdf8",
		fontWeight: 600,
	},
	recommendedBadge: {
		marginTop: 6,
		background: "#3b82f6",
		padding: "4px 8px",
		borderRadius: 6,
		fontSize: 16,
	},
};
