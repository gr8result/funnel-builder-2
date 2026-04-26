import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function EmailPlans() {
	const router = useRouter();
	const [user, setUser] = useState(null);
	const [selectedPlan, setSelectedPlan] = useState(null);

	useEffect(() => {
		(async () => {
			const { data: session } = await supabase.auth.getSession();
			setUser(session?.session?.user || null);
		})();
	}, []);

	const asParam = (value) => (typeof value === "string" ? value : "");

	const buildBillingUrl = (next) => {
		const params = new URLSearchParams();
		const emailPlan = next?.emailPlan || asParam(router.query.emailPlan);
		const smsPlan = next?.smsPlan || asParam(router.query.smsPlan);
		const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
		const socialPlan = next?.socialPlan || asParam(router.query.socialPlan);

		if (emailPlan) params.set("emailPlan", emailPlan);
		if (smsPlan) params.set("smsPlan", smsPlan);
		if (calendarPlan) params.set("calendarPlan", calendarPlan);
		if (socialPlan) params.set("socialPlan", socialPlan);

		const query = params.toString();
		return query ? `/billing?${query}` : "/billing";
	};

	const plans = [
		{
			id: "free",
			name: "Free",
			price: 0,
			subs: "250",
			emails: "500",
		},
		{
			id: "starter",
			name: "Starter",
			price: 29,
			subs: "1,000",
			emails: "10,000",
		},
		{
			id: "growth",
			name: "Growth",
			price: 99,
			subs: "5,000",
			emails: "60,000",
		},
		{
			id: "pro",
			name: "Pro",
			price: 199,
			subs: "15,000",
			emails: "180,000",
			recommended: true,
		},
		{
			id: "advanced",
			name: "Advanced",
			price: 499,
			subs: "50,000",
			emails: "500,000",
		},
		{
			id: "enterprise",
			name: "Enterprise",
			price: null,
			priceLabel: "Contact Support",
			subs: "500,000+",
			emails: "Custom",
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
		const tier = plan.id;

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
				Templates: "Basic",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "-",
				"API / integrations": "-",
				"Team access": "1 user",
				"Priority support": "-",
			},

			starter: {
				"Total subscribers": "1,000",
				"Monthly emails": "10,000",
				"Overage pricing": "$12 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "-",
				"Segmentation level": "Tags + basic filters",
				"A/B testing": "-",
				Templates: "Standard",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "-",
				"API / integrations": "yes",
				"Team access": "1 user",
				"Priority support": "-",
			},

			growth: {
				"Total subscribers": "5,000",
				"Monthly emails": "60,000",
				"Overage pricing": "$10 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Unlimited automations (linear flows)",
				"Segmentation level": "Advanced filters",
				"A/B testing": "yes",
				Templates: "Full library",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "3 users",
				"Priority support": "-",
			},

			pro: {
				"Total subscribers": "15,000",
				"Monthly emails": "180,000",
				"Overage pricing": "$8 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Unlimited + branching/conditions",
				"Segmentation level": "Advanced filters",
				"A/B testing": "yes",
				Templates: "Full library",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "5 users",
				"Priority support": "yes",
			},

			advanced: {
				"Total subscribers": "50,000",
				"Monthly emails": "500,000",
				"Overage pricing": "$6 / 10k extra",
				"Contacts import/export": "yes",
				"Scheduled sends": "yes",
				"Autoresponders": "yes",
				Broadcasts: "yes",
				Campaigns: "yes",
				"Automation level": "Unlimited + branching/conditions",
				"Segmentation level": "Advanced filters",
				"A/B testing": "yes",
				Templates: "Full library",
				"Custom HTML editor": "yes",
				"Tracking (opens & clicks)": "yes",
				"AI email writer": "yes",
				"API / integrations": "yes",
				"Team access": "10 users",
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
						{ICONS.email({ size: 48 })}
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

				<div style={{ overflowX: "auto" }}>
					<table style={page.table}>
						<thead>
							<tr>
								<th style={page.th}>Features</th>
								{plans.map((p) => (
									<th key={p.id} style={{ ...page.th, ...(p.recommended ? page.highlightTh : {}) }}>
										<div style={{ fontSize: 22 }}>{p.name}</div>
										<div style={{ fontSize: 18 }}>{getPlanPriceLabel(p)}</div>
										{p.recommended && (
											<div style={page.recommendedBadge}>Best Value</div>
										)}
									</th>
								))}
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
								<td></td>
								{plans.map((p) => (
									<td key={p.id} style={{ ...page.td, ...(p.recommended ? page.highlightTd : {}) }}>
										<button
											onClick={() => {
												setSelectedPlan(p.id);
												const tierKey = `email-${p.id}`;
											router.push(buildBillingUrl({ emailPlan: tierKey }));
											}}
											style={page.btn}
										>
											Select Plan
										</button>
									</td>
								))}
							</tr>
						</tbody>
					</table>
				</div>

				<div style={page.total}>
					Monthly Total: 
					{getSelectedTotalLabel()}
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
		fontWeight: 700,
	},
	recommendedBadge: {
		marginTop: 6,
		background: "#3b82f6",
		padding: "4px 8px",
		borderRadius: 6,
		fontSize: 12,
	},
};
